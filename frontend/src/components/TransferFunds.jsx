import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { transactionAPI, authHelpers, userAPI } from "../services/api";

export function TransferFunds() {
  const navigate = useNavigate();

  const [recipientAccountNumber, setRecipientAccountNumber] = useState("");
  const [amount,                  setAmount]                  = useState("");
  const [password,                setPassword]                = useState("");
  const [loading,                 setLoading]                 = useState(false);
  const [error,                   setError]                   = useState("");
  const [currentUser,             setCurrentUser]             = useState(null);

  useEffect(() => {
    if (!authHelpers.isAuthenticated()) {
      navigate("/", { replace: true });
      return;
    }
    userAPI.getProfile()
      .then(setCurrentUser)
      .catch(() => {/* non-critical */});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmedAccount = recipientAccountNumber.trim();

    if (currentUser && trimmedAccount === currentUser.accountNumber) {
      setError("Cannot transfer to your own account.");
      return;
    }
    if (!trimmedAccount || !amount || !password) {
      setError("All fields are required.");
      return;
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError("Enter a valid amount.");
      return;
    }

    setLoading(true);
    try {
      const res = await transactionAPI.initiateTransaction({
        recipientAccountNumber: trimmedAccount,
        amount,
        password,
      });

      // Navigate with both otpId AND transactionId
      navigate("/transaction-otp", {
        state: {
          otpId:           res.otpId,
          transactionId:   res.transactionId,
          expirySeconds:   res.expirySeconds,
          deliveryChannel: res.deliveryChannel ?? "email",
        },
      });
    } catch (err) {
      if (err.message?.toLowerCase().includes("session")) {
        authHelpers.logout();
        navigate("/", { replace: true });
      } else {
        setError(err.message || "Transaction failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="p-6 max-w-2xl">
        <h2 className="text-2xl font-bold text-gray-800 mb-1">Payment Transfer</h2>
        <p className="text-gray-500 text-sm mb-6">
          Securely transfer funds to any account. An OTP will be sent to verify the transaction.
        </p>

        {/* ── Sender info ─────────────────────────────────────────────────── */}
        {currentUser && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm">
            <p className="text-blue-700 font-semibold mb-0.5">Sending from</p>
            <p className="text-blue-800 font-medium">{currentUser.name}</p>
            <p className="text-blue-600 font-mono text-xs">{currentUser.accountNumber}</p>
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="bg-white rounded-2xl shadow p-6 space-y-5">

          {/* Recipient account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recipient Account Number
            </label>
            <input
              type="text"
              value={recipientAccountNumber}
              onChange={(e) => { setError(""); setRecipientAccountNumber(e.target.value); }}
              placeholder="ACC..."
              disabled={loading}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
            />
            <p className="text-xs text-gray-400 mt-1">You cannot transfer to your own account.</p>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount (₹)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => { setError(""); setAmount(e.target.value); }}
              placeholder="e.g. 500"
              min="1"
              disabled={loading}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Account Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setError(""); setPassword(e.target.value); }}
              placeholder="Enter your password to authorise"
              disabled={loading}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
            />
          </div>

          {/* Info box */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
            ℹ️ An OTP will be sent to verify this transaction. Large amounts or logins from new locations may have shorter OTP validity.
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition
              disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing…
              </>
            ) : (
              "Continue to OTP Verification →"
            )}
          </button>
        </form>
      </main>
    </div>
  );
}