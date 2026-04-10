/**
 * consumer.ts — Delivery Orchestrator
 *
 * Consumes from two queues:
 *   send-otp           → OTP delivery with retry + channel fallback
 *   send-security-alert → One-shot alert emails (no retry)
 *
 * Retry strategy per channel:
 *   - Max 3 attempts on current channel (with 2s/4s/8s backoff)
 *   - On 3rd failure → advance to next channel, republish
 *   - If all channels exhausted → mark delivery as failed, nack without requeue
 *
 * Delivery status is tracked in Redis via otp:delivery:{otpId}
 */

import amqp from "amqplib";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { sendSMS, sendVoiceOTP } from "./sms.js";
import { registrationSuccessTemplate } from "./templates.js";

dotenv.config();

// ─── Types ─────────────────────────────────────────────────────────────────────
type OTPChannel = "sms" | "email" | "voice";

interface OTPDeliveryMessage {
  otpId:               string;
  email:               string;
  phone?:              string;
  otp:                 string;
  subject:             string;
  body:                string;
  channels:            OTPChannel[];
  currentChannelIndex: number;
  retryCount:          number;   // attempts on current channel
}

interface SecurityAlertMessage {
  type:           "security_alert" | "registration_success";
  email:          string;
  subject:        string;
  body:           string;
  userName?:      string;
  accountNumber?: string;
  balance?:       number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const MAX_CHANNEL_RETRIES  = 3;
const DELIVERY_TIMEOUT_MS  = 15_000;   // 15s per channel attempt

// ─── Nodemailer transporter ────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   "smtp.gmail.com",
  port:   465,
  secure: true,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASSWORD,
  },
});

// ─── Channel delivery functions ───────────────────────────────────────────────
async function deliverViaEmail(msg: OTPDeliveryMessage): Promise<boolean> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), DELIVERY_TIMEOUT_MS);
  try {
    await transporter.sendMail({
      from:    `"secOTP" <${process.env.MAIL_USER}>`,
      to:      msg.email,
      subject: msg.subject,
      text:    msg.body,
    });
    console.log(`[Consumer] ✓ Email delivered → ${msg.email} (otpId: ${msg.otpId})`);
    return true;
  } catch (err) {
    console.error(`[Consumer] ✗ Email failed → ${msg.email}:`, (err as Error).message);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function deliverViaSMS(msg: OTPDeliveryMessage): Promise<boolean> {
  if (!msg.phone) {
    console.warn("[Consumer] SMS channel selected but no phone number available");
    return false;
  }
  const result = await sendSMS(msg.phone, msg.body);
  if (result.success) {
    console.log(`[Consumer] ✓ SMS delivered → ${msg.phone} (otpId: ${msg.otpId})`);
  } else {
    console.error(`[Consumer] ✗ SMS failed → ${msg.phone}: ${result.error}`);
  }
  return result.success;
}

async function deliverViaVoice(msg: OTPDeliveryMessage): Promise<boolean> {
  if (!msg.phone || !msg.otp) {
    console.warn("[Consumer] Voice channel selected but no phone/otp available");
    return false;
  }
  const result = await sendVoiceOTP(msg.phone, msg.otp);
  if (result.success) {
    console.log(`[Consumer] ✓ Voice delivered → ${msg.phone} (otpId: ${msg.otpId})`);
  } else {
    console.error(`[Consumer] ✗ Voice failed → ${msg.phone}: ${result.error}`);
  }
  return result.success;
}

async function deliverViaChannel(
  msg: OTPDeliveryMessage,
  channel: OTPChannel
): Promise<boolean> {
  switch (channel) {
    case "email": return deliverViaEmail(msg);
    case "sms":   return deliverViaSMS(msg);
    case "voice": return deliverViaVoice(msg);
    default:      return false;
  }
}

// ─── Backoff delay ─────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── OTP Message handler ───────────────────────────────────────────────────────
async function handleOTPMessage(
  msg: OTPDeliveryMessage,
  channel: amqp.Channel,
  rawMsg: amqp.ConsumeMessage
): Promise<void> {
  const { channels, currentChannelIndex, retryCount } = msg;

  if (currentChannelIndex >= channels.length) {
    console.error(`[Consumer] All channels exhausted for otpId: ${msg.otpId}`);
    channel.nack(rawMsg, false, false);
    return;
  }

  const currentChannel = channels[currentChannelIndex];

  // Exponential backoff between retries: 2s → 4s → 8s
  if (retryCount > 0) {
    await sleep(Math.min(2000 * Math.pow(2, retryCount - 1), 8000));
  }

  const success = await deliverViaChannel(msg, currentChannel);

  if (success) {
    channel.ack(rawMsg);
    return;
  }

  // ── Delivery failed ──────────────────────────────────────────────────────
  const nextRetry = retryCount + 1;

  if (nextRetry < MAX_CHANNEL_RETRIES) {
    // Retry same channel
    console.log(
      `[Consumer] Retrying ${currentChannel} (attempt ${nextRetry + 1}/${MAX_CHANNEL_RETRIES}) for otpId: ${msg.otpId}`
    );
    const updatedMsg: OTPDeliveryMessage = { ...msg, retryCount: nextRetry };
    channel.ack(rawMsg);
    await channel.sendToQueue(
      "send-otp",
      Buffer.from(JSON.stringify(updatedMsg)),
      { persistent: true }
    );
  } else {
    // Move to next channel
    const nextChannelIndex = currentChannelIndex + 1;

    if (nextChannelIndex < channels.length) {
      const nextChannel = channels[nextChannelIndex];
      console.log(
        `[Consumer] Falling back from ${currentChannel} → ${nextChannel} for otpId: ${msg.otpId}`
      );
      const updatedMsg: OTPDeliveryMessage = {
        ...msg,
        currentChannelIndex: nextChannelIndex,
        retryCount: 0,
      };
      channel.ack(rawMsg);
      await channel.sendToQueue(
        "send-otp",
        Buffer.from(JSON.stringify(updatedMsg)),
        { persistent: true }
      );
    } else {
      // All channels failed
      console.error(`[Consumer] ✗✗ All channels exhausted for otpId: ${msg.otpId}`);
      channel.nack(rawMsg, false, false);
    }
  }
}

// ─── Security Alert handler ────────────────────────────────────────────────────
async function handleSecurityAlert(
  msg: SecurityAlertMessage,
  channel: amqp.Channel,
  rawMsg: amqp.ConsumeMessage
): Promise<void> {
  let htmlContent: string | undefined;

  if (msg.type === "registration_success") {
    htmlContent = registrationSuccessTemplate(
      msg.userName ?? "User",
      msg.email,
      msg.accountNumber ?? "N/A",
      msg.balance ?? 10000
    );
  }

  try {
    await transporter.sendMail({
      from:    `"secOTP Security" <${process.env.MAIL_USER}>`,
      to:      msg.email,
      subject: msg.subject,
      ...(htmlContent ? { html: htmlContent } : { text: msg.body }),
    });
    console.log(`[Consumer] ✓ Security/welcome email sent → ${msg.email} (type: ${msg.type})`);
    channel.ack(rawMsg);
  } catch (err) {
    console.error("[Consumer] ✗ Security alert failed:", (err as Error).message);
    // Nack with requeue=false — alerts are best-effort, don't retry indefinitely
    channel.nack(rawMsg, false, false);
  }
}

// ─── Connect + start consuming ─────────────────────────────────────────────────
export async function startSendConsumer(): Promise<void> {
  let connection: amqp.ChannelModel;

  try {
    connection = await amqp.connect({
      protocol: "amqp",
      hostname: process.env.RabbitMQ_HOSTNAME,
      port:     5672,
      username: process.env.RabbitMQ_USERNAME,
      password: process.env.RabbitMQ_PASSWORD,
    });

    connection.on("error", (err) => {
      console.error("[Consumer] RabbitMQ connection error:", err.message);
    });

    connection.on("close", () => {
      console.warn("[Consumer] Connection closed — reconnecting in 5s...");
      setTimeout(startSendConsumer, 5000);
    });

    const ch = await connection.createChannel();

    // Declare both queues (idempotent)
    await ch.assertQueue("send-otp",            { durable: true });
    await ch.assertQueue("send-security-alert", { durable: true });

    // Process one message at a time per queue to avoid overwhelming providers
    ch.prefetch(1);

    // ── OTP queue consumer ─────────────────────────────────────────────────
    ch.consume("send-otp", async (rawMsg) => {
      if (!rawMsg) return;
      try {
        const payload = JSON.parse(rawMsg.content.toString()) as OTPDeliveryMessage;
        await handleOTPMessage(payload, ch, rawMsg);
      } catch (err) {
        console.error("[Consumer] Failed to parse OTP message:", (err as Error).message);
        ch.nack(rawMsg, false, false);
      }
    });

    // ── Security alert queue consumer ──────────────────────────────────────
    ch.consume("send-security-alert", async (rawMsg) => {
      if (!rawMsg) return;
      try {
        const payload = JSON.parse(rawMsg.content.toString()) as SecurityAlertMessage;
        await handleSecurityAlert(payload, ch, rawMsg);
      } catch (err) {
        console.error("[Consumer] Failed to parse alert message:", (err as Error).message);
        ch.nack(rawMsg!, false, false);
      }
    });

    console.log("[Consumer] Listening on queues: send-otp, send-security-alert");
  } catch (err) {
    console.error("[Consumer] Failed to start:", (err as Error).message);
    console.log("[Consumer] Retrying in 5s...");
    setTimeout(startSendConsumer, 5000);
  }
}