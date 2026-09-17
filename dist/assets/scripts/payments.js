(() => {
  "use strict";

  const config = window.NourConfig;
  const status = document.querySelector("#plan-links-status");
  const paymentProperties = Object.freeze({
    monthly: "monthlyPaymentUrl",
    semiannual: "semiannualPaymentUrl",
    annual: "annualPaymentUrl",
  });

  function isSafePaymentUrl(value) {
    if (typeof value !== "string" || value.trim() === "") return false;

    try {
      const url = new URL(value);
      return url.protocol === "https:" && (
        url.hostname === "pag.ae" ||
        url.hostname === "pagbank.com.br" ||
        url.hostname.endsWith(".pagbank.com.br") ||
        url.hostname === "pagseguro.com.br" ||
        url.hostname.endsWith(".pagseguro.com.br") ||
        url.hostname === "pagseguro.uol.com.br" ||
        url.hostname.endsWith(".pagseguro.uol.com.br")
      );
    } catch {
      return false;
    }
  }

  if (!config || !status) return;

  let availablePlans = 0;

  document.querySelectorAll("[data-payment-plan]").forEach((link) => {
    const property = paymentProperties[link.dataset.paymentPlan];
    const paymentUrl = property ? config[property] : null;

    if (isSafePaymentUrl(paymentUrl)) {
      link.href = paymentUrl;
      link.removeAttribute("aria-disabled");
      link.classList.remove("is-disabled");
      availablePlans += 1;
      return;
    }

    link.href = "#plan-links-status";
    link.setAttribute("aria-disabled", "true");
    link.classList.add("is-disabled");
    link.addEventListener("click", (event) => {
      event.preventDefault();
      status.focus({ preventScroll: true });
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      status.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    });
  });

  if (availablePlans === 3) {
    status.textContent = "Você será direcionado ao ambiente seguro do PagBank para concluir o pagamento. A Nour confere a confirmação no PagBank e libera o acesso ao grupo VIP.";
  } else if (availablePlans > 0) {
    status.textContent = "Alguns Links de Pagamento oficiais ainda estão pendentes. Planos indisponíveis permanecem bloqueados; os demais direcionam ao ambiente seguro do PagBank.";
  }
})();
