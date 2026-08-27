import logging
from src.db_client import MariaDBClient

logger = logging.getLogger("LookupService")

class LookupService:
    def __init__(self, db_client: MariaDBClient = None):
        self.db_client = db_client or MariaDBClient()
        self.station_map = {}
        self.charger_map = {}
        self.station_default_chargers = {}
        self.load_mappings()

    def load_mappings(self):
        """Load mappings from live MariaDB."""
        logger.info("Loading Station and Charger mappings...")
        self.station_map = self.db_client.fetch_station_mappings()
        
        # Load chargers
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
                        cp_name = row.get('cp_name', '').strip() if row.get('cp_name') else ''

                        if cp_name:
                            self.charger_map[(cs_id, cp_name)] = cp_id
                            self.charger_map[cp_name] = cp_id

                        if cs_id not in self.station_default_chargers:
                            self.station_default_chargers[cs_id] = cp_id
            finally:
                conn.close()
                
        logger.info(f"Loaded {len(self.station_map)} stations and {len(self.charger_map)} charger entries.")

    def get_cs_id(self, station_name: str) -> int:
        """Resolve station name to numeric csId with strict and safe matching."""
        if not station_name:
            return None
        cleaned = station_name.strip()

        # 1. Exact match
        if cleaned in self.station_map:
            return self.station_map[cleaned]

        # 2. Normalized prefix or exact containment match with length check
        for name, cs_id in self.station_map.items():
            if not name:
                continue
            # Direct prefix or suffix match
            if cleaned.startswith(name) or name.startswith(cleaned):
                return cs_id
            
            # Substring match with strict ratio (> 0.5) to avoid false positives (e.g., '서울' vs '서울 금천구청')
            if name in cleaned or cleaned in name:
                min_len = min(len(name), len(cleaned))
                max_len = max(len(name), len(cleaned))
                if min_len >= 3 and (min_len / max_len) >= 0.5:
                    return cs_id

        return None

    def get_cp_id(self, cs_id: int, charger_name: str) -> int:
        """Resolve charger name to numeric cpId given numeric cs_id."""
        if not cs_id:
            return None
        cleaned = charger_name.strip() if charger_name else ''
        
        # 1. Try direct match (cs_id, cp_name)
        if cleaned and (cs_id, cleaned) in self.charger_map:
            return self.charger_map[(cs_id, cleaned)]
            
        # 2. Try global cp_name match
        if cleaned and cleaned in self.charger_map:
            return self.charger_map[cleaned]
            
        # 3. Partial match for charger name at this station
        if cleaned:
            for mapped_key, cp_id in self.charger_map.items():
                if isinstance(mapped_key, tuple) and mapped_key[0] == cs_id:
                    if mapped_key[1] in cleaned or cleaned in mapped_key[1]:
                        return cp_id

        # 4. Fallback: Default charger for this station ONLY if charger_name was not specified
        if not cleaned:
            return self.station_default_chargers.get(cs_id)

        # Unmatched charger name -> return None to prevent binding wrong charger ID
        return None
