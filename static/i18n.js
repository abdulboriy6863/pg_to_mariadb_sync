const translations = {
  uz: {
    // Header
    subtitle: "PostgreSQL ➔ MariaDB Live Sync Manager",
    btn_settings: "⚙️ Sozlamalar",

    // Status Cards
    card_mariadb_title: "MariaDB Server Status",
    card_mariadb_checking: "Tekshirilmoqda...",
    card_mariadb_sub_online: "Stansiyalar: {st} | Qurilmalar: {cp}",
    card_mariadb_sub_offline: "IP ruxsati yoki serverni tekshiring",
    card_mariadb_offline: "Ulanish yetishmaydi",

    card_postgres_title: "PostgreSQL (Manba Baza)",
    card_postgres_checking: "Tekshirilmoqda...",
    card_postgres_sub_online: "Baza: {db}",
    card_postgres_offline: "Ulanmagan",
    card_postgres_sub_offline: "Sozlamalarni tekshiring",

    card_charge_hist_title: "TCSP_CHARGE_HIST (Ko'chirilgan Yozuvlar)",
    card_charge_hist_sub: "Bugun: {today} ta | Jami ko'chirilgan: {total} ta",

    card_autosync_title: "Avto-Sync (Batch Vaqti)",
    card_autosync_active: "ACTIVE 🟢",
    card_autosync_disabled: "DISABLED 🔴",
    card_autosync_next: "Keyingi ijro: {next}",
    card_autosync_sub_disabled: "Avto-sync hozirda o'chirilgan",

    // CSV Upload Section
    csv_upload_title: "CSV Tarixiy Ma'lumotlarni Yuklash",
    csv_upload_desc: "PostgreSQL dan olingan 충전이력 CSV faylingizni bu yerga tashlang yoki tanlang.",
    dropzone_title: "CSV faylni shu yerga tashlang",
    dropzone_desc: "yoki kompyuterdan tanlash uchun bosing",
    btn_remove_file: "❌ O'chirish",
    btn_dry_run_csv: "🔍 Dry-Run Sinov",
    btn_live_import_csv: "🚀 Bazaga Yuklash",

    // PG Manual Sync Section
    pg_sync_title: "PG Manual Sync & Konsol Loglari",
    pg_sync_desc: "PostgreSQL dan istalgan sana bo'yicha ma'lumotlarni ko'chirish",
    label_from: "Dan:",
    label_to: "Gacham:",
    btn_dry_run_pg: "🔍 Dry-Run Sinash",
    btn_live_run_pg: "🚀 Real Sync",
    console_initial: "[SYSTEM] Web Console ishga tushdi. Live ulanishlar tekshirilmoqda...",

    // Settings Modal
    modal_title: "⚙️ Ma'lumotlar Bazasi & Taymer Sozlamalari",
    tab_pg: "🐘 PostgreSQL (Manba)",
    tab_mariadb: "🐬 MariaDB (Nishon)",
    tab_mapping: "🗺️ Schema Mapping",
    tab_autosync: "⏰ Avto-Sync Vaqti",

    label_host: "Host / IP Manzil",
    label_port: "Port",
    label_database: "Baza Nomi (Database)",
    label_pg_table_name: "PG Jadval Nomi (Table Name)",
    label_user: "Foydalanuvchi (User)",
    label_password: "Parol (Password)",
    ph_password: "Parolni kiriting",

    btn_test_pg: "🔍 PostgreSQL Ulanishini Tekshirish",
    btn_fetch_pg_tables: "📋 PG Jadvallarni Aniqlash",
    btn_test_maria: "🔍 MariaDB Ulanishini Tekshirish",
    btn_fetch_maria_tables: "🐬 MariaDB Jadvallarni Aniqlash",

    mapping_desc: "PostgreSQL manba jadvali hamda MariaDB nishon jadvali ustunlarini yonma-yon moslashtiring:",
    btn_sample_preview: "🔍 Jonli Ma'lumotlarni Taqqoslash",
    btn_preflight: "🔍 Pre-flight Validation",
    pg_source_schema_title: "🐘 PostgreSQL Source Schema",
    maria_target_schema_title: "🐬 MariaDB Target Schema",
    btn_select_table: "📋 Select Table",
    btn_auto_detect: "⚡ Auto-Detect",

    // Column Mapping Labels (PG)
    label_station_name_col: "Stansiya Nomi Ustuni (Station Name)",
    label_charger_name_col: "Zaryadlovchi Nomi Ustuni (Charger Name)",
    label_begin_time_col: "Boshlanish Vaqti Ustuni (Begin Time)",
    label_end_time_col: "Tugash Vaqti Ustuni (End Time)",
    label_power_kwh_col: "Quvvat (kWh) Ustuni",
    label_price_won_col: "Narx (Won) Ustuni",
    label_card_no_col: "Karta Raqami Ustuni (Card No)",
    label_pay_type_col: "To'lov Turi Ustuni (Pay Type)",

    // Column Mapping Labels (MariaDB)
    label_maria_target_table_name: "MariaDB Nishon Jadval Nomi",
    label_maria_begin_col: "Boshlanish Ustuni (Begin Column)",
    label_maria_end_col: "Tugash Ustuni (End Column)",
    label_maria_power_col: "Quvvat Ustuni (Power Column)",
    label_maria_price_col: "Narx Ustuni (Price Column)",
    label_maria_card_col: "Karta Raqami Ustuni (Card No Column)",
    label_maria_cs_id_col: "CS ID Ustuni",
    label_maria_cp_id_col: "CP ID Ustuni",
    label_maria_tx_id_col: "Transaction ID Ustuni",

    custom_mapping_title: "✨ Qo'shimcha Ustunlar (Custom Dynamic Mappings)",
    custom_mapping_sub: "Istalgancha qo'shimcha ustunlarni 1-click bilan bog'lang (masalan: soc ➔ startSoc)",
    btn_add_custom_mapping: "➕ Qo'shimcha Ustun Qo'shish",
    ph_custom_pg_col: "PostgreSQL Ustun (masalan: soc)",
    ph_custom_maria_col: "MariaDB Target Ustun (masalan: startSoc)",

    label_enable_autosync: "Har kunlik avtomatik sinxronizatsiyani yoqish",
    label_hour: "Soat (00 - 23)",
    label_minute: "Daqiqa (00 - 59)",
    label_second: "Sekund (00 - 59)",
    autosync_info: "ℹ️ Har kuni belgilangan vaqtda (masalan Soat: 04, Daqiqa: 10, Sekund: 20) PostgreSQL dan kechagi kun quvvatlash ma'lumotlari MariaDB ga avtomatik ko'chiriladi.",

    btn_cancel: "Bekor qilish",
    btn_save: "💾 Sozlamalarni Saqlash",

    // Modals
    table_selector_modal_title: "📋 Bazadagi Jadvallarni Tanlash",
    ph_table_search: "🔍 Jadval nomini qidirish...",
    table_list_loading: "⏳ Jadvallar ro'yxati o'qilmoqda...",

    sample_modal_title: "🔍 Jonli Ma'lumotlarni Taqqoslash (Live Sample Data Preview)",
    sample_modal_sub: "PostgreSQL manba jadvalidan 1 ta real yozuv va MariaDB ga o'girilgan nishon holati",
    th_pg_col_val: "🐘 PostgreSQL (Source Column & Value)",
    th_maria_col_val: "🐬 MariaDB (Target Column & Transformed)",
    th_status_badge: "Holat (Badge)",
    sample_preview_loading: "⏳ PostgreSQL-dan real yozuv o'qilib, MariaDB formatiga o'girilmoqda...",
    sample_preview_empty: "PostgreSQL bazasida namunaviy yozuv topilmadi.",
    sample_preview_empty_sub: "Iltimos, PostgreSQL ulanish sozlamalari hamda jadval nomini tekshiring.",
    btn_reload: "🔄 Qayta Yuklash",
    btn_close: "Yopish",

    // Dynamic Log & Alert Messages
    alert_csv_select: "Iltimos, avval CSV faylni yuklang!",
    alert_csv_format: "Faqat .csv fayllar qo'shilishi mumkin!",
    alert_future_date: "Kelajak sanasi ({date}) bo'yicha ma'lumot ko'chirib bo'lmaydi! Maksimal sana: bugun ({today}).",
    alert_date_order: "Boshlanish sanasi ({start}) tugash sanasidan ({end}) katta bo'lishi mumkin emas!",
    alert_dry_run_db_offline: "⚠️ Dry-Run Sinash uchun ikkala baza (PostgreSQL va MariaDB) ham faol (Online) bo'lishi kerak!\n\nHozirda offline holatda: {dbs}.",
    log_dry_run_offline_err: "🔴 Xatolik: Dry-Run sinov amalga oshirilmadi! {dbs} offline holatda."
  },
  ko: {
    // Header
    subtitle: "PostgreSQL ➔ MariaDB 실시간 동기화 관리자",
    btn_settings: "⚙️ 설정",

    // Status Cards
    card_mariadb_title: "MariaDB 서버 상태",
    card_mariadb_checking: "확인 중...",
    card_mariadb_sub_online: "충전소: {st}개 | 충전기: {cp}대",
    card_mariadb_sub_offline: "IP 권한 또는 서버 연결을 확인하세요",
    card_mariadb_offline: "연결 실패",

    card_postgres_title: "PostgreSQL (원본 DB)",
    card_postgres_checking: "확인 중...",
    card_postgres_sub_online: "데이터베이스: {db}",
    card_postgres_offline: "연결 안 됨",
    card_postgres_sub_offline: "설정을 확인하세요",

    card_charge_hist_title: "TCSP_CHARGE_HIST (이관된 내역)",
    card_charge_hist_sub: "오늘: {today}건 | 총 이관: {total}건",

    card_autosync_title: "자동 동기화 (배치 시간)",
    card_autosync_active: "ACTIVE 🟢",
    card_autosync_disabled: "DISABLED 🔴",
    card_autosync_next: "다음 실행: {next}",
    card_autosync_sub_disabled: "자동 동기화가 현재 비활성화되어 있습니다",

    // CSV Upload Section
    csv_upload_title: "CSV 이력 데이터 업로드",
    csv_upload_desc: "PostgreSQL에서 추출한 충전이력 CSV 파일을 여기에 드래그하거나 선택하세요.",
    dropzone_title: "CSV 파일을 여기에 드래그하세요",
    dropzone_desc: "또는 컴퓨터에서 파일 선택",
    btn_remove_file: "❌ 삭제",
    btn_dry_run_csv: "🔍 Dry-Run 테스트",
    btn_live_import_csv: "🚀 DB 업로드",

    // PG Manual Sync Section
    pg_sync_title: "PG 수동 동기화 & 콘솔 로그",
    pg_sync_desc: "PostgreSQL에서 원하는 날짜별 데이터 수동 이관",
    label_from: "시작:",
    label_to: "종료:",
    btn_dry_run_pg: "🔍 Dry-Run 테스트",
    btn_live_run_pg: "🚀 Real Sync 실행",
    console_initial: "[SYSTEM] 웹 콘솔이 시작되었습니다. 실시간 연결을 확인 중입니다...",

    // Settings Modal
    modal_title: "⚙️ 데이터베이스 및 타이머 설정",
    tab_pg: "🐘 PostgreSQL (원본)",
    tab_mariadb: "🐬 MariaDB (대상)",
    tab_mapping: "🗺️ 스키마 매핑 (Schema Mapping)",
    tab_autosync: "⏰ 자동 동기화 시간",

    label_host: "호스트 / IP 주소",
    label_port: "포트",
    label_database: "DB 이름 (Database)",
    label_pg_table_name: "PG 테이블 이름 (Table Name)",
    label_user: "사용자 (User)",
    label_password: "비밀번호 (Password)",
    ph_password: "비밀번호 입력",

    btn_test_pg: "🔍 PostgreSQL 연결 테스트",
    btn_fetch_pg_tables: "📋 PG 테이블 목록 조회",
    btn_test_maria: "🔍 MariaDB 연결 테스트",
    btn_fetch_maria_tables: "🐬 MariaDB 테이블 목록 조회",

    mapping_desc: "PostgreSQL 원본 테이블과 MariaDB 대상 테이블의 컬럼을 1:1 매핑하세요:",
    btn_sample_preview: "🔍 실시간 데이터 비교 (Live Preview)",
    btn_preflight: "🔍 사전 검증 (Pre-flight Validation)",
    pg_source_schema_title: "🐘 PostgreSQL 원본 스키마",
    maria_target_schema_title: "🐬 MariaDB 대상 스키마",
    btn_select_table: "📋 테이블 선택",
    btn_auto_detect: "⚡ 자동 감지",

    // Column Mapping Labels (PG)
    label_station_name_col: "충전소 이름 컬럼 (Station Name)",
    label_charger_name_col: "충전기 이름 컬럼 (Charger Name)",
    label_begin_time_col: "시작 시간 컬럼 (Begin Time)",
    label_end_time_col: "종료 시간 컬럼 (End Time)",
    label_power_kwh_col: "전력량 컬럼 (Power kWh)",
    label_price_won_col: "금액 컬럼 (Price Won)",
    label_card_no_col: "카드 번호 컬럼 (Card No)",
    label_pay_type_col: "결제 타입 컬럼 (Pay Type)",

    // Column Mapping Labels (MariaDB)
    label_maria_target_table_name: "MariaDB 대상 테이블 이름",
    label_maria_begin_col: "시작 시간 컬럼 (Begin Column)",
    label_maria_end_col: "종료 시간 컬럼 (End Column)",
    label_maria_power_col: "전력량 컬럼 (Power Column)",
    label_maria_price_col: "금액 컬럼 (Price Column)",
    label_maria_card_col: "카드 번호 컬럼 (Card No Column)",
    label_maria_cs_id_col: "충전소 ID 컬럼 (CS ID Column)",
    label_maria_cp_id_col: "충전기 ID 컬럼 (CP ID Column)",
    label_maria_tx_id_col: "트랜잭션 ID 컬럼 (Transaction ID Column)",

    custom_mapping_title: "✨ 추가 컬럼 동적 매핑 (Custom Dynamic Mappings)",
    custom_mapping_sub: "원하는 추가 컬럼을 자유롭게 1-클릭으로 매핑하세요 (예: soc ➔ startSoc)",
    btn_add_custom_mapping: "➕ 추가 컬럼 매핑 추가",
    ph_custom_pg_col: "PostgreSQL 컬럼 (예: soc)",
    ph_custom_maria_col: "MariaDB 대상 컬럼 (예: startSoc)",

    label_enable_autosync: "매일 자동 동기화 활성화",
    label_hour: "시 (00 - 23)",
    label_minute: "분 (00 - 59)",
    label_second: "초 (00 - 59)",
    autosync_info: "ℹ️ 매일 지정된 시간(예: 시: 04, 분: 10, 초: 20)에 PostgreSQL의 어제 충전 데이터가 MariaDB로 자동 이관됩니다.",

    btn_cancel: "취소",
    btn_save: "💾 설정 저장",

    // Modals
    table_selector_modal_title: "📋 DB 테이블 목록 선택",
    ph_table_search: "🔍 테이블 이름 검색...",
    table_list_loading: "⏳ 테이블 목록 읽는 중...",

    sample_modal_title: "🔍 실시간 데이터 매핑 비교 (Live Sample Preview)",
    sample_modal_sub: "PostgreSQL 원본 테이블의 실시간 1건 샘플 데이터 및 MariaDB 변환 매핑 결과",
    th_pg_col_val: "🐘 PostgreSQL (원본 컬럼 및 실시간 데이터)",
    th_maria_col_val: "🐬 MariaDB (대상 컬럼 및 변환 데이터)",
    th_status_badge: "매핑 상태",
    sample_preview_loading: "⏳ PostgreSQL 실시간 1건 데이터 로드 및 MariaDB 변환 중...",
    sample_preview_empty: "PostgreSQL DB에 샘플 데이터가 존재하지 않습니다.",
    sample_preview_empty_sub: "PostgreSQL 연결 설정 및 테이블 이름을 확인해 주세요.",
    btn_reload: "🔄 새로고침",
    btn_close: "닫기",

    // Dynamic Log & Alert Messages
    alert_csv_select: "먼저 CSV 파일을 업로드해 주세요!",
    alert_csv_format: ".csv 파일만 추가할 수 있습니다!",
    alert_future_date: "미래 날짜({date})의 데이터는 이관할 수 없습니다! 최대 날짜: 오늘({today}).",
    alert_date_order: "시작 날짜({start})가 종료 날짜({end})보다 클 수 없습니다!",
    alert_dry_run_db_offline: "⚠️ Dry-Run 테스트를 진행하려면 두 DB(PostgreSQL 및 MariaDB)가 모두 활성화(Online) 상태여야 합니다!\n\n현재 오프라인 상태: {dbs}.",
    log_dry_run_offline_err: "🔴 오류: Dry-Run 테스트가 실행되지 않았습니다! {dbs} 오프라인 상태입니다."
  }
};

function getLanguage() {
  return localStorage.getItem("app_lang") || "ko";
}

function setLanguage(lang) {
  if (!translations[lang]) lang = "ko";
  localStorage.setItem("app_lang", lang);
  document.documentElement.lang = lang;

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (translations[lang] && translations[lang][key]) {
      el.innerHTML = translations[lang][key];
    }
  });

  document.querySelectorAll("[data-i18n-ph]").forEach(el => {
    const key = el.getAttribute("data-i18n-ph");
    if (translations[lang] && translations[lang][key]) {
      el.placeholder = translations[lang][key];
    }
  });

  const langSelector = document.getElementById("langSelector");
  if (langSelector && langSelector.value !== lang) {
    langSelector.value = lang;
  }

  if (window.fetchStatus) {
    window.fetchStatus();
  }
  if (window.validateSchema) {
    window.validateSchema();
  }
}

function t(key, params = {}) {
  const lang = getLanguage();
  let text = (translations[lang] && translations[lang][key]) || (translations["ko"][key]) || (translations["uz"][key]) || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return text;
}

window.i18n = {
  translations,
  getLanguage,
  setLanguage,
  t
};
