import hashlib
import json
import logging
import os
from datetime import datetime, timedelta
from src.db_client import MariaDBClient
from src.pg_client import PostgreSQLClient
from src.lookup_service import LookupService

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("DailySyncer")

GLOBAL_SYNC_PROGRESS = {
    "is_running": False,
    "status": "idle",
    "total": 0,
    "processed": 0,
    "inserted": 0,
    "duplicates": 0,
    "unmapped": 0,
    "percentage": 0.0,
    "message": "Tayyor"
}

def update_global_progress(is_running=True, status="processing", total=0, processed=0, inserted=0, duplicates=0, unmapped=0, message=""):
    pct = round((processed / total * 100.0), 1) if total > 0 else (100.0 if not is_running else 0.0)
    GLOBAL_SYNC_PROGRESS.update({
        "is_running": is_running,
        "status": status,
        "total": total,
        "processed": processed,
        "inserted": inserted,
        "duplicates": duplicates,
        "unmapped": unmapped,
        "percentage": min(100.0, pct),
        "message": message
    })

def get_sync_progress_state():
    return GLOBAL_SYNC_PROGRESS

class DailySyncer:
    def __init__(self, db_config_path=None):
        if db_config_path is None:
            db_config_path = os.path.join(os.path.dirname(__file__), "..", "config", "db_config.json")
            
        with open(db_config_path, "r", encoding="utf-8") as f:
            self.db_config = json.load(f)

        self.mariadb_client = MariaDBClient(db_config_path)
        self.pg_client = PostgreSQLClient(db_config_path)
        self.lookup_service = LookupService(self.mariadb_client)
        mapping_rules_path = os.path.join(os.path.dirname(__file__), "..", "config", "mapping_rules.json")
        self.mapping_rules = {}
        if os.path.exists(mapping_rules_path):
            try:
                with open(mapping_rules_path, "r", encoding="utf-8") as f:
                    self.mapping_rules = json.load(f)
            except Exception as e:
                logger.error(f"Error loading mapping rules: {e}")

    def _save_history_entry(self, entry):
        try:
            os.makedirs(os.path.dirname(self.history_log_path), exist_ok=True)
            history = []
            if os.path.exists(self.history_log_path):
                with open(self.history_log_path, "r", encoding="utf-8") as f:
                    history = json.load(f)
            history.insert(0, entry) # newest first
            history = history[:100] # keep last 100 entries
            with open(self.history_log_path, "w", encoding="utf-8") as f:
                json.dump(history, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Error saving sync history log: {e}")

    def sync_daily_data(self, start_date=None, end_date=None, target_date=None, lookback_days=None, dry_run=True):
        """Fetches daily data from PostgreSQL (for date range, target date or lookback_days window) and syncs to MariaDB."""
        start_time = datetime.now()
        today_str = start_time.strftime("%Y-%m-%d")

        # Reset Progress
        update_global_progress(is_running=True, status="initializing", message="PG so'rovi tayyorlanmoqda...")

        # Future Date Validation
        if start_date and start_date > today_str:
            err_msg = f"Kelajak sanasi ({start_date}) bo'yicha ma'lumot ko'chirish mumkin emas! Maksimal sana: bugun ({today_str})."
            update_global_progress(is_running=False, status="error", message=err_msg)
            return {
                "status": "error",
                "target_date": start_date,
                "timestamp": start_time.strftime("%Y-%m-%d %H:%M:%S"),
                "message": err_msg
            }
        if end_date and end_date > today_str:
            err_msg = f"Kelajak sanasi ({end_date}) bo'yicha ma'lumot ko'chirish mumkin emas! Maksimal sana: bugun ({today_str})."
            update_global_progress(is_running=False, status="error", message=err_msg)
            return {
                "status": "error",
                "target_date": end_date,
                "timestamp": start_time.strftime("%Y-%m-%d %H:%M:%S"),
                "message": err_msg
            }
        if target_date and target_date > today_str:
            err_msg = f"Kelajak sanasi ({target_date}) bo'yicha ma'lumot ko'chirish mumkin emas! Maksimal sana: bugun ({today_str})."
            update_global_progress(is_running=False, status="error", message=err_msg)
            return {
                "status": "error",
                "target_date": target_date,
                "timestamp": start_time.strftime("%Y-%m-%d %H:%M:%S"),
                "message": err_msg
            }

        is_range_query = False
        target_dates = []

        if start_date and end_date:
            if start_date > end_date:
                start_date, end_date = end_date, start_date
            date_summary_str = f"{start_date} ~ {end_date}"
            is_range_query = True
        elif start_date:
            date_summary_str = start_date
            target_dates = [start_date]
        elif target_date:
            date_summary_str = target_date
            target_dates = [target_date]
        else:
            if lookback_days is None:
                lookback_days = self.db_config.get("auto_sync", {}).get("lookback_days", 1)
            try:
                lookback_days = max(1, int(lookback_days))
            except (ValueError, TypeError):
                lookback_days = 1

            target_dates = [
                (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
                for i in range(1, lookback_days + 1)
            ]
            date_summary_str = target_dates[0] if len(target_dates) == 1 else f"{target_dates[-1]} ~ {target_dates[0]} ({len(target_dates)} kun)"

        logger.info(f"Initiating Daily Sync for Date(s): {date_summary_str} (dry_run={dry_run})")
        update_global_progress(is_running=True, status="querying_pg", message=f"PostgreSQL dan ({date_summary_str}) ma'lumotlar o'qilmoqda...")

        # Reload configuration dynamically
        mapping_rules_path = os.path.join(os.path.dirname(__file__), "..", "config", "mapping_rules.json")
        if os.path.exists(mapping_rules_path):
            try:
                with open(mapping_rules_path, "r", encoding="utf-8") as f:
                    self.mapping_rules = json.load(f)
            except Exception as e:
                logger.error(f"Error reloading mapping rules: {e}")

        db_config_path = os.path.join(os.path.dirname(__file__), "..", "config", "db_config.json")
        if os.path.exists(db_config_path):
            try:
                with open(db_config_path, "r", encoding="utf-8") as f:
                    self.db_config = json.load(f)
            except Exception as e:
                logger.error(f"Error reloading db config: {e}")

        pg_schema = self.mapping_rules.get("pg_schema_mapping", {})
        pg_cfg = self.db_config.get("postgresql", {})

        pg_table_raw = pg_schema.get("table_name") or pg_cfg.get("table_name") or pg_cfg.get("source_table") or "charging_history"
        pg_table = "".join(c for c in str(pg_table_raw) if c.isalnum() or c == '_') or "charging_history"

        st_col = "".join(c for c in str(pg_schema.get("station_name_col", "station_name")) if c.isalnum() or c == '_') or "station_name"
        cp_col = "".join(c for c in str(pg_schema.get("charger_name_col", "charger_name")) if c.isalnum() or c == '_') or "charger_name"
        begin_col = "".join(c for c in str(pg_schema.get("begin_time_col", "begin_time")) if c.isalnum() or c == '_') or "begin_time"
        end_col = "".join(c for c in str(pg_schema.get("end_time_col", "end_time")) if c.isalnum() or c == '_') or "end_time"
        power_col = "".join(c for c in str(pg_schema.get("power_kwh_col", "power_kwh")) if c.isalnum() or c == '_') or "power_kwh"
        price_col = "".join(c for c in str(pg_schema.get("price_won_col", "price_won")) if c.isalnum() or c == '_') or "price_won"
        card_col = "".join(c for c in str(pg_schema.get("card_no_col", "card_no")) if c.isalnum() or c == '_') or "card_no"
        pay_col = "".join(c for c in str(pg_schema.get("pay_type_col", "pay_type")) if c.isalnum() or c == '_') or "pay_type"

        pg_records = []
        conn = self.pg_client.get_connection()
        if conn:
            try:
                cursor = conn.cursor()
                select_clause = f"""
                    SELECT COALESCE(s.station_name, h.{st_col}) AS station_name,
                           COALESCE(c.charger_name, h.{cp_col}) AS charger_name,
                           CASE WHEN h.start_date IS NOT NULL AND h.start_time IS NOT NULL 
                                THEN CONCAT(h.start_date, ' ', h.start_time)
                                ELSE CAST(h.{begin_col} AS VARCHAR) END AS begin_time,
                           CASE WHEN h.end_date IS NOT NULL AND h.end_time IS NOT NULL 
                                THEN CONCAT(h.end_date, ' ', h.end_time)
                                ELSE CAST(h.{end_col} AS VARCHAR) END AS end_time,
                           CASE WHEN h.use_power IS NOT NULL THEN (CASE WHEN h.use_power > 5000 THEN ROUND(CAST(h.use_power AS NUMERIC) / 1000.0, 2) ELSE CAST(h.use_power AS NUMERIC) END)
                                ELSE CAST(h.{power_col} AS NUMERIC) END AS power_kwh,
                           COALESCE(h.use_payment, h.{price_col}) AS price_won,
                           h.{card_col} AS card_no,
                           h.{pay_col} AS pay_type
                    FROM {pg_table} h
                    LEFT JOIN station s ON h.{st_col} = s.station_id
                    LEFT JOIN charger c ON (h.{st_col} = c.station_id AND (h.{cp_col} = c.charger_no OR h.{cp_col} = c.charger_id))
                """
                date_expr = f"COALESCE(h.start_date, DATE(h.{begin_col}))"
                if is_range_query:
                    cursor.execute(f"{select_clause} WHERE {date_expr} >= %s AND {date_expr} <= %s", (start_date, end_date))
                elif len(target_dates) == 1:
                    cursor.execute(f"{select_clause} WHERE {date_expr} = %s", (target_dates[0],))
                else:
                    placeholders = ", ".join(["%s"] * len(target_dates))
                    cursor.execute(f"{select_clause} WHERE {date_expr} IN ({placeholders})", tuple(target_dates))

                columns = [desc[0] for desc in cursor.description]
                for row in cursor.fetchall():
                    pg_records.append(dict(zip(columns, row)))
            except Exception as e:
                logger.error(f"Error querying PostgreSQL database: {e}")
                err_msg = f"PostgreSQL SQL So'rov Xatoligi: {e}"
                update_global_progress(is_running=False, status="error", message=err_msg)
                return {
                    "status": "error",
                    "target_date": date_summary_str,
                    "timestamp": start_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "message": err_msg,
                    "total_pg_records": 0,
                    "inserted": 0,
                    "duplicates_skipped": 0,
                    "transformed_count": 0,
                    "unmapped_count": 0,
                    "count": 0
                }
        else:
            logger.warning("PostgreSQL connection unavailable. Daily sync cannot proceed without PG connection.")
            err_msg = "PostgreSQL connection offline. Please check DB credentials."
            update_global_progress(is_running=False, status="offline", message=err_msg)
            result = {
                "status": "skipped",
                "target_date": date_summary_str,
                "timestamp": start_time.strftime("%Y-%m-%d %H:%M:%S"),
                "message": err_msg,
                "total_pg_records": 0,
                "inserted": 0,
                "duplicates_skipped": 0,
                "transformed_count": 0,
                "unmapped_count": 0,
                "count": 0
            }
            if not dry_run:
                self._save_history_entry(result)
            return result

        if not pg_records:
            logger.info(f"No records found in PostgreSQL for {date_summary_str}.")
            msg = f"No records found in PG for date range {date_summary_str}"
            update_global_progress(is_running=False, status="completed", total=0, processed=0, inserted=0, duplicates=0, unmapped=0, message=msg)
            result = {
                "status": "success",
                "mode": "dry_run" if dry_run else "live",
                "target_date": date_summary_str,
                "timestamp": start_time.strftime("%Y-%m-%d %H:%M:%S"),
                "total_pg_records": 0,
                "inserted": 0,
                "duplicates_skipped": 0,
                "transformed_count": 0,
                "unmapped_count": 0,
                "count": 0,
                "message": msg
            }
            if not dry_run:
                self._save_history_entry(result)
            return result

        total_pg_count = len(pg_records)
        update_global_progress(is_running=True, status="transforming", total=total_pg_count, processed=0, message="Stansiya va zaryadlovchilar ID ga moslanmoqda...")

        transformed = []
        missing_stations = set()
        missing_chargers = set()

        for idx, r in enumerate(pg_records):
            st_name = r.get("station_name")
            cp_name = r.get("charger_name")

            cs_id = self.lookup_service.get_cs_id(st_name)
            if not cs_id:
                if st_name:
                    missing_stations.add(st_name)
                if idx % 500 == 0:
                    update_global_progress(is_running=True, status="transforming", total=total_pg_count, processed=idx, unmapped=total_pg_count - len(transformed), message="Moslashtirilmoqda...")
                continue

            cp_id = self.lookup_service.get_cp_id(cs_id, cp_name)
            if not cp_id:
                if cp_name:
                    missing_chargers.add(f"{st_name} -> {cp_name}")
                if idx % 500 == 0:
                    update_global_progress(is_running=True, status="transforming", total=total_pg_count, processed=idx, unmapped=total_pg_count - len(transformed), message="Moslashtirilmoqda...")
                continue

            begin_str = str(r.get("begin_time", ""))
            end_str = str(r.get("end_time", ""))

            raw = f"{cs_id}_{cp_id}_{begin_str}"
            h = int(hashlib.md5(raw.encode('utf-8')).hexdigest()[:12], 16)
            tx_id = -(1000000 + (h % 899999999999))

            target_mapping = self.mariadb_client.get_target_mapping()
            tx_col = target_mapping.get("transaction_id_col", "transactionId")
            cs_col = target_mapping.get("cs_id_col", "csId")
            cp_col = target_mapping.get("cp_id_col", "cpId")
            begin_col = target_mapping.get("begin_col", "begin")
            end_col = target_mapping.get("end_col", "end")
            power_col = target_mapping.get("power_col", "power")
            price_col = target_mapping.get("price_col", "totalPrice")
            card_col = target_mapping.get("card_no_col", "cardNo")

            rec_item = {
                tx_col: tx_id,
                cs_col: cs_id,
                cp_col: cp_id,
                "modelId": 0,
                "connectorId": 1,
                begin_col: begin_str,
                end_col: end_str,
                power_col: float(r.get("power_kwh", 0)),
                "powerUnit": "kWh",
                price_col: int(float(r.get("price_won", 0))),
                card_col: str(r.get("card_no", "")),
                "roamingType": str(r.get("pay_type", "")),
                "startSoc": 0,
                "soc": 0
            }

            custom_maps = mapping_rules.get("custom_mappings", {})
            if isinstance(custom_maps, dict):
                for pg_c, maria_c in custom_maps.items():
                    if pg_c and maria_c and pg_c in r:
                        rec_item[maria_c] = r[pg_c]

            transformed.append(rec_item)

            if idx % 500 == 0 or idx == total_pg_count - 1:
                update_global_progress(is_running=True, status="transforming", total=total_pg_count, processed=idx + 1, unmapped=idx + 1 - len(transformed), message="Moslashtirilmoqda...")

        unmapped_count = len(pg_records) - len(transformed)
        logger.info(f"Transformed {len(transformed)} / {len(pg_records)} records for {date_summary_str}. Unmapped: {unmapped_count}")

        if dry_run:
            logger.info("=== DRY RUN DAILY SYNC RESULT ===")
            update_global_progress(is_running=False, status="completed", total=total_pg_count, processed=total_pg_count, inserted=0, duplicates=0, unmapped=unmapped_count, message="Dry-Run Sinov muvaffaqiyatli tugadi!")
            return {
                "status": "success",
                "mode": "dry_run",
                "target_date": date_summary_str,
                "timestamp": start_time.strftime("%Y-%m-%d %H:%M:%S"),
                "total_pg_records": len(pg_records),
                "transformed_count": len(transformed),
                "unmapped_count": unmapped_count,
                "missing_stations": list(missing_stations)[:10],
                "missing_chargers": list(missing_chargers)[:10]
            }
        else:
            update_global_progress(is_running=True, status="inserting", total=total_pg_count, processed=unmapped_count, inserted=0, duplicates=0, unmapped=unmapped_count, message="MariaDB ga paketlab yozilmoqda...")

            def progress_cb(proc_batch, ins_batch, dupes_batch):
                tot_proc = unmapped_count + proc_batch
                update_global_progress(
                    is_running=True,
                    status="inserting",
                    total=total_pg_count,
                    processed=tot_proc,
                    inserted=ins_batch,
                    duplicates=dupes_batch,
                    unmapped=unmapped_count,
                    message=f"MariaDB ga ko'chirilmoqda ({ins_batch} ta kiritildi, {dupes_batch} ta dublikat)..."
                )

            inserted, dupes = self.mariadb_client.insert_batch_charge_history(transformed, progress_callback=progress_cb)

            update_global_progress(
                is_running=False,
                status="completed",
                total=total_pg_count,
                processed=total_pg_count,
                inserted=inserted,
                duplicates=dupes,
                unmapped=unmapped_count,
                message="Sinxronizatsiya muvaffaqiyatli yakunlandi!"
            )

            res = {
                "status": "success",
                "mode": "live",
                "target_date": date_summary_str,
                "timestamp": start_time.strftime("%Y-%m-%d %H:%M:%S"),
                "total_pg_records": len(pg_records),
                "inserted": inserted,
                "duplicates_skipped": dupes,
                "unmapped_count": unmapped_count,
                "missing_stations": list(missing_stations)[:10],
                "missing_chargers": list(missing_chargers)[:10]
            }
            self._save_history_entry(res)
            return res
