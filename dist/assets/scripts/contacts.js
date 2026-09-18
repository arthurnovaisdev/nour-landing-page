(() => {
  "use strict";

  const config = window.NourConfig;
  if (!config) return;

  const instagramUrl = config.instagramUrl;
  if (typeof instagramUrl === "string") {
    try {
      const url = new URL(instagramUrl);
      if (url.protocol === "https:" && (url.hostname === "instagram.com" || url.hostname === "www.instagram.com")) {
        document.querySelectorAll("[data-instagram]").forEach((link) => {
          link.href = url.href;
        });
      }
    } catch {
      // Mantém o fallback seguro definido no HTML.
    }
  }

  const contactEmail = config.contactEmail;
  if (typeof contactEmail === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    document.querySelectorAll("[data-contact-email]").forEach((link) => {
      link.href = `mailto:${contactEmail}`;
      link.textContent = `${link.dataset.contactEmailPrefix || ""}${contactEmail}`;
    });
  }
})();
