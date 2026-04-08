import express from "express";
import dotenv from "dotenv";
import connectDb from "./config/db.js";
import { createClient } from "redis";
import userRoutes from "./routes/user.js";
import adminRoutes from "./routes/admin.js";
import { connectRabbitMQ } from "./config/rabbitmq.js";
import cors from "cors";

dotenv.config();

connectDb();
connectRabbitMQ();

export const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: process.env.REDIS_URL?.startsWith("rediss://")
    ? {
        tls: true,
        rejectUnauthorized: false,
      }
    : undefined,
});

redisClient.on("error", (err) => {
  console.error("Redis Error:", err);
});

redisClient
  .connect()
  .then(() => console.log("Redis Connected"))
  .catch((err) => console.error("Redis Connection Failed:", err));

const app = express();

// CORS must come before routes
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

// Routes
app.use("/api/v1", userRoutes);
app.use("/api/admin", adminRoutes);

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});