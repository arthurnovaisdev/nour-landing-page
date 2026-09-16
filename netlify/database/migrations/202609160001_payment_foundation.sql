-- Estrutura não aplicada. Sem cartão, payload bruto ou segredos.
-- A aplicação futura deve usar transações e consultas parametrizadas.
CREATE TABLE nour_orders (
  id uuid PRIMARY KEY,
  public_code text NOT NULL UNIQUE CHECK (public_code ~ '^NOUR-[A-F0-9]{24}$'),
  environment text NOT NULL CHECK (environment IN ('sandbox', 'production')),
  plan_id text NOT NULL CHECK (plan_id IN ('mensal', 'semestral', 'anual')),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  duration_months integer NOT NULL CHECK (duration_months IN (1, 6, 12)),
  currency text NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  policy_version text NOT NULL DEFAULT '2026-09-16',
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'WAITING', 'IN_ANALYSIS', 'PAID', 'DECLINED',
    'CANCELED', 'EXPIRED', 'REFUNDED', 'CHARGEBACK'
  )),
  checkout_id text,
  provider_order_id text,
  charge_id text,
  paid_cents integer NOT NULL DEFAULT 0 CHECK (paid_cents >= 0),
  refunded_cents integer NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0),
  disputed boolean NOT NULL DEFAULT false,
  review_required boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  verification_source text CHECK (verification_source = 'PAGBANK_API'),
  paid_at timestamptz,
  checkout_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  UNIQUE (environment, checkout_id),
  UNIQUE (environment, charge_id),
  CHECK (checkout_expires_at > created_at),
  CHECK ((plan_id = 'mensal' AND duration_months = 1)
    OR (plan_id = 'semestral' AND duration_months = 6)
    OR (plan_id = 'anual' AND duration_months = 12)),
  CHECK (refunded_cents <= paid_cents),
  CHECK (status <> 'PAID' OR (
    checkout_id IS NOT NULL AND charge_id IS NOT NULL
    AND paid_at IS NOT NULL AND verified_at IS NOT NULL
    AND verification_source IS NOT NULL AND verification_source = 'PAGBANK_API'
    AND paid_cents = amount_cents
  )),
  CHECK (status <> 'REFUNDED' OR (refunded_cents > 0 AND refunded_cents = paid_cents)),
  CHECK (status <> 'CHARGEBACK' OR disputed)
);
CREATE INDEX nour_orders_reconcile ON nour_orders (status, verified_at);

-- Código público não autentica; cookie de sessão não vai à URL.
CREATE TABLE nour_order_sessions (
  session_hash text PRIMARY KEY CHECK (session_hash ~ '^[a-f0-9]{64}$'),
  order_id uuid NOT NULL REFERENCES nour_orders(id),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

-- Uma tentativa por pedido. UNKNOWN impede recriação cega após timeout.
CREATE TABLE nour_checkout_attempts (
  order_id uuid PRIMARY KEY REFERENCES nour_orders(id),
  idempotency_hash text NOT NULL UNIQUE CHECK (idempotency_hash ~ '^[a-f0-9]{64}$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  provider_idempotency_key uuid NOT NULL UNIQUE,
  state text NOT NULL DEFAULT 'RESERVED' CHECK (
    state IN ('RESERVED', 'CREATING', 'CREATED', 'UNKNOWN', 'FAILED')
  ),
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Inbox autenticada: apenas identificadores e digest, sem corpo bruto.
CREATE TABLE nour_payment_events (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES nour_orders(id),
  environment text NOT NULL CHECK (environment IN ('sandbox', 'production')),
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  resource_id text NOT NULL CHECK (length(resource_id) BETWEEN 1 AND 100),
  auth_scheme text NOT NULL CHECK (auth_scheme IN ('ORDER_SHA256', 'NOTIFICATION_ECDSA')),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (environment, payload_sha256)
);

CREATE TABLE nour_jobs (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES nour_orders(id),
  kind text NOT NULL CHECK (kind IN ('RECONCILE', 'MANUAL_REVIEW', 'MANUAL_REMOVE')),
  dedupe_key text NOT NULL UNIQUE,
  state text NOT NULL DEFAULT 'READY' CHECK (state IN ('READY', 'RUNNING', 'DONE', 'DEAD')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  last_error_code text CHECK (last_error_code ~ '^[A-Z0-9_]{1,60}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX nour_jobs_ready ON nour_jobs (next_attempt_at) WHERE state = 'READY';

CREATE TABLE nour_vip_access (
  order_id uuid PRIMARY KEY REFERENCES nour_orders(id),
  state text NOT NULL DEFAULT 'WAITING_MANUAL' CHECK (
    state IN ('WAITING_MANUAL', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED')
  ),
  granted_at timestamptz,
  expires_at timestamptz,
  granted_by text,
  removed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((granted_at IS NULL AND expires_at IS NULL AND granted_by IS NULL)
    OR (granted_at IS NOT NULL AND expires_at IS NOT NULL AND granted_by IS NOT NULL
      AND expires_at > granted_at)),
  CHECK (state <> 'ACTIVE' OR granted_at IS NOT NULL)
);

CREATE TABLE nour_order_audit (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES nour_orders(id),
  actor_id text NOT NULL,
  action_code text NOT NULL CHECK (action_code ~ '^[A-Z0-9_]{1,60}$'),
  order_version bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Configurar papéis separados da aplicação/migração antes de conectar o banco.
REVOKE ALL ON nour_orders, nour_order_sessions, nour_checkout_attempts,
  nour_payment_events, nour_jobs, nour_vip_access, nour_order_audit FROM PUBLIC;
