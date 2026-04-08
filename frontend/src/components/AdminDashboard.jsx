import { useEffect, useState } from "react";
import { Bar, Pie, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend
);

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState({
    totalOTPGenerated: 0,
    totalVerified: 0,
    failedAttempts: 0,
    blockedUsers: 0,
    averageDeliveryTime: 0,
    riskyLogins: 0,
    dailyOTPData: [],
    blockedUserTrend: [],
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch(
          "http://localhost:5000/api/admin/analytics",
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        const data = await res.json();

        setAnalytics({
          totalOTPGenerated: data.totalOTPGenerated ?? 0,
          totalVerified: data.totalVerified ?? 0,
          failedAttempts: data.failedAttempts ?? 0,
          blockedUsers: data.blockedUsers ?? 0,
          averageDeliveryTime: data.averageDeliveryTime ?? 0,
          riskyLogins: data.riskyLogins ?? 0,
          dailyOTPData: data.dailyOTPData ?? [],
          blockedUserTrend: data.blockedUserTrend ?? [],
        });
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();

    const interval = setInterval(fetchAnalytics, 5000);

    return () => clearInterval(interval);
  }, []);

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const normalizedDailyOTPData = weekDays.map((day) => {
    const found = analytics.dailyOTPData.find((d) => d.date === day);

    return {
      date: day,
      count: found ? found.count : 0,
    };
  });

  const normalizedBlockedTrend = weekDays.map((day) => {
    const found = analytics.blockedUserTrend.find((d) => d.date === day);

    return {
      date: day,
      count: found ? found.count : 0,
    };
  });

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "top",
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        min: 0,
        max: 10,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center text-xl font-semibold">
        Loading Dashboard...
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-gray-600">Total OTP Generated</h2>
          <p className="text-3xl font-bold text-blue-600">
            {analytics.totalOTPGenerated}
          </p>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-gray-600">Total Verified</h2>
          <p className="text-3xl font-bold text-green-600">
            {analytics.totalVerified}
          </p>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-gray-600">Failed Attempts</h2>
          <p className="text-3xl font-bold text-red-600">
            {analytics.failedAttempts}
          </p>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-gray-600">Blocked Users</h2>
          <p className="text-3xl font-bold text-yellow-500">
            {analytics.blockedUsers}
          </p>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-gray-600">Average Delivery Time</h2>
          <p className="text-3xl font-bold text-purple-600">
            {analytics.averageDeliveryTime}s
          </p>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-gray-600">Risky Device Logins</h2>
          <p className="text-3xl font-bold text-pink-600">
            {analytics.riskyLogins}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded shadow h-[350px]">
          <h2 className="text-lg font-semibold mb-3">OTP Generated Per Day</h2>

          <Bar
            data={{
              labels: normalizedDailyOTPData.map((d) => d.date),
              datasets: [
                {
                  label: "OTP Generated",
                  data: normalizedDailyOTPData.map((d) => d.count),
                  backgroundColor: "#3b82f6",
                  borderRadius: 6,
                },
              ],
            }}
            options={commonOptions}
          />
        </div>

        <div className="bg-white p-4 rounded shadow h-[350px] flex flex-col">
          <h2 className="text-lg font-semibold mb-3">Verification Status</h2>

          <div className="flex-1 flex items-center justify-center">
            <div className="w-[250px] h-[250px]">
              <Pie
                data={{
                  labels: ["Verified", "Failed"],
                  datasets: [
                    {
                      data: [
                        analytics.totalVerified,
                        analytics.failedAttempts,
                      ],
                      backgroundColor: ["#10b981", "#ef4444"],
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "bottom",
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow mt-6 h-[350px]">
        <h2 className="text-lg font-semibold mb-3">Blocked User Trend</h2>

        <Line
          data={{
            labels: normalizedBlockedTrend.map((d) => d.date),
            datasets: [
              {
                label: "Blocked Users",
                data: normalizedBlockedTrend.map((d) => d.count),
                borderColor: "#f59e0b",
                backgroundColor: "#f59e0b",
                tension: 0.4,
              },
            ],
          }}
          options={commonOptions}
        />
      </div>
    </div>
  );
}