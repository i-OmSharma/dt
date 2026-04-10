/**
 * user.ts controller
 *
 * Uses:
 * - otpService   → create/verify UUID-based hashed OTPs
 * - deliveryService → publish to RabbitMQ (consumer drives retry/fallback)
 * - geoService   → IP risk assessment, persists to DB
 * - securityService → rate limiting, lockouts
 */

import TryCatch from "../config/TryCatch.js";
import { redisClient } from "../index.js";
import { User } from "../model/User.js";
import { generateToken } from "./generateToken.js";
import type { AuthenticatedRequest } from "../middleware/isAuth.js";
import type { Response, Request } from "express";
import {
  createOTP,
  verifyOTP,
  isOnResendCooldown,
  setResendCooldown,
} from "../services/otpService.js";
import {
  resolveChannels,
  publishOTPDelivery,
  publishSecurityAlert,
  type OTPChannel,
} from "../services/deliveryService.js";
import { assessGeoRisk, type GeoRiskResult } from "../services/geoService.js";
import {
  checkLoginRateLimit,
  checkVerifyRateLimit,
  extractClientIP,
} from "../services/securityService.js";

// ─── In-memory analytics (unchanged shape) ────────────────────────────────────
export const analytics: {
  totalOTPGenerated: number;
  totalVerified: number;
  failedAttempts: number;
  blockedUsers: number;
  averageDeliveryTime: number;
  riskyLogins: number;
  dailyOTPData: Record<string, number>;
  blockedUserTrend: Record<string, number>;
  deliveryTimes: number[];
} = {
  totalOTPGenerated: 0,
  totalVerified: 0,
  failedAttempts: 0,
  blockedUsers: 0,
  averageDeliveryTime: 0,
  riskyLogins: 0,
  dailyOTPData: {},
  blockedUserTrend: {},
  deliveryTimes: [],
};

// ─── Login ─────────────────────────────────────────────────────────────────────
export const loginUser = TryCatch(async (req: Request, res: Response) => {
  const { email, phoneNumber, accountNumber, password, preferredChannel, isAdminLogin } = req.body;
  const clientIP = extractClientIP(req as any);

  if (!email || !phoneNumber || !accountNumber || !password) {
    return res.status(400).json({
      message: "Email, phone number, account number, and password are all required",
    });
  }

  // ── IP rate limit ─────────────────────────────────────────────────────────
  const ipLimit = await checkLoginRateLimit(clientIP);
  if (ipLimit.blocked) {
    return res.status(429).json({
      message: `Too many login attempts. Try again in ${Math.ceil(ipLimit.ttlSeconds / 60)} minute(s).`,
    });
  }

  // ── Find user (email first, then accountNumber, then phoneNumber) ─────────
  const query = email
    ? { email: email.toLowerCase().trim() }
    : accountNumber
    ? { accountNumber: accountNumber.trim() }
    : { phoneNumber: phoneNumber.trim() };
  const user  = await User.findOne(query);

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  if (isAdminLogin === true && !user.isAdmin) {
    return res.status(403).json({ message: "Not authorized for admin access" });
  }

  // ── Resend cooldown ───────────────────────────────────────────────────────
  const context = isAdminLogin ? "admin-login" : "login";
  const userId  = user._id.toString();

  const cooldown = await isOnResendCooldown(userId, context);
  if (cooldown.blocked) {
    return res.status(429).json({
      message: `Please wait ${cooldown.ttlSeconds}s before requesting another OTP.`,
      cooldownSeconds: cooldown.ttlSeconds,
    });
  }

  // ── Geo risk (non-blocking) ───────────────────────────────────────────────
  let geoRisk: GeoRiskResult = {
    riskLevel: "NONE",
    isRisky: false,
    riskReason: null,
    currentLocation: null,
    previousLocation: null,
  };

  try {
    geoRisk = await assessGeoRisk(userId, clientIP);
    if (geoRisk.isRisky) analytics.riskyLogins += 1;
  } catch (e) {
    console.error("[Login] Geo risk assessment failed (non-fatal):", e);
  }

  // ── OTP TTL: shorter for risky logins ────────────────────────────────────
  const otpTTL = geoRisk.riskLevel === "HIGH" ? 120
    : geoRisk.riskLevel === "MEDIUM" ? 180
    : 300;

  // ── Resolve channel priority ──────────────────────────────────────────────
  const baseChannels = resolveChannels(user.phoneNumber ?? undefined, false);
  const allOrdered: OTPChannel[] = ["email", "sms", "voice"];
  const channels: OTPChannel[] = preferredChannel === "email"
    ? allOrdered.filter(c => baseChannels.includes(c))
    : baseChannels; // sms first by default

  // ── Create hashed OTP ─────────────────────────────────────────────────────
  const { otpId, plainOtp } = await createOTP(
    userId,
    user.email,
    channels,
    context as any,
    otpTTL
  );

  // ── Set resend cooldown ───────────────────────────────────────────────────
  await setResendCooldown(userId, context);

  // ── Build OTP body ────────────────────────────────────────────────────────
  let body = `Your OTP is ${plainOtp}. Valid for ${Math.round(otpTTL / 60)} minute(s). Do not share this with anyone.`;

  if (geoRisk.isRisky && geoRisk.currentLocation) {
    body += `\n\n⚠️ Security Notice: Login attempt from ${geoRisk.currentLocation.city}, ${geoRisk.currentLocation.country}. If this was not you, change your password immediately.`;
  }

  // ── Publish to queue (consumer handles retry/fallback) ────────────────────
  const published = await publishOTPDelivery({
    otpId,
    email:    user.email,
    phone:    user.phoneNumber ?? undefined,
    otp:      plainOtp,
    subject:  isAdminLogin ? "Admin Login OTP" : "Login OTP — SecOTP",
    body,
    channels,
    currentChannelIndex: 0,
    retryCount: 0,
    userName: user.name,
    context:  isAdminLogin ? "admin-login" : "login",
    location: geoRisk.currentLocation
      ? `${geoRisk.currentLocation.city}, ${geoRisk.currentLocation.country}`
      : "Unknown",
    channel:  channels[0],
  });

  if (!published) {
    return res.status(500).json({ message: "Failed to send OTP. Please try again." });
  }

  // ── Analytics ─────────────────────────────────────────────────────────────
  analytics.totalOTPGenerated += 1;
  const today = new Date().toLocaleDateString("en-US", { weekday: "short" });
  analytics.dailyOTPData[today] = (analytics.dailyOTPData[today] ?? 0) + 1;
  analytics.deliveryTimes.push(2);
  analytics.averageDeliveryTime =
    analytics.deliveryTimes.reduce((a, b) => a + b, 0) / analytics.deliveryTimes.length;

  // ── Security alert email (separate queue, fire-and-forget) ────────────────
  if (geoRisk.isRisky) {
    const loc     = geoRisk.currentLocation;
    const prevLoc = geoRisk.previousLocation;
    publishSecurityAlert({
      type:      "security_alert",
      email:     user.email,
      subject:   "⚠️ Security Alert: Login from New Location",
      body:
        `Hello ${user.name},\n\n` +
        `A login attempt was made from:\n` +
        `📍 ${loc?.city ?? "Unknown"}, ${loc?.country ?? "Unknown"} (IP: ${clientIP})\n` +
        (prevLoc ? `🏠 Your usual location: ${prevLoc.city}, ${prevLoc.country}\n` : "") +
        `\nRisk level: ${geoRisk.riskLevel}\n` +
        `If this was NOT you, change your password immediately.\n\n` +
        `— SecOTP Security Team`,
      userName:  user.name,
      location:  loc ? `${loc.city}, ${loc.country}` : "Unknown",
      ip:        clientIP,
      riskLevel: geoRisk.riskLevel,
      resetUrl:  `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/change-password`,
    });
  }

  return res.status(200).json({
    message: `OTP sent to your ${channels[0]}`,
    otpId,                          // ← client uses this, NOT email, for verify
    deliveryChannel: channels[0],
    // Only expose geo risk details when risky (don't leak location data otherwise)
    ...(geoRisk.isRisky && {
      geoRisk: {
        riskLevel:       geoRisk.riskLevel,
        riskReason:      geoRisk.riskReason,
        currentLocation: geoRisk.currentLocation
          ? { city: geoRisk.currentLocation.city, country: geoRisk.currentLocation.country }
          : null,
        previousLocation: geoRisk.previousLocation
          ? { city: (geoRisk.previousLocation as any).city, country: (geoRisk.previousLocation as any).country }
          : null,
      },
    }),
  });
});

// ─── Register ──────────────────────────────────────────────────────────────────
export const registerUser = TryCatch(async (req: Request, res: Response) => {
  const { name, email, password, phoneNumber } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "name, email, and password are required" });
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    return res.status(400).json({ message: "User with this email already exists" });
  }

  const accountNumber = `ACC${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
  const user = await User.create({ name, email, password, accountNumber, phoneNumber });

  return res.status(201).json({
    message: "User registered successfully",
    user: {
      _id:           user._id,
      name:          user.name,
      email:         user.email,
      accountNumber: user.accountNumber,
      balance:       user.balance,
    },
  });
});

// ─── My Profile ────────────────────────────────────────────────────────────────
export const myProfile = TryCatch(
  async (req: AuthenticatedRequest, res: Response) => res.json(req.user)
);

// ─── Get Balance ───────────────────────────────────────────────────────────────
export const getBalance = TryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const user = await User.findById(req.user?._id);
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ balance: user.balance });
  }
);

// ─── Update Name ───────────────────────────────────────────────────────────────
export const updateName = TryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const user = await User.findById(req.user?._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.name = req.body.name;
    await user.save();
    const token = generateToken(user);

    return res.json({
      message: "User updated",
      user: {
        _id:           user._id,
        name:          user.name,
        email:         user.email,
        accountNumber: user.accountNumber,
        balance:       user.balance,
        phoneNumber:   user.phoneNumber,
        isAdmin:       user.isAdmin,
      },
      token,
    });
  }
);

// ─── Get All Users ─────────────────────────────────────────────────────────────
export const getAllUsers = TryCatch(
  async (_req: AuthenticatedRequest, res: Response) => {
    const users = await User.find().select("-password");
    return res.json(users);
  }
);

// ─── Get A User ────────────────────────────────────────────────────────────────
export const getAUser = TryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const user = await User.findById(req.params.id).select("-password");
    return res.json(user);
  }
);