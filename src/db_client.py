import json
import logging
import os
import pymysql

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("DBClient")

class MariaDBClient:
    def __init__(self, config_path=None):
        if config_path is None:
            config_path = os.path.join(os.path.dirname(__file__), "..", "config", "db_config.json")
        
        with open(config_path, "r", encoding="utf-8") as f:
            full_config = json.load(f)
            self.config = full_config.get("mariadb", {})

    def get_connection(self):
        try:
            conn = pymysql.connect(
                host=self.config.get("host"),
                port=self.config.get("port", 3306),
                user=self.config.get("user"),
                password=self.config.get("password"),
                database=self.config.get("database"),
                connect_timeout=self.config.get("connect_timeout", 5),
                cursorclass=pymysql.cursors.DictCursor
            )
            return conn
        except Exception as e:
            logger.error(f"Failed to connect to MariaDB: {e}")
            return None

    def fetch_station_mappings(self):
        """Fetch station name to numeric id mapping from TINF_CS."""
        conn = self.get_connection()
        if not conn:
            return {}
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT id, name FROM TINF_CS;")
                rows = cursor.fetchall()
                station_map = {row['name'].strip(): row['id'] for row in rows if row.get('name')}
                return station_map
        except Exception as e:
            logger.error(f"Error fetching stations: {e}")
            return {}
        finally:
            conn.close()

    def fetch_charger_mappings(self):
        """Fetch charger mapping (cs_numeric_id, cp_name) -> cp_numeric_id."""
        conn = self.get_connection()
        if not conn:
            return {}
        try:
            with conn.cursor() as cursor:
                sql = """
                SELECT B.csId as cs_numeric_id, CP.id as cp_numeric_id, CP.name as cp_name 
                FROM TINF_CS_CP B
                INNER JOIN TINF_CP CP ON B.cpId = CP.id;
                """
                cursor.execute(sql)
                rows = cursor.fetchall()
                charger_map = {}
                for row in rows:
                    if row.get('cs_numeric_id') and row.get('cp_name'):
                        key = (row['cs_numeric_id'], row['cp_name'].strip())
                        charger_map[key] = row['cp_numeric_id']
                return charger_map
        except Exception as e:
            logger.error(f"Error fetching chargers: {e}")
            return {}
        finally:
            conn.close()

    def get_mapped_counts(self):
        """Fast count of stations and chargers from TINF_CS and TINF_CP."""
        conn = self.get_connection()
        if not conn:
            return 0, 0
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT COUNT(*) as cnt FROM TINF_CS;")
                stations_count = cursor.fetchone()['cnt']
                cursor.execute("SELECT COUNT(*) as cnt FROM TINF_CP;")
                chargers_count = cursor.fetchone()['cnt']
                return stations_count, chargers_count
        except Exception as e:
            logger.error(f"Error fetching counts: {e}")
            return 0, 0
        finally:
            conn.close()

    def get_live_metrics(self):
        """Fetch count of imported/synced records using indexed query for high performance."""
        conn = self.get_connection()
        if not conn:
            return {
                "today_history_count": 0,
                "total_imported_count": 0
            }
        try:
            with conn.cursor() as cursor:
                # Total tool-imported records (negative transactionId)
                cursor.execute("SELECT COUNT(*) as cnt FROM TCSP_CHARGE_HIST WHERE transactionId < 0;")
                total_imported_cnt = cursor.fetchone()['cnt']

                # Today's tool-imported records
                cursor.execute("SELECT COUNT(*) as cnt FROM TCSP_CHARGE_HIST WHERE transactionId < 0 AND DATE(begin) = CURDATE();")
                today_cnt = cursor.fetchone()['cnt']

                return {
                    "today_history_count": today_cnt,
                    "total_imported_count": total_imported_cnt
                }
        except Exception as e:
            logger.error(f"Error fetching live metrics: {e}")
            return {
                "today_history_count": 0,
                "total_imported_count": 0
            }
        finally:
            conn.close()

    def insert_batch_charge_history(self, records, chunk_size=2000, progress_callback=None):
        """Batch insert records into TCSP_CHARGE_HIST using INSERT IGNORE with chunking and progress reporting."""
        if not records:
            return 0, 0

        conn = self.get_connection()
        if not conn:
            logger.warning("MariaDB connection offline. Skipping live DB insert.")
            return 0, len(records)

        columns = list(records[0].keys())
        col_names = ", ".join([f"`{col}`" for col in columns])
        placeholders = ", ".join(["%s"] * len(columns))
        
        sql = f"INSERT IGNORE INTO TCSP_CHARGE_HIST ({col_names}) VALUES ({placeholders})"
        values_list = [[r[col] for col in columns] for r in records]

        total_inserted = 0
        processed_count = 0

        try:
            with conn.cursor() as cursor:
                for i in range(0, len(values_list), chunk_size):
                    chunk = values_list[i:i + chunk_size]
                    inserted_chunk = cursor.executemany(sql, chunk)
                    conn.commit()
                    total_inserted += inserted_chunk
                    processed_count += len(chunk)

                    if progress_callback:
                        dupes_so_far = processed_count - total_inserted
                        progress_callback(processed_count, total_inserted, dupes_so_far)
                
                logger.info(f"Successfully inserted {total_inserted} out of {len(records)} records into TCSP_CHARGE_HIST.")
                return total_inserted, len(records) - total_inserted
        except Exception as e:
            logger.error(f"Batch insert error: {e}")
            conn.rollback()
            return total_inserted, len(records) - total_inserted
        finally:
            conn.close()
