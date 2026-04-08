import express from "express";
import { isAuth, isAdmin } from "../middleware/isAuth.js";
import { getAllUsers } from "../controller/user.js";
import {
  getAdminStats,
  getAllTransactions,
  getOTPAnalytics,
} from "../controller/admin.js";

const router = express.Router();

// All users (admin only)
router.get("/users", isAuth, isAdmin, getAllUsers);

// Existing admin stats
router.get("/stats", isAuth, isAdmin, getAdminStats);

// All transactions
router.get("/transactions", isAuth, isAdmin, getAllTransactions);

// OTP Analytics Dashboard Data
router.get("/analytics", isAuth, isAdmin, getOTPAnalytics);

export default router;