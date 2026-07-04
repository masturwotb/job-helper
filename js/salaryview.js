/* ============================================================
   Страница «Зарплата» (этап 4).
   Детальный расчёт по выбранному месяцу + свод по году.
   ============================================================ */
window.SalaryView = (function () {
  "use strict";

  let cur = new Date();     // отображаемый месяц
  let settings = null;
  const $ = (id) => document.getElementById(id);

  function setSettings(s) { settings = s; }

  async function render() {
    if (!settings) settings = await DB.getSettings();
    const year = cur.getFullYear();
    const m0 = cur.getMonth();
    const monthKey = U.monthKey(year, m0);

    $("sal-title").textContent = U.monthTitle(monthKey);

    const days = await DB.getMonth(monthKey);
    const sum = Salary.summarize(days, settings);

    $("sal-total").textContent = U.money(sum.total, settings.currency);
    $("sal-meta").textContent =
      `${sum.workedDays} смен · ${U.num(sum.workedHours, sum.workedHours % 1 ? 1 : 0)} ч наработано`;

    renderBreakdown(sum);
    renderDays(sum);
    await renderYear(year);
  }

  function renderBreakdown(sum) {
    const rows = Object.keys(CONFIG.DAY_TYPES)
      .map((key) => ({ t: CONFIG.DAY_TYPES[key], b: sum.byType[key] }))
      .filter((r) => r.b && r.b.count > 0);

    if (rows.length === 0) {
      $("sal-breakdown").innerHTML = `<div class="empty">Нет записей за этот месяц. Добавь дни в Календаре.</div>`;
      return;
    }

    $("sal-breakdown").innerHTML = rows.map((r) => `
      <div class="brk-row">
        <span class="brk-row__name"><i style="background:${r.t.color}"></i>${r.t.emoji} ${r.t.label}</span>
        <span class="brk-row__count">${r.b.count} дн${r.t.countsWorked && r.b.hours ? ` · ${U.num(r.b.hours, r.b.hours % 1 ? 1 : 0)} ч` : ""}</span>
        <span class="brk-row__pay">${U.money(r.b.pay, settings.currency)}</span>
      </div>`).join("") +
      `<div class="brk-row brk-row--total">
        <span class="brk-row__name">Итого</span><span></span>
        <span class="brk-row__pay">${U.money(sum.total, settings.currency)}</span>
      </div>`;
  }

  function renderDays(sum) {
    const work = sum.earningsPerDay.filter((d) => CONFIG.DAY_TYPES[d.type] && CONFIG.DAY_TYPES[d.type].countsWorked);
    if (work.length === 0) {
      $("sal-days").innerHTML = `<div class="empty">Рабочих смен пока нет.</div>`;
      return;
    }
    const maxPay = Math.max(...work.map((d) => d.pay), 1);
    $("sal-days").innerHTML = work.map((d) => {
      const dd = U.parse(d.date);
      const wd = CONFIG.WEEKDAYS_SHORT[dd.getDay()];
      const w = Math.max(6, (d.pay / maxPay) * 100);
      return `<div class="day-row">
        <span class="day-row__date">${dd.getDate()} <em>${wd}</em></span>
        <span class="day-row__bar"><i style="width:${w}%"></i></span>
        <span class="day-row__h">${U.hm(d.hours)}</span>
        <span class="day-row__pay">${U.money(d.pay, settings.currency)}</span>
      </div>`;
    }).join("");
  }

  async function renderYear(year) {
    $("sal-year-label").textContent = year;
    const all = await DB.getAllDays();
    const totals = new Array(12).fill(0);
    for (const d of all) {
      if (d.month.slice(0, 4) !== String(year)) continue;
      totals[Number(d.month.slice(5, 7)) - 1] += Salary.payForDay(d, settings);
    }
    const max = Math.max(...totals, 1);
    const yearTotal = totals.reduce((a, b) => a + b, 0);
    const curM0 = cur.getMonth();

    $("sal-year").innerHTML = totals.map((v, i) => {
      const h = Math.max(3, (v / max) * 100);
      return `<button class="ybar${i === curM0 ? " is-active" : ""}" data-m="${i}" title="${CONFIG.MONTHS[i]}: ${U.money(v, settings.currency)}">
        <span class="ybar__val">${v > 0 ? U.num(Math.round(v)) : ""}</span>
        <span class="ybar__col" style="height:${h}%"></span>
        <span class="ybar__label">${CONFIG.MONTHS[i].slice(0,3)}</span>
      </button>`;
    }).join("");

    $("sal-year").querySelectorAll(".ybar").forEach((b) =>
      b.addEventListener("click", () => { cur = new Date(year, Number(b.dataset.m), 1); render(); })
    );

    $("sal-year-total").innerHTML = `Всего за ${year} год: <b>${U.money(yearTotal, settings.currency)}</b>`;
  }

  function init(opts) {
    settings = opts.settings;
    $("sal-prev").addEventListener("click", () => { cur = new Date(cur.getFullYear(), cur.getMonth() - 1, 1); render(); });
    $("sal-next").addEventListener("click", () => { cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1); render(); });
  }

  return { init, render, setSettings };
})();
