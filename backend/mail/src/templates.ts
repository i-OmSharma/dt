// ─── Shared helpers ────────────────────────────────────────────────────────────
function nowIST(): string {
  return new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const BASE_STYLES = `
  body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
  .container { max-width: 500px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
  .body { padding: 32px; }
  .footer { background: #f9fafb; padding: 16px 32px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; }
  .otp-box { border: 2px dashed; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center; }
  .otp-digits { font-size: 36px; font-weight: bold; letter-spacing: 8px; }
  .otp-expiry { font-size: 13px; color: #6b7280; margin-top: 8px; }
  .info-row { font-size: 14px; color: #374151; margin: 8px 0; }
  .warning { background: #fef9c3; border-left: 4px solid #ca8a04; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #713f12; margin-top: 20px; }
  .detail-card { background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0; }
  .detail-card p { margin: 6px 0; font-size: 14px; color: #374151; }
  .detail-card span { font-weight: 600; color: #111827; }
  .btn { display: inline-block; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; text-decoration: none; margin: 8px 4px; }
`;

// ─── Template 1 — Login OTP ────────────────────────────────────────────────────
export function loginOTPTemplate(
  otp: string,
  userName: string,
  location: string,
  expiryMin: number,
  channel: string
): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  ${BASE_STYLES}
  .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 32px; text-align: center; }
  .header h1 { color: white; margin: 0; font-size: 22px; }
  .header p { color: #bfdbfe; margin: 8px 0 0; font-size: 14px; }
  .otp-box { border-color: #2563eb; background: #eff6ff; }
  .otp-digits { color: #1d4ed8; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>🏦 SecOTP Banking</h1>
    <p>Secure Login Verification</p>
  </div>
  <div class="body">
    <p style="color:#374151">Hello <strong>${userName}</strong>,</p>
    <p style="color:#6b7280;font-size:14px">Use the OTP below to complete your login. Never share this with anyone.</p>
    <div class="otp-box">
      <div class="otp-digits">${otp}</div>
      <div class="otp-expiry">⏱ Valid for ${expiryMin} minutes</div>
    </div>
    <p class="info-row">📍 Login location: <strong>${location}</strong></p>
    <p class="info-row">📲 Delivered via: <strong>${channel}</strong></p>
    <div class="warning">⚠️ Never share this OTP. SecOTP will never ask for your OTP.</div>
  </div>
  <div class="footer">© 2025 SecOTP Banking</div>
</div>
</body></html>`;
}

// ─── Template 2 — Transaction OTP ─────────────────────────────────────────────
export function transactionOTPTemplate(
  otp: string,
  userName: string,
  amount: number,
  recipientAccount: string,
  expiryText: string
): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  ${BASE_STYLES}
  .header { background: linear-gradient(135deg, #059669, #047857); padding: 32px; text-align: center; }
  .header h1 { color: white; margin: 0; font-size: 22px; }
  .header p { color: #a7f3d0; margin: 8px 0 0; font-size: 14px; }
  .amount-box { background: #f0fdf4; border: 2px solid #059669; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center; }
  .amount-value { font-size: 36px; font-weight: bold; color: #065f46; }
  .amount-to { font-size: 14px; color: #374151; margin-top: 8px; }
  .otp-box { border-color: #2563eb; background: #eff6ff; }
  .otp-digits { color: #1d4ed8; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>💸 Transaction Authorization</h1>
    <p>Secure fund transfer OTP</p>
  </div>
  <div class="body">
    <p style="color:#374151">Hello <strong>${userName}</strong>,</p>
    <p style="color:#6b7280;font-size:14px">You have initiated a fund transfer. Use the OTP below to authorize it.</p>
    <div class="amount-box">
      <div class="amount-value">₹${amount.toLocaleString("en-IN")}</div>
      <div class="amount-to">→ To account: <strong>${recipientAccount}</strong></div>
    </div>
    <div class="otp-box">
      <div class="otp-digits">${otp}</div>
      <div class="otp-expiry">⏱ Valid for ${expiryText}</div>
    </div>
    <div class="warning">⚠️ If you did not initiate this, change your password immediately.</div>
  </div>
  <div class="footer">© 2025 SecOTP Banking</div>
</div>
</body></html>`;
}

// ─── Template 3 — Registration OTP ────────────────────────────────────────────
export function registrationOTPTemplate(
  otp: string,
  name: string
): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  ${BASE_STYLES}
  .header { background: linear-gradient(135deg, #7c3aed, #6d28d9); padding: 32px; text-align: center; }
  .header h1 { color: white; margin: 0; font-size: 22px; }
  .header p { color: #ddd6fe; margin: 8px 0 0; font-size: 14px; }
  .otp-box { border-color: #7c3aed; background: #f5f3ff; }
  .otp-digits { color: #6d28d9; }
  .steps { display: flex; justify-content: space-between; background: #f9fafb; border-radius: 8px; padding: 16px; margin-top: 20px; font-size: 13px; color: #374151; }
  .step { text-align: center; flex: 1; }
  .step-icon { font-size: 18px; }
  .step-active { color: #7c3aed; font-weight: bold; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>👋 Welcome to SecOTP</h1>
    <p>Verify your account</p>
  </div>
  <div class="body">
    <p style="color:#374151">Hello <strong>${name}</strong>,</p>
    <p style="color:#6b7280;font-size:14px">You are one step away from creating your account!</p>
    <div class="otp-box">
      <div class="otp-digits">${otp}</div>
      <div class="otp-expiry">⏱ Valid for 10 minutes</div>
    </div>
    <div class="steps">
      <div class="step"><div class="step-icon">✅</div><div>Fill details</div></div>
      <div class="step step-active"><div class="step-icon">→</div><div>Verify OTP</div></div>
      <div class="step"><div class="step-icon">🏦</div><div>Account ready</div></div>
    </div>
  </div>
  <div class="footer">© 2025 SecOTP Banking</div>
</div>
</body></html>`;
}

// ─── Template 4 — Registration Success ────────────────────────────────────────
export function registrationSuccessTemplate(
  name: string,
  email: string,
  accountNumber: string,
  balance: number
): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  ${BASE_STYLES}
  .header { background: linear-gradient(135deg, #7c3aed, #6d28d9); padding: 32px; text-align: center; }
  .header h1 { color: white; margin: 0; font-size: 22px; }
  .header p { color: #ddd6fe; margin: 8px 0 0; font-size: 14px; }
  .account-box { background: #f5f3ff; border: 2px solid #7c3aed; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center; }
  .account-label { color: #6b7280; font-size: 13px; margin-bottom: 8px; }
  .account-number { font-size: 28px; font-weight: bold; color: #6d28d9; letter-spacing: 4px; }
  .note-box { background: #fef9c3; border-left: 4px solid #ca8a04; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #713f12; margin: 16px 0; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>🎉 Account Created Successfully!</h1>
    <p>Welcome to SecOTP Banking</p>
  </div>
  <div class="body">
    <p style="color:#374151">Hello <strong>${name}</strong>, your account is ready!</p>
    <div class="account-box">
      <div class="account-label">Your Account Number</div>
      <div class="account-number">${accountNumber}</div>
    </div>
    <div class="detail-card">
      <p>👤 Name: <span>${name}</span></p>
      <p>📧 Email: <span>${email}</span></p>
      <p>💰 Opening Balance: <span>₹${balance.toLocaleString("en-IN")}</span></p>
    </div>
    <div class="note-box">💡 Save your account number — you will need it to login.</div>
    <p style="color:#6b7280;font-size:13px;margin-top:16px">You can now login at SecOTP Banking using your email and account number.</p>
  </div>
  <div class="footer">© 2025 SecOTP Banking</div>
</div>
</body></html>`;
}

// ─── Template 5 — Security Alert ──────────────────────────────────────────────
export function securityAlertTemplate(
  userName: string,
  location: string,
  ip: string,
  resetUrl: string,
  riskLevel: string
): string {
  const badgeColor   = riskLevel === "HIGH" ? "#dc2626" : "#ea580c";
  const badgeLabel   = riskLevel === "HIGH" ? "HIGH RISK" : "MEDIUM RISK";
  const trustUrl     = `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/trust-login`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  ${BASE_STYLES}
  .header { background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 32px; text-align: center; }
  .header h1 { color: white; margin: 0; font-size: 22px; }
  .header p { color: #fecaca; margin: 8px 0 0; font-size: 14px; }
  .risk-badge { display: inline-block; background: ${badgeColor}; color: white; font-weight: bold; font-size: 13px; padding: 6px 16px; border-radius: 20px; margin-bottom: 16px; }
  .alert-card { border: 2px solid #fca5a5; background: #fff1f2; border-radius: 8px; padding: 16px; margin: 16px 0; }
  .alert-card p { margin: 6px 0; font-size: 14px; color: #374151; }
  .alert-card span { font-weight: 600; color: #111827; }
  .btn-row { text-align: center; margin: 24px 0 8px; }
  .btn-danger { background: #dc2626; color: white; }
  .btn-neutral { background: #6b7280; color: white; }
  .tip { font-size: 13px; color: #6b7280; text-align: center; margin-top: 4px; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>🚨 Security Alert</h1>
    <p>Suspicious login detected</p>
  </div>
  <div class="body">
    <div style="text-align:center"><span class="risk-badge">${badgeLabel}</span></div>
    <p style="color:#374151">Hello <strong>${userName}</strong>, we detected a login from an unusual location.</p>
    <div class="alert-card">
      <p>📍 Location: <span>${location}</span></p>
      <p>🌐 IP Address: <span>${ip}</span></p>
      <p>🕐 Time: <span>${nowIST()} IST</span></p>
      <p>⚡ Risk Level: <span>${riskLevel}</span></p>
    </div>
    <div class="btn-row">
      <a href="${resetUrl}" class="btn btn-danger">🔒 Change Password</a>
      <a href="${trustUrl}" class="btn btn-neutral">✅ It was me</a>
    </div>
    <p class="tip">If you recognise this login, no action needed.</p>
  </div>
  <div class="footer">© 2025 SecOTP Banking</div>
</div>
</body></html>`;
}

// ─── Template 6 — Contact Verification OTP ────────────────────────────────────
export function contactVerificationTemplate(
  otp: string,
  userName: string,
  type: "email" | "phone"
): string {
  const label    = type === "email" ? "Email Address" : "Phone Number";
  const context  = type === "email"
    ? "Verify your email address to secure your account."
    : "Verify your phone number to enable SMS OTP delivery.";
  const usage    = type === "email" ? "email" : "phone";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  ${BASE_STYLES}
  .header { background: linear-gradient(135deg, #0891b2, #0e7490); padding: 32px; text-align: center; }
  .header h1 { color: white; margin: 0; font-size: 22px; }
  .header p { color: #a5f3fc; margin: 8px 0 0; font-size: 14px; }
  .otp-box { border-color: #0891b2; background: #ecfeff; }
  .otp-digits { color: #0e7490; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>🔐 Verify Your ${label}</h1>
    <p>SecOTP Account Security</p>
  </div>
  <div class="body">
    <p style="color:#374151">Hello <strong>${userName}</strong>,</p>
    <p style="color:#6b7280;font-size:14px">${context}</p>
    <div class="otp-box">
      <div class="otp-digits">${otp}</div>
      <div class="otp-expiry">⏱ Valid for 5 minutes</div>
    </div>
    <p style="color:#6b7280;font-size:13px">Once verified, your ${usage} will be used for account security.</p>
  </div>
  <div class="footer">© 2025 SecOTP Banking</div>
</div>
</body></html>`;
}

// ─── Template 7 — Password Changed ────────────────────────────────────────────
export function passwordChangedTemplate(
  userName: string,
  ip: string,
  location: string
): string {
  const changeUrl = `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/change-password`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  ${BASE_STYLES}
  .header { background: linear-gradient(135deg, #16a34a, #15803d); padding: 32px; text-align: center; }
  .header h1 { color: white; margin: 0; font-size: 22px; }
  .header p { color: #bbf7d0; margin: 8px 0 0; font-size: 14px; }
  .success-box { background: #f0fdf4; border: 2px solid #16a34a; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center; font-size: 15px; color: #15803d; font-weight: 600; }
  .danger-box { background: #fff1f2; border-left: 4px solid #dc2626; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #9f1239; margin-top: 16px; }
  .btn-row { text-align: center; margin: 20px 0 8px; }
  .btn-danger { background: #dc2626; color: white; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>🔑 Password Changed</h1>
    <p>Your account password was updated</p>
  </div>
  <div class="body">
    <p style="color:#374151">Hello <strong>${userName}</strong>,</p>
    <div class="success-box">✅ Your password has been changed successfully.</div>
    <div class="detail-card">
      <p>🕐 Time: <span>${nowIST()} IST</span></p>
      <p>🌐 IP: <span>${ip}</span></p>
      <p>📍 Location: <span>${location}</span></p>
    </div>
    <div class="danger-box">If you did NOT change your password, contact support immediately and secure your account.</div>
    <div class="btn-row">
      <a href="${changeUrl}" class="btn btn-danger">🔒 Secure My Account</a>
    </div>
  </div>
  <div class="footer">© 2025 SecOTP Banking</div>
</div>
</body></html>`;
}
