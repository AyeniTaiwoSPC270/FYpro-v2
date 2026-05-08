export type ChangelogEntry = {
  id: string;        // unique slug, never reused: 'voice-mode-2026-06-03'
  date: string;      // ISO date
  emoji: string;     // single visual marker
  title: string;     // short, sentence case
  body: string;      // 1–3 sentences
  ctaLabel?: string;
  ctaHref?: string;  // internal path or absolute URL
};

export const changelog: ChangelogEntry[] = [
  // newest first — add new entries at the TOP of this array
  {
    id: 'security-audit-2026-05-01',
    date: '2026-05-01',
    emoji: '🔐',
    title: 'Security audit complete — FYPro earns an A+',
    body: 'We completed a full security review covering RLS policies, API key handling, and rate limiting. Every table is protected, every key stays server-side. Your data is safe.',
  },
  {
    id: 'defense-certificate-2026-04-20',
    date: '2026-04-20',
    emoji: '🎓',
    title: 'Defense Certificate now available after simulation',
    body: "Complete a full three-examiner panel session and download your Defense Certificate — proof you've faced the panel and identified your gaps before the real thing.",
    ctaLabel: 'Try Defense Prep',
    ctaHref: '/app',
  },
  {
    id: 'voice-mode-2026-04-10',
    date: '2026-04-10',
    emoji: '🎙️',
    title: 'Voice mode is live — answer your panel out loud',
    body: 'Defense Prep now supports voice input via OpenAI Whisper. Speak your answers instead of typing — tuned for Nigerian accents. Tap the mic icon to start.',
    ctaLabel: 'Try Voice Mode',
    ctaHref: '/app',
  },
];
