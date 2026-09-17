(() => {
  "use strict";
  const buttons = [...document.querySelectorAll("[data-plan-id]")];
  const status = document.getElementById("checkout-status");
  const retry = document.getElementById("checkout-retry");
  if (!buttons.length || !status || !retry || !window.crypto?.randomUUID) return;
  const supportNote = document.getElementById("checkout-support-note");
  if (supportNote) supportNote.hidden = true;
  let busy = false;
  let selected = null;
  let retryTimer;
  const storageKey = "nour-checkout-attempt";
  const messages = {
    INVALID_PLAN_OR_BODY: "Não foi possível reconhecer o plano. Recarregue a página e tente novamente.",
    CONFIGURATION_MISSING: "O checkout de testes ainda não está configurado. Tente novamente mais tarde.",
    CONFIGURATION_INVALID: "O checkout de testes está temporariamente indisponível.",
    SANDBOX_ONLY: "O checkout de testes está temporariamente indisponível.",
    SERVICE_UNAVAILABLE: "Não foi possível concluir a solicitação. Tente novamente com segurança.",
    GATEWAY_REJECTED: "O PagBank não aceitou a solicitação. Aguarde alguns segundos e tente novamente.",
    GATEWAY_UNCERTAIN: "Ainda não foi possível confirmar a criação do checkout. Verifique a mesma solicitação novamente. Uma nova compra não será criada.",
    CHECKOUT_IN_PROGRESS: "Seu checkout está sendo preparado. Aguarde alguns segundos e verifique novamente.",
    RATE_LIMITED: "Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.",
    RETRY_LATER: "Aguarde alguns segundos antes de tentar novamente.",
    CHECKOUT_CONFLICT: "Já existe uma solicitação para outro plano nesta sessão. Selecione o plano anterior para retomá-la.",
    CHECKOUT_EXPIRED: "Este checkout venceu. A solicitação precisa ser conferida antes de iniciar outra compra.",
    CHECKOUT_REVIEW_REQUIRED: "Sua solicitação precisa ser conferida. O checkout permanece suspenso.",
    RETRY_EXHAUSTED: "O limite de tentativas desta solicitação foi atingido. Tente novamente após a conferência do atendimento.",
    SESSION_REQUIRED: "Permita cookies deste site para continuar com segurança.",
    SESSION_EXPIRED: "Sua sessão expirou. A solicitação anterior precisa ser conferida antes de uma nova compra.",
  };
  function say(message) { status.textContent = message; status.focus({ preventScroll: true }); }
  function keyFor(planId) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey));
      if (saved?.planId === planId && /^[a-f0-9-]{36}$/i.test(saved.key)) return saved.key;
    } catch { /* A unicidade no servidor continua protegendo a sessão. */ }
    const key = crypto.randomUUID();
    try { sessionStorage.setItem(storageKey, JSON.stringify({ planId, key })); } catch { /* Sem segredos. */ }
    return key;
  }
  async function post(path, body, extra = {}) {
    const response = await fetch(path, {
      method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
      headers: { "Content-Type": "application/json", ...extra },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  }
  function paymentUrl(value) {
    try {
      const url = new URL(value);
      if (url.protocol === "https:" && url.hostname === "sandbox.pagamento.pagseguro.uol.com.br"
        && !url.username && !url.password && !url.port && !url.hash
        && url.pathname === "/pagamento" && [...url.searchParams.keys()].length === 1
        && /^[a-zA-Z0-9-]{1,128}$/.test(url.searchParams.get("code") || "")) return url.href;
    } catch { /* URL inválida bloqueada. */ }
    return null;
  }
  async function run(planId) {
    const session = await post("/api/checkout-session", {});
    if (!session.response.ok) return session;
    return post("/api/checkouts", { planId }, { "Idempotency-Key": keyFor(planId) });
  }
  async function start(planId) {
    if (busy) return;
    busy = true;
    selected = planId;
    clearTimeout(retryTimer);
    retry.hidden = true;
    buttons.forEach(button => { button.disabled = true; });
    status.setAttribute("aria-busy", "true");
    say("Preparando seu checkout de testes…");
    let delay = 0;
    let allowRetry = true;
    let verify = false;
    try {
      // Serializa também abas da mesma origem quando Web Locks está disponível.
      const { response, data } = navigator.locks
        ? await navigator.locks.request("nour-checkout", () => run(planId)) : await run(planId);
      delay = Math.min(60, Math.max(0, Number(response.headers.get("Retry-After")) || 0));
      if (response.ok && response.status !== 202 && data.mode === "mock" && data.checkoutUrl === null) {
        say("Simulação concluída. Seu pedido de teste foi registrado como pendente. Nenhuma cobrança foi feita.");
        allowRetry = false;
      } else if (response.ok && response.status !== 202 && data.mode === "sandbox") {
        const url = paymentUrl(data.checkoutUrl);
        if (!url) throw new Error("UNSAFE_REDIRECT");
        say("Checkout pronto. Redirecionando para o PagBank Sandbox…");
        window.location.assign(url);
        allowRetry = false;
      } else {
        verify = response.status === 202;
        say(messages[data.error] || "O checkout não está disponível agora. Tente novamente com segurança.");
        allowRetry = !["SESSION_EXPIRED", "CHECKOUT_EXPIRED", "CHECKOUT_REVIEW_REQUIRED", "RETRY_EXHAUSTED"].includes(data.error);
      }
    } catch {
      say("Não foi possível confirmar a resposta. Tente novamente para retomar a mesma solicitação.");
    } finally {
      busy = false;
      status.removeAttribute("aria-busy");
      buttons.forEach(button => { button.disabled = false; });
      if (allowRetry) {
        retry.textContent = verify ? "Verificar solicitação" : "Tentar novamente";
        retry.hidden = false;
        retry.disabled = delay > 0;
        if (delay) retryTimer = setTimeout(() => { retry.disabled = false; }, delay * 1000);
      }
    }
  }
  buttons.forEach(button => {
    button.disabled = false;
    button.addEventListener("click", () => start(button.dataset.planId));
  });
  retry.addEventListener("click", () => { if (selected) void start(selected); });
  window.addEventListener("pageshow", () => {
    if (!busy) buttons.forEach(button => { button.disabled = false; });
  });
})();
