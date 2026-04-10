import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { authAPI } from "../services/api";

export const SignIn = () => {
  const navigate = useNavigate();

  const [email,            setEmail]            = useState("");
  const [phoneNumber,      setPhoneNumber]      = useState("");
  const [selectedPrefix,   setSelectedPrefix]   = useState("+91");
  const [accountNumber,    setAccountNumber]    = useState("");
  const [password,         setPassword]         = useState("");
  const [preferredChannel, setPreferredChannel] = useState("sms");
  const [error,            setError]            = useState("");
  const [loading,          setLoading]          = useState(false);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !phoneNumber || !accountNumber || !password) {
      setError("All fields are required — email, phone number, account number, and password");
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.login({
        email,
        phoneNumber:      selectedPrefix + phoneNumber.trim(),
        accountNumber,
        password,
        preferredChannel,
      });

      localStorage.setItem("otpId",    response.otpId);
      localStorage.setItem("otpEmail", email.trim());

      const actualChannel = response.deliveryChannel ?? preferredChannel;
      const smsFailedFallback =
        preferredChannel === "sms" && actualChannel !== "sms";

      navigate("/verify-otp", {
        state: {
          otpId:           response.otpId,
          email:           email.trim(),
          deliveryChannel: actualChannel,
          geoRisk:         response.geoRisk ?? null,
          smsFailedFallback,
        },
      });
    } catch (err) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ────────────────────────────────────────────────────── */}
      <div className="w-full md:w-1/2 flex flex-col justify-center px-8 md:px-20 bg-white py-10">
        <h1 className="text-3xl font-bold text-blue-700 mb-6">MyBank</h1>
        <h2 className="text-2xl font-semibold text-gray-800 mb-1">Sign In</h2>
        <p className="text-gray-500 mb-6">Enter your credentials to continue</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSignIn} noValidate>
          {/* Email */}
          <label className="block text-gray-700 font-medium mb-1 text-sm">Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="w-full px-4 py-2 mb-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
          />

          {/* Phone Number */}
          <label className="block text-gray-700 font-medium mb-1 text-sm">Phone Number</label>
          <div className="flex gap-2 mb-4">
            <select
              value={selectedPrefix}
              onChange={(e) => setSelectedPrefix(e.target.value)}
              disabled={loading}
              className="border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
            >
              <option value="+91">+91 🇮🇳</option>
              <option value="+1">+1 🇺🇸</option>
              <option value="+44">+44 🇬🇧</option>
              <option value="+61">+61 🇦🇺</option>
              <option value="+971">+971 🇦🇪</option>
              <option value="+65">+65 🇸🇬</option>
              <option value="+49">+49 🇩🇪</option>
              <option value="+33">+33 🇫🇷</option>
              <option value="+81">+81 🇯🇵</option>
              <option value="+86">+86 🇨🇳</option>
            </select>
            <input
              type="tel"
              placeholder="XXXXX XXXXX"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
              disabled={loading}
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
            />
          </div>

          {/* Account Number */}
          <label className="block text-gray-700 font-medium mb-1 text-sm">Account Number</label>
          <input
            type="text"
            placeholder="ACC..."
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            required
            disabled={loading}
            className="w-full px-4 py-2 mb-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
          />

          {/* Password */}
          <label className="block text-gray-700 font-medium mb-1 text-sm">Password</label>
          <input
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            className="w-full px-4 py-2 mb-5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
          />

          {/* OTP Channel selector */}
          <label className="block text-gray-700 font-medium mb-2 text-sm">
            Send OTP via
          </label>
          <div className="flex gap-6 mb-6">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input
                type="radio"
                name="preferredChannel"
                value="sms"
                checked={preferredChannel === "sms"}
                onChange={() => setPreferredChannel("sms")}
                disabled={loading}
                className="accent-blue-600"
              />
              📱 SMS
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input
                type="radio"
                name="preferredChannel"
                value="email"
                checked={preferredChannel === "email"}
                onChange={() => setPreferredChannel("email")}
                disabled={loading}
                className="accent-blue-600"
              />
              📧 Email
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="flex justify-between mt-6 text-sm">
          <p className="text-gray-600">
            No account?{" "}
            <Link to="/signup" className="text-blue-600 hover:underline font-medium">
              Sign Up
            </Link>
          </p>
          <Link to="/admin/login" className="text-red-600 hover:underline font-medium">
            Admin Login
          </Link>
        </div>
      </div>

      {/* ── Right panel ───────────────────────────────────────────────────── */}
      <div className="hidden md:block md:w-1/2 bg-gradient-to-br from-blue-400 via-blue-300 to-blue-500" />
    </div>
  );
};
