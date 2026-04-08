import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { authAPI } from "../services/api";

export const SignIn = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError("");

    // Basic validation
    if (!email || !accountNumber || !password) {
      setError("Email, Account Number, and Password are required!");
      return;
    }

    try {
      // CALL BACKEND LOGIN API
      const response = await authAPI.login({
        email,
        accountNumber,
        password,
      });

      // Navigate to OTP verify page
      navigate("/verify-otp", {
        state: {
          email,
          message: response.message || "OTP sent to your email",
        },
      });
    } catch (err) {
      setError(err.message || "Login failed. Please check your credentials.");
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Section */}
      <div className="w-1/2 flex flex-col justify-center px-20 bg-white">
        <h1 className="text-3xl font-bold text-blue-700 mb-6">MyBank</h1>

        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Sign In</h2>
        <p className="text-gray-500 mb-8">Enter your details</p>

        {/* Error Box */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSignIn}>
          {/* Email */}
          <label className="block text-gray-700 font-medium mb-1">Email</label>
          <input
            type="email"
            placeholder="Enter your Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2 mb-6 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Account Number */}
          <label className="block text-gray-700 font-medium mb-1">Account Number</label>
          <input
            type="text"
            placeholder="Enter your Account Number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            required
            className="w-full px-4 py-2 mb-6 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Password */}
          <label className="block text-gray-700 font-medium mb-1">Password</label>
          <input
            type="password"
            placeholder="Enter your Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2 mb-8 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
          >
            Enter
          </button>
        </form>

        <div className="flex justify-between mt-6 text-sm">
  <p className="text-gray-600">
    Don’t have an account?{" "}
    <Link to="/signup" className="text-blue-600 hover:underline font-medium">
      Sign Up
    </Link>
  </p>

  <Link
    to="/admin/login"
    className="text-red-600 hover:underline font-medium"
  >
    Admin Login
  </Link>
</div>
      </div>

      {/* Right Section */}
      <div className="w-1/2 bg-gradient-to-br from-blue-300 via-blue-200 to-blue-300"></div>
    </div>
  );
};
