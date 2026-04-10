import { useState } from "react";
import { userAPI } from "../services/api";

export function VerifyContactOverlay({ user, onComplete }) {
  const [localEmailVerified, setLocalEmailVerified] = useState(
    user?.emailVerified ?? false
  );
  const [localPhoneVerified, setLocalPhoneVerified] = useState(
    user?.phoneVerified ?? false
  );

  const [activeVerification, setActiveVerification] = useState(null); // "email" | "phone" | null
  const [verifyOtp,          setVerifyOtp]          = useState("");
  const [verifyError,        setVerifyError]        = useState("");
  const [verifyLoading,      setVerifyLoading]      = useState(false);
  const [currentOtpId,       setCurrentOtpId]       = useState("");
  const [sendingFor,         setSendingFor]         = useState(null); // "email" | "phone" | null

  const handleSendOTP = async (type) => {
    setVerifyError("");
    setVerifyOtp("");
    setSendingFor(type);
    try {
      const res = await userAPI.initiateContactVerification({ type });
      setCurrentOtpId(res.otpId);
      setActiveVerification(type);
    } catch (err) {
      setVerifyError(err.message || "Failed to send OTP. Please try again.");
    } finally {
      setSendingFor(null);
    }
  };

  const handleConfirmOTP = async () => {
    if (verifyOtp.length !== 6 || verifyLoading) return;
    setVerifyError("");
    setVerifyLoading(true);
    try {
      await userAPI.confirmContactVerification({
        otpId: currentOtpId,
        otp:   verifyOtp,
        type:  activeVerification,
      });
      if (activeVerification === "email") setLocalEmailVerified(true);
      if (activeVerification === "phone") setLocalPhoneVerified(true);
      setActiveVerification(null);
      setVerifyOtp("");
    } catch (err) {
      setVerifyError(err.message || "Verification failed. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const allVerified = localEmailVerified && localPhoneVerified;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(0,0,0,0.5)" }}
    >
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🔐</div>
          <h2 className="text-2xl font-bold text-gray-800">Verify Your Details</h2>
          <p className="text-gray-500 text-sm mt-2">
            Verify both your email and phone number to access all features.
          </p>
        </div>

        {/* Email row */}
        <div
          className={`flex items-center justify-between p-4 rounded-xl mb-3 ${
            localEmailVerified
              ? "bg-green-50 border border-green-200"
              : "bg-gray-50 border border-gray-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">{localEmailVerified ? "✅" : "📧"}</span>
            <div>
              <p className="font-medium text-gray-800 text-sm">Email Address</p>
              <p className="text-gray-500 text-xs">{user?.email}</p>
            </div>
          </div>
          {!localEmailVerified && (
            <button
              onClick={() => handleSendOTP("email")}
              disabled={sendingFor === "email"}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              {sendingFor === "email" ? "Sending…" : "Verify"}
            </button>
          )}
          {localEmailVerified && (
            <span className="text-green-600 text-sm font-medium">Verified</span>
          )}
        </div>

        {/* Phone row */}
        <div
          className={`flex items-center justify-between p-4 rounded-xl mb-6 ${
            localPhoneVerified
              ? "bg-green-50 border border-green-200"
              : "bg-gray-50 border border-gray-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">{localPhoneVerified ? "✅" : "📱"}</span>
            <div>
              <p className="font-medium text-gray-800 text-sm">Phone Number</p>
              <p className="text-gray-500 text-xs">{user?.phoneNumber ?? "Not set"}</p>
            </div>
          </div>
          {!localPhoneVerified && (
            <button
              onClick={() => handleSendOTP("phone")}
              disabled={sendingFor === "phone"}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              {sendingFor === "phone" ? "Sending…" : "Verify"}
            </button>
          )}
          {localPhoneVerified && (
            <span className="text-green-600 text-sm font-medium">Verified</span>
          )}
        </div>

        {/* OTP input — shown after clicking Verify */}
        {activeVerification && (
          <div className="border-t pt-4">
            <p className="text-sm text-gray-600 mb-3">
              Enter OTP sent to your{" "}
              <span className="font-medium">
                {activeVerification === "email" ? "email" : "phone"}
              </span>
              :
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={verifyOtp}
              onChange={(e) => {
                setVerifyError("");
                setVerifyOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
              }}
              placeholder="6-digit OTP"
              disabled={verifyLoading}
              className="w-full px-4 py-3 border rounded-xl text-center text-xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 mb-3 disabled:bg-gray-50"
            />
            {verifyError && (
              <p className="text-red-600 text-sm mb-3">{verifyError}</p>
            )}
            <button
              onClick={handleConfirmOTP}
              disabled={verifyOtp.length !== 6 || verifyLoading}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition"
            >
              {verifyLoading ? "Verifying…" : "Confirm OTP"}
            </button>
          </div>
        )}

        {/* Both verified → close */}
        {allVerified && (
          <button
            onClick={onComplete}
            className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition mt-2"
          >
            ✅ All Verified — Continue to App
          </button>
        )}
      </div>
    </div>
  );
}
