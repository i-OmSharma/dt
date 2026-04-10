/**
 * deliveryService.ts
 *
 * Responsible ONLY for publishing the initial delivery request.
 * The RabbitMQ consumer (mail service) owns the retry/fallback logic.
 *
 * Key design decisions:
 * - We publish ONE message per OTP — consumer drives retries
 * - Message contains full channel list + currentChannelIndex
 * - Consumer republishes with updated index on failure
 */

import { publishToQueue } from "../config/rabbitmq.js";

export type OTPChannel = "sms" | "email" | "voice";

export interface DeliveryMessage {
  // Identification
  otpId: string;

  // Recipient info
  email: string;
  phone?: string;

  // OTP body (plain — only transmitted over internal RabbitMQ, never to client)
  otp: string;
  subject: string;
  body: string;

  // Channel orchestration (managed by consumer)
  channels: OTPChannel[];
  currentChannelIndex: number;
  retryCount: number; // retries on current channel

  // Template-selection fields (optional — consumer picks template when present)
  userName?:        string;
  context?:         string;
  location?:        string;
  channel?:         string;
  amount?:          number;
  recipientAccount?: string;
  contactType?:     "email" | "phone";
}

export interface SecurityAlertMessage {
  type:           "security_alert" | "registration_success" | "password_changed";
  email:          string;
  subject:        string;
  body:           string;
  userName?:      string;
  accountNumber?: string;
  balance?:       number;
  // Security alert fields
  ip?:            string;
  location?:      string;
  resetUrl?:      string;
  riskLevel?:     string;
}

// ─── Resolve channel priority based on available contact info ─────────────────
export function resolveChannels(
  phone?: string,
  forceEmailFirst = false
): OTPChannel[] {
  if (forceEmailFirst) {
    const ch: OTPChannel[] = ["email"];
    if (phone) ch.push("sms", "voice");
    return ch;
  }
  const ch: OTPChannel[] = [];
  if (phone) ch.push("sms");
  ch.push("email");
  if (phone) ch.push("voice");
  return ch;
}

/**
 * Publish an OTP delivery request.
 * Publishes only once — consumer handles retries and fallback.
 */
export async function publishOTPDelivery(
  msg: DeliveryMessage
): Promise<boolean> {
  return publishToQueue("send-otp", msg);
}

/**
 * Publish a security alert email (separate queue, no retry needed).
 */
export async function publishSecurityAlert(
  msg: SecurityAlertMessage
): Promise<void> {
  try {
    await publishToQueue("send-security-alert", msg);
  } catch (err) {
    // Security alerts must never block the auth flow
    console.error("[DeliveryService] Failed to publish security alert:", err);
  }
}