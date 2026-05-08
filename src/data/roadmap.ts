export type RoadmapStatus = 'done' | 'in_progress' | 'coming_soon';

export type RoadmapItem = {
  id: string;
  status: RoadmapStatus;
  title: string;
  description: string;
  shippedDate?: string;
  targetWindow?: string;
};

export const roadmap: RoadmapItem[] = [
  // ── Done ────────────────────────────────────────────────────────────────────
  {
    id: 'topic-validator',
    status: 'done',
    title: 'Topic Validator',
    description:
      'Validates your raw topic idea against academic standards, flags weak areas, and gives a go/no-go verdict before you waste weeks going in the wrong direction.',
    shippedDate: '2026-03-15',
  },
  {
    id: 'chapter-architect',
    status: 'done',
    title: 'Chapter Architect + Literature Map',
    description:
      'Generates a structured five-chapter outline for your faculty, plus a Literature Map that groups 20 real papers into thematic clusters.',
    shippedDate: '2026-03-28',
  },
  {
    id: 'defense-simulator',
    status: 'done',
    title: 'Defense Simulator',
    description:
      'Three-examiner panel — The Methodologist, The Subject Expert, and The External Examiner — fires live questions based on your project and scores every answer in real time.',
    shippedDate: '2026-04-22',
  },

  // ── In Progress ─────────────────────────────────────────────────────────────
  {
    id: 'supabase-auth',
    status: 'in_progress',
    title: 'Auth & Persistent Projects',
    description:
      'Email sign-in and Supabase-backed project storage so your work survives closing the browser tab — and picks up exactly where you left off.',
  },
  {
    id: 'paystack-payments',
    status: 'in_progress',
    title: 'Paystack Payments',
    description:
      'One-time unlock model: Student Pack (₦2,000), Defense Pack (₦3,500), and Project Reset (₦1,500). No subscriptions, no surprises.',
  },
  {
    id: 'rate-limiting',
    status: 'in_progress',
    title: 'Rate Limiting & Spend Cap',
    description:
      'Per-IP and per-user API limits via Upstash Redis, with a daily spend cap so one bad actor cannot drain the budget in minutes.',
  },

  // ── Coming Soon ──────────────────────────────────────────────────────────────
  {
    id: 'real-paper-integration',
    status: 'coming_soon',
    title: 'Real Paper Integration',
    description:
      'Topic Validator and Literature Map will pull live academic papers from Semantic Scholar, OpenAlex, and Crossref — not hallucinated references.',
    targetWindow: 'July 2026',
  },
  {
    id: 'voice-mode',
    status: 'coming_soon',
    title: 'Voice Mode',
    description:
      'Answer your panel questions out loud instead of typing. Powered by OpenAI Whisper and tuned for Nigerian accents.',
    targetWindow: 'July 2026',
  },
  {
    id: 'supervisor-dashboard',
    status: 'coming_soon',
    title: 'Supervisor Dashboard',
    description:
      'Supervisors track their students' structured progress without reading draft chapters. Built for the institutional model launching in v3.',
    targetWindow: 'Q4 2026',
  },
];
