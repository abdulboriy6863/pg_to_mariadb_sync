import json
import logging
import os
from datetime import datetime
from src.db_client import MariaDBClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("DedupService")

class DedupService:
    def __init__(self, db_client: MariaDBClient = None):
        self.db_client = db_client or MariaDBClient()
        self.backup_table_name = "TCSP_CHARGE_HIST_DUPLICATES_BACKUP"
        self._station_id_map = None
        self._charger_id_map = None

    def _get_names_cache(self):
        """Fetch human-readable names for csId and cpId from TINF_CS and TINF_CP."""
        if self._station_id_map is not None and self._charger_id_map is not None:
            return self._station_id_map, self._charger_id_map

        st_map = {}
        cp_map = {}
        conn = self.db_client.get_connection()
        if conn:
            try:
                with conn.cursor() as cursor:
                    # Station ID -> Name
                    cursor.execute("SELECT id, name FROM TINF_CS;")
                    for r in cursor.fetchall():
                        st_map[r['id']] = r.get('name', '').strip()

                    # Charger ID -> Name
                    cursor.execute("SELECT id, name FROM TINF_CP;")
                    for r in cursor.fetchall():
                        cp_map[r['id']] = r.get('name', '').strip()
            except Exception as e:
                logger.warning(f"Failed to load CS/CP names cache: {e}")
            finally:
                conn.close()

        self._station_id_map = st_map
        self._charger_id_map = cp_map
        return st_map, cp_map

    def create_backup_table_if_missing(self):
        """Ensure TCSP_CHARGE_HIST_DUPLICATES_BACKUP table exists in MariaDB."""
        mapping = self.db_client.get_target_mapping()
        source_table = mapping["escaped_table_name"]
        backup_table = f"`{self.backup_table_name}`"

        conn = self.db_client.get_connection()
        if not conn:
            return False, "MariaDB connection offline"

        try:
            with conn.cursor() as cursor:
                # Check if backup table exists
                cursor.execute(f"SHOW TABLES LIKE '{self.backup_table_name}';")
                if not cursor.fetchone():
                    logger.info(f"Creating backup table {backup_table} matching {source_table}...")
                    create_sql = f"""
                    CREATE TABLE {backup_table} LIKE {source_table};
                    """
                    cursor.execute(create_sql)

                    # Remove primary key constraint to allow storing historical duplicates with same ID if needed
                    try:
                        cursor.execute(f"ALTER TABLE {backup_table} DROP PRIMARY KEY;")
                    except Exception:
                        pass

                    # Add audit columns: deleted_at and delete_reason
                    cursor.execute(f"""
                    ALTER TABLE {backup_table}
                    ADD COLUMN IF NOT EXISTS `deleted_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                    ADD COLUMN IF NOT EXISTS `delete_reason` VARCHAR(64) DEFAULT 'MANUAL_DEDUP';
                    """)
                    
                    # Add indexing for fast queries
                    try:
                        cursor.execute(f"CREATE INDEX IF NOT EXISTS `idx_b_del_at` ON {backup_table} (`deleted_at`);")
                        cursor.execute(f"CREATE INDEX IF NOT EXISTS `idx_b_cp_begin` ON {backup_table} (`cpId`, `begin`);")
                    except Exception:
                        pass

                    conn.commit()
                    logger.info(f"✅ Table {backup_table} created successfully with audit columns and indexes.")
                return True, f"Backup table `{self.backup_table_name}` is ready."
        except Exception as e:
            logger.error(f"Error creating backup table {backup_table}: {e}")
            return False, str(e)
        finally:
            conn.close()

    def scan_duplicates(self, start_date=None, end_date=None, target_date=None, dedup_type="all"):
        """
        Scan MariaDB for duplicates in TCSP_CHARGE_HIST.
        Supports filtering by:
          - start_date and end_date (YYYY-MM-DD)
          - single target_date (YYYY-MM-DD)
        Classifies duplicates into:
          - EXACT: exact same cpId, connectorId, begin, end
          - ZERO_POWER: same cpId, connectorId, begin where one is power > 0 and another is power = 0
          - TIME_OVERLAP: same cpId, connectorId with overlapping begin ~ end times
        """
        self.create_backup_table_if_missing()
        st_map, cp_map = self._get_names_cache()

        mapping = self.db_client.get_target_mapping()
        target_table = mapping["escaped_table_name"]
        tx_col = f"`{mapping.get('transaction_id_col', 'transactionId')}`"
        cs_col = f"`{mapping.get('cs_id_col', 'csId')}`"
        cp_col = f"`{mapping.get('cp_id_col', 'cpId')}`"
        conn_col = "`connectorId`"
        begin_col = f"`{mapping.get('begin_col', 'begin')}`"
        end_col = f"`{mapping.get('end_col', 'end')}`"
        power_col = f"`{mapping.get('power_col', 'power')}`"
        price_col = f"`{mapping.get('price_col', 'totalPrice')}`"
        card_col = f"`{mapping.get('card_no_col', 'cardNo')}`"

        conn = self.db_client.get_connection()
        if not conn:
            return {
                "status": "error",
                "message": "MariaDB server offline",
                "total_groups": 0,
                "total_duplicates": 0,
                "exact_count": 0,
                "zero_power_count": 0,
                "overlap_count": 0,
                "groups": []
            }

        # Build date condition
        date_where = "1=1"
        params = []
        if start_date and end_date:
            date_where = f"DATE({begin_col}) >= %s AND DATE({begin_col}) <= %s"
            params = [start_date, end_date]
        elif target_date:
            date_where = f"DATE({begin_col}) = %s"
            params = [target_date]
        elif start_date:
            date_where = f"DATE({begin_col}) >= %s"
            params = [start_date]

        groups = []
        seen_tx_ids = set()
        exact_count = 0
        zero_power_count = 0
        overlap_count = 0

        try:
            with conn.cursor() as cursor:
                # -------------------------------------------------------------
                # 1. Exact Duplicates & Zero Power Scenarios (Same cpId, connectorId, begin)
                # -------------------------------------------------------------
                if dedup_type in ("all", "exact", "zero_power"):
                    group_sql = f"""
                    SELECT {cp_col} as cpId, {conn_col} as connectorId, {begin_col} as begin_time, COUNT(*) as cnt
                    FROM {target_table}
                    WHERE {date_where}
                    GROUP BY {cp_col}, {conn_col}, {begin_col}
                    HAVING COUNT(*) > 1
                    ORDER BY {begin_col} DESC
                    LIMIT 1000;
                    """
                    cursor.execute(group_sql, params)
                    conflict_keys = cursor.fetchall()

                    for idx, key in enumerate(conflict_keys):
                        cp_id = key['cpId']
                        connector_id = key['connectorId']
                        begin_val = str(key['begin_time'])

                        detail_sql = f"""
                        SELECT {tx_col} as transactionId, {cs_col} as csId, {cp_col} as cpId, {conn_col} as connectorId,
                               {begin_col} as begin_time, {end_col} as end_time, {power_col} as power_val,
                               {price_col} as price_val, {card_col} as card_no
                        FROM {target_table}
                        WHERE {cp_col} = %s AND {conn_col} = %s AND {begin_col} = %s
                        ORDER BY {power_col} DESC, {price_col} DESC, {tx_col} ASC;
                        """
                        cursor.execute(detail_sql, (cp_id, connector_id, begin_val))
                        rows = cursor.fetchall()
                        if len(rows) < 2:
                            continue

                        # Classify type
                        powers = [float(r['power_val'] or 0) for r in rows]
                        has_positive = any(p > 0 for p in powers)
                        has_zero = any(p == 0 for p in powers)
                        is_zero_power = (has_positive and has_zero)

                        curr_type = "ZERO_POWER" if is_zero_power else "EXACT"
                        if curr_type == "ZERO_POWER":
                            zero_power_count += (len(rows) - 1)
                        else:
                            exact_count += (len(rows) - 1)

                        group_items = []
                        for r_idx, row in enumerate(rows):
                            tx_id = row['transactionId']
                            seen_tx_ids.add(tx_id)
                            cs_id = row['csId']
                            st_name = st_map.get(cs_id, f"Stansiya #{cs_id}")
                            cp_name = cp_map.get(cp_id, f"Zaryadlovchi #{cp_id}")

                            # Recommended: First row (highest power/price or earliest) is KEEP, others are DELETE
                            is_keep = (r_idx == 0)
                            group_items.append({
                                "transactionId": tx_id,
                                "csId": cs_id,
                                "station_name": st_name,
                                "cpId": cp_id,
                                "charger_name": cp_name,
                                "connectorId": row['connectorId'],
                                "begin": str(row['begin_time']),
                                "end": str(row['end_time']),
                                "power": float(row['power_val'] or 0),
                                "totalPrice": int(row['price_val'] or 0),
                                "cardNo": str(row.get('card_no') or ''),
                                "is_recommended_keep": is_keep,
                                "is_recommended_delete": not is_keep,
                                "type": curr_type,
                                "badge_text": "✅ Asl nusxa (Qoladi)" if is_keep else ("🟡 0 Quvvatli xato" if curr_type == "ZERO_POWER" else "🔴 Aynan bir xil")
                            })

                        groups.append({
                            "group_id": f"GRP_EXACT_{idx+1}",
                            "type": curr_type,
                            "cpId": cp_id,
                            "charger_name": cp_map.get(cp_id, f"Zaryadlovchi #{cp_id}"),
                            "connectorId": connector_id,
                            "conflict_time": begin_val,
                            "count": len(rows),
                            "duplicates_to_delete": len(rows) - 1,
                            "records": group_items
                        })

                # -------------------------------------------------------------
                # 2. Time Overlapping Conflicts (A.begin < B.end AND A.end > B.begin)
                # -------------------------------------------------------------
                if dedup_type in ("all", "overlap"):
                    overlap_sql = f"""
                    SELECT A.{tx_col} as tx1, A.{cs_col} as cs1, A.{cp_col} as cp1, A.{conn_col} as conn1,
                           A.{begin_col} as b1, A.{end_col} as e1, A.{power_col} as p1, A.{price_col} as pr1, A.{card_col} as c1,
                           B.{tx_col} as tx2, B.{cs_col} as cs2, B.{cp_col} as cp2, B.{conn_col} as conn2,
                           B.{begin_col} as b2, B.{end_col} as e2, B.{power_col} as p2, B.{price_col} as pr2, B.{card_col} as c2
                    FROM {target_table} A
                    JOIN {target_table} B ON A.{cp_col} = B.{cp_col} AND A.{conn_col} = B.{conn_col} AND A.{tx_col} < B.{tx_col}
                    WHERE A.{date_where}
                      AND A.{begin_col} < B.{end_col} AND A.{end_col} > B.{begin_col}
                      AND A.{begin_col} != B.{begin_col}
                    LIMIT 200;
                    """
                    cursor.execute(overlap_sql, params)
                    overlap_pairs = cursor.fetchall()

                    for o_idx, pair in enumerate(overlap_pairs):
                        tx1 = pair['tx1']
                        tx2 = pair['tx2']
                        if tx1 in seen_tx_ids and tx2 in seen_tx_ids:
                            continue

                        seen_tx_ids.add(tx1)
                        seen_tx_ids.add(tx2)
                        overlap_count += 1

                        p1 = float(pair['p1'] or 0)
                        p2 = float(pair['p2'] or 0)

                        # Keep the one with larger power or longer session
                        keep_first = (p1 >= p2)

                        cs1, cp1 = pair['cs1'], pair['cp1']
                        st_name = st_map.get(cs1, f"Stansiya #{cs1}")
                        cp_name = cp_map.get(cp1, f"Zaryadlovchi #{cp1}")

                        r1 = {
                            "transactionId": tx1,
                            "csId": cs1,
                            "station_name": st_name,
                            "cpId": cp1,
                            "charger_name": cp_name,
                            "connectorId": pair['conn1'],
                            "begin": str(pair['b1']),
                            "end": str(pair['e1']),
                            "power": p1,
                            "totalPrice": int(pair['pr1'] or 0),
                            "cardNo": str(pair.get('c1') or ''),
                            "is_recommended_keep": keep_first,
                            "is_recommended_delete": not keep_first,
                            "type": "TIME_OVERLAP",
                            "badge_text": "✅ Asl nusxa (Qoladi)" if keep_first else "🔵 Vaqt ustma-ust"
                        }
                        r2 = {
                            "transactionId": tx2,
                            "csId": cs1,
                            "station_name": st_name,
                            "cpId": cp1,
                            "charger_name": cp_name,
                            "connectorId": pair['conn2'],
                            "begin": str(pair['b2']),
                            "end": str(pair['e2']),
                            "power": p2,
                            "totalPrice": int(pair['pr2'] or 0),
                            "cardNo": str(pair.get('c2') or ''),
                            "is_recommended_keep": not keep_first,
                            "is_recommended_delete": keep_first,
                            "type": "TIME_OVERLAP",
                            "badge_text": "✅ Asl nusxa (Qoladi)" if not keep_first else "🔵 Vaqt ustma-ust"
                        }

                        groups.append({
                            "group_id": f"GRP_OVERLAP_{o_idx+1}",
                            "type": "TIME_OVERLAP",
                            "cpId": cp1,
                            "charger_name": cp_name,
                            "connectorId": pair['conn1'],
                            "conflict_time": f"{pair['b1']} ~ {pair['e1']}",
                            "count": 2,
                            "duplicates_to_delete": 1,
                            "records": [r1, r2]
                        })

                total_dupes = exact_count + zero_power_count + overlap_count
                return {
                    "status": "success",
                    "total_groups": len(groups),
                    "total_duplicates": total_dupes,
                    "exact_count": exact_count,
                    "zero_power_count": zero_power_count,
                    "overlap_count": overlap_count,
                    "groups": groups
                }
        except Exception as e:
            logger.error(f"Error scanning duplicates: {e}")
            return {
                "status": "error",
                "message": str(e),
                "total_groups": 0,
                "total_duplicates": 0,
                "exact_count": 0,
                "zero_power_count": 0,
                "overlap_count": 0,
                "groups": []
            }
        finally:
            conn.close()

    def delete_and_backup_duplicates(self, transaction_ids, delete_reason="MANUAL_SELECTION", chunk_size=500):
        """
        Safely copies specified duplicate records to TCSP_CHARGE_HIST_DUPLICATES_BACKUP,
        then deletes them from TCSP_CHARGE_HIST using chunking and atomic transaction.
        """
        if not transaction_ids:
            return {"status": "success", "backed_up_count": 0, "deleted_count": 0}

        self.create_backup_table_if_missing()
        mapping = self.db_client.get_target_mapping()
        target_table = mapping["escaped_table_name"]
        backup_table = f"`{self.backup_table_name}`"
        tx_col = f"`{mapping.get('transaction_id_col', 'transactionId')}`"

        conn = self.db_client.get_connection()
        if not conn:
            return {"status": "error", "message": "MariaDB connection offline"}

        total_backed_up = 0
        total_deleted = 0
        tx_list = list(transaction_ids)

        try:
            with conn.cursor() as cursor:
                for i in range(0, len(tx_list), chunk_size):
                    chunk = tx_list[i:i + chunk_size]
                    placeholders = ", ".join(["%s"] * len(chunk))

                    # 1. Copy records to backup table with audit columns
                    copy_sql = f"""
                    INSERT INTO {backup_table}
                    SELECT *, NOW() as deleted_at, %s as delete_reason
                    FROM {target_table}
                    WHERE {tx_col} IN ({placeholders});
                    """
                    cursor.execute(copy_sql, [delete_reason] + chunk)
                    total_backed_up += cursor.rowcount

                    # 2. Delete records from target table
                    delete_sql = f"""
                    DELETE FROM {target_table}
                    WHERE {tx_col} IN ({placeholders});
                    """
                    cursor.execute(delete_sql, chunk)
                    total_deleted += cursor.rowcount

                conn.commit()
                logger.info(f"✅ Successfully backed up {total_backed_up} and deleted {total_deleted} duplicates from {target_table}.")
                return {
                    "status": "success",
                    "backed_up_count": total_backed_up,
                    "deleted_count": total_deleted
                }
        except Exception as e:
            logger.error(f"Error during backup and delete: {e}")
            conn.rollback()
            return {"status": "error", "message": str(e)}
        finally:
            conn.close()

    def get_deleted_backups(self, limit=5, start_date=None, end_date=None, cp_id=None):
        """Fetch latest deleted backup records (default 5 items or filtered)."""
        self.create_backup_table_if_missing()
        st_map, cp_map = self._get_names_cache()

        mapping = self.db_client.get_target_mapping()
        backup_table = f"`{self.backup_table_name}`"
        tx_col = f"`{mapping.get('transaction_id_col', 'transactionId')}`"
        cs_col = f"`{mapping.get('cs_id_col', 'csId')}`"
        cp_col = f"`{mapping.get('cp_id_col', 'cpId')}`"
        conn_col = "`connectorId`"
        begin_col = f"`{mapping.get('begin_col', 'begin')}`"
        end_col = f"`{mapping.get('end_col', 'end')}`"
        power_col = f"`{mapping.get('power_col', 'power')}`"
        price_col = f"`{mapping.get('price_col', 'totalPrice')}`"

        conn = self.db_client.get_connection()
        if not conn:
            return []

        conditions = ["1=1"]
        params = []

        if start_date and end_date:
            conditions.append(f"DATE(deleted_at) >= %s AND DATE(deleted_at) <= %s")
            params.extend([start_date, end_date])
        elif start_date:
            conditions.append(f"DATE(deleted_at) = %s")
            params.append(start_date)

        if cp_id:
            conditions.append(f"{cp_col} = %s")
            params.append(cp_id)

        where_clause = " AND ".join(conditions)

        try:
            with conn.cursor() as cursor:
                sql = f"""
                SELECT {tx_col} as transactionId, {cs_col} as csId, {cp_col} as cpId, {conn_col} as connectorId,
                       {begin_col} as begin_time, {end_col} as end_time, {power_col} as power_val,
                       {price_col} as price_val, `deleted_at`, `delete_reason`
                FROM {backup_table}
                WHERE {where_clause}
                ORDER BY `deleted_at` DESC
                LIMIT %s;
                """
                cursor.execute(sql, params + [max(1, int(limit))])
                rows = cursor.fetchall()
                results = []
                for r in rows:
                    cs_id = r['csId']
                    cp_id = r['cpId']
                    results.append({
                        "transactionId": r['transactionId'],
                        "csId": cs_id,
                        "station_name": st_map.get(cs_id, f"Stansiya #{cs_id}"),
                        "cpId": cp_id,
                        "charger_name": cp_map.get(cp_id, f"Zaryadlovchi #{cp_id}"),
                        "connectorId": r['connectorId'],
                        "begin": str(r['begin_time']),
                        "end": str(r['end_time']),
                        "power": float(r['power_val'] or 0),
                        "totalPrice": int(r['price_val'] or 0),
                        "deleted_at": str(r.get('deleted_at') or ''),
                        "delete_reason": str(r.get('delete_reason') or 'MANUAL_DEDUP')
                    })
                return results
        except Exception as e:
            logger.error(f"Error fetching backup list: {e}")
            return []
        finally:
            conn.close()

    def restore_duplicates(self, transaction_ids, chunk_size=500):
        """Restore specified backup records back into TCSP_CHARGE_HIST and remove from backup using chunking and atomic transaction."""
        if not transaction_ids:
            return {"status": "success", "restored_count": 0}

        mapping = self.db_client.get_target_mapping()
        target_table = mapping["escaped_table_name"]
        backup_table = f"`{self.backup_table_name}`"
        tx_col = f"`{mapping.get('transaction_id_col', 'transactionId')}`"

        conn = self.db_client.get_connection()
        if not conn:
            return {"status": "error", "message": "MariaDB connection offline"}

        total_restored = 0
        tx_list = list(transaction_ids)

        try:
            with conn.cursor() as cursor:
                # Get column list of target table to insert excluding audit columns
                target_cols = [c['column_name'] for c in self.db_client.get_table_columns(mapping['raw_table_name'])]
                col_names_str = ", ".join([f"`{c}`" for c in target_cols])

                for i in range(0, len(tx_list), chunk_size):
                    chunk = tx_list[i:i + chunk_size]
                    placeholders = ", ".join(["%s"] * len(chunk))

                    restore_sql = f"""
                    INSERT IGNORE INTO {target_table} ({col_names_str})
                    SELECT {col_names_str}
                    FROM {backup_table}
                    WHERE {tx_col} IN ({placeholders});
                    """
                    cursor.execute(restore_sql, chunk)
                    total_restored += cursor.rowcount

                    # Delete from backup table
                    del_sql = f"DELETE FROM {backup_table} WHERE {tx_col} IN ({placeholders});"
                    cursor.execute(del_sql, chunk)

                conn.commit()
                logger.info(f"✅ Successfully restored {total_restored} records back to {target_table}.")
                return {"status": "success", "restored_count": total_restored}
        except Exception as e:
            logger.error(f"Error restoring records: {e}")
            conn.rollback()
            return {"status": "error", "message": str(e)}
        finally:
            conn.close()
