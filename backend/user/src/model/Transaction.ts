import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: { type: Number, required: true },
    type: {
      type: String,
      enum: ["transfer", "deposit", "withdrawal"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true } // Adds createdAt and updatedAt fields
);

// Add indexes for better query performance
transactionSchema.index({ sender: 1 });
transactionSchema.index({ recipient: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ sender: 1, createdAt: -1 });
transactionSchema.index({ recipient: 1, createdAt: -1 });

export const Transaction = mongoose.model("Transaction", transactionSchema);
