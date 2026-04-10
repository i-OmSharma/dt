/**
 * accountSettings.ts
 *
 * Authenticated account-settings flows (all routes require isAuth):
 *
 *  Email change:    /settings/email/initiate    → /settings/email/verify
 *  Phone change:    /settings/phone/initiate    → /settings/phone/verify
 *  Password change: /settings/password/initiate → /settings/password/verify
 *
 * Redis keys:
 *   email:change:{otpId}  = { userId, newEmail }   EX 300
 *   phone:change:{otpId}  = { userId, newPhone }   EX 300
 *   pwd:change:{otpId}    = { userId }              EX 300
 */

import TryCatch from "../config/TryCatch.js";
import { redisClient } from "../index.js";
import { User } from "../model/User.js";
import {
  createOTP,
  verifyOTP,
  isOnResendCooldown,
  setResendCooldown,
} from "../services/otpService.js";
import {
  resolveChannels,
  publishOTPDelivery,
} from "../services/deliveryService.js";
import { publishToQueue } from "../config/rabbitmq.js";
import { extractClientIP } from "../services/securityService.js";
import type { AuthenticatedRequest } from "../middleware/isAuth.js";
import type { Response } from "express";

const OTP_TTL = 300; // 5 minutes

// ─── Key helpers ───────────────────────────────────────────────────────────────
const emailChangeKey    = (otpId: string) => `email:change:${otpId}`;
const phoneChangeKey    = (otpId: string) => `phone:change:${otpId}`;
const pwdChangeKey      = (otpId: string) => `pwd:change:${otpId}`;

// ══════════════════════════════════════════════════════════════════════════════
// EMAIL CHANGE
// ══════════════════════════════════════════════════════════════════════════════

export const initiateEmailChange = TryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const { newEmail, password } = req.body;

    if (!newEmail || !password) {
      return res.status(400).json({ message: "New email and password are required" });
    }

    const normalized = newEmail.toLowerCase().trim();
    const user = await User.findById(req.user?._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Verify current password
    const isValid = await user.comparePassword(password);
    if (!isValid) return res.status(401).json({ message: "Password is incorrect" });

    // Check new email is not taken
    const taken = await User.findOne({ email: normalized });
    if (taken) return res.status(400).json({ message: "This email is already in use" });

    const userId = user._id.toString();
    const cooldown = await isOnResendCooldown(userId, "email-change");
    if (cooldown.blocked) {
      return res.status(429).json({
        message: `Please wait ${cooldown.ttlSeconds}s before trying again`,
        cooldownSeconds: cooldown.ttlSeconds,
      });
    }

    const channels = ["email"] as any; // Send OTP to the NEW email to prove ownership
    const { otpId, plainOtp } = await createOTP(
      userId,
      normalized, // OTP goes to the new address
      channels,
      "contact-verification",
      OTP_TTL
    );

    await setResendCooldown(userId, "email-change");

    // Persist pending change
    await redisClient.set(
      emailChangeKey(otpId),
      JSON.stringify({ userId, newEmail: normalized }),
      { EX: OTP_TTL }
    );

    const published = await publishOTPDelivery({
      otpId,
      email:    normalized,
      otp:      plainOtp,
      subject:  "Verify your new email — SecOTP",
      body:     `Your OTP to confirm your new email is ${plainOtp}. Valid for 5 minutes.`,
      channels,
      currentChannelIndex: 0,
      retryCount: 0,
      userName:    user.name,
      context:     "contact-verification",
      contactType: "email",
    });

    if (!published) {
      await redisClient.del(emailChangeKey(otpId));
      return res.status(500).json({ message: "Failed to send OTP. Please try again." });
    }

    return res.status(200).json({
      message: "OTP sent to your new email address",
      otpId,
      deliveryChannel: "email",
    });
  }
);

export const verifyEmailChange = TryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const { otpId, otp } = req.body;

    if (!otpId || !otp) {
      return res.status(400).json({ message: "otpId and otp are required" });
    }

    const result = await verifyOTP(otpId, otp);
    if (!result.ok) {
      const messages: Record<string, string> = {
        not_found:    "OTP not found or expired. Please request a new one.",
        expired:      "OTP has expired. Please request a new one.",
        max_attempts: "Too many failed attempts. Please request a new OTP.",
        wrong_otp:    "Incorrect OTP. Please try again.",
      };
      return res.status(400).json({ message: messages[result.reason] ?? "Verification failed" });
    }

    const raw = await redisClient.get(emailChangeKey(otpId));
    if (!raw) {
      return res.status(400).json({ message: "Session expired. Please start again." });
    }

    const { userId, newEmail } = JSON.parse(raw) as { userId: string; newEmail: string };
    await redisClient.del(emailChangeKey(otpId));

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.email = newEmail;
    user.emailVerified = true;
    await user.save();

    return res.status(200).json({ message: "Email updated successfully" });
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PHONE CHANGE
// ══════════════════════════════════════════════════════════════════════════════

export const initiatePhoneChange = TryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const { newPhone, password } = req.body;

    if (!newPhone || !password) {
      return res.status(400).json({ message: "New phone number and password are required" });
    }

    const normalized = newPhone.trim();
    const user = await User.findById(req.user?._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isValid = await user.comparePassword(password);
    if (!isValid) return res.status(401).json({ message: "Password is incorrect" });

    // Check new phone is not taken
    const taken = await User.findOne({ phoneNumber: normalized });
    if (taken) return res.status(400).json({ message: "This phone number is already in use" });

    const userId = user._id.toString();
    const cooldown = await isOnResendCooldown(userId, "phone-change");
    if (cooldown.blocked) {
      return res.status(429).json({
        message: `Please wait ${cooldown.ttlSeconds}s before trying again`,
        cooldownSeconds: cooldown.ttlSeconds,
      });
    }

    const channels = resolveChannels(normalized, false);
    const { otpId, plainOtp } = await createOTP(
      userId,
      user.email,
      channels,
      "contact-verification",
      OTP_TTL
    );

    await setResendCooldown(userId, "phone-change");

    await redisClient.set(
      phoneChangeKey(otpId),
      JSON.stringify({ userId, newPhone: normalized }),
      { EX: OTP_TTL }
    );

    const published = await publishOTPDelivery({
      otpId,
      email:    user.email,
      phone:    normalized,
      otp:      plainOtp,
      subject:  "Verify your new phone — SecOTP",
      body:     `Your OTP to confirm your new phone number is ${plainOtp}. Valid for 5 minutes.`,
      channels,
      currentChannelIndex: 0,
      retryCount: 0,
      userName:    user.name,
      context:     "contact-verification",
      contactType: "phone",
    });

    if (!published) {
      await redisClient.del(phoneChangeKey(otpId));
      return res.status(500).json({ message: "Failed to send OTP. Please try again." });
    }

    return res.status(200).json({
      message: "OTP sent to your new phone number",
      otpId,
      deliveryChannel: channels[0],
    });
  }
);

export const verifyPhoneChange = TryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const { otpId, otp } = req.body;

    if (!otpId || !otp) {
      return res.status(400).json({ message: "otpId and otp are required" });
    }

    const result = await verifyOTP(otpId, otp);
    if (!result.ok) {
      const messages: Record<string, string> = {
        not_found:    "OTP not found or expired. Please request a new one.",
        expired:      "OTP has expired. Please request a new one.",
        max_attempts: "Too many failed attempts. Please request a new OTP.",
        wrong_otp:    "Incorrect OTP. Please try again.",
      };
      return res.status(400).json({ message: messages[result.reason] ?? "Verification failed" });
    }

    const raw = await redisClient.get(phoneChangeKey(otpId));
    if (!raw) {
      return res.status(400).json({ message: "Session expired. Please start again." });
    }

    const { userId, newPhone } = JSON.parse(raw) as { userId: string; newPhone: string };
    await redisClient.del(phoneChangeKey(otpId));

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.phoneNumber = newPhone;
    user.phoneVerified = true;
    await user.save();

    return res.status(200).json({ message: "Phone number updated successfully" });
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PASSWORD CHANGE (authenticated user — knows their current password)
// ══════════════════════════════════════════════════════════════════════════════

export const initiatePasswordChangeSetting = TryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const { oldPassword } = req.body;
    if (!oldPassword) {
      return res.status(400).json({ message: "Current password is required" });
    }

    const user = await User.findById(req.user?._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isValid = await user.comparePassword(oldPassword);
    if (!isValid) return res.status(401).json({ message: "Current password is incorrect" });

    const userId = user._id.toString();
    const cooldown = await isOnResendCooldown(userId, "settings-password");
    if (cooldown.blocked) {
      return res.status(429).json({
        message: `Please wait ${cooldown.ttlSeconds}s before trying again`,
        cooldownSeconds: cooldown.ttlSeconds,
      });
    }

    const channels = resolveChannels(user.phoneNumber ?? undefined, false);
    const { otpId, plainOtp } = await createOTP(
      userId,
      user.email,
      channels,
      "login",
      OTP_TTL
    );

    await setResendCooldown(userId, "settings-password");

    await redisClient.set(
      pwdChangeKey(otpId),
      JSON.stringify({ userId }),
      { EX: OTP_TTL }
    );

    const published = await publishOTPDelivery({
      otpId,
      email:    user.email,
      phone:    user.phoneNumber ?? undefined,
      otp:      plainOtp,
      subject:  "Password Change OTP — SecOTP",
      body:     `Your OTP to change your password is ${plainOtp}. Valid for 5 minutes. Do not share.`,
      channels,
      currentChannelIndex: 0,
      retryCount: 0,
      userName: user.name,
      context:  "login",
    });

    if (!published) {
      await redisClient.del(pwdChangeKey(otpId));
      return res.status(500).json({ message: "Failed to send OTP. Please try again." });
    }

    return res.status(200).json({
      message: "OTP sent to your registered contact",
      otpId,
      deliveryChannel: channels[0],
    });
  }
);

export const verifyPasswordChangeSetting = TryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const { otpId, otp, newPassword, confirmPassword } = req.body;
    const clientIP = extractClientIP(req as any);

    if (!otpId || !otp || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const result = await verifyOTP(otpId, otp);
    if (!result.ok) {
      const messages: Record<string, string> = {
        not_found:    "OTP not found or expired. Please request a new one.",
        expired:      "OTP has expired. Please request a new one.",
        max_attempts: "Too many failed attempts. Please request a new OTP.",
        wrong_otp:    "Incorrect OTP. Please try again.",
      };
      return res.status(400).json({ message: messages[result.reason] ?? "Verification failed" });
    }

    const raw = await redisClient.get(pwdChangeKey(otpId));
    if (!raw) {
      return res.status(400).json({ message: "Session expired. Please start again." });
    }

    const { userId } = JSON.parse(raw) as { userId: string };
    await redisClient.del(pwdChangeKey(otpId));

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.password = newPassword;
    await user.save();

    await publishToQueue("send-security-alert", {
      type:     "password_changed",
      email:    user.email,
      subject:  "🔑 Your SecOTP Password Was Changed",
      body:     `Hello ${user.name}, your password was changed successfully.`,
      userName: user.name,
      ip:       clientIP,
      location: user.lastLoginLocation
        ? `${user.lastLoginLocation.city}, ${user.lastLoginLocation.country}`
        : "Unknown",
    });

    return res.status(200).json({ message: "Password changed successfully" });
  }
);
