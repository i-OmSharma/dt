import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authAPI } from "../services/api";
import { useCountdown, formatCountdown } from "../hooks/useAuth";

const COUNTRY_CODES = [
  { value: "+91",  label: "+91 🇮🇳 India" },
  { value: "+1",   label: "+1 🇺🇸 USA/Canada" },
  { value: "+44",  label: "+44 🇬🇧 UK" },
  { value: "+61",  label: "+61 🇦🇺 Australia" },
  { value: "+971", label: "+971 🇦🇪 UAE" },
  { value: "+65",  label: "+65 🇸🇬 Singapore" },
  { value: "+49",  label: "+49 🇩🇪 Germany" },
  { value: "+33",  label: "+33 🇫🇷 France" },
  { value: "+81",  label: "+81 🇯🇵 Japan" },
  { value: "+86",  label: "+86 🇨🇳 China" },
];

export function ChangePassword() {
  const navigate = useNavigate();

  // ── Step 1 state ──────────────────────────────────────────────────────────
  const [prefix,      setPrefix]      = useState("+91");
  const [phone,       setPhone]       = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [step1Error,  setStep1Error]  = useState("");
  const [step1Loading,setStep1Loading]= useState(false);

  // ── Step 2 state ──────────────────────────────────────────────────────────
  const [step,            setStep]            = useState(1);
  const [otpId,           setOtpId]           = useState("");
  const [deliveryChannel, setDeliveryChannel] = useState("email");
  const [otp,             setOtp]             = useState("");
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step2Error,      setStep2Error]      = useState("");
  const [step2Loading,    setStep2Loading]    = useState(false);
  const [success,         setSuccess]         = useState(false);

  // ── OTP countdown (5 min) ─────────────────────────────────────────────────
  const { timeLeft, start: startCountdown } = useCountdown(0);
  const isExpired = step === 2 && timeLeft === 0;

  // ── Step 1: request OTP ───────────────────────────────────────────────────
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setStep1Error("");

    if (!phone.trim()) {
      setStep1Error("Phone number is required.");
      return;
    }

    setStep1Loading(true);
    try {
      const res = await authAPI.initiateChangePassword({
        phoneNumber: prefix + phone.trim(),
        oldPassword,
      });

      setOtpId(res.otpId);
      setDeliveryChannel(res.deliveryChannel ?? "email");
      startCountdown(300);
      setStep(2);
    } catch (err) {
      setStep1Error(err?.message || "Failed to send OTP. Please try again.");
    } finally {
      setStep1Loading(false);
    }
  };

  // ── Step 2: verify OTP + set new password ─────────────────────────────────
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setStep2Error("");

    if (!otp.trim() || otp.trim().length !== 6) {
      setStep2Error("Please enter the 6-digit OTP.");
      return;
    }
    if (isExpired) {
      setStep2Error("OTP has expired. Please go back and request a new one.");
      return;
    }
    if (newPassword.length < 8) {
      setStep2Error("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setStep2Error("Passwords do not match.");
      return;
    }

    setStep2Loading(true);
    try {
      await authAPI.verifyChangePassword({
        otpId,
        otp: otp.trim(),
        newPassword,
        confirmPassword,
      });

      setSuccess(true);
      setTimeout(() => navigate("/", { replace: true }), 3000);
    } catch (err) {
      setStep2Error(err?.message || "Verification failed. Please try again.");
    } finally {
      setStep2Loading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8">

        {/* ── Step 1: Request OTP ─────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <h2 className="text-2xl font-semibold text-gray-800 mb-1">
              Change Password
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              Enter your phone number and current password to receive an OTP.
            </p>

            {step1Error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {step1Error}
              </div>
            )}

            <form onSubmit={handleRequestOTP} noValidate>
              {/* Phone */}
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <div className="flex gap-2 mb-4">
                <select
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  className="border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => { setStep1Error(""); setPhone(e.target.value); }}
                  placeholder="9835065726"
                  required
                  disabled={step1Loading}
                  className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                />
              </div>

              {/* Old password */}
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Password
              </label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => { setStep1Error(""); setOldPassword(e.target.value); }}
                placeholder="Enter your current password"
                required
                disabled={step1Loading}
                className="w-full px-4 py-2 mb-6 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              />

              <button
                type="submit"
                disabled={step1Loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition
                  disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {step1Loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending OTP…
                  </>
                ) : (
                  "Send OTP"
                )}
              </button>
            </form>

            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition"
            >
              ← Go back
            </button>
          </>
        )}

        {/* ── Step 2: Verify OTP + new password ──────────────────────────── */}
        {step === 2 && (
          <>
            <h2 className="text-2xl font-semibold text-gray-800 mb-1">
              Enter OTP &amp; New Password
            </h2>
            <p className="text-gray-500 text-sm mb-4">
              OTP sent via{" "}
              <span className="font-medium text-blue-600">
                {deliveryChannel === "sms" ? "📱 SMS" : "📧 Email"}
              </span>
            </p>

            {/* Delivery channel banner */}
            {deliveryChannel === "sms" ? (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
                📱 OTP sent via SMS
              </div>
            ) : (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex items-center gap-2">
                📧 OTP sent via Email
              </div>
            )}

            {/* Success state */}
            {success && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm font-medium">
                ✅ Password changed! Redirecting to login…
              </div>
            )}

            {/* Countdown */}
            <div className={`mb-4 text-sm flex items-center gap-1.5 ${isExpired ? "text-red-500" : "text-gray-500"}`}>
              ⏱{" "}
              {isExpired ? (
                <span className="font-medium">OTP expired — go back and request a new one</span>
              ) : (
                <>
                  Expires in{" "}
                  <span className="font-mono font-medium">{formatCountdown(timeLeft)}</span>
                </>
              )}
            </div>

            {step2Error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {step2Error}
              </div>
            )}

            {!success && (
              <form onSubmit={handleChangePassword} noValidate>
                {/* OTP input */}
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  6-digit OTP
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => {
                    setStep2Error("");
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                  }}
                  disabled={step2Loading || isExpired}
                  className="w-full px-4 py-3 mb-4 border rounded-xl text-center text-2xl tracking-[0.4em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
                />

                {/* New password */}
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => { setStep2Error(""); setNewPassword(e.target.value); }}
                  placeholder="At least 8 characters"
                  required
                  disabled={step2Loading}
                  className="w-full px-4 py-2 mb-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                />

                {/* Confirm password */}
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => { setStep2Error(""); setConfirmPassword(e.target.value); }}
                  placeholder="Re-enter new password"
                  required
                  disabled={step2Loading}
                  className="w-full px-4 py-2 mb-6 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                />

                <button
                  type="submit"
                  disabled={step2Loading || isExpired || otp.length !== 6}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition
                    disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {step2Loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Changing Password…
                    </>
                  ) : (
                    "Change Password"
                  )}
                </button>
              </form>
            )}

            {!success && (
              <button
                type="button"
                onClick={() => { setStep(1); setOtp(""); setStep2Error(""); }}
                className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition"
              >
                ← Back to request new OTP
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
