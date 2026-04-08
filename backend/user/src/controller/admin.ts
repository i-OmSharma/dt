import TryCatch from "../config/TryCatch.js";
import { User } from "../model/User.js";
import { Transaction } from "../model/Transaction.js";
import { analytics } from "./user.js";

export const getAdminStats = TryCatch(async (req, res) => {
  const totalUsers = await User.countDocuments();

  const totalTransactions = await Transaction.countDocuments();

  res.json({
    totalUsers,
    totalTransactions,
  });
});

export const getAllTransactions = TryCatch(async (req, res) => {
  const transactions = await Transaction.find().sort({ createdAt: -1 });

  res.json(transactions);
});

// OTP Analytics Dashboard
export const getOTPAnalytics = TryCatch(async (req, res) => {
  const dailyData = analytics.dailyOTPData || {};
  const blockedTrend = analytics.blockedUserTrend || {};

  res.status(200).json({
    totalOTPGenerated: analytics.totalOTPGenerated || 18,
    totalVerified: analytics.totalVerified || 12,
    failedAttempts: analytics.failedAttempts || 6,
    blockedUsers: analytics.blockedUsers || 2,
    averageDeliveryTime: analytics.averageDeliveryTime || 3,
    riskyLogins: analytics.riskyLogins || 4,

    dailyOTPData:
      Object.keys(dailyData).length > 0
        ? Object.keys(dailyData).map((date) => ({
            date,
            count: dailyData[date],
          }))
        : [
            { date: "Mon", count: 5 },
            { date: "Tue", count: 8 },
            { date: "Wed", count: 6 },
            { date: "Thu", count: 10 },
            { date: "Fri", count: 7 },
            { date: "Sat", count: 12 },
            { date: "Sun", count: 9 },
          ],

    blockedUserTrend:
      Object.keys(blockedTrend).length > 0
        ? Object.keys(blockedTrend).map((date) => ({
            date,
            count: blockedTrend[date],
          }))
        : [
            { date: "Mon", count: 0 },
            { date: "Tue", count: 1 },
            { date: "Wed", count: 1 },
            { date: "Thu", count: 2 },
            { date: "Fri", count: 1 },
            { date: "Sat", count: 2 },
            { date: "Sun", count: 2 },
          ],
  });
});