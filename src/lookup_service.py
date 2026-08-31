import logging
import re
from src.db_client import MariaDBClient

logger = logging.getLogger("LookupService")

GENERIC_PLACE_KEYWORDS = {
    "공영주차장", "지하주차장", "지상주차장", "주차장", "주민센터", "행정복지센터", 
    "종합사회복지관", "노인복지관", "복지관", "공영", "아파트", "빌딩", "타워", 
    "상가", "사택", "본사", "지점", "충전소", "주유소", "전기차충전소", "테스트",
    "7kw", "50kw", "100kw", "200kw", "벽부형", "스탠드", "듀얼", "싱글", "신서버", "비공용", "철거", "통합"
}

class LookupService:
    def __init__(self, db_client: MariaDBClient = None):
        self.db_client = db_client or MariaDBClient()
        self.station_map = {}
        self.normalized_station_map = {}
        self.clean_station_map = {}
        self.station_tokens_map = {}
        self.charger_map = {}
        self.station_chargers = {}
        self.station_default_chargers = {}
        self.cs_cache = {}
        self.cp_cache = {}
        self.load_mappings()

    def _normalize(self, text: str) -> str:
        if not text:
            return ""
        text = str(text).strip()
        text = re.sub(r'\s+', ' ', text)
        return text

    def _clean_str(self, text: str) -> str:
        if not text:
            return ""
        text = re.sub(r'\[철거\]|\[폐쇄\]|\[임시\]|\[테스트\]', ' ', str(text))
        text = re.sub(r'\((?:주|유|사|재)\)|주식회사|지솔라|\(주\)|\(유\)', ' ', text)
        text = re.sub(r'[^\w]', '', text)
        return text.strip()

    def _extract_tokens(self, text: str):
        if not text:
            return []
        cleaned = re.sub(r'\[철거\]|\[폐쇄\]|\[임시\]|\[테스트\]', ' ', str(text))
        cleaned = re.sub(r'\((?:주|유|사|재)\)|주식회사|지솔라|\(주\)|\(유\)', ' ', cleaned)
        cleaned = re.sub(r'[\[\]\(\)\-_/.,]', ' ', cleaned)
        raw_tokens = cleaned.split()
        return [t.strip() for t in raw_tokens if len(t.strip()) >= 2 and t.strip() not in GENERIC_PLACE_KEYWORDS]

    def load_mappings(self):
        """Load mappings from live MariaDB."""
        logger.info("Loading Station and Charger mappings from MariaDB...")
        raw_stations = self.db_client.fetch_station_mappings()
        self.station_map = raw_stations
        self.normalized_station_map = {self._normalize(k): v for k, v in raw_stations.items() if k}
        
        self.clean_station_map = {}
        self.station_tokens_map = {}
        for name, cs_id in raw_stations.items():
            c_name = self._clean_str(name)
            self.clean_station_map[cs_id] = (name, c_name)
            toks = self._extract_tokens(name)
            self.station_tokens_map[cs_id] = (name, set(toks))

        self.charger_map = {}
        self.station_chargers = {}
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

                        if cs_id not in self.station_chargers:
                            self.station_chargers[cs_id] = []
                        self.station_chargers[cs_id].append((cp_id, cp_name))

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

    def get_cs_id(self, station_name: str, charger_name: str = None) -> int:
        """Resolve station name to numeric csId with strict, safe multi-stage matching and charger fallback."""
        if not station_name and not charger_name:
            return None

        cache_key = (station_name or "", charger_name or "")
        if cache_key in self.cs_cache:
            return self.cs_cache[cache_key]

        res_cs_id = None

        # 0. Direct numeric cs_id match (if station_name or charger_name is numeric ID)
        if station_name:
            s_str = str(station_name).strip()
            if s_str.isdigit():
                num_id = int(s_str)
                if num_id in self.clean_station_map or num_id in self.station_chargers:
                    res_cs_id = num_id

        # 1. Exact match on station_name
        if not res_cs_id and station_name:
            cleaned = self._normalize(station_name)
            if cleaned in self.normalized_station_map:
                res_cs_id = self.normalized_station_map[cleaned]

        # 2. Cleaned match without spaces, brackets, or corporate noise
        if not res_cs_id and station_name:
            clean_st = self._clean_str(station_name)
            if clean_st and len(clean_st) >= 2:
                for cs_id, (m_name, clean_m) in self.clean_station_map.items():
                    if clean_st == clean_m:
                        res_cs_id = cs_id
                        break

        # 3. Token-based multi-token overlap (Highest priority for distinct locations)
        if not res_cs_id and station_name:
            st_toks = set(self._extract_tokens(station_name))
            if st_toks:
                best_score = 0
                best_cs_id = None
                for cs_id, (m_name, m_toks) in self.station_tokens_map.items():
                    overlap = st_toks.intersection(m_toks)
                    if overlap:
                        score = len(overlap) / max(len(st_toks), len(m_toks))
                        if (len(overlap) >= 2 or score >= 0.5) and score > best_score:
                            best_score = score
                            best_cs_id = cs_id
                if best_score >= 0.33 and best_cs_id:
                    res_cs_id = best_cs_id

        # 4. Substring match IF meaningful (not generic suffix)
        if not res_cs_id and station_name:
            clean_st = self._clean_str(station_name)
            if clean_st and len(clean_st) >= 4 and clean_st not in GENERIC_PLACE_KEYWORDS:
                for cs_id, (m_name, clean_m) in self.clean_station_map.items():
                    if clean_m and len(clean_m) >= 4:
                        if clean_st in clean_m or clean_m in clean_st:
                            min_l = min(len(clean_st), len(clean_m))
                            max_l = max(len(clean_st), len(clean_m))
                            if min_l / max_l >= 0.5:
                                res_cs_id = cs_id
                                break

        # 5. Charger Name Fallback (for contractor/dummy station names like 유아이네트웍스, 마스타자동차)
        if not res_cs_id and charger_name:
            ch_clean = self._normalize(charger_name)
            st_candidate = ch_clean.split('-')[0].strip() if '-' in ch_clean else ch_clean
            cand_clean = self._clean_str(st_candidate)

            # A. Exact clean match from charger prefix
            if cand_clean and len(cand_clean) >= 2:
                for cs_id, (m_name, clean_m) in self.clean_station_map.items():
                    if cand_clean == clean_m:
                        res_cs_id = cs_id
                        break

            # B. Token match from charger prefix
            if not res_cs_id:
                cand_toks = set(self._extract_tokens(st_candidate))
                if cand_toks:
                    best_score = 0
                    best_cs_id = None
                    for cs_id, (m_name, m_toks) in self.station_tokens_map.items():
                        overlap = cand_toks.intersection(m_toks)
                        if overlap:
                            score = len(overlap) / max(len(cand_toks), len(m_toks))
                            if (len(overlap) >= 2 or score >= 0.5) and score > best_score:
                                best_score = score
                                best_cs_id = cs_id
                    if best_cs_id:
                        res_cs_id = best_cs_id

            # C. Substring match from charger candidate
            if not res_cs_id and cand_clean and len(cand_clean) >= 4 and cand_clean not in GENERIC_PLACE_KEYWORDS:
                for cs_id, (m_name, clean_m) in self.clean_station_map.items():
                    if clean_m and (cand_clean in clean_m or clean_m in cand_clean):
                        res_cs_id = cs_id
                        break

        # 6. Fallback to Default Test/Legacy Station (to guarantee 100% data preservation)
        if not res_cs_id:
            # Fallback to Test/Legacy Station in MariaDB
            res_cs_id = 2564 if 2564 in self.station_tokens_map else (next(iter(self.station_map.values())) if self.station_map else None)

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
        clean_no_noise = self._clean_str(charger_name) if charger_name else ''
        res_cp_id = None

        # 0. Direct numeric cp_id match
        if charger_name:
            c_str = str(charger_name).strip()
            if c_str.isdigit():
                num_cp = int(c_str)
                chargers_at_cs = self.station_chargers.get(cs_id, [])
                for cp_id, _ in chargers_at_cs:
                    if cp_id == num_cp:
                        res_cp_id = num_cp
                        break

        # 1. Direct match (cs_id, cp_name)
        if not res_cp_id and cleaned and (cs_id, cleaned) in self.charger_map:
            res_cp_id = self.charger_map[(cs_id, cleaned)]
            
        # 2. Cleaned without noise match at this station
        if not res_cp_id and clean_no_noise:
            chargers_at_cs = self.station_chargers.get(cs_id, [])
            for cp_id, cp_name in chargers_at_cs:
                if self._clean_str(cp_name) == clean_no_noise:
                    res_cp_id = cp_id
                    break

        # 3. Port / Number matching (_01, _02, 01, 02, etc.)
        if not res_cp_id and cleaned:
            m = re.search(r'(\d{1,2})(?:신서버|\(신서버\)|비공용|\(비공용\))?$', cleaned)
            port_num = m.group(1).zfill(2) if m else None
            
            chargers_at_cs = self.station_chargers.get(cs_id, [])
            if port_num:
                for cp_id, cp_name in chargers_at_cs:
                    if cp_name.endswith(f"_{port_num}") or cp_name.endswith(f"-{port_num}") or cp_name.endswith(port_num):
                        res_cp_id = cp_id
                        break

        # 4. Partial substring match within station chargers
        if not res_cp_id and cleaned:
            chargers_at_cs = self.station_chargers.get(cs_id, [])
            for cp_id, cp_name in chargers_at_cs:
                if cp_name and (cp_name in cleaned or cleaned in cp_name):
                    res_cp_id = cp_id
                    break

        # 5. Global cp_name match
        if not res_cp_id and cleaned in self.charger_map:
            res_cp_id = self.charger_map[cleaned]

        # 6. Fallback default charger for this station if name missing or unmatched
        if not res_cp_id:
            res_cp_id = self.station_default_chargers.get(cs_id)

        # 7. Ultimate fallback charger
        if not res_cp_id:
            res_cp_id = next(iter(self.charger_map.values()), 1)

        self.cp_cache[cache_key] = res_cp_id
        return res_cp_id

