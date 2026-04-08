import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authAPI } from "../services/api";

export const AdminSignIn = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
  const res = await authAPI.login({
    email,
    password,
    isAdminLogin: true,
  });

  navigate("/verify-otp", {
    state: {
      email,
      isAdminLogin: true,
      message: res.message || "OTP sent to your email",
    },
  });
} catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Admin login failed"
      );
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Section */}
      <div className="w-1/2 flex flex-col justify-center px-20 bg-white">
        <h1 className="text-3xl font-bold text-blue-700 mb-6">MyBank Admin</h1>

        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          Admin Login
        </h2>

        <p className="text-gray-500 mb-8">
          Only authorized administrators can access this dashboard
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleAdminLogin}>
          <label className="block text-gray-700 font-medium mb-1">Email</label>
          <input
            type="email"
            placeholder="Enter admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 mb-6 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />

          <label className="block text-gray-700 font-medium mb-1">
            Password
          </label>
          <input
            type="password"
            placeholder="Enter admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 mb-8 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />

          <button
            type="submit"
            className="w-full py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition"
          >
            Login as Admin
          </button>
        </form>

        <p className="text-gray-600 text-sm mt-6">
          Normal user?{" "}
          <Link
            to="/"
            className="text-blue-600 hover:underline font-medium"
          >
            Go to User Login
          </Link>
        </p>
      </div>

      {/* Right Section */}
      <div className="w-1/2 bg-gradient-to-br from-red-400 via-red-300 to-red-500 flex items-center justify-center">
        <div className="text-white text-center px-10">
          <h2 className="text-4xl font-bold mb-4">Admin Dashboard</h2>
          <p className="text-lg opacity-90">
            Manage users, monitor OTP verification, and track transactions
          </p>
        </div>
      </div>
    </div>
  );
};