import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { transactionAPI, authHelpers, userAPI } from "../services/api";

export function TransactionHistory() {
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [currentUser,  setCurrentUser]  = useState(null);
  const [page,         setPage]         = useState(1);
  const [hasMore,      setHasMore]      = useState(true);

  const LIMIT = 10;

  useEffect(() => {
    if (!authHelpers.isAuthenticated()) {
      navigate("/", { replace: true });
      return;
    }

    const init = async () => {
      try {
        const [profile, txData] = await Promise.all([
          userAPI.getProfile(),
          transactionAPI.getHistory(1, LIMIT),
        ]);
        setCurrentUser(profile);
        setTransactions(txData.transactions || []);
        setHasMore((txData.transactions || []).length === LIMIT);
      } catch {
        authHelpers.logout();
        navigate("/", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = async () => {
    const nextPage = page + 1;
    try {
      const txData = await transactionAPI.getHistory(nextPage, LIMIT);
      const newer = txData.transactions || [];
      setTransactions((prev) => [...prev, ...newer]);
      setHasMore(newer.length === LIMIT);
      setPage(nextPage);
    } catch (err) {
      setError(err.message || "Failed to load more transactions.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Transaction History</h2>
      <p className="text-gray-500 text-sm mb-6">All your past transactions in one place.</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow overflow-x-auto">
        <table className="min-w-full">
          <thead className="border-b text-gray-600 text-sm">
            <tr>
              <th className="px-4 py-3 text-left">Transaction ID</th>
              <th className="px-4 py-3 text-left">Amount (₹)</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center text-gray-400 py-8">
                  No transactions yet.
                </td>
              </tr>
            ) : (
              transactions.map((t) => {
                const isDebit = currentUser && t.sender?.email === currentUser.email;
                return (
                  <tr key={t.transactionId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {t.transactionId}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {isDebit ? (
                        <span className="text-red-600">− ₹{t.amount}</span>
                      ) : (
                        <span className="text-green-600">+ ₹{t.amount}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          isDebit
                            ? "bg-red-50 text-red-600"
                            : "bg-green-50 text-green-600"
                        }`}
                      >
                        {isDebit ? "Debit" : "Credit"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          t.status === "completed"
                            ? "bg-green-50 text-green-700"
                            : t.status === "failed"
                            ? "bg-red-50 text-red-700"
                            : "bg-yellow-50 text-yellow-700"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(t.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {hasMore && transactions.length > 0 && (
        <div className="mt-4 text-center">
          <button
            onClick={loadMore}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
