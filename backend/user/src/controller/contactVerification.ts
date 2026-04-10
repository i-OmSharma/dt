/**
 * contactVerification.ts
 *
 * In-app contact verification for authenticated users.
 *   POST /verify-contact/initiate  → send OTP to email or phone
 *   POST /verify-contact/confirm   → verify OTP, mark contact as verified
 */

import TryCatch from "../config/TryCatch.js";
import { User } from "../model/User.js";
import type { AuthenticatedRequest } from "../middleware/isAuth.js";
import type { Response } from "express";
import { createOTP, verifyOTP } from "../services/otpService.js";
import { publishOTPDelivery, type OTPChannel } from "../services/deliveryService.js";

const CONTACT_OTP_TTL = 300; // 5 minutes

// ─── Initiate Contact Verification ────────────────────────────────────────────
export const initiateContactVerification = TryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const { type } = req.body;
    const user = req.user;

    if (!type || !["email", "phone"].includes(type)) {
      return res.status(400).json({ message: "type must be 'email' or 'phone'" });
    }

    if (type === "phone" && !user.phoneNumber) {
      return res.status(400).json({ message: "No phone number on your account" });
    }

    const channels: OTPChannel[] = type === "email" ? ["email"] : ["sms"];

    const { otpId, plainOtp } = await createOTP(
      user._id.toString(),
      user.email,
      channels,
      "contact-verification",
      CONTACT_OTP_TTL
    );

    const subject =
      type === "email"
        ? "Verify your email address — SecOTP"
        : "Verify your phone number — SecOTP";
    const body =
      type === "email"
        ? `Your OTP to verify your email address is ${plainOtp}. Valid for 5 minutes. Do not share.`
        : `Your OTP to verify your phone number is ${plainOtp}. Valid for 5 minutes. Do not share.`;

    const published = await publishOTPDelivery({
      otpId,
      email:       user.email,
      phone:       type === "phone" ? (user.phoneNumber ?? undefined) : undefined,
      otp:         plainOtp,
      subject,
      body,
      channels,
      currentChannelIndex: 0,
      retryCount:  0,
      userName:    user.name,
      context:     "contact-verification",
      contactType: type as "email" | "phone",
    });

    if (!published) {
      return res.status(500).json({ message: "Failed to send OTP. Please try again." });
    }

    return res.status(200).json({
      otpId,
      deliveryChannel: channels[0],
      message: `OTP sent to your ${type}`,
    });
  }
);

// ─── Confirm Contact Verification ─────────────────────────────────────────────
export const confirmContactVerification = TryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const { otpId, otp, type } = req.body;

    if (!otpId || !otp || !type) {
      return res.status(400).json({ message: "otpId, otp, and type are required" });
    }
    if (!["email", "phone"].includes(type)) {
      return res.status(400).json({ message: "type must be 'email' or 'phone'" });
    }

    const result = await verifyOTP(otpId, otp);

    if (!result.ok) {
      const messages: Record<string, string> = {
        not_found:    "OTP not found or expired. Please request a new one.",
        expired:      "OTP has expired. Please request a new one.",
        max_attempts: "Too many failed attempts. Please request a new OTP.",
        wrong_otp:    "Incorrect OTP. Please try again.",
      };
      return res.status(400).json({ message: messages[result.reason] ?? "Verification failed." });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (type === "email") {
      user.emailVerified = true;
    } else {
      user.phoneVerified = true;
    }

    await user.save();

    return res.status(200).json({
      message:       "Verified successfully",
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
    });
  }
);
