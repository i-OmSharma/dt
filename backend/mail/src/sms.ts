/**
 * sms.ts
 *
 * Twilio REST API integration using native fetch (no SDK required).
 * Gracefully skips if credentials are not configured.
 *
 * Required env vars in backend/mail/.env:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_PHONE_NUMBER
 */

import dotenv from "dotenv";
dotenv.config();

export interface SMSResult {
  success: boolean;
  sid?:    string;
  error?:  string;
}

const TWILIO_TIMEOUT_MS = 10_000;

export async function sendSMS(
  toPhone: string,
  body: string
): Promise<SMSResult> {
  const sid       = process.env.TWILIO_ACCOUNT_SID;
  const token     = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !fromPhone) {
    console.warn("[SMS] Twilio credentials not configured — skipping SMS channel");
    return { success: false, error: "Twilio not configured" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const creds = Buffer.from(`${sid}:${token}`).toString("base64");

  const params = new URLSearchParams({
    To:   toPhone,
    From: fromPhone,
    Body: body,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TWILIO_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization:  `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body:   params.toString(),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const data = (await response.json()) as {
      sid?:     string;
      status?:  string;
      code?:    number;
      message?: string;
    };

    if (!response.ok) {
      return {
        success: false,
        error: data.message ?? `HTTP ${response.status}`,
      };
    }

    return { success: true, sid: data.sid };
  } catch (err: any) {
    clearTimeout(timer);
    const errMsg = err.name === "AbortError" ? "Twilio request timed out" : err.message;
    return { success: false, error: errMsg };
  }
}

/**
 * Voice OTP — delivered as SMS with spoken-style formatting.
 * For a real voice call, replace with Twilio Voice TwiML.
 */
export async function sendVoiceOTP(
  toPhone: string,
  otp: string
): Promise<SMSResult> {
  const spoken = otp.split("").join("  "); // spaces for clarity when read aloud
  const body = `Your OTP is: ${spoken}. I repeat: ${spoken}. Do not share this code.`;
  return sendSMS(toPhone, body);
}