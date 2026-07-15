import {
  useState, useRef, useEffect, useCallback,
  useImperativeHandle, forwardRef,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Cropper from 'react-easy-crop'
import Spinner from '../Spinner'
import { showToast } from '../Toast'
import { getCroppedBlob } from '../../lib/avatar'

// ─── Icons ──────────────────────────────────────────────────────────────
const EyeIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" />
  </svg>
)
const CameraIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
  </svg>
)
const CropIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 2v14a2 2 0 0 0 2 2h14" /><path d="M18 22V8a2 2 0 0 0-2-2H2" />
  </svg>
)
const EditBadgeIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
)

function AvatarEditorInner({ avatarUrl, initials, name, uploading, onSave }, ref) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [cropOpen, setCropOpen] = useState(false)
  const [cropSrc, setCropSrc] = useState(null)
  const [objectUrl, setObjectUrl] = useState(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [saving, setSaving] = useState(false)

  const fileInputRef = useRef(null)
  const menuRef = useRef(null)

  const hasPhoto = Boolean(avatarUrl)

  const revokeObjectUrl = useCallback(() => {
    setObjectUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null })
  }, [])

  const openChangePhoto = useCallback(() => {
    setMenuOpen(false)
    fileInputRef.current?.click()
  }, [])

  useImperativeHandle(ref, () => ({ openChangePhoto }), [openChangePhoto])

  // Close the menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    function onDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  const closeCrop = useCallback(() => {
    setCropOpen(false)
    setCropSrc(null)
    revokeObjectUrl()
  }, [revokeObjectUrl])

  // Esc closes the lightbox / crop modal
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return
      if (lightboxOpen) setLightboxOpen(false)
      else if (cropOpen && !saving) closeCrop()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [lightboxOpen, cropOpen, saving, closeCrop])

  // Revoke any dangling object URL on unmount
  useEffect(() => () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }, [objectUrl])

  function handleFilePicked(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    revokeObjectUrl()
    const url = URL.createObjectURL(file)
    setObjectUrl(url)
    setCropSrc(url)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCropOpen(true)
  }

  function openCropExisting() {
    setMenuOpen(false)
    if (!avatarUrl) return
    setCropSrc(avatarUrl)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCropOpen(true)
  }

  const onCropComplete = useCallback((_area, areaPixels) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  async function handleConfirmCrop() {
    if (!croppedAreaPixels || !cropSrc) return
    setSaving(true)
    let blob
    try {
      blob = await getCroppedBlob(cropSrc, croppedAreaPixels, 512)
    } catch (err) {
      console.error('[AvatarEditor] crop failed:', err)
      showToast('Could not process this image. Try uploading it again.')
      setSaving(false)
      return
    }
    try {
      await onSave(blob) // parent handles upload + its own success/error toast
      closeCrop()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="av-root" ref={menuRef}>
      <button
        type="button"
        className="av-trigger"
        aria-label="Edit profile photo"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
      >
        {hasPhoto
          ? <img src={avatarUrl} alt={name || 'Profile'} />
          : <span className="av-initials">{initials}</span>}
        <span className="av-edit-badge"><EditBadgeIcon /></span>
      </button>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            role="menu"
            className="av-menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
          >
            {hasPhoto && (
              <button type="button" role="menuitem" className="av-menu__item"
                onClick={() => { setMenuOpen(false); setLightboxOpen(true) }}>
                <EyeIcon /> View photo
              </button>
            )}
            <button type="button" role="menuitem" className="av-menu__item" onClick={openChangePhoto}>
              <CameraIcon /> Change photo
            </button>
            {hasPhoto && (
              <button type="button" role="menuitem" className="av-menu__item" onClick={openCropExisting}>
                <CropIcon /> Crop
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFilePicked}
      />

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && hasPhoto && (
          <motion.div
            className="av-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setLightboxOpen(false)}
          >
            <motion.img
              src={avatarUrl}
              alt={name || 'Profile'}
              className="av-lightbox-img"
              initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Crop modal */}
      <AnimatePresence>
        {cropOpen && cropSrc && (
          <motion.div
            className="av-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => { if (!saving) closeCrop() }}
          >
            <motion.div
              className="av-crop"
              initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="av-crop__title">Crop your photo</div>
              <div className="av-crop__area">
                <Cropper
                  image={cropSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>
              <div className="av-crop__controls">
                <div className="av-crop__zoom">
                  <span>Zoom</span>
                  <input
                    type="range" min={1} max={3} step={0.01} value={zoom}
                    aria-label="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                  />
                </div>
                <div className="av-crop__actions">
                  <button type="button" className="av-btn av-btn--ghost"
                    onClick={closeCrop} disabled={saving}>
                    Cancel
                  </button>
                  <button type="button" className="av-btn av-btn--primary"
                    onClick={handleConfirmCrop} disabled={saving || !croppedAreaPixels}>
                    {saving ? <><Spinner size={14} /> Saving…</> : 'Save Photo'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const AvatarEditor = forwardRef(AvatarEditorInner)
export default AvatarEditor
