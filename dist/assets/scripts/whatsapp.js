(() => {
  "use strict";

  const config = window.NourConfig;
  if (!config) return;

  const WHATSAPP_NUMBER = config.whatsappNumber;
  const COMMERCIAL_MESSAGE = config.whatsappMessage;

  if (!/^\d{10,15}$/.test(WHATSAPP_NUMBER)) return;

  function createLink(message) {
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }

  window.NourWhatsApp = Object.freeze({ phone: WHATSAPP_NUMBER });

  document.querySelectorAll("[data-whatsapp-commercial]").forEach((link) => {
    link.href = createLink(COMMERCIAL_MESSAGE);
  });
})();
