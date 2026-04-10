/**
 * useAuth.js
 *
 * Custom hook encapsulating OTP auth flow state:
 * - otpId persistence (localStorage fallback for page refresh)
 * - Resend cooldown timer
 * - Loading / error state
 *
 * Used by OTPVerification and TransactionOTPVerification.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { authHelpers } from "../services/api";

// ─── useCountdown ──────────────────────────────────────────────────────────────
export function useCountdown(initialSeconds) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds ?? 0);
  const intervalRef = useRef(null);

  const start = useCallback((seconds) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimeLeft(seconds);
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimeLeft(0);
  }, []);

  useEffect(() => {
    if (initialSeconds > 0) start(initialSeconds);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []); // only on mount

  return { timeLeft, start, reset };
}

// ─── formatCountdown ───────────────────────────────────────────────────────────
export function formatCountdown(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

// ─── useOTPVerify ──────────────────────────────────────────────────────────────
/**
 * @param {object} opts
 * @param {string} opts.otpId           - from login response or localStorage
 * @param {boolean} [opts.isAdminLogin]
 * @param {Function} opts.verifyFn      - async (otpId, otp) => data
 * @param {Function} opts.onSuccess     - called with verify response
 */
export function useOTPVerify({ otpId, isAdminLogin, verifyFn, onSuccess }) {
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleVerify = useCallback(async (otp) => {
    setError("");
    if (!otp?.trim()) {
      setError("Please enter the OTP.");
      return;
    }
    if (!otpId) {
      setError("Session expired. Please sign in again.");
      return;
    }

    setLoading(true);
    try {
      const data = await verifyFn(otpId, otp, isAdminLogin);
      onSuccess(data);
    } catch (err) {
      setError(err.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  }, [otpId, isAdminLogin, verifyFn, onSuccess]);

  return { loading, error, handleVerify, setError };
}