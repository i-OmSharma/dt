import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authAPI } from "../services/api";

export const AdminSignIn = () => {
  const navigate = useNavigate();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await authAPI.login({
        email,
        password,
        isAdminLogin: true,
      });

      // Persist otpId for page-refresh safety
      localStorage.setItem("otpId",    res.otpId);
      localStorage.setItem("otpEmail", email.trim());
      sessionStorage.setItem("isAdminLogin", "true");

      navigate("/verify-otp", {
        state: {
          otpId:           res.otpId,
          email:           email.trim(),
          isAdminLogin:    true,
          deliveryChannel: res.deliveryChannel ?? "email",
          geoRisk:         res.geoRisk ?? null,
          message:         res.message,
        },
      });
    } catch (err) {
      setError(err.message || "Admin login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ──────────────────────────────────────────────────── */}
      <div className="w-full md:w-1/2 flex flex-col justify-center px-8 md:px-20 bg-white">
        <h1 className="text-3xl font-bold text-red-600 mb-6">SecOTP Admin</h1>
        <h2 className="text-2xl font-semibold text-gray-800 mb-1">Admin Login</h2>
        <p className="text-gray-500 text-sm mb-8">
          Restricted access — authorized administrators only.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleAdminLogin} noValidate>
          <label className="block text-gray-700 font-medium mb-1 text-sm">Email</label>
          <input
            type="email"
            placeholder="admin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="w-full px-4 py-2.5 mb-5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 disabled:bg-gray-50"
          />

          <label className="block text-gray-700 font-medium mb-1 text-sm">Password</label>
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            className="w-full px-4 py-2.5 mb-8 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 disabled:bg-gray-50"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition
              disabled:bg-red-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign in as Admin"
            )}
          </button>
        </form>

        <p className="text-gray-600 text-sm mt-6">
          Regular user?{" "}
          <Link to="/" className="text-blue-600 hover:underline font-medium">
            Go to User Login
          </Link>
        </p>
      </div>

      {/* ── Right panel ─────────────────────────────────────────────────── */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-red-500 via-red-400 to-red-600 items-center justify-center">
        <div className="text-white text-center px-10">
          <h2 className="text-4xl font-bold mb-3">Admin Dashboard</h2>
          <p className="text-lg opacity-90">
            Manage users, monitor OTP flows, and audit transactions.
          </p>
        </div>
      </div>
    </div>
  );
};