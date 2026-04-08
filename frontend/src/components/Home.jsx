import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { userAPI, authHelpers, transactionAPI } from "../services/api";

export function Home() {
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

    loadHomeData();
  });

  const loadHomeData = async () => {
    try {
      setLoading(true);

      //  Profile
      const profile = await userAPI.getProfile();
      setUser(profile);

      //  Balance
      const bal = await userAPI.getBalance();
      setBalance(bal.balance);

      //  Transactions
      const tx = await transactionAPI.getHistory();
      setTransactions(tx.transactions || []);
    } catch {
      // Any auth / API error → logout
      authHelpers.logout();
      navigate("/");
    } finally {
      setLoading(false);
    }
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
        <h1 className="text-2xl font-semibold">
          Welcome{user?.name ? `, ${user.name}` : ""}
        </h1>
        <p className="text-gray-500 mb-4">
          Access & manage your account and transactions efficiently.
        </p>

        {/* Balance */}
        <div className="bg-white shadow rounded-xl p-6 mb-6 flex items-center justify-between">
          <div>
            <p className="text-gray-500">Bank Account</p>
            <h2 className="text-2xl font-bold">₹{balance.toFixed(2)}</h2>
          </div>
          <div className="w-20 h-20 border-4 border-blue-500 rounded-full flex items-center justify-center font-semibold text-lg">
            💰
          </div>
        </div>

        {/* Navigate button */}
        <button
          onClick={() => navigate("/transfer")}
          className="mb-4 px-4 py-2 cursor-pointer hover:bg-blue-500 rounded-lg bg-blue-600 text-white"
        >
          Make Payment
        </button>

        {/* Recent Transactions section */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Recent Transactions</h2>
          <div className="bg-white shadow rounded-xl p-4 overflow-x-auto">
            <table className="min-w-full rounded-lg">
              <thead className="border-b text-gray-600">
                <tr>
                  <th className="px-4 py-2 border-b">Transaction</th>
                  <th className="px-4 py-2 border-b">Amount</th>
                  <th className="px-4 py-2 border-b">Status</th>
                  <th className="px-4 py-2 border-b">Date</th>
                  <th className="px-4 py-2 border-b">Channel</th>
                  <th className="px-4 py-2 border-b">Category</th>
                </tr>
              </thead>

              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center text-gray-400 py-4">
                      No transactions yet
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => (
                    <tr key={t.transactionId}>
                      <td className="px-4 py-2">{t.transactionId}</td>
                      <td className="px-4 py-2">₹{t.amount}</td>
                      <td className="px-4 py-2">{t.status}</td>
                      <td className="px-4 py-2">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2">
                        {t.sender.email === user.email ? "Debit" : "Credit"}
                      </td>
                      <td className="px-4 py-2">Transfer</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
