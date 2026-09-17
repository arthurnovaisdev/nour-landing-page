import { randomUUID } from "node:crypto";
import { CheckoutRepository } from "./repository.mjs";
import { CheckoutError } from "./input.mjs";
import { canOpenPostPayment } from "./policy.mjs";

export function eligible(order, now) {
  return !order.reconciliation_pending && !order.superseded && canOpenPostPayment({
    status: order.status, verificationSource: order.verification_source,
    checkoutId: order.checkout_id, chargeId: order.charge_id,
    amountCents: order.amount_cents, paidCents: order.paid_cents, currency: order.currency,
    refundedCents: order.refunded_cents, disputed: order.disputed, reviewRequired: order.review_required,
    paidAt: order.paid_at && new Date(order.paid_at), verifiedAt: order.verified_at && new Date(order.verified_at),
  }, now);
}
export class PaymentRepository extends CheckoutRepository {
  async ingest(resource, digest, scheme) {
    return this.transaction(async db => {
      const found = await db.query("SELECT * FROM nour_orders WHERE id=$1 AND environment='sandbox' AND gateway_mode='sandbox' FOR UPDATE", [resource.reference]);
      const order = found.rows[0];
      if (!order?.checkout_id) throw new CheckoutError("ORDER_NOT_READY", 503, 10);
      if ((resource.resourceId.startsWith("CHEC_") && resource.resourceId !== order.checkout_id)
        || (resource.origin === "CHECKOUT" && resource.product && resource.product !== order.checkout_id)
        || (resource.origin === "ORDER" && resource.product && resource.product !== resource.resourceId))
        throw new CheckoutError("INVALID_IDENTIFIERS");
      const eventId = randomUUID();
      const inserted = await db.query(`INSERT INTO nour_payment_events
        (id,order_id,environment,payload_sha256,resource_id,auth_scheme) VALUES ($1,$2,'sandbox',$3,$4,$5)
        ON CONFLICT (environment,payload_sha256) DO NOTHING RETURNING id`,
        [eventId, order.id, digest, resource.resourceId, scheme]);
      if (!inserted.rows.length) return order.id;
      const table = resource.chargeback ? "nour_chargebacks" : resource.resourceId.startsWith("ORDE_") ? "nour_provider_orders" : null;
      if (table) {
        const linked = await db.query(`INSERT INTO ${table} (provider_id,order_id) VALUES ($1,$2)
          ON CONFLICT (provider_id) DO UPDATE SET provider_id=EXCLUDED.provider_id RETURNING order_id`, [resource.resourceId, order.id]);
        if (linked.rows[0].order_id !== order.id) throw new CheckoutError("INVALID_IDENTIFIERS");
      }
      await db.query(`UPDATE nour_orders SET reconciliation_pending=true,version=version+1,updated_at=$2 WHERE id=$1`, [order.id, this.clock()]);
      await db.query(`INSERT INTO nour_jobs (id,order_id,kind,dedupe_key,event_id,next_attempt_at) VALUES ($1,$2,'RECONCILE',$3,$4,$5)`,
        [randomUUID(), order.id, "event:" + eventId, eventId, this.clock()]);
      // Autenticidade não concede acesso. Suspensão preventiva até a consulta financeira.
      if (resource.chargeback) await this.suspend(db, order.id, "DISPUTE_NOTIFICATION");
      await this.audit(db, order.id, "WEBHOOK_ACCEPTED");
      return order.id;
    });
  }
  async suspend(db, orderId, code) {
    const access = await db.query(`UPDATE nour_vip_access SET state='SUSPENDED',updated_at=$2
      WHERE order_id=$1 AND state='ACTIVE' RETURNING order_id`, [orderId, this.clock()]);
    if (access.rows.length) await db.query(`INSERT INTO nour_jobs (id,order_id,kind,dedupe_key,last_error_code)
      VALUES ($1,$2,'MANUAL_REMOVE',$3,$4) ON CONFLICT (dedupe_key) DO NOTHING`,
      [randomUUID(), orderId, "remove:" + orderId, code]);
  }
  async orderForSession(sessionHash) {
    return this.transaction(async db => {
      const result = await db.query(`SELECT o.*,a.state FROM nour_order_sessions s
        JOIN nour_checkout_clients c USING (session_hash) JOIN nour_orders o ON o.id=s.order_id
        JOIN nour_checkout_attempts a ON a.order_id=o.id
        WHERE s.session_hash=$1 AND s.expires_at>$2 AND c.expires_at>$2`, [sessionHash, this.clock()]);
      if (!result.rows.length) throw new CheckoutError("SESSION_UNAVAILABLE", 401);
      return result.rows[0];
    });
  }
  async enqueue(orderId, force = false) {
    return this.transaction(async db => {
      const { rows } = await db.query("SELECT * FROM nour_orders WHERE id=$1 FOR UPDATE", [orderId]);
      const order = rows[0];
      if (!order || order.gateway_mode !== "sandbox" || !order.checkout_id) return;
      const jobs = await db.query("SELECT id FROM nour_jobs WHERE order_id=$1 AND kind='RECONCILE' AND state IN ('READY','RUNNING') LIMIT 1", [orderId]);
      if (jobs.rows.length) return;
      if (!force && order.verified_at && this.clock() - new Date(order.verified_at) < 60000) return;
      await db.query("UPDATE nour_orders SET reconciliation_pending=true,version=version+1 WHERE id=$1", [orderId]);
      await db.query(`INSERT INTO nour_jobs (id,order_id,kind,dedupe_key,next_attempt_at) VALUES ($1,$2,'RECONCILE',$3,$4)`,
        [randomUUID(), orderId, "refresh:" + randomUUID(), this.clock()]);
    });
  }
  async claim(orderId) {
    return this.transaction(async db => {
      const now = this.clock();
      const result = await db.query(`SELECT * FROM nour_jobs WHERE kind='RECONCILE'
        AND ($1::uuid IS NULL OR order_id=$1) AND
        ((state='READY' AND next_attempt_at<=$2) OR (state='RUNNING' AND lease_until<=$2))
        ORDER BY next_attempt_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`, [orderId || null, now]);
      const job = result.rows[0];
      if (!job) return null;
      const leaseToken = randomUUID();
      await db.query(`UPDATE nour_jobs SET state='RUNNING',attempts=attempts+1,lease_until=$2,lease_token=$3,updated_at=$4 WHERE id=$1`,
        [job.id, new Date(now.getTime() + 90000), leaseToken, now]);
      const { rows } = await db.query("SELECT * FROM nour_orders WHERE id=$1", [job.order_id]);
      const orders = await db.query("SELECT provider_id FROM nour_provider_orders WHERE order_id=$1", [job.order_id]);
      const chargebacks = await db.query("SELECT provider_id FROM nour_chargebacks WHERE order_id=$1", [job.order_id]);
      return { ...job, attempts: job.attempts + 1, leaseToken, order: rows[0],
        resources: { orders: orders.rows.map(r => r.provider_id), chargebacks: chargebacks.rows.map(r => r.provider_id) } };
    });
  }
  async finish(job, snapshot, failure) {
    return this.transaction(async db => {
      const now = this.clock();
      // Mesma ordem de locks de ingest: pedido, depois job. Validação do lease após I/O.
      const order = (await db.query("SELECT * FROM nour_orders WHERE id=$1 FOR UPDATE", [job.order_id])).rows[0];
      const lease = (await db.query("SELECT * FROM nour_jobs WHERE id=$1 FOR UPDATE", [job.id])).rows[0];
      if (lease.state !== "RUNNING" || lease.lease_token !== job.leaseToken || new Date(lease.lease_until) <= now) return;
      if (String(order.version) !== String(job.order.version)) failure = "CONCURRENT_UPDATE";
      if (failure) {
        const dead = job.attempts >= 5;
        await db.query(`UPDATE nour_jobs SET state=$2,next_attempt_at=$3,lease_token=NULL,lease_until=NULL,last_error_code=$4,updated_at=$5 WHERE id=$1`,
          [job.id, dead ? "DEAD" : "READY", new Date(now.getTime() + Math.min(300000, 10000 * 2 ** (job.attempts - 1))), failure, now]);
        await this.suspend(db, order.id, failure);
        if (dead || failure === "RECONCILIATION_MISMATCH") {
          await db.query("UPDATE nour_orders SET review_required=true,reconciliation_pending=true,version=version+1 WHERE id=$1", [order.id]);
          await db.query(`INSERT INTO nour_jobs (id,order_id,kind,dedupe_key,last_error_code)
            VALUES ($1,$2,'MANUAL_REVIEW',$3,$4) ON CONFLICT (dedupe_key) DO NOTHING`,
            [randomUUID(), order.id, "reconcile-review:" + order.id, failure]);
        }
        await this.audit(db, order.id, dead ? "RECONCILIATION_EXHAUSTED" : "RECONCILIATION_RETRY");
        return;
      }
      await db.query(`UPDATE nour_jobs SET state='DONE',lease_token=NULL,lease_until=NULL,last_error_code=NULL,updated_at=$2 WHERE id=$1`, [job.id, now]);
      if (job.event_id) await db.query("UPDATE nour_payment_events SET processed_at=$2 WHERE id=$1", [job.event_id, now]);
      const pending = await db.query("SELECT id FROM nour_jobs WHERE order_id=$1 AND kind='RECONCILE' AND state IN ('READY','RUNNING','DEAD') LIMIT 1", [order.id]);
      await db.query(`UPDATE nour_orders SET status=$2,review_required=$3,disputed=$4,checkout_status=$5,
        charge_id=$6,provider_order_id=$7,paid_cents=$8,refunded_cents=$9,paid_at=$10,verified_at=$11,
        verification_source='PAGBANK_API',reconciliation_pending=$12,version=version+1,updated_at=$11 WHERE id=$1`,
        [order.id, snapshot.status, snapshot.review, snapshot.disputed, snapshot.checkoutStatus, snapshot.chargeId,
          snapshot.providerOrderId, snapshot.paidCents, snapshot.refundedCents, snapshot.paidAt,
          snapshot.verifiedAt, pending.rows.length > 0]);
      if (snapshot.status !== "PAID" || snapshot.review || snapshot.disputed || snapshot.refundedCents > 0)
        await this.suspend(db, order.id, "PAYMENT_BLOCKED");
      if (snapshot.status === "PAID" && !snapshot.review && !snapshot.disputed && snapshot.refundedCents === 0)
        await db.query("INSERT INTO nour_vip_access (order_id) VALUES ($1) ON CONFLICT (order_id) DO NOTHING", [order.id]);
      await this.audit(db, order.id, "PAYMENT_RECONCILED");
    });
  }
  async dueOrders() {
    return this.transaction(async db => {
      const now = this.clock();
      // Vencimento da prova também suspende a elegibilidade de um VIP previamente ativo.
      const stale = await db.query(`SELECT o.id FROM nour_orders o JOIN nour_vip_access v ON v.order_id=o.id
        WHERE v.state='ACTIVE' AND (o.verified_at<$1::timestamptz-interval '5 minutes' OR o.reconciliation_pending OR o.review_required) LIMIT 20`, [now]);
      for (const order of stale.rows) await this.suspend(db, order.id, "VERIFICATION_STALE");
      return (await db.query(`SELECT id FROM nour_orders WHERE gateway_mode='sandbox' AND checkout_id IS NOT NULL
        AND (verified_at IS NULL OR verified_at<$1::timestamptz-interval '1 minute')
        AND NOT review_required AND NOT superseded AND status IN ('PENDING','WAITING','IN_ANALYSIS','PAID')
        ORDER BY verified_at NULLS FIRST LIMIT 10`, [now])).rows.map(r => r.id);
    });
  }
  async retry(sessionHash) {
    return this.transaction(async db => {
      const now = this.clock();
      await db.query("SELECT session_hash FROM nour_checkout_clients WHERE session_hash=$1 FOR UPDATE", [sessionHash]);
      const { rows } = await db.query(`SELECT o.* FROM nour_orders o JOIN nour_order_sessions s ON s.order_id=o.id
        WHERE s.session_hash=$1 AND s.expires_at>$2 FOR UPDATE OF o`, [sessionHash, now]);
      const order = rows[0];
      if (!order) throw new CheckoutError("SESSION_UNAVAILABLE", 401);
      if (order.reconciliation_pending || order.review_required || order.disputed || order.paid_cents > 0
        || !order.verified_at || now - new Date(order.verified_at) > 60000
        || !["DECLINED","CANCELED","EXPIRED"].includes(order.status)) throw new CheckoutError("RETRY_NOT_SAFE", 409);
      if (["DECLINED","CANCELED"].includes(order.status) && order.checkout_status === "ACTIVE"
        && new Date(order.checkout_expires_at) > now) return { checkoutUrl: order.checkout_url };
      if (order.checkout_status !== "EXPIRED") throw new CheckoutError("RETRY_NOT_SAFE", 409);
      // Arquiva a tentativa antiga sem apagar evidência. Liquidação tardia gera revisão.
      await db.query("UPDATE nour_orders SET superseded=true,version=version+1 WHERE id=$1", [order.id]);
      await db.query("UPDATE nour_checkout_attempts SET session_hash=NULL WHERE order_id=$1", [order.id]);
      await db.query("DELETE FROM nour_order_sessions WHERE session_hash=$1", [sessionHash]);
      await this.audit(db, order.id, "RETRY_AUTHORIZED");
      return { checkoutUrl: null };
    });
  }
}



