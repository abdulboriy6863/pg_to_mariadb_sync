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
    tab_autosync: "⏰ Avto-Sync Vaqti",

    label_host: "Host / IP Manzil",
    label_port: "Port",
    label_database: "Baza Nomi (Database)",
    label_user: "Foydalanuvchi (User)",
    label_password: "Parol (Password)",
    ph_password: "Parolni kiriting",

    btn_test_pg: "🔍 PostgreSQL Ulanishini Tekshirish",
    btn_test_maria: "🔍 MariaDB Ulanishini Tekshirish",

    label_enable_autosync: "Har kunlik avtomatik sinxronizatsiyani yoqish",
    label_hour: "Soat (00 - 23)",
    label_minute: "Daqiqa (00 - 59)",
    label_second: "Sekund (00 - 59)",
    autosync_info: "ℹ️ Har kuni belgilangan vaqtda (masalan Soat: 04, Daqiqa: 10, Sekund: 20) PostgreSQL dan kechagi kun quvvatlash ma'lumotlari MariaDB ga avtomatik ko'chiriladi.",

    btn_cancel: "Bekor qilish",
    btn_save: "💾 Sozlamalarni Saqlash",

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
    tab_autosync: "⏰ 자동 동기화 시간",

    label_host: "호스트 / IP 주소",
    label_port: "포트",
    label_database: "DB 이름 (Database)",
    label_user: "사용자 (User)",
    label_password: "비밀번호 (Password)",
    ph_password: "비밀번호 입력",

    btn_test_pg: "🔍 PostgreSQL 연결 테스트",
    btn_test_maria: "🔍 MariaDB 연결 테스트",

    label_enable_autosync: "매일 자동 동기화 활성화",
    label_hour: "시 (00 - 23)",
    label_minute: "분 (00 - 59)",
    label_second: "초 (00 - 59)",
    autosync_info: "ℹ️ 매일 지정된 시간(예: 시: 04, 분: 10, 초: 20)에 PostgreSQL의 어제 충전 데이터가 MariaDB로 자동 이관됩니다.",

    btn_cancel: "취소",
    btn_save: "💾 설정 저장",

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
      el.textContent = translations[lang][key];
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
