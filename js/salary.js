/* ============================================================
   Расчёт зарплаты. Ядро логики (детальный UI — на этапе 4).
   Правила:
     - рабочий день: наработанные часы × ставка
     - больничный: фикс. оплата, НО 0 если день = праздник/выходной
     - отпуск: фикс. оплата за день
     - остальное: 0
   ============================================================ */
window.Salary = (function () {
  "use strict";

  // Оплата за один день с учётом настроек.
  function payForDay(day, settings) {
    const t = CONFIG.DAY_TYPES[day.type];
    if (!t) return 0;
    switch (t.paid) {
      case "hours":    return (Number(day.hours) || 0) * settings.rate;
      case "sick": {
        // не оплачивается на выходной/праздник
        const wd = U.weekday(day.date);
        const isWeekend = settings.weekendDays.includes(wd);
        // если явно помечено выходным/праздником — тоже не платим (тип уже был бы другой,
        // но подстрахуемся по дню недели)
        return isWeekend ? 0 : settings.sickPay;
      }
      case "vacation": return settings.vacationPay;
      default:         return 0;
    }
  }

  // Свод по массиву дней месяца.
  function summarize(days, settings) {
    const res = {
      total: 0,
      workedHours: 0,
      workedDays: 0,
      byType: {},       // type -> { count, hours, pay }
      earningsPerDay: [],
    };
    for (const key of Object.keys(CONFIG.DAY_TYPES)) {
      res.byType[key] = { count: 0, hours: 0, pay: 0 };
    }
    for (const d of days) {
      const pay = payForDay(d, settings);
      const t = CONFIG.DAY_TYPES[d.type];
      res.total += pay;
      const bucket = res.byType[d.type] || (res.byType[d.type] = { count: 0, hours: 0, pay: 0 });
      bucket.count += 1;
      bucket.pay += pay;
      if (t && t.countsWorked) {
        res.workedDays += 1;
        res.workedHours += Number(d.hours) || 0;
        bucket.hours += Number(d.hours) || 0;
      }
      res.earningsPerDay.push({ date: d.date, pay, hours: Number(d.hours) || 0, type: d.type });
    }
    res.earningsPerDay.sort((a, b) => a.date.localeCompare(b.date));
    return res;
  }

  return { payForDay, summarize };
})();
