# Certificate Redesign Spec
**Date:** 2026-06-06
**Scope:** PDF certificate only (not MyCertificates page layout)

---

## Goal

Replace the current single-style jsPDF certificate with three selectable designs and two orientations. Students choose their preferred style and orientation via a modal before downloading. QR code added to all designs for verification.

---

## What the student sees

1. Clicks **Download certificate** from either `CertificateUnlock` (after a defense session) or `My Certificates` page.
2. A **modal** opens with:
   - **Style picker** — three mini preview thumbnails (Academic Prestige, Modern Bold, Dark Premium), click to select
   - **Orientation toggle** — Portrait (A4 210×297mm) or Landscape (A4 297×210mm)
   - **Download PDF** button (green, full-width)
   - Cancel link
3. Selected style and orientation persist to `localStorage` (`cert_style`, `cert_orientation`) so the next download remembers their preference.
4. Clicking Download fires a spinner on the button, calls the API, and triggers the browser PDF download. Modal closes on success.

---

## The three PDF styles

### A — Academic Prestige
- **Background:** ivory (#FFFDF5)
- **Border:** 2px gold (#C9A84C) outer border with corner ornaments (L-shaped, 22×22px, positioned at inset 7px)
- **Inner border:** 0.5px gold tint at inset 12px
- **Seal:** 52×52px circular emblem, radial gradient (#E8C86A → #8B6914), "FY" initials in white, drop shadow
- **Title band:** full-width strip with gradient gold wash, dotted gold rules above and below, "CERTIFICATE OF DEFENSE READINESS" in gold uppercase with 2.5px letter-spacing
- **Fleuron divider:** decorative ❧ between thin gold gradient lines
- **Topic:** italic, quoted, DM Serif Display
- **Score:** gold gradient pill, Courier, "Score: 9 / 10"
- **QR code:** bottom-left, 36×36px, white background, gold border

### B — Modern Bold
- **Background:** white
- **Top/bottom bars:** 10px solid #0066FF
- **Logo:** "FYPro" in blue, DM Serif Display, letter-spaced
- **Achievement band:** #F0FFF4 background, 3px solid green left border, "DEFENSE READINESS CERTIFIED" in green uppercase, subtitle "AI-proctored · Verified score · Cannot be self-reported"
- **Score pill:** solid #0066FF, white text, Courier, "FYPro Score: 9 / 10"
- **Tagline:** "The supervisor you never had." in muted grey, small
- **QR code:** bottom-left, 36×36px, #F8FAFC background, light grey border

### C — Dark Premium
- **Background:** linear gradient #0D1B2A → #060E18 (160deg)
- **Border:** 1px rgba(0,102,255,0.25), outer glow box-shadow
- **Top/bottom accent:** 4px line, gradient transparent → #0066FF → #3B82F6 → transparent
- **Glow orb:** radial blur circle, rgba(0,102,255,0.07), centered behind content
- **Logo:** white, letter-spacing 3px, uppercase
- **Title:** rgba(96,165,250,0.9), 3px letter-spacing, flanked by thin blue rules
- **Score badge:** outlined pill, border rgba(0,102,255,0.5), text #93C5FD, background rgba(0,102,255,0.08), inner glow shadow
- **Name glow:** text-shadow 0 0 20px rgba(0,102,255,0.4)
- **QR code:** bottom-left, 36×36px, rgba(255,255,255,0.04) background, blue border, light blue modules

---

## Orientations

**Portrait** — A4 210×297mm. Single centered column. All three styles use this layout by default.

**Landscape** — A4 297×210mm. Two-column layout:
- Left column: FYPro logo, title, "this certifies that", name, faculty/department, topic
- Right column: score badge, issue date, QR code + cert number
- The decorative elements (bars, border, ornaments) span the full width as in portrait

---

## QR code

- Generated server-side using the `qrcode` npm package
- URL encoded: `https://fypro.com.ng/verify/{certificate_number}`
- Output: base64 PNG via `qrcode.toDataURL(url, { width: 80, margin: 1 })`
- Embedded with `doc.addImage()` at bottom-left of every style
- QR module color matches the style: dark brown (prestige), dark navy (modern), light blue (dark premium)

---

## API changes — `api/certificate.js`

POST body now accepts two optional fields:
```json
{
  "defense_session_id": "...",
  "style": "prestige | modern | dark",
  "orientation": "portrait | landscape"
}
```
Both default to `"modern"` and `"portrait"` if omitted — no breaking change for existing callers.

`buildCertificatePDF` signature:
```js
function buildCertificatePDF({ recipientName, faculty, department, topicTitle, score, certNumber, issuedAt, style, orientation })
```

Internal structure:
```js
const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
const W = orientation === 'landscape' ? 297 : 210
const H = orientation === 'landscape' ? 210 : 297

if (style === 'prestige') drawPrestige(doc, W, H, data)
else if (style === 'dark')    drawDark(doc, W, H, data)
else                          drawModern(doc, W, H, data)   // default
```

Each draw function handles its own layout. Font registration and QR generation are shared utilities called before branching.

---

## Frontend changes

### `src/lib/certificate.ts`
```ts
export async function downloadCertificate(
  defenseSessionId: string,
  style: 'prestige' | 'modern' | 'dark' = 'modern',
  orientation: 'portrait' | 'landscape' = 'portrait'
): Promise<void>
```
Forwards `style` and `orientation` in the POST body.

### New: `src/components/defense/CertificateDownloadModal.jsx`
- Props: `{ isOpen, onClose, defenseSessionId, topic }`
- On mount: reads `cert_style` / `cert_orientation` from localStorage (defaults: `'modern'` / `'portrait'`)
- On download: saves selection to localStorage, calls `downloadCertificate`, shows loading state, closes modal on success
- Error handling: same pattern as current `CertificateUnlock` (NAME_REQUIRED special case + Sentry capture for other errors)

### `src/components/defense/CertificateUnlock.jsx`
- Replace `handleDownload` with `isCertModalOpen` state + `<CertificateDownloadModal>` trigger
- `handleShare` stays unchanged — it always calls the API with no style/orientation (defaults to modern + portrait on the server side)

### `src/pages/account/MyCertificates.jsx`
- Replace per-row Download button handler with `CertificateDownloadModal`
- Track `activeCertSessionId` state — which cert's modal is open

---

## New dependency

```json
"qrcode": "^1.5.4"
```

No other new packages. All existing dependencies (jsPDF, Supabase, Sentry, etc.) unchanged.

---

## What is NOT changing

- The `/api/certificate` endpoint URL, method, and auth flow
- The `defense_certificates` table schema and RLS
- The `fetchMyCertificates` function
- Certificate number format (FYP-2026-XXXXXX)
- Score threshold (7/10)
- The share-to-WhatsApp button (stays in `CertificateUnlock`, always shares modern + portrait — no style picker for share)
- The `MyCertificates` page layout/design

---

## Files changed

| File | Change |
|------|--------|
| `api/certificate.js` | Add style/orientation params, 3 draw functions, QR generation |
| `src/lib/certificate.ts` | Add style/orientation params to `downloadCertificate` |
| `src/components/defense/CertificateDownloadModal.jsx` | **New file** |
| `src/components/defense/CertificateUnlock.jsx` | Replace download button with modal trigger |
| `src/pages/account/MyCertificates.jsx` | Replace download button with modal trigger |
| `package.json` | Add `qrcode` dependency |
