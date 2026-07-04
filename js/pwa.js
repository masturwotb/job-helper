/* ============================================================
   PWA: регистрация service worker, проверка и установка
   обновлений по сети, вывод версии в интерфейс.
   ============================================================ */
(function () {
  "use strict";

  const info = window.APP_INFO || { version: "?", label: () => "?", short: () => "?", build: "" };

  // --- Вывод версии в UI ---
  function paintVersion() {
    const chip = document.getElementById("app-version-chip");
    if (chip) chip.textContent = info.short();
    const ver = document.getElementById("about-version");
    if (ver) ver.textContent = info.label();
    const build = document.getElementById("about-build");
    if (build) build.textContent = "сборка " + (info.build || "—");
    const name = document.getElementById("about-name");
    if (name) name.textContent = info.name || "Трекер выработки";
  }

  function setStatus(text) {
    const el = document.getElementById("about-update-status");
    if (el) el.textContent = text;
  }

  // --- Тост обновления ---
  function showUpdateToast(reg) {
    if (document.getElementById("update-toast")) return;
    const toast = document.createElement("div");
    toast.id = "update-toast";
    toast.className = "toast";
    toast.innerHTML = `
      <span class="toast__text">Доступно обновление приложения</span>
      <button class="btn btn--primary btn--sm" id="toast-update">Обновить</button>
      <button class="toast__close" id="toast-later">Позже</button>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("is-open"));

    document.getElementById("toast-update").addEventListener("click", () => {
      const waiting = reg.waiting;
      if (waiting) waiting.postMessage({ type: "SKIP_WAITING" });
    });
    document.getElementById("toast-later").addEventListener("click", () => {
      toast.classList.remove("is-open");
      setTimeout(() => toast.remove(), 300);
    });
  }

  const canUseSW =
    "serviceWorker" in navigator &&
    (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1");

  let registration = null;

  async function register() {
    if (!canUseSW) {
      setStatus("Обновления по сети заработают после публикации приложения онлайн (сейчас запущено локально).");
      wireCheckButton(false);
      return;
    }
    try {
      registration = await navigator.serviceWorker.register("sw.js");
      setStatus("Установлена версия " + info.label() + ". Обновления загружаются автоматически.");
      wireCheckButton(true);

      // новое обновление найдено
      registration.addEventListener("updatefound", () => {
        const nw = registration.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            setStatus("Найдено обновление — нажми «Обновить».");
            showUpdateToast(registration);
          }
        });
      });

      // при смене активного worker — перезагружаем страницу на новую версию
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        location.reload();
      });

      // если уже есть ожидающий worker (обновление скачалось до открытия)
      if (registration.waiting && navigator.serviceWorker.controller) showUpdateToast(registration);

      // периодическая проверка обновлений (раз в 30 минут)
      setInterval(() => registration && registration.update().catch(() => {}), 30 * 60 * 1000);
    } catch (err) {
      console.error("SW register failed", err);
      setStatus("Не удалось включить обновления: " + (err && err.message ? err.message : err));
      wireCheckButton(false);
    }
  }

  function wireCheckButton(online) {
    const btn = document.getElementById("about-check");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      if (!online || !registration) {
        setStatus("Проверка доступна только в онлайн-версии приложения.");
        return;
      }
      setStatus("Проверяю обновления…");
      try {
        await registration.update();
        setTimeout(() => {
          if (!registration.waiting && !registration.installing) {
            setStatus("У тебя последняя версия — " + info.label() + ".");
          }
        }, 1500);
      } catch (e) {
        setStatus("Ошибка проверки: " + (e && e.message ? e.message : e));
      }
    });
  }

  window.addEventListener("load", () => {
    paintVersion();
    register();
  });
})();
