/**
 * /v1/auth — public auth routes.
 *
 *   POST /v1/auth/signup
 *   POST /v1/auth/login
 *   POST /v1/auth/logout
 *   POST /v1/auth/verify-email
 *   POST /v1/auth/forgot-password
 *   POST /v1/auth/reset-password
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  signup,
  login,
  logout,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  SignupSchema,
  LoginSchema,
  VerifyEmailSchema,
  PasswordResetRequestSchema,
  PasswordResetSchema,
} from "../services/auth.js";
import { hashIp } from "../lib/ids.js";
import { loadConfig } from "../config/index.js";

export async function authRoutes(app: FastifyInstance) {
  const cfg = loadConfig();

  // ---------- Signup ----------

  app.post("/v1/auth/signup", async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = SignupSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.code(400).send({ error: { message: "Invalid signup data", issues: parse.error.issues } });
    }
    try {
      const result = await signup(parse.data, {
        signupIpHash: hashIp(req.ip),
        userAgent: (req.headers["user-agent"] ?? "").toString().slice(0, 256),
        emitVerificationToken: cfg.NODE_ENV !== "production",
      });
      return reply.code(201).send({
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        status: result.user.status,
        email_verified: false,
        personal_org_id: result.personalOrgId,
        // dev only
        ...(result.verificationToken
          ? { dev_verification_token: result.verificationToken }
          : {}),
      });
    } catch (err) {
      return reply
        .code(400)
        .send({ error: { message: err instanceof Error ? err.message : "Signup failed" } });
    }
  });

  // ---------- Login ----------

  app.post("/v1/auth/login", async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = LoginSchema.safeParse(req.body);
    if (!parse.success) {
      return reply.code(400).send({ error: { message: "Invalid login data" } });
    }
    try {
      const result = await login(parse.data, {
        ipHash: hashIp(req.ip),
        userAgent: (req.headers["user-agent"] ?? "").toString().slice(0, 256),
        issueTokens: (user, jti) => {
          const accessToken = app.jwt.sign(
            { sub: user.id, jti, type: "access" },
            { expiresIn: cfg.JWT_ACCESS_TTL },
          );
          const refreshToken = app.jwt.sign(
            { sub: user.id, jti, type: "refresh" },
            { expiresIn: cfg.JWT_REFRESH_TTL },
          );
          return { accessToken, refreshToken };
        },
      });
      // Also set the access token as an HttpOnly cookie for browser flows
      reply.setCookie("aigarth_session", result.accessToken, {
        httpOnly: true,
        secure: cfg.COOKIE_SECURE,
        sameSite: "lax",
        domain: cfg.COOKIE_DOMAIN,
        path: "/",
        maxAge: 15 * 60, // 15 min (matches access token)
      });
      return reply.send({
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          status: result.user.status,
          email_verified: result.user.emailVerifiedAt !== null,
        },
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
        expires_at: result.session.expiresAt.toISOString(),
      });
    } catch (err) {
      return reply
        .code(401)
        .send({ error: { message: err instanceof Error ? err.message : "Login failed" } });
    }
  });

  // ---------- Logout ----------

  const LogoutSchema = z.object({ jti: z.string().min(1) });
  app.post("/v1/auth/logout", async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = LogoutSchema.safeParse(req.body);
    if (!parse.success) return reply.code(400).send({ error: { message: "jti required" } });
    await logout(parse.data.jti, "user_logout");
    reply.clearCookie("aigarth_session", { path: "/" });
    return reply.send({ ok: true });
  });

  // ---------- Verify email ----------

  app.post("/v1/auth/verify-email", async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = VerifyEmailSchema.safeParse(req.body);
    if (!parse.success) return reply.code(400).send({ error: { message: "token required" } });
    try {
      const user = await verifyEmail(parse.data);
      return reply.send({
        id: user.id,
        email: user.email,
        status: user.status,
        email_verified: true,
      });
    } catch (err) {
      return reply
        .code(400)
        .send({ error: { message: err instanceof Error ? err.message : "Verification failed" } });
    }
  });

  // ---------- Password reset request ----------

  app.post("/v1/auth/forgot-password", async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = PasswordResetRequestSchema.safeParse(req.body);
    if (!parse.success) return reply.code(400).send({ error: { message: "email required" } });
    const { token } = await requestPasswordReset(parse.data, {
      emitToken: cfg.NODE_ENV !== "production",
    });
    return reply.send({
      ok: true,
      ...(token ? { dev_reset_token: token } : {}),
    });
  });

  // ---------- Password reset ----------

  app.post("/v1/auth/reset-password", async (req: FastifyRequest, reply: FastifyReply) => {
    const parse = PasswordResetSchema.safeParse(req.body);
    if (!parse.success) return reply.code(400).send({ error: { message: "Invalid input" } });
    try {
      await resetPassword(parse.data);
      return reply.send({ ok: true });
    } catch (err) {
      return reply
        .code(400)
        .send({ error: { message: err instanceof Error ? err.message : "Reset failed" } });
    }
  });
}
