import TryCatch from "../config/TryCatch.js";
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
import type { Request, Response } from "express";

export const initiateChangePassword = TryCatch(
  async (req: Request, res: Response) => {
    const { phoneNumber, oldPassword } = req.body;

    if (!phoneNumber || !oldPassword) {
      return res.status(400).json({
        message: "Phone number and old password are required",
      });
    }

    const user = await User.findOne({
      phoneNumber: phoneNumber.trim(),
    });

    if (!user) {
      return res.status(404).json({
        message: "No account found with this phone number",
      });
    }

    const isValid = await user.comparePassword(oldPassword);
    if (!isValid) {
      return res.status(401).json({
        message: "Old password is incorrect",
      });
    }

    const cooldown = await isOnResendCooldown(
      user._id.toString(),
      "change-password"
    );
    if (cooldown.blocked) {
      return res.status(429).json({
        message: `Please wait ${cooldown.ttlSeconds}s before trying again`,
        cooldownSeconds: cooldown.ttlSeconds,
      });
    }

    const channels = resolveChannels(user.phoneNumber ?? undefined, false);
    const { otpId, plainOtp } = await createOTP(
      user._id.toString(),
      user.email,
      channels,
      "login",
      300
    );

    await setResendCooldown(user._id.toString(), "change-password");

    const published = await publishOTPDelivery({
      otpId,
      email: user.email,
      phone: user.phoneNumber ?? undefined,
      otp: plainOtp,
      subject: "Password Change OTP — SecOTP",
      body: `Your OTP to change password is ${plainOtp}. Valid for 5 minutes. Do not share.`,
      channels,
      currentChannelIndex: 0,
      retryCount: 0,
      userName: user.name,
      context: "login",
    });

    if (!published) {
      return res.status(500).json({
        message: "Failed to send OTP. Please try again.",
      });
    }

    return res.status(200).json({
      message: "OTP sent to your registered contact",
      otpId,
      deliveryChannel: channels[0],
    });
  }
);

export const verifyChangePassword = TryCatch(
  async (req: Request, res: Response) => {
    const { otpId, otp, newPassword, confirmPassword } = req.body;
    const clientIP = extractClientIP(req as any);

    if (!otpId || !otp || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters",
      });
    }

    const result = await verifyOTP(otpId, otp);

    if (!result.ok) {
      const messages: Record<string, string> = {
        not_found:    "OTP not found or expired. Please request a new one.",
        expired:      "OTP has expired. Please request a new one.",
        max_attempts: "Too many failed attempts. Please request a new OTP.",
        wrong_otp:    "Incorrect OTP. Please try again.",
      };
      return res.status(400).json({
        message: messages[result.reason] ?? "Verification failed",
      });
    }

    const user = await User.findById(result.record.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.password = newPassword;
    await user.save();

    await publishToQueue("send-security-alert", {
      type: "password_changed",
      email: user.email,
      subject: "🔑 Your SecOTP Password Was Changed",
      body: `Hello ${user.name}, your password was changed successfully.`,
      userName: user.name,
      ip: clientIP,
      location: user.lastLoginLocation
        ? `${user.lastLoginLocation.city}, ${user.lastLoginLocation.country}`
        : "Unknown",
    });

    return res.status(200).json({
      message: "Password changed successfully. Please login with your new password.",
    });
  }
);
