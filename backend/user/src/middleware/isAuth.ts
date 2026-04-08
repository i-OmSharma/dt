import type { IUser } from "../model/User.js";
import { User } from "../model/User.js";
import { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

// Tell TS that any Request after auth WILL have user
export interface AuthenticatedRequest extends Request {
  user: IUser; 
}

export const isAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ message: "Unauthorized! Please login" });
      return;
    }

    const token = authHeader.split(" ")[1];
    const decodedValue = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as JwtPayload & { userId?: string };

    if (!decodedValue || !decodedValue.userId) {
      res.status(401).json({ message: "Unauthorized! invalid token" });
      return;
    }

    const user = await User.findById(decodedValue.userId).select("-password");

    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }

    req.user = user as IUser;
    next();
  } catch {
    res.status(401).json({ message: "Please login - JWT error" });
  }
};

export const isAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized! Please login" });
    return;
  }

  if (!req.user.isAdmin) {
    res.status(403).json({ message: "Access denied. Admin only." });
    return;
  }

  next();
};

// 👇 THIS IS THE KEY PART
declare module "express-serve-static-core" {
  interface Request {
    user: IUser;
  }
}
