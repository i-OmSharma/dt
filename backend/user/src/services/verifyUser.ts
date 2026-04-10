/**
 * verifyUser.ts
 *
 * Accepts { otpId, otp } — NOT email.
 * otpId is the UUID returned by loginUser.
 *
 * Security:
 * - Per-user verify rate limit (5 attempts per 10 min)
 * - OTP-level attempt counter (max 5, tracked in Redis alongside OTP)
 * - OTP deleted on success (no replay)
 */

import TryCatch from "../config/TryCatch.js";
import { User } from "../model/User.js";
import { generateToken } from "../controller/generateToken.js";
import {
  verifyOTP,
  getOTPRecord,
} from "../services/otpService.js";
import {
  checkVerifyRateLimit,
  extractClientIP,
} from "../services/securityService.js";
import { analytics } from "../controller/user.js";
import type { Request, Response } from "express";

export const verifyUser = TryCatch(async (req: Request, res: Response) => {
  const { otpId, otp, isAdminLogin } = req.body;

  if (!otpId || !otp) {
    return res.status(400).json({ message: "otpId and otp are required" });
  }

  // ── Peek at OTP record to get userId for rate limit check ────────────────
  const record = await getOTPRecord(otpId);
  if (!record) {
    return res.status(400).json({ message: "OTP not found or expired. Please request a new one." });
  }

  // ── Per-user verify rate limit ───────────────────────────────────────────
  const limit = await checkVerifyRateLimit(record.userId);
  if (limit.blocked) {
    return res.status(429).json({
      message: `Too many attempts. Try again in ${Math.ceil(limit.ttlSeconds / 60)} minute(s).`,
    });
  }

  // ── Verify OTP (handles attempt increment + deletion on success) ──────────
  const result = await verifyOTP(otpId, otp);

  if (!result.ok) {
    analytics.failedAttempts += 1;

    const today = new Date().toLocaleDateString("en-US", { weekday: "short" });

    const messages: Record<string, string> = {
      not_found:    "OTP not found or expired. Please request a new one.",
      expired:      "OTP has expired. Please request a new one.",
      max_attempts: "Too many failed attempts. Please request a new OTP.",
      wrong_otp:    "Incorrect OTP. Please try again.",
    };

    if (result.reason === "max_attempts" || analytics.failedAttempts % 5 === 0) {
      analytics.blockedUsers += 1;
      analytics.blockedUserTrend[today] =
        (analytics.blockedUserTrend[today] ?? 0) + 1;
    }

    return res.status(400).json({
      message: messages[result.reason] ?? "Verification failed.",
    });
  }

  // ── Fetch user ─────────────────────────────────────────────────────────────
  const user = await User.findById(result.record.userId).select("-password");
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  // ── Admin gate ─────────────────────────────────────────────────────────────
  if (isAdminLogin === true && !user.isAdmin) {
    return res.status(403).json({ message: "Not authorized as admin." });
  }

  // ── Analytics ──────────────────────────────────────────────────────────────
  analytics.totalVerified += 1;

  const token = generateToken(user);

  return res.status(200).json({
    message: "Verified successfully",
    user,
    token,
    isAdmin: user.isAdmin,
  });
});