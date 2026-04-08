import express from "express";
import dotenv from "dotenv";
import { startSendConsumer } from "./consumer.js";

dotenv.config();

const app = express();

startSendConsumer();

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
