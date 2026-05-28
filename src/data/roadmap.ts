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
    id: 'auth-payments',
    status: 'done',
    title: 'Auth & Payments',
    description:
      'Email sign-in with Supabase, project persistence across devices, and Paystack payments — Student Pack (₦2,000), Defense Pack (₦3,500), and Project Reset (₦1,500).',
    shippedDate: '2026-04-15',
  },
  {
    id: 'defense-simulator',
    status: 'done',
    title: 'Defense Simulator',
    description:
      'Three-examiner panel — The Methodologist, The Subject Expert, and The External Examiner — fires live questions based on your project and scores every answer in real time.',
    shippedDate: '2026-04-22',
  },
  {
    id: 'defense-certificate',
    status: 'done',
    title: 'Defense Certificate',
    description:
      'Score 7/10 or higher in a full panel session and download a personalised Defense Certificate with a unique serial number — proof you faced the panel before the real thing.',
    shippedDate: '2026-04-20',
  },
  {
    id: 'real-paper-integration',
    status: 'done',
    title: 'Real Paper Integration',
    description:
      'Topic Validator and Literature Map pull live academic papers from Semantic Scholar, OpenAlex, and Crossref — no hallucinated references, ever.',
    shippedDate: '2026-04-28',
  },
  {
    id: 'project-reviewer',
    status: 'done',
    title: 'Project Reviewer',
    description:
      'Upload your draft chapter as a PDF and FYPro reviews it against your methodology, flags gaps, and gives structured feedback — available on the Defense Pack.',
    shippedDate: '2026-05-05',
  },
  {
    id: 'rate-limiting',
    status: 'done',
    title: 'Rate Limiting & Spend Cap',
    description:
      'Per-IP and per-user API limits via Upstash Redis, with a daily spend cap so one bad actor cannot drain the budget in minutes.',
    shippedDate: '2026-05-01',
  },
  {
    id: 'referral-system',
    status: 'done',
    title: 'Referral Program',
    description:
      'Share your referral link — when three friends sign up through it you unlock a free Defense Simulator session, no payment required.',
    shippedDate: '2026-05-10',
  },
  {
    id: 'google-oauth',
    status: 'done',
    title: 'Google Sign-In',
    description:
      'One tap to get started — sign in or create your account with Google. No password to forget, no verification email to wait for.',
    shippedDate: '2026-05-17',
  },

  // ── Coming Soon ──────────────────────────────────────────────────────────────
  {
    id: 'voice-mode',
    status: 'coming_soon',
    title: 'Voice Mode',
    description:
      'Answer your panel questions out loud instead of typing. Powered by OpenAI Whisper and tuned for Nigerian accents.',
    targetWindow: 'Q3 2026',
  },
  {
    id: 'supervisor-dashboard',
    status: 'coming_soon',
    title: 'Supervisor Dashboard',
    description:
      "Supervisors track their students' structured progress without reading draft chapters. Built for the institutional model launching in v3.",
    targetWindow: 'Q4 2026',
  },
  {
    id: 'institutional-billing',
    status: 'coming_soon',
    title: 'Institutional Access',
    description:
      'Bulk licensing for universities — one department code unlocks FYPro for every final year student on the list.',
    targetWindow: 'Q4 2026',
  },
];
