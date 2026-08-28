import os
import shutil
import tempfile
import json
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Body
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request

import logging
from apscheduler.schedulers.background import BackgroundScheduler
from src.db_client import MariaDBClient
from src.pg_client import PostgreSQLClient
from src.csv_importer import CSVImporter
from src.daily_syncer import DailySyncer, get_sync_progress_state

app = FastAPI(title="PostgreSQL to MariaDB Migration & Sync Dashboard")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
static_dir = os.path.join(BASE_DIR, "static")
templates_dir = os.path.join(BASE_DIR, "templates")
CONFIG_PATH = os.path.join(BASE_DIR, "config", "db_config.json")
SYNC_HISTORY_PATH = os.path.join(BASE_DIR, "logs", "sync_history.json")

app.mount("/static", StaticFiles(directory=static_dir), name="static")
templates = Jinja2Templates(directory=templates_dir)

# Daily Auto-Sync Scheduler
scheduler = BackgroundScheduler()

def run_scheduled_sync():
    logging.info("⏰ Executing Automatic Daily Sync (PostgreSQL ➔ MariaDB)...")
    try:
        syncer = DailySyncer()
        res = syncer.sync_daily_data(dry_run=False)
        logging.info(f"Daily Sync Completed: {res}")
    except Exception as e:
        logging.error(f"Daily Sync Error: {e}")

def get_auto_sync_config():
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                return cfg.get("auto_sync", {"enabled": True, "hour": 2, "minute": 0, "second": 0, "start_date": ""})
        except Exception:
            pass
    return {"enabled": True, "hour": 2, "minute": 0, "second": 0, "start_date": ""}

def apply_auto_sync_schedule(auto_sync_cfg=None):
    if auto_sync_cfg is None:
        auto_sync_cfg = get_auto_sync_config()
    
    enabled = auto_sync_cfg.get("enabled", True)
    try:
        hour = int(auto_sync_cfg.get("hour", 2)) % 24
        minute = int(auto_sync_cfg.get("minute", 0)) % 60
        second = int(auto_sync_cfg.get("second", 0)) % 60
    except (ValueError, TypeError):
        hour, minute, second = 2, 0, 0

    job = scheduler.get_job("daily_sync_job")
    
    if enabled:
        if job:
            scheduler.reschedule_job("daily_sync_job", trigger="cron", hour=hour, minute=minute, second=second)
            logging.info(f"🔄 Rescheduled daily_sync_job to {hour:02d}:{minute:02d}:{second:02d}")
        else:
            scheduler.add_job(run_scheduled_sync, trigger="cron", hour=hour, minute=minute, second=second, id="daily_sync_job", replace_existing=True)
            logging.info(f"✅ Scheduled daily_sync_job at {hour:02d}:{minute:02d}:{second:02d}")
    else:
        if job:
            scheduler.remove_job("daily_sync_job")
            logging.info("🛑 Removed daily_sync_job (Disabled).")

@app.on_event("startup")
def start_scheduler():
    if not scheduler.running:
        scheduler.start()
    apply_auto_sync_schedule()
    logging.info("✅ Daily Auto-Sync Scheduler initialized successfully.")

@app.on_event("shutdown")
def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        logging.info("🛑 Daily Auto-Sync Scheduler stopped.")

@app.get("/", response_class=HTMLResponse)
def serve_index(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")

@app.get("/api/config")
def get_config():
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        masked_cfg = json.loads(json.dumps(cfg))
        if "mariadb" in masked_cfg and "password" in masked_cfg["mariadb"]:
            if masked_cfg["mariadb"]["password"]:
                masked_cfg["mariadb"]["password"] = "******"
        if "postgresql" in masked_cfg and "password" in masked_cfg["postgresql"]:
            if masked_cfg["postgresql"]["password"]:
                masked_cfg["postgresql"]["password"] = "******"
        if "auto_sync" not in masked_cfg:
            masked_cfg["auto_sync"] = get_auto_sync_config()
        return masked_cfg
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read config: {e}")

@app.post("/api/config")
def save_config(config_data: dict = Body(...)):
    try:
        existing_cfg = {}
        if os.path.exists(CONFIG_PATH):
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                existing_cfg = json.load(f)

        for section in ["mariadb", "postgresql"]:
            if section in config_data:
                if config_data[section].get("password") == "******":
                    config_data[section]["password"] = existing_cfg.get(section, {}).get("password", "")

        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(config_data, f, indent=2, ensure_ascii=False)

        if "auto_sync" in config_data:
            apply_auto_sync_schedule(config_data["auto_sync"])

        return {"status": "success", "message": "Settings saved successfully!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save config: {e}")

MAPPING_RULES_PATH = os.path.join(BASE_DIR, "config", "mapping_rules.json")

@app.get("/api/mapping-config")
def get_mapping_config():
    if os.path.exists(MAPPING_RULES_PATH):
        try:
            with open(MAPPING_RULES_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read mapping config: {e}")
    return {}

@app.post("/api/mapping-config")
def save_mapping_config(mapping_data: dict = Body(...)):
    try:
        with open(MAPPING_RULES_PATH, "w", encoding="utf-8") as f:
            json.dump(mapping_data, f, indent=2, ensure_ascii=False)
        return {"status": "success", "message": "Schema & column mappings saved successfully!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save mapping config: {e}")

@app.post("/api/test-postgres")
def test_postgres(config_data: dict = Body(None)):
    pg_client = PostgreSQLClient()
    result = pg_client.test_connection(config_data)
    return JSONResponse(content=result)

@app.get("/api/pg-tables")
def get_pg_tables():
    pg_client = PostgreSQLClient()
    tables = pg_client.get_tables()
    return {"status": "success", "tables": tables}

@app.get("/api/pg-table-columns/{table_name}")
def get_pg_table_columns(table_name: str):
    pg_client = PostgreSQLClient()
    cols = pg_client.get_table_columns(table_name)
    return {"status": "success", "table_name": table_name, "columns": cols}

@app.get("/api/mariadb-tables")
def get_mariadb_tables():
    db_client = MariaDBClient()
    tables = db_client.get_tables()
    return {"status": "success", "tables": tables}

@app.get("/api/mariadb-table-columns/{table_name}")
def get_mariadb_table_columns(table_name: str):
    db_client = MariaDBClient()
    cols = db_client.get_table_columns(table_name)
    return {"status": "success", "table_name": table_name, "columns": cols}

@app.post("/api/validate-schema")
def validate_schema():
    db_client = MariaDBClient()
    pg_client = PostgreSQLClient()
    
    target_mapping = db_client.get_target_mapping()
    raw_table = target_mapping["raw_table_name"]
    
    mariadb_schema = db_client.verify_target_schema(raw_table)
    
    req_target_cols = [
        target_mapping.get("transaction_id_col", "transactionId"),
        target_mapping.get("cs_id_col", "csId"),
        target_mapping.get("cp_id_col", "cpId"),
        target_mapping.get("begin_col", "begin"),
        target_mapping.get("end_col", "end"),
        target_mapping.get("power_col", "power"),
        target_mapping.get("price_col", "totalPrice"),
        target_mapping.get("card_no_col", "cardNo")
    ]
    
    target_matched_cols = []
    target_missing_cols = []
    if mariadb_schema["exists"]:
        existing_cols = mariadb_schema["columns"]
        existing_cols_lower = [c.lower() for c in existing_cols]
        for col in req_target_cols:
            if col.lower() in existing_cols_lower:
                target_matched_cols.append(col)
            else:
                target_missing_cols.append(col)

    pg_status = pg_client.test_connection()
    pg_connected = pg_status.get("status") in ["online", "success"]
    pg_table_ok = False
    pg_table = "charging_history"
    pg_cols_names = []
    if pg_connected:
        try:
            with open(MAPPING_RULES_PATH, "r", encoding="utf-8") as f:
                rules = json.load(f)
                pg_mapping = rules.get("pg_schema_mapping", {})
                pg_table = pg_mapping.get("table_name", "charging_history")
                pg_cols = pg_client.get_table_columns(pg_table)
                pg_cols_names = [c.get("column_name", "") for c in pg_cols]
                pg_table_ok = len(pg_cols) > 0
        except Exception:
            pass

    def classify_domain(t_name, cols):
        name_l = t_name.lower()
        cols_l = [c.lower() for c in cols]
        if "price" in name_l or "unit" in name_l or "policy" in name_l or any(c in cols_l for c in ["time_00", "apply_date", "pricepolicy"]):
            return "tariff_price"
        if "charge" in name_l or "hist" in name_l or "using" in name_l or any(c in cols_l for c in ["power", "power_kwh", "begin", "begin_time"]):
            return "charge_history"
        if "station" in name_l or "charger" in name_l or any(c in cols_l for c in ["station_name", "charger_name"]):
            return "station_info"
        return "general"

    maria_cols_names = mariadb_schema["columns"] if mariadb_schema["exists"] else []
    pg_domain = classify_domain(pg_table, pg_cols_names)
    maria_domain = classify_domain(raw_table, maria_cols_names)
    domain_mismatch = (pg_domain != "general" and maria_domain != "general" and pg_domain != maria_domain)

    recommendations = {}
    if domain_mismatch:
        if pg_domain == "tariff_price":
            recommendations["rec_mariadb_table"] = "tcsp_charge_price_hist"
            recommendations["reason"] = f"PG `{pg_table}` jadvali Tarif Narxlari sohasi."
        elif pg_domain == "charge_history":
            recommendations["rec_mariadb_table"] = "TCSP_CHARGE_HIST"
            recommendations["reason"] = f"PG `{pg_table}` jadvali Quvvatlash Tarixi sohasi."

        if maria_domain == "charge_history":
            recommendations["rec_pg_table"] = "charging_history"
        elif maria_domain == "tariff_price":
            recommendations["rec_pg_table"] = "unit_price_time"

    return {
        "status": "success",
        "domain_mismatch": domain_mismatch,
        "pg_domain": pg_domain,
        "maria_domain": maria_domain,
        "recommendations": recommendations,
        "mariadb": {
            "table_name": raw_table,
            "exists": mariadb_schema["exists"],
            "matched_cols_count": len(target_matched_cols),
            "total_req_cols": len(req_target_cols),
            "missing_cols": target_missing_cols,
            "message": mariadb_schema["message"]
        },
        "postgres": {
            "connected": pg_connected,
            "table_name": pg_table,
            "table_ok": pg_table_ok,
            "message": pg_status.get("message", "")
        }
    }

@app.post("/api/test-mariadb")
def test_mariadb(config_data: dict = Body(None)):
    try:
        import pymysql
        cfg = config_data if config_data else MariaDBClient().config
        conn = pymysql.connect(
            host=cfg.get("host"),
            port=int(cfg.get("port", 3306)),
            user=cfg.get("user"),
            password=cfg.get("password"),
            database=cfg.get("database"),
            connect_timeout=5,
            cursorclass=pymysql.cursors.DictCursor
        )
        cursor = conn.cursor()
        cursor.execute("SELECT VERSION() as ver;")
        ver = cursor.fetchone()['ver']
        conn.close()
        return {"status": "online", "message": "Connection Successful!", "version": ver}
    except Exception as e:
        return {"status": "offline", "message": str(e), "version": None}

@app.get("/api/status")
def get_status():
    db_client = MariaDBClient()
    conn = db_client.get_connection()
    mariadb_online = conn is not None
    
    stations_count = 0
    chargers_count = 0
    metrics = {
        "today_history_count": 0,
        "total_imported_count": 0
    }
    
    if mariadb_online:
        try:
            stations_count, chargers_count = db_client.get_mapped_counts()
            metrics = db_client.get_live_metrics()
        except Exception:
            pass
        finally:
            conn.close()

    pg_client = PostgreSQLClient()
    pg_test = pg_client.test_connection()

    auto_cfg = get_auto_sync_config()
    job = scheduler.get_job("daily_sync_job")
    next_run = str(job.next_run_time) if job and hasattr(job, 'next_run_time') and job.next_run_time else None

    return {
        "mariadb": {
            "status": "online" if mariadb_online else "offline",
            "host": db_client.config.get("host", "192.168.0.28"),
            "port": db_client.config.get("port", 3306),
            "database": db_client.config.get("database", "blue_networks"),
            "mapped_stations": stations_count,
            "mapped_chargers": chargers_count,
            "metrics": metrics
        },
        "postgresql": {
            "status": pg_test["status"],
            "host": pg_client.config.get("host", "127.0.0.1"),
            "port": pg_client.config.get("port", 5432),
            "database": pg_client.config.get("database", "old_charging_db"),
            "message": pg_test["message"]
        },
        "auto_sync": {
            "enabled": auto_cfg.get("enabled", True),
            "hour": auto_cfg.get("hour", 2),
            "minute": auto_cfg.get("minute", 0),
            "second": auto_cfg.get("second", 0),
            "start_date": auto_cfg.get("start_date", ""),
            "next_run": next_run
        }
    }

@app.post("/api/upload-csv")
def upload_csv(
    file: UploadFile = File(...),
    dry_run: bool = Form(True)
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported.")

    temp_dir = tempfile.mkdtemp()
    temp_path = os.path.join(temp_dir, file.filename)

    try:
        with open(temp_path, "wb") as f:
            content = file.file.read()
            f.write(content)

        importer = CSVImporter()
        result = importer.process_csv(temp_path, dry_run=dry_run)
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

@app.post("/api/daily-sync")
def trigger_daily_sync(
    start_date: str = Form(None),
    end_date: str = Form(None),
    target_date: str = Form(None),
    lookback_days: int = Form(None),
    dry_run: bool = Form(True)
):
    syncer = DailySyncer()
    result = syncer.sync_daily_data(
        start_date=start_date if start_date else None,
        end_date=end_date if end_date else None,
        target_date=target_date if target_date else None,
        lookback_days=lookback_days,
        dry_run=dry_run
    )
    return JSONResponse(content=result)

@app.get("/api/sync-history")
def get_sync_history():
    if os.path.exists(SYNC_HISTORY_PATH):
        try:
            with open(SYNC_HISTORY_PATH, "r", encoding="utf-8") as f:
                history = json.load(f)
            return history
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return []

@app.get("/api/sync-progress")
def get_sync_progress():
    return JSONResponse(content=get_sync_progress_state())
