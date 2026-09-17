(() => {
  "use strict";
  const title = document.getElementById("payment-title");
  const description = document.getElementById("payment-description");
  const refresh = document.getElementById("payment-refresh");
  const retry = document.getElementById("payment-retry");
  const card = document.querySelector(".payment-card");
  const messages = {
    WAITING: ["Aguardando pagamento", "Seu pedido ainda aguarda confirmação. Se você já pagou, acompanhe a atualização por aqui."],
    IN_ANALYSIS: ["Pagamento em análise", "O PagBank está analisando o pagamento. Aguarde a conclusão antes de tentar pagar novamente."],
    PAID: ["Pagamento confirmado", "O pagamento de teste foi confirmado com segurança. A entrada no VIP depende da conferência e liberação manual; nenhum acesso real será liberado neste ambiente."],
    DECLINED: ["Pagamento recusado", "O pagamento não foi aprovado. Você pode tentar novamente quando a opção abaixo estiver disponível."],
    CANCELED: ["Pagamento cancelado", "Esta tentativa foi cancelada. Você pode tentar novamente quando a opção abaixo estiver disponível."],
    EXPIRED: ["Checkout expirado", "O prazo deste checkout terminou. Use a opção abaixo para iniciar uma nova solicitação após a conferência do pedido anterior."],
    BLOCKED: ["Pagamento em revisão", "Há uma atualização financeira que exige conferência. O acesso está bloqueado. Não faça um novo pagamento para resolver este pedido."],
    TEMPORARY_ERROR: ["Erro temporário", "Não foi possível confirmar o estado do pedido agora. Aguarde e verifique novamente. Nenhum novo pagamento é necessário."],
    SESSION_UNAVAILABLE: ["Sessão indisponível", "Abra esta página no mesmo navegador usado na compra. Se a sessão expirou, o pedido precisa de conferência pelo atendimento; não pague novamente."],
  };
  let busy = false;
  let timer;
  let proofTimer;
  let polls = 0;
  let active = true;
  function render(state, canRetry = false) {
    clearTimeout(proofTimer);
    if (state === "PAID") proofTimer = setTimeout(() => render("TEMPORARY_ERROR"), 60000);
    const copy = messages[state] || messages.TEMPORARY_ERROR;
    title.textContent = copy[0]; description.textContent = copy[1];
    card.dataset.state = state;
    retry.hidden = !canRetry || !["DECLINED","CANCELED","EXPIRED"].includes(state);
  }
  async function check(manual = false) {
    if (busy || !active || document.hidden) return;
    clearTimeout(timer); busy = true;
    refresh.disabled = true; retry.hidden = true;
    if (manual) polls = 0;
    let delay = 15000;
    let again = true;
    try {
      const result = await fetch("/api/orders/status", { credentials: "same-origin", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(25000) });
      const data = await result.json();
      if (result.status === 401) { render("SESSION_UNAVAILABLE"); again = false; }
      else if (!result.ok) {
        render("TEMPORARY_ERROR"); delay = Math.max(15000, Math.min(300000, (Number(result.headers.get("Retry-After")) || 30) * 1000));
      } else { render(data.state, data.canRetry === true); if (data.mode === "mock") again = false; }
    } catch { render("TEMPORARY_ERROR"); delay = 30000; }
    finally {
      busy = false; refresh.disabled = false;
      // Limite de cinco minutos por ciclo. Atualizações param em abas ocultas.
      if (again && ++polls < 20 && active) timer = setTimeout(() => check(), delay);
    }
  }
  refresh.addEventListener("click", () => check(true));
  retry.addEventListener("click", async () => {
    if (busy) return;
    busy = true; clearTimeout(timer); retry.disabled = true; refresh.disabled = true;
    try {
      const result = await fetch("/api/orders/retry", { method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
        headers: { "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(25000) });
      const data = await result.json();
      if (!result.ok) throw Error();
      if (data.checkoutUrl === null) {
        try { sessionStorage.removeItem("nour-checkout-attempt"); } catch { /* Sem credenciais. */ }
        location.assign("/index.html#planos");
      } else {
        const url = new URL(data.checkoutUrl);
        if (url.protocol !== "https:" || url.hostname !== "sandbox.pagamento.pagseguro.uol.com.br"
          || url.username || url.password || url.port || url.hash || url.pathname !== "/pagamento"
          || [...url.searchParams.keys()].length !== 1 || !/^[a-zA-Z0-9-]{1,128}$/.test(url.searchParams.get("code") || "")) throw Error();
        location.assign(url.href);
      }
    } catch { render("TEMPORARY_ERROR"); }
    finally { busy = false; retry.disabled = false; refresh.disabled = false; }
  });
  document.addEventListener("visibilitychange", () => {
    clearTimeout(timer);
    if (!document.hidden) { render("TEMPORARY_ERROR"); void check(); }
  });
  window.addEventListener("pagehide", () => { active = false; clearTimeout(timer); render("TEMPORARY_ERROR"); });
  window.addEventListener("pageshow", () => { active = true; void check(); });
  // Query strings, fragmentos e comprovantes nunca determinam o estado.
  void check();
})();

