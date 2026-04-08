import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { transactionAPI, authHelpers, userAPI } from "../services/api";

export function TransferFunds() {
  const navigate = useNavigate();

  const [recipientAccountNumber, setRecipientAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const profile = await userAPI.getProfile();
        setCurrentUser(profile);
      } catch (err) {
        console.error("Failed to fetch user profile:", err);
      }
    };
    fetchCurrentUser();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Trim whitespace from account number
    const trimmedRecipientAccount = recipientAccountNumber.trim();

    // Frontend validation to prevent self-transfer
    if (currentUser && trimmedRecipientAccount === currentUser.accountNumber) {
      alert("Cannot transfer to your own account. Please enter a different account number.");
      return;
    }

    if (!trimmedRecipientAccount || !amount || !password) {
      alert("Please fill in all fields");
      return;
    }

    try {
      setLoading(true);

      const res = await transactionAPI.initiateTransaction({
        recipientAccountNumber: trimmedRecipientAccount,
        amount,
        password,
      });

      // navigate to OTP verification page
      navigate("/transaction-otp", {
        state: { transactionId: res.transactionId,
          expirySeconds: res.expirySeconds,//added
        },
      });
    } catch (err) {
      alert(err.message || "Transaction failed");
      if (err.message?.includes("Unauthorized")) {
        authHelpers.logout();
        navigate("/");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <main className="flex-1 p-6">
        <h2 className="text-2xl font-bold mb-2">Payment Transfer</h2>
        <p className="text-gray-500 mb-6">
          Please provide any specific details or notes related to the payment
          transfer
        </p>

        {/* Current User Info */}
        {currentUser && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 max-w-2xl">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">Sending From:</h3>
            <p className="text-blue-700">
              <span className="font-medium">{currentUser.name}</span> ({currentUser.email})
            </p>
            <p className="text-blue-600 font-mono text-sm mt-1">
              Account: {currentUser.accountNumber}
            </p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg shadow p-6 max-w-2xl"
        >
          {/* Transfer details */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Transfer details</h3>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Source Bank
            </label>
            <select
              defaultValue=""
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
            >
              <option value="" disabled>
                -- Select Source Bank --
              </option>
              <option value="savings">Savings Account</option>
              <option value="credit">Credit Card</option>
            </select>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transfer Note (Optional)
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 h-20 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Write a short note here"
            />
          </div>

          {/* Bank account details */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">
              Bank account details
            </h3>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Receiver's Account Number
            </label>
            <input
              type="text"
              value={recipientAccountNumber}
              onChange={(e) => setRecipientAccountNumber(e.target.value)}
              placeholder="Enter the recipient's account number"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mb-4">
              Note: You cannot transfer to your own account
            </p>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="ex: 500"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Account Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700"
          >
            {loading ? "Processing..." : "Transfer Funds"}
          </button>
        </form>
      </main>
    </div>
  );
}
