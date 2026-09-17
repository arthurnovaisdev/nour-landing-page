(() => {
  "use strict";

  // Configuração pública única do WhatsApp comercial: país + DDD + número, somente dígitos.
  const WHATSAPP_NUMBER = "5577981289835";
  const COMMERCIAL_MESSAGE = "Olá, Samuel. Conheci a Nour pelo site e gostaria de tirar uma dúvida antes de escolher meu plano.";

  function createLink(message) {
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }

  window.NourWhatsApp = Object.freeze({ phone: WHATSAPP_NUMBER });

  document.querySelectorAll("[data-whatsapp-commercial]").forEach((link) => {
    link.href = createLink(COMMERCIAL_MESSAGE);
  });
})();
