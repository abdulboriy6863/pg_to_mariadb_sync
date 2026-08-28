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

    def get_target_mapping(self):
        """Fetch target table and column mappings from config/mapping_rules.json."""
        default_mapping = {
            "table_name": "TCSP_CHARGE_HIST",
            "begin_col": "begin",
            "end_col": "end",
            "power_col": "power",
            "price_col": "totalPrice",
            "card_no_col": "cardNo",
            "cs_id_col": "csId",
            "cp_id_col": "cpId",
            "transaction_id_col": "transactionId"
        }
        try:
            mapping_path = os.path.join(os.path.dirname(__file__), "..", "config", "mapping_rules.json")
            if os.path.exists(mapping_path):
                with open(mapping_path, "r", encoding="utf-8") as f:
                    rules = json.load(f)
                    custom_mapping = rules.get("mariadb_target_mapping", {})
                    if custom_mapping:
                        default_mapping.update(custom_mapping)
                    elif rules.get("target_table"):
                        default_mapping["table_name"] = rules.get("target_table")
        except Exception as e:
            logger.warning(f"Failed to read mariadb_target_mapping: {e}")
        
        raw_table = default_mapping.get("table_name", "TCSP_CHARGE_HIST").strip().replace("`", "")
        default_mapping["raw_table_name"] = raw_table if raw_table else "TCSP_CHARGE_HIST"
        default_mapping["escaped_table_name"] = f"`{default_mapping['raw_table_name']}`"
        return default_mapping

    def get_target_table(self):
        """Fetch escaped target table name for backward compatibility."""
        return self.get_target_mapping()["escaped_table_name"]

    def get_tables(self):
        """Fetch list of tables in MariaDB database."""
        conn = self.get_connection()
        if not conn:
            return []
        try:
            with conn.cursor() as cursor:
                cursor.execute("SHOW TABLES;")
                rows = cursor.fetchall()
                tables = [list(r.values())[0] for r in rows if r]
                return tables
        except Exception as e:
            logger.error(f"Error fetching MariaDB tables: {e}")
            return []
        finally:
            conn.close()

    def get_table_columns(self, table_name):
        """Fetch list of column names and types for a MariaDB table."""
        table_name = table_name.strip().replace("`", "")
        conn = self.get_connection()
        if not conn:
            return []
        try:
            with conn.cursor() as cursor:
                cursor.execute(f"SHOW COLUMNS FROM `{table_name}`;")
                rows = cursor.fetchall()
                cols = [{"column_name": r['Field'], "data_type": r['Type']} for r in rows if 'Field' in r]
                return cols
        except Exception as e:
            logger.error(f"Error fetching columns for MariaDB table `{table_name}`: {e}")
            return []
        finally:
            conn.close()

    def verify_target_schema(self, table_name=None):
        """Verify table existence and inspect column names in MariaDB."""
        if not table_name:
            table_name = self.get_target_mapping()["raw_table_name"]
        else:
            table_name = table_name.strip().replace("`", "")
            
        conn = self.get_connection()
        if not conn:
            return {"exists": False, "columns": [], "message": "Database connection offline"}
        try:
            with conn.cursor() as cursor:
                cursor.execute(f"SHOW COLUMNS FROM `{table_name}`;")
                rows = cursor.fetchall()
                columns = [r['Field'] for r in rows if 'Field' in r]
                return {
                    "exists": True,
                    "table_name": table_name,
                    "columns": columns,
                    "message": f"Table `{table_name}` exists with {len(columns)} columns"
                }
        except Exception as e:
            return {
                "exists": False,
                "table_name": table_name,
                "columns": [],
                "message": f"Table `{table_name}` does not exist or error occurred: {e}"
            }
        finally:
            conn.close()

    def create_target_table_if_missing(self, table_name=None):
        """Create target table if missing in MariaDB."""
        mapping = self.get_target_mapping()
        if not table_name:
            table_name = mapping["raw_table_name"]
        else:
            table_name = table_name.strip().replace("`", "")

        conn = self.get_connection()
        if not conn:
            return False, "MariaDB connection offline"
        
        tx_col = mapping.get("transaction_id_col", "transactionId")
        cs_col = mapping.get("cs_id_col", "csId")
        cp_col = mapping.get("cp_id_col", "cpId")
        begin_col = mapping.get("begin_col", "begin")
        end_col = mapping.get("end_col", "end")
        power_col = mapping.get("power_col", "power")
        price_col = mapping.get("price_col", "totalPrice")
        card_col = mapping.get("card_no_col", "cardNo")

        create_sql = f"""
        CREATE TABLE IF NOT EXISTS `{table_name}` (
            `{tx_col}` BIGINT(20) NOT NULL PRIMARY KEY,
            `{cs_col}` INT(11) NOT NULL DEFAULT 0,
            `{cp_col}` INT(11) NOT NULL DEFAULT 0,
            `{begin_col}` DATETIME NULL,
            `{end_col}` DATETIME NULL,
            `{power_col}` DOUBLE NULL DEFAULT 0,
            `{price_col}` DOUBLE NULL DEFAULT 0,
            `{card_col}` VARCHAR(64) NULL,
            `modelId` INT(11) DEFAULT 0,
            `connectorId` INT(11) DEFAULT 1,
            `powerUnit` VARCHAR(16) DEFAULT 'kWh',
            `startSoc` INT(11) DEFAULT NULL,
            `soc` INT(11) DEFAULT NULL,
            `roamingType` VARCHAR(32) DEFAULT NULL,
            `approvenum` VARCHAR(64) DEFAULT NULL,
            `carNo` VARCHAR(32) DEFAULT NULL,
            `userName` VARCHAR(64) DEFAULT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """
        try:
            with conn.cursor() as cursor:
                cursor.execute(create_sql)
                conn.commit()
                return True, f"Table `{table_name}` created/verified successfully"
        except Exception as e:
            logger.error(f"Error creating table `{table_name}`: {e}")
            return False, f"Failed to create table `{table_name}`: {e}"
        finally:
            conn.close()

    def get_live_metrics(self):
        """Fetch count of imported/synced records using indexed query for high performance."""
        mapping = self.get_target_mapping()
        target_table = mapping["escaped_table_name"]
        tx_col = f"`{mapping.get('transaction_id_col', 'transactionId')}`"
        begin_col = f"`{mapping.get('begin_col', 'begin')}`"

        conn = self.get_connection()
        if not conn:
            return {
                "today_history_count": 0,
                "total_imported_count": 0
            }
        try:
            with conn.cursor() as cursor:
                # Total tool-imported records (negative transactionId)
                cursor.execute(f"SELECT COUNT(*) as cnt FROM {target_table} WHERE {tx_col} < 0;")
                total_imported_cnt = cursor.fetchone()['cnt']

                # Today's tool-imported records
                cursor.execute(f"SELECT COUNT(*) as cnt FROM {target_table} WHERE {tx_col} < 0 AND DATE({begin_col}) = CURDATE();")
                today_cnt = cursor.fetchone()['cnt']

                return {
                    "today_history_count": today_cnt,
                    "total_imported_count": total_imported_cnt
                }
        except Exception as e:
            logger.error(f"Error fetching live metrics from {target_table}: {e}")
            return {
                "today_history_count": 0,
                "total_imported_count": 0
            }
        finally:
            conn.close()

    def insert_batch_charge_history(self, records, chunk_size=2000, progress_callback=None):
        """Batch insert records into target MariaDB table using INSERT IGNORE with chunking and progress reporting."""
        if not records:
            return 0, 0

        target_mapping = self.get_target_mapping()
        target_table = target_mapping["escaped_table_name"]
        
        # Ensure table exists before inserting
        self.create_target_table_if_missing(target_mapping["raw_table_name"])

        conn = self.get_connection()
        if not conn:
            logger.warning("MariaDB connection offline. Skipping live DB insert.")
            return 0, len(records)

        columns = list(records[0].keys())
        col_names = ", ".join([f"`{col}`" for col in columns])
        placeholders = ", ".join(["%s"] * len(columns))
        
        sql = f"INSERT IGNORE INTO {target_table} ({col_names}) VALUES ({placeholders})"
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
                
                logger.info(f"Successfully inserted {total_inserted} out of {len(records)} records into {target_table}.")
                return total_inserted, len(records) - total_inserted
        except Exception as e:
            logger.error(f"Batch insert error for {target_table}: {e}")
            conn.rollback()
            return total_inserted, len(records) - total_inserted
        finally:
            conn.close()


