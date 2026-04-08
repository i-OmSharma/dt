// src/components/TransactionHistory.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { userAPI, transactionAPI, authHelpers } from "../services/api";

export function TransactionHistory() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);

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

      // 1️⃣ Profile
      const profile = await userAPI.getProfile();
      setUser(profile);

      // 2️⃣ Balance
      const bal = await userAPI.getBalance();
      setBalance(bal.balance);

      // 3️⃣ Transactions
      const tx = await transactionAPI.getHistory();
      setTransactions(tx.transactions || []);
    } catch (err) {
      authHelpers.logout();
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  // Mask account number (logic only)
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
      <div className="flex flex-col w-full h-screen">
        <main className="flex-1 p-6 overflow-y-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-semibold">Transaction History</h1>
              <p className="text-gray-600">
                See your bank details and transactions.
              </p>
            </div>
          </div>

          {/* Account Card */}
          <div className="bg-blue-600 text-white rounded-lg p-4 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold">
                {user?.name || "Primary Account"}
              </h2>
              <p className="text-sm">
                Account Gold Standard 0% Interest Checking
              </p>
              <p className="text-sm mt-1">
                {maskAccountNumber(user?.accountNumber)}
              </p>
            </div>
            <p className="text-xl font-bold">₹{balance.toFixed(2)}</p>
          </div>

          {/* Transactions Table */}
          <div className="bg-white mt-6 rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold mb-4">Transactions</h3>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b text-gray-600">
                  <th className="py-2">Transaction</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Date</th>
                  <th className="py-2">Channel</th>
                  <th className="py-2">Category</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-6 text-gray-500">
                      No transactions yet. Start by transferring funds.
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => (
                    <tr key={t.transactionId} className="border-b">
                      <td className="py-2">{t.transactionId}</td>
                      <td className="py-2">₹{t.amount}</td>
                      <td className="py-2">{t.status}</td>
                      <td className="py-2">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2">
                        {t.sender.email === user.email ? "Debit" : "Credit"}
                      </td>
                      <td className="py-2">Transfer</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
