import "./App.css";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import SideBar from "./components/SideBar";
import { SignIn } from "./components/SignIn";
import { SignUp } from "./components/SignUp";
import { Home } from "./components/Home";
import { MyBanks } from "./components/MyBanks";
import { OTPVerification } from "./components/OTPVerification";
import { TransactionOTPVerification } from "./components/TransactionOTPVerification";
import { TransactionHistory } from "./components/TransactionHistory";
import { TransferFunds } from "./components/TransferFunds";
import { AccountSuccess } from "./components/AccountSuccess";
import { AdminSignIn } from "./components/AdminSignIn";
import AdminDashboard  from "./components/AdminDashboard";
import { RegistrationOTPVerification } from "./components/RegistrationOTPVerification";
import { ChangePassword } from "./components/ChangePassword";
import AccountSettings from "./components/AccountSettings";

// Layout wrapper to handle sidebar visibility + scroll logic
function Layout() {
  const location = useLocation();

  // Routes where sidebar should be hidden
  const noSidebarRoutes = ["/", "/signup", "/verify-otp", "/transaction-otp", "/verify-registration", "/account-success", "/admin/login", "/admin/dashboard", "/change-password"];
  const hideSidebar = noSidebarRoutes.includes(location.pathname);

  // Routes that need scroll (only applied if sidebar is shown)
  const scrollRoutes = ["/transactions", "/transfer"];
  const needsScroll = !hideSidebar && scrollRoutes.includes(location.pathname);

  return (
    <div className="flex">
      {/* Sidebar only if not hidden */}
      {!hideSidebar && <SideBar />}

      {/* Main content with conditional scroll (excluded for signin/signup) */}
      <main
        className={`${!hideSidebar ? "ml-64" : ""} h-screen ${
          needsScroll ? "overflow-y-auto" : ""
        } bg-gray-50 w-full`}
      >
        <Routes>
          <Route path="/" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/home" element={<Home />} />
          <Route path="/mybanks" element={<MyBanks />} />
          <Route path="/verify-otp" element={<OTPVerification />} />
          <Route path="/transaction-otp" element={<TransactionOTPVerification />} />
          <Route path="/transactions" element={<TransactionHistory />} />
          <Route path="/transfer" element={<TransferFunds />} />
          <Route path="/verify-registration" element={<RegistrationOTPVerification />} />
          <Route path="/account-success" element={<AccountSuccess />} />
          <Route path="/admin/login" element={<AdminSignIn />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/account-settings" element={<AccountSettings />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Layout />
    </Router>
  );
}
