/**
 * securityService.ts
 *
 * Per-IP and per-user rate limiting using Redis sliding-window counters.
 * Temporary lockout on abuse.
 *
 * Limits:
 * - Login requests:    10 per IP per 15 min
 * - OTP verifications: 5 per user per 10 min (also enforced at OTP level)
 * - General API:       100 per IP per 1 min
 */

import { redisClient } from "../index.js";

// ─── Constants ─────────────────────────────────────────────────────────────────
const LOGIN_IP_WINDOW_S     = 15 * 60;  // 15 min
const LOGIN_IP_MAX          = 10;

const VERIFY_USER_WINDOW_S  = 10 * 60;  // 10 min
const VERIFY_USER_MAX       = 5;

const LOCKOUT_DURATION_S    = 30 * 60;  // 30 min lockout after abuse

// ─── Key helpers ───────────────────────────────────────────────────────────────
const ipLoginKey    = (ip: string)    => `rl:login:ip:${ip}`;
const userVerifyKey = (userId: string) => `rl:verify:user:${userId}`;
const lockoutKey    = (identifier: string) => `lockout:${identifier}`;

// ─── Generic increment + check ─────────────────────────────────────────────────
async function checkAndIncrement(
  key: string,
  windowSeconds: number,
  max: number
): Promise<{ blocked: boolean; count: number; ttl: number }> {
  const multi = redisClient.multi();
  multi.incr(key);
  multi.ttl(key);

  const results = await multi.exec() as unknown as [number, number];
  const count = results[0];
  const ttl   = results[1];

  // Set expiry on first hit
  if (count === 1) {
    await redisClient.expire(key, windowSeconds);
  }

  return {
    blocked: count > max,
    count,
    ttl: ttl > 0 ? ttl : windowSeconds,
  };
}

// ─── Is locked out ─────────────────────────────────────────────────────────────
export async function isLockedOut(
  identifier: string
): Promise<{ locked: boolean; ttlSeconds: number }> {
  const ttl = await redisClient.ttl(lockoutKey(identifier));
  return { locked: ttl > 0, ttlSeconds: ttl > 0 ? ttl : 0 };
}

// ─── Lock out an identifier ────────────────────────────────────────────────────
export async function lockOut(identifier: string): Promise<void> {
  await redisClient.set(lockoutKey(identifier), "1", {
    EX: LOCKOUT_DURATION_S,
  });
  console.warn(`[Security] Locked out: ${identifier} for ${LOCKOUT_DURATION_S}s`);
}

// ─── Check login rate limit (per IP) ──────────────────────────────────────────
export async function checkLoginRateLimit(
  ip: string
): Promise<{ blocked: boolean; ttlSeconds: number }> {
  // First check hard lockout
  const lockout = await isLockedOut(`ip:${ip}`);
  if (lockout.locked) return { blocked: true, ttlSeconds: lockout.ttlSeconds };

  const result = await checkAndIncrement(
    ipLoginKey(ip),
    LOGIN_IP_WINDOW_S,
    LOGIN_IP_MAX
  );

  // Auto-lockout on severe abuse
  if (result.count > LOGIN_IP_MAX * 3) {
    await lockOut(`ip:${ip}`);
    return { blocked: true, ttlSeconds: LOCKOUT_DURATION_S };
  }

  return { blocked: result.blocked, ttlSeconds: result.ttl };
}

// ─── Check OTP verify rate limit (per user) ───────────────────────────────────
export async function checkVerifyRateLimit(
  userId: string
): Promise<{ blocked: boolean; ttlSeconds: number }> {
  const lockout = await isLockedOut(`user:${userId}`);
  if (lockout.locked) return { blocked: true, ttlSeconds: lockout.ttlSeconds };

  const result = await checkAndIncrement(
    userVerifyKey(userId),
    VERIFY_USER_WINDOW_S,
    VERIFY_USER_MAX
  );

  if (result.count > VERIFY_USER_MAX * 2) {
    await lockOut(`user:${userId}`);
    return { blocked: true, ttlSeconds: LOCKOUT_DURATION_S };
  }

  return { blocked: result.blocked, ttlSeconds: result.ttl };
}

// ─── Get client IP from request headers ───────────────────────────────────────
export function extractClientIP(req: {
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string };
}): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ip.split(",")[0].trim();
  }
  return req.socket.remoteAddress ?? "127.0.0.1";
}