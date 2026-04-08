const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";

// Helpers
const getToken = () => localStorage.getItem("token");

const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const token = getToken();

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data;
};

// Auth APIs
export const authAPI = {
  register: async (userData) =>
    apiRequest("/register", {
      method: "POST",
      body: JSON.stringify({
        name: userData.name,
        email: userData.email,
        phoneNumber: userData.phone,
        password: userData.password,
      }),
    }),

  login: async (creds) =>
    apiRequest("/login", {
      method: "POST",
      body: JSON.stringify({
        email: creds.email,
        accountNumber: creds.accountNumber,
        password: creds.password,
        isAdminLogin: creds.isAdminLogin === true,
      }),
    }),

  verifyOTP: async (data) =>
    apiRequest("/verify", {
      method: "POST",
      body: JSON.stringify({
        email: data.email,
        otp: data.otp,
        isAdminLogin: data.isAdminLogin === true,
      }),
    }),
};

// User APIs
export const userAPI = {
  getProfile: () => apiRequest("/me"),

  getBalance: () => apiRequest("/balance"),

  getAllUsers: () => apiRequest("/user/all"),
};

// Transaction APIs
export const transactionAPI = {
  initiateTransaction: (data) =>
    apiRequest("/transaction/initiate", {
      method: "POST",
      body: JSON.stringify({
        amount: data.amount,
        password: data.password,
        recipientAccountNumber: data.recipientAccountNumber,
      }),
    }),

  verifyTransaction: (otp, transactionId) =>
    apiRequest("/transaction/verify", {
      method: "POST",
      body: JSON.stringify({
        otp,
        transactionId,
      }),
    }),

  getHistory: () => apiRequest("/transactions"),
};

// Local Storage Helpers
export const authHelpers = {
  setToken: (token) => localStorage.setItem("token", token),

  getToken,

  removeToken: () => localStorage.removeItem("token"),

  setUser: (user) => {
    localStorage.setItem("user", JSON.stringify(user));

    // store admin flag separately also
    localStorage.setItem("isAdmin", user?.isAdmin ? "true" : "false");
  },

  getUser: () => {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  },

  removeUser: () => {
    localStorage.removeItem("user");
    localStorage.removeItem("isAdmin");
  },

  isAdmin: () => localStorage.getItem("isAdmin") === "true",

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("isAdmin");
    localStorage.removeItem("adminUser");
  },

  isAuthenticated: () => !!localStorage.getItem("token"),
};