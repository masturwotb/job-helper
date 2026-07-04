/* ============================================================
   Конфигурация: типы дней и настройки по умолчанию.
   Используется всеми модулями (БД, календарь, зарплата, графики).
   ============================================================ */
window.CONFIG = (function () {
  "use strict";

  // Типы дней. paid: как считается оплата.
  //   'hours'  — наработанные часы × ставка (рабочий день)
  //   'sick'   — фикс. оплата за больничный (кроме праздника/выходного)
  //   'vacation' — фикс. оплата за день отпуска
  //   'none'   — не оплачивается
  const DAY_TYPES = {
    work:     { key: "work",     label: "Рабочий",      short: "Раб",  emoji: "🛠️", color: "#8b5cf6", paid: "hours",    countsWorked: true  },
    weekend:  { key: "weekend",  label: "Выходной",     short: "Вых",  emoji: "🌙", color: "#64748b", paid: "none",     countsWorked: false },
    holiday:  { key: "holiday",  label: "Праздник",     short: "Прз",  emoji: "🎉", color: "#f472b6", paid: "none",     countsWorked: false },
    vacation: { key: "vacation", label: "Отпуск",       short: "Отп",  emoji: "🏖️", color: "#22d3ee", paid: "vacation", countsWorked: false },
    sick:     { key: "sick",     label: "Больничный",   short: "Бол",  emoji: "🤒", color: "#fbbf24", paid: "sick",     countsWorked: false },
    dayoff:   { key: "dayoff",   label: "Отгул",        short: "Отг",  emoji: "☕", color: "#34d399", paid: "none",     countsWorked: false },
    absence:  { key: "absence",  label: "Прогул",       short: "Прг",  emoji: "🚫", color: "#fb7185", paid: "none",     countsWorked: false },
  };

  const DEFAULT_SETTINGS = {
    currency: "€",
    rate: 7.2,          // ставка за час, €
    sickPay: 32.5,      // оплата за день больничного, €
    vacationPay: 0,     // оплата за день отпуска (пока неизвестна)
    weekendDays: [6, 0], // Сб, Вс (0=Вс ... 6=Сб)
    plannedHours: 8,    // норма часов в смену (для сравнения с выработкой)
  };

  const WEEKDAYS_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const WEEKDAYS_FULL = ["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
  const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
  const MONTHS_GEN = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];

  return { DAY_TYPES, DEFAULT_SETTINGS, WEEKDAYS_SHORT, WEEKDAYS_FULL, MONTHS, MONTHS_GEN };
})();
