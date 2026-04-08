import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { IUser } from "../model/User.js";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET as string;

export const generateToken = (user: IUser) => {
  return jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "15d" });
};
