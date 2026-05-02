// Shown once after signup when localStorage contains pre-auth session progress.
// Lets the student choose to bring their work into their new account or start fresh.

import { motion } from 'framer-motion'

interface Props {
  onBringOver: () => void
  onStartFresh: () => void
}

export default function AnonymousMigrationModal({ onBringOver, onStartFresh }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: -16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -16, scale: 0.97 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="mt-[18vh] w-full max-w-md mx-4 rounded-2xl p-8"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(0,102,255,0.12)' }}
          >
            <svg width="20" height="20" viewBox="0 0 256 256" fill="#0066FF" aria-hidden="true">
              <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a16,16,0,1,1,16,16A16,16,0,0,1,112,84Z" />
            </svg>
          </div>
          <h2 className="font-serif text-[1.15rem] text-white leading-snug">
            We found some earlier work
          </h2>
        </div>

        <p className="font-sans text-[0.82rem] text-slate-400 leading-[1.62] mb-6">
          You were working on a project before signing up. Want to bring it into your account?
          Your topic, chapters, and methodology will be saved against your profile.
        </p>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={onBringOver}
            className="w-full py-3 rounded-xl font-sans text-[0.85rem] font-semibold text-white cursor-pointer transition-all duration-200 hover:opacity-90"
            style={{ background: '#0066FF', border: 'none' }}
          >
            Bring it over
          </button>
          <button
            onClick={onStartFresh}
            className="w-full py-3 rounded-xl font-sans text-[0.82rem] font-medium cursor-pointer transition-colors duration-150"
            style={{
              background: 'transparent',
              border: '1px solid var(--border-color)',
              color: 'var(--color-text-secondary, rgba(255,255,255,0.5))',
            }}
          >
            Start fresh
          </button>
        </div>
      </motion.div>
    </div>
  )
}
