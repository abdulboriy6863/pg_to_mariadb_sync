document.addEventListener("DOMContentLoaded", () => {
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("csvFileInput");
  const btnDryRun = document.getElementById("btnDryRun");
  const btnLiveImport = document.getElementById("btnLiveImport");
  const btnDailySync = document.getElementById("btnDailySync");
  const logTerminal = document.getElementById("logTerminal");

  // Settings Modal Elements
  const btnOpenSettings = document.getElementById("btnOpenSettings");
  const btnCloseModal = document.getElementById("btnCloseModal");
  const btnCancelSettings = document.getElementById("btnCancelSettings");
  const btnSaveSettings = document.getElementById("btnSaveSettings");
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

  let selectedFile = null;

  // Initial Status Check & Auto Polling every 5 seconds (paused when tab hidden)
  fetchStatus();
  setInterval(() => {
    if (!document.hidden) {
      fetchStatus();
    }
  }, 5000);

  // Settings Modal Listeners
  if (btnOpenSettings) {
    btnOpenSettings.addEventListener("click", () => {
      openSettingsModal();
    });
  }

  if (btnCloseModal) btnCloseModal.addEventListener("click", closeSettingsModal);
  if (btnCancelSettings) btnCancelSettings.addEventListener("click", closeSettingsModal);

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

  // Test PG Connection
  if (btnTestPg) {
    btnTestPg.addEventListener("click", async () => {
      btnTestPg.disabled = true;
      btnTestPg.textContent = "⌛ Tekshirilmoqda...";
      pgTestResult.className = "test-result-box";
      pgTestResult.style.display = "none";

      const configData = {
        host: document.getElementById("pgHost").value.trim(),
        port: parseInt(document.getElementById("pgPort").value) || 5432,
        database: document.getElementById("pgDatabase").value.trim(),
        user: document.getElementById("pgUser").value.trim(),
        password: document.getElementById("pgPassword").value
      };

      try {
        const res = await fetch("/api/test-postgres", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(configData)
        });
        const result = await res.json();
        if (result.status === "online") {
          pgTestResult.className = "test-result-box success";
          pgTestResult.textContent = "🟢 " + result.message + (result.version ? " (" + result.version.split(",")[0] + ")" : "");
          appendLog("PostgreSQL Ulanish Sinovi: MUVAFFAQIYATLI!", "success");
        } else {
          pgTestResult.className = "test-result-box error";
          pgTestResult.textContent = "🔴 Ulanish Xatoligi: " + result.message;
          appendLog("PostgreSQL Ulanish Sinovi Xatosi: " + result.message, "error");
        }
      } catch (err) {
        pgTestResult.className = "test-result-box error";
        pgTestResult.textContent = "🔴 Server Bilan Aloqa Uzildi: " + err.message;
      } finally {
        btnTestPg.disabled = false;
        btnTestPg.textContent = "🔍 PostgreSQL Ulanishini Tekshirish";
      }
    });
  }

  // Test MariaDB Connection
  if (btnTestMaria) {
    btnTestMaria.addEventListener("click", async () => {
      btnTestMaria.disabled = true;
      btnTestMaria.textContent = "⌛ Tekshirilmoqda...";
      mariaTestResult.className = "test-result-box";
      mariaTestResult.style.display = "none";

      const configData = {
        host: document.getElementById("mariaHost").value.trim(),
        port: parseInt(document.getElementById("mariaPort").value) || 3306,
        database: document.getElementById("mariaDatabase").value.trim(),
        user: document.getElementById("mariaUser").value.trim(),
        password: document.getElementById("mariaPassword").value
      };

      try {
        const res = await fetch("/api/test-mariadb", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(configData)
        });
        const result = await res.json();
        if (result.status === "online") {
          mariaTestResult.className = "test-result-box success";
          mariaTestResult.textContent = "🟢 " + result.message + (result.version ? " (MariaDB " + result.version + ")" : "");
          appendLog("MariaDB Ulanish Sinovi: MUVAFFAQIYATLI!", "success");
        } else {
          mariaTestResult.className = "test-result-box error";
          mariaTestResult.textContent = "🔴 Ulanish Xatoligi: " + result.message;
          appendLog("MariaDB Ulanish Sinovi Xatosi: " + result.message, "error");
        }
      } catch (err) {
        mariaTestResult.className = "test-result-box error";
        mariaTestResult.textContent = "🔴 Server Bilan Aloqa Uzildi: " + err.message;
      } finally {
        btnTestMaria.disabled = false;
        btnTestMaria.textContent = "🔍 MariaDB Ulanishini Tekshirish";
      }
    });
  }

  // Save Settings
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener("click", async () => {
      const fullConfig = {
        postgresql: {
          host: document.getElementById("pgHost").value.trim(),
          port: parseInt(document.getElementById("pgPort").value) || 5432,
          database: document.getElementById("pgDatabase").value.trim(),
          user: document.getElementById("pgUser").value.trim(),
          password: document.getElementById("pgPassword").value
        },
        mariadb: {
          host: document.getElementById("mariaHost").value.trim(),
          port: parseInt(document.getElementById("mariaPort").value) || 3306,
          database: document.getElementById("mariaDatabase").value.trim(),
          user: document.getElementById("mariaUser").value.trim(),
          password: document.getElementById("mariaPassword").value,
          connect_timeout: 5
        }
      };

      try {
        const res = await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fullConfig)
        });
        const result = await res.json();
        if (res.ok) {
          appendLog("Baza sozlamalari muvaffaqiyatli saqlandi! db_config.json yangilandi.", "success");
          closeSettingsModal();
          fetchStatus();
        } else {
          alert("Saqlashda xatolik: " + result.detail);
        }
      } catch (err) {
        alert("Server bilan aloqa uzildi: " + err.message);
      }
    });
  }

  async function openSettingsModal() {
    pgTestResult.style.display = "none";
    mariaTestResult.style.display = "none";
    settingsModal.style.display = "flex";

    try {
      const res = await fetch("/api/config");
      const cfg = await res.json();

      const pg = cfg.postgresql || {};
      document.getElementById("pgHost").value = pg.host || "127.0.0.1";
      document.getElementById("pgPort").value = pg.port || 5432;
      document.getElementById("pgDatabase").value = pg.database || "old_charging_db";
      document.getElementById("pgUser").value = pg.user || "postgres";
      document.getElementById("pgPassword").value = pg.password || "";

      const maria = cfg.mariadb || {};
      document.getElementById("mariaHost").value = maria.host || "192.168.0.28";
      document.getElementById("mariaPort").value = maria.port || 3306;
      document.getElementById("mariaDatabase").value = maria.database || "blue_networks";
      document.getElementById("mariaUser").value = maria.user || "blue_networks";
      document.getElementById("mariaPassword").value = maria.password || "";
    } catch (err) {
      appendLog("Sozlamalarni yuklashda xatolik: " + err.message, "error");
    }
  }

  function closeSettingsModal() {
    settingsModal.style.display = "none";
  }

  // Drag & Drop Listeners
  if (dropzone) {
    dropzone.addEventListener("click", () => fileInput.click());
    
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

  // Button Handlers
  if (btnDryRun) btnDryRun.addEventListener("click", () => uploadAndExecute(true));
  if (btnLiveImport) btnLiveImport.addEventListener("click", () => uploadAndExecute(false));
  if (btnDailySync) btnDailySync.addEventListener("click", () => triggerDailySync());

  async function fetchStatus() {
    try {
      const res = await fetch("/api/status");
      const data = await res.json();
      
      // MariaDB Status Card
      const mariadbBadge = document.getElementById("mariadbBadge");
      const mariadbValue = document.getElementById("mariadbValue");
      const mariadbSub = document.getElementById("mariadbSub");

      // PostgreSQL Status Card
      const postgresBadge = document.getElementById("postgresBadge");
      const postgresValue = document.getElementById("postgresValue");
      const postgresSub = document.getElementById("postgresSub");

      const todayHistoryValue = document.getElementById("todayHistoryValue");
      const todayHistorySub = document.getElementById("todayHistorySub");
      
      // MariaDB Update
      if (data.mariadb && data.mariadb.status === "online") {
        mariadbBadge.className = "badge badge-success";
        mariadbBadge.textContent = "Online 🟢";
        mariadbValue.textContent = data.mariadb.host + ":" + data.mariadb.port;
        mariadbSub.textContent = "Stansiyalar: " + data.mariadb.mapped_stations + " | Qurilmalar: " + data.mariadb.mapped_chargers;

        const metrics = data.mariadb.metrics || {};
        const todayCnt = metrics.today_history_count || 0;
        const totalCnt = metrics.total_imported_count || 0;

        if (todayHistoryValue) {
          todayHistoryValue.textContent = todayCnt.toLocaleString() + " ta";
        }
        if (todayHistorySub) {
          todayHistorySub.textContent = "Bugun: " + todayCnt.toLocaleString() + " ta | Jami yuklangan: " + totalCnt.toLocaleString() + " ta";
        }
      } else {
        mariadbBadge.className = "badge badge-danger";
        mariadbBadge.textContent = "Offline 🔴";
        mariadbValue.textContent = "Ulanish yetishmaydi";
        mariadbSub.textContent = "IP ruxsati yoki serverni tekshiring";
      }

      // PostgreSQL Update
      if (data.postgresql && data.postgresql.status === "online") {
        postgresBadge.className = "badge badge-success";
        postgresBadge.textContent = "Online 🟢";
        postgresValue.textContent = data.postgresql.host + ":" + data.postgresql.port;
        postgresSub.textContent = "Baza: " + (data.postgresql.database || "PG DB");
      } else {
        postgresBadge.className = "badge badge-danger";
        postgresBadge.textContent = "Offline 🔴";
        postgresValue.textContent = (data.postgresql ? data.postgresql.host + ":" + data.postgresql.port : "Ulanmagan");
        postgresSub.textContent = data.postgresql && data.postgresql.message ? data.postgresql.message : "Sozlamalarni tekshiring";
      }

    } catch (err) {
      console.error("Status fetch error:", err);
    }
  }

  async function uploadAndExecute(dryRun) {
    if (!selectedFile) {
      alert("Iltimos, avval CSV faylni yuklang!");
      return;
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
      } else {
        const errorMsg = result.message || result.detail || "Noma'lum xatolik";
        appendLog("Xatolik: " + errorMsg, "error");
      }
    } catch (err) {
      appendLog("Server bilan aloqa uzildi: " + err.message, "error");
    }
  }

  async function triggerDailySync() {
    appendLog("Kunlik PostgreSQL sinxronizatsiyasi boshlandi (Dry-run)...", "info");
    try {
      const formData = new FormData();
      formData.append("dry_run", true);

      const res = await fetch("/api/upload-csv", {
        method: "POST",
        body: formData
      });
      const result = await res.json();
      appendLog("Daily Sync Sinov Natijasi: " + JSON.stringify(result), "success");
    } catch (err) {
      appendLog("Daily sync xatoligi: " + err.message, "error");
    }
  }

  function appendLog(message, type) {
    const line = document.createElement("div");
    line.className = "log-line log-" + (type || "info");
    const timeStr = new Date().toLocaleTimeString();
    line.textContent = "[" + timeStr + "] " + message;
    logTerminal.appendChild(line);
    logTerminal.scrollTop = logTerminal.scrollHeight;
  }
});
