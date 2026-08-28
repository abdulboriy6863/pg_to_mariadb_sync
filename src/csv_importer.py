import csv
import hashlib
import json
import logging
import os
from datetime import datetime
from src.db_client import MariaDBClient
from src.lookup_service import LookupService

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("CSVImporter")

class CSVImporter:
    def __init__(self, mapping_config_path=None):
        if mapping_config_path is None:
            mapping_config_path = os.path.join(os.path.dirname(__file__), "..", "config", "mapping_rules.json")
        
        with open(mapping_config_path, "r", encoding="utf-8") as f:
            self.mapping_config = json.load(f)

        self.db_client = MariaDBClient()
        self.lookup_service = LookupService(self.db_client)

    def process_csv(self, csv_file_path, dry_run=True):
        if not os.path.exists(csv_file_path):
            logger.error(f"CSV file not found: {csv_file_path}")
            return {
                "status": "error",
                "message": f"CSV file not found: {csv_file_path}"
            }

        logger.info(f"Processing CSV file: {csv_file_path} (dry_run={dry_run})")
        
        lookup_cfg = self.mapping_config.get("lookup_fields", {})
        station_col = lookup_cfg.get("station_name_column", "사업장")
        charger_col = lookup_cfg.get("charger_name_column", "충전기명")
        
        col_map = self.mapping_config.get("column_mapping", {})
        req_defaults = self.mapping_config.get("required_defaults", {
            "modelId": 0,
            "connectorId": 1,
            "powerUnit": "kWh"
        })

        transformed_records = []
        missing_cs_count = 0
        missing_cp_count = 0
        missing_stations = set()
        missing_chargers = set()

        def _parse_dt(val):
            if not val:
                return datetime.now()
            val_str = str(val).strip()
            formats = (
                "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%m/%d/%Y %H:%M:%S", "%m/%d/%Y %H:%M",
                "%Y/%m/%d %H:%M:%S", "%Y/%m/%d %H:%M", "%Y.%m.%d %H:%M:%S", "%Y.%m.%d %H:%M",
                "%Y-%m-%d", "%m/%d/%Y", "%Y/%m/%d", "%Y.%m.%d"
            )
            for fmt in formats:
                try:
                    return datetime.strptime(val_str, fmt)
                except ValueError:
                    pass
            return datetime.now()

        def _gen_tx_id(cs_id, cp_id, begin_fmt):
            raw = f"{cs_id}_{cp_id}_{begin_fmt}"
            # 64-bit integer range to virtually eliminate MD5 truncation collisions
            h = int(hashlib.md5(raw.encode('utf-8')).hexdigest()[:12], 16)
            return -(1000000 + (h % 899999999999))

        with open(csv_file_path, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for idx, row in enumerate(reader):
                station_name = row.get(station_col)
                charger_name = row.get(charger_col)

                cs_id = self.lookup_service.get_cs_id(station_name)
                if not cs_id:
                    missing_cs_count += 1
                    if station_name:
                        missing_stations.add(station_name.strip())
                    continue

                cp_id = self.lookup_service.get_cp_id(cs_id, charger_name)
                if not cp_id:
                    missing_cp_count += 1
                    if charger_name:
                        missing_chargers.add(f"{station_name} -> {charger_name}".strip())
                    continue

                begin_str = row.get("충전시작 일시") or row.get("충전시작 시간")
                end_str = row.get("충전종료 일시") or row.get("충전종료 시간")

                begin_dt = _parse_dt(begin_str)
                end_dt = _parse_dt(end_str)
                begin_fmt = begin_dt.strftime("%Y-%m-%d %H:%M:%S")

                power_str = row.get("충전량(kWh)", "0").strip()
                try:
                    power_val = float(power_str)
                except ValueError:
                    power_val = 0.0

                price_str = row.get("충전금액(원)", "0").strip()
                try:
                    price_val = int(float(price_str))
                except ValueError:
                    price_val = 0

                start_soc = int(float(row.get("시작SOC(%)", 0) or 0))
                finish_soc = int(float(row.get("완료SOC(%)", 0) or 0))

                tx_id = _gen_tx_id(cs_id, cp_id, begin_fmt)

                target_mapping = self.db_client.get_target_mapping()
                tx_col = target_mapping.get("transaction_id_col", "transactionId")
                cs_col = target_mapping.get("cs_id_col", "csId")
                cp_col = target_mapping.get("cp_id_col", "cpId")
                begin_col = target_mapping.get("begin_col", "begin")
                end_col = target_mapping.get("end_col", "end")
                power_col = target_mapping.get("power_col", "power")
                price_col = target_mapping.get("price_col", "totalPrice")
                card_col = target_mapping.get("card_no_col", "cardNo")

                record = {
                    tx_col: tx_id,
                    cs_col: cs_id,
                    cp_col: cp_id,
                    "modelId": req_defaults.get("modelId", 0),
                    "connectorId": req_defaults.get("connectorId", 1),
                    begin_col: begin_fmt,
                    end_col: end_dt.strftime("%Y-%m-%d %H:%M:%S"),
                    power_col: power_val,
                    "powerUnit": req_defaults.get("powerUnit", "kWh"),
                    price_col: price_val,
                    card_col: row.get("카드번호", "").strip(),
                    "startSoc": start_soc,
                    "soc": finish_soc,
                    "roamingType": row.get("결제종류", "").strip()
                }

                transformed_records.append(record)

        logger.info("Transformation Complete!")
        logger.info(f" - Total CSV Rows Processed: {len(transformed_records) + missing_cs_count + missing_cp_count}")
        logger.info(f" - Successfully Mapped Records: {len(transformed_records)}")
        logger.info(f" - Skipped (Unmapped Stations/Chargers): {missing_cs_count + missing_cp_count}")

        if dry_run:
            logger.info("=== DRY RUN SUMMARY (No DB changes made) ===")
            if transformed_records:
                logger.info(f"Sample Transformed Record #1: {json.dumps(transformed_records[0], ensure_ascii=False, indent=2)}")
            return {
                "status": "success",
                "total_rows": len(transformed_records) + missing_cs_count + missing_cp_count,
                "mapped_records": len(transformed_records),
                "skipped_records": missing_cs_count + missing_cp_count,
                "missing_stations": list(missing_stations)[:15],
                "missing_chargers": list(missing_chargers)[:15],
                "sample": transformed_records[0] if transformed_records else None
            }
        else:
            logger.info(f"Inserting {len(transformed_records)} records into MariaDB...")
            inserted, duplicates = self.db_client.insert_batch_charge_history(transformed_records)
            return {
                "status": "success",
                "inserted": inserted,
                "duplicates_skipped": duplicates,
                "skipped_records": missing_cs_count + missing_cp_count,
                "missing_stations": list(missing_stations)[:15],
                "missing_chargers": list(missing_chargers)[:15]
            }
