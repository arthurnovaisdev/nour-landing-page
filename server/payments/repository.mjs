import { randomUUID, randomBytes } from "node:crypto";
import { CheckoutError, hash, SESSION_SECONDS } from "./input.mjs";
import { checkoutExpiresAt, getPlan } from "./policy.mjs";

export class CheckoutRepository {
  constructor(pool, clock = () => new Date()) { this.pool = pool; this.clock = clock; }
  async transaction(work) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL statement_timeout = '4000ms'");
      await client.query("SET LOCAL lock_timeout = '3000ms'");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { /* Não expor erro/DSN. */ }
      throw error;
    } finally { client.release(); }
  }
  async limit(route, ipHash, sessionHash) {
    const now = this.clock();
    const buckets = [[route + ":global", route === "session" ? 200 : 100],
      [route + ":ip:" + ipHash, 20]];
    if (sessionHash) buckets.push([route + ":session:" + sessionHash, 5]);
    const allowed = await this.transaction(async db => {
      let allowed = true;
      // Ordem fixa evita deadlock. UPSERT serializa concorrência entre instâncias.
      for (const [key, max] of buckets) {
        const { rows } = await db.query(`INSERT INTO nour_checkout_limits (bucket_key, window_start, hits)
          VALUES ($1, $2, 1) ON CONFLICT (bucket_key) DO UPDATE SET
          hits = CASE WHEN nour_checkout_limits.window_start <= $2::timestamptz - interval '60 seconds'
            THEN 1 ELSE nour_checkout_limits.hits + 1 END,
          window_start = CASE WHEN nour_checkout_limits.window_start <= $2::timestamptz - interval '60 seconds'
            THEN $2 ELSE nour_checkout_limits.window_start END RETURNING hits`, [key, now]);
        if (rows[0].hits > max) return false;
      }
      await db.query(`DELETE FROM nour_checkout_limits WHERE bucket_key IN
        (SELECT bucket_key FROM nour_checkout_limits WHERE window_start < $1::timestamptz - interval '1 day' LIMIT 100)`, [now]);
      return allowed; // Commit inclusive 429; rollback não pode zerar contadores.
    });
    if (!allowed) throw new CheckoutError("RATE_LIMITED", 429, 60);
  }
  async session(sessionHash, freshHash) {
    const now = this.clock();
    return this.transaction(async db => {
      if (sessionHash) {
        const { rows } = await db.query("SELECT expires_at FROM nour_checkout_clients WHERE session_hash = $1", [sessionHash]);
        if (!rows.length || new Date(rows[0].expires_at) <= now) throw new CheckoutError("SESSION_EXPIRED", 401);
        return false;
      }
      await db.query("INSERT INTO nour_checkout_clients (session_hash, expires_at) VALUES ($1, $2)",
        [freshHash, new Date(now.getTime() + SESSION_SECONDS * 1000)]);
      return true;
    });
  }
  async reserve({ sessionHash, idempotencyKey, planId, mode }) {
    const now = this.clock();
    const requestHash = hash(mode + ":" + planId);
    const idempotencyHash = hash(sessionHash + ":" + idempotencyKey.toLowerCase());
    return this.transaction(async db => {
      // Uma tentativa por sessão, mesmo quando o navegador troca a chave.
      const client = await db.query("SELECT expires_at FROM nour_checkout_clients WHERE session_hash = $1 FOR UPDATE", [sessionHash]);
      if (!client.rows.length || new Date(client.rows[0].expires_at) <= now) throw new CheckoutError("SESSION_EXPIRED", 401);
      const found = await db.query(`SELECT o.*, a.state, a.request_hash, a.lease_until, a.retry_after, a.retry_count
        FROM nour_checkout_attempts a JOIN nour_orders o ON o.id = a.order_id
        WHERE a.session_hash = $1 FOR UPDATE OF a, o`, [sessionHash]);
      if (found.rows.length) {
        const order = found.rows[0];
        if (order.request_hash !== requestHash) throw new CheckoutError("CHECKOUT_CONFLICT", 409);
        if (order.state === "CREATING" && new Date(order.lease_until) <= now) {
          await this.uncertain(db, order.id, now);
          order.state = "UNKNOWN";
        }
        if (order.state === "UNKNOWN" || order.state === "CREATING") return { order, create: false };
        if (new Date(order.checkout_expires_at) <= now) throw new CheckoutError("CHECKOUT_EXPIRED", 409);
        if (order.state === "CREATED") return { order, create: false };
        if (order.state === "FAILED") {
          if (order.retry_count >= 3) throw new CheckoutError("RETRY_EXHAUSTED", 409);
          if (new Date(order.retry_after) > now) throw new CheckoutError("RETRY_LATER", 429,
            Math.max(1, Math.ceil((new Date(order.retry_after) - now) / 1000)));
          await db.query(`UPDATE nour_checkout_attempts SET state = 'CREATING', retry_count = retry_count + 1,
            lease_until = $2, updated_at = $3 WHERE order_id = $1`,
            [order.id, new Date(now.getTime() + 30000), now]);
          await this.audit(db, order.id, "CHECKOUT_RETRY");
          return { order: { ...order, state: "CREATING" }, create: true };
        }
        throw new CheckoutError("CHECKOUT_REVIEW_REQUIRED", 409);
      }
      const plan = getPlan(planId);
      const order = {
        id: randomUUID(), public_code: "NOUR-" + randomBytes(12).toString("hex").toUpperCase(),
        plan_id: planId, amount_cents: plan.amountCents, duration_months: plan.months,
        plan_name: plan.name, plan_description: plan.description, currency: plan.currency,
        gateway_mode: mode, status: "PENDING", state: "CREATING",
        checkout_expires_at: checkoutExpiresAt(now), created_at: now,
      };
      await db.query(`INSERT INTO nour_orders (id, public_code, environment, plan_id, amount_cents,
        duration_months, currency, checkout_expires_at, created_at, plan_name, plan_description, gateway_mode)
        VALUES ($1,$2,'sandbox',$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [order.id, order.public_code, planId, plan.amountCents, plan.months, plan.currency,
          order.checkout_expires_at, now, plan.name, plan.description, mode]);
      await db.query(`INSERT INTO nour_order_sessions (session_hash, order_id, expires_at)
        VALUES ($1,$2,$3)`, [sessionHash, order.id, client.rows[0].expires_at]);
      await db.query(`INSERT INTO nour_checkout_attempts (order_id, idempotency_hash, request_hash,
        provider_idempotency_key, state, lease_until, session_hash)
        VALUES ($1,$2,$3,$4,'CREATING',$5,$6)`,
        [order.id, idempotencyHash, requestHash, randomUUID(), new Date(now.getTime() + 30000), sessionHash]);
      await this.audit(db, order.id, "CHECKOUT_RESERVED");
      return { order, create: true };
    });
  }
  async audit(db, orderId, code) {
    await db.query(`INSERT INTO nour_order_audit (id, order_id, actor_id, action_code, order_version)
      SELECT $1,id,'CHECKOUT_SERVICE',$3,version FROM nour_orders WHERE id = $2`, [randomUUID(), orderId, code]);
  }
  async uncertain(db, orderId, now) {
    await db.query(`UPDATE nour_checkout_attempts SET state = 'UNKNOWN', last_error_code = 'GATEWAY_UNCERTAIN',
      updated_at = $2 WHERE order_id = $1 AND state = 'CREATING'`, [orderId, now]);
    await db.query("UPDATE nour_orders SET review_required = true, updated_at = $2 WHERE id = $1", [orderId, now]);
    await db.query(`INSERT INTO nour_jobs (id,order_id,kind,dedupe_key)
      VALUES ($1,$2,'MANUAL_REVIEW',$3) ON CONFLICT (dedupe_key) DO NOTHING`,
      [randomUUID(), orderId, "checkout-uncertain:" + orderId]);
    await this.audit(db, orderId, "CHECKOUT_UNKNOWN");
  }
  async lockClient(db, orderId) {
    await db.query("SELECT c.session_hash FROM nour_checkout_clients c JOIN nour_checkout_attempts a ON a.session_hash = c.session_hash WHERE a.order_id = $1 FOR UPDATE OF c", [orderId]);
  }
  async failed(orderId, code) {
    const now = this.clock();
    return this.transaction(async db => {
      await this.lockClient(db, orderId);
      if (code !== "GATEWAY_REJECTED") return this.uncertain(db, orderId, now);
      await db.query(`UPDATE nour_checkout_attempts SET state = 'FAILED', last_error_code = $2,
        retry_after = $3, updated_at = $4 WHERE order_id = $1 AND state = 'CREATING'`,
        [orderId, code, new Date(now.getTime() + 10000), now]);
      await this.audit(db, orderId, "CHECKOUT_REJECTED");
    });
  }
  async complete(orderId, result) {
    const now = this.clock();
    return this.transaction(async db => {
      await this.lockClient(db, orderId);
      const { rows } = await db.query(`UPDATE nour_orders SET checkout_id = $2, checkout_url = $3,
        updated_at = $4, version = version + 1 WHERE id = $1 RETURNING *`,
        [orderId, result.checkoutId, result.checkoutUrl, now]);
      await db.query(`UPDATE nour_checkout_attempts SET state = 'CREATED', lease_until = NULL,
        last_error_code = NULL, updated_at = $2 WHERE order_id = $1 AND state IN ('CREATING','UNKNOWN')`, [orderId, now]);
      await this.audit(db, orderId, "CHECKOUT_CREATED");
      return { ...rows[0], state: "CREATED" };
    });
  }
}
