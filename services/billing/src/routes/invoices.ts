/**
 * /v1/invoices — invoices + line items + pay.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  listInvoices,
  getInvoice,
  getInvoiceItems,
  payInvoice,
  PayInvoiceSchema,
  type Invoice,
  type InvoiceItem,
} from "../services/invoices.js";
import { previewInvoice, generateInvoice } from "../services/invoices.js";
import { extractJwt } from "../lib/auth.js";

export async function invoiceRoutes(app: FastifyInstance) {
  app.get(
    "/v1/invoices",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const list = await listInvoices(req.user.sub);
      return reply.send({ data: list.map(serialize) });
    },
  );

  app.get(
    "/v1/invoices/:id",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const inv = await getInvoice(req.user.sub, (req.params as { id: string }).id);
      if (!inv) return reply.code(404).send({ error: { message: "Invoice not found" } });
      const items = await getInvoiceItems(inv.id);
      return reply.send({ ...serialize(inv), line_items: items.map(serializeItem) });
    },
  );

  // Preview next invoice for a subscription
  app.get(
    "/v1/invoices/preview",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const q = req.query as { subscriptionId?: string };
      if (!q.subscriptionId) {
        return reply.code(400).send({ error: { message: "subscriptionId is required" } });
      }
      const jwt = extractJwt(req);
      const preview = await previewInvoice(req.user.sub, jwt, q.subscriptionId);
      if (!preview) return reply.code(404).send({ error: { message: "Subscription not found" } });
      return reply.send(previewBigIntsToStrings(preview));
    },
  );

  // Generate the actual invoice (admin / one-off)
  app.post(
    "/v1/invoices/generate",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as { subscriptionId?: string };
      if (!body.subscriptionId) {
        return reply.code(400).send({ error: { message: "subscriptionId is required" } });
      }
      try {
        const jwt = extractJwt(req);
        const inv = await generateInvoice(req.user.sub, jwt, body.subscriptionId);
        if (!inv) return reply.code(404).send({ error: { message: "Subscription not found" } });
        const items = await getInvoiceItems(inv.id);
        return reply.code(201).send({ ...serialize(inv), line_items: items.map(serializeItem) });
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Generate failed" } });
      }
    },
  );

  // Pay an invoice
  app.post(
    "/v1/invoices/:id/pay",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parse = PayInvoiceSchema.safeParse(req.body ?? {});
      if (!parse.success) {
        return reply.code(400).send({ error: { message: "Invalid input" } });
      }
      try {
        const result = await payInvoice(req.user.sub, (req.params as { id: string }).id, parse.data);
        return reply.send({
          payment_id: result.payment.id,
          status: result.payment.status,
          amount_qubic: result.payment.amountQubic.toString(),
          tx_hash: result.payment.txHash,
          invoice_paid: result.invoicePaid,
        });
      } catch (err) {
        return reply.code(400).send({ error: { message: err instanceof Error ? err.message : "Pay failed" } });
      }
    },
  );
}

function serialize(inv: Invoice) {
  return {
    id: inv.id,
    number: inv.number,
    subscription_id: inv.subscriptionId,
    period_index: inv.periodIndex,
    period_start: inv.periodStart.toISOString(),
    period_end: inv.periodEnd.toISOString(),
    status: inv.status,
    subtotal_qubic: inv.subtotalQubic.toString(),
    credit_applied_qubic: inv.creditAppliedQubic.toString(),
    tax_qubic: inv.taxQubic.toString(),
    total_qubic: inv.totalQubic.toString(),
    paid_qubic: inv.paidQubic.toString(),
    due_at: inv.dueAt?.toISOString() ?? null,
    paid_at: inv.paidAt?.toISOString() ?? null,
    voided_at: inv.voidedAt?.toISOString() ?? null,
    created_at: inv.createdAt.toISOString(),
  };
}

function serializeItem(it: InvoiceItem) {
  return {
    id: it.id,
    kind: it.kind,
    description: it.description,
    quantity: it.quantity.toString(),
    unit_price_qubic: it.unitPriceQubic.toString(),
    amount_qubic: it.amountQubic.toString(),
    metadata: it.metadata,
  };
}

function previewBigIntsToStrings<T>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = typeof v === "bigint" ? v.toString() : v;
  }
  return out;
}
