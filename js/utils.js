/* ============================================================
   Вспомогательные функции: даты, форматирование, деньги.
   ============================================================ */
window.U = (function () {
  "use strict";

  const pad = (n) => String(n).padStart(2, "0");

  // Date -> "YYYY-MM-DD" (локально, без сдвига часового пояса)
  function ymd(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
  // "YYYY-MM-DD" -> Date (локальная полночь)
  function parse(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  function todayISO() { return ymd(new Date()); }

  // "YYYY-MM" текущего месяца
  function currentMonth() {
    const n = new Date();
    return `${n.getFullYear()}-${pad(n.getMonth() + 1)}`;
  }
  function monthKey(year, monthIndex0) { return `${year}-${pad(monthIndex0 + 1)}`; }

  // день недели 0..6 (0=Вс)
  function weekday(iso) { return parse(iso).getDay(); }

  // Красивый заголовок месяца: "Июль 2026"
  function monthTitle(monthKeyStr) {
    const [y, m] = monthKeyStr.split("-").map(Number);
    return `${CONFIG.MONTHS[m - 1]} ${y}`;
  }

  // "4 июля 2026, суббота"
  function longDate(iso) {
    const d = parse(iso);
    return `${d.getDate()} ${CONFIG.MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}, ${CONFIG.WEEKDAYS_FULL[d.getDay()].toLowerCase()}`;
  }

  function daysInMonth(year, monthIndex0) {
    return new Date(year, monthIndex0 + 1, 0).getDate();
  }

  // Деньги: "72,00 €"
  function money(value, currency) {
    const cur = currency || "€";
    const n = (Number(value) || 0).toLocaleString("ru-RU", {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
    return `${n} ${cur}`;
  }
  function num(value, digits) {
    return (Number(value) || 0).toLocaleString("ru-RU", {
      minimumFractionDigits: digits || 0, maximumFractionDigits: digits || 0,
    });
  }

  // Десятичные часы -> { h, m } (минуты округляются к ближайшей)
  function splitHM(decimalHours) {
    const totalMin = Math.round((Number(decimalHours) || 0) * 60);
    return { h: Math.floor(totalMin / 60), m: totalMin % 60 };
  }
  // { h, m } -> десятичные часы (8ч30м -> 8.5)
  function toDecimal(h, m) {
    return ((Number(h) || 0) * 60 + (Number(m) || 0)) / 60;
  }
  // Десятичные часы -> "8ч 30м" / "8 ч" (для компактного показа)
  function hm(decimalHours) {
    const { h, m } = splitHM(decimalHours);
    if (m === 0) return `${h} ч`;
    return `${h}ч ${m}м`;
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return { pad, ymd, parse, todayISO, currentMonth, monthKey, weekday, monthTitle, longDate, daysInMonth, money, num, splitHM, toDecimal, hm, reduceMotion };
})();
