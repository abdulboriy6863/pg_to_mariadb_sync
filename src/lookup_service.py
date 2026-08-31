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
        self.cs_cache = {}
        self.cp_cache = {}
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
        # Strip status tags like [철거], [폐쇄], [임시]
        text = re.sub(r'\[(철거|폐쇄|임시|테스트)\]', ' ', str(text))
        # Strip corporate entity prefixes
        text = re.sub(r'\((주|유|사|재)\)|주식회사|지솔라|\(주\)|\(유\)|통합', ' ', text)
        text = re.sub(r'[^\w]', '', text)
        return text.strip()

    def get_cs_id(self, station_name: str, charger_name: str = None) -> int:
        """Resolve station name to numeric csId with strict, safe multi-stage matching and charger fallback."""
        if not station_name and not charger_name:
            return None

        cache_key = (station_name or "", charger_name or "")
        if cache_key in self.cs_cache:
            return self.cs_cache[cache_key]

        res_cs_id = None

        # 1. Exact match on station_name
        if station_name:
            cleaned = self._normalize(station_name)
            if cleaned in self.normalized_station_map:
                res_cs_id = self.normalized_station_map[cleaned]

            # 2. Cleaned match without spaces, brackets, or corporate noise
            if not res_cs_id:
                clean_st = self._strip_noise(station_name)
                if clean_st and len(clean_st) >= 2:
                    for name, cs_id in self.station_map.items():
                        clean_m = self._strip_noise(name)
                        if clean_m and (clean_st == clean_m or (len(clean_st) >= 4 and clean_st in clean_m) or (len(clean_m) >= 4 and clean_m in clean_st)):
                            res_cs_id = cs_id
                            break

            # 3. Substring / prefix match
            if not res_cs_id:
                for name, cs_id in self.normalized_station_map.items():
                    if not name:
                        continue
                    if cleaned.startswith(name) or name.startswith(cleaned):
                        res_cs_id = cs_id
                        break
                    
                    if name in cleaned or cleaned in name:
                        min_len = min(len(name), len(cleaned))
                        max_len = max(len(name), len(cleaned))
                        if min_len >= 3 and (min_len / max_len) >= 0.5:
                            res_cs_id = cs_id
                            break

            # 4. Tokenized specific keyword match
            if not res_cs_id:
                tokens = [t for t in re.split(r'[^\w]', station_name) if len(t) >= 2 and t not in ['주식회사', '지솔라', '비공용', '사택', '본사', '테스트']]
                tokens.sort(key=len, reverse=True)
                for token in tokens:
                    clean_tok = self._strip_noise(token)
                    if len(clean_tok) >= 2:
                        for name, cs_id in self.station_map.items():
                            clean_m = self._strip_noise(name)
                            if clean_tok in clean_m:
                                res_cs_id = cs_id
                                break
                    if res_cs_id:
                        break

        # 5. Charger Name Fallback (for contractor/dummy station records like 유아이네트웍스, 마스터자동차, 마스타자동차)
        if not res_cs_id and charger_name:
            ch_clean = self._normalize(charger_name)
            # Extract station portion before dash (e.g. 영광만남의광장-7kw_06 -> 영광만남의광장)
            st_candidate = ch_clean.split('-')[0].strip() if '-' in ch_clean else ch_clean
            cand_clean = self._strip_noise(st_candidate)

            if cand_clean and len(cand_clean) >= 2:
                # Direct check on parsed candidate
                for name, cs_id in self.station_map.items():
                    clean_m = self._strip_noise(name)
                    if clean_m and (cand_clean == clean_m or cand_clean in clean_m or clean_m in cand_clean):
                        res_cs_id = cs_id
                        break

                # Tokenized keywords from charger station name
                if not res_cs_id:
                    cand_tokens = [t for t in re.split(r'[^\w]', st_candidate) if len(t) >= 2 and t not in ['7kw', '50kw', '100kw', '200kw', '벽부형', '스탠드', '듀얼', '싱글', '비공용']]
                    cand_tokens.sort(key=len, reverse=True)
                    for ctok in cand_tokens:
                        clean_ctok = self._strip_noise(ctok)
                        if len(clean_ctok) >= 2:
                            for name, cs_id in self.station_map.items():
                                clean_m = self._strip_noise(name)
                                if clean_ctok in clean_m:
                                    res_cs_id = cs_id
                                    break
                        if res_cs_id:
                            break

        self.cs_cache[cache_key] = res_cs_id
        return res_cs_id

    def get_cp_id(self, cs_id: int, charger_name: str) -> int:
        """Resolve charger name to numeric cpId given numeric cs_id with high-speed memoization."""
        if not cs_id:
            return None

        cache_key = (cs_id, charger_name or "")
        if cache_key in self.cp_cache:
            return self.cp_cache[cache_key]

        cleaned = self._normalize(charger_name) if charger_name else ''
        res_cp_id = None
        
        # 1. Direct match (cs_id, cp_name)
        if cleaned and (cs_id, cleaned) in self.charger_map:
            res_cp_id = self.charger_map[(cs_id, cleaned)]
            
        # 2. Global cp_name match
        elif cleaned and cleaned in self.charger_map:
            res_cp_id = self.charger_map[cleaned]
            
        # 3. Partial match for charger name at this station
        elif cleaned:
            for mapped_key, cp_id in self.charger_map.items():
                if isinstance(mapped_key, tuple) and mapped_key[0] == cs_id:
                    if mapped_key[1] in cleaned or cleaned in mapped_key[1]:
                        res_cp_id = cp_id
                        break

        # 4. Fallback default charger for this station if name missing or unmatched
        if not res_cp_id:
            res_cp_id = self.station_default_chargers.get(cs_id)

        self.cp_cache[cache_key] = res_cp_id
        return res_cp_id

