document.addEventListener("DOMContentLoaded", () => {
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("csvFileInput");
  const btnDryRun = document.getElementById("btnDryRun");
  const btnLiveImport = document.getElementById("btnLiveImport");
  const btnDailySync = document.getElementById("btnDailySync");
  const logTerminal = document.getElementById("logTerminal");

  const btnOpenSettings = document.getElementById("btnOpenSettings");
  const btnCloseModal = document.getElementById("btnCloseModal");
  const btnCancelSettings = document.getElementById("btnCancelSettings");
  const btnSaveSettings = document.getElementById("btnSaveSettings");
  const btnSaveInlineAutoSync = document.getElementById("btnSaveInlineAutoSync");
  const settingsModal = document.getElementById("settingsModal");
  const tabButtons = document.querySelectorAll(".tab-btn");

  const btnTestPg = document.getElementById("btnTestPg");
  const btnTestMaria = document.getElementById("btnTestMaria");
  const pgTestResult = document.getElementById("pgTestResult");
  const mariaTestResult = document.getElementById("mariaTestResult");

  const serverIpDisplay = document.getElementById("serverIpDisplay");
  if (serverIpDisplay) {
    serverIpDisplay.textContent = "Server IP: " + (window.location.host || "192.168.0.25:5050");
  }

  // i18n Language Switcher
  const langSelector = document.getElementById("langSelector");
  if (langSelector) {
    langSelector.value = window.i18n ? window.i18n.getLanguage() : "uz";
    langSelector.addEventListener("change", (e) => {
      if (window.i18n) {
        window.i18n.setLanguage(e.target.value);
        fetchStatus();
      }
    });
  }
  if (window.i18n) {
    window.i18n.setLanguage(window.i18n.getLanguage());
  }

  let selectedFile = null;
  let isEditingInlineInputs = false;
  let latestStatus = null;

  // Track if user is typing in inline inputs to prevent auto-polling overwrite
  ["inlineAutoSyncHour", "inlineAutoSyncMinute", "inlineAutoSyncSecond", "inlineAutoSyncEnabled"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("focus", () => { isEditingInlineInputs = true; });
      el.addEventListener("blur", () => { isEditingInlineInputs = false; });
      el.addEventListener("change", () => { isEditingInlineInputs = true; });
    }
  });

  // Initial Status Check & Auto Polling every 5 seconds
  fetchStatus();
  setInterval(() => {
    if (!document.hidden) {
      fetchStatus();
    }
  }, 5000);

  // Settings Modal Functions
  async function openSettingsModal(defaultTab = "tab-pg") {
    if (!settingsModal) return;
    
    if (pgTestResult) {
      pgTestResult.className = "test-result-box";
      pgTestResult.style.display = "none";
    }
    if (mariaTestResult) {
      mariaTestResult.className = "test-result-box";
      mariaTestResult.style.display = "none";
    }
    
    settingsModal.style.display = "flex";

    tabButtons.forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(tc => tc.classList.remove("active"));
    
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${defaultTab}"]`);
    const activeTab = document.getElementById(defaultTab);
    if (activeBtn) activeBtn.classList.add("active");
    if (activeTab) activeTab.classList.add("active");

    try {
      const res = await fetch("/api/config");
      const cfg = await res.json();

      const pg = cfg.postgresql || {};
      if (document.getElementById("pgHost")) document.getElementById("pgHost").value = pg.host || "127.0.0.1";
      if (document.getElementById("pgPort")) document.getElementById("pgPort").value = pg.port || 5432;
      if (document.getElementById("pgDatabase")) document.getElementById("pgDatabase").value = pg.database || "old_charging_db";
      if (document.getElementById("pgTableName")) document.getElementById("pgTableName").value = pg.table_name || pg.source_table || "charging_history";
      if (document.getElementById("pgUser")) document.getElementById("pgUser").value = pg.user || "postgres";
      if (document.getElementById("pgPassword")) document.getElementById("pgPassword").value = pg.password || "";

      const maria = cfg.mariadb || {};
      if (document.getElementById("mariaHost")) document.getElementById("mariaHost").value = maria.host || "192.168.0.28";
      if (document.getElementById("mariaPort")) document.getElementById("mariaPort").value = maria.port || 3306;
      if (document.getElementById("mariaDatabase")) document.getElementById("mariaDatabase").value = maria.database || "blue_networks";
      if (document.getElementById("mariaUser")) document.getElementById("mariaUser").value = maria.user || "blue_networks";
      if (document.getElementById("mariaPassword")) document.getElementById("mariaPassword").value = maria.password || "";

      const autoSync = cfg.auto_sync || {};
      if (document.getElementById("autoSyncEnabled")) document.getElementById("autoSyncEnabled").checked = autoSync.enabled !== false;
      if (document.getElementById("autoSyncHour")) document.getElementById("autoSyncHour").value = autoSync.hour !== undefined ? autoSync.hour : 2;
      if (document.getElementById("autoSyncMinute")) document.getElementById("autoSyncMinute").value = autoSync.minute !== undefined ? autoSync.minute : 0;
      if (document.getElementById("autoSyncSecond")) document.getElementById("autoSyncSecond").value = autoSync.second !== undefined ? autoSync.second : 0;

      try {
        const mapRes = await fetch("/api/mapping-config");
        const mapCfg = await mapRes.json();
        const pgSchema = mapCfg.pg_schema_mapping || {};
        const mariaTarget = mapCfg.mariadb_target_mapping || {};

        if (document.getElementById("mapPgTable")) document.getElementById("mapPgTable").value = pgSchema.table_name || pg.table_name || "charging_history";
        if (document.getElementById("mapPgStationCol")) document.getElementById("mapPgStationCol").value = pgSchema.station_name_col || "station_name";
        if (document.getElementById("mapPgChargerCol")) document.getElementById("mapPgChargerCol").value = pgSchema.charger_name_col || "charger_name";
        if (document.getElementById("mapPgBeginCol")) document.getElementById("mapPgBeginCol").value = pgSchema.begin_time_col || "begin_time";
        if (document.getElementById("mapPgEndCol")) document.getElementById("mapPgEndCol").value = pgSchema.end_time_col || "end_time";
        if (document.getElementById("mapPgPowerCol")) document.getElementById("mapPgPowerCol").value = pgSchema.power_kwh_col || "power_kwh";
        if (document.getElementById("mapPgPriceCol")) document.getElementById("mapPgPriceCol").value = pgSchema.price_won_col || "price_won";
        if (document.getElementById("mapPgCardCol")) document.getElementById("mapPgCardCol").value = pgSchema.card_no_col || "card_no";
        if (document.getElementById("mapPgPayCol")) document.getElementById("mapPgPayCol").value = pgSchema.pay_type_col || "pay_type";
        
        if (document.getElementById("mapMariaTable")) document.getElementById("mapMariaTable").value = mariaTarget.table_name || mapCfg.target_table || "TCSP_CHARGE_HIST";
        if (document.getElementById("mapMariaBeginCol")) document.getElementById("mapMariaBeginCol").value = mariaTarget.begin_col || "begin";
        if (document.getElementById("mapMariaEndCol")) document.getElementById("mapMariaEndCol").value = mariaTarget.end_col || "end";
        if (document.getElementById("mapMariaPowerCol")) document.getElementById("mapMariaPowerCol").value = mariaTarget.power_col || "power";
        if (document.getElementById("mapMariaPriceCol")) document.getElementById("mapMariaPriceCol").value = mariaTarget.price_col || "totalPrice";
        if (document.getElementById("mapMariaCardCol")) document.getElementById("mapMariaCardCol").value = mariaTarget.card_no_col || "cardNo";
        if (document.getElementById("mapMariaCsIdCol")) document.getElementById("mapMariaCsIdCol").value = mariaTarget.cs_id_col || "csId";
        if (document.getElementById("mapMariaCpIdCol")) document.getElementById("mapMariaCpIdCol").value = mariaTarget.cp_id_col || "cpId";
        if (document.getElementById("mapMariaTxIdCol")) document.getElementById("mapMariaTxIdCol").value = mariaTarget.transaction_id_col || "transactionId";
      } catch (e) {}
    } catch (err) {
      appendLog("Sozlamalarni yuklashda xatolik: " + err.message, "error");
    }
  }

  function closeSettingsModal() {
    if (settingsModal) settingsModal.style.display = "none";
  }

  // Expose to window for global access
  window.openSettingsModal = openSettingsModal;
  window.closeSettingsModal = closeSettingsModal;

  // Event Listeners
  if (btnOpenSettings) btnOpenSettings.addEventListener("click", () => openSettingsModal("tab-pg"));
  if (btnCloseModal) btnCloseModal.addEventListener("click", closeSettingsModal);
  if (btnCancelSettings) btnCancelSettings.addEventListener("click", closeSettingsModal);

  // 3-Click (Triple Click) Handler to open corresponding Settings tab
  function attachTripleClickHandler(elementId, callback, timeoutMs = 800) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.style.cursor = "pointer";
    let clicks = 0;
    let timer = null;

    el.addEventListener("click", () => {
      clicks++;
      if (timer) clearTimeout(timer);

      if (clicks >= 3) {
        clicks = 0;
        callback();
      } else {
        timer = setTimeout(() => {
          clicks = 0;
        }, timeoutMs);
      }
    });
  }

  attachTripleClickHandler("cardMariaDB", () => openSettingsModal("tab-mariadb"));
  attachTripleClickHandler("cardPostgres", () => openSettingsModal("tab-pg"));
  attachTripleClickHandler("cardAutoSync", () => openSettingsModal("tab-autosync"));

  // Tab Switching
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(tc => tc.classList.remove("active"));
      btn.classList.add("active");
      const targetTab = document.getElementById(btn.getAttribute("data-tab"));
      if (targetTab) targetTab.classList.add("active");
    });
  });

  // Save Inline Auto-Sync Time Directly from Card
  if (btnSaveInlineAutoSync) {
    btnSaveInlineAutoSync.addEventListener("click", async () => {
      btnSaveInlineAutoSync.disabled = true;
      btnSaveInlineAutoSync.textContent = "⌛ Saqlanmoqda...";

      const h = intVal(document.getElementById("inlineAutoSyncHour")?.value, 2);
      const m = intVal(document.getElementById("inlineAutoSyncMinute")?.value, 0);
      const s = intVal(document.getElementById("inlineAutoSyncSecond")?.value, 0);
      const enabled = document.getElementById("inlineAutoSyncEnabled")?.checked ?? true;

      let currentConfig = {};
      try {
        const getRes = await fetch("/api/config");
        currentConfig = await getRes.json();
      } catch (e) {}

      currentConfig.auto_sync = {
        enabled: enabled,
        hour: h,
        minute: m,
        second: s
      };

      try {
        const res = await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentConfig)
        });
        const result = await res.json();
        if (res.ok) {
          isEditingInlineInputs = false;
          const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
          appendLog(`⏰ Avto-Sinxronizatsiya vaqti muvaffaqiyatli saqlandi! Yangi vaqt: ${timeStr}`, "success");
          await fetchStatus();
        } else {
          alert("Saqlashda xatolik: " + (result.detail || result.message));
        }
      } catch (err) {
        alert("Server bilan aloqa uzildi: " + err.message);
      } finally {
        btnSaveInlineAutoSync.disabled = false;
        btnSaveInlineAutoSync.textContent = "💾 Vaqtni Saqlash";
      }
    });
  }

  // Test PG Connection
  if (btnTestPg) {
    btnTestPg.addEventListener("click", async () => {
      btnTestPg.disabled = true;
      btnTestPg.textContent = "⌛ Tekshirilmoqda...";
      if (pgTestResult) {
        pgTestResult.className = "test-result-box";
        pgTestResult.style.display = "none";
      }

      const configData = {
        host: (document.getElementById("pgHost")?.value || "127.0.0.1").trim(),
        port: parseInt(document.getElementById("pgPort")?.value) || 5432,
        database: (document.getElementById("pgDatabase")?.value || "old_charging_db").trim(),
        user: (document.getElementById("pgUser")?.value || "postgres").trim(),
        password: document.getElementById("pgPassword")?.value || ""
      };

      try {
        const res = await fetch("/api/test-postgres", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(configData)
        });
        const result = await res.json();
        if (pgTestResult) {
          if (result.status === "online") {
            pgTestResult.className = "test-result-box success";
            pgTestResult.textContent = "🟢 " + result.message + (result.version ? " (" + result.version.split(",")[0] + ")" : "");
            appendLog("PostgreSQL Ulanish Sinovi: MUVAFFAQIYATLI!", "success");
          } else {
            pgTestResult.className = "test-result-box error";
            pgTestResult.textContent = "🔴 Ulanish Xatoligi: " + result.message;
            appendLog("PostgreSQL Ulanish Sinovi Xatosi: " + result.message, "error");
          }
        }
      } catch (err) {
        if (pgTestResult) {
          pgTestResult.className = "test-result-box error";
          pgTestResult.textContent = "🔴 Server Bilan Aloqa Uzildi: " + err.message;
        }
      } finally {
        btnTestPg.disabled = false;
        btnTestPg.textContent = "🔍 PostgreSQL Ulanishini Tekshirish";
      }
    });
  }

  // Fetch PG & MariaDB Tables Modal Triggers
  const btnFetchPgTables = document.getElementById("btnFetchPgTables");
  if (btnFetchPgTables) {
    btnFetchPgTables.addEventListener("click", () => openTableSelectorModal("postgres"));
  }

  const btnFetchMariaTables = document.getElementById("btnFetchMariaTables");
  if (btnFetchMariaTables) {
    btnFetchMariaTables.addEventListener("click", () => openTableSelectorModal("mariadb"));
  }

  // Test MariaDB Connection
  if (btnTestMaria) {
    btnTestMaria.addEventListener("click", async () => {
      btnTestMaria.disabled = true;
      btnTestMaria.textContent = "⌛ Tekshirilmoqda...";
      if (mariaTestResult) {
        mariaTestResult.className = "test-result-box";
        mariaTestResult.style.display = "none";
      }

      const configData = {
        host: (document.getElementById("mariaHost")?.value || "192.168.0.28").trim(),
        port: parseInt(document.getElementById("mariaPort")?.value) || 3306,
        database: (document.getElementById("mariaDatabase")?.value || "blue_networks").trim(),
        user: (document.getElementById("mariaUser")?.value || "blue_networks").trim(),
        password: document.getElementById("mariaPassword")?.value || ""
      };

      try {
        const res = await fetch("/api/test-mariadb", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(configData)
        });
        const result = await res.json();
        if (mariaTestResult) {
          if (result.status === "online") {
            mariaTestResult.className = "test-result-box success";
            mariaTestResult.textContent = "🟢 " + result.message + (result.version ? " (MariaDB " + result.version + ")" : "");
            appendLog("MariaDB Ulanish Sinovi: MUVAFFAQIYATLI!", "success");
          } else {
            mariaTestResult.className = "test-result-box error";
            mariaTestResult.textContent = "🔴 Ulanish Xatoligi: " + result.message;
            appendLog("MariaDB Ulanish Sinovi Xatosi: " + result.message, "error");
          }
        }
      } catch (err) {
        if (mariaTestResult) {
          mariaTestResult.className = "test-result-box error";
          mariaTestResult.textContent = "🔴 Server Bilan Aloqa Uzildi: " + err.message;
        }
      } finally {
        btnTestMaria.disabled = false;
        btnTestMaria.textContent = "🔍 MariaDB Ulanishini Tekshirish";
      }
    });
  }

  async function saveSettings(isSilent = false) {
    if (btnSaveSettings && !isSilent) {
      btnSaveSettings.disabled = true;
      btnSaveSettings.textContent = "⌛ Saqlanmoqda...";
    }

    const fullConfig = {
      postgresql: {
        host: (document.getElementById("pgHost")?.value || "127.0.0.1").trim(),
        port: parseInt(document.getElementById("pgPort")?.value) || 5432,
        database: (document.getElementById("pgDatabase")?.value || "old_charging_db").trim(),
        table_name: (document.getElementById("pgTableName")?.value || "charging_history").trim(),
        user: (document.getElementById("pgUser")?.value || "postgres").trim(),
        password: document.getElementById("pgPassword")?.value || ""
      },
      mariadb: {
        host: (document.getElementById("mariaHost")?.value || "192.168.0.28").trim(),
        port: parseInt(document.getElementById("mariaPort")?.value) || 3306,
        database: (document.getElementById("mariaDatabase")?.value || "blue_networks").trim(),
        user: (document.getElementById("mariaUser")?.value || "blue_networks").trim(),
        password: document.getElementById("mariaPassword")?.value || "",
        connect_timeout: 5
      },
      auto_sync: {
        enabled: document.getElementById("autoSyncEnabled")?.checked ?? true,
        hour: intVal(document.getElementById("autoSyncHour")?.value, 2),
        minute: intVal(document.getElementById("autoSyncMinute")?.value, 0),
        second: intVal(document.getElementById("autoSyncSecond")?.value, 0)
      }
    };

    const targetTable = (document.getElementById("mapMariaTable")?.value || "TCSP_CHARGE_HIST").trim();
    const mappingConfig = {
      target_table: targetTable,
      mariadb_target_mapping: {
        table_name: targetTable,
        begin_col: (document.getElementById("mapMariaBeginCol")?.value || "begin").trim(),
        end_col: (document.getElementById("mapMariaEndCol")?.value || "end").trim(),
        power_col: (document.getElementById("mapMariaPowerCol")?.value || "power").trim(),
        price_col: (document.getElementById("mapMariaPriceCol")?.value || "totalPrice").trim(),
        card_no_col: (document.getElementById("mapMariaCardCol")?.value || "cardNo").trim(),
        cs_id_col: (document.getElementById("mapMariaCsIdCol")?.value || "csId").trim(),
        cp_id_col: (document.getElementById("mapMariaCpIdCol")?.value || "cpId").trim(),
        transaction_id_col: (document.getElementById("mapMariaTxIdCol")?.value || "transactionId").trim()
      },
      pg_schema_mapping: {
        table_name: (document.getElementById("mapPgTable")?.value || document.getElementById("pgTableName")?.value || "charging_history").trim(),
        station_name_col: (document.getElementById("mapPgStationCol")?.value || "station_name").trim(),
        charger_name_col: (document.getElementById("mapPgChargerCol")?.value || "charger_name").trim(),
        begin_time_col: (document.getElementById("mapPgBeginCol")?.value || "begin_time").trim(),
        end_time_col: (document.getElementById("mapPgEndCol")?.value || "end_time").trim(),
        power_kwh_col: (document.getElementById("mapPgPowerCol")?.value || "power_kwh").trim(),
        price_won_col: (document.getElementById("mapPgPriceCol")?.value || "price_won").trim(),
        card_no_col: (document.getElementById("mapPgCardCol")?.value || "card_no").trim(),
        pay_type_col: (document.getElementById("mapPgPayCol")?.value || "pay_type").trim()
      }
    };

    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullConfig)
      });
      const result = await res.json();

      await fetch("/api/mapping-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mappingConfig)
      });

      if (res.ok) {
        if (!isSilent) {
          appendLog("Baza, taymer va schema mapping sozlamalari muvaffaqiyatli saqlandi!", "success");
          closeSettingsModal();
          await fetchStatus();
        }
      } else {
        if (!isSilent) alert("Saqlashda xatolik: " + (result.detail || result.message));
      }
    } catch (err) {
      if (!isSilent) alert("Server bilan aloqa uzildi: " + err.message);
    } finally {
      if (btnSaveSettings && !isSilent) {
        btnSaveSettings.disabled = false;
        btnSaveSettings.textContent = "💾 Sozlamalarni Saqlash";
      }
    }
  }

  // Save Settings from Modal
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener("click", () => saveSettings(false));
  }

  function intVal(val, defaultVal) {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? defaultVal : parsed;
  }

  // Drag & Drop Listeners
  if (dropzone) {
    dropzone.addEventListener("click", () => fileInput?.click());
    
    ["dragenter", "dragover"].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add("active");
      }, false);
    });

    ["dragleave", "drop"].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove("active");
      }, false);
    });

    dropzone.addEventListener("drop", (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
      }
    });
  }

  // File Clear Listener
  const btnClearFile = document.getElementById("btnClearFile");
  if (btnClearFile) {
    btnClearFile.addEventListener("click", (e) => {
      e.stopPropagation();
      clearSelectedFile();
    });
  }

  function clearSelectedFile() {
    selectedFile = null;
    if (fileInput) fileInput.value = "";
    const fileCardContainer = document.getElementById("fileCardContainer");
    if (fileCardContainer) fileCardContainer.style.display = "none";
    appendLog("Tanlangan CSV fayl o'chirildi va tozalandi.", "warn");
  }

  function handleFile(file) {
    if (!file.name.endsWith(".csv")) {
      appendLog("Faqat .csv fayllar qo'shilishi mumkin!", "error");
      return;
    }
    selectedFile = file;

    const fileCardContainer = document.getElementById("fileCardContainer");
    const fileCardName = document.getElementById("fileCardName");
    const fileCardSize = document.getElementById("fileCardSize");

    if (fileCardContainer && fileCardName && fileCardSize) {
      fileCardName.textContent = file.name;
      fileCardSize.textContent = (file.size / 1024).toFixed(1) + " KB";
      fileCardContainer.style.display = "flex";
    }

    appendLog("Fayl biriktirildi: " + file.name + " (" + (file.size / 1024).toFixed(1) + " KB)", "info");
  }

  // Dynamic Yesterday & Max Date Validation Tracker
  let userSelectedCustomDate = false;
  const pgSyncStartDateInput = document.getElementById("pgSyncStartDate");
  const pgSyncEndDateInput = document.getElementById("pgSyncEndDate");

  function getTodayDateStr() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getYesterdayDateStr() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const todayStr = getTodayDateStr();
  const yesterdayStr = getYesterdayDateStr();

  if (pgSyncStartDateInput) {
    pgSyncStartDateInput.max = todayStr;
    pgSyncStartDateInput.value = yesterdayStr;
    pgSyncStartDateInput.addEventListener("change", () => {
      userSelectedCustomDate = true;
    });
  }

  if (pgSyncEndDateInput) {
    pgSyncEndDateInput.max = todayStr;
    pgSyncEndDateInput.value = yesterdayStr;
    pgSyncEndDateInput.addEventListener("change", () => {
      userSelectedCustomDate = true;
    });
  }

  // Button Handlers
  if (btnDryRun) btnDryRun.addEventListener("click", () => uploadAndExecute(true));
  if (btnLiveImport) btnLiveImport.addEventListener("click", () => uploadAndExecute(false));

  const btnPgDryRun = document.getElementById("btnPgDryRun");
  const btnPgLiveRun = document.getElementById("btnPgLiveRun");
  if (btnPgDryRun) btnPgDryRun.addEventListener("click", () => triggerDailySync(true));
  if (btnPgLiveRun) btnPgLiveRun.addEventListener("click", () => triggerDailySync(false));

  async function fetchStatus() {
    try {
      if (!userSelectedCustomDate) {
        if (pgSyncStartDateInput) pgSyncStartDateInput.value = yesterdayStr;
        if (pgSyncEndDateInput) pgSyncEndDateInput.value = yesterdayStr;
      }

      const res = await fetch("/api/status");
      const data = await res.json();
      latestStatus = data;
      
      const mariadbBadge = document.getElementById("mariadbBadge");
      const mariadbValue = document.getElementById("mariadbValue");
      const mariadbSub = document.getElementById("mariadbSub");

      const postgresBadge = document.getElementById("postgresBadge");
      const postgresValue = document.getElementById("postgresValue");
      const postgresSub = document.getElementById("postgresSub");

      const todayHistoryValue = document.getElementById("todayHistoryValue");
      const todayHistorySub = document.getElementById("todayHistorySub");
      
      // MariaDB Update
      if (mariadbBadge && mariadbValue && mariadbSub) {
        if (data.mariadb && data.mariadb.status === "online") {
          mariadbBadge.className = "badge badge-success";
          mariadbBadge.textContent = "Online 🟢";
          mariadbValue.textContent = data.mariadb.host + ":" + data.mariadb.port;
          const stStr = data.mariadb.mapped_stations || 0;
          const cpStr = data.mariadb.mapped_chargers || 0;
          mariadbSub.textContent = window.i18n ? window.i18n.t("card_mariadb_sub_online", { st: stStr, cp: cpStr }) : `Stansiyalar: ${stStr} | Qurilmalar: ${cpStr}`;

          const metrics = data.mariadb.metrics || {};
          const todayCnt = metrics.today_history_count || 0;
          const totalCnt = metrics.total_imported_count || 0;

          if (todayHistoryValue) {
            todayHistoryValue.textContent = totalCnt.toLocaleString() + (window.i18n && window.i18n.getLanguage() === 'ko' ? "건" : " ta");
          }
          if (todayHistorySub) {
            todayHistorySub.textContent = window.i18n ? window.i18n.t("card_charge_hist_sub", { today: todayCnt.toLocaleString(), total: totalCnt.toLocaleString() }) : `Bugun: ${todayCnt.toLocaleString()} ta | Jami ko'chirilgan: ${totalCnt.toLocaleString()} ta`;
          }
        } else {
          mariadbBadge.className = "badge badge-danger";
          mariadbBadge.textContent = "Offline 🔴";
          mariadbValue.textContent = window.i18n ? window.i18n.t("card_mariadb_offline") : "Ulanish yetishmaydi";
          mariadbSub.textContent = window.i18n ? window.i18n.t("card_mariadb_sub_offline") : "IP ruxsati yoki serverni tekshiring";
        }
      }

      // PostgreSQL Update
      if (postgresBadge && postgresValue && postgresSub) {
        if (data.postgresql && data.postgresql.status === "online") {
          postgresBadge.className = "badge badge-success";
          postgresBadge.textContent = "Online 🟢";
          postgresValue.textContent = data.postgresql.host + ":" + data.postgresql.port;
          postgresSub.textContent = window.i18n ? window.i18n.t("card_postgres_sub_online", { db: data.postgresql.database || "PG DB" }) : ("Baza: " + (data.postgresql.database || "PG DB"));
        } else {
          postgresBadge.className = "badge badge-danger";
          postgresBadge.textContent = "Offline 🔴";
          postgresValue.textContent = (data.postgresql ? data.postgresql.host + ":" + data.postgresql.port : (window.i18n ? window.i18n.t("card_postgres_offline") : "Ulanmagan"));
          postgresSub.textContent = data.postgresql && data.postgresql.message ? data.postgresql.message : (window.i18n ? window.i18n.t("card_postgres_sub_offline") : "Sozlamalarni tekshiring");
        }
      }

      // Auto-Sync 4th Card Update
      const autoSyncBadge = document.getElementById("autoSyncBadge");
      const autoSyncCardValue = document.getElementById("autoSyncCardValue");
      const autoSyncCardSub = document.getElementById("autoSyncCardSub");

      if (data.auto_sync) {
        const h = String(data.auto_sync.hour ?? 2).padStart(2, '0');
        const m = String(data.auto_sync.minute ?? 0).padStart(2, '0');
        const s = String(data.auto_sync.second ?? 0).padStart(2, '0');
        const timeFormatted = `${h}:${m}:${s}`;

        if (autoSyncCardValue) {
          autoSyncCardValue.textContent = timeFormatted;
        }

        if (data.auto_sync.enabled) {
          if (autoSyncBadge) {
            autoSyncBadge.className = "badge badge-success";
            autoSyncBadge.textContent = "ACTIVE 🟢";
          }
          if (autoSyncCardSub) {
            const nextRunStr = data.auto_sync.next_run ? data.auto_sync.next_run.split('.')[0] : "...";
            autoSyncCardSub.textContent = window.i18n ? window.i18n.t("card_autosync_next", { next: nextRunStr }) : `Keyingi ijro: ${nextRunStr}`;
          }
        } else {
          if (autoSyncBadge) {
            autoSyncBadge.className = "badge badge-danger";
            autoSyncBadge.textContent = "DISABLED 🔴";
          }
          if (autoSyncCardSub) {
            autoSyncCardSub.textContent = window.i18n ? window.i18n.t("card_autosync_sub_disabled") : "Avto-sync hozirda o'chirilgan";
          }
        }
      }

    } catch (err) {
      console.error("Status fetch error:", err);
    }
  }
  window.fetchStatus = fetchStatus;

  async function uploadAndExecute(dryRun) {
    if (!selectedFile) {
      alert("Iltimos, avval CSV faylni yuklang!");
      return;
    }

    if (dryRun) {
      if (!latestStatus) {
        await fetchStatus();
      }
      const isPgOnline = latestStatus?.postgresql?.status === "online";
      const isMariaOnline = latestStatus?.mariadb?.status === "online";
      if (!isPgOnline || !isMariaOnline) {
        let offlineDbs = [];
        if (!isPgOnline) offlineDbs.push("PostgreSQL");
        if (!isMariaOnline) offlineDbs.push("MariaDB");
        const alertMsg = window.i18n ? window.i18n.t("alert_dry_run_db_offline", { dbs: offlineDbs.join(" & ") }) : `⚠️ Dry-Run Sinov uchun ikkala baza (PostgreSQL va MariaDB) ham faol (Online) bo'lishi kerak!\n\nHozirda offline holatda: ${offlineDbs.join(" va ")}.`;
        const logMsg = window.i18n ? window.i18n.t("log_dry_run_offline_err", { dbs: offlineDbs.join(" & ") }) : `🔴 Xatolik: Dry-Run sinov amalga oshirilmadi! ${offlineDbs.join(" va ")} offline holatda.`;
        appendLog(logMsg, "error");
        alert(alertMsg);
        return;
      }
    }

    const modeName = dryRun ? "Dry-Run Sinov" : "Real Bazaga Import";
    appendLog("Jarayon boshlandi: " + modeName + "...", "info");

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("dry_run", dryRun);

    try {
      const res = await fetch("/api/upload-csv", {
        method: "POST",
        body: formData
      });
      
      const result = await res.json();
      if (res.ok && result.status === "success") {
        appendLog("=== " + modeName + " Natijasi ===", "success");
        if (dryRun) {
          appendLog("Jami qatorlar: " + result.total_rows + " | Mos kelgan: " + result.mapped_records + " | O'tkazilgan: " + result.skipped_records, "info");
        } else {
          appendLog("Muvaffaqiyatli joylandi: " + result.inserted + " ta | Dublikat o'tkazildi: " + result.duplicates_skipped + " ta", "success");
          fetchStatus();
        }

        if (result.missing_stations && result.missing_stations.length > 0) {
          appendLog("⚠️ Topilmagan stansiyalar: " + result.missing_stations.join(", "), "warn");
        }
        if (result.missing_chargers && result.missing_chargers.length > 0) {
          appendLog("⚠️ Topilmagan qurilmalar: " + result.missing_chargers.join(", "), "warn");
        }

      } else {
        const errorMsg = result.message || result.detail || "Noma'lum xatolik";
        appendLog("Xatolik: " + errorMsg, "error");
      }
    } catch (err) {
      appendLog("Server bilan aloqa uzildi: " + err.message, "error");
    }
  }

  async function triggerDailySync(dryRun = true) {
    if (dryRun) {
      if (!latestStatus) {
        await fetchStatus();
      }
      const isPgOnline = latestStatus?.postgresql?.status === "online";
      const isMariaOnline = latestStatus?.mariadb?.status === "online";
      if (!isPgOnline || !isMariaOnline) {
        let offlineDbs = [];
        if (!isPgOnline) offlineDbs.push("PostgreSQL");
        if (!isMariaOnline) offlineDbs.push("MariaDB");
        const alertMsg = window.i18n ? window.i18n.t("alert_dry_run_db_offline", { dbs: offlineDbs.join(" & ") }) : `⚠️ Dry-Run Sinash uchun ikkala baza (PostgreSQL va MariaDB) ham faol (Online) bo'lishi kerak!\n\nHozirda offline holatda: ${offlineDbs.join(" va ")}.`;
        const logMsg = window.i18n ? window.i18n.t("log_dry_run_offline_err", { dbs: offlineDbs.join(" & ") }) : `🔴 Xatolik: Dry-Run sinash amalga oshirilmadi! ${offlineDbs.join(" va ")} offline holatda.`;
        appendLog(logMsg, "error");
        alert(alertMsg);
        return;
      }
    }

    const startDate = pgSyncStartDateInput ? pgSyncStartDateInput.value : "";
    const endDate = pgSyncEndDateInput ? pgSyncEndDateInput.value : "";
    const currToday = getTodayDateStr();

    // Validation for Future Date
    if (startDate && startDate > currToday) {
      appendLog(`🔴 Xatolik: Kelajak sanasi (${startDate}) bo'yicha ma'lumot ko'chirish mumkin emas! Maksimal sana: bugun (${currToday}).`, "error");
      alert(`Kelajak sanasi (${startDate}) bo'yicha ma'lumot ko'chirib bo'lmaydi! Maksimal sana: bugun (${currToday}).`);
      return;
    }
    if (endDate && endDate > currToday) {
      appendLog(`🔴 Xatolik: Kelajak sanasi (${endDate}) bo'yicha ma'lumot ko'chirish mumkin emas! Maksimal sana: bugun (${currToday}).`, "error");
      alert(`Kelajak sanasi (${endDate}) bo'yicha ma'lumot ko'chirib bo'lmaydi! Maksimal sana: bugun (${currToday}).`);
      return;
    }

    // Validation for Range Order
    if (startDate && endDate && startDate > endDate) {
      appendLog(`🔴 Xatolik: Boshlanish sanasi (${startDate}) tugash sanasidan (${endDate}) katta bo'lishi mumkin emas!`, "error");
      alert(`Boshlanish sanasi (${startDate}) tugash sanasidan (${endDate}) katta bo'lishi mumkin emas!`);
      return;
    }

    const rangeLabel = (startDate && endDate) ? `${startDate} ~ ${endDate}` : (startDate || endDate || 'Kechagi kun');
    const modeText = dryRun ? "Dry-Run Sinov" : "Real Bazaga Sync";
    appendLog(`PostgreSQL Daily Sync boshlandi (${modeText}) | Sana: ${rangeLabel}...`, "info");

    try {
      const formData = new FormData();
      formData.append("dry_run", dryRun);
      if (startDate) formData.append("start_date", startDate);
      if (endDate) formData.append("end_date", endDate);

      const res = await fetch("/api/daily-sync", {
        method: "POST",
        body: formData
      });
      const result = await res.json();

      if (result.status === "success") {
        const totalPg = result.total_pg_records !== undefined ? result.total_pg_records : (result.count ?? 0);
        const inserted = result.inserted ?? 0;
        const dupes = result.duplicates_skipped ?? 0;
        const transformed = result.transformed_count ?? 0;
        const unmapped = result.unmapped_count ?? 0;

        if (totalPg === 0) {
          appendLog(`ℹ️ PostgreSQL bazasida (${result.target_date || rangeLabel}) sanalari bo'yicha ma'lumot topilmadi (0 ta yozuv).`, "info");
        } else if (dryRun) {
          appendLog(`✅ Dry-Run Natijasi (${result.target_date}): Jami PG: ${totalPg} | Transformed: ${transformed} | Unmapped: ${unmapped}`, "success");
        } else {
          appendLog(`🚀 Real Sync Natijasi (${result.target_date}): Jami PG: ${totalPg} | Kiritildi: ${inserted} | Dublikat: ${dupes}`, "success");
          fetchStatus();
        }
        if (result.missing_stations && result.missing_stations.length > 0) {
          appendLog("⚠️ Topilmagan stansiyalar: " + result.missing_stations.join(", "), "warn");
        }
      } else {
        appendLog(`⚠️ Daily sync natijasi (${result.target_date || rangeLabel}): ${result.message || 'Xatolik yuz berdi'}`, "error");
      }
    } catch (err) {
      appendLog("Daily sync server xatoligi: " + err.message, "error");
    }
  }

  function appendLog(message, type) {
    if (!logTerminal) return;
    const line = document.createElement("div");
    line.className = "log-line log-" + (type || "info");
    const timeStr = new Date().toLocaleTimeString();
    line.textContent = "[" + timeStr + "] " + message;
    logTerminal.appendChild(line);
    logTerminal.scrollTop = logTerminal.scrollHeight;
  }
  async function validateSchema() {
    const mariaBox = document.getElementById("schemaValidationResult");
    const pgBox = document.getElementById("pgSchemaValidationResult");

    [mariaBox, pgBox].forEach(b => {
      if (b) {
        b.style.display = "block";
        b.style.background = "rgba(59, 130, 246, 0.15)";
        b.style.color = "#60a5fa";
        b.style.border = "1px solid rgba(59, 130, 246, 0.3)";
        b.innerHTML = "⏳ Pre-flight schema validation bajarilmoqda...";
      }
    });

    try {
      await saveSettings(true);

      const res = await fetch("/api/validate-schema", { method: "POST" });
      const data = await res.json();

      if (res.ok && data.status === "success") {
        const m = data.mariadb;
        const p = data.postgres;
        
        let mHtml = `<div><strong>🐬 MariaDB Target Table (${m.table_name}):</strong> ${m.exists ? "✅ Mavjud" : "⚠️ Mavjud emas (avto-yaratiladi)"}</div>`;
        mHtml += `<div><strong>📊 Target Columns:</strong> ${m.matched_cols_count}/${m.total_req_cols} ta ustunlar mos keldi</div>`;
        if (m.missing_cols && m.missing_cols.length > 0) {
          mHtml += `<div style="color: #f87171;">⚠️ Yetishmayotgan target ustunlar: ${m.missing_cols.join(", ")}</div>`;
        }

        if (mariaBox) {
          mariaBox.style.background = m.exists ? "rgba(52, 211, 153, 0.15)" : "rgba(245, 158, 11, 0.15)";
          mariaBox.style.color = m.exists ? "#34d399" : "#fbbf24";
          mariaBox.style.border = m.exists ? "1px solid rgba(52, 211, 153, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)";
          mariaBox.innerHTML = mHtml;
        }

        let pgTable = document.getElementById("mapPgTable")?.value || document.getElementById("pgTableName")?.value || "charging_history";
        let pHtml = `<div><strong>🐘 PostgreSQL Source (${pgTable}):</strong> ${p.connected ? "✅ Ulandi" : "❌ Ulanmadi (" + (p.message || "Offline") + ")"}</div>`;
        pHtml += `<div><strong>📊 Source Table Status:</strong> ${p.table_ok ? "✅ Jadval va ustunlar mavjud" : "⚠️ Jadval topilmadi yoki ulanmagan"}</div>`;

        if (pgBox) {
          pgBox.style.background = p.connected && p.table_ok ? "rgba(56, 189, 248, 0.15)" : "rgba(239, 68, 68, 0.15)";
          pgBox.style.color = p.connected && p.table_ok ? "#38bdf8" : "#f87171";
          pgBox.style.border = p.connected && p.table_ok ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)";
          pgBox.innerHTML = pHtml;
        }
      } else {
        const errHtml = "❌ Validation xatosi: " + (data.detail || "Noma'lum xatolik");
        if (mariaBox) mariaBox.innerHTML = errHtml;
        if (pgBox) pgBox.innerHTML = errHtml;
      }
    } catch (e) {
      const errHtml = "❌ Xatolik: " + e.message;
      if (mariaBox) mariaBox.innerHTML = errHtml;
      if (pgBox) pgBox.innerHTML = errHtml;
    }
  }

  let currentTablesList = [];

  async function openTableSelectorModal(dbType) {
    const modal = document.getElementById("tableSelectorModal");
    const title = document.getElementById("tableSelectorTitle");
    const container = document.getElementById("tableListContainer");
    const loading = document.getElementById("tableListLoading");
    const searchInput = document.getElementById("tableSearchInput");

    if (!modal || !container) return;

    if (searchInput) searchInput.value = "";
    container.innerHTML = "";
    if (loading) loading.style.display = "block";
    modal.style.display = "flex";

    const isPg = dbType === "postgres";
    if (title) {
      title.textContent = isPg ? "🐘 PostgreSQL Bazasi Jadvallari" : "🐬 MariaDB Bazasi Jadvallari";
    }

    const endpoint = isPg ? "/api/pg-tables" : "/api/mariadb-tables";

    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      if (loading) loading.style.display = "none";

      if (data.status === "success" && data.tables && data.tables.length > 0) {
        currentTablesList = data.tables;
        renderSelectorTables(currentTablesList, dbType);
        appendLog(`${isPg ? 'PostgreSQL' : 'MariaDB'} jadvallari (${data.tables.length} ta) o'qildi.`, "info");
      } else {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #f87171; padding: 20px;">⚠️ Jadvallar topilmadi yoki ulanish o'chgan.</div>`;
      }
    } catch (e) {
      if (loading) loading.style.display = "none";
      container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #f87171; padding: 20px;">❌ Xatolik: ${e.message}</div>`;
    }
  }

  function renderSelectorTables(tables, dbType) {
    const container = document.getElementById("tableListContainer");
    if (!container) return;

    if (tables.length === 0) {
      container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 20px;">Mos jadval topilmadi.</div>`;
      return;
    }

    const isPg = dbType === "postgres";
    const icon = isPg ? "🐘" : "🐬";

    container.innerHTML = tables.map(t => `
      <div class="table-select-card" onclick="selectSelectorTable('${t}', '${dbType}')">
        <span>${icon}</span>
        <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${t}</span>
        <span style="font-size: 11px; opacity: 0.6;">Tanlash ➔</span>
      </div>
    `).join("");
  }

  async function loadPgTableColumns(tableName) {
    const table = tableName || document.getElementById("mapPgTable")?.value || document.getElementById("pgTableName")?.value || "charging_history";
    if (!table) return;

    try {
      const res = await fetch(`/api/pg-table-columns/${encodeURIComponent(table)}`);
      const data = await res.json();
      if (data.status === "success" && data.columns && data.columns.length > 0) {
        const colNames = data.columns.map(c => c.column_name);
        
        const dl = document.getElementById("pgColumnsDatalist");
        if (dl) {
          dl.innerHTML = colNames.map(c => `<option value="${c}"></option>`).join("");
        }

        autoMatchPgColumns(colNames);
        
        const pgBox = document.getElementById("pgSchemaValidationResult");
        if (pgBox) {
          pgBox.style.display = "block";
          pgBox.style.background = "rgba(56, 189, 248, 0.15)";
          pgBox.style.color = "#38bdf8";
          pgBox.style.border = "1px solid rgba(56, 189, 248, 0.3)";
          pgBox.innerHTML = `<div><strong>🐘 PostgreSQL (${table}):</strong> ✅ ${colNames.length} ta real ustunlar o'qildi</div><div style="font-size: 11px; opacity: 0.8; margin-top: 2px;">Ustunlar: ${colNames.slice(0, 8).join(', ')}${colNames.length > 8 ? '...' : ''}</div>`;
        }

        appendLog(`🐘 PostgreSQL (${table}) ustunlari (${colNames.length} ta) muvaffaqiyatli o'qildi.`, "info");
      }
    } catch (e) {
      console.warn("PG columns fetch error:", e);
    }
  }

  function autoMatchPgColumns(columns) {
    function findBest(keywords, defaultVal) {
      for (const kw of keywords) {
        const found = columns.find(c => c.toLowerCase().includes(kw));
        if (found) return found;
      }
      if (columns.includes(defaultVal)) return defaultVal;
      return "";
    }

    const stInput = document.getElementById("mapPgStationCol");
    if (stInput) stInput.value = findBest(["station", "cs_name", "biz"], "station_name");

    const cpInput = document.getElementById("mapPgChargerCol");
    if (cpInput) cpInput.value = findBest(["charger", "cp_name", "cp"], "charger_name");

    const bgInput = document.getElementById("mapPgBeginCol");
    if (bgInput) bgInput.value = findBest(["begin", "start"], "begin_time");

    const edInput = document.getElementById("mapPgEndCol");
    if (edInput) edInput.value = findBest(["end", "finish", "stop"], "end_time");

    const pwInput = document.getElementById("mapPgPowerCol");
    if (pwInput) pwInput.value = findBest(["power", "kwh", "watt", "energy"], "power_kwh");

    const prInput = document.getElementById("mapPgPriceCol");
    if (prInput) prInput.value = findBest(["price", "won", "amount", "total", "cost"], "price_won");

    const cdInput = document.getElementById("mapPgCardCol");
    if (cdInput) cdInput.value = findBest(["card", "cardno"], "card_no");

    const pyInput = document.getElementById("mapPgPayCol");
    if (pyInput) pyInput.value = findBest(["pay", "type", "roaming"], "pay_type");
  }

  async function loadMariaTableColumns(tableName) {
    const table = tableName || document.getElementById("mapMariaTable")?.value || "TCSP_CHARGE_HIST";
    if (!table) return;

    try {
      const res = await fetch(`/api/mariadb-table-columns/${encodeURIComponent(table)}`);
      const data = await res.json();
      if (data.status === "success" && data.columns && data.columns.length > 0) {
        const colNames = data.columns.map(c => c.column_name);

        const dl = document.getElementById("mariaColumnsDatalist");
        if (dl) {
          dl.innerHTML = colNames.map(c => `<option value="${c}"></option>`).join("");
        }

        autoMatchMariaColumns(colNames);

        const mariaBox = document.getElementById("schemaValidationResult");
        if (mariaBox) {
          mariaBox.style.display = "block";
          mariaBox.style.background = "rgba(52, 211, 153, 0.15)";
          mariaBox.style.color = "#34d399";
          mariaBox.style.border = "1px solid rgba(52, 211, 153, 0.3)";
          mariaBox.innerHTML = `<div><strong>🐬 MariaDB Target (${table}):</strong> ✅ ${colNames.length} ta real ustunlar o'qildi</div><div style="font-size: 11px; opacity: 0.8; margin-top: 2px;">Ustunlar: ${colNames.slice(0, 8).join(', ')}${colNames.length > 8 ? '...' : ''}</div>`;
        }

        appendLog(`🐬 MariaDB (${table}) ustunlari (${colNames.length} ta) muvaffaqiyatli o'qildi.`, "info");
      }
    } catch (e) {
      console.warn("MariaDB columns fetch error:", e);
    }
  }

  function autoMatchMariaColumns(columns) {
    function findBest(keywords, defaultVal) {
      for (const kw of keywords) {
        const found = columns.find(c => c.toLowerCase().includes(kw));
        if (found) return found;
      }
      if (columns.includes(defaultVal)) return defaultVal;
      return "";
    }

    const bgInput = document.getElementById("mapMariaBeginCol");
    if (bgInput) bgInput.value = findBest(["begin", "start"], "begin");

    const edInput = document.getElementById("mapMariaEndCol");
    if (edInput) edInput.value = findBest(["end", "finish", "stop"], "end");

    const pwInput = document.getElementById("mapMariaPowerCol");
    if (pwInput) pwInput.value = findBest(["power", "kwh", "watt", "energy"], "power");

    const prInput = document.getElementById("mapMariaPriceCol");
    if (prInput) prInput.value = findBest(["totalprice", "price", "amount", "cost", "won"], "totalPrice");

    const cdInput = document.getElementById("mapMariaCardCol");
    if (cdInput) cdInput.value = findBest(["cardno", "card"], "cardNo");

    const csInput = document.getElementById("mapMariaCsIdCol");
    if (csInput) csInput.value = findBest(["csid", "cs_id"], "csId");

    const cpInput = document.getElementById("mapMariaCpIdCol");
    if (cpInput) cpInput.value = findBest(["cpid", "cp_id"], "cpId");

    const txInput = document.getElementById("mapMariaTxIdCol");
    if (txInput) txInput.value = findBest(["transactionid", "txid", "tx_id"], "transactionId");
  }

  function selectSelectorTable(tableName, dbType) {
    if (dbType === "postgres") {
      const el1 = document.getElementById("pgTableName");
      const el2 = document.getElementById("mapPgTable");
      if (el1) el1.value = tableName;
      if (el2) el2.value = tableName;
      loadPgTableColumns(tableName);
    } else {
      const el = document.getElementById("mapMariaTable");
      if (el) el.value = tableName;
      loadMariaTableColumns(tableName);
    }
    closeTableSelectorModal();
    appendLog(`Jadval tanlandi: ${tableName}`, "success");
  }

  function closeTableSelectorModal() {
    const modal = document.getElementById("tableSelectorModal");
    if (modal) modal.style.display = "none";
  }

  const tableSearchInput = document.getElementById("tableSearchInput");
  if (tableSearchInput) {
    tableSearchInput.addEventListener("input", (e) => {
      const term = e.target.value.toLowerCase().trim();
      const filtered = currentTablesList.filter(t => t.toLowerCase().includes(term));
      const currentTitle = document.getElementById("tableSelectorTitle")?.textContent || "";
      const dbType = currentTitle.includes("PostgreSQL") ? "postgres" : "mariadb";
      renderSelectorTables(filtered, dbType);
    });
  }

  window.validateSchema = validateSchema;
  window.loadPgTableColumns = loadPgTableColumns;
  window.loadMariaTableColumns = loadMariaTableColumns;
  window.openTableSelectorModal = openTableSelectorModal;
  window.selectSelectorTable = selectSelectorTable;
  window.closeTableSelectorModal = closeTableSelectorModal;
});

