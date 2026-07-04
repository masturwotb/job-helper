/* ============================================================
   Мини-движок SVG-графиков (этап 5). Без зависимостей.
   Charts.line() · Charts.donut() · Charts.bars()
   ============================================================ */
window.Charts = (function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  /* ---------- Линейный график (area) ---------- */
  // points: [{ label, value }]
  function line(el, points, opts) {
    opts = opts || {};
    const W = 640, H = 240, padL = 46, padR = 16, padT = 18, padB = 34;
    el.innerHTML = "";
    if (!points.length) { el.innerHTML = `<div class="empty">Пока нет данных для графика.</div>`; return; }

    const max = Math.max(...points.map((p) => p.value), 1);
    const min = 0;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const n = points.length;
    const x = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    const y = (v) => padT + plotH - ((v - min) / (max - min || 1)) * plotH;

    const uid = "g" + Math.random().toString(36).slice(2, 7);
    let path = "", area = "";
    points.forEach((p, i) => {
      path += (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.value).toFixed(1) + " ";
    });
    area = path + `L${x(n - 1).toFixed(1)} ${(padT + plotH).toFixed(1)} L${x(0).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;

    // горизонтальные линии сетки
    let grid = "";
    const steps = 4;
    for (let s = 0; s <= steps; s++) {
      const gv = (max / steps) * s;
      const gy = y(gv);
      grid += `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" class="ch-grid"/>`;
      grid += `<text x="${padL - 8}" y="${gy + 4}" class="ch-axis" text-anchor="end">${opts.fmt ? opts.fmt(gv) : Math.round(gv)}</text>`;
    }

    // подписи по X (не чаще ~8)
    const stepX = Math.ceil(n / 8);
    let xlabels = "";
    points.forEach((p, i) => {
      if (i % stepX === 0 || i === n - 1) {
        xlabels += `<text x="${x(i)}" y="${H - 10}" class="ch-axis" text-anchor="middle">${esc(p.label)}</text>`;
      }
    });

    // точки + подсказки
    let dots = "";
    points.forEach((p, i) => {
      dots += `<circle cx="${x(i)}" cy="${y(p.value)}" r="3.5" class="ch-dot">
        <title>${esc(p.label)}: ${opts.fmt ? opts.fmt(p.value) : p.value}</title></circle>`;
    });

    el.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" class="chart-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--violet-400)" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="var(--violet-400)" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${grid}
        <path d="${area}" fill="url(#${uid})"/>
        <path d="${path}" class="ch-line" pathLength="1"/>
        ${dots}
        ${xlabels}
      </svg>`;
  }

  /* ---------- Круговой (donut) ---------- */
  // segments: [{ label, value, color }]
  function donut(el, segments, opts) {
    opts = opts || {};
    el.innerHTML = "";
    const data = segments.filter((s) => s.value > 0);
    const total = data.reduce((a, s) => a + s.value, 0);
    if (!total) { el.innerHTML = `<div class="empty">Нет данных.</div>`; return; }

    const size = 200, cx = size / 2, cy = size / 2, r = 78, sw = 26;
    const C = 2 * Math.PI * r;
    let offset = 0;
    let arcs = "";
    data.forEach((s) => {
      const frac = s.value / total;
      const len = frac * C;
      arcs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="${s.color}" stroke-width="${sw}"
        stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}"
        stroke-dashoffset="${(-offset).toFixed(2)}"
        transform="rotate(-90 ${cx} ${cy})" class="ch-arc">
        <title>${esc(s.label)}: ${s.value} (${Math.round(frac * 100)}%)</title></circle>`;
      offset += len;
    });

    const legend = data.map((s) =>
      `<span class="legend-item"><i style="background:${s.color}"></i>${esc(s.label)} <b>${s.value}</b></span>`
    ).join("");

    el.innerHTML = `
      <div class="donut-wrap">
        <svg viewBox="0 0 ${size} ${size}" class="donut-svg">
          ${arcs}
          <text x="${cx}" y="${cy - 4}" class="donut-center" text-anchor="middle">${opts.centerTop || total}</text>
          <text x="${cx}" y="${cy + 16}" class="donut-sub" text-anchor="middle">${esc(opts.centerSub || "")}</text>
        </svg>
        <div class="donut-legend">${legend}</div>
      </div>`;
  }

  /* ---------- Столбики ---------- */
  // items: [{ label, value, sub }]
  function bars(el, items, opts) {
    opts = opts || {};
    el.innerHTML = "";
    if (!items.length) { el.innerHTML = `<div class="empty">Нет данных.</div>`; return; }
    const max = Math.max(...items.map((i) => i.value), 1);
    el.innerHTML = `<div class="bars">` + items.map((it) => {
      const h = Math.max(3, (it.value / max) * 100);
      return `<div class="bars__item">
        <span class="bars__val">${it.value ? (opts.fmt ? opts.fmt(it.value) : it.value) : ""}</span>
        <div class="bars__track"><span class="bars__fill" style="height:${h}%"></span></div>
        <span class="bars__label">${esc(it.label)}</span>
      </div>`;
    }).join("") + `</div>`;
  }

  return { line, donut, bars };
})();
