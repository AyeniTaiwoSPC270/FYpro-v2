# Founder Photo System — Design Spec
**Date:** 2026-06-24
**Status:** Approved

---

## Overview

Replace the hardcoded "TA" initials on the About page and admin dashboard header with a real founder photo that can be updated at any time — either from the admin Mission Control (click avatar → upload modal) or from @fypro_admin_bot (`/setphoto` then send photo).

---

## Scope

**In scope:**
- About page founder card: show photo if set, "TA" fallback if not
- Admin dashboard header: avatar circle shows photo, click opens upload modal
- Admin upload flow (browser → Supabase Storage → app_config)
- Telegram `/setphoto` two-step upload flow
- Supabase Storage bucket + RLS policy for anon read on the new config key

**Out of scope:**
- Image cropping/resizing (accept as-is; Telegram and browser uploads are treated as raw)
- Any other user's avatar or profile photo system
- Syncing to `users.avatar_url` (this is a separate, admin-only founder photo)

---

## Storage

**Bucket:** Supabase Storage, new public bucket `admin-assets`
**Path:** Fixed — `founder/profile.jpg` (upsert on every update; no accumulating files)
**Public URL pattern:** `https://<project>.supabase.co/storage/v1/object/public/admin-assets/founder/profile.jpg`

The URL is saved to `app_config` under key `founder_photo` immediately after each successful upload.

---

## Database

**Table:** `app_config` (already exists — key/value store)
**New row:** `key = 'founder_photo'`, `value = <public storage URL>`

**New RLS policy** (anon SELECT on one key only):
```sql
CREATE POLICY "public can read founder_photo"
ON app_config FOR SELECT
TO anon
USING (key = 'founder_photo');
```

This exposes only the photo URL to unauthenticated clients. No other app_config rows are affected.

---

## Reading the Photo (About page + admin header)

Both components query `app_config` for `founder_photo` via the Supabase anon client on mount:

```js
const { data } = await supabase
  .from('app_config')
  .select('value')
  .eq('key', 'founder_photo')
  .single()

const photoUrl = data?.value ?? null  // null → show "TA" fallback
```

- If `photoUrl` is set: render `<img src={photoUrl} alt="Taiwo Ayeni" />` styled as a circle
- If null: render the existing "TA" initials div (no visible change until a photo is uploaded)
- Both components handle loading state (show "TA" while fetching; swap to photo once resolved)

---

## Admin Dashboard Upload Flow

### Header avatar
- The admin header in `Health.jsx` gains a clickable avatar circle (top-right of the header bar, next to "Taiwo Ayeni" label)
- Shows current photo (from `app_config`) or "TA" initials
- A small green dot indicates the photo is set; no dot if using initials

### Upload modal
Triggered by clicking the avatar. Contains:
1. Current photo preview (or large "TA" placeholder)
2. File input (accept `image/*`, max 2 MB client-side guard)
3. "Update Photo" button (disabled until a file is selected)
4. Loading state during upload
5. Success message + auto-close after 1.5s

### Upload sequence
1. User selects file → client-side size check (reject >2 MB with inline error)
2. `POST /api/admin?action=get-founder-photo-upload-url` + admin JWT → server calls `supabaseAdmin.storage.from('admin-assets').createSignedUploadUrl('founder/profile.jpg')` → returns `{ signedUrl, token, path }`
3. Browser calls `supabase.storage.from('admin-assets').uploadToSignedUrl(path, token, file)` — uploads directly to Storage without needing a broad storage policy
4. On storage success → `POST /api/admin?action=update-founder-photo` with body `{ url: publicUrl }` + admin JWT
5. Server action upserts `app_config` row, returns `{ ok: true }`
6. Modal closes, avatar in header updates immediately (local state), About page reflects it on next load

### New server actions in `api/admin.js`

```
action: get-founder-photo-upload-url
method: POST
body: (none)
auth: admin JWT required
effect: calls supabaseAdmin.storage.createSignedUploadUrl('admin-assets', 'founder/profile.jpg')
returns: { signedUrl, token, path }
```

```
action: update-founder-photo
method: POST
body: { url: string }
auth: admin JWT required (existing ADMIN_EMAIL check)
effect: upsert app_config row { key: 'founder_photo', value: url }
returns: { ok: true }
```

---

## Telegram Upload Flow (`/setphoto`)

### Two-step sequence
1. Admin sends `/setphoto` to @fypro_admin_bot
2. Bot verifies `message.chat.id === TELEGRAM_CHAT_ID` (rejects anyone else silently)
3. Bot sets Redis key `telegram_setphoto_pending` with TTL 300 seconds (5 min)
4. Bot replies: *"📷 Send your photo now. You have 5 minutes."*

5. Admin sends a photo message
6. Bot checks: `message.chat.id === TELEGRAM_CHAT_ID` AND Redis key `telegram_setphoto_pending` exists
7. Bot downloads photo:
   - Gets largest size from `message.photo` array (last element)
   - Calls Telegram `getFile` API to get `file_path`
   - Downloads binary from `https://api.telegram.org/file/bot<TOKEN>/<file_path>`
8. Bot uploads binary to Supabase Storage (`admin-assets/founder/profile.jpg`, upsert)
9. Bot upserts `app_config` row `{ key: 'founder_photo', value: publicUrl }` via service_role client
10. Bot deletes Redis key `telegram_setphoto_pending`
11. Bot replies: *"✅ Founder photo updated!"*

### Edge cases
- Photo message arrives but no Redis flag (flag expired or `/setphoto` was never sent): bot ignores silently (no reply — prevents noise from forwarded photos etc.)
- `/setphoto` sent but no photo follows within 5 min: Redis TTL expires automatically, no action
- Telegram download fails: bot replies *"❌ Download failed. Try again."*, clears Redis flag
- Supabase Storage upload fails: bot replies *"❌ Upload failed. Try again."*, clears Redis flag

### Changes to `api/notify.js`
- Add `/setphoto` to the inbound command dispatcher (alongside `/stats`, `/data`, etc.)
- Add `message.photo` detection in the inbound message handler (check for `message.photo` array before falling through to text command handling)
- Both checks are gated on `TELEGRAM_CHAT_ID` match — no other user can trigger either path

---

## Files Changed

| File | Change |
|------|--------|
| `api/admin.js` | Add `get-founder-photo-upload-url` + `update-founder-photo` POST actions |
| `api/notify.js` | Add `/setphoto` command handler + `message.photo` inbound handler |
| `src/pages/admin/Health.jsx` | Admin header avatar (clickable, reads `founder_photo`, upload modal) |
| `src/pages/About.jsx` | Founder card: dynamic photo with "TA" fallback |
| Supabase (manual) | Create `admin-assets` public bucket + anon SELECT policy on `app_config` |

No new Vercel serverless function. No new migration file (app_config row is created on first upload; RLS policy is a one-time SQL statement).

---

## Security

- Storage bucket is **public-read** but **write-restricted** — only authenticated uploads via service_role or authenticated Supabase client succeed
- Admin dashboard upload uses the authenticated session (admin must be signed in); server action double-checks admin JWT
- Telegram upload is gated on exact `TELEGRAM_CHAT_ID` match — bot refuses all other senders
- 2 MB client-side size guard on browser upload (prevents accidental large file)
- `founder_photo` RLS policy is scoped to that exact key — no other app_config data leaks to anon users

---

## Rollout

1. Create Supabase Storage bucket `admin-assets` (public) in Supabase dashboard
2. Run the RLS policy SQL in Supabase SQL Editor
3. Deploy `api/admin.js` + `api/notify.js` changes
4. Deploy frontend changes (`Health.jsx`, `About.jsx`)
5. Upload first photo via admin dashboard or Telegram to verify end-to-end
