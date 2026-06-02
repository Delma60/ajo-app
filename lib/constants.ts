// App-wide constants - Settings are now dynamic via admin panel
// All business logic settings (fees, limits, penalties) are configured in the admin panel
// and loaded from Firestore via lib/services/settings-service

// Legacy constants - kept for reference only, use settings service instead
// See: lib/services/settings-service.ts for retrieving current values

// Example usage:
// import { getSettings, getWalletSettings, getCircleSettings } from '@/lib/services/settings-service'
// const settings = await getSettings()
// const walletSettings = await getWalletSettings()

export const SESSION_COOKIE = "__session";

// NOTE: The following values are NOT used by the app anymore - for reference only
// const MAX_ACTIVE_CIRCLES = 10;
// const MIN_DEPOSIT_KOBO = 50_000;
// const MIN_WITHDRAW_KOBO = 100_000;
// const WITHDRAW_FEE_FLAT = 5_000;
// const WITHDRAW_FEE_PERCENT = 1;