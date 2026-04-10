import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { authAPI, authHelpers } from "../services/api";
import { useCountdown, formatCountdown } from "../hooks/useAuth";

// ─── Channel icon helper ───────────────────────────────────────────────────────
function channelLabel(ch) {
  if (ch === "sms")   return "📱 SMS";
  if (ch === "voice") return "📞 Voice call";
  return "📧 Email";
}

export const OTPVerification = () => {
  const navigate  = useNavigate();
  const location  = useLocation();

  // ── Resolve otpId — from navigation state OR localStorage (refresh safety) ─
  const otpId = location.state?.otpId ?? localStorage.getItem("otpId") ?? "";
  const email = location.state?.email ?? localStorage.getItem("otpEmail") ?? "";

  const geoRisk          = location.state?.geoRisk         ?? null;
  const deliveryChannel  = location.state?.deliveryChannel ?? "email";
  const smsFailedFallback = location.state?.smsFailedFallback ?? false;
  const isAdminLogin   = location.state?.isAdminLogin
    ?? sessionStorage.getItem("isAdminLogin") === "true";

  // ── OTP expiry countdown (default 5 min) ────────────────────────────────
  const { timeLeft, start: startCountdown } = useCountdown(300);

  // ── Resend cooldown (60s) ────────────────────────────────────────────────
  const { timeLeft: resendLeft, start: startResend } = useCountdown(0);

  const [otp,         setOtp]         = useState("");
  const [loading,     setLoading]     = useState(false);
  const [resending,   setResending]   = useState(false);
  const [error,       setError]       = useState("");
  const [success,     setSuccess]     = useState("");

  useEffect(() => {
    if (!otpId) {
      // No otpId at all — redirect back to sign-in
      navigate("/", { replace: true });
    }
  }, [otpId, navigate]);

  // ── Verify ───────────────────────────────────────────────────────────────
  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");

    if (!otp.trim() || otp.trim().length !== 6) {
      setError("Please enter a 6-digit OTP.");
      return;
    }
    if (timeLeft === 0) {
      setError("OTP has expired. Please request a new one.");
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.verifyOTP({ otpId, otp: otp.trim(), isAdminLogin });

      authHelpers.setToken(response.token);
      authHelpers.setUser(response.user);

      // Clean up persisted OTP data
      localStorage.removeItem("otpId");
      localStorage.removeItem("otpEmail");
      sessionStorage.removeItem("isAdminLogin");

      if (response.isAdmin && isAdminLogin) {
        localStorage.setItem("isAdmin", "true");
        navigate("/admin/dashboard", { replace: true });
      } else {
        navigate("/home", { replace: true });
      }
    } catch (err) {
      setError(err.message || "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendLeft > 0 || resending) return;
    setError("");
    setSuccess("");
    setResending(true);

    try {
      const response = await authAPI.login({
        email:        email || undefined,
        isAdminLogin,
        // Note: password not available here — backend must implement a
        // dedicated /resend endpoint. For now we redirect to sign-in.
      });
      // ⚠️ If your backend adds a /resend-otp endpoint, use it here.
      // For now, redirect to sign-in so user can re-enter password.
      navigate("/", { replace: true, state: { message: "Please sign in again to resend OTP." } });
    } catch {
      // Redirect to sign-in as fallback
      navigate("/", { replace: true });
    } finally {
      setResending(false);
    }
  };

  const isExpired = timeLeft === 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <h2 className="text-2xl font-semibold text-gray-800 mb-1">
          {isAdminLogin ? "Admin Verification" : "Verify your identity"}
        </h2>
        <p className="text-gray-500 text-sm mb-4">
          OTP sent via{" "}
          <span className="font-medium text-blue-600">
            {channelLabel(deliveryChannel)}
          </span>
          {email && (
            <>
              {" "}to{" "}
              <span className="font-medium">{email}</span>
            </>
          )}
        </p>

        {/* ── Delivery channel banner ──────────────────────────────────── */}
        {deliveryChannel === "sms" && !smsFailedFallback && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
            📱 OTP sent via SMS
          </div>
        )}
        {deliveryChannel === "email" && !smsFailedFallback && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex items-center gap-2">
            📧 OTP sent via Email
          </div>
        )}

        {/* ── SMS fallback banner ───────────────────────────────────────── */}
        {smsFailedFallback && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-700">
            ⚠️ SMS delivery failed. OTP has been sent to your email instead.
            <button
              onClick={() => navigate("/")}
              className="block mt-2 underline font-medium text-amber-800"
            >
              ← Go back and try again with different details
            </button>
          </div>
        )}

        {/* ── Geo-risk banner ───────────────────────────────────────────── */}
        {geoRisk?.isRisky && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-xl">
            <p className="font-semibold text-amber-800 text-sm flex items-center gap-1">
              ⚠️ New location detected
              <span className="ml-1 text-xs font-normal bg-amber-200 text-amber-700 px-2 py-0.5 rounded-full">
                {geoRisk.riskLevel} RISK
              </span>
            </p>
            <p className="text-amber-700 text-sm mt-1">{geoRisk.riskReason}</p>
            {geoRisk.currentLocation && (
              <p className="text-amber-700 text-xs mt-1">
                📍 Current:{" "}
                <span className="font-medium">
                  {geoRisk.currentLocation.city}, {geoRisk.currentLocation.country}
                </span>
              </p>
            )}
            {geoRisk.previousLocation && (
              <p className="text-amber-700 text-xs">
                🏠 Usual:{" "}
                <span className="font-medium">
                  {geoRisk.previousLocation.city}, {geoRisk.previousLocation.country}
                </span>
              </p>
            )}
            <p className="text-amber-800 text-xs mt-2 font-medium">
              If this wasn&apos;t you, do NOT enter the OTP and change your password.
            </p>
          </div>
        )}

        {/* ── Admin badge ───────────────────────────────────────────────── */}
        {isAdminLogin && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium">
            🔐 Admin session — elevated verification required
          </div>
        )}

        {/* ── Expiry timer ──────────────────────────────────────────────── */}
        <div className={`mb-4 text-sm flex items-center gap-1.5 ${isExpired ? "text-red-500" : "text-gray-500"}`}>
          ⏱
          {isExpired ? (
            <span className="font-medium">OTP expired</span>
          ) : (
            <>
              Expires in{" "}
              <span className="font-mono font-medium">{formatCountdown(timeLeft)}</span>
            </>
          )}
        </div>

        {/* ── Error / Success ───────────────────────────────────────────── */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            {success}
          </div>
        )}

        {/* ── Form ──────────────────────────────────────────────────────── */}
        <form onSubmit={handleVerify} noValidate>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="6-digit OTP"
            value={otp}
            onChange={(e) => {
              setError("");
              setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
            }}
            disabled={loading || isExpired}
            className="w-full px-4 py-3 mb-4 border rounded-xl text-center text-2xl tracking-[0.4em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
          />

          <button
            type="submit"
            disabled={loading || isExpired || otp.length !== 6}
            className={`w-full py-3 text-white font-semibold rounded-xl transition
              disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2
              ${isAdminLogin
                ? "bg-red-600 hover:bg-red-700"
                : geoRisk?.isRisky
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-blue-600 hover:bg-blue-700"
              }`}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Verifying…
              </>
            ) : (
              isAdminLogin ? "Verify Admin OTP" : "Verify OTP"
            )}
          </button>
        </form>

        {/* ── Resend ────────────────────────────────────────────────────── */}
        <div className="mt-4 text-center text-sm">
          {resendLeft > 0 ? (
            <p className="text-gray-400">
              Resend available in{" "}
              <span className="font-mono font-medium">{formatCountdown(resendLeft)}</span>
            </p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
            >
              {resending ? "Redirecting…" : "Didn't receive it? Resend"}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => navigate("/")}
          className="mt-3 w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition"
        >
          ← Back to Sign In
        </button>
      </div>
    </div>
  );
};