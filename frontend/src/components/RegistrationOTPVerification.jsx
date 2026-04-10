import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { authAPI } from "../services/api";
import { useCountdown, formatCountdown } from "../hooks/useAuth";

function channelLabel(ch) {
  if (ch === "sms")   return "📱 SMS";
  if (ch === "voice") return "📞 Voice call";
  return "📧 Email";
}

export const RegistrationOTPVerification = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const otpId           = location.state?.otpId           ?? "";
  const email           = location.state?.email           ?? "";
  const deliveryChannel = location.state?.deliveryChannel ?? "email";

  const { timeLeft } = useCountdown(600); // 10 minutes

  const [otp,     setOtp]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!otpId) {
      navigate("/signup", { replace: true });
    }
  }, [otpId, navigate]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");

    if (!otp.trim() || otp.trim().length !== 6) {
      setError("Please enter the 6-digit OTP.");
      return;
    }
    if (timeLeft === 0) {
      setError("OTP has expired. Please sign up again.");
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.verifyRegistration(otpId, otp.trim());

      navigate("/account-success", {
        replace: true,
        state: {
          accountNumber: response.user.accountNumber,
          email:         response.user.email,
        },
      });
    } catch (err) {
      setError(err.message || "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isExpired = timeLeft === 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8">

        <h2 className="text-2xl font-semibold text-gray-800 mb-1">
          Verify your email
        </h2>
        <p className="text-gray-500 text-sm mb-4">
          OTP sent via{" "}
          <span className="font-medium text-blue-600">
            {channelLabel(deliveryChannel)}
          </span>
          {email && (
            <>
              {" "}to <span className="font-medium">{email}</span>
            </>
          )}
        </p>
        <p className="text-gray-400 text-xs mb-6">
          Complete registration by entering the OTP below.
        </p>

        {/* Expiry timer */}
        <div
          className={`mb-4 text-sm flex items-center gap-1.5 ${
            isExpired ? "text-red-500" : "text-gray-500"
          }`}
        >
          ⏱{" "}
          {isExpired ? (
            <span className="font-medium">OTP expired</span>
          ) : (
            <>
              Expires in{" "}
              <span className="font-mono font-medium">
                {formatCountdown(timeLeft)}
              </span>
            </>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

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
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition
              disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Verifying…
              </>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            navigate("/signup");
          }}
          className="mt-3 w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition"
        >
          ← Back to Sign Up
        </button>
      </div>
    </div>
  );
};
