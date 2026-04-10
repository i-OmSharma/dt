/**
 * geoService.ts
 *
 * Geo-location risk assessment.
 *
 * Storage strategy:
 * - DB (MongoDB): lastLoginLocation — survives Redis eviction/restart
 * - Redis: cache of geo lookup result (15 min TTL) to avoid hammering ip-api.com
 *
 * Risk levels:
 *   HIGH   → different country
 *   MEDIUM → same country, different region/state
 *   LOW    → same country+region, city/distance differs (>500km)
 *   NONE   → same region / local IP
 */

import { redisClient } from "../index.js";
import { User, type ILoginLocation } from "../model/User.js";

// ─── Types ─────────────────────────────────────────────────────────────────────
export type RiskLevel = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export interface GeoLocation {
  ip: string;
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  lat: number;
  lon: number;
  isp: string;
}

export interface GeoRiskResult {
  riskLevel: RiskLevel;
  isRisky: boolean;   // true when MEDIUM or higher
  riskReason: string | null;
  currentLocation: GeoLocation | null;
  previousLocation: ILoginLocation | null;
}

// ─── Private IP detection ──────────────────────────────────────────────────────
function isPrivateIP(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

// ─── IP Geo lookup (ip-api.com, free tier, no key) ────────────────────────────
async function fetchGeoLocation(ip: string): Promise<GeoLocation | null> {
  // Return synthetic local record for private/loopback IPs
  if (isPrivateIP(ip)) {
    return {
      ip,
      country: "Local",
      countryCode: "LO",
      region: "LO",
      regionName: "Local Network",
      city: "Local",
      lat: 0,
      lon: 0,
      isp: "Local",
    };
  }

  // Check Redis cache first (15 min TTL)
  const cacheKey = `geo:cache:${ip}`;
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached) as GeoLocation;
  } catch { /* cache miss — continue to live lookup */ }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,regionName,city,lat,lon,isp,query`,
      { signal: controller.signal }
    );
    clearTimeout(timer);

    if (!res.ok) return null;

    const data = await res.json() as Record<string, unknown>;
    if (data.status !== "success") return null;

    const geo: GeoLocation = {
      ip:          String(data.query  ?? ip),
      country:     String(data.country     ?? "Unknown"),
      countryCode: String(data.countryCode ?? "??"),
      region:      String(data.region      ?? "Unknown"),
      regionName:  String(data.regionName  ?? "Unknown"),
      city:        String(data.city        ?? "Unknown"),
      lat:         Number(data.lat ?? 0),
      lon:         Number(data.lon ?? 0),
      isp:         String(data.isp ?? "Unknown"),
    };

    // Cache for 15 minutes
    try {
      await redisClient.set(cacheKey, JSON.stringify(geo), { EX: 900 });
    } catch { /* non-critical */ }

    return geo;
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name !== "AbortError") {
      console.error("[GeoService] Fetch error:", err.message);
    }
    return null;
  }
}

// ─── Haversine distance ────────────────────────────────────────────────────────
function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Main: assess geo risk ─────────────────────────────────────────────────────
export async function assessGeoRisk(
  userId: string,
  currentIp: string
): Promise<GeoRiskResult> {
  const currentLocation = await fetchGeoLocation(currentIp);

  // Fetch stored location from DB (always reliable, no TTL)
  const userDoc = await User.findById(userId).select("lastLoginLocation").lean();
  const previousLocation = userDoc?.lastLoginLocation ?? null;

  // ── Determine risk ──────────────────────────────────────────────────────────
  let riskLevel: RiskLevel = "NONE";
  let riskReason: string | null = null;

  const skipRisk =
    !currentLocation ||
    currentLocation.countryCode === "LO" || // local IP
    !previousLocation ||
    previousLocation.countryCode === "??" ||
    previousLocation.countryCode === "LO";  // first login or local previous

  if (!skipRisk && currentLocation && previousLocation) {
    if (currentLocation.countryCode !== previousLocation.countryCode) {
      riskLevel  = "HIGH";
      riskReason = `Login from new country: ${currentLocation.country} (previously ${previousLocation.country})`;
    } else if (currentLocation.region !== previousLocation.region) {
      riskLevel  = "MEDIUM";
      riskReason = `Login from new region: ${currentLocation.regionName} (previously ${previousLocation.regionName})`;
    } else {
      const dist = haversineKm(
        currentLocation.lat, currentLocation.lon,
        previousLocation.lat, previousLocation.lon
      );
      if (dist > 1000) {
        riskLevel  = "MEDIUM";
        riskReason = `Login from distant location: ${currentLocation.city} (~${Math.round(dist)}km away)`;
      } else if (dist > 500) {
        riskLevel  = "LOW";
        riskReason = `Login from different city: ${currentLocation.city}`;
      }
    }
  }

  // ── Persist current location to DB (always update) ─────────────────────────
  if (currentLocation && currentLocation.countryCode !== "LO") {
    const locationUpdate: ILoginLocation = {
      country:     currentLocation.country,
      countryCode: currentLocation.countryCode,
      region:      currentLocation.region,
      regionName:  currentLocation.regionName,
      city:        currentLocation.city,
      lat:         currentLocation.lat,
      lon:         currentLocation.lon,
      ip:          currentLocation.ip,
      updatedAt:   new Date(),
    };
    // Fire and forget — don't block auth flow
    User.findByIdAndUpdate(userId, { lastLoginLocation: locationUpdate }).catch(
      (e) => console.error("[GeoService] Failed to update location in DB:", e)
    );
  }

  return {
    riskLevel,
    isRisky: riskLevel === "HIGH" || riskLevel === "MEDIUM",
    riskReason,
    currentLocation,
    previousLocation,
  };
}