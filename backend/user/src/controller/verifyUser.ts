import { redisClient } from "../index.js";
import { User } from "../model/User.js";
import { generateToken } from "./generateToken.js";
import TryCatch from "../config/TryCatch.js";
import { analytics } from "./user.js";

export const verifyUser = TryCatch(async (req, res) => {
  const { email, otp: enteredOTP, isAdminLogin } = req.body;

  if (!email || !enteredOTP) {
    return res.status(400).json({
      message: "Email and OTP required",
    });
  }

  // use different redis key for admin login and normal user login
  const otpKey = isAdminLogin
    ? `otp:admin:${email}`
    : `otp:user:${email}`;

  const storedOTP = await redisClient.get(otpKey);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
  });

  // OTP wrong or expired
  if (!storedOTP) {
    analytics.failedAttempts += 1;

    if (analytics.failedAttempts % 5 === 0) {
      analytics.blockedUsers += 1;

      analytics.blockedUserTrend[today] =
        (analytics.blockedUserTrend[today] || 0) + 1;
    }

    return res.status(400).json({
      message: "OTP expired or not found",
    });
  }

  // OTP entered does not match
  if (storedOTP !== enteredOTP) {
    analytics.failedAttempts += 1;

    if (analytics.failedAttempts % 5 === 0) {
      analytics.blockedUsers += 1;

      analytics.blockedUserTrend[today] =
        (analytics.blockedUserTrend[today] || 0) + 1;
    }

    return res.status(400).json({
      message: "Wrong OTP",
    });
  }

  // correct OTP
  await redisClient.del(otpKey);

  analytics.totalVerified += 1;
  console.log("Verified count:", analytics.totalVerified);

  const user = await User.findOne({ email }).select("-password");

  if (!user) {
    return res.status(404).json({
      message: "User not found. Please complete registration.",
      registrationRequired: true,
      email,
    });
  }

  // if someone tries admin login without being admin
  if (isAdminLogin === true && !user.isAdmin) {
    return res.status(403).json({
      message: "You are not authorized as admin",
    });
  }

  const token = generateToken(user);

  return res.status(200).json({
    message: "User Verified",
    user,
    token,
    isAdmin: user.isAdmin,
  });
});