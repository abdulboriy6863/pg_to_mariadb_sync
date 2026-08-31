import os
import shutil
import tempfile
import json
import threading
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
from src.lookup_service import LookupService

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
                ex_sec = existing_cfg.get(section, {})
                cur_sec = config_data[section]
                if cur_sec.get("password") == "******" or not cur_sec.get("password"):
                    if ex_sec.get("password"):
                        cur_sec["password"] = ex_sec.get("password")
                if not cur_sec.get("host") and ex_sec.get("host"):
                    cur_sec["host"] = ex_sec.get("host")
                if not cur_sec.get("database") and ex_sec.get("database"):
                    cur_sec["database"] = ex_sec.get("database")
                if not cur_sec.get("user") and ex_sec.get("user"):
                    cur_sec["user"] = ex_sec.get("user")
                existing_cfg[section] = cur_sec

        if "auto_sync" in config_data:
            existing_cfg["auto_sync"] = config_data["auto_sync"]

        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(existing_cfg, f, indent=2, ensure_ascii=False)

        if "auto_sync" in existing_cfg:
            apply_auto_sync_schedule(existing_cfg["auto_sync"])

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
    pg_table = "using_history"
    pg_cols_names = []
    pg_matched_cols = []
    pg_missing_cols = []
    req_pg_cols = []

    if pg_connected:
        try:
            with open(MAPPING_RULES_PATH, "r", encoding="utf-8") as f:
                rules = json.load(f)
                pg_mapping = rules.get("pg_schema_mapping", {})
                pg_table = pg_mapping.get("table_name", "using_history")
                pg_cols = pg_client.get_table_columns(pg_table)
                pg_cols_names = [c.get("column_name", "") for c in pg_cols]
                pg_table_ok = len(pg_cols) > 0

                req_pg_cols = [
                    pg_mapping.get("station_name_col", "station_name"),
                    pg_mapping.get("charger_name_col", "charger_name"),
                    pg_mapping.get("begin_time_col", "begin_time"),
                    pg_mapping.get("end_time_col", "end_time"),
                    pg_mapping.get("power_kwh_col", "power_kwh"),
                    pg_mapping.get("price_won_col", "price_won"),
                    pg_mapping.get("card_no_col", "card_no"),
                    pg_mapping.get("pay_type_col", "pay_type")
                ]

                if pg_table_ok:
                    existing_pg_lower = [c.lower() for c in pg_cols_names]
                    for col in req_pg_cols:
                        if col and col.lower() in existing_pg_lower:
                            pg_matched_cols.append(col)
                        elif col:
                            pg_missing_cols.append(col)
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
            recommendations["rec_pg_table"] = "using_history"
        elif maria_domain == "tariff_price":
            recommendations["rec_pg_table"] = "unit_price_time"

    pg_available_tables = []
    if pg_connected and not pg_table_ok:
        try:
            pg_available_tables = pg_client.get_tables()
        except Exception:
            pass

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
            "matched_cols_count": len(pg_matched_cols),
            "total_req_cols": len(req_pg_cols),
            "missing_cols": pg_missing_cols,
            "available_tables": pg_available_tables,
            "message": pg_status.get("message", "")
        }
    }

@app.get("/api/schema-preview-sample")
def get_schema_preview_sample():
    import hashlib
    pg_client = PostgreSQLClient()
    db_client = MariaDBClient()
    
    rules = {}
    if os.path.exists(MAPPING_RULES_PATH):
        try:
            with open(MAPPING_RULES_PATH, "r", encoding="utf-8") as f:
                rules = json.load(f)
        except Exception:
            pass

    pg_mapping = rules.get("pg_schema_mapping", {})
    maria_mapping = rules.get("mariadb_target_mapping", {})
    custom_maps = rules.get("custom_mappings", {})

    pg_table = pg_mapping.get("table_name", "using_history")
    maria_table = maria_mapping.get("table_name", "TCSP_CHARGE_HIST")

    st_col = pg_mapping.get("station_name_col", "station_name")
    cp_col = pg_mapping.get("charger_name_col", "charger_name")
    begin_col = pg_mapping.get("begin_time_col", "begin_time")
    end_col = pg_mapping.get("end_time_col", "end_time")
    power_col = pg_mapping.get("power_kwh_col", "power_kwh")
    price_col = pg_mapping.get("price_won_col", "price_won")
    card_col = pg_mapping.get("card_no_col", "card_no")
    pay_col = pg_mapping.get("pay_type_col", "pay_type")

    m_tx_col = maria_mapping.get("transaction_id_col", "transactionId")
    m_cs_col = maria_mapping.get("cs_id_col", "csId")
    m_cp_col = maria_mapping.get("cp_id_col", "cpId")
    m_begin_col = maria_mapping.get("begin_col", "begin")
    m_end_col = maria_mapping.get("end_col", "end")
    m_power_col = maria_mapping.get("power_col", "power")
    m_price_col = maria_mapping.get("price_col", "totalPrice")
    m_card_col = maria_mapping.get("card_no_col", "cardNo")

    conn = pg_client.get_connection()
    sample_row = None
    if conn:
        try:
            cursor = conn.cursor()
            join_sql = f"""
                SELECT h.*, s.station_name, c.charger_name 
                FROM {pg_table} h 
                LEFT JOIN station s ON h.station_id = s.station_id 
                LEFT JOIN charger c ON (
                    h.station_id = c.station_id 
                    AND (
                        (h.charger_id IS NOT NULL AND h.charger_id != '' AND h.charger_id = c.charger_id AND h.charger_no = c.charger_no)
                        OR ((h.charger_id IS NULL OR h.charger_id = '') AND h.charger_no = c.charger_no)
                    )
                ) 
                WHERE s.station_name IS NOT NULL 
                ORDER BY 1 DESC LIMIT 1
            """
            cursor.execute(join_sql)
            row = cursor.fetchone()
            if not row:
                cursor.execute(f"SELECT * FROM {pg_table} ORDER BY 1 DESC LIMIT 1")
                row = cursor.fetchone()
            if row:
                col_names = [desc[0] for desc in cursor.description]
                sample_row = dict(zip(col_names, row))
            conn.close()
        except Exception as e:
            if conn:
                conn.close()
            logging.warning(f"Error fetching sample row from PG: {e}")

    if not sample_row:
        return {
            "status": "success",
            "sample_found": False,
            "pg_table": pg_table,
            "maria_table": maria_table,
            "message": "PostgreSQL bazasida namunaviy ma'lumot topilmadi yoki ulanish mavjud emas.",
            "comparison": []
        }

    lookup_service = LookupService(db_client)

    def find_val(cols_to_try):
        for c in cols_to_try:
            if c in sample_row and sample_row[c] is not None:
                return c, sample_row[c]
        return cols_to_try[0] if cols_to_try else "", ""

    st_val = sample_row.get("station_name") or sample_row.get(st_col) or sample_row.get("station_id") or ""
    cp_val = sample_row.get("charger_name") or sample_row.get(cp_col) or sample_row.get("charger_no") or ""
    actual_st_col = "station_name" if ("station_name" in sample_row and sample_row["station_name"]) else st_col
    actual_cp_col = "charger_name" if ("charger_name" in sample_row and sample_row["charger_name"]) else cp_col

    if "start_date" in sample_row and "start_time" in sample_row:
        begin_str = f"{sample_row['start_date']} {sample_row['start_time']}"
        actual_begin_col = "start_date + start_time"
    else:
        actual_begin_col, raw_begin_val = find_val([begin_col, "begin_time", "start_time", "begin"])
        begin_str = str(raw_begin_val or "")

    if "end_date" in sample_row and "end_time" in sample_row:
        end_str = f"{sample_row['end_date']} {sample_row['end_time']}"
        actual_end_col = "end_date + end_time"
    else:
        actual_end_col, raw_end_val = find_val([end_col, "end_time", "stop_time", "end"])
        end_str = str(raw_end_val or "")

    actual_power_col, raw_power = find_val([power_col, "power_wh", "use_power", "power", "power_kwh"])
    try:
        power_num = float(raw_power or 0)
    except (ValueError, TypeError):
        power_num = 0.0

    actual_price_col, raw_price = find_val([price_col, "price_won", "use_payment", "totalPrice", "price"])
    try:
        price_num = int(float(raw_price or 0))
    except (ValueError, TypeError):
        price_num = 0

    actual_card_col, card_val = find_val([card_col, "card_no", "cardNo", "card"])
    actual_pay_col, pay_val = find_val([pay_col, "pay_type", "roamingType", "pay_mode"])

    cs_id = lookup_service.get_cs_id(st_val) if st_val else None
    cp_id = lookup_service.get_cp_id(cs_id, cp_val) if cs_id else None

    raw_hash = f"{cs_id or 'CS_NULL'}_{cp_id or 'CP_NULL'}_{begin_str}"
    h = int(hashlib.md5(raw_hash.encode('utf-8')).hexdigest()[:12], 16)
    tx_id = -(1000000 + (h % 899999999999))

    comparison = [
        {
            "field_label": "Transaction ID",
            "pg_col": "(MD5 Hash Generator)",
            "pg_val": raw_hash,
            "maria_col": m_tx_col,
            "maria_val": str(tx_id),
            "status": "auto_generated",
            "badge_text": "⚙️ Auto Hash ID"
        },
        {
            "field_label": "Station -> CS ID",
            "pg_col": actual_st_col,
            "pg_val": str(st_val),
            "maria_col": m_cs_col,
            "maria_val": str(cs_id or "(Topilmadi)"),
            "status": "mapped" if cs_id else "unmapped",
            "badge_text": "⚡ Lookup CS ID" if cs_id else "⚠️ CS ID topilmadi"
        },
        {
            "field_label": "Charger -> CP ID",
            "pg_col": actual_cp_col,
            "pg_val": str(cp_val),
            "maria_col": m_cp_col,
            "maria_val": str(cp_id or "(Topilmadi)"),
            "status": "mapped" if cp_id else "unmapped",
            "badge_text": "⚡ Lookup CP ID" if cp_id else "⚠️ CP ID topilmadi"
        },
        {
            "field_label": "Begin Time",
            "pg_col": actual_begin_col,
            "pg_val": begin_str,
            "maria_col": m_begin_col,
            "maria_val": begin_str,
            "status": "mapped" if begin_str else "unmapped",
            "badge_text": "✅ Mos keldi" if begin_str else "⚠️ Bo'sh"
        },
        {
            "field_label": "End Time",
            "pg_col": actual_end_col,
            "pg_val": end_str,
            "maria_col": m_end_col,
            "maria_val": end_str,
            "status": "mapped" if end_str else "unmapped",
            "badge_text": "✅ Mos keldi" if end_str else "⚠️ Bo'sh"
        },
        {
            "field_label": "Power (Wh)",
            "pg_col": actual_power_col,
            "pg_val": str(raw_power),
            "maria_col": m_power_col,
            "maria_val": f"{power_num:.1f}",
            "status": "mapped",
            "badge_text": "⚡ FLOAT (Wh)"
        },
        {
            "field_label": "Price (Won)",
            "pg_col": actual_price_col,
            "pg_val": str(raw_price),
            "maria_col": m_price_col,
            "maria_val": str(price_num),
            "status": "mapped",
            "badge_text": "✅ INT (WON)"
        },
        {
            "field_label": "Card No",
            "pg_col": actual_card_col,
            "pg_val": str(card_val),
            "maria_col": m_card_col,
            "maria_val": str(card_val),
            "status": "mapped",
            "badge_text": "✅ Mos keldi"
        },
        {
            "field_label": "Pay / Roaming Type",
            "pg_col": actual_pay_col,
            "pg_val": str(pay_val),
            "maria_col": "roamingType",
            "maria_val": str(pay_val),
            "status": "mapped",
            "badge_text": "✅ Mos keldi"
        },
        {
            "field_label": "Model ID",
            "pg_col": "(Standart)",
            "pg_val": "-",
            "maria_col": "modelId",
            "maria_val": "0",
            "status": "default",
            "badge_text": "⚙️ Default: 0"
        },
        {
            "field_label": "Connector ID",
            "pg_col": "(Standart)",
            "pg_val": "-",
            "maria_col": "connectorId",
            "maria_val": "1",
            "status": "default",
            "badge_text": "⚙️ Default: 1"
        },
        {
            "field_label": "Power Unit",
            "pg_col": "(Standart)",
            "pg_val": "-",
            "maria_col": "powerUnit",
            "maria_val": "Wh",
            "status": "default",
            "badge_text": "⚙️ Default: Wh"
        }
    ]

    if isinstance(custom_maps, dict):
        for pg_c, maria_c in custom_maps.items():
            if pg_c and maria_c:
                c_val = str(sample_row.get(pg_c, ""))
                comparison.append({
                    "field_label": f"Custom ({pg_c} ➔ {maria_c})",
                    "pg_col": pg_c,
                    "pg_val": c_val,
                    "maria_col": maria_c,
                    "maria_val": c_val,
                    "status": "custom",
                    "badge_text": "✨ Dynamic Mapping"
                })

    return {
        "status": "success",
        "sample_found": True,
        "pg_table": pg_table,
        "maria_table": maria_table,
        "raw_pg_row": sample_row,
        "comparison": comparison
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
    try:
        syncer = DailySyncer()
        result = syncer.sync_daily_data(
            start_date=start_date if start_date else None,
            end_date=end_date if end_date else None,
            target_date=target_date if target_date else None,
            lookback_days=lookback_days,
            dry_run=dry_run
        )
        return JSONResponse(content=result)
    except Exception as e:
        logging.error(f"Daily sync error: {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Daily sync xatoligi: {str(e)}"}
        )

@app.get("/api/sync-history")
def get_sync_history():
    if os.path.exists(SYNC_HISTORY_PATH):
        try:
            with open(SYNC_HISTORY_PATH, "r", encoding="utf-8") as f:
                history = json.load(f)
            return history
        except Exception as e:
            logging.error(f"Error reading sync history: {e}")
            return []
    fallback_path = os.path.join(BASE_DIR, "config", "sync_history.json")
    if os.path.exists(fallback_path):
        try:
            with open(fallback_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return []

@app.get("/api/sync-progress")
def get_sync_progress():
    return JSONResponse(content=get_sync_progress_state())
