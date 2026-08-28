import logging
import re
from src.db_client import MariaDBClient

logger = logging.getLogger("LookupService")

class LookupService:
    def __init__(self, db_client: MariaDBClient = None):
        self.db_client = db_client or MariaDBClient()
        self.station_map = {}
        self.normalized_station_map = {}
        self.charger_map = {}
        self.station_default_chargers = {}
        self.load_mappings()

    def _normalize(self, text: str) -> str:
        if not text:
            return ""
        # Remove extra whitespace and special surrounding characters
        text = str(text).strip()
        text = re.sub(r'\s+', ' ', text)
        return text

    def load_mappings(self):
        """Load mappings from live MariaDB."""
        logger.info("Loading Station and Charger mappings...")
        raw_stations = self.db_client.fetch_station_mappings()
        self.station_map = raw_stations
        self.normalized_station_map = {self._normalize(k): v for k, v in raw_stations.items() if k}
        
        self.charger_map = {}
        self.station_default_chargers = {}

        conn = self.db_client.get_connection()
        if conn:
            try:
                with conn.cursor() as cursor:
                    sql = """
                    SELECT B.csId as cs_id, CP.id as cp_id, CP.name as cp_name 
                    FROM TINF_CS_CP B
                    INNER JOIN TINF_CP CP ON B.cpId = CP.id;
                    """
                    cursor.execute(sql)
                    rows = cursor.fetchall()
                    for row in rows:
                        cs_id = row['cs_id']
                        cp_id = row['cp_id']
                        raw_cp_name = row.get('cp_name')
                        cp_name = self._normalize(raw_cp_name) if raw_cp_name else ''

                        if cp_name:
                            self.charger_map[(cs_id, cp_name)] = cp_id
                            self.charger_map[cp_name] = cp_id

                        if cs_id not in self.station_default_chargers:
                            self.station_default_chargers[cs_id] = cp_id
            except Exception as e:
                logger.error(f"Error loading charger mappings: {e}")
            finally:
                conn.close()
                
        logger.info(f"Loaded {len(self.station_map)} stations and {len(self.charger_map)} charger entries.")

    def reload_mappings(self):
        """Refresh station and charger mappings from MariaDB on demand."""
        self.load_mappings()

    def _strip_noise(self, text: str) -> str:
        if not text:
            return ""
        text = re.sub(r'\([^)]*\)', ' ', str(text))
        text = re.sub(r'주식회사|지솔라|\(주\)|비공용|사택|테스트|본사', ' ', text)
        text = re.sub(r'[^\w]', '', text)
        return text.strip()

    def get_cs_id(self, station_name: str) -> int:
        """Resolve station name to numeric csId with strict and safe multi-stage matching."""
        if not station_name:
            return None
        cleaned = self._normalize(station_name)

        # 1. Exact match
        if cleaned in self.normalized_station_map:
            return self.normalized_station_map[cleaned]

        # 2. Cleaned match without spaces, parentheses, or corporate noise
        clean_st = self._strip_noise(station_name)
        if clean_st:
            for name, cs_id in self.station_map.items():
                clean_m = self._strip_noise(name)
                if clean_m and (clean_st == clean_m or (len(clean_st) >= 4 and clean_st in clean_m) or (len(clean_m) >= 4 and clean_m in clean_st)):
                    return cs_id

        # 3. Substring / prefix match
        for name, cs_id in self.normalized_station_map.items():
            if not name:
                continue
            if cleaned.startswith(name) or name.startswith(cleaned):
                return cs_id
            
            if name in cleaned or cleaned in name:
                min_len = min(len(name), len(cleaned))
                max_len = max(len(name), len(cleaned))
                if min_len >= 3 and (min_len / max_len) >= 0.5:
                    return cs_id

        # 4. Tokenized specific keyword match (e.g. "진보전력", "롯데택배", "GEVR", "이화마을", "제주오성", "스타세븐", "양현중")
        tokens = [t for t in re.split(r'[^\w]', station_name) if len(t) >= 2 and t not in ['주식회사', '지솔라', '비공용', '사택']]
        tokens.sort(key=len, reverse=True)
        for token in tokens:
            clean_tok = self._strip_noise(token)
            if len(clean_tok) >= 2:
                for name, cs_id in self.station_map.items():
                    clean_m = self._strip_noise(name)
                    if clean_tok in clean_m:
                        return cs_id

        return None

    def get_cp_id(self, cs_id: int, charger_name: str) -> int:
        """Resolve charger name to numeric cpId given numeric cs_id."""
        if not cs_id:
            return None
        cleaned = self._normalize(charger_name) if charger_name else ''
        
        # 1. Direct match (cs_id, cp_name)
        if cleaned and (cs_id, cleaned) in self.charger_map:
            return self.charger_map[(cs_id, cleaned)]
            
        # 2. Global cp_name match
        if cleaned and cleaned in self.charger_map:
            return self.charger_map[cleaned]
            
        # 3. Partial match for charger name at this station
        if cleaned:
            for mapped_key, cp_id in self.charger_map.items():
                if isinstance(mapped_key, tuple) and mapped_key[0] == cs_id:
                    if mapped_key[1] in cleaned or cleaned in mapped_key[1]:
                        return cp_id

        # 4. Fallback default charger for this station if name missing or unmatched
        return self.station_default_chargers.get(cs_id)

