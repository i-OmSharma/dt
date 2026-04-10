export function registrationSuccessTemplate(
  name: string,
  email: string,
  accountNumber: string,
  balance: number
): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
  .container { max-width: 500px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
  .header { background: linear-gradient(135deg, #7c3aed, #6d28d9); padding: 32px; text-align: center; }
  .header h1 { color: white; margin: 0; font-size: 24px; }
  .header p { color: #ddd6fe; margin: 8px 0 0; font-size: 14px; }
  .body { padding: 32px; }
  .account-box { background: #f5f3ff; border: 2px solid #7c3aed; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center; }
  .account-box .label { color: #6b7280; font-size: 13px; margin-bottom: 8px; }
  .account-box .account-number { font-size: 28px; font-weight: bold; color: #6d28d9; letter-spacing: 4px; }
  .details { background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0; }
  .details p { margin: 6px 0; font-size: 14px; color: #374151; }
  .details span { font-weight: 600; color: #111827; }
  .balance { background: #ecfdf5; border-radius: 8px; padding: 12px 16px; text-align: center; margin: 16px 0; }
  .balance .amount { font-size: 24px; font-weight: bold; color: #065f46; }
  .footer { background: #f9fafb; padding: 16px 32px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>🎉 Account Created!</h1>
    <p>Welcome to SecOTP Banking</p>
  </div>
  <div class="body">
    <p style="color:#374151">Hello <strong>${name}</strong>,</p>
    <p style="color:#6b7280;font-size:14px">Your banking account has been successfully created. Here are your details:</p>
    <div class="account-box">
      <div class="label">Your Account Number</div>
      <div class="account-number">${accountNumber}</div>
    </div>
    <div class="details">
      <p>👤 Name: <span>${name}</span></p>
      <p>📧 Email: <span>${email}</span></p>
    </div>
    <div class="balance">
      <div style="color:#6b7280;font-size:13px;margin-bottom:4px">Opening Balance</div>
      <div class="amount">₹${balance.toLocaleString("en-IN")}</div>
    </div>
    <p style="color:#6b7280;font-size:13px;margin-top:16px">⚠️ Keep your account number safe. Never share your OTP or password with anyone.</p>
  </div>
  <div class="footer">© 2025 SecOTP Banking · Account Services</div>
</div>
</body></html>`;
}
