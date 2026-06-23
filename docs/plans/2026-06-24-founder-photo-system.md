# Founder Photo System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded "TA" initials with a real founder photo on the About page and admin dashboard header, updatable at any time from Mission Control or @fypro_admin_bot.

**Architecture:** Photo stored in Supabase Storage (`admin-assets` bucket, fixed path `founder/profile.jpg`). URL persisted in `app_config.founder_photo`. Admin dashboard uses a signed upload URL flow (server generates URL, browser uploads directly). Telegram uses a two-step `/setphoto` command with a 5-min Redis pending flag.

**Tech Stack:** React, Supabase Storage JS client (`@supabase/supabase-js`), Upstash Redis REST API (direct fetch), Vercel serverless functions (Node.js)

---

## Task 1: Supabase Manual Setup

**Files:**
- No file changes — manual steps in Supabase dashboard + SQL Editor

- [ ] **Step 1: Create the storage bucket**

Go to Supabase dashboard → Storage → New bucket.
- Name: `admin-assets`
- Public: **yes** (toggle on)
- Click Save.

- [ ] **Step 2: Run the RLS policy SQL**

Go to Supabase dashboard → SQL Editor → New query. Paste and run:

```sql
-- Allow anonymous users to read only the founder_photo config key.
-- No other app_config rows are exposed.
CREATE POLICY "public can read founder_photo"
ON app_config FOR SELECT
TO anon
USING (key = 'founder_photo');
```

Expected output: `Success. No rows returned.`

- [ ] **Step 3: Verify the policy exists**

In SQL Editor run:

```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'app_config' AND policyname = 'public can read founder_photo';
```

Expected: 1 row returned.

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore: supabase admin-assets bucket + app_config anon policy (manual)"
```

---

## Task 2: api/admin.js — Signed Upload URL + Save URL Actions

**Files:**
- Modify: `api/admin.js` (add two new action handlers + register them in the dispatcher)

- [ ] **Step 1: Add `handleGetFounderPhotoUploadUrl` function**

In `api/admin.js`, add this function just before the `export default async function handler` line (around line 2395):

```js
async function handleGetFounderPhotoUploadUrl(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !caller) return res.status(401).json({ error: 'Unauthorized' })
  if (!process.env.ADMIN_EMAIL || caller.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { data, error } = await supabaseAdmin.storage
    .from('admin-assets')
    .createSignedUploadUrl('founder/profile.jpg')

  if (error) {
    console.error('[admin/get-founder-photo-upload-url]', error.message)
    return res.status(500).json({ error: 'Failed to create upload URL' })
  }

  return res.status(200).json({ signedUrl: data.signedUrl, token: data.token, path: data.path })
}
```

- [ ] **Step 2: Add `handleUpdateFounderPhoto` function**

Directly after the function above (still before `export default`), add:

```js
async function handleUpdateFounderPhoto(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !caller) return res.status(401).json({ error: 'Unauthorized' })
  if (!process.env.ADMIN_EMAIL || caller.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { url } = req.body || {}
  if (!url || typeof url !== 'string' || !url.startsWith('https://')) {
    return res.status(400).json({ error: 'Invalid url' })
  }

  const { error } = await supabaseAdmin
    .from('app_config')
    .upsert({ key: 'founder_photo', value: url, updated_at: new Date().toISOString() })

  if (error) {
    console.error('[admin/update-founder-photo]', error.message)
    return res.status(500).json({ error: 'Failed to save photo URL' })
  }

  return res.status(200).json({ ok: true })
}
```

- [ ] **Step 3: Register both actions in the dispatcher**

In the main `handler` function, after the existing `if (action === 'data-browse')` line (around line 2465), add:

```js
  if (action === 'get-founder-photo-upload-url') return handleGetFounderPhotoUploadUrl(req, res)
  if (action === 'update-founder-photo')         return handleUpdateFounderPhoto(req, res)
```

- [ ] **Step 4: Verify with curl (after deploy)**

```bash
# Should return 401 without a token
curl -s -X POST "https://www.fypro.com.ng/api/admin?action=get-founder-photo-upload-url"
# Expected: {"error":"Unauthorized"}
```

- [ ] **Step 5: Commit**

```bash
git add api/admin.js
git commit -m "feat(admin): add get-founder-photo-upload-url + update-founder-photo actions"
```

---

## Task 3: api/notify.js — Telegram /setphoto Command + Photo Handler

**Files:**
- Modify: `api/notify.js` (add `cmdSetPhoto`, photo message handler, refactor `handleTelegramBot`)

- [ ] **Step 1: Add `cmdSetPhoto` function**

In `api/notify.js`, add this function in the bot commands section — just before the `function cmdHelp()` function (around line 884):

```js
async function cmdSetPhoto(chatId) {
  const url   = UPSTASH_URL
  const token = UPSTASH_TOKEN
  if (!url || !token) return '❌ Redis not configured — cannot set pending flag.'

  await fetch(`${url}/set/telegram_setphoto_pending/1/ex/300`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}` },
  })

  return '📷 Send your photo now. You have 5 minutes.'
}
```

- [ ] **Step 2: Add the photo message handler function**

Directly after `cmdSetPhoto`, add:

```js
async function handleIncomingPhoto(chatId, photoArray) {
  const url   = UPSTASH_URL
  const token = UPSTASH_TOKEN
  if (!url || !token) {
    return '❌ Redis not configured.'
  }

  // Check pending flag
  const flagRes = await fetch(`${url}/get/telegram_setphoto_pending`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json()).catch(() => null)

  if (!flagRes?.result) return null // no pending flag — ignore silently

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return '❌ Bot token not configured.'

  // Largest photo is last element
  const largest = photoArray[photoArray.length - 1]
  const fileId  = largest?.file_id
  if (!fileId) return '❌ Could not read photo file ID.'

  try {
    // 1. Get file path from Telegram
    const fileRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`,
      { signal: AbortSignal.timeout(8000) }
    )
    const fileData = await fileRes.json()
    const filePath = fileData.result?.file_path
    if (!filePath) throw new Error('no file_path in getFile response')

    // 2. Download binary
    const photoRes = await fetch(
      `https://api.telegram.org/file/bot${botToken}/${filePath}`,
      { signal: AbortSignal.timeout(15000) }
    )
    if (!photoRes.ok) throw new Error(`photo download failed: ${photoRes.status}`)
    const photoBuffer = await photoRes.arrayBuffer()

    // 3. Upload to Supabase Storage (upsert — always overwrites founder/profile.jpg)
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('admin-assets')
      .upload('founder/profile.jpg', photoBuffer, {
        contentType: 'image/jpeg',
        upsert:      true,
      })
    if (uploadErr) throw uploadErr

    // 4. Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('admin-assets')
      .getPublicUrl('founder/profile.jpg')

    // 5. Persist URL in app_config
    const { error: dbErr } = await supabaseAdmin
      .from('app_config')
      .upsert({ key: 'founder_photo', value: publicUrl, updated_at: new Date().toISOString() })
    if (dbErr) throw dbErr

    // 6. Clear pending flag
    await fetch(`${url}/del/telegram_setphoto_pending`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    return '✅ Founder photo updated!'
  } catch (err) {
    console.error('[notify/setphoto]', err.message)
    // Clear flag on error so admin can retry immediately
    await fetch(`${url}/del/telegram_setphoto_pending`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {})
    return `❌ Upload failed: ${err.message}. Try again.`
  }
}
```

- [ ] **Step 3: Note on `runCommand`**

Do NOT add `/setphoto` to `runCommand` — `runCommand` doesn't receive `chatId`, which `cmdSetPhoto` requires. The `/setphoto` path is handled directly in `handleTelegramBot` in Step 4.

- [ ] **Step 4: Refactor `handleTelegramBot` to handle photo messages and `/setphoto`**

In `handleTelegramBot`, locate this block (around line 1017–1019):

```js
  // ── Typed command (message) ──────────────────────────────────────────────
  const message = body?.message
  if (!message?.text) return res.status(200).end()
```

Replace it with:

```js
  // ── Typed command or photo message ──────────────────────────────────────
  const message = body?.message
  if (!message) return res.status(200).end()

  const isFromAdmin = String(message.chat?.id) === String(process.env.TELEGRAM_CHAT_ID)
  if (!isFromAdmin) return res.status(200).end()

  const chatId = message.chat.id

  // ── Photo message (only process when /setphoto pending flag is set) ──────
  if (message.photo) {
    const reply = await handleIncomingPhoto(chatId, message.photo)
    if (reply) await sendReply(chatId, reply)
    return res.status(200).end()
  }

  if (!message?.text) return res.status(200).end()
```

Also remove the duplicate admin check that follows immediately after this block. Locate:

```js
  if (String(message.chat.id) !== String(process.env.TELEGRAM_CHAT_ID)) return res.status(200).end()

  const chatId  = message.chat.id
  const msgText = (message.text || '').trim()
```

Change it to (remove the first line since the admin check is now above):

```js
  const msgText = (message.text || '').trim()
```

Then, in the broadcast commands section find and add `/setphoto` handling before the generic command parser. After the broadcast handler block (around line 1056), add:

```js
  // ── /setphoto — must be handled before runCommand since it needs chatId ──
  if (msgText === '/setphoto') {
    const reply = await cmdSetPhoto(chatId)
    await sendReply(chatId, reply)
    return res.status(200).end()
  }
```

- [ ] **Step 5: Verify no syntax errors**

```bash
node --check api/notify.js
```

Expected: no output (no errors).

- [ ] **Step 6: Commit**

```bash
git add api/notify.js
git commit -m "feat(notify): add /setphoto command + Telegram photo upload to Supabase Storage"
```

---

## Task 4: src/pages/About.jsx — Dynamic Founder Photo

**Files:**
- Modify: `src/pages/About.jsx` (add supabase import, photo state, replace static avatar)

- [ ] **Step 1: Add supabase import**

In `src/pages/About.jsx`, the existing imports are (lines 1–4):

```js
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import FyproLogo from '../components/FyproLogo'
```

Add the supabase import after line 4:

```js
import { supabase } from '../lib/supabase'
```

- [ ] **Step 2: Add photo state inside the main `About` component**

Find the `About` function (or the top-level page component) in `About.jsx`. Near the top of the component, after the existing `useState` declarations, add:

```js
const [founderPhotoUrl, setFounderPhotoUrl] = useState(null)

useEffect(() => {
  supabase
    .from('app_config')
    .select('value')
    .eq('key', 'founder_photo')
    .single()
    .then(({ data }) => {
      if (data?.value) setFounderPhotoUrl(data.value)
    })
}, [])
```

- [ ] **Step 3: Replace the static "TA" avatar div**

Find the existing avatar element (lines 315–320):

```jsx
<div
  className="flex-shrink-0 w-[72px] h-[72px] rounded-full flex items-center justify-center border-2 border-blue-500"
  style={{ background: 'rgba(37,99,235,0.2)' }}
>
  <span className="font-serif text-2xl text-blue-400">TA</span>
</div>
```

Replace with:

```jsx
<div className="flex-shrink-0 w-[72px] h-[72px] rounded-full overflow-hidden border-2 border-blue-500 flex items-center justify-center"
  style={{ background: 'rgba(37,99,235,0.2)' }}
>
  {founderPhotoUrl
    ? <img src={founderPhotoUrl} alt="Taiwo Ayeni" className="w-full h-full object-cover" />
    : <span className="font-serif text-2xl text-blue-400">TA</span>
  }
</div>
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/About.jsx
git commit -m "feat(about): dynamic founder photo from app_config with TA fallback"
```

---

## Task 5: src/pages/admin/Health.jsx — Clickable Avatar + Upload Modal

**Files:**
- Modify: `src/pages/admin/Health.jsx` (photo state, modal, upload sequence, replace static avatar)

- [ ] **Step 1: Add photo-related state**

In `AdminHealth`, after line 1851 (`const userInitials = ...`), add state declarations before the `return`:

```js
const [founderPhotoUrl,    setFounderPhotoUrl]    = useState(null)
const [showPhotoModal,     setShowPhotoModal]      = useState(false)
const [photoFile,          setPhotoFile]           = useState(null)
const [photoUploading,     setPhotoUploading]      = useState(false)
const [photoError,         setPhotoError]          = useState(null)
const [photoSuccess,       setPhotoSuccess]        = useState(false)
const photoSuccessTimerRef                         = useRef(null)
```

- [ ] **Step 2: Load founder photo on mount**

After the existing `useEffect` hooks, add a new one to load the current photo:

```js
useEffect(() => {
  supabase
    .from('app_config')
    .select('value')
    .eq('key', 'founder_photo')
    .single()
    .then(({ data }) => {
      if (data?.value) setFounderPhotoUrl(data.value)
    })
}, [])
```

`supabase` is already imported in `Health.jsx` (line 9: `import { supabase } from '../../lib/supabase'`).

- [ ] **Step 3: Add the upload handler**

Add this function inside `AdminHealth` (near the other handler functions, before `return`):

```js
async function handlePhotoUpload() {
  if (!photoFile || !session?.access_token) return
  setPhotoUploading(true)
  setPhotoError(null)

  try {
    // 1. Get signed upload URL from server
    const urlRes = await fetch('/api/admin?action=get-founder-photo-upload-url', {
      method:  'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!urlRes.ok) {
      const e = await urlRes.json().catch(() => ({}))
      throw new Error(e.error || `HTTP ${urlRes.status}`)
    }
    const { path, token: uploadToken } = await urlRes.json()

    // 2. Upload file directly to Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from('admin-assets')
      .uploadToSignedUrl(path, uploadToken, photoFile)
    if (uploadErr) throw uploadErr

    // 3. Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('admin-assets')
      .getPublicUrl('founder/profile.jpg')

    // 4. Persist URL
    const saveRes = await fetch('/api/admin?action=update-founder-photo', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ url: publicUrl }),
    })
    if (!saveRes.ok) {
      const e = await saveRes.json().catch(() => ({}))
      throw new Error(e.error || `HTTP ${saveRes.status}`)
    }

    // 5. Update local state
    setFounderPhotoUrl(publicUrl)
    setPhotoSuccess(true)
    setPhotoFile(null)
    photoSuccessTimerRef.current = setTimeout(() => {
      setPhotoSuccess(false)
      setShowPhotoModal(false)
    }, 1500)
  } catch (err) {
    console.error('[admin/photo-upload]', err.message)
    setPhotoError(err.message || 'Upload failed')
  } finally {
    setPhotoUploading(false)
  }
}
```

- [ ] **Step 4: Clean up success timer on unmount**

In the existing cleanup `useEffect` (the one that returns `() => { ... }` clearing multiple timers), add:

```js
return () => {
  // existing clearTimeout/clearInterval calls...
  clearTimeout(photoSuccessTimerRef.current)
}
```

If there isn't a single combined cleanup effect, add a new one:

```js
useEffect(() => {
  return () => clearTimeout(photoSuccessTimerRef.current)
}, [])
```

- [ ] **Step 5: Replace the static avatar in the topbar**

Find the static avatar circle (lines 1933–1935):

```jsx
<div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#0066FF,#3B82F6)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, fontWeight:700, color:WHITE }}>{userInitials}</span>
</div>
```

Replace with:

```jsx
<button
  onClick={() => { setShowPhotoModal(true); setPhotoFile(null); setPhotoError(null); setPhotoSuccess(false) }}
  title="Update founder photo"
  style={{ position:'relative', width:32, height:32, borderRadius:'50%', overflow:'hidden', border:`2px solid ${founderPhotoUrl ? GREEN : BLUE}`, background:'linear-gradient(135deg,#0066FF,#3B82F6)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer', padding:0 }}
>
  {founderPhotoUrl
    ? <img src={founderPhotoUrl} alt="Founder" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
    : <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, fontWeight:700, color:WHITE }}>{userInitials}</span>
  }
  {founderPhotoUrl && (
    <div style={{ position:'absolute', bottom:0, right:0, width:9, height:9, background:GREEN, borderRadius:'50%', border:`1px solid ${BG}` }} />
  )}
</button>
```

- [ ] **Step 6: Add the upload modal**

Just before the closing `</div>` of the main `return` (i.e., at the very end of the JSX, before `return`'s closing tag), add the modal:

```jsx
{/* ── Founder photo upload modal ── */}
{showPhotoModal && (
  <div
    onClick={e => { if (e.target === e.currentTarget) setShowPhotoModal(false) }}
    style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
  >
    <div style={{ background:SURFACE, border:`1px solid ${BORDER}`, borderRadius:16, padding:28, width:'100%', maxWidth:360 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <span style={{ fontFamily:"'DM Serif Display',serif", fontSize:18, color:WHITE }}>Update Founder Photo</span>
        <button onClick={() => setShowPhotoModal(false)} style={{ background:'none', border:'none', color:MUTED, fontSize:20, cursor:'pointer', lineHeight:1 }}>×</button>
      </div>

      {/* Current photo preview */}
      <div style={{ width:80, height:80, borderRadius:'50%', overflow:'hidden', border:`2px solid ${BLUE}`, background:'linear-gradient(135deg,#0066FF,#3B82F6)', margin:'0 auto 20px', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {(photoFile ? URL.createObjectURL(photoFile) : founderPhotoUrl)
          ? <img src={photoFile ? URL.createObjectURL(photoFile) : founderPhotoUrl} alt="Preview" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:22, fontWeight:700, color:WHITE }}>{userInitials}</span>
        }
      </div>

      {/* File input */}
      <label style={{ display:'block', background:CARD, border:`1px dashed rgba(255,255,255,0.2)`, borderRadius:10, padding:'12px 16px', cursor:'pointer', textAlign:'center', marginBottom:12 }}>
        <input
          type="file"
          accept="image/*"
          style={{ display:'none' }}
          onChange={e => {
            const f = e.target.files?.[0]
            if (!f) return
            if (f.size > 2 * 1024 * 1024) {
              setPhotoError('Image must be under 2 MB')
              return
            }
            setPhotoError(null)
            setPhotoFile(f)
          }}
        />
        <span style={{ fontFamily:"'Poppins',sans-serif", fontSize:13, color:photoFile ? WHITE : MUTED }}>
          {photoFile ? photoFile.name : '📁 Choose an image (max 2 MB)'}
        </span>
      </label>

      {photoError && (
        <div style={{ fontFamily:"'Poppins',sans-serif", fontSize:12, color:RED, marginBottom:10 }}>{photoError}</div>
      )}

      {photoSuccess && (
        <div style={{ fontFamily:"'Poppins',sans-serif", fontSize:13, color:GREEN, textAlign:'center', marginBottom:10 }}>✓ Photo updated!</div>
      )}

      <button
        onClick={handlePhotoUpload}
        disabled={!photoFile || photoUploading}
        style={{ width:'100%', background:!photoFile||photoUploading?'rgba(0,102,255,0.3)':BLUE, color:WHITE, border:'none', borderRadius:8, padding:'10px 0', fontFamily:"'Poppins',sans-serif", fontSize:13, fontWeight:600, cursor:!photoFile||photoUploading?'not-allowed':'pointer', transition:'background 0.15s' }}
      >
        {photoUploading ? 'Uploading…' : 'Update Photo'}
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 7: Run typecheck**

```bash
npm run typecheck
```

Expected: no new errors.

- [ ] **Step 8: Run the dev server and verify visually**

```bash
npm run dev
```

Open `http://localhost:5173/admin/health` (sign in as admin first).

Verify:
1. Avatar circle appears in top-right of the admin header
2. Clicking it opens the upload modal
3. Choosing an image file shows a preview and enables the "Update Photo" button
4. A >2 MB file shows the size error
5. (After deploy) clicking "Update Photo" completes successfully and the modal closes with "✓ Photo updated!"

- [ ] **Step 9: Commit**

```bash
git add src/pages/admin/Health.jsx
git commit -m "feat(admin): clickable founder avatar + photo upload modal in Mission Control header"
```

---

## Task 6: Deploy and End-to-End Verification

**Files:** No changes — verification only.

- [ ] **Step 1: Push to main and wait for Vercel deploy**

```bash
git push origin main
```

Watch Vercel dashboard or run:

```bash
curl -s https://www.fypro.com.ng/api/admin?action=ping
# Expected: HTTP 200
```

- [ ] **Step 2: Test admin dashboard upload**

1. Sign in at `https://www.fypro.com.ng/admin/health`
2. Click avatar circle in the header
3. Upload a photo under 2 MB
4. Confirm modal shows "✓ Photo updated!" and closes
5. Reload — avatar now shows the photo (green dot visible)
6. Visit `https://www.fypro.com.ng/about` — founder card shows the same photo

- [ ] **Step 3: Test Telegram flow**

1. Open @fypro_admin_bot in Telegram
2. Send `/setphoto`
3. Bot replies: "📷 Send your photo now. You have 5 minutes."
4. Send a photo (not a document — use the photo attachment button)
5. Bot replies: "✅ Founder photo updated!"
6. Reload `https://www.fypro.com.ng/about` — photo updated

- [ ] **Step 4: Test expiry edge case**

1. Send `/setphoto`
2. Wait 6 minutes without sending a photo
3. Send a photo — bot should NOT reply (flag expired, silently ignored)

- [ ] **Step 5: Test fallback**

In Supabase SQL Editor, temporarily delete the `founder_photo` row:

```sql
DELETE FROM app_config WHERE key = 'founder_photo';
```

Reload `/about` and `/admin/health` — both should show "TA" initials (not a broken image).

Restore by uploading a new photo from the admin dashboard.
