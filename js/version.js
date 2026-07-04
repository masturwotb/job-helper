/* ============================================================
   Версия приложения. Единственное место, где меняется версия.
   При выкладке новой версии онлайн — поднимаешь номер здесь и
   в sw.js (CACHE_VERSION), и клиенты автоматически обновятся.
   ============================================================ */
window.APP_INFO = {
  version: "1.0.0",
  channel: "beta",          // beta | rc | stable
  build: "2026-07-04",
  name: "Трекер выработки",

  // Человекочитаемая метка, напр. "бета 1.0.0"
  label() {
    const ch = { beta: "бета", rc: "RC", stable: "" }[this.channel] || this.channel;
    return `${ch} ${this.version}`.trim();
  },
  short() {
    return `v${this.version}${this.channel === "stable" ? "" : "-" + this.channel}`;
  },
};
