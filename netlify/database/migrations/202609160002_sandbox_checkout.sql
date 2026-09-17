-- Prompt 5. Extensão aditiva; aplicar após 202609160001 em banco Sandbox isolado.
ALTER TABLE nour_orders ADD COLUMN plan_name text;
ALTER TABLE nour_orders ADD COLUMN plan_description text;
ALTER TABLE nour_orders ADD COLUMN gateway_mode text NOT NULL DEFAULT 'sandbox'
  CHECK (gateway_mode IN ('sandbox', 'mock'));
ALTER TABLE nour_orders ADD COLUMN checkout_url text;
ALTER TABLE nour_orders ADD CONSTRAINT nour_mock_has_no_gateway
  CHECK (gateway_mode <> 'mock' OR (checkout_id IS NULL AND checkout_url IS NULL));

CREATE TABLE nour_checkout_clients (
  session_hash text PRIMARY KEY CHECK (session_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE nour_checkout_attempts ADD COLUMN session_hash text UNIQUE
  REFERENCES nour_checkout_clients(session_hash);
ALTER TABLE nour_checkout_attempts ADD COLUMN retry_count integer NOT NULL DEFAULT 0
  CHECK (retry_count BETWEEN 0 AND 3);
ALTER TABLE nour_checkout_attempts ADD COLUMN last_error_code text
  CHECK (last_error_code IN ('GATEWAY_REJECTED', 'GATEWAY_UNCERTAIN'));
ALTER TABLE nour_checkout_attempts ADD COLUMN retry_after timestamptz;

-- Contadores compartilhados pelas instâncias. IP somente em HMAC, sem valor bruto.
CREATE TABLE nour_checkout_limits (
  bucket_key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL CHECK (hits > 0)
);
CREATE INDEX nour_checkout_limits_cleanup ON nour_checkout_limits (window_start);
REVOKE ALL ON nour_checkout_clients, nour_checkout_limits FROM PUBLIC;


-- O snapshot desta política não permite alteração de preço por entrada externa.
ALTER TABLE nour_orders ADD CONSTRAINT nour_checkout_catalog_amount
  CHECK ((plan_id = 'mensal' AND amount_cents = 10000)
    OR (plan_id = 'semestral' AND amount_cents = 50000)
    OR (plan_id = 'anual' AND amount_cents = 80000));
ALTER TABLE nour_orders ADD CONSTRAINT nour_checkout_names
  CHECK ((plan_name IS NULL OR length(plan_name) BETWEEN 1 AND 100)
    AND (plan_description IS NULL OR length(plan_description) BETWEEN 1 AND 255));
