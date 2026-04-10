/**
 * api.js
 *
 * Production-grade API layer:
 * - 8s request timeout
 * - Safe JSON parsing (handles non-JSON server errors)
 * - Global 401 → auto logout
 * - All auth methods return typed shapes
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";

const REQUEST_TIMEOUT_MS = 8000;

// ─── Token helpers ─────────────────────────────────────────────────────────────
export const authHelpers = {
  setToken:        (t) => localStorage.setItem("token", t),
  getToken:        ()  => localStorage.getItem("token"),
  removeToken:     ()  => localStorage.removeItem("token"),

  setUser: (user) => {
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("isAdmin", user?.isAdmin ? "true" : "false");
  },
  getUser: () => {
    const u = localStorage.getItem("user");
    return u ? JSON.parse(u) : null;
  },

  isAdmin:         ()  => localStorage.getItem("isAdmin") === "true",
  isAuthenticated: ()  => !!localStorage.getItem("token"),

  logout: () => {
    ["token", "user", "isAdmin", "adminUser", "otpId", "otpEmail"].forEach(
      (k) => localStorage.removeItem(k)
    );
  },
};

// ─── Core request ──────────────────────────────────────────────────────────────
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const token = authHelpers.getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, { ...options, headers, signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw new Error("Request timed out. Please check your connection.");
    }
    throw new Error("Network error. Please check your connection.");
  }
  clearTimeout(timer);

  // ── Safe JSON parse ────────────────────────────────────────────────────────
  let data;
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    data = await res.json();
  } else {
    const text = await res.text();
    data = { message: text || `HTTP ${res.status}` };
  }

  // ── Global 401 → auto logout ───────────────────────────────────────────────
  if (res.status === 401) {
    authHelpers.logout();
    window.location.href = "/";
    throw new Error(data.message || "Session expired. Please log in again.");
  }

  if (!res.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data;
}

// ─── Auth API ──────────────────────────────────────────────────────────────────
export const authAPI = {
  /**
   * Login returns:
   *   { message, otpId, deliveryChannel, geoRisk? }
   */
  login: (creds) =>
    apiRequest("/login", {
      method: "POST",
      body: JSON.stringify({
        email:            creds.email?.toLowerCase().trim(),
        phoneNumber:      creds.phoneNumber?.trim(),
        accountNumber:    creds.accountNumber?.trim(),
        password:         creds.password,
        preferredChannel: creds.preferredChannel ?? "sms",
        isAdminLogin:     creds.isAdminLogin === true,
      }),
    }),

  /**
   * Verify uses otpId + otp — NOT email.
   * Returns: { message, user, token, isAdmin }
   */
  verifyOTP: (data) =>
    apiRequest("/verify", {
      method: "POST",
      body: JSON.stringify({
        otpId:        data.otpId,
        otp:          data.otp,
        isAdminLogin: data.isAdminLogin === true,
      }),
    }),

  register: (userData) =>
    apiRequest("/register", {
      method: "POST",
      body: JSON.stringify({
        name:        userData.name,
        email:       userData.email?.toLowerCase().trim(),
        phoneNumber: userData.phone,
        password:    userData.password,
      }),
    }),

  initiateRegistration: (userData) =>
    apiRequest("/register/initiate", {
      method: "POST",
      body: JSON.stringify({
        name:        userData.name,
        email:       userData.email?.toLowerCase().trim(),
        phoneNumber: userData.phone,
        password:    userData.password,
        lat:         userData.lat ?? undefined,
        lon:         userData.lon ?? undefined,
      }),
    }),

  verifyRegistration: (otpId, otp) =>
    apiRequest("/register/verify", {
      method: "POST",
      body: JSON.stringify({ otpId, otp }),
    }),
};

// ─── User API ──────────────────────────────────────────────────────────────────
export const userAPI = {
  getProfile:  () => apiRequest("/me"),
  getBalance:  () => apiRequest("/balance"),
  getAllUsers:  () => apiRequest("/user/all"),

  initiateContactVerification: (data) =>
    apiRequest("/verify-contact/initiate", {
      method: "POST",
      body: JSON.stringify({ type: data.type }),
    }),

  confirmContactVerification: (data) =>
    apiRequest("/verify-contact/confirm", {
      method: "POST",
      body: JSON.stringify({
        otpId: data.otpId,
        otp:   data.otp,
        type:  data.type,
      }),
    }),
};

// ─── Transaction API ───────────────────────────────────────────────────────────
export const transactionAPI = {
  /**
   * Initiate returns:
   *   { message, otpId, transactionId, expirySeconds, deliveryChannel }
   */
  initiateTransaction: (data) =>
    apiRequest("/transaction/initiate", {
      method: "POST",
      body: JSON.stringify({
        amount:                 data.amount,
        password:               data.password,
        recipientAccountNumber: data.recipientAccountNumber,
      }),
    }),

  /**
   * Verify uses otpId + otp + transactionId
   */
  verifyTransaction: (otpId, otp, transactionId) =>
    apiRequest("/transaction/verify", {
      method: "POST",
      body: JSON.stringify({ otpId, otp, transactionId }),
    }),

  getHistory: (page = 1, limit = 10) =>
    apiRequest(`/transactions?page=${page}&limit=${limit}`),
};