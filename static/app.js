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

        const customContainer = document.getElementById("customMappingsContainer");
        if (customContainer) {
          customContainer.innerHTML = "";
          const customMap = mapCfg.custom_mappings || {};
          Object.entries(customMap).forEach(([pgCol, mariaCol]) => {
            addCustomMappingRow(pgCol, mariaCol);
          });
        }
      } catch (e) {}
    } catch (err) {
      const isKo = window.i18n && window.i18n.getLanguage() === "ko";
      appendLog((isKo ? "설정 로드 오류: " : "Sozlamalarni yuklashda xatolik: ") + err.message, "error");
    }
  }

  function addCustomMappingRow(pgCol = "", mariaCol = "") {
    const container = document.getElementById("customMappingsContainer");
    if (!container) return;

    const rowId = "custom_row_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    const row = document.createElement("div");
    row.id = rowId;
    row.className = "custom-mapping-row";
    row.style.cssText = "display: flex; gap: 8px; align-items: center; margin-bottom: 6px;";

    const isKo = window.i18n && window.i18n.getLanguage() === "ko";
    const phPg = isKo ? "PostgreSQL 컬럼 (예: soc)" : "PostgreSQL Ustun (masalan: soc)";
    const phMaria = isKo ? "MariaDB 대상 컬럼 (예: startSoc)" : "MariaDB Target Ustun (masalan: startSoc)";

    row.innerHTML = `
      <div style="flex: 1;">
        <input type="text" class="custom-pg-col" value="${pgCol}" placeholder="${phPg}" list="pgColumnsDatalist" style="width: 100%; font-size: 12px; padding: 8px 12px; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: 8px; color: #fff;">
      </div>
      <span style="color: #a78bfa; font-weight: 700; font-size: 14px;">➔</span>
      <div style="flex: 1;">
        <input type="text" class="custom-maria-col" value="${mariaCol}" placeholder="${phMaria}" list="mariaColumnsDatalist" style="width: 100%; font-size: 12px; padding: 8px 12px; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: 8px; color: #fff;">
      </div>
      <button type="button" class="btn btn-secondary btn-sm" onclick="removeCustomMappingRow('${rowId}')" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); padding: 7px 11px; border-radius: 8px; cursor: pointer;" title="Delete">
        🗑️
      </button>
    `;

    container.appendChild(row);
  }
  window.addCustomMappingRow = addCustomMappingRow;

  function removeCustomMappingRow(rowId) {
    const el = document.getElementById(rowId);
    if (el) el.remove();
  }
  window.removeCustomMappingRow = removeCustomMappingRow;

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
        host: (document.getElementById("pgHost")?.value || "").trim(),
        port: parseInt(document.getElementById("pgPort")?.value) || 5432,
        database: (document.getElementById("pgDatabase")?.value || "").trim(),
        table_name: (document.getElementById("pgTableName")?.value || "").trim(),
        user: (document.getElementById("pgUser")?.value || "").trim(),
        password: document.getElementById("pgPassword")?.value || ""
      },
      mariadb: {
        host: (document.getElementById("mariaHost")?.value || "").trim(),
        port: parseInt(document.getElementById("mariaPort")?.value) || 3306,
        database: (document.getElementById("mariaDatabase")?.value || "").trim(),
        user: (document.getElementById("mariaUser")?.value || "").trim(),
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

    const customMappings = {};
    const customRows = document.querySelectorAll(".custom-mapping-row");
    customRows.forEach(row => {
      const pgInput = row.querySelector(".custom-pg-col")?.value?.trim();
      const mariaInput = row.querySelector(".custom-maria-col")?.value?.trim();
      if (pgInput && mariaInput) {
        customMappings[pgInput] = mariaInput;
      }
    });

    const targetTable = (document.getElementById("mapMariaTable")?.value || "TCSP_CHARGE_HIST").trim();
    const mappingConfig = {
      target_table: targetTable,
      custom_mappings: customMappings,
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

  async function checkMappingHealthBeforeSync() {
    try {
      const res = await fetch("/api/mapping-config");
      const cfg = await res.json();
      const pg = cfg.pg_schema_mapping || {};
      const maria = cfg.mariadb_target_mapping || {};

      const missingFields = [];
      if (!pg.begin_time_col) missingFields.push("PostgreSQL Begin Time Column");
      if (!pg.end_time_col) missingFields.push("PostgreSQL End Time Column");
      if (!pg.power_kwh_col) missingFields.push("PostgreSQL Power Column");
      if (!maria.begin_col) missingFields.push("MariaDB Begin Column");
      if (!maria.end_col) missingFields.push("MariaDB End Column");
      if (!maria.power_col) missingFields.push("MariaDB Power Column");

      if (missingFields.length > 0) {
        const warnMsg = `⚠️ Diqqat! Schema Mapping sozlanganida ba'zi muhim ustunlar tanlanmagan:\n- ${missingFields.join("\n- ")}\n\nBaribir davom ettirilsinmi? (Bekor qilib, Sozlamalardan to'g'rilashingiz mumkin)`;
        appendLog(`⚠️ Schema Mapping Ogohlantirishi: Muhim ustunlar yetishmayapti (${missingFields.join(", ")})`, "warn");
        return confirm(warnMsg);
      }
    } catch (e) {
      console.warn("Mapping health check error:", e);
    }
    return true;
  }

  async function uploadAndExecute(dryRun) {
    if (!selectedFile) {
      alert("Iltimos, avval CSV faylni yuklang!");
      return;
    }

    const healthOk = await checkMappingHealthBeforeSync();
    if (!healthOk) return;

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
    const healthOk = await checkMappingHealthBeforeSync();
    if (!healthOk) return;

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
    const isKo = window.i18n && window.i18n.getLanguage() === "ko";

    // Validation for Future Date
    if (startDate && startDate > currToday) {
      appendLog(isKo ? `🔴 오류: 미래 날짜(${startDate})의 데이터는 이관할 수 없습니다! 최대 날짜: 오늘(${currToday}).` : `🔴 Xatolik: Kelajak sanasi (${startDate}) bo'yicha ma'lumot ko'chirish mumkin emas! Maksimal sana: bugun (${currToday}).`, "error");
      alert(isKo ? `미래 날짜(${startDate})의 데이터는 이관할 수 없습니다! 최대 날짜: 오늘(${currToday}).` : `Kelajak sanasi (${startDate}) bo'yicha ma'lumot ko'chirib bo'lmaydi! Maksimal sana: bugun (${currToday}).`);
      return;
    }
    if (endDate && endDate > currToday) {
      appendLog(isKo ? `🔴 오류: 미래 날짜(${endDate})의 데이터는 이관할 수 없습니다! 최대 날짜: 오늘(${currToday}).` : `🔴 Xatolik: Kelajak sanasi (${endDate}) bo'yicha ma'lumot ko'chirish mumkin emas! Maksimal sana: bugun (${currToday}).`, "error");
      alert(isKo ? `미래 날짜(${endDate})의 데이터는 이관할 수 없습니다! 최대 날짜: 오늘(${currToday}).` : `Kelajak sanasi (${endDate}) bo'yicha ma'lumot ko'chirib bo'lmaydi! Maksimal sana: bugun (${currToday}).`);
      return;
    }

    // Validation for Range Order
    if (startDate && endDate && startDate > endDate) {
      appendLog(isKo ? `🔴 오류: 시작 날짜(${startDate})가 종료 날짜(${endDate})보다 클 수 없습니다!` : `🔴 Xatolik: Boshlanish sanasi (${startDate}) tugash sanasidan (${endDate}) katta bo'lishi mumkin emas!`, "error");
      alert(isKo ? `시작 날짜(${startDate})가 종료 날짜(${endDate})보다 클 수 없습니다!` : `Boshlanish sanasi (${startDate}) tugash sanasidan (${endDate}) katta bo'lishi mumkin emas!`);
      return;
    }

    const rangeLabel = (startDate && endDate) ? `${startDate} ~ ${endDate}` : (startDate || endDate || (isKo ? '어제' : 'Kechagi kun'));
    const modeText = dryRun ? (isKo ? "Dry-Run 테스트" : "Dry-Run Sinov") : (isKo ? "실제 DB 동기화" : "Real Bazaga Sync");
    appendLog(isKo ? `PostgreSQL 데일리 동기화 시작 (${modeText}) | 날짜: ${rangeLabel}...` : `PostgreSQL Daily Sync boshlandi (${modeText}) | Sana: ${rangeLabel}...`, "info");

    const btnDry = document.getElementById("btnPgDryRun");
    const btnLive = document.getElementById("btnPgLiveRun");
    if (btnDry) btnDry.disabled = true;
    if (btnLive) btnLive.disabled = true;

    const progressBox = document.getElementById("syncProgressContainer");
    const progressBar = document.getElementById("syncProgressBar");
    const progressPercent = document.getElementById("syncProgressPercent");
    const progressMsg = document.getElementById("syncProgressMessage");
    const progressProc = document.getElementById("syncProgressProcessed");
    const progressIns = document.getElementById("syncProgressInserted");
    const progressDup = document.getElementById("syncProgressDuplicates");
    const progressUnmap = document.getElementById("syncProgressUnmapped");

    if (progressBox) progressBox.style.display = "block";
    if (progressBar) progressBar.style.width = "0%";
    if (progressPercent) progressPercent.textContent = "0.0%";
    if (progressMsg) progressMsg.textContent = isKo ? "데이터베이스 조회 준비 중..." : "Baza so'rovi tayyorlanmoqda...";

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

      if (res.status === 409) {
        appendLog((isKo ? "⚠️ 진행 중인 작업 있음: " : "⚠️ Jarayon band: ") + (result.message || ''), "warn");
        if (btnDry) btnDry.disabled = false;
        if (btnLive) btnLive.disabled = false;
        if (progressBox) progressBox.style.display = "none";
        return;
      }

      if (result.status === "success") {
        if (progressBar) progressBar.style.width = "100%";
        if (progressPercent) progressPercent.textContent = "100%";
        if (progressMsg) progressMsg.textContent = isKo ? "완료되었습니다" : "Muvaffaqiyatli yakunlandi";

        const totalPg = result.total_pg_records !== undefined ? result.total_pg_records : (result.count ?? 0);
        const inserted = result.inserted ?? 0;
        const dupes = result.duplicates_skipped ?? 0;
        const transformed = result.transformed_count ?? 0;
        const unmapped = result.unmapped_count ?? 0;

        if (totalPg === 0) {
          appendLog(isKo ? `ℹ️ PostgreSQL DB에서 (${result.target_date || rangeLabel}) 날짜의 데이터가 없습니다 (0건).` : `ℹ️ PostgreSQL bazasida (${result.target_date || rangeLabel}) sanalari bo'yicha ma'lumot topilmadi (0 ta yozuv).`, "info");
        } else if (dryRun) {
          appendLog(isKo ? `✅ Dry-Run 완료 (${result.target_date}): 총 PG: ${totalPg}건 | 변환완료: ${transformed}건 | 미매핑: ${unmapped}건` : `✅ Dry-Run Natijasi (${result.target_date}): Jami PG: ${totalPg} | Transformed: ${transformed} | Unmapped: ${unmapped}`, "success");
        } else {
          appendLog(isKo ? `🚀 실제 동기화 완료 (${result.target_date}): 총 PG: ${totalPg}건 | 저장됨: ${inserted}건 | 중복 제외: ${dupes}건` : `🚀 Real Sync Natijasi (${result.target_date}): Jami PG: ${totalPg} | Kiritildi: ${inserted} | Dublikat: ${dupes}`, "success");
          fetchStatus();
        }

        if (result.missing_stations && result.missing_stations.length > 0) {
          appendLog((isKo ? "⚠️ 미매핑 충전소: " : "⚠️ Topilmagan stansiyalar: ") + result.missing_stations.join(", "), "warn");
        }

        setTimeout(() => {
          if (progressBox) progressBox.style.display = "none";
        }, 3000);

        if (btnDry) btnDry.disabled = false;
        if (btnLive) btnLive.disabled = false;
        return;
      }

      if (result.status === "error") {
        appendLog((isKo ? "⚠️ 동기화 실패: " : "⚠️ Sinxronizatsiya xatosi: ") + (result.message || 'Xatolik yuz berdi'), "error");
        if (progressBox) progressBox.style.display = "none";
        if (btnDry) btnDry.disabled = false;
        if (btnLive) btnLive.disabled = false;
        return;
      }

    } catch (err) {
      appendLog((isKo ? "서버 오류: " : "Daily sync server xatoligi: ") + err.message, "error");
      if (btnDry) btnDry.disabled = false;
      if (btnLive) btnLive.disabled = false;
      if (progressBox) progressBox.style.display = "none";
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
        b.style.padding = "6px 12px";
        b.innerHTML = "⏳ Pre-flight validation...";
      }
    });

    try {
      await saveSettings(true);

      const res = await fetch("/api/validate-schema", { method: "POST" });
      const data = await res.json();

      if (res.ok && data.status === "success") {
        const m = data.mariadb;
        const p = data.postgres;

        const isKo = window.i18n && window.i18n.getLanguage() === "ko";
        const mLabel = isKo ? "컬럼 매핑됨" : "ustun bog'landi";
        const pLabel = isKo ? "컬럼 매핑됨" : "ustun bog'landi";
        const mStatus = m.exists ? (isKo ? "✅ 존재함" : "✅ Mavjud") : (isKo ? "⚠️ 찾을 수 없음" : "⚠️ Topilmadi");
        const pStatus = (p.connected && p.table_ok) ? (isKo ? "✅ 존재함" : "✅ Mavjud") : (isKo ? "⚠️ 오프라인" : "⚠️ Offline");

        let mHtml = `<div style="font-weight: 600; font-size: 12px; display: flex; align-items: center; justify-content: space-between;"><span>🐬 MariaDB: <strong>${m.matched_cols_count || 0}/${m.total_req_cols || 8} ${mLabel}</strong></span><span style="font-size: 10px; opacity: 0.85;">${mStatus}</span></div>`;

        let pHtml = `<div style="font-weight: 600; font-size: 12px; display: flex; align-items: center; justify-content: space-between;"><span>🐘 PG: <strong>${p.matched_cols_count || 0}/${p.total_req_cols || 8} ${pLabel}</strong></span><span style="font-size: 10px; opacity: 0.85;">${pStatus}</span></div>`;

        if (data.domain_mismatch && data.recommendations) {
          const recs = data.recommendations;
          let recBtnHtml = "";
          if (recs.rec_mariadb_table) {
            recBtnHtml += `<button type="button" onclick="applyRecommendedTable('mariadb', '${recs.rec_mariadb_table}')" style="font-size: 10px; padding: 2px 6px; background: rgba(245, 158, 11, 0.25); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.5); border-radius: 4px; cursor: pointer;">⚡ Fix MariaDB</button>`;
          }
          if (recs.rec_pg_table) {
            recBtnHtml += `<button type="button" onclick="applyRecommendedTable('postgres', '${recs.rec_pg_table}')" style="font-size: 10px; padding: 2px 6px; background: rgba(245, 158, 11, 0.25); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.5); border-radius: 4px; cursor: pointer;">⚡ Fix PG</button>`;
          }
          mHtml += `<div style="margin-top: 4px; font-size: 10px; display: flex; align-items: center; justify-content: space-between;"><span>⚠️ Domain mismatch!</span> ${recBtnHtml}</div>`;
        }

        if (mariaBox) {
          mariaBox.style.background = m.exists && !data.domain_mismatch ? "rgba(52, 211, 153, 0.15)" : "rgba(245, 158, 11, 0.15)";
          mariaBox.style.color = m.exists && !data.domain_mismatch ? "#34d399" : "#fbbf24";
          mariaBox.style.border = m.exists && !data.domain_mismatch ? "1px solid rgba(52, 211, 153, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)";
          mariaBox.style.padding = "6px 12px";
          mariaBox.innerHTML = mHtml;
        }

        if (pgBox) {
          pgBox.style.background = p.connected && p.table_ok && !data.domain_mismatch ? "rgba(56, 189, 248, 0.15)" : "rgba(245, 158, 11, 0.15)";
          pgBox.style.color = p.connected && p.table_ok && !data.domain_mismatch ? "#38bdf8" : "#fbbf24";
          pgBox.style.border = p.connected && p.table_ok && !data.domain_mismatch ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid rgba(56, 189, 248, 0.3)";
          pgBox.style.padding = "6px 12px";
          pgBox.innerHTML = pHtml;
        }
      } else {
        const errHtml = "❌ Validation error";
        if (mariaBox) mariaBox.innerHTML = errHtml;
        if (pgBox) pgBox.innerHTML = errHtml;
      }
    } catch (e) {
      const errHtml = "❌ Xatolik: " + e.message;
      if (mariaBox) mariaBox.innerHTML = errHtml;
      if (pgBox) pgBox.innerHTML = errHtml;
    }
  }

  function applyRecommendedTable(dbType, tableName) {
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
    validateSchema();
    appendLog(`⚡ Tavsiya etilgan jadval biriktirildi: ${tableName}`, "success");
  }
  window.applyRecommendedTable = applyRecommendedTable;

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

        const matchedCount = autoMatchPgColumns(colNames);
        const missingCount = 8 - matchedCount;

        const pgBox = document.getElementById("pgSchemaValidationResult");
        if (pgBox) {
          pgBox.style.display = "block";
          pgBox.style.background = matchedCount === 8 ? "rgba(56, 189, 248, 0.15)" : "rgba(245, 158, 11, 0.15)";
          pgBox.style.color = matchedCount === 8 ? "#38bdf8" : "#fbbf24";
          pgBox.style.border = matchedCount === 8 ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)";
          pgBox.style.padding = "6px 12px";

          const isKo = window.i18n && window.i18n.getLanguage() === "ko";
          const pLabel = isKo ? "컬럼 매핑됨" : "ustun bog'landi";
          const colLabel = isKo ? "개 컬럼" : "ta ustun";
          pgBox.innerHTML = `<div style="font-weight: 600; font-size: 12px; display: flex; align-items: center; justify-content: space-between;"><span>🐘 PG: <strong>${matchedCount}/8 ${pLabel}</strong></span><span style="font-size: 10px; opacity: 0.8;">${colNames.length} ${colLabel}</span></div>`;
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

    const pgInputs = [
      { id: "mapPgStationCol", kw: ["station", "cs_name", "biz"], def: "station_name" },
      { id: "mapPgChargerCol", kw: ["charger", "cp_name", "cp"], def: "charger_name" },
      { id: "mapPgBeginCol", kw: ["begin", "start"], def: "begin_time" },
      { id: "mapPgEndCol", kw: ["end", "finish", "stop"], def: "end_time" },
      { id: "mapPgPowerCol", kw: ["power", "kwh", "watt", "energy"], def: "power_kwh" },
      { id: "mapPgPriceCol", kw: ["price", "won", "amount", "total", "cost"], def: "price_won" },
      { id: "mapPgCardCol", kw: ["card", "cardno"], def: "card_no" },
      { id: "mapPgPayCol", kw: ["pay", "type", "roaming"], def: "pay_type" }
    ];

    let matchedCount = 0;
    pgInputs.forEach(item => {
      const el = document.getElementById(item.id);
      if (el) {
        const val = findBest(item.kw, item.def);
        el.value = val;
        if (val) matchedCount++;
      }
    });

    return matchedCount;
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

        const matchedCount = autoMatchMariaColumns(colNames);

        const mariaBox = document.getElementById("schemaValidationResult");
        if (mariaBox) {
          mariaBox.style.display = "block";
          mariaBox.style.background = matchedCount === 8 ? "rgba(52, 211, 153, 0.15)" : "rgba(245, 158, 11, 0.15)";
          mariaBox.style.color = matchedCount === 8 ? "#34d399" : "#fbbf24";
          mariaBox.style.border = matchedCount === 8 ? "1px solid rgba(52, 211, 153, 0.3)" : "1px solid rgba(52, 211, 153, 0.3)";
          mariaBox.style.padding = "6px 12px";

          const isKo = window.i18n && window.i18n.getLanguage() === "ko";
          const mLabel = isKo ? "컬럼 매핑됨" : "ustun bog'landi";
          const colLabel = isKo ? "개 컬럼" : "ta ustun";
          mariaBox.innerHTML = `<div style="font-weight: 600; font-size: 12px; display: flex; align-items: center; justify-content: space-between;"><span>🐬 MariaDB: <strong>${matchedCount}/8 ${mLabel}</strong></span><span style="font-size: 10px; opacity: 0.8;">${colNames.length} ${colLabel}</span></div>`;
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

    const mariaInputs = [
      { id: "mapMariaBeginCol", kw: ["begin", "start"], def: "begin" },
      { id: "mapMariaEndCol", kw: ["end", "finish", "stop"], def: "end" },
      { id: "mapMariaPowerCol", kw: ["power", "kwh", "watt", "energy"], def: "power" },
      { id: "mapMariaPriceCol", kw: ["totalprice", "price", "amount", "cost", "won"], def: "totalPrice" },
      { id: "mapMariaCardCol", kw: ["cardno", "card"], def: "cardNo" },
      { id: "mapMariaCsIdCol", kw: ["csid", "cs_id"], def: "csId" },
      { id: "mapMariaCpIdCol", kw: ["cpid", "cp_id"], def: "cpId" },
      { id: "mapMariaTxIdCol", kw: ["transactionid", "txid", "tx_id"], def: "transactionId" }
    ];

    let matchedCount = 0;
    mariaInputs.forEach(item => {
      const el = document.getElementById(item.id);
      if (el) {
        const val = findBest(item.kw, item.def);
        el.value = val;
        if (val) matchedCount++;
      }
    });

    return matchedCount;
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

  async function openSamplePreviewModal() {
    const modal = document.getElementById("samplePreviewModal");
    const loading = document.getElementById("samplePreviewLoading");
    const container = document.getElementById("samplePreviewContainer");
    const emptyBox = document.getElementById("samplePreviewEmpty");
    const emptyMsg = document.getElementById("samplePreviewEmptyMsg");
    const tbody = document.getElementById("samplePreviewTableBody");
    const subtitle = document.getElementById("samplePreviewSubtitle");

    if (!modal) return;

    modal.style.display = "flex";
    if (loading) loading.style.display = "block";
    if (container) container.style.display = "none";
    if (emptyBox) emptyBox.style.display = "none";

    try {
      await saveSettings(true);

      const res = await fetch("/api/schema-preview-sample");
      const data = await res.json();

      if (loading) loading.style.display = "none";

      const isKo = window.i18n && window.i18n.getLanguage() === "ko";

      if (res.ok && data.status === "success" && data.sample_found && data.comparison && data.comparison.length > 0) {
        if (subtitle) {
          subtitle.innerHTML = isKo ?
            `PostgreSQL <code style="color: #38bdf8; background: rgba(56,189,248,0.15); padding: 2px 6px; border-radius: 4px;">${data.pg_table}</code> ➔ MariaDB <code style="color: #34d399; background: rgba(52,211,153,0.15); padding: 2px 6px; border-radius: 4px;">${data.maria_table}</code> 형식 변환 매핑 비교 (1건 실시간 샘플)` :
            `PostgreSQL <code style="color: #38bdf8; background: rgba(56,189,248,0.15); padding: 2px 6px; border-radius: 4px;">${data.pg_table}</code> ➔ MariaDB <code style="color: #34d399; background: rgba(52,211,153,0.15); padding: 2px 6px; border-radius: 4px;">${data.maria_table}</code> formatiga o'girish taqqoslanishi (1-ta real yozuv)`;
        }

        if (tbody) {
          tbody.innerHTML = data.comparison.map(item => {
            let statusStyle = "background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4);";
            if (item.status === "unmapped") {
              statusStyle = "background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4);";
            } else if (item.status === "default" || item.status === "auto_generated") {
              statusStyle = "background: rgba(99, 102, 241, 0.2); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.4);";
            } else if (item.status === "custom") {
              statusStyle = "background: rgba(167, 139, 250, 0.2); color: #c084fc; border: 1px solid rgba(167, 139, 250, 0.4);";
            }

            let badgeDisplay = item.badge_text || item.status;
            if (isKo) {
              if (badgeDisplay.includes("Mos keldi")) badgeDisplay = badgeDisplay.replace("Mos keldi", "매핑 완료");
              if (badgeDisplay.includes("topilmadi")) badgeDisplay = badgeDisplay.replace("topilmadi", "미매핑");
              if (badgeDisplay.includes("Bo'sh")) badgeDisplay = badgeDisplay.replace("Bo'sh", "비어있음");
            }

            return `
              <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); font-family: monospace;">
                <td style="padding: 10px 14px;">
                  <div style="font-weight: 600; color: #38bdf8;">${item.pg_col}</div>
                  <div style="font-size: 12px; color: #e2e8f0; margin-top: 2px; word-break: break-all;">${item.pg_val !== undefined && item.pg_val !== null && item.pg_val !== "" ? item.pg_val : '<span style="color: #64748b; font-style: italic;">(null)</span>'}</div>
                </td>
                <td style="padding: 10px 8px; text-align: center; color: #64748b; font-size: 14px;">➔</td>
                <td style="padding: 10px 14px;">
                  <div style="font-weight: 600; color: #34d399;">${item.maria_col}</div>
                  <div style="font-size: 12px; color: #e2e8f0; margin-top: 2px; word-break: break-all;">${item.maria_val !== undefined && item.maria_val !== null && item.maria_val !== "" ? item.maria_val : '<span style="color: #64748b; font-style: italic;">(null)</span>'}</div>
                </td>
                <td style="padding: 10px 14px; text-align: right;">
                  <span style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; font-family: sans-serif; ${statusStyle}">
                    ${badgeDisplay}
                  </span>
                </td>
              </tr>
            `;
          }).join("");
        }

        if (container) container.style.display = "block";
      } else {
        if (emptyMsg) {
          emptyMsg.textContent = data.message || (isKo ? "PostgreSQL DB에 샘플 데이터가 없습니다." : "PostgreSQL bazasida namunaviy ma'lumot topilmadi.");
        }
        if (emptyBox) emptyBox.style.display = "block";
      }
    } catch (err) {
      if (loading) loading.style.display = "none";
      if (emptyMsg) emptyMsg.textContent = (isKo ? "오류 발생: " : "Xatolik: ") + err.message;
      if (emptyBox) emptyBox.style.display = "block";
    }
  }

  function closeSamplePreviewModal() {
    const modal = document.getElementById("samplePreviewModal");
    if (modal) modal.style.display = "none";
  }

  window.validateSchema = validateSchema;
  window.loadPgTableColumns = loadPgTableColumns;
  window.loadMariaTableColumns = loadMariaTableColumns;
  window.openTableSelectorModal = openTableSelectorModal;
  window.selectSelectorTable = selectSelectorTable;
  window.closeTableSelectorModal = closeTableSelectorModal;
  window.openSamplePreviewModal = openSamplePreviewModal;
  window.closeSamplePreviewModal = closeSamplePreviewModal;
  window.addCustomMappingRow = addCustomMappingRow;
  window.removeCustomMappingRow = removeCustomMappingRow;
});

