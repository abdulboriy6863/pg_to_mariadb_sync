import json
import logging
import os
import psycopg2

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("PostgreSQLClient")

class PostgreSQLClient:
    def __init__(self, config_path=None):
        if config_path is None:
            config_path = os.path.join(os.path.dirname(__file__), "..", "config", "db_config.json")
        
        self.config_path = config_path
        self.config = self._load_config()

    def _load_config(self):
        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                full_config = json.load(f)
                return full_config.get("postgresql", {})
        except Exception as e:
            logger.error(f"Error loading PG config: {e}")
            return {}

    def get_connection(self, override_config=None):
        cfg = override_config if override_config else self._load_config()
        try:
            conn = psycopg2.connect(
                host=cfg.get("host", "127.0.0.1"),
                port=int(cfg.get("port", 5432)),
                user=cfg.get("user", "postgres"),
                password=cfg.get("password", ""),
                dbname=cfg.get("database", "old_charging_db"),
                connect_timeout=5
            )
            return conn
        except Exception as e:
            logger.error(f"Failed to connect to PostgreSQL: {e}")
            return None

    def test_connection(self, config_data=None):
        cfg = config_data if config_data else self.config
        try:
            conn = psycopg2.connect(
                host=cfg.get("host", "127.0.0.1"),
                port=int(cfg.get("port", 5432)),
                user=cfg.get("user", "postgres"),
                password=cfg.get("password", ""),
                dbname=cfg.get("database", "old_charging_db"),
                connect_timeout=5
            )
            cursor = conn.cursor()
            cursor.execute("SELECT version();")
            version = cursor.fetchone()[0]
            conn.close()
            return {
                "status": "online",
                "message": "Connection Successful!",
                "version": version
            }
        except Exception as e:
            logger.warning(f"PostgreSQL connection test failed: {e}")
            return {
                "status": "offline",
                "message": str(e),
                "version": None
            }

    def get_tables(self, config_data=None):
        conn = self.get_connection(config_data)
        if not conn:
            return []
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                ORDER BY table_name;
            """)
            tables = [row[0] for row in cursor.fetchall()]
            conn.close()
            return tables
        except Exception as e:
            logger.error(f"Error fetching PG tables: {e}")
            if conn:
                conn.close()
            return []

    def get_table_columns(self, table_name, config_data=None):
        conn = self.get_connection(config_data)
        if not conn:
            return []
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE LOWER(table_name) = LOWER(%s)
                  AND table_schema NOT IN ('pg_catalog', 'information_schema')
                ORDER BY ordinal_position;
            """, (table_name,))
            cols = [{"column_name": row[0], "data_type": row[1]} for row in cursor.fetchall()]
            conn.close()
            return cols
        except Exception as e:
            logger.error(f"Error fetching columns for {table_name}: {e}")
            if conn:
                conn.close()
            return []

