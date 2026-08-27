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

class DailySyncer:
    def __init__(self, db_config_path=None):
        if db_config_path is None:
            db_config_path = os.path.join(os.path.dirname(__file__), "..", "config", "db_config.json")
            
        with open(db_config_path, "r", encoding="utf-8") as f:
            self.db_config = json.load(f)

        self.mariadb_client = MariaDBClient(db_config_path)
        self.pg_client = PostgreSQLClient(db_config_path)
        self.lookup_service = LookupService(self.mariadb_client)
        self.history_log_path = os.path.join(os.path.dirname(__file__), "..", "logs", "sync_history.json")

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

    def sync_daily_data(self, target_date=None, dry_run=True):
        """Fetches daily data from PostgreSQL (for exactly 1 target date, default yesterday) and syncs to MariaDB."""
        if target_date is None:
            target_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

        start_time = datetime.now()
        logger.info(f"Initiating Daily Sync for Date: {target_date} (dry_run={dry_run})")
        
        pg_records = []

        # Connect to PostgreSQL via PGClient
        conn = self.pg_client.get_connection()
        if conn:
            try:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT station_name, charger_name, begin_time, end_time, 
                           power_kwh, price_won, card_no, pay_type
                    FROM charging_history
                    WHERE DATE(begin_time) = %s
                """, (target_date,))
                columns = [desc[0] for desc in cursor.description]
                for row in cursor.fetchall():
                    pg_records.append(dict(zip(columns, row)))
            except Exception as e:
                logger.warning(f"Error querying PostgreSQL database: {e}")
            finally:
                conn.close()
        else:
            logger.warning("PostgreSQL connection unavailable. Daily sync cannot proceed without PG connection.")
            result = {
                "status": "skipped",
                "target_date": target_date,
                "timestamp": start_time.strftime("%Y-%m-%d %H:%M:%S"),
                "message": "PostgreSQL connection offline. Please check DB credentials.",
                "count": 0
            }
            if not dry_run:
                self._save_history_entry(result)
            return result

        if not pg_records:
            logger.info(f"No records found in PostgreSQL for {target_date}.")
            result = {
                "status": "success",
                "target_date": target_date,
                "timestamp": start_time.strftime("%Y-%m-%d %H:%M:%S"),
                "count": 0,
                "message": f"No records found in PG for date {target_date}"
            }
            if not dry_run:
                self._save_history_entry(result)
            return result

        transformed = []
        missing_stations = set()
        missing_chargers = set()

        for r in pg_records:
            st_name = r.get("station_name")
            cp_name = r.get("charger_name")

            cs_id = self.lookup_service.get_cs_id(st_name)
            if not cs_id:
                if st_name:
                    missing_stations.add(st_name)
                continue

            cp_id = self.lookup_service.get_cp_id(cs_id, cp_name)
            if not cp_id:
                if cp_name:
                    missing_chargers.add(f"{st_name} -> {cp_name}")
                continue

            begin_str = str(r.get("begin_time", f"{target_date} 00:00:00"))
            end_str = str(r.get("end_time", f"{target_date} 00:00:00"))

            raw = f"{cs_id}_{cp_id}_{begin_str}"
            h = int(hashlib.md5(raw.encode('utf-8')).hexdigest()[:12], 16)
            tx_id = -(1000000 + (h % 899999999999))

            transformed.append({
                "transactionId": tx_id,
                "csId": cs_id,
                "cpId": cp_id,
                "modelId": 0,
                "connectorId": 1,
                "begin": begin_str,
                "end": end_str,
                "power": float(r.get("power_kwh", 0)),
                "powerUnit": "kWh",
                "totalPrice": int(float(r.get("price_won", 0))),
                "cardNo": str(r.get("card_no", "")),
                "roamingType": str(r.get("pay_type", "")),
                "startSoc": 0,
                "soc": 0
            })

        unmapped_count = len(pg_records) - len(transformed)
        logger.info(f"Transformed {len(transformed)} / {len(pg_records)} records for {target_date}. Unmapped: {unmapped_count}")

        if dry_run:
            logger.info("=== DRY RUN DAILY SYNC RESULT ===")
            return {
                "status": "success",
                "mode": "dry_run",
                "target_date": target_date,
                "timestamp": start_time.strftime("%Y-%m-%d %H:%M:%S"),
                "total_pg_records": len(pg_records),
                "transformed_count": len(transformed),
                "unmapped_count": unmapped_count,
                "missing_stations": list(missing_stations)[:10],
                "missing_chargers": list(missing_chargers)[:10]
            }
        else:
            inserted, dupes = self.mariadb_client.insert_batch_charge_history(transformed)
            res = {
                "status": "success",
                "mode": "live",
                "target_date": target_date,
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
