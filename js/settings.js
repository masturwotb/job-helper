/* ============================================================
   Страница «Настройки» (этап 4).
   Ставки, выходные дни, экспорт/импорт, очистка данных.
   ============================================================ */
window.SettingsView = (function () {
  "use strict";

  let settings = null;
  let onChange = null;      // вызывается после сохранения (пересчёт остального)
  const $ = (id) => document.getElementById(id);

  function fill() {
    $("set-rate").value = settings.rate;
    $("set-sick").value = settings.sickPay;
    $("set-vacation").value = settings.vacationPay;
    $("set-planned").value = settings.plannedHours;
    $("set-currency").value = settings.currency;
    renderWeekend();
  }

  function renderWeekend() {
    const names = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
    const order = [1,2,3,4,5,6,0]; // индексы getDay() в порядке Пн..Вс
    $("set-weekend").innerHTML = order.map((dow, i) =>
      `<button class="wd-btn${settings.weekendDays.includes(dow) ? " is-active" : ""}" data-dow="${dow}">${names[i]}</button>`
    ).join("");
    $("set-weekend").querySelectorAll(".wd-btn").forEach((b) =>
      b.addEventListener("click", () => {
        const dow = Number(b.dataset.dow);
        const idx = settings.weekendDays.indexOf(dow);
        if (idx >= 0) settings.weekendDays.splice(idx, 1);
        else settings.weekendDays.push(dow);
        renderWeekend();
      })
    );
  }

  async function save() {
    settings.rate = Number($("set-rate").value) || 0;
    settings.sickPay = Number($("set-sick").value) || 0;
    settings.vacationPay = Number($("set-vacation").value) || 0;
    settings.plannedHours = Number($("set-planned").value) || 0;
    settings.currency = ($("set-currency").value || "€").trim();
    settings._u = Date.now();   // метка времени для слияния при синхронизации

    await DB.saveSettings(settings);
    $("unit-rate").textContent = settings.currency;
    flashSaved("Сохранено ✓");
    if (onChange) onChange(settings);
  }

  function flashSaved(text) {
    const el = $("set-saved");
    el.textContent = text;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 1800);
  }

  /* ---------- Экспорт / импорт ---------- */
  async function exportData() {
    const data = await DB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jobhelper-backup-${U.todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);
        await DB.importAll(data);
        settings = await DB.getSettings();
        fill();
        flashSaved("Импортировано ✓");
        if (onChange) onChange(settings);
      } catch (e) {
        alert("Не удалось прочитать файл: " + e.message);
      }
    };
    reader.readAsText(file);
  }

  async function wipe() {
    if (!confirm("Точно удалить ВСЕ записи и настройки? Это действие необратимо.")) return;
    if (!confirm("Последнее предупреждение. Рекомендую сначала сделать Экспорт. Удалить всё?")) return;
    await DB.wipeAll();
    settings = await DB.getSettings();
    fill();
    flashSaved("Все данные удалены");
    if (onChange) onChange(settings);
  }

  function init(opts) {
    settings = opts.settings;
    onChange = opts.onChange || null;
    $("unit-rate").textContent = settings.currency;

    $("set-save").addEventListener("click", save);
    $("set-export").addEventListener("click", exportData);
    $("set-import").addEventListener("click", () => $("set-import-file").click());
    $("set-import-file").addEventListener("change", (e) => { if (e.target.files[0]) importData(e.target.files[0]); });
    $("set-wipe").addEventListener("click", wipe);
  }

  return { init, fill, getSettings: () => settings };
})();
