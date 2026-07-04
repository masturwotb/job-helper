/* ============================================================
   Календарь (этап 3): сетка месяца, клик по дню, модалка
   редактирования (тип дня / наработанные часы / заметка).
   Неделя начинается с понедельника.
   ============================================================ */
window.Calendar = (function () {
  "use strict";

  let cur = new Date();               // любой день отображаемого месяца
  let settings = null;
  let dayMap = {};                    // "YYYY-MM-DD" -> запись
  let editingDate = null;             // дата в открытой модалке
  let editingType = null;             // выбранный тип в модалке
  let onChange = null;                // колбэк после сохранения
  let animatedMonth = null;           // последний месяц, для которого играли анимацию

  const $ = (id) => document.getElementById(id);

  function setSettings(s) { settings = s; }

  /* ---------- Рендер сетки месяца ---------- */
  async function render() {
    if (!settings) settings = await DB.getSettings();
    const year = cur.getFullYear();
    const m0 = cur.getMonth();
    const monthKey = U.monthKey(year, m0);

    $("cal-title").textContent = U.monthTitle(monthKey);

    // анимировать «влёт» ячеек только при смене месяца, а не при обновлении данных
    const animate = monthKey !== animatedMonth;
    animatedMonth = monthKey;

    // данные месяца
    const days = await DB.getMonth(monthKey);
    dayMap = {};
    days.forEach((d) => (dayMap[d.date] = d));

    renderWeekdays();
    renderLegend();
    renderSummary(days);

    const grid = $("cal-grid");
    grid.innerHTML = "";

    // смещение: неделя с понедельника (0=Пн ... 6=Вс)
    const firstDow = (new Date(year, m0, 1).getDay() + 6) % 7;
    const total = U.daysInMonth(year, m0);
    const todayISO = U.todayISO();

    for (let i = 0; i < firstDow; i++) {
      const empty = document.createElement("div");
      empty.className = "cal-cell cal-cell--empty";
      grid.appendChild(empty);
    }

    for (let d = 1; d <= total; d++) {
      const iso = U.monthKey(year, m0) + "-" + U.pad(d);
      const dow = new Date(year, m0, d).getDay();
      const isWeekend = settings.weekendDays.includes(dow);
      const rec = dayMap[iso];

      const cell = document.createElement("button");
      cell.className = "cal-cell";
      if (animate) { cell.classList.add("cal-cell--in"); cell.style.animationDelay = (d * 10) + "ms"; }
      if (isWeekend) cell.classList.add("is-weekend");
      if (iso === todayISO) cell.classList.add("is-today");
      cell.dataset.date = iso;

      let inner = `<span class="cal-cell__num">${d}</span>`;

      if (rec) {
        const t = CONFIG.DAY_TYPES[rec.type];
        cell.classList.add("has-rec");
        cell.style.setProperty("--type-color", t.color);
        const pay = Salary.payForDay(rec, settings);
        const hoursLine = t.countsWorked
          ? `<span class="cal-cell__hours">${U.hm(rec.hours)}</span>` : "";
        const payLine = pay > 0
          ? `<span class="cal-cell__pay">${U.money(pay, settings.currency)}</span>` : "";
        inner += `<span class="cal-cell__badge" style="--type-color:${t.color}">${t.emoji} ${t.short}</span>
                  ${hoursLine}${payLine}`;
      } else if (isWeekend) {
        inner += `<span class="cal-cell__badge cal-cell__badge--ghost">🌙 Вых</span>`;
      }

      cell.innerHTML = inner;
      cell.addEventListener("click", () => openModal(iso));
      grid.appendChild(cell);
    }
  }

  function renderWeekdays() {
    const names = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
    $("cal-weekdays").innerHTML = names
      .map((n, i) => `<div class="cal-wd${i >= 5 ? " is-weekend" : ""}">${n}</div>`)
      .join("");
  }

  function renderLegend() {
    $("cal-legend").innerHTML = Object.values(CONFIG.DAY_TYPES)
      .map((t) => `<span class="legend-item"><i style="background:${t.color}"></i>${t.emoji} ${t.label}</span>`)
      .join("");
  }

  function renderSummary(days) {
    const sum = Salary.summarize(days, settings);
    $("cal-summary").innerHTML = `
      <div class="msum"><span class="msum__v">${U.num(sum.workedHours, sum.workedHours % 1 ? 1 : 0)}</span><span class="msum__l">часов</span></div>
      <div class="msum"><span class="msum__v">${sum.workedDays}</span><span class="msum__l">смен</span></div>
      <div class="msum msum--accent"><span class="msum__v">${U.money(sum.total, settings.currency)}</span><span class="msum__l">за месяц</span></div>`;
  }

  /* ---------- Модалка редактирования дня ---------- */
  async function openModal(iso) {
    editingDate = iso;
    // из кэша месяца, либо напрямую из БД (напр. при открытии с дашборда)
    const rec = dayMap[iso] || (await DB.getDay(iso)) || null;
    const dow = U.weekday(iso);
    const isWeekend = settings.weekendDays.includes(dow);

    editingType = rec ? rec.type : (isWeekend ? "weekend" : "work");

    $("modal-date").textContent = U.longDate(iso);
    $("modal-sub").textContent = rec ? "Редактирование записи" : "Новая запись";
    $("modal-note").value = rec ? (rec.note || "") : "";

    const hm = U.splitHM(rec && rec.hours ? rec.hours : 0);
    $("modal-hours").value = rec && rec.hours ? hm.h : "";
    $("modal-minutes").value = rec && rec.hours && hm.m ? hm.m : "";

    renderTypeButtons();
    renderHoursQuick();
    syncModalState();

    if (window.Background) Background.pause();
    const modal = $("day-modal");
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add("is-open"));
  }

  function closeModal() {
    const modal = $("day-modal");
    modal.classList.remove("is-open");
    setTimeout(() => (modal.hidden = true), 240);
    editingDate = null;
    if (window.Background) Background.resume();
  }

  function renderTypeButtons() {
    $("modal-types").innerHTML = Object.values(CONFIG.DAY_TYPES)
      .map((t) => `<button class="type-btn${t.key === editingType ? " is-active" : ""}"
                    style="--type-color:${t.color}" data-type="${t.key}">
                    <span class="type-btn__emoji">${t.emoji}</span>
                    <span class="type-btn__label">${t.label}</span></button>`)
      .join("");
    $("modal-types").querySelectorAll(".type-btn").forEach((b) =>
      b.addEventListener("click", () => {
        editingType = b.dataset.type;
        renderTypeButtons();
        syncModalState();
      })
    );
  }

  function renderHoursQuick() {
    const vals = [6, 8, 9, 10, 11, 12];
    $("modal-hours-quick").innerHTML = vals
      .map((v) => `<button class="quick-btn" data-h="${v}">${v} ч</button>`)
      .join("");
    $("modal-hours-quick").querySelectorAll(".quick-btn").forEach((b) =>
      b.addEventListener("click", () => {
        $("modal-hours").value = b.dataset.h;
        $("modal-minutes").value = "";
        syncModalState();
      })
    );
    const mins = [0, 15, 30, 45];
    $("modal-mins-quick").innerHTML = mins
      .map((v) => `<button class="quick-btn quick-btn--min" data-m="${v}">${v} мин</button>`)
      .join("");
    $("modal-mins-quick").querySelectorAll(".quick-btn").forEach((b) =>
      b.addEventListener("click", () => {
        $("modal-minutes").value = b.dataset.m === "0" ? "" : b.dataset.m;
        if (!$("modal-hours").value) $("modal-hours").value = 8;
        syncModalState();
      })
    );
  }

  // Текущее значение из полей часов/минут в десятичных часах
  function getModalHours() {
    let m = Number($("modal-minutes").value) || 0;
    if (m > 59) m = 59;
    return U.toDecimal(Number($("modal-hours").value) || 0, m);
  }

  // Показ/скрытие поля часов и предпросчёт оплаты
  function syncModalState() {
    const t = CONFIG.DAY_TYPES[editingType];
    const wrap = $("modal-hours-wrap");
    wrap.style.display = t.countsWorked ? "" : "none";

    const decimal = getModalHours();
    $("modal-hours-dec").textContent = "= " + U.num(decimal, decimal % 1 ? 2 : 0) + " ч";
    const preview = { date: editingDate, type: editingType, hours: decimal };
    const pay = Salary.payForDay(preview, settings);
    let text;
    if (t.paid === "hours") text = `≈ ${U.money(pay, settings.currency)}  (${U.num(decimal, decimal % 1 ? 2 : 0)} ч × ${U.money(settings.rate, settings.currency)})`;
    else if (t.paid === "sick") text = pay > 0 ? `Больничный: ${U.money(pay, settings.currency)}` : "Больничный в выходной/праздник — не оплачивается";
    else if (t.paid === "vacation") text = settings.vacationPay > 0 ? `Отпускные: ${U.money(pay, settings.currency)}` : "Оплата отпуска не задана (в Настройках)";
    else text = "День не оплачивается";
    $("modal-pay").textContent = text;
  }

  async function saveDay() {
    if (!editingDate) return;
    const t = CONFIG.DAY_TYPES[editingType];
    const hours = t.countsWorked ? getModalHours() : 0;
    await DB.saveDay({
      date: editingDate, type: editingType, hours, note: $("modal-note").value.trim(),
    });
    closeModal();
    await render();
    if (onChange) onChange();
  }

  async function clearDay() {
    if (!editingDate) return;
    await DB.deleteDay(editingDate);
    closeModal();
    await render();
    if (onChange) onChange();
  }

  /* ---------- Инициализация ---------- */
  function init(opts) {
    settings = opts.settings;
    onChange = opts.onChange || null;

    $("cal-prev").addEventListener("click", () => { cur = new Date(cur.getFullYear(), cur.getMonth() - 1, 1); render(); });
    $("cal-next").addEventListener("click", () => { cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1); render(); });
    $("cal-today").addEventListener("click", () => { cur = new Date(); render(); });

    $("modal-close").addEventListener("click", closeModal);
    $("modal-save").addEventListener("click", saveDay);
    $("modal-delete").addEventListener("click", clearDay);
    $("modal-hours").addEventListener("input", syncModalState);
    $("modal-minutes").addEventListener("input", syncModalState);
    $("day-modal").addEventListener("click", (e) => { if (e.target.id === "day-modal") closeModal(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$("day-modal").hidden) closeModal();
      if (e.key === "Enter" && !$("day-modal").hidden) saveDay();
    });
  }

  return {
    init, render, setSettings,
    openDay: (iso) => openModal(iso),
    gotoMonth: (y, m) => { cur = new Date(y, m, 1); return render(); },
  };
})();
