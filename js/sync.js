/* ============================================================
   Облачная синхронизация через Supabase (REST, без SDK).
   Модель: одна строка на «код синхронизации», в ней весь набор
   данных (дни + настройки) в JSON. Слияние — по времени изменения
   каждого дня (не теряем правки с разных устройств).

   Таблица в Supabase (SQL — см. SYNC-SETUP.md):
     create table backups (
       code text primary key,
       data jsonb not null,
       updated_at timestamptz default now(),
       device text
     );
   ============================================================ */
window.Sync = (function () {
  "use strict";

  const LS_KEY = "jobhelper.sync";
  const DEVICE_KEY = "jobhelper.device";

  function getConfig() {
    try { return Object.assign({ url: "", key: "", code: "", auto: false }, JSON.parse(localStorage.getItem(LS_KEY) || "{}")); }
    catch { return { url: "", key: "", code: "", auto: false }; }
  }
  function setConfig(cfg) { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); }
  function isConfigured() { const c = getConfig(); return !!(c.url && c.key && c.code); }

  function deviceId() {
    let d = localStorage.getItem(DEVICE_KEY);
    if (!d) {
      const isPhone = /Android|iPhone|Mobile/i.test(navigator.userAgent);
      d = (isPhone ? "Телефон-" : "ПК-") + Math.random().toString(36).slice(2, 6);
      localStorage.setItem(DEVICE_KEY, d);
    }
    return d;
  }

  function base(cfg) { return cfg.url.replace(/\/+$/, "") + "/rest/v1/backups"; }
  function headers(cfg) {
    return {
      "apikey": cfg.key,
      "Authorization": "Bearer " + cfg.key,
      "Content-Type": "application/json",
    };
  }

  async function pull(cfg) {
    const url = base(cfg) + "?code=eq." + encodeURIComponent(cfg.code) + "&select=data,updated_at";
    const res = await fetch(url, { headers: headers(cfg) });
    if (!res.ok) throw new Error("Сервер вернул " + res.status + " при загрузке");
    const rows = await res.json();
    return rows && rows[0] ? rows[0] : null;
  }

  async function push(cfg, data) {
    const body = [{ code: cfg.code, data, updated_at: new Date().toISOString(), device: deviceId() }];
    const res = await fetch(base(cfg), {
      method: "POST",
      headers: Object.assign(headers(cfg), { "Prefer": "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error("Сервер вернул " + res.status + " при сохранении. " + t.slice(0, 160));
    }
  }

  // Слияние двух наборов: дни по свежести updatedAt, настройки по _u
  function merge(local, remote) {
    const days = {};
    (remote.days || []).forEach((d) => (days[d.date] = d));
    (local.days || []).forEach((d) => {
      const ex = days[d.date];
      if (!ex || (d.updatedAt || 0) >= (ex.updatedAt || 0)) days[d.date] = d;
    });
    const lu = (local.settings && local.settings._u) || 0;
    const ru = (remote.settings && remote.settings._u) || 0;
    const settings = ru > lu ? remote.settings : local.settings;
    return { days: Object.values(days), settings };
  }

  // Полный цикл: скачать -> слить -> сохранить локально -> выгрузить
  async function syncNow() {
    const cfg = getConfig();
    if (!isConfigured()) throw new Error("Синхронизация не настроена");

    const local = await DB.exportAll();          // { days, settings }
    const row = await pull(cfg);
    let merged;
    if (row && row.data) {
      merged = merge(local, row.data);
      await DB.importAll(merged);                // применяем слитые данные локально
    } else {
      merged = local;                            // на сервере пусто — заливаем своё
    }
    await push(cfg, merged);
    localStorage.setItem("jobhelper.lastSync", new Date().toISOString());
    return { count: (merged.days || []).length };
  }

  function lastSync() { return localStorage.getItem("jobhelper.lastSync") || null; }

  /* ---------- UI на странице «Настройки» ---------- */
  const $ = (id) => document.getElementById(id);
  let onSynced = null;      // колбэк для обновления интерфейса после синка
  let autoTimer = null;

  function status(text, kind) {
    const el = $("sync-status");
    if (!el) return;
    el.textContent = text;
    el.style.color = kind === "err" ? "var(--accent-red)" : (kind === "ok" ? "var(--accent-green)" : "var(--text-mute)");
  }

  function fillUI() {
    const c = getConfig();
    if ($("sync-url")) $("sync-url").value = c.url;
    if ($("sync-key")) $("sync-key").value = c.key;
    if ($("sync-code")) $("sync-code").value = c.code;
    if ($("sync-auto")) $("sync-auto").checked = !!c.auto;
    if ($("sync-device")) $("sync-device").textContent = "Это устройство: " + deviceId();
    const ls = lastSync();
    if (ls) status("Последняя синхронизация: " + new Date(ls).toLocaleString("ru-RU"));
    else if (!isConfigured()) status("Не настроено — заполни поля и сохрани.");
    else status("Настроено. Нажми «Синхронизировать сейчас».");
  }

  function saveUI() {
    setConfig({
      url: $("sync-url").value.trim(),
      key: $("sync-key").value.trim(),
      code: $("sync-code").value.trim(),
      auto: $("sync-auto").checked,
    });
    status(isConfigured() ? "Сохранено ✓" : "Сохранено, но заполнены не все поля.", isConfigured() ? "ok" : "err");
  }

  async function runSync(silent) {
    if (!isConfigured()) { if (!silent) status("Заполни URL, ключ и код.", "err"); return; }
    if (!silent) status("Синхронизация…");
    try {
      const r = await syncNow();
      status("Готово ✓ Записей: " + r.count + " · " + new Date().toLocaleTimeString("ru-RU"), "ok");
      if (onSynced) await onSynced();
    } catch (e) {
      status("Ошибка: " + (e && e.message ? e.message : e), "err");
    }
  }

  // Дебаунс авто-синхронизации после изменений данных
  function maybeAutoSync() {
    const c = getConfig();
    if (!c.auto || !isConfigured()) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => runSync(true), 4000);
  }

  function initUI(opts) {
    onSynced = opts && opts.onSynced;
    if (!$("sync-save")) return;
    fillUI();
    $("sync-save").addEventListener("click", () => { saveUI(); fillUI(); });
    $("sync-now").addEventListener("click", () => runSync(false));

    // при старте, если включён авто-режим — тихо подтягиваем данные
    if (getConfig().auto && isConfigured()) runSync(true);
  }

  return { getConfig, setConfig, isConfigured, syncNow, lastSync, deviceId, initUI, maybeAutoSync };
})();
