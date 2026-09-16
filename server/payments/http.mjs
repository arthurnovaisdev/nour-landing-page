// Esta etapa não lê credenciais, acessa rede ou aceita pagamentos.
// Bloqueio intencional em código: uma variável de ambiente não pode ativá-la.
export function unavailable(request, allowedMethod) {
  const methodAllowed = request.method === allowedMethod;
  return Response.json(
    { error: methodAllowed ? "PAYMENTS_NOT_IMPLEMENTED" : "METHOD_NOT_ALLOWED" },
    {
      status: methodAllowed ? 503 : 405,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        ...(!methodAllowed ? { Allow: allowedMethod } : {}),
      },
    },
  );
}
