import os
import shutil
import tempfile
import json
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Body
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request

from src.db_client import MariaDBClient
from src.pg_client import PostgreSQLClient
from src.csv_importer import CSVImporter
from src.daily_syncer import DailySyncer

app = FastAPI(title="PostgreSQL to MariaDB Migration & Sync Dashboard")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
static_dir = os.path.join(BASE_DIR, "static")
templates_dir = os.path.join(BASE_DIR, "templates")
CONFIG_PATH = os.path.join(BASE_DIR, "config", "db_config.json")

app.mount("/static", StaticFiles(directory=static_dir), name="static")
templates = Jinja2Templates(directory=templates_dir)

@app.get("/", response_class=HTMLResponse)
def serve_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

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
        return {"status": "success", "message": "Settings saved successfully!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save config: {e}")

@app.post("/api/test-postgres")
def test_postgres(config_data: dict = Body(None)):
    pg_client = PostgreSQLClient()
    result = pg_client.test_connection(config_data)
    return JSONResponse(content=result)

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
        "today_history_count": 0
    }
    
    if mariadb_online:
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT COUNT(*) as cnt FROM TINF_CS;")
                stations_count = cursor.fetchone()['cnt']
                cursor.execute("SELECT COUNT(*) as cnt FROM TINF_CP;")
                chargers_count = cursor.fetchone()['cnt']
                cursor.execute("SELECT COUNT(*) as cnt FROM TCSP_CHARGE_HIST WHERE transactionId < 0;")
                metrics["today_history_count"] = cursor.fetchone()['cnt']
        except Exception:
            pass
        finally:
            conn.close()

    pg_client = PostgreSQLClient()
    pg_test = pg_client.test_connection()

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
def trigger_daily_sync(dry_run: bool = Form(True)):
    syncer = DailySyncer()
    result = syncer.sync_daily_data(dry_run=dry_run)
    return JSONResponse(content=result)
