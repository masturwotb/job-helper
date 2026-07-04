/* ============================================================
   Основной модуль приложения (Этап 1)
   Навигация, переключение разделов, часы, старт.
   ============================================================ */
(function () {
  "use strict";

  const VIEWS = {
    dashboard: { title: "Дашборд", sub: "Обзор твоей работы" },
    calendar:  { title: "Календарь", sub: "Записи по дням" },
    salary:    { title: "Зарплата", sub: "Расчёт по месяцам" },
    stats:     { title: "Статистика", sub: "Графики и динамика" },
    settings:  { title: "Настройки", sub: "Ставки и параметры" },
  };

  const nav = document.getElementById("nav");
  const views = document.getElementById("views");
  const titleEl = document.getElementById("view-title");
  const subEl = document.getElementById("view-sub");

  function switchView(name) {
    if (!VIEWS[name]) return;

    nav.querySelectorAll(".nav__item").forEach((b) =>
      b.classList.toggle("is-active", b.dataset.view === name)
    );
    views.querySelectorAll(".view").forEach((v) => {
      const active = v.dataset.view === name;
      v.classList.toggle("is-active", active);
    });

    titleEl.textContent = VIEWS[name].title;
    subEl.textContent = VIEWS[name].sub;
    location.hash = name;

    if (!settings) return;
    if (name === "calendar" && window.Calendar) Calendar.render();
    if (name === "salary" && window.SalaryView) SalaryView.render();
    if (name === "stats" && window.StatsView) StatsView.render();
  }

  nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav__item");
    if (btn) switchView(btn.dataset.view);
  });

  // Часы в шапке
  const clock = document.getElementById("clock");
  function tick() {
    const now = new Date();
    const days = ["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
    const time = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    clock.textContent = `${days[now.getDay()]}, ${time}`;
  }
  tick();
  setInterval(tick, 15000);

  /* ---------- Дашборд ---------- */
  let settings = null;
  let dashAnimated = false;

  async function renderDashboard() {
    const all = await DB.getAllDays();
    const month = U.currentMonth();
    const monthDays = all.filter((d) => d.month === month);
    const sum = Salary.summarize(monthDays, settings);

    const anim = !dashAnimated;
    animNum("db-hours", sum.workedHours, sum.workedHours % 1 ? 1 : 0, " ч", anim);
    animNum("db-days", sum.workedDays, 0, "", anim);
    animNum("db-pay", sum.total, 2, " " + settings.currency, anim);
    dashAnimated = true;

    setText("db-month-hint", U.monthTitle(month));
    setText("db-days-hint", sum.workedDays === 1 ? "рабочая смена" : "рабочих смен");

    renderToday(all);
    renderWeek(all);
    renderRecent(all);
  }

  function renderToday(all) {
    const iso = U.todayISO();
    const dd = U.parse(iso);
    setText("dash-today-date", `${CONFIG.WEEKDAYS_FULL[dd.getDay()]}, ${dd.getDate()} ${CONFIG.MONTHS_GEN[dd.getMonth()]}`);
    const rec = all.find((d) => d.date === iso);
    const body = document.getElementById("dash-today-body");
    const btn = document.getElementById("dash-today-btn");
    if (rec) {
      const t = CONFIG.DAY_TYPES[rec.type];
      const pay = Salary.payForDay(rec, settings);
      body.innerHTML = `<span class="today-type" style="--type-color:${t.color}">${t.emoji} ${t.label}</span>`
        + (t.countsWorked ? `<span class="today-hours">${U.hm(rec.hours)}</span>` : "")
        + (pay > 0 ? `<span class="today-pay">${U.money(pay, settings.currency)}</span>` : "");
      btn.textContent = "Изменить запись";
    } else {
      body.innerHTML = `<span class="today-empty">Запись за сегодня ещё не добавлена</span>`;
      btn.textContent = "Отметить сегодня";
    }
  }

  function renderWeek(all) {
    const map = {};
    all.forEach((d) => (map[d.date] = d));
    const items = [];
    const base = new Date();
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
      const iso = U.ymd(dt);
      const rec = map[iso];
      const pay = rec ? Salary.payForDay(rec, settings) : 0;
      items.push({ label: CONFIG.WEEKDAYS_SHORT[dt.getDay()], value: Math.round(pay) });
    }
    Charts.bars(document.getElementById("dash-week"), items, { fmt: (v) => U.num(v) });
  }

  function renderRecent(all) {
    const recent = all.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    const el = document.getElementById("dash-recent");
    if (recent.length === 0) { el.innerHTML = `<div class="empty">Пока нет записей. Добавь дни в Календаре.</div>`; return; }
    el.innerHTML = recent.map((d) => {
      const t = CONFIG.DAY_TYPES[d.type];
      const dd = U.parse(d.date);
      const pay = Salary.payForDay(d, settings);
      return `<button class="recent-row" data-date="${d.date}">
        <span class="recent-row__date">${dd.getDate()} ${CONFIG.MONTHS_GEN[dd.getMonth()].slice(0,3)} <em>${CONFIG.WEEKDAYS_SHORT[dd.getDay()]}</em></span>
        <span class="recent-row__type" style="--type-color:${t.color}">${t.emoji} ${t.label}</span>
        <span class="recent-row__h">${t.countsWorked ? U.hm(d.hours) : ""}</span>
        <span class="recent-row__pay">${pay > 0 ? U.money(pay, settings.currency) : ""}</span>
      </button>`;
    }).join("");
    el.querySelectorAll(".recent-row").forEach((r) =>
      r.addEventListener("click", () => { if (window.Calendar) Calendar.openDay(r.dataset.date); })
    );
  }

  // Плавный count-up числа
  function animNum(id, to, decimals, suffix, animate) {
    const el = document.getElementById(id);
    if (!el) return;
    to = Number(to) || 0;
    if (!animate || U.reduceMotion) { el.textContent = U.num(to, decimals) + (suffix || ""); return; }
    const from = 0, dur = 650, t0 = performance.now();
    function step(now) {
      const p = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = U.num(from + (to - from) * eased, decimals) + (suffix || "");
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // Данные изменились (календарь): обновить дашборд и активные разделы
  async function onDataChange() {
    await renderDashboard();
    const active = document.querySelector(".view.is-active");
    if (active) {
      if (active.dataset.view === "salary") SalaryView.render();
      if (active.dataset.view === "stats") StatsView.render();
    }
    if (window.Sync) Sync.maybeAutoSync();
  }

  // Перезагрузить настройки и перерисовать всё (без запуска синхронизации)
  async function reloadAll(newSettings) {
    settings = newSettings || (await DB.getSettings());
    if (window.Calendar) Calendar.setSettings(settings);
    if (window.SalaryView) SalaryView.setSettings(settings);
    if (window.StatsView) StatsView.setSettings(settings);
    await renderDashboard();
    const active = document.querySelector(".view.is-active");
    if (active) {
      if (active.dataset.view === "calendar") Calendar.render();
      if (active.dataset.view === "salary") SalaryView.render();
      if (active.dataset.view === "stats") StatsView.render();
    }
    if (window.SettingsView) SettingsView.fill();
  }

  // Настройки изменил ПОЛЬЗОВАТЕЛЬ (сохранение/импорт/очистка) — перерисовать и запланировать синк
  async function onSettingsChange(newSettings) {
    await reloadAll(newSettings);
    if (window.Sync) Sync.maybeAutoSync();
  }

  async function initDB() {
    try {
      await DB.open();
      await DB.ensureDefaults();
      settings = await DB.getSettings();

      // Инициализация разделов
      if (window.Calendar) Calendar.init({ settings, onChange: onDataChange });
      if (window.SalaryView) SalaryView.init({ settings });
      if (window.SettingsView) { SettingsView.init({ settings, onChange: onSettingsChange }); SettingsView.fill(); }
      if (window.Sync) Sync.initUI({ onSynced: () => reloadAll() });

      // Быстрое действие «Отметить сегодня»
      const todayBtn = document.getElementById("dash-today-btn");
      if (todayBtn) todayBtn.addEventListener("click", () => { if (window.Calendar) Calendar.openDay(U.todayISO()); });

      await renderDashboard();
    } catch (err) {
      console.error(err);
      alert("Не удалось открыть базу данных: " + (err && err.message ? err.message : err) +
        "\n\nВозможно, браузер запрещает IndexedDB в приватном режиме. Открой файл в обычном окне.");
    }
  }

  // Старт: скрыть splash, показать приложение
  window.addEventListener("load", async () => {
    const initial = (location.hash || "").replace("#", "");
    switchView(VIEWS[initial] ? initial : "dashboard");

    await initDB();

    // перерисовать активный раздел уже с загруженными настройками
    const active = document.querySelector(".view.is-active");
    if (active && settings) switchView(active.dataset.view);

    setTimeout(() => {
      document.getElementById("splash").classList.add("is-hidden");
      document.getElementById("app").classList.add("is-ready");
    }, 650);
  });

  // Экспорт для будущих этапов
  window.JobHelper = { switchView, renderDashboard: () => renderDashboard(), getSettings: () => settings };
})();
