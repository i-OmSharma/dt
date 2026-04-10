import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authAPI } from "../services/api";

export const SignUp = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: ""
  });
  const [error, setError] = useState("");
  const [selectedPrefix, setSelectedPrefix] = useState("+91");
  const [geoCoords, setGeoCoords] = useState(null);

  const requestLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGeoCoords({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        (err) => {
          console.warn("Location permission denied:", err.message);
        }
      );
    }
  };

  useEffect(() => {
    requestLocation();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.phone.trim()) {
      setError("Phone number is required");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      const response = await authAPI.initiateRegistration({
        name:     formData.name,
        email:    formData.email,
        phone:    selectedPrefix + formData.phone.trim(),
        password: formData.password,
        lat:      geoCoords?.lat,
        lon:      geoCoords?.lon,
      });

      navigate("/verify-registration", {
        state: {
          otpId:           response.otpId,
          email:           formData.email.toLowerCase().trim(),
          deliveryChannel: response.deliveryChannel ?? "email",
        },
      });
    } catch (err) {
      setError(err?.message || "Registration failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="w-1/2 flex flex-col justify-center px-20 bg-white py-20">
        <h1 className="text-3xl font-bold text-blue-700 mb-6">MyBank</h1>
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Sign Up</h2>
        <p className="text-gray-500 mb-8">Open your secure account</p>

        {/* Location permission banner */}
        {!geoCoords && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex items-center gap-2">
            📍 We need your location to protect your account from unauthorized access.
            <button
              type="button"
              onClick={requestLocation}
              className="underline font-medium whitespace-nowrap"
            >
              Allow
            </button>
          </div>
        )}

        {/* Error Box */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup}>
          {/* Full Name */}
          <label className="block text-gray-700 font-medium mb-1">Full Name</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter your full name"
            required
            className="w-full px-4 py-2 mb-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Email */}
          <label className="block text-gray-700 font-medium mb-1">Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter your email"
            required
            className="w-full px-4 py-2 mb-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Phone */}
          <label className="block text-gray-700 font-medium mb-1">Phone Number</label>
          <div className="flex gap-2 mb-4">
            <select
              value={selectedPrefix}
              onChange={(e) => setSelectedPrefix(e.target.value)}
              className="border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="+91">+91 🇮🇳 India</option>
              <option value="+1">+1 🇺🇸 USA/Canada</option>
              <option value="+44">+44 🇬🇧 UK</option>
              <option value="+61">+61 🇦🇺 Australia</option>
              <option value="+971">+971 🇦🇪 UAE</option>
              <option value="+65">+65 🇸🇬 Singapore</option>
              <option value="+49">+49 🇩🇪 Germany</option>
              <option value="+33">+33 🇫🇷 France</option>
              <option value="+81">+81 🇯🇵 Japan</option>
              <option value="+86">+86 🇨🇳 China</option>
            </select>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="9835065726 *"
              required
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Password */}
          <label className="block text-gray-700 font-medium mb-1">Password</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Enter your password"
            required
            className="w-full px-4 py-2 mb-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Confirm Password */}
          <label className="block text-gray-700 font-medium mb-1">Confirm Password</label>
          <input
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="Re-enter your password"
            required
            className="w-full px-4 py-2 mb-6 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Terms */}
          <div className="flex items-center mb-6">
            <input type="checkbox" className="mr-2" />
            <p className="text-sm text-gray-600">
              I agree to the <a href="#" className="text-blue-600">Terms & Conditions</a>
            </p>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
          >
            Create Account
          </button>
        </form>

        <p className="text-gray-600 text-sm mt-6">
          Already have an account?{" "}
          <Link to="/" className="text-blue-600 hover:underline font-medium">
            Sign In
          </Link>
        </p>
      </div>

      <div className="w-1/2 bg-gradient-to-br from-blue-300 via-blue-200 to-blue-300"></div>
    </div>
  );
};
