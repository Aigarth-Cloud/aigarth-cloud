/**
 * /v1/auth/wallet — public wallet-as-identity sign-up / sign-in.
 *
 *   POST /v1/auth/wallet/start     { address } -> { nonce, message, expiresInSeconds }
 *   POST /v1/auth/wallet/finish    { address, signature, nonce, label? }
 *                                  -> { user, wallet, access_token, refresh_token, expires_at, created }
 *   GET  /v1/auth/wallet/stats     -> aggregate stats for the command centre
 *
 * No auth required for start/finish. stats is public-read so the
 * dashboard /wallet-auth page can poll it without auth dance.
 *
 * The verifier is the format-validated stub in src/lib/qubic.ts.
 * Production should swap to K12 verification before high-value use.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  walletAuthStart,
  walletAuthFinish,
  walletAuthStats,
  WalletStartSchema,
  WalletFinishSchema,
} from "../services/walletAuth.js";
import { loadConfig } from "../config/index.js";
import { hashIp } from "../lib/ids.js";

export async function walletAuthRoutes(app: FastifyInstance) {
  const cfg = loadConfig();

  // ---------- /v1/auth/wallet/start ----------

  app.post("/v1/auth/wallet/start", async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = WalletStartSchema.safeParse(req.body ?? {});
    if (!parse.success) {
      return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
    }
    try {
      const result = await walletAuthStart(parse.data);
      return reply.send(result);
    } catch (err) {
      return reply
        .code(400)
        .send({ error: { message: err instanceof Error ? err.message : "Failed to start" } });
    }
  });

  // ---------- /v1/auth/wallet/finish ----------

  app.post("/v1/auth/wallet/finish", async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = WalletFinishSchema.safeParse(req.body ?? {});
    if (!parse.success) {
      return reply.code(400).send({ error: { message: "Invalid input", issues: parse.error.issues } });
    }
    try {
      const result = await walletAuthFinish(parse.data, {
        ipHash: hashIp(req.ip),
        userAgent: (req.headers["user-agent"] ?? "").toString().slice(0, 256),
        issueTokens: (userId, jti) => {
          const accessToken = app.jwt.sign(
            { sub: userId, jti, type: "access" },
            { expiresIn: cfg.JWT_ACCESS_TTL },
          );
          const refreshToken = app.jwt.sign(
            { sub: userId, jti, type: "refresh" },
            { expiresIn: cfg.JWT_REFRESH_TTL },
          );
          return { accessToken, refreshToken };
        },
        setSessionCookie: (token: string) => {
          reply.setCookie("aigarth_session", token, {
            httpOnly: true,
            secure: cfg.COOKIE_SECURE,
            sameSite: "lax",
            domain: cfg.COOKIE_DOMAIN,
            path: "/",
            maxAge: 15 * 60, // 15 min, matches access token
          });
        },
      });
      return reply.send({
        user: result.user,
        wallet: result.wallet,
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
        expires_at: result.expiresAt,
        created: result.created,
        verification: result.verification,
      });
    } catch (err) {
      req.log.warn({ err }, "wallet-auth finish failed");
      return reply
        .code(401)
        .send({ error: { message: err instanceof Error ? err.message : "Sign-in failed" } });
    }
  });

  // ---------- /v1/auth/wallet/stats ----------

  app.get("/v1/auth/wallet/stats", async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await walletAuthStats();
      return reply.send({
        checked_at: new Date().toISOString(),
        ...stats,
      });
    } catch (err) {
      return reply
        .code(500)
        .send({ error: { message: err instanceof Error ? err.message : "Stats failed" } });
    }
  });
}
