/* ============================================================
   Страница «Статистика» (этап 5).
   Метрики + графики: заработок по месяцам, распределение
   типов дней, часы по дням недели, часы по месяцам.
   ============================================================ */
window.StatsView = (function () {
  "use strict";

  let settings = null;
  const $ = (id) => document.getElementById(id);
  function setSettings(s) { settings = s; }

  async function render() {
    if (!settings) settings = await DB.getSettings();
    const all = await DB.getAllDays();

    renderCards(all);
    renderEarnings(all);
    renderTypes(all);
    renderWeekday(all);
    renderHours(all);
  }

  /* ---- Ключевые метрики ---- */
  function renderCards(all) {
    const work = all.filter((d) => CONFIG.DAY_TYPES[d.type] && CONFIG.DAY_TYPES[d.type].countsWorked);
    const totalHours = work.reduce((a, d) => a + (d.hours || 0), 0);
    const totalPay = all.reduce((a, d) => a + Salary.payForDay(d, settings), 0);
    const avgShift = work.length ? totalHours / work.length : 0;

    // средняя ЗП за месяц (по месяцам с данными)
    const months = {};
    all.forEach((d) => { months[d.month] = (months[d.month] || 0) + Salary.payForDay(d, settings); });
    const monthVals = Object.values(months);
    const avgMonth = monthVals.length ? monthVals.reduce((a, b) => a + b, 0) / monthVals.length : 0;

    const cards = [
      { label: "Всего наработано", value: U.num(totalHours, totalHours % 1 ? 1 : 0) + " ч", hint: `${work.length} смен за всё время` },
      { label: "В среднем за смену", value: U.num(avgShift, 1) + " ч", hint: `норма ${settings.plannedHours} ч` },
      { label: "Заработано всего", value: U.money(totalPay, settings.currency), hint: `${monthVals.length} мес. с записями` },
      { label: "В среднем за месяц", value: U.money(avgMonth, settings.currency), hint: "по месяцам с данными" },
    ];
    $("stats-cards").innerHTML = cards.map((c) => `
      <div class="card stat-card">
        <div class="stat-card__label">${c.label}</div>
        <div class="stat-card__value">${c.value}</div>
        <div class="stat-card__hint">${c.hint}</div>
      </div>`).join("");
  }

  /* ---- Заработок по месяцам (линия) ---- */
  function renderEarnings(all) {
    const map = {};
    all.forEach((d) => { map[d.month] = (map[d.month] || 0) + Salary.payForDay(d, settings); });
    const keys = Object.keys(map).sort();
    const points = keys.map((k) => {
      const [y, m] = k.split("-");
      return { label: `${CONFIG.MONTHS[+m - 1].slice(0, 3)} ${y.slice(2)}`, value: Math.round(map[k]) };
    });
    Charts.line($("chart-earnings"), points, { fmt: (v) => U.num(Math.round(v)) + " " + settings.currency });
  }

  /* ---- Распределение типов дней (пончик), текущий год ---- */
  function renderTypes(all) {
    const year = new Date().getFullYear();
    $("stats-year-sub").textContent = `За ${year} год`;
    const counts = {};
    all.forEach((d) => {
      if (d.month.slice(0, 4) !== String(year)) return;
      counts[d.type] = (counts[d.type] || 0) + 1;
    });
    const segments = Object.keys(CONFIG.DAY_TYPES).map((k) => ({
      label: CONFIG.DAY_TYPES[k].label, value: counts[k] || 0, color: CONFIG.DAY_TYPES[k].color,
    }));
    const total = segments.reduce((a, s) => a + s.value, 0);
    Charts.donut($("chart-types"), segments, { centerTop: total, centerSub: "дней" });
  }

  /* ---- Часы по дням недели (столбики) ---- */
  function renderWeekday(all) {
    const order = [1, 2, 3, 4, 5, 6, 0];
    const names = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    const hours = {};
    all.forEach((d) => {
      const t = CONFIG.DAY_TYPES[d.type];
      if (!t || !t.countsWorked) return;
      const dow = U.weekday(d.date);
      hours[dow] = (hours[dow] || 0) + (d.hours || 0);
    });
    const items = order.map((dow, i) => ({
      label: names[i], value: Math.round(hours[dow] || 0),
    }));
    Charts.bars($("chart-weekday"), items, { fmt: (v) => v + "ч" });
  }

  /* ---- Наработанные часы по месяцам (столбики) ---- */
  function renderHours(all) {
    const map = {};
    all.forEach((d) => {
      const t = CONFIG.DAY_TYPES[d.type];
      if (!t || !t.countsWorked) return;
      map[d.month] = (map[d.month] || 0) + (d.hours || 0);
    });
    const keys = Object.keys(map).sort();
    const items = keys.map((k) => {
      const [y, m] = k.split("-");
      return { label: `${CONFIG.MONTHS[+m - 1].slice(0, 3)} ${y.slice(2)}`, value: Math.round(map[k]) };
    });
    Charts.bars($("chart-hours"), items, { fmt: (v) => v + "ч" });
  }

  return { render, setSettings };
})();
