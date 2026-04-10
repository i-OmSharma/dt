import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

// ─── Geo Location embedded schema ─────────────────────────────────────────────
export interface ILoginLocation {
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  lat: number;
  lon: number;
  ip: string;
  updatedAt: Date;
}

// ─── User document interface ──────────────────────────────────────────────────
export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phoneNumber?: string;
  accountNumber: string;
  password: string;
  balance: number;
  isAdmin: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  // persisted location — NOT in Redis (survives restarts, needed for risk comparison)
  lastLoginLocation?: ILoginLocation;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// ─── Schemas ───────────────────────────────────────────────────────────────────
const LoginLocationSchema = new Schema<ILoginLocation>(
  {
    country:     { type: String, default: "Unknown" },
    countryCode: { type: String, default: "??" },
    region:      { type: String, default: "Unknown" },
    regionName:  { type: String, default: "Unknown" },
    city:        { type: String, default: "Unknown" },
    lat:         { type: Number, default: 0 },
    lon:         { type: Number, default: 0 },
    ip:          { type: String, default: "" },
    updatedAt:   { type: Date,   default: Date.now },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phoneNumber: {
      type:   String,
      trim:   true,
      unique: true,
      sparse: true, // allows null/undefined but enforces unique when present
    },
    accountNumber: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    balance: {
      type: Number,
      default: 10000,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    emailVerified: {
      type:    Boolean,
      default: false,
    },
    phoneVerified: {
      type:    Boolean,
      default: false,
    },
    lastLoginLocation: {
      type: LoginLocationSchema,
      default: null,
    },
  },
  { timestamps: true }
);

// ─── Pre-save: hash password ───────────────────────────────────────────────────
UserSchema.pre<IUser>("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ─── Method: compare password ─────────────────────────────────────────────────
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>("User", UserSchema);