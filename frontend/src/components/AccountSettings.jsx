import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { userAPI, authHelpers } from "../services/api";
import { useCountdown, formatCountdown } from "../hooks/useAuth";

// ─── Country codes (shared with SignUp + ChangePassword) ──────────────────────
const COUNTRY_CODES = [
  { value: "+91",  label: "+91 🇮🇳 India" },
  { value: "+1",   label: "+1 🇺🇸 USA/Canada" },
  { value: "+44",  label: "+44 🇬🇧 UK" },
  { value: "+61",  label: "+61 🇦🇺 Australia" },
  { value: "+971", label: "+971 🇦🇪 UAE" },
  { value: "+65",  label: "+65 🇸🇬 Singapore" },
  { value: "+49",  label: "+49 🇩🇪 Germany" },
  { value: "+33",  label: "+33 🇫🇷 France" },
  { value: "+81",  label: "+81 🇯🇵 Japan" },
  { value: "+86",  label: "+86 🇨🇳 China" },
];

// ─── Reusable sub-components ──────────────────────────────────────────────────

function OtpInput({ value, onChange, disabled }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={6}
      placeholder="000000"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      disabled={disabled}
      className="w-full px-4 py-3 mb-4 border rounded-xl text-center text-2xl tracking-[0.4em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
    />
  );
}

function DeliveryBanner({ channel }) {
  if (channel === "sms") {
    return (
      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
        📱 OTP sent via SMS
      </div>
    );
  }
  return (
    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex items-center gap-2">
      📧 OTP sent via Email
    </div>
  );
}

function CountdownRow({ timeLeft }) {
  const expired = timeLeft === 0;
  return (
    <div className={`mb-4 text-sm flex items-center gap-1.5 ${expired ? "text-red-500" : "text-gray-500"}`}>
      ⏱{" "}
      {expired ? (
        <span className="font-medium">OTP expired — request a new one</span>
      ) : (
        <>Expires in <span className="font-mono font-medium">{formatCountdown(timeLeft)}</span></>
      )}
    </div>
  );
}

function ErrorBox({ msg }) {
  if (!msg) return null;
  return (
    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
      {msg}
    </div>
  );
}

function SuccessBox({ msg }) {
  if (!msg) return null;
  return (
    <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm font-medium">
      ✅ {msg}
    </div>
  );
}

function SubmitButton({ loading, disabled, label, loadingLabel }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition
        disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      {loading ? (
        <>
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          {loadingLabel}
        </>
      ) : label}
    </button>
  );
}

// ─── Collapsible card wrapper ─────────────────────────────────────────────────
function SettingsCard({ title, icon, open, onToggle, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-blue-600 text-lg">{icon}</span>
          <span className="font-semibold text-gray-800">{title}</span>
        </div>
        <span className="text-gray-400 text-sm">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-6 pb-6 pt-2 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CARD 1 — Personal Info
// ══════════════════════════════════════════════════════════════════════════════
function PersonalInfoCard({ user, onProfileUpdated }) {
  const [name,    setName]    = useState(user?.name ?? "");
  const [dob,     setDob]     = useState(user?.dob  ?? "");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!name.trim()) { setError("Name is required."); return; }
    setLoading(true);
    try {
      const res = await userAPI.updateProfile({ name: name.trim(), dob: dob || undefined });
      setSuccess("Profile updated successfully.");
      onProfileUpdated(res.user);
    } catch (err) {
      setError(err?.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <ErrorBox msg={error} />
      <SuccessBox msg={success} />

      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
      <input
        type="text"
        value={name}
        onChange={(e) => { setError(""); setName(e.target.value); }}
        placeholder="Your full name"
        required
        disabled={loading}
        className="w-full px-4 py-2 mb-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
      />

      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
      <input
        type="date"
        value={dob}
        onChange={(e) => { setError(""); setDob(e.target.value); }}
        disabled={loading}
        className="w-full px-4 py-2 mb-6 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
      />

      <SubmitButton loading={loading} disabled={false} label="Save Changes" loadingLabel="Saving…" />
    </form>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CARD 2 — Change Email
// ══════════════════════════════════════════════════════════════════════════════
function ChangeEmailCard() {
  const navigate = useNavigate();

  const [step,     setStep]     = useState(1);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpId,    setOtpId]    = useState("");
  const [channel,  setChannel]  = useState("email");
  const [otp,      setOtp]      = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");

  const { timeLeft, start: startCountdown } = useCountdown(0);
  const isExpired = step === 2 && timeLeft === 0;

  const handleInitiate = async (e) => {
    e.preventDefault();
    setError("");
    if (!newEmail.trim() || !password) { setError("All fields are required."); return; }
    setLoading(true);
    try {
      const res = await userAPI.initiateEmailChange({ newEmail: newEmail.trim(), password });
      setOtpId(res.otpId);
      setChannel(res.deliveryChannel ?? "email");
      startCountdown(300);
      setStep(2);
    } catch (err) {
      setError(err?.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    if (otp.length !== 6) { setError("Enter the 6-digit OTP."); return; }
    if (isExpired) { setError("OTP expired. Go back and request a new one."); return; }
    setLoading(true);
    try {
      await userAPI.verifyEmailChange({ otpId, otp });
      setSuccess("Email updated. Logging you out…");
      setTimeout(() => { authHelpers.logout(); navigate("/"); }, 3000);
    } catch (err) {
      setError(err?.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  if (step === 1) return (
    <form onSubmit={handleInitiate} noValidate>
      <ErrorBox msg={error} />
      <label className="block text-sm font-medium text-gray-700 mb-1">New Email Address</label>
      <input
        type="email"
        value={newEmail}
        onChange={(e) => { setError(""); setNewEmail(e.target.value); }}
        placeholder="new@example.com"
        required
        disabled={loading}
        className="w-full px-4 py-2 mb-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
      />
      <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => { setError(""); setPassword(e.target.value); }}
        placeholder="Enter your password"
        required
        disabled={loading}
        className="w-full px-4 py-2 mb-6 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
      />
      <SubmitButton loading={loading} disabled={false} label="Send OTP to new email" loadingLabel="Sending…" />
    </form>
  );

  return (
    <form onSubmit={handleVerify} noValidate>
      <DeliveryBanner channel={channel} />
      <CountdownRow timeLeft={timeLeft} />
      <SuccessBox msg={success} />
      <ErrorBox msg={error} />
      {!success && (
        <>
          <OtpInput value={otp} onChange={(v) => { setError(""); setOtp(v); }} disabled={loading || isExpired} />
          <SubmitButton loading={loading} disabled={isExpired || otp.length !== 6} label="Verify & Update Email" loadingLabel="Verifying…" />
          <button type="button" onClick={() => { setStep(1); setOtp(""); setError(""); }}
            className="mt-3 w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition">
            ← Request new OTP
          </button>
        </>
      )}
    </form>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CARD 3 — Change Phone Number
// ══════════════════════════════════════════════════════════════════════════════
function ChangePhoneCard({ onProfileUpdated }) {
  const [step,     setStep]     = useState(1);
  const [prefix,   setPrefix]   = useState("+91");
  const [newPhone, setNewPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otpId,    setOtpId]    = useState("");
  const [channel,  setChannel]  = useState("sms");
  const [otp,      setOtp]      = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");

  const { timeLeft, start: startCountdown } = useCountdown(0);
  const isExpired = step === 2 && timeLeft === 0;

  const handleInitiate = async (e) => {
    e.preventDefault();
    setError("");
    if (!newPhone.trim() || !password) { setError("All fields are required."); return; }
    setLoading(true);
    try {
      const res = await userAPI.initiatePhoneChange({
        newPhone: prefix + newPhone.trim(),
        password,
      });
      setOtpId(res.otpId);
      setChannel(res.deliveryChannel ?? "sms");
      startCountdown(300);
      setStep(2);
    } catch (err) {
      setError(err?.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    if (otp.length !== 6) { setError("Enter the 6-digit OTP."); return; }
    if (isExpired) { setError("OTP expired. Go back and request a new one."); return; }
    setLoading(true);
    try {
      const res = await userAPI.verifyPhoneChange({ otpId, otp });
      setSuccess("Phone number updated successfully.");
      // Refresh profile so VerifyContactOverlay updates
      try {
        const profile = await userAPI.getProfile();
        onProfileUpdated(profile);
      } catch { /* non-critical */ }
    } catch (err) {
      setError(err?.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  if (step === 1) return (
    <form onSubmit={handleInitiate} noValidate>
      <ErrorBox msg={error} />
      <label className="block text-sm font-medium text-gray-700 mb-1">New Phone Number</label>
      <div className="flex gap-2 mb-4">
        <select
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          className="border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <input
          type="tel"
          value={newPhone}
          onChange={(e) => { setError(""); setNewPhone(e.target.value); }}
          placeholder="9835065726"
          required
          disabled={loading}
          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
        />
      </div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => { setError(""); setPassword(e.target.value); }}
        placeholder="Enter your password"
        required
        disabled={loading}
        className="w-full px-4 py-2 mb-6 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
      />
      <SubmitButton loading={loading} disabled={false} label="Send OTP to new number" loadingLabel="Sending…" />
    </form>
  );

  return (
    <form onSubmit={handleVerify} noValidate>
      <DeliveryBanner channel={channel} />
      <CountdownRow timeLeft={timeLeft} />
      <SuccessBox msg={success} />
      <ErrorBox msg={error} />
      {!success && (
        <>
          <OtpInput value={otp} onChange={(v) => { setError(""); setOtp(v); }} disabled={loading || isExpired} />
          <SubmitButton loading={loading} disabled={isExpired || otp.length !== 6} label="Verify & Update Phone" loadingLabel="Verifying…" />
          <button type="button" onClick={() => { setStep(1); setOtp(""); setError(""); }}
            className="mt-3 w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition">
            ← Request new OTP
          </button>
        </>
      )}
    </form>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CARD 4 — Change Password (authenticated)
// ══════════════════════════════════════════════════════════════════════════════
function ChangePasswordCard() {
  const navigate = useNavigate();

  const [step,            setStep]            = useState(1);
  const [oldPassword,     setOldPassword]     = useState("");
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpId,           setOtpId]           = useState("");
  const [channel,         setChannel]         = useState("sms");
  const [otp,             setOtp]             = useState("");
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState("");
  const [success,         setSuccess]         = useState("");

  const { timeLeft, start: startCountdown } = useCountdown(0);
  const isExpired = step === 2 && timeLeft === 0;

  const handleInitiate = async (e) => {
    e.preventDefault();
    setError("");
    if (!oldPassword || !newPassword || !confirmPassword) {
      setError("All fields are required."); return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters."); return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match."); return;
    }
    setLoading(true);
    try {
      const res = await userAPI.initiatePasswordChangeSetting({ oldPassword });
      setOtpId(res.otpId);
      setChannel(res.deliveryChannel ?? "sms");
      startCountdown(300);
      setStep(2);
    } catch (err) {
      setError(err?.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    if (otp.length !== 6) { setError("Enter the 6-digit OTP."); return; }
    if (isExpired) { setError("OTP expired. Go back and request a new one."); return; }
    setLoading(true);
    try {
      await userAPI.verifyPasswordChangeSetting({ otpId, otp, newPassword, confirmPassword });
      setSuccess("Password changed. Logging you out…");
      setTimeout(() => { authHelpers.logout(); navigate("/"); }, 3000);
    } catch (err) {
      setError(err?.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  if (step === 1) return (
    <form onSubmit={handleInitiate} noValidate>
      <ErrorBox msg={error} />
      <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
      <input
        type="password"
        value={oldPassword}
        onChange={(e) => { setError(""); setOldPassword(e.target.value); }}
        placeholder="Your current password"
        required
        disabled={loading}
        className="w-full px-4 py-2 mb-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
      />
      <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
      <input
        type="password"
        value={newPassword}
        onChange={(e) => { setError(""); setNewPassword(e.target.value); }}
        placeholder="At least 8 characters"
        required
        disabled={loading}
        className="w-full px-4 py-2 mb-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
      />
      <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
      <input
        type="password"
        value={confirmPassword}
        onChange={(e) => { setError(""); setConfirmPassword(e.target.value); }}
        placeholder="Re-enter new password"
        required
        disabled={loading}
        className="w-full px-4 py-2 mb-6 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
      />
      <SubmitButton loading={loading} disabled={false} label="Send OTP to verify" loadingLabel="Sending…" />
    </form>
  );

  return (
    <form onSubmit={handleVerify} noValidate>
      <DeliveryBanner channel={channel} />
      <CountdownRow timeLeft={timeLeft} />
      <SuccessBox msg={success} />
      <ErrorBox msg={error} />
      {!success && (
        <>
          <OtpInput value={otp} onChange={(v) => { setError(""); setOtp(v); }} disabled={loading || isExpired} />
          <SubmitButton loading={loading} disabled={isExpired || otp.length !== 6} label="Change Password" loadingLabel="Changing…" />
          <button type="button" onClick={() => { setStep(1); setOtp(""); setError(""); }}
            className="mt-3 w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition">
            ← Request new OTP
          </button>
        </>
      )}
    </form>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function AccountSettings() {
  const navigate = useNavigate();

  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  // Track which card is open (null = all closed)
  const [openCard, setOpenCard] = useState(null);

  useEffect(() => {
    if (!authHelpers.isAuthenticated()) {
      navigate("/"); return;
    }
    userAPI.getProfile()
      .then((u) => { setUser(u); setLoading(false); })
      .catch(() => { authHelpers.logout(); navigate("/"); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (card) => setOpenCard((prev) => (prev === card ? null : card));

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50 items-center justify-center">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-800 mb-1">Account Settings</h1>
        <p className="text-gray-500 text-sm mb-6">
          Manage your personal info, contact details, and security settings.
        </p>

        <div className="flex flex-col gap-4">
          {/* ── Card 1: Personal Info ─────────────────────────────────────── */}
          <SettingsCard
            title="Personal Info"
            icon="👤"
            open={openCard === "personal"}
            onToggle={() => toggle("personal")}
          >
            <PersonalInfoCard
              user={user}
              onProfileUpdated={(updated) => setUser((prev) => ({ ...prev, ...updated }))}
            />
          </SettingsCard>

          {/* ── Card 2: Change Email ──────────────────────────────────────── */}
          <SettingsCard
            title="Change Email"
            icon="📧"
            open={openCard === "email"}
            onToggle={() => toggle("email")}
          >
            <p className="text-sm text-gray-500 mb-4">
              Current: <span className="font-medium text-gray-700">{user?.email}</span>
              {user?.emailVerified
                ? <span className="ml-2 text-green-600 text-xs font-medium">✓ Verified</span>
                : <span className="ml-2 text-amber-600 text-xs font-medium">⚠ Unverified</span>}
            </p>
            <ChangeEmailCard key={openCard === "email" ? "open" : "closed"} />
          </SettingsCard>

          {/* ── Card 3: Change Phone ──────────────────────────────────────── */}
          <SettingsCard
            title="Change Phone Number"
            icon="📱"
            open={openCard === "phone"}
            onToggle={() => toggle("phone")}
          >
            <p className="text-sm text-gray-500 mb-4">
              Current: <span className="font-medium text-gray-700">{user?.phoneNumber ?? "Not set"}</span>
              {user?.phoneVerified
                ? <span className="ml-2 text-green-600 text-xs font-medium">✓ Verified</span>
                : <span className="ml-2 text-amber-600 text-xs font-medium">⚠ Unverified</span>}
            </p>
            <ChangePhoneCard
              key={openCard === "phone" ? "open" : "closed"}
              onProfileUpdated={(updated) => setUser((prev) => ({ ...prev, ...updated }))}
            />
          </SettingsCard>

          {/* ── Card 4: Change Password ───────────────────────────────────── */}
          <SettingsCard
            title="Change Password"
            icon="🔑"
            open={openCard === "password"}
            onToggle={() => toggle("password")}
          >
            <ChangePasswordCard key={openCard === "password" ? "open" : "closed"} />
          </SettingsCard>
        </div>
      </div>
    </div>
  );
}
