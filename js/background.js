/* ============================================================
   Живой фон: частицы + связи (canvas). Оптимизированная версия v2.
   - батч-отрисовка: 2 fill + 1 stroke на кадр (вместо сотен вызовов)
   - дельта-время, кап DPR, мало частиц
   - пауза при скрытой вкладке и при открытой модалке (window.Background)
   ============================================================ */
(function () {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W = 0, H = 0;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  let particles = [];
  let running = false;
  let pausedByUser = false;   // пауза от модалки
  let last = 0;

  const mouse = { x: -9999, y: -9999, active: false };
  const LINK_DIST = 110;
  const LINK_DIST2 = LINK_DIST * LINK_DIST;

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.max(22, Math.min(48, Math.round((W * H) / 42000)));
    particles = new Array(count).fill(0).map(spawn);
  }

  function spawn() {
    return {
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 16, vy: (Math.random() - 0.5) * 16,
      r: Math.random() * 1.5 + 0.7,
      cyan: Math.random() < 0.5,
    };
  }

  function frame(now) {
    if (!running) return;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    last = now;

    ctx.clearRect(0, 0, W, H);

    // движение
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < 0) { p.x = 0; p.vx = -p.vx; } else if (p.x > W) { p.x = W; p.vx = -p.vx; }
      if (p.y < 0) { p.y = 0; p.vy = -p.vy; } else if (p.y > H) { p.y = H; p.vy = -p.vy; }
      if (mouse.active) {
        const dxm = mouse.x - p.x, dym = mouse.y - p.y;
        const dm2 = dxm * dxm + dym * dym;
        if (dm2 < 19600 && dm2 > 1) {
          const inv = 1 / Math.sqrt(dm2);
          p.x += dxm * inv * 20 * dt; p.y += dym * inv * 20 * dt;
        }
      }
    }

    // связи — один путь, один вызов stroke
    const links = new Path2D();
    let hasLink = false;
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        if (dx * dx + dy * dy < LINK_DIST2) {
          links.moveTo(a.x, a.y); links.lineTo(b.x, b.y); hasLink = true;
        }
      }
    }
    if (hasLink) {
      ctx.strokeStyle = "rgba(150,110,245,0.12)";
      ctx.lineWidth = 1;
      ctx.stroke(links);
    }

    // точки — 2 пути по цвету, 2 вызова fill
    const pV = new Path2D(), pC = new Path2D();
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const path = p.cyan ? pC : pV;
      path.moveTo(p.x + p.r, p.y);
      path.arc(p.x, p.y, p.r, 0, 6.2832);
    }
    ctx.fillStyle = "rgba(168,130,255,0.85)"; ctx.fill(pV);
    ctx.fillStyle = "rgba(90,210,235,0.8)";  ctx.fill(pC);

    requestAnimationFrame(frame);
  }

  function start() {
    if (running || pausedByUser || reduce) return;
    running = true; last = 0;
    requestAnimationFrame(frame);
  }
  function stop() { running = false; }

  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
  window.addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; }, { passive: true });
  window.addEventListener("mouseleave", () => { mouse.active = false; });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); else start(); });

  // Пауза/возобновление снаружи (модалки и т.п.)
  window.Background = {
    pause() { pausedByUser = true; stop(); },
    resume() { pausedByUser = false; start(); },
  };

  resize();
  if (reduce) {
    ctx.fillStyle = "rgba(168,130,255,0.6)";
    for (const p of particles) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill(); }
  } else {
    start();
  }
})();
