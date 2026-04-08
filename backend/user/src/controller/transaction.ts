import { publishToQueue } from "../config/rabbitmq.js";
import TryCatch from "../config/TryCatch.js";
import { redisClient } from "../index.js";
import { User, IUser } from "../model/User.js"; // Ensure IUser is exported from your User model
import { AuthenticatedRequest } from "../middleware/isAuth.js";
import { Request } from "express";
import { Response } from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { Transaction } from "../model/Transaction.js";
import { analytics } from "./user.js";

// TEMP transaction structure for Redis storage
interface ITempTransactionData {
  senderId: string;
  recipientId: string;
  amount: number;
  recipientAccountNumber: string;
}

// Generate a unique transaction ID
const generateTransactionId = (): string => {
  return `TRX${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
};


// INITIATE TRANSACTION (OTP REQUEST)

export const initiateTransaction = TryCatch(
  async (req: Request &  AuthenticatedRequest, res: Response) => {
    const { amount, password, recipientAccountNumber } = req.body;
    const sender = req.user; // From isAuth middleware

    if (!sender) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    if (!amount || !password || !recipientAccountNumber) {
      return res.status(400).json({
        message: "Amount, password, and recipient account number are required",
      });
    }

    const transactionAmount = parseFloat(amount);
    if (isNaN(transactionAmount) || transactionAmount <= 0) {
      return res.status(400).json({ message: "Invalid transaction amount" });
    }

    const userIp =
  (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
  req.socket.remoteAddress ||
  ""; //  added location
    
   // 1. FETCH SENDER — Ensure we have the latest user data
    const senderUser = await User.findById<IUser>(sender._id).exec();
    if (!senderUser) {
      return res.status(404).json({ message: "Sender user not found" });
    }


    // BALANCE CHECK
    if (senderUser.balance < transactionAmount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

  //added location
    const ipKey = `user:lastip:${senderUser._id}`;
const lastIp = await redisClient.get(ipKey);

const isUnknownLocation = lastIp !== null && lastIp !== userIp;
//till
//added
      // 🔥 OTP expiry logic add karo
     const LARGE_AMOUNT = 701;

let expirySeconds;

if (isUnknownLocation) {
  expirySeconds = 60; // 🌍 unknown → 1 min
} else if (transactionAmount >= LARGE_AMOUNT) {
  expirySeconds = 30; // 💰 large → 30 sec
} else {
  expirySeconds = 300; // 🙂 normal → 5 min
}

console.log("User IP:", userIp);
console.log("Last IP:", lastIp);
console.log("Unknown:", isUnknownLocation);
console.log("Expiry:", expirySeconds);
     // const expiryText = expirySeconds === 30 ? "30 seconds" : "5 minutes"; 
     let expiryText;

if (expirySeconds === 30) expiryText = "30 seconds";
else if (expirySeconds === 60) expiryText = "1 minute";
else expiryText = "5 minutes";

//till

    // // 1. FETCH SENDER — Ensure we have the latest user data
    // const senderUser = await User.findById<IUser>(sender._id).exec();
    // if (!senderUser) {
    //   return res.status(404).json({ message: "Sender user not found" });
    // }

    // // BALANCE CHECK
    // if (senderUser.balance < transactionAmount) {
    //   return res.status(400).json({ message: "Insufficient balance" });
    // }

    // 3. PASSWORD VERIFY
    const isPasswordValid = await bcrypt.compare(password, senderUser.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    // 4. FETCH RECIPIENT
    const recipientUser = await User.findOne<IUser>({
      accountNumber: recipientAccountNumber,
    }).exec();

    if (!recipientUser) {
      return res.status(404).json({ message: "Recipient account not found" });
    }

    if (senderUser._id.toString() === recipientUser._id.toString()) {
      return res.status(400).json({ message: "Cannot transfer to self" });
    }

    // 5. OTP RATE LIMITING
    const email = senderUser.email;
    const rateLimitKey = `otp:transaction:ratelimit:${email}`;

    const rateLimit = await redisClient.get(rateLimitKey);

    if (rateLimit) {
      return res.status(429).json({
        message: "Too many OTP requests. Please wait before retrying.",
      });
    }

    // 6. GENERATE & STORE OTP + TRANSACTION DATA IN REDIS
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpKey = `otp:transaction:${email}`;

    // Use a pipeline for atomic Redis operations
    const transactionId = generateTransactionId();
    const transactionDetailsKey = `transaction:${transactionId}`;

    const transactionData: ITempTransactionData = {
      senderId: senderUser._id.toString(),
      recipientId: recipientUser._id.toString(),
      amount: transactionAmount,
      recipientAccountNumber,
    };

    await redisClient
      .multi()
      .set(otpKey, otp, { EX: expirySeconds }) //added
       .set(transactionDetailsKey, JSON.stringify(transactionData), { EX: expirySeconds }) //added
      // .set(otpKey, otp, { EX: 300 }) // OTP valid for 5 minutes
      // .set(transactionDetailsKey, JSON.stringify(transactionData), { EX: 300 }) // Temp data valid for 5 minutes
      .set(rateLimitKey, "true", { EX: 60 }) // Rate limit for 1 minute
      .exec();

      analytics.totalOTPGenerated += 1;

        const today = new Date().toLocaleDateString("en-US", {
          weekday: "short",
        });

        analytics.dailyOTPData[today] =
          (analytics.dailyOTPData[today] || 0) + 1;

    await publishToQueue("send-otp", {
      to: email,
      subject: "Your Transaction OTP",
      body: `Your OTP for transaction of ₹${transactionAmount} to ${recipientAccountNumber} is ${otp}, valid for ${expiryText}`,
    });

    // added location
await redisClient.set(ipKey, userIp, { EX: 60 * 60 * 24 * 7 }); // 7 days

    res.status(200).json({
      message:
        "OTP sent to your email. Please verify to complete the transaction.",
      transactionId,
      expirySeconds,
    });
  }
);


// VERIFY OTP + COMPLETE TRANSACTION

export const verifyTransactionOTP = TryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const { otp, transactionId } = req.body;
    const sender = req.user; // From isAuth middleware

    if (!sender)
      return res.status(401).json({ message: "User not authenticated" });

    // 1. INPUT VALIDATION
    if (!otp || !transactionId) {
      return res.status(400).json({
        message: "OTP and transaction ID are required",
      });
    }

    const email = sender.email;
    const otpKey = `otp:transaction:${email}`;
    const transactionDetailsKey = `transaction:${transactionId}`;

    // 2. OTP & TRANSACTION DATA VALIDATION
    const storedOtp = await redisClient.get(otpKey);

    if (!storedOtp || storedOtp !== otp) {
  analytics.failedAttempts += 1;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
  });

  if (analytics.failedAttempts % 5 === 0) {
    analytics.blockedUsers += 1;

    analytics.blockedUserTrend[today] =
      (analytics.blockedUserTrend[today] || 0) + 1;
  }

  await redisClient.del(otpKey);

  return res.status(400).json({
    message: "Invalid or expired OTP",
  });
}

    const storedTransactionData = await redisClient.get(transactionDetailsKey);

    if (!storedTransactionData) {
      await redisClient.del(otpKey); // Clean up OTP if transaction data is missing
      return res.status(400).json({
        message: "Transaction expired or not found. Please initiate again.",
      });
    }

    // Clean up Redis keys immediately after validation to prevent replay attacks
    await redisClient.del(otpKey);
    await redisClient.del(transactionDetailsKey);
    analytics.totalVerified += 1;

    const transactionData = JSON.parse(
      storedTransactionData
    ) as ITempTransactionData;

    // 3. AUTHORIZATION CHECK
    if (transactionData.senderId !== sender._id.toString()) {
      return res
        .status(403)
        .json({ message: "Unauthorized transaction attempt" });
    }

    // 4. ATOMIC DATABASE TRANSACTION
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Re-fetch users inside the transaction to lock the documents and get the latest balance
      const senderUser = await User.findById(transactionData.senderId).session(
        session
      );
      const recipientUser = await User.findById(
        transactionData.recipientId
      ).session(session);

      if (!senderUser || !recipientUser) {
        throw new Error("Sender or recipient not found.");
      }

      // Re-verify balance inside the transaction to prevent race conditions
      if (senderUser.balance < transactionData.amount) {
        throw new Error("Insufficient balance.");
      }

      // Perform the balance update
      senderUser.balance -= transactionData.amount;
      recipientUser.balance += transactionData.amount;

      await senderUser.save({ session });
      await recipientUser.save({ session });

      // Create the permanent transaction record
      const newTransaction = new Transaction({
        transactionId,
        sender: senderUser._id,
        recipient: recipientUser._id,
        amount: transactionData.amount,
        type: "transfer",
        status: "completed",
      });
      await newTransaction.save({ session });

      // If all operations succeed, commit the transaction
      await session.commitTransaction();

      res.status(200).json({
        message: "Transaction completed successfully!",
        transaction: {
          id: transactionId,
          amount: transactionData.amount,
          sender: senderUser.email,
          recipient: recipientUser.email,
        },
      });
    } catch (error) {
      // If any operation fails, abort the entire transaction
      await session.abortTransaction();
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unknown error occurred during the transaction.";
      // Use a 400 status for known business logic failures, 500 for unexpected ones
      const statusCode = errorMessage === "Insufficient balance." ? 400 : 500;
      res
        .status(statusCode)
        .json({ message: `Transaction failed: ${errorMessage}` });
    } finally {
      // Always end the session
      session.endSession();
    }
  }
);

// GET TRANSACTION HISTORY (READ API)

export const getTransactionHistory = TryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user._id;

    // Pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Get total count for pagination metadata
    const totalCount = await Transaction.countDocuments({
      $or: [{ sender: userId }, { recipient: userId }],
    });

    const transactions = await Transaction.find({
      $or: [{ sender: userId }, { recipient: userId }],
    })
      .sort({ createdAt: -1 })     // latest first
      .skip(skip)
      .limit(limit)
      .populate("sender", "email accountNumber")
      .populate("recipient", "email accountNumber");

    res.status(200).json({
      transactions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: page < Math.ceil(totalCount / limit),
      },
    });
  }
);