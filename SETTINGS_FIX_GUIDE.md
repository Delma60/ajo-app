# Admin Settings Fix - Testing & Verification Guide

## What Was Fixed

### 1. **Cache Invalidation Issue** ❌ → ✅
**Problem**: When admin updated settings, they were saved to Firestore but the server-side cache (5-minute TTL) kept returning old values.

**Solution**: Added `invalidateCache()` calls in both PATCH and POST handlers in `/api/admin/settings/route.ts`

### 2. **Settings Not Refetching in Admin UI** ❌ → ✅
**Problem**: Admin UI didn't refresh after saving, so if you navigated away and back, you might see stale cached values.

**Solution**: Added `await loadSettings()` after successful save/reset in `components/admin/settings/content.tsx`

### 3. **Hardcoded Constants Confusion** ❌ → ✅
**Problem**: Old hardcoded constants in `lib/constants.ts` created confusion about which values were actually being used.

**Solution**: Commented out old constants and added guidance to use `lib/services/settings-service.ts` instead

---

## Testing Steps

### Test 1: Settings Persist Immediately
1. Go to `/admin/settings` → **Wallet** tab
2. Change `Min Deposit Amount` from ₦500 to ₦1,000 
3. Click **Save**
4. See toast: "Wallet settings saved" ✅
5. Refresh the page (F5)
6. Value should still be ₦1,000 (not reverted) ✅

### Test 2: New Deposits Respect Updated Settings
1. Complete **Test 1** (set Min Deposit to ₦1,000)
2. Open a new browser tab as a user (not admin)
3. Try to deposit ₦500
4. Should see error: "Minimum deposit is ₦1,000" ✅
5. Try to deposit ₦1,000
6. Should proceed to Flutterwave checkout ✅

### Test 3: Reset to Defaults Works
1. Go to `/admin/settings`
2. Change any value (e.g., min deposit to ₦5,000)
3. Click **Reset All Defaults** button
4. Click **Yes, reset everything**
5. All values should revert to defaults ✅
6. Refresh page - values still at defaults (persisted) ✅

### Test 4: Circle Creation Respects Settings
1. Go to `/admin/settings` → **Circles** tab
2. Change `Creation Fee %` from 5% to 3%
3. Save
4. Create a new circle with ₦10,000 contribution
5. Creation fee deducted should be ₦300 (3% of ₦10,000) not ₦500 (5%) ✅

### Test 5: Withdrawal Fees Respect Settings  
1. Go to `/admin/settings` → **Wallet** tab
2. Change `Withdrawal Fee %` from 1% to 2%
3. Save
4. As a user, try to withdraw ₦10,000
5. Fee calculation should show 2% of ₦10,000 = ₦200 (not 1% = ₦100) ✅

### Test 6: Cache Invalidation Works
1. Open Chrome DevTools → Network tab
2. Go to `/admin/settings`
3. Update min deposit to ₦2,000 and save
4. Watch network tab - you'll see:
   - PATCH to `/api/admin/settings` (save) ✅
   - GET to `/api/admin/settings` (refetch) ✅
5. Both requests succeed, settings are up-to-date ✅

---

## Architecture After Fix

```
Admin Updates Setting
        ↓
PATCH /api/admin/settings
        ↓
Firestore.set({ merge: true })
        ↓
invalidateCache() ← NEW! Clears server cache immediately
        ↓
Return updated data to client
        ↓
Admin Component: await loadSettings() ← NEW! Refetch to confirm
        ↓
UI shows confirmed saved values
        ↓
Any downstream API calls → getSettings() → Fresh from Firestore (not cached)
```

---

## How Settings Flow Through the App

| Component | How it Fetches Settings |
|-----------|------------------------|
| **API Routes** | `getWalletSettings()`, `getCircleSettings()`, etc. from `lib/services/settings-service` |
| **Business Logic** | Circle service, wallet service, payment service all use settings service |
| **Admin Panel** | Direct API calls + `loadSettings()` after save |
| **User-Facing Features** | All use API routes which respect settings |

---

## Troubleshooting

### Settings still not updating after save?
- Check browser console for errors
- Verify Firebase rules allow saving to `admin_config/platform_settings`
- Check that auth user has `role: 'admin'`
- Try hard refresh (Ctrl+F5) to clear cache

### Changes apply but revert after page reload?
- Likely a Firestore rules issue preventing save
- Check audit log in admin settings to see if save succeeded
- Verify the document actually saved in Firestore console

### Settings API timeout?
- Check Firestore connection
- Verify `FIREBASE_PROJECT_ID` and admin credentials in environment

---

## Files Modified

1. **`app/api/admin/settings/route.ts`**
   - Added `invalidateCache()` in PATCH handler
   - Added `invalidateCache()` in POST handler

2. **`components/admin/settings/content.tsx`**
   - Added `await loadSettings()` after `saveSection()`
   - Added `await loadSettings()` after `handleReset()`

3. **`lib/constants.ts`**
   - Documented that values are now dynamic
   - Commented out old hardcoded constants

---

## Verification Checklist

- [ ] Admin can change settings and they persist after page reload
- [ ] User-facing features (deposits, circle creation, etc.) respect updated settings  
- [ ] Settings changes take effect immediately (no 5-minute cache delay)
- [ ] Reset to defaults works and persists
- [ ] Audit log shows all admin changes
- [ ] No errors in browser console or server logs
- [ ] Multiple admins can update settings concurrently without conflicts

---

## Next Steps (Optional Enhancements)

1. **Cache refresh on admin settings change**: Add a mechanism to notify all connected clients of settings changes (e.g., via WebSocket or polling)
2. **Settings notifications**: Email admins when settings are updated
3. **Settings versioning**: Keep full history of settings changes with diff
4. **Per-circle overrides**: Allow admins to override settings for specific circles
