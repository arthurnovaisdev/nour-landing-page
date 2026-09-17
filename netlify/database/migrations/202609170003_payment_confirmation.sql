-- Prompt 6: inbox durável, fencing de jobs e consulta mínima. Sem payloads/PII.
ALTER TABLE nour_orders ADD COLUMN reconciliation_pending boolean NOT NULL DEFAULT false;
ALTER TABLE nour_orders ADD COLUMN checkout_status text CHECK (checkout_status IN ('ACTIVE','INACTIVE','EXPIRED'));
ALTER TABLE nour_orders ADD COLUMN superseded boolean NOT NULL DEFAULT false;
ALTER TABLE nour_jobs ADD COLUMN lease_token uuid;
ALTER TABLE nour_jobs ADD COLUMN event_id uuid REFERENCES nour_payment_events(id);
CREATE TABLE nour_provider_orders (
  provider_id text PRIMARY KEY CHECK (provider_id ~ '^ORDE_[A-Fa-f0-9-]{36}$'),
  order_id uuid NOT NULL REFERENCES nour_orders(id)
);
CREATE TABLE nour_chargebacks (
  provider_id text PRIMARY KEY CHECK (provider_id ~ '^CBKS_[A-Fa-f0-9-]{36}$'),
  order_id uuid NOT NULL REFERENCES nour_orders(id)
);
CREATE INDEX nour_payment_events_order ON nour_payment_events(order_id);
REVOKE ALL ON nour_provider_orders, nour_chargebacks FROM PUBLIC;
