/**
 * transaction.ts
 *
 * Uses otpId-based OTP for transaction verification.
 * The otpId is returned to the frontend and passed back on verify.
 *
 * Changes from original:
 * - publishOTPDelivery instead of direct email publish
 * - createOTP / verifyOTP instead of raw Redis string ops
 * - checkVerifyRateLimit wraps verify endpoint
 * - Fixed _id.toString() TypeScript issue
 */

import TryCatch from "../config/TryCatch.js";
import { redisClient } from "../index.js";
import { User, type IUser } from "../model/User.js";
import type { AuthenticatedRequest } from "../middleware/isAuth.js";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { Transaction } from "../model/Transaction.js";
import { analytics } from "./user.js";
import {
  createOTP,
  verifyOTP,
  getOTPRecord,
  isOnResendCooldown,
  setResendCooldown,
} from "../services/otpService.js";
import {
  resolveChannels,
  publishOTPDelivery,
} from "../services/deliveryService.js";
import {
  checkVerifyRateLimit,
  extractClientIP,
} from "../services/securityService.js";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ITempTransactionData {
  senderId:               string;
  recipientId:            string;
  amount:                 number;
  recipientAccountNumber: string;
}

const generateTransactionId = (): string =>
  `TRX${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;

// ─── Initiate Transaction ──────────────────────────────────────────────────────
export const initiateTransaction = TryCatch(
  async (req: Request & AuthenticatedRequest, res: Response) => {
    const { amount, password, recipientAccountNumber } = req.body;
    const sender = req.user;

    if (!sender) return res.status(401).json({ message: "Not authenticated" });

    if (!amount || !password || !recipientAccountNumber) {
      return res.status(400).json({
        message: "Amount, password, and recipient account number are required",
      });
    }

    const transactionAmount = parseFloat(amount);
    if (isNaN(transactionAmount) || transactionAmount <= 0) {
      return res.status(400).json({ message: "Invalid transaction amount" });
    }

    const clientIP = extractClientIP(req as any);

    // ── Fetch sender ────────────────────────────────────────────────────────
    const senderUser = await User.findById<IUser>(sender._id);
    if (!senderUser) return res.status(404).json({ message: "Sender not found" });

    if (senderUser.balance < transactionAmount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // ── Unknown location detection (unchanged from original) ───────────────
    const ipKey   = `user:lastip:${senderUser._id.toString()}`;
    const lastIp  = await redisClient.get(ipKey);
    const isUnknownLocation = lastIp !== null && lastIp !== clientIP;

    const LARGE_AMOUNT = 701;
    let otpTTL: number;
    if (isUnknownLocation)              otpTTL = 60;
    else if (transactionAmount >= LARGE_AMOUNT) otpTTL = 30;
    else                                otpTTL = 300;

    const expiryText =
      otpTTL === 30  ? "30 seconds" :
      otpTTL === 60  ? "1 minute"   : "5 minutes";

    // ── Password verify ─────────────────────────────────────────────────────
    const isPasswordValid = await bcrypt.compare(password, senderUser.password);
    if (!isPasswordValid) return res.status(401).json({ message: "Incorrect password" });

    // ── Fetch recipient ─────────────────────────────────────────────────────
    const recipientUser = await User.findOne<IUser>({
      accountNumber: recipientAccountNumber,
    });
    if (!recipientUser) {
      return res.status(404).json({ message: "Recipient account not found" });
    }

    if (senderUser._id.toString() === recipientUser._id.toString()) {
      return res.status(400).json({ message: "Cannot transfer to self" });
    }

    // ── Resend cooldown ─────────────────────────────────────────────────────
    const cooldown = await isOnResendCooldown(senderUser._id.toString(), "transaction");
    if (cooldown.blocked) {
      return res.status(429).json({
        message: `Too many OTP requests. Wait ${cooldown.ttlSeconds}s.`,
        cooldownSeconds: cooldown.ttlSeconds,
      });
    }

    // ── Generate OTP + store transaction data ───────────────────────────────
    const transactionId       = generateTransactionId();
    const transactionDetailKey = `transaction:${transactionId}`;

    const txData: ITempTransactionData = {
      senderId:               senderUser._id.toString(),
      recipientId:            recipientUser._id.toString(),
      amount:                 transactionAmount,
      recipientAccountNumber,
    };

    const channels   = resolveChannels(senderUser.phoneNumber ?? undefined, false);
    const { otpId, plainOtp } = await createOTP(
      senderUser._id.toString(),
      senderUser.email,
      channels,
      "transaction",
      otpTTL
    );

    // Store temp transaction data alongside OTP TTL
    await redisClient.set(
      transactionDetailKey,
      JSON.stringify({ ...txData, otpId }),
      { EX: otpTTL }
    );

    await setResendCooldown(senderUser._id.toString(), "transaction");

    // ── Publish (consumer handles retry/fallback) ───────────────────────────
    const published = await publishOTPDelivery({
      otpId,
      email:  senderUser.email,
      phone:  senderUser.phoneNumber ?? undefined,
      otp:    plainOtp,
      subject: "Transaction OTP — SecOTP",
      body:   `Your OTP for transferring ₹${transactionAmount} to account ${recipientAccountNumber} is ${plainOtp}. Valid for ${expiryText}. Do NOT share this.`,
      channels,
      currentChannelIndex: 0,
      retryCount: 0,
    });

    if (!published) {
      await redisClient.del(transactionDetailKey);
      return res.status(500).json({ message: "Failed to send OTP. Please try again." });
    }

    // ── Analytics ───────────────────────────────────────────────────────────
    analytics.totalOTPGenerated += 1;
    const today = new Date().toLocaleDateString("en-US", { weekday: "short" });
    analytics.dailyOTPData[today] = (analytics.dailyOTPData[today] ?? 0) + 1;

    // Update last IP
    await redisClient.set(ipKey, clientIP, { EX: 60 * 60 * 24 * 7 });

    return res.status(200).json({
      message: `OTP sent to your ${channels[0]}. Verify to complete transaction.`,
      otpId,           // ← frontend sends this back on verify
      transactionId,
      expirySeconds: otpTTL,
      deliveryChannel: channels[0],
    });
  }
);

// ─── Verify Transaction OTP ────────────────────────────────────────────────────
export const verifyTransactionOTP = TryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const { otpId, otp, transactionId } = req.body;
    const sender = req.user;

    if (!sender) return res.status(401).json({ message: "Not authenticated" });

    if (!otpId || !otp || !transactionId) {
      return res.status(400).json({ message: "otpId, otp, and transactionId are required" });
    }

    // ── Per-user rate limit ─────────────────────────────────────────────────
    const limit = await checkVerifyRateLimit(sender._id.toString());
    if (limit.blocked) {
      return res.status(429).json({
        message: `Too many attempts. Try again in ${Math.ceil(limit.ttlSeconds / 60)} minute(s).`,
      });
    }

    // ── Fetch + validate transaction data ───────────────────────────────────
    const transactionDetailKey = `transaction:${transactionId}`;
    const rawTx = await redisClient.get(transactionDetailKey);
    if (!rawTx) {
      return res.status(400).json({
        message: "Transaction expired or not found. Please initiate again.",
      });
    }

    const txData = JSON.parse(rawTx) as ITempTransactionData & { otpId: string };

    // Make sure the otpId matches what we stored for this transaction
    if (txData.otpId !== otpId) {
      return res.status(400).json({ message: "OTP ID mismatch. Please initiate again." });
    }

    // ── Verify OTP ───────────────────────────────────────────────────────────
    const verifyResult = await verifyOTP(otpId, otp);

    if (!verifyResult.ok) {
      analytics.failedAttempts += 1;
      const today = new Date().toLocaleDateString("en-US", { weekday: "short" });
      if (analytics.failedAttempts % 5 === 0) {
        analytics.blockedUsers += 1;
        analytics.blockedUserTrend[today] = (analytics.blockedUserTrend[today] ?? 0) + 1;
      }

      const messages: Record<string, string> = {
        not_found:    "OTP not found or expired.",
        expired:      "OTP has expired. Please initiate the transaction again.",
        max_attempts: "Too many failed attempts. Please initiate the transaction again.",
        wrong_otp:    "Incorrect OTP.",
      };

      return res.status(400).json({ message: messages[verifyResult.reason] ?? "OTP verification failed." });
    }

    // ── Authorization: sender must match OTP owner ──────────────────────────
    if (txData.senderId !== sender._id.toString()) {
      return res.status(403).json({ message: "Unauthorized transaction attempt" });
    }

    // Clean up transaction key
    await redisClient.del(transactionDetailKey);
    analytics.totalVerified += 1;

    // ── Atomic DB transaction ────────────────────────────────────────────────
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const senderUser    = await User.findById(txData.senderId).session(session);
      const recipientUser = await User.findById(txData.recipientId).session(session);

      if (!senderUser || !recipientUser) throw new Error("Sender or recipient not found.");
      if (senderUser.balance < txData.amount) throw new Error("Insufficient balance.");

      senderUser.balance    -= txData.amount;
      recipientUser.balance += txData.amount;

      await senderUser.save({ session });
      await recipientUser.save({ session });

      const newTx = new Transaction({
        transactionId,
        sender:    senderUser._id,
        recipient: recipientUser._id,
        amount:    txData.amount,
        type:      "transfer",
        status:    "completed",
      });
      await newTx.save({ session });

      await session.commitTransaction();

      return res.status(200).json({
        message: "Transaction completed successfully!",
        transaction: {
          id:        transactionId,
          amount:    txData.amount,
          sender:    senderUser.email,
          recipient: recipientUser.email,
        },
      });
    } catch (error) {
      await session.abortTransaction();
      const msg = error instanceof Error ? error.message : "Unknown error.";
      return res.status(msg === "Insufficient balance." ? 400 : 500).json({
        message: `Transaction failed: ${msg}`,
      });
    } finally {
      session.endSession();
    }
  }
);

// ─── Transaction History ────────────────────────────────────────────────────────
export const getTransactionHistory = TryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user._id;
    const page   = parseInt(req.query.page as string) || 1;
    const limit  = parseInt(req.query.limit as string) || 10;
    const skip   = (page - 1) * limit;

    const totalCount = await Transaction.countDocuments({
      $or: [{ sender: userId }, { recipient: userId }],
    });

    const transactions = await Transaction.find({
      $or: [{ sender: userId }, { recipient: userId }],
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("sender",    "email accountNumber")
      .populate("recipient", "email accountNumber");

    return res.status(200).json({
      transactions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore:    page < Math.ceil(totalCount / limit),
      },
    });
  }
);