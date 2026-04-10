/**
 * otpService.ts
 *
 * Production-grade OTP management:
 * - UUID-based otpId (never expose raw OTP in URLs or logs)
 * - bcrypt-hashed OTP storage (plain text never persisted)
 * - Attempt counter with lockout at 5 failures
 * - Resend cooldown (60 sec) stored separately
 * - Delivery state tracked per otpId
 */

import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { redisClient } from "../index.js";
import type { OTPChannel } from "./deliveryService.js";

// ─── Constants ─────────────────────────────────────────────────────────────────
const OTP_HASH_ROUNDS    = 10;
const MAX_ATTEMPTS       = 5;
const RESEND_COOLDOWN_S  = 60;   // seconds before user can resend

// ─── Redis key helpers ─────────────────────────────────────────────────────────
const otpKey      = (otpId: string) => `otp:data:${otpId}`;
const cooldownKey = (userId: string, context: string) =>
  `otp:cooldown:${context}:${userId}`;
const deliveryKey = (otpId: string) => `otp:delivery:${otpId}`;

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface OTPRecord {
  hashedOtp: string;
  userId: string;
  email: string;
  attempts: number;
  expiresAt: number; // unix ms
  channels: OTPChannel[];
  currentChannelIndex: number;
  context: "login" | "admin-login" | "transaction" | "registration" | "contact-verification";
}

export type DeliveryStatus = "pending" | "delivered" | "failed";

export interface DeliveryRecord {
  status: DeliveryStatus;
  channel: OTPChannel | null;
  failedChannels: OTPChannel[];
  attempts: number;          // delivery attempts on current channel
  updatedAt: number;
}

export interface CreateOTPResult {
  otpId: string;
  plainOtp: string;          // only returned once, never stored plain
  expiresAt: number;
}

// ─── Create OTP ────────────────────────────────────────────────────────────────
export async function createOTP(
  userId: string,
  email: string,
  channels: OTPChannel[],
  context: OTPRecord["context"],
  ttlSeconds: number
): Promise<CreateOTPResult> {
  const otpId    = uuidv4();
  const plainOtp = String(Math.floor(100000 + Math.random() * 900000));
  const hashedOtp = await bcrypt.hash(plainOtp, OTP_HASH_ROUNDS);
  const expiresAt = Date.now() + ttlSeconds * 1000;

  const record: OTPRecord = {
    hashedOtp,
    userId,
    email,
    attempts: 0,
    expiresAt,
    channels,
    currentChannelIndex: 0,
    context,
  };

  const deliveryRecord: DeliveryRecord = {
    status: "pending",
    channel: channels[0] ?? null,
    failedChannels: [],
    attempts: 0,
    updatedAt: Date.now(),
  };

  // Pipeline: both writes atomic
  await redisClient
    .multi()
    .set(otpKey(otpId), JSON.stringify(record), { EX: ttlSeconds })
    .set(deliveryKey(otpId), JSON.stringify(deliveryRecord), {
      EX: ttlSeconds + 120, // a bit longer than OTP TTL for tracking
    })
    .exec();

  return { otpId, plainOtp, expiresAt };
}

// ─── Get OTP record ────────────────────────────────────────────────────────────
export async function getOTPRecord(otpId: string): Promise<OTPRecord | null> {
  const raw = await redisClient.get(otpKey(otpId));
  if (!raw) return null;
  return JSON.parse(raw) as OTPRecord;
}

// ─── Verify OTP ────────────────────────────────────────────────────────────────
export type VerifyResult =
  | { ok: true; record: OTPRecord }
  | { ok: false; reason: "not_found" | "expired" | "max_attempts" | "wrong_otp" };

export async function verifyOTP(
  otpId: string,
  plainOtp: string
): Promise<VerifyResult> {
  const record = await getOTPRecord(otpId);

  if (!record) return { ok: false, reason: "not_found" };
  if (Date.now() > record.expiresAt) return { ok: false, reason: "expired" };
  if (record.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "max_attempts" };

  const match = await bcrypt.compare(plainOtp, record.hashedOtp);

  if (!match) {
    // Increment attempt counter
    record.attempts += 1;

    if (record.attempts >= MAX_ATTEMPTS) {
      // Delete OTP — user must request a new one
      await redisClient.del(otpKey(otpId));
    } else {
      const remaining = Math.ceil((record.expiresAt - Date.now()) / 1000);
      await redisClient.set(otpKey(otpId), JSON.stringify(record), {
        EX: Math.max(remaining, 1),
      });
    }

    return { ok: false, reason: "wrong_otp" };
  }

  // ✅ Correct — delete OTP to prevent replay
  await redisClient.del(otpKey(otpId));

  return { ok: true, record };
}

// ─── Resend cooldown ───────────────────────────────────────────────────────────
export async function isOnResendCooldown(
  userId: string,
  context: string
): Promise<{ blocked: boolean; ttlSeconds: number }> {
  const key = cooldownKey(userId, context);
  const ttl = await redisClient.ttl(key);
  return { blocked: ttl > 0, ttlSeconds: ttl > 0 ? ttl : 0 };
}

export async function setResendCooldown(
  userId: string,
  context: string
): Promise<void> {
  await redisClient.set(cooldownKey(userId, context), "1", {
    EX: RESEND_COOLDOWN_S,
  });
}

// ─── Delivery tracking ─────────────────────────────────────────────────────────
export async function getDeliveryRecord(
  otpId: string
): Promise<DeliveryRecord | null> {
  const raw = await redisClient.get(deliveryKey(otpId));
  if (!raw) return null;
  return JSON.parse(raw) as DeliveryRecord;
}

export async function updateDeliveryRecord(
  otpId: string,
  update: Partial<DeliveryRecord>,
  ttlSeconds = 3600
): Promise<void> {
  const existing = await getDeliveryRecord(otpId);
  const updated: DeliveryRecord = {
    ...(existing ?? {
      status: "pending",
      channel: null,
      failedChannels: [],
      attempts: 0,
      updatedAt: Date.now(),
    }),
    ...update,
    updatedAt: Date.now(),
  };
  await redisClient.set(deliveryKey(otpId), JSON.stringify(updated), {
    EX: ttlSeconds,
  });
}

// ─── Update channel index after fallback ──────────────────────────────────────
export async function advanceOTPChannel(otpId: string): Promise<OTPRecord | null> {
  const record = await getOTPRecord(otpId);
  if (!record) return null;

  record.currentChannelIndex += 1;
  const remaining = Math.ceil((record.expiresAt - Date.now()) / 1000);
  if (remaining <= 0) return null;

  await redisClient.set(otpKey(otpId), JSON.stringify(record), {
    EX: remaining,
  });
  return record;
}