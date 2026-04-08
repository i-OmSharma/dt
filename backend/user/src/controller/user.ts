import { publishToQueue } from "../config/rabbitmq.js";
import TryCatch from "../config/TryCatch.js";
import { redisClient } from "../index.js";
import { User } from "../model/User.js";
import { generateToken } from "./generateToken.js";
import { AuthenticatedRequest } from "../middleware/isAuth.js";
import { Response } from "express";

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

// Login User
export const loginUser = TryCatch(async (req, res) => {
  const { email, accountNumber, password, isAdminLogin } = req.body;

  if (!password) {
    return res.status(400).json({
      message: "Password is required",
    });
  }

  if (!email && !accountNumber) {
    return res.status(400).json({
      message: "Email or account number is required",
    });
  }

  const user = await User.findOne(email ? { email } : { accountNumber });

  if (!user) {
    return res.status(401).json({
      message: "Invalid credentials",
    });
  }

  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    return res.status(401).json({
      message: "Invalid credentials",
    });
  }

  // only block if trying to login through admin page
  if (isAdminLogin === true && !user.isAdmin) {
    return res.status(403).json({
      message: "You are not authorized to access admin panel",
    });
  }

  // different rate limit keys for admin login and normal login
  const rateLimitKey = isAdminLogin
    ? `otp:admin-ratelimit:${user.email}`
    : `otp:user-ratelimit:${user.email}`;

  const rateLimit = await redisClient.get(rateLimitKey);

  if (rateLimit) {
    return res.status(429).json({
      message: "Too many requests. Please wait before requesting another OTP.",
    });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  const otpKey = isAdminLogin
    ? `otp:admin:${user.email}`
    : `otp:user:${user.email}`;

  await redisClient.set(otpKey, otp, {
    EX: 300,
  });

  await redisClient.set(rateLimitKey, "true", {
    EX: 60,
  });

  const message = {
    to: user.email,
    subject: isAdminLogin ? "Admin Login OTP" : "Login OTP",
    body: `Your OTP is ${otp}. It is valid for 5 minutes.`,
  };

  const otpSent = await publishToQueue("send-otp", message);

  if (!otpSent) {
    // remove stored otp and rate limit if mail sending failed
    await redisClient.del(otpKey);
    await redisClient.del(rateLimitKey);

    return res.status(500).json({
      message: "Failed to send OTP. Please try again later.",
    });
  }

  analytics.totalOTPGenerated += 1;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
  });

  if (!analytics.dailyOTPData[today]) {
    analytics.dailyOTPData[today] = 0;
  }

  analytics.dailyOTPData[today] += 1;

  const deliveryTime = 2;
  analytics.deliveryTimes.push(deliveryTime);

  analytics.averageDeliveryTime =
    analytics.deliveryTimes.reduce((a, b) => a + b, 0) /
    analytics.deliveryTimes.length;

  return res.status(200).json({
    message: "OTP sent to your mail",
    isAdmin: user.isAdmin,
  });
});

// Register User
export const registerUser = TryCatch(async (req, res) => {
  const { name, email, password, phoneNumber } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      message: "name, email, and password are required",
    });
  }

  let user = await User.findOne({ email });

  if (user) {
    return res.status(400).json({
      message: "User with this email already exists",
    });
  }

  const accountNumber = `ACC${Date.now()}${Math.floor(
    100 + Math.random() * 900
  )}`;

  user = await User.create({
    name,
    email,
    password,
    accountNumber,
    phoneNumber,
  });

  return res.status(201).json({
    message: "User registered successfully",
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      accountNumber: user.accountNumber,
      balance: user.balance,
    },
  });
});

export const myProfile = TryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    return res.json(req.user);
  }
);

export const getBalance = TryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const user = await User.findById(req.user?._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.json({
      balance: user.balance,
    });
  }
);

export const updateName = TryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const user = await User.findById(req.user?._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    user.name = req.body.name;
    await user.save();

    const token = generateToken(user);

    return res.json({
      message: "User updated",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        accountNumber: user.accountNumber,
        balance: user.balance,
        phoneNumber: user.phoneNumber,
        isAdmin: user.isAdmin,
      },
      token,
    });
  }
);

export const getAllUsers = TryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const users = await User.find().select("-password");

    return res.json(users);
  }
);

export const getAUser = TryCatch(
  async (req: AuthenticatedRequest, res: Response) => {
    const user = await User.findById(req.params.id).select("-password");

    return res.json(user);
  }
);