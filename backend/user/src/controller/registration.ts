/**
 * registration.ts
 *
 * Two-step email-verified registration:
 *   POST /register/initiate  → validates, stores pending data in Redis, sends OTP
 *   POST /register/verify    → verifies OTP, creates user, returns JWT
 */

import TryCatch from "../config/TryCatch.js";
import { redisClient } from "../index.js";
import { User } from "../model/User.js";
import { generateToken } from "./generateToken.js";
import { createOTP, verifyOTP } from "../services/otpService.js";
import { resolveChannels, publishOTPDelivery } from "../services/deliveryService.js";
import { publishToQueue } from "../config/rabbitmq.js";
import { analytics } from "./user.js";
import type { Request, Response } from "express";

const REG_TTL_SECONDS = 600; // 10 minutes
const regKey = (otpId: string) => `reg:pending:${otpId}`;

interface PendingRegistration {
  name: string;
  email: string;
  password: string;
  phoneNumber?: string;
  lat?: number;
  lon?: number;
  verifiedChannel: "sms" | "email";
}

// ─── Initiate Registration ─────────────────────────────────────────────────────
export const initiateRegistration = TryCatch(async (req: Request, res: Response) => {
  const { name, email, password, phoneNumber, lat, lon } = req.body;

  if (!name || !email || !password || !phoneNumber) {
    return res.status(400).json({ message: "name, email, password, and phone number are required" });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedPhone = phoneNumber.trim();

  // Check email uniqueness
  const existingEmail = await User.findOne({ email: normalizedEmail });
  if (existingEmail) {
    return res.status(400).json({ message: "An account with this email already exists" });
  }

  // Check phone uniqueness
  const existingPhone = await User.findOne({ phoneNumber: normalizedPhone });
  if (existingPhone) {
    return res.status(400).json({ message: "An account with this phone number already exists" });
  }

  const channels = resolveChannels(normalizedPhone);

  // Use a placeholder userId for registration context (no user exists yet)
  const placeholderUserId = `reg:${normalizedEmail}`;

  const { otpId, plainOtp } = await createOTP(
    placeholderUserId,
    normalizedEmail,
    channels,
    "registration",
    REG_TTL_SECONDS
  );

  // Store pending registration data
  const verifiedChannel: "sms" | "email" = channels[0] === "sms" ? "sms" : "email";
  const pending: PendingRegistration = {
    name,
    email: normalizedEmail,
    password,
    phoneNumber: normalizedPhone,
    lat:  typeof lat === "number" ? lat : undefined,
    lon:  typeof lon === "number" ? lon : undefined,
    verifiedChannel,
  };

  await redisClient.set(regKey(otpId), JSON.stringify(pending), {
    EX: REG_TTL_SECONDS,
  });

  // Publish OTP delivery
  const published = await publishOTPDelivery({
    otpId,
    email: normalizedEmail,
    phone: normalizedPhone,
    otp: plainOtp,
    subject: "Verify your email — SecOTP",
    body: `Your OTP to complete registration is ${plainOtp}. Valid for 10 minutes. Do not share this with anyone.`,
    channels,
    currentChannelIndex: 0,
    retryCount: 0,
  });

  if (!published) {
    // Clean up OTP record if delivery publish failed
    await redisClient.del(regKey(otpId));
    return res.status(500).json({ message: "Failed to send OTP. Please try again." });
  }

  analytics.totalOTPGenerated += 1;
  const today = new Date().toLocaleDateString("en-US", { weekday: "short" });
  analytics.dailyOTPData[today] = (analytics.dailyOTPData[today] ?? 0) + 1;

  return res.status(200).json({
    message: "OTP sent to verify your email",
    otpId,
    deliveryChannel: channels[0],
  });
});

// ─── Verify Registration ───────────────────────────────────────────────────────
export const verifyRegistration = TryCatch(async (req: Request, res: Response) => {
  const { otpId, otp } = req.body;

  if (!otpId || !otp) {
    return res.status(400).json({ message: "otpId and otp are required" });
  }

  // Verify OTP via otpService (handles hashing, attempt counter, expiry)
  const result = await verifyOTP(otpId, otp);

  if (!result.ok) {
    analytics.failedAttempts += 1;
    const today = new Date().toLocaleDateString("en-US", { weekday: "short" });
    if (analytics.failedAttempts % 5 === 0) {
      analytics.blockedUsers += 1;
      analytics.blockedUserTrend[today] = (analytics.blockedUserTrend[today] ?? 0) + 1;
    }

    const messages: Record<string, string> = {
      not_found:    "OTP not found or expired. Please start registration again.",
      expired:      "OTP has expired. Please start registration again.",
      max_attempts: "Too many failed attempts. Please start registration again.",
      wrong_otp:    "Incorrect OTP. Please try again.",
    };

    return res.status(400).json({ message: messages[result.reason] ?? "Verification failed." });
  }

  // Fetch pending registration data
  const rawPending = await redisClient.get(regKey(otpId));
  if (!rawPending) {
    return res.status(400).json({
      message: "Registration session expired. Please start registration again.",
    });
  }

  const pending = JSON.parse(rawPending) as PendingRegistration;

  // Clean up Redis pending data
  await redisClient.del(regKey(otpId));

  // Guard: check again in case of race condition
  const alreadyExists = await User.findOne({ email: pending.email });
  if (alreadyExists) {
    return res.status(400).json({ message: "An account with this email already exists" });
  }

  // Generate account number and create user
  const accountNumber = `ACC${Date.now()}${Math.floor(100 + Math.random() * 900)}`;

  const initialLocation =
    pending.lat !== undefined && pending.lon !== undefined
      ? {
          country:    "Unknown",
          countryCode: "??",
          region:     "Unknown",
          regionName: "Unknown",
          city:       "Unknown",
          lat:        pending.lat,
          lon:        pending.lon,
          ip:         (req as any).ip ?? "",
          updatedAt:  new Date(),
        }
      : undefined;

  const user = await User.create({
    name:              pending.name,
    email:             pending.email,
    password:          pending.password,
    accountNumber,
    phoneNumber:       pending.phoneNumber,
    emailVerified:     pending.verifiedChannel === "email",
    phoneVerified:     pending.verifiedChannel === "sms",
    ...(initialLocation && { lastLoginLocation: initialLocation }),
  });

  analytics.totalVerified += 1;

  // Fire-and-forget welcome email
  await publishToQueue("send-security-alert", {
    type:          "registration_success",
    email:         user.email,
    subject:       "🎉 Welcome to SecOTP — Your Account is Ready",
    body:          `Welcome ${user.name}! Your account number is ${user.accountNumber}`,
    userName:      user.name,
    accountNumber: user.accountNumber,
    balance:       user.balance,
  });

  const token = generateToken(user);

  return res.status(201).json({
    message: "Account created successfully",
    user: {
      _id:           user._id,
      name:          user.name,
      email:         user.email,
      accountNumber: user.accountNumber,
      balance:       user.balance,
    },
    token,
  });
});
