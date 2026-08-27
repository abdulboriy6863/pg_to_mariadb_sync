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
        cfg = override_config if override_config else self.config
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
