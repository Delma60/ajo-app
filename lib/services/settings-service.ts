/**
 * Settings Service
 *
 * Central service for fetching and caching platform settings from Firestore.
 * All dynamic configuration (fees, penalties, limits, etc.) flows through this service.
 *
 * CACHING STRATEGY:
 * ─────────────────
 * Settings are cached in-memory with a 5-minute TTL to reduce Firestore reads
 * while ensuring relatively fresh data. The cache key is based on timestamp.
 *
 * For admin operations (settings changes), the cache is invalidated immediately
 * via the `invalidateCache()` export.
 *
 * USAGE
 * ─────
 * import { getSettings, getCircleSettings, getWalletSettings } from "@/lib/services/settings-service"
 *
 * async function createCircle(...) {
 *   const settings = await getSettings()
 *   const creationFee = contribution * settings.circles.creationFeePercent
 * }
 */

import { adminDb } from "@/lib/firebase/admin";
import type { PlatformSettings } from "@/lib/types/admin-settings";
import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/types/admin-settings";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  settings: PlatformSettings;
  timestamp: number;
}

function mergeDeep<T>(base: T, override: Record<string, unknown>): T {
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };

  for (const key of Object.keys(override)) {
    const overrideValue = override[key];
    const baseValue = (base as Record<string, unknown>)[key];

    if (
      baseValue &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue) &&
      overrideValue &&
      typeof overrideValue === "object" &&
      !Array.isArray(overrideValue)
    ) {
      result[key] = mergeDeep(baseValue, overrideValue as Record<string, unknown>);
    } else {
      result[key] = overrideValue;
    }
  }

  return result as T;
}

// ─── Cache configuration ──────────────────────────────────────────────────────

const SETTINGS_COLLECTION = "admin_config";
const SETTINGS_DOC = "platform_settings";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cachedSettings: CacheEntry | null = null;

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch platform settings from Firestore with caching.
 * Falls back to DEFAULT_PLATFORM_SETTINGS if not yet configured.
 *
 * @returns {Promise<PlatformSettings>}
 */
export async function getSettings(): Promise<PlatformSettings> {
  // Return cached settings if still valid
  if (cachedSettings && Date.now() - cachedSettings.timestamp < CACHE_TTL_MS) {
    return cachedSettings.settings;
  }

  try {
    const snap = await adminDb
      .collection(SETTINGS_COLLECTION)
      .doc(SETTINGS_DOC)
      .get();

    if (!snap.exists) {
      // No custom settings yet; use defaults
      cachedSettings = {
        settings: DEFAULT_PLATFORM_SETTINGS,
        timestamp: Date.now(),
      };
      return DEFAULT_PLATFORM_SETTINGS;
    }

    const settingsData = snap.data() as PlatformSettings;
    const settings = mergeDeep(
      DEFAULT_PLATFORM_SETTINGS,
      settingsData as unknown as Record<string, unknown>,
    );

    // Update cache
    cachedSettings = {
      settings,
      timestamp: Date.now(),
    };

    return settings;
  } catch (err) {
    console.error("[getSettings] Error fetching from Firestore, returning defaults:", err);
    // Fallback to defaults on error
    return DEFAULT_PLATFORM_SETTINGS;
  }
}

/**
 * Get circle-specific settings.
 */
export async function getCircleSettings() {
  const settings = await getSettings();
  return settings.circles;
}

/**
 * Serialize settings for client-side use.
 * Converts Firestore Timestamp objects to ISO strings to enable serialization.
 *
 * @param {PlatformSettings} settings
 * @returns {any} Serialized settings safe to pass to client components
 */
export function serializeSettings(settings: PlatformSettings): any {
  return JSON.parse(
    JSON.stringify(settings, (key, value) => {
      // Check if this is a Firestore Timestamp object
      if (value && typeof value === "object" && "_seconds" in value && "_nanoseconds" in value) {
        const timestamp = new Date(value._seconds * 1000 + value._nanoseconds / 1000000);
        return timestamp.toISOString();
      }
      return value;
    })
  );
}

/**
 * Get wallet-specific settings.
 */
export async function getWalletSettings() {
  const settings = await getSettings();
  return settings.wallet;
}

/**
 * Get payout-specific settings.
 */
export async function getPayoutSettings() {
  const settings = await getSettings();
  return settings.payouts;
}

/**
 * Get trust score settings.
 */
export async function getTrustScoreSettings() {
  const settings = await getSettings();
  return settings.trustScore;
}

/**
 * Get general settings.
 */
export async function getGeneralSettings() {
  const settings = await getSettings();
  return settings.general;
}

/**
 * Get wallet settings.
 */
export async function getInvestmentSettings() {
  const settings = await getSettings();
  return settings.investments;
}

/**
 * Invalidate the cache manually (e.g., after admin updates settings).
 * Call this from admin setting update endpoints to ensure new values are picked up.
 */
export function invalidateCache(): void {
  cachedSettings = null;
}

/**
 * Get cached settings synchronously (or null if not yet loaded).
 * Useful for non-async contexts, but prefer getSettings() for fresh data.
 */
export function getCachedSettings(): PlatformSettings | null {
  if (cachedSettings && Date.now() - cachedSettings.timestamp < CACHE_TTL_MS) {
    return cachedSettings.settings;
  }
  return null;
}
