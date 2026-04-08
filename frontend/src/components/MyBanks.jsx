import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { userAPI, authHelpers } from "../services/api";

export function MyBanks() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authHelpers.isAuthenticated()) {
      navigate("/");
      return;
    }

    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const profile = await userAPI.getProfile();
      setUser(profile);

      const bal = await userAPI.getBalance();
      setBalance(bal.balance);
    } catch (err) {
      authHelpers.logout();
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  // mask account number (logic only)
  const maskAccountNumber = (accNum) => {
    if (!accNum) return "•••• •••• •••• 0000";
    return "•••• •••• •••• " + accNum.slice(-4);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50 items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-semibold">My Bank Accounts</h1>
        <p className="text-gray-500 mb-6">
          Effortlessly Manage Your Banking Activities
        </p>

        <div className="bg-blue-600 text-white p-6 rounded-xl shadow-md w-80">
          <div className="text-lg font-semibold">
            {user?.name || "Account_1"}
          </div>

          <div className="text-2xl font-bold mt-2">
            ₹{balance.toFixed(2)}
          </div>

          <div className="mt-4 text-sm tracking-widest">
            {maskAccountNumber(user?.accountNumber)}
          </div>

          <div className="mt-2 text-xs opacity-75">
            ACCOUNT ID: {user?.accountNumber || "N/A"}
          </div>
        </div>
      </main>
    </div>
  );
}
