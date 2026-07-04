/* ============================================================
   Слой базы данных на IndexedDB.
   Хранилища:
     - days     : записи по дням (ключ = дата "YYYY-MM-DD")
     - settings : пары ключ/значение (ставки и параметры)
   Работает офлайн, данные сохраняются в браузере/приложении.
   ============================================================ */
window.DB = (function () {
  "use strict";

  const DB_NAME = "jobhelper";
  const DB_VERSION = 1;
  let _db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (_db) return resolve(_db);
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("days")) {
          const s = db.createObjectStore("days", { keyPath: "date" });
          s.createIndex("month", "month", { unique: false }); // "YYYY-MM"
          s.createIndex("type", "type", { unique: false });
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }
      };
      req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  function tx(store, mode) {
    return _db.transaction(store, mode).objectStore(store);
  }
  function reqToPromise(r) {
    return new Promise((res, rej) => {
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  /* ---------- Дни ---------- */

  // day: { date:"YYYY-MM-DD", type, hours, note }
  async function saveDay(day) {
    await open();
    const rec = {
      date: day.date,
      month: day.date.slice(0, 7),
      type: day.type,
      hours: Number(day.hours) || 0,
      note: day.note || "",
      // сохраняем исходную метку (важно для слияния при синхронизации),
      // а для новой/изменённой записи ставим текущее время
      updatedAt: day.updatedAt || Date.now(),
    };
    await reqToPromise(tx("days", "readwrite").put(rec));
    return rec;
  }

  async function getDay(date) {
    await open();
    return reqToPromise(tx("days", "readonly").get(date));
  }

  async function deleteDay(date) {
    await open();
    return reqToPromise(tx("days", "readwrite").delete(date));
  }

  // Все дни месяца "YYYY-MM"
  async function getMonth(month) {
    await open();
    const idx = tx("days", "readonly").index("month");
    return reqToPromise(idx.getAll(IDBKeyRange.only(month)));
  }

  async function getAllDays() {
    await open();
    return reqToPromise(tx("days", "readonly").getAll());
  }

  // Список месяцев, где есть записи, вида ["2026-07", ...]
  async function getMonthsWithData() {
    const all = await getAllDays();
    const set = new Set(all.map((d) => d.month));
    return Array.from(set).sort();
  }

  /* ---------- Настройки ---------- */

  async function getSettings() {
    await open();
    const rows = await reqToPromise(tx("settings", "readonly").getAll());
    const obj = {};
    rows.forEach((r) => (obj[r.key] = r.value));
    // слить с дефолтами (чтобы новые параметры не терялись)
    return Object.assign({}, CONFIG.DEFAULT_SETTINGS, obj);
  }

  async function setSetting(key, value) {
    await open();
    return reqToPromise(tx("settings", "readwrite").put({ key, value }));
  }

  async function saveSettings(settingsObj) {
    await open();
    const store = tx("settings", "readwrite");
    const ops = Object.keys(settingsObj).map((key) =>
      reqToPromise(store.put({ key, value: settingsObj[key] }))
    );
    return Promise.all(ops);
  }

  // Инициализация настроек по умолчанию при первом запуске
  async function ensureDefaults() {
    await open();
    const rows = await reqToPromise(tx("settings", "readonly").getAll());
    if (rows.length === 0) {
      await saveSettings(CONFIG.DEFAULT_SETTINGS);
    }
  }

  /* ---------- Экспорт / импорт (резерв. копия, пригодится для синхронизации) ---------- */

  async function exportAll() {
    return { days: await getAllDays(), settings: await getSettings(), exportedAt: Date.now() };
  }

  async function importAll(data) {
    await open();
    if (data.days) for (const d of data.days) await saveDay(d);
    if (data.settings) await saveSettings(data.settings);
  }

  async function wipeAll() {
    await open();
    await reqToPromise(tx("days", "readwrite").clear());
    await reqToPromise(tx("settings", "readwrite").clear());
    await ensureDefaults();
  }

  return {
    open, ensureDefaults,
    saveDay, getDay, deleteDay, getMonth, getAllDays, getMonthsWithData,
    getSettings, setSetting, saveSettings,
    exportAll, importAll, wipeAll,
  };
})();
