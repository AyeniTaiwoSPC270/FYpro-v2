import {
  buildTopicValidatorPrompt,
  buildChapterArchitectPrompt,
  buildMethodologyAdvisorPrompt,
  buildInstrumentBuilderPrompt,
  buildWritingPlannerPrompt,
  buildSupervisorEmailPrompt,
  buildRedFlagPrompt,
  THREE_EXAMINER_FIRST_QUESTION_PROMPT,
  buildThreeExaminerFollowUpPrompt, THREE_EXAMINER_SUMMARY_PROMPT,
  buildAbstractGeneratorPrompt,
  buildLiteratureMapPrompt,
  buildProjectReviewerPrompt,
  buildProjectReviewerPDFPrompt,
  buildDocumentRelevanceCheckPrompt,
  buildDocumentRelevanceCheckPDFPrompt,
  buildDefenceBriefPrompt,
  buildDefenceBriefCoachPrompt,
} from './prompts.js';
import { supabase } from '../lib/supabase';
import { setTraceId } from '../lib/sentry';

const ENDPOINT                  = '/api/ai';
const TOPIC_VALIDATOR_ENDPOINT  = '/api/research?action=validate';
const LITERATURE_MAP_ENDPOINT   = '/api/research?action=lit-map';
const DEFENSE_ENDPOINT          = '/api/ai?action=defense';
const REVIEWER_ENDPOINT         = '/api/project-reviewer';

async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function callClaude(step, messages, maxTokens = 2000, extraParams = {}) {
  if (!navigator.onLine) { const e = new Error('offline'); e.code = 'OFFLINE'; throw e }
  const token = await getAccessToken();
  if (!token) {
    const err = new Error('Session expired');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  const body = { step, messages, max_tokens: maxTokens, ...extraParams };
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const traceId = res.headers.get('X-Trace-Id');
  if (traceId) setTraceId(traceId);

  if (res.status === 429) {
    const err = new Error('Rate limited');
    err.code = 'RATE_LIMIT';
    throw err;
  }
  if (res.status === 503) {
    const err = new Error('Service temporarily unavailable. Please try again.');
    err.code = 'SERVICE_UNAVAILABLE';
    throw err;
  }
  if (res.status === 504) {
    const err = new Error('Gateway timeout');
    err.code = 'GATEWAY_TIMEOUT';
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.code = 'HTTP_ERROR';
    err.status = res.status;
    throw err;
  }

  const raw = await res.json();
  const text = raw?.content?.[0]?.text ?? '';

  if (raw?.stop_reason === 'max_tokens') {
    console.error('[callClaude] Response truncated (max_tokens). Raw end:', text.slice(-200));
    const err = new Error('Response was too long. Please try again.');
    err.code = 'JSON_PARSE';
    err.raw = text;
    throw err;
  }

  let parsed;
  try {
    const cleaned = text
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
  } catch {
    console.error('[callClaude] JSON parse failed. Raw response:', text.slice(0, 1000));
    const err = new Error('JSON parse failed');
    err.code = 'JSON_PARSE';
    err.raw = text;
    throw err;
  }

  return parsed;
}

// Calls /api/research?action=validate — passes raw topic for paper fetching
async function callTopicValidator(messages, topic) {
  if (!navigator.onLine) { const e = new Error('offline'); e.code = 'OFFLINE'; throw e }
  const token = await getAccessToken();
  if (!token) {
    const err = new Error('Session expired');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const res = await fetch(TOPIC_VALIDATOR_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages, max_tokens: 2000, topic }),
  });

  if (res.status === 401) {
    const err = new Error('Not authenticated');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  if (res.status === 429) {
    const err = new Error('Rate limited');
    err.code = 'RATE_LIMIT';
    throw err;
  }
  if (res.status === 504) {
    const err = new Error('Gateway timeout');
    err.code = 'GATEWAY_TIMEOUT';
    throw err;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `HTTP ${res.status}`);
    err.code = 'HTTP_ERROR';
    err.status = res.status;
    throw err;
  }

  const raw = await res.json();
  const text = raw?.content?.[0]?.text ?? '';

  let parsed;
  try {
    const cleaned   = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
  } catch {
    const err = new Error('JSON parse failed');
    err.code = 'JSON_PARSE';
    err.raw  = text;
    throw err;
  }

  return parsed;
}

// Calls /api/research?action=lit-map — passes topic for real-paper fetching; handles no_papers_found
async function callLiteratureMap(messages, topic) {
  if (!navigator.onLine) { const e = new Error('offline'); e.code = 'OFFLINE'; throw e }
  const token = await getAccessToken();
  if (!token) {
    const err = new Error('Session expired');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const res = await fetch(LITERATURE_MAP_ENDPOINT, {
    method:  'POST',
    headers,
    body:    JSON.stringify({ messages, max_tokens: 3000, topic }),
  });

  if (res.status === 401) {
    const err = new Error('Not authenticated');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  if (res.status === 422) {
    const errData = await res.json();
    const err = new Error(errData.message || 'No papers found for this topic.');
    err.code = 'NO_PAPERS';
    throw err;
  }
  if (res.status === 429) {
    const err = new Error('Rate limited');
    err.code = 'RATE_LIMIT';
    throw err;
  }
  if (res.status === 504) {
    const err = new Error('Gateway timeout');
    err.code = 'GATEWAY_TIMEOUT';
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.code = 'HTTP_ERROR';
    err.status = res.status;
    throw err;
  }

  const raw = await res.json();
  const text = raw?.content?.[0]?.text ?? '';

  let parsed;
  try {
    const cleaned   = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
  } catch {
    const err = new Error('JSON parse failed');
    err.code = 'JSON_PARSE';
    err.raw  = text;
    throw err;
  }

  return parsed;
}

// Auth-aware variant — attaches user JWT so server can verify entitlement.
// No `system` parameter: defense + reviewer system prompts are resolved
// server-side from `extra.promptType` + structured context.
async function callClaudeAuth(endpoint, messages, maxTokens = 2000, extra = {}) {
  if (!navigator.onLine) { const e = new Error('offline'); e.code = 'OFFLINE'; throw e }
  const token = await getAccessToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages, max_tokens: maxTokens, ...extra }),
  });

  if (res.status === 401) {
    const err = new Error('Not authenticated');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  if (res.status === 403) {
    const body = await res.json().catch(() => ({}));
    const serverCode = body?.error;
    const err = new Error(serverCode || 'Feature not unlocked');
    err.code = serverCode === 'FREE_TRIAL_USED' ? 'FREE_TRIAL_USED' : 'FORBIDDEN';
    throw err;
  }
  if (res.status === 429) {
    const err = new Error('Rate limited');
    err.code = 'RATE_LIMIT';
    throw err;
  }
  if (res.status === 504) {
    const err = new Error('Gateway timeout');
    err.code = 'GATEWAY_TIMEOUT';
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.code = 'HTTP_ERROR';
    err.status = res.status;
    throw err;
  }

  const raw = await res.json();
  const text = raw?.content?.[0]?.text ?? '';

  let parsed;
  try {
    const stripped = text.replace(/```json|```/g, '').trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : stripped);
  } catch {
    const err = new Error('JSON parse failed');
    err.code = 'JSON_PARSE';
    err.raw = text;
    throw err;
  }

  if (raw._truncationWarning) {
    parsed._truncationWarning = raw._truncationWarning;
  }

  return parsed;
}

async function callClaudeAuthRaw(endpoint, messages, maxTokens = 2000, extra = {}) {
  if (!navigator.onLine) { const e = new Error('offline'); e.code = 'OFFLINE'; throw e }
  const token = await getAccessToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages, max_tokens: maxTokens, ...extra }),
  });

  if (res.status === 401) {
    const err = new Error('Not authenticated');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  if (res.status === 403) {
    const body = await res.json().catch(() => ({}));
    const serverCode = body?.error;
    const err = new Error(serverCode || 'Feature not unlocked');
    err.code = serverCode === 'FREE_TRIAL_USED' ? 'FREE_TRIAL_USED' : 'FORBIDDEN';
    throw err;
  }
  if (res.status === 429) {
    const err = new Error('Rate limited');
    err.code = 'RATE_LIMIT';
    throw err;
  }
  if (res.status === 504) {
    const err = new Error('Gateway timeout');
    err.code = 'GATEWAY_TIMEOUT';
    throw err;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `HTTP ${res.status}`);
    err.code = 'HTTP_ERROR';
    err.status = res.status;
    throw err;
  }

  const raw = await res.json();
  const text = raw?.content?.[0]?.text ?? '';

  let parsed;
  try {
    const stripped = text.replace(/```json|```/g, '').trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : stripped);
  } catch {
    const err = new Error('JSON parse failed');
    err.code = 'JSON_PARSE';
    err.raw = text;
    throw err;
  }

  return { parsed, rawText: text };
}

// ── Step 1: Topic Validator ──────────────────────────────────────────────────
export async function validateTopic(studentCtx, roughTopic) {
  return callTopicValidator(
    [{ role: 'user', content: buildTopicValidatorPrompt(studentCtx, roughTopic) }],
    roughTopic
  );
}

// ── Step 2: Chapter Architect ────────────────────────────────────────────────
export async function buildChapters(studentCtx, validatedTopic, structureType, totalWordCount, features = []) {
  // Free vs paid system prompt is now resolved server-side from the user's JWT entitlements
  return callClaude(
    'chapter-architect',
    [{ role: 'user', content: buildChapterArchitectPrompt(studentCtx, structureType, totalWordCount) }],
    3000
  );
}

// ── Step 2 companion: Abstract Generator ────────────────────────────────────
export async function generateAbstract(studentCtx, validatedTopic, chapterStructure) {
  return callClaude(
    'abstract-generator',
    [{ role: 'user', content: buildAbstractGeneratorPrompt(studentCtx, chapterStructure) }]
  );
}

// ── Step 2 companion: Literature Map ─────────────────────────────────────────
export async function generateLiteratureMap(studentCtx, validatedTopic, chapterStructure) {
  return callLiteratureMap(
    [{ role: 'user', content: buildLiteratureMapPrompt(studentCtx, chapterStructure) }],
    validatedTopic
  );
}

// ── Step 3: Methodology Advisor ──────────────────────────────────────────────
export async function adviseMethodology(studentCtx, validatedTopic, chapterStructure, features = []) {
  // Free vs paid system prompt is now resolved server-side from the user's JWT entitlements
  return callClaude(
    'methodology-advisor',
    [{ role: 'user', content: buildMethodologyAdvisorPrompt(studentCtx) }],
    4000
  );
}

// ── Step 3 inline: Instrument Builder ───────────────────────────────────────
export async function buildInstrument(studentCtx, validatedTopic, chosenMethodology, chapterStructure) {
  return callClaude(
    'instrument-builder',
    [{ role: 'user', content: buildInstrumentBuilderPrompt(studentCtx, chosenMethodology) }],
    4000
  );
}

// ── Step 4: Writing Planner ──────────────────────────────────────────────────
export async function buildWritingPlan(studentCtx, submissionDeadline, currentDate, previousSteps = {}, features = []) {
  const isFree = !features.includes('student_pack') && !features.includes('defense_pack');
  // previousSteps sent as structured data — server builds the context prefix server-side
  const result = await callClaude(
    'writing-planner',
    [{ role: 'user', content: buildWritingPlannerPrompt(studentCtx, submissionDeadline, currentDate) }],
    2000,
    { previousSteps }
  );

  // Safety net: enforce actual word count from Chapter Architect regardless of what Claude returned.
  const actualWords = previousSteps.chapterStructure?.total_word_count ?? studentCtx.totalWordCount ?? null;
  if (actualWords && actualWords > 0) {
    result.total_words = actualWords;
    const writingWeeks = Array.isArray(result.weeks)
      ? result.weeks.filter(w => !w.is_buffer_week && !w.is_holiday_week).length
      : result.total_weeks || 1;
    result.weekly_average = Math.round(actualWords / Math.max(writingWeeks, 1));
  }

  if (isFree && Array.isArray(result.weeks)) {
    result.weeks = result.weeks.slice(0, 4);
  }
  return result;
}

// ── Document Relevance Pre-Check ─────────────────────────────────────────────
export async function checkDocumentRelevance(studentCtx, extractedText) {
  return callClaudeAuth(
    REVIEWER_ENDPOINT,
    [{ role: 'user', content: buildDocumentRelevanceCheckPrompt(studentCtx, extractedText) }],
    200,
    { promptType: 'relevance-check' }
  );
}

export async function checkDocumentRelevancePDF(studentCtx, base64Data, mediaType = 'application/pdf') {
  const userContent = [
    { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64Data } },
    { type: 'text', text: buildDocumentRelevanceCheckPDFPrompt(studentCtx) },
  ];
  return callClaudeAuth(
    REVIEWER_ENDPOINT,
    [{ role: 'user', content: userContent }],
    200,
    { promptType: 'relevance-check' }
  );
}

// ── Step 5: Project Reviewer (text) ─────────────────────────────────────────
export async function reviewProject(studentCtx, validatedTopic, extractedText, previousSteps = {}) {
  return callClaudeAuth(
    REVIEWER_ENDPOINT,
    [{ role: 'user', content: buildProjectReviewerPrompt(studentCtx, extractedText) }],
    3000,
    { promptType: 'review', previousSteps }
  );
}

// ── Step 5: Project Reviewer (DOCX base64) ────────────────────────────────────
// Raw DOCX bytes are sent to the server; mammoth extracts the full text there.
// This avoids the 12k-character client-side truncation that affected the old path.
export async function reviewProjectDOCX(studentCtx, base64Data, previousSteps = {}) {
  return callClaudeAuth(
    REVIEWER_ENDPOINT,
    [],
    3000,
    { promptType: 'review', previousSteps, docx_base64: base64Data, student_context: studentCtx }
  );
}

// ── Step 5: Project Reviewer (PDF base64) ────────────────────────────────────
export async function reviewProjectPDF(studentCtx, validatedTopic, base64Data, mediaType = 'application/pdf', previousSteps = {}) {
  const userContent = [
    { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64Data } },
    { type: 'text', text: buildProjectReviewerPDFPrompt(studentCtx) },
  ];
  return callClaudeAuth(
    REVIEWER_ENDPOINT,
    [{ role: 'user', content: userContent }],
    3000,
    { promptType: 'review', previousSteps }
  );
}

// ── Step 6: Red Flag Detector ────────────────────────────────────────────────
export async function detectRedFlags(studentCtx, validatedTopic, methodology, chapterStructure, uploadedReview) {
  return callClaudeAuth(
    DEFENSE_ENDPOINT,
    [{ role: 'user', content: buildRedFlagPrompt(studentCtx, chapterStructure, methodology, uploadedReview) }],
    2000,
    { promptType: 'red-flag' }
  );
}

// ── Step 6: Three-Examiner Panel — first question ────────────────────────────
// The server rebuilds the panel system prompt from defenseContext on every turn;
// the client only holds the structured context, never the prompt text.
export async function panelFirstQuestion(studentCtx, redFlags, uploadedReview) {
  const defenseContext = { studentCtx, redFlags, uploadedReview };
  const { parsed, rawText } = await callClaudeAuthRaw(
    DEFENSE_ENDPOINT,
    [{ role: 'user', content: THREE_EXAMINER_FIRST_QUESTION_PROMPT }],
    2000,
    { promptType: 'panel', defenseContext }
  );
  return { parsed, rawText, defenseContext };
}

// ── Step 6: Three-Examiner Panel — follow-up ─────────────────────────────────
export async function panelFollowUp(defenseContext, apiMessages, studentAnswer) {
  const messages = [
    ...apiMessages,
    { role: 'user', content: buildThreeExaminerFollowUpPrompt(studentAnswer) },
  ];
  const answerWordCount = studentAnswer.trim() === '' ? 0 : studentAnswer.trim().split(/\s+/).length;
  const { parsed, rawText } = await callClaudeAuthRaw(
    DEFENSE_ENDPOINT,
    messages,
    2000,
    { answerWordCount, promptType: 'panel', defenseContext }
  );
  return { parsed, rawText };
}

// ── Step 6: Three-Examiner Panel — summary ───────────────────────────────────
export async function panelSummary(defenseContext, apiMessages) {
  const messages = [
    ...apiMessages,
    { role: 'user', content: THREE_EXAMINER_SUMMARY_PROMPT },
  ];
  return callClaudeAuth(DEFENSE_ENDPOINT, messages, 2000, { promptType: 'panel', defenseContext });
}

// ── Bonus: Supervisor Meeting Prep ───────────────────────────────────────────
export async function prepareSupervisorMeeting(stage, lastFeedback, stuckOn) {
  if (!navigator.onLine) { const e = new Error('offline'); e.code = 'OFFLINE'; throw e }
  const token = await getAccessToken();
  if (!token) {
    const err = new Error('Session expired');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  const res = await fetch('/api/ai?action=supervisor-prep', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ stage, lastFeedback: lastFeedback || '', stuckOn: stuckOn || '' }),
  });

  if (res.status === 401) {
    const err = new Error('Session expired');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  if (res.status === 429) {
    const err = new Error('Rate limited');
    err.code = 'RATE_LIMIT';
    throw err;
  }
  if (res.status === 504) {
    const err = new Error('Gateway timeout');
    err.code = 'GATEWAY_TIMEOUT';
    throw err;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err  = new Error(body.error || `HTTP ${res.status}`);
    err.code   = 'HTTP_ERROR';
    err.status = res.status;
    throw err;
  }

  return res.json(); // { questions: string[] }
}

// ── Bonus: Supervisor Email ──────────────────────────────────────────────────
export async function generateEmail(studentCtx, validatedTopic, chapterStructure, methodology) {
  return callClaude(
    'supervisor-email',
    [{ role: 'user', content: buildSupervisorEmailPrompt(studentCtx, chapterStructure) }]
  );
}

// ── Error handler (call from components) ─────────────────────────────────────
// Returns true if error was handled, false if caller should do fallback
const AI_ERRORS = {
  rate_limit:    'FYPro is in high demand right now. Your progress is saved — please try again in {secs} seconds.',
  timeout:       'This is taking longer than expected. Your progress is saved. Please click Try Again.',
  network:       'Connection lost. Your progress is saved. Check your internet and try again.',
  generic:       'Something went wrong on our end. Your progress is saved. Please try again.',
  token_limit:   'Your input is too long. Please shorten it and try again.',
  json_parse:    'Received an unexpected response. Your progress is saved. Please try again.',
  forbidden:     'This feature requires a paid upgrade. Please visit the Pricing page to unlock it.',
  unauthorized:  'Your session has expired. Please sign in again.',
  unavailable:   'FYPro is temporarily unavailable. Your progress is saved. Please try again in a moment.',
};

// Module-level handle for the rate-limit countdown so components can clear it on unmount.
let _rateLimitInterval = null;

export function clearRateLimitCountdown() {
  clearInterval(_rateLimitInterval);
  _rateLimitInterval = null;
}

export function handleApiError(err, showError) {
  if (err.code === 'OFFLINE') {
    showError("You're offline. Connect to generate new content.")
    return true
  }
  if (err.code === 'NO_PAPERS') {
    showError(err.message);
    return true;
  }
  if (err.code === 'FORBIDDEN') {
    showError(AI_ERRORS.forbidden);
    return true;
  }
  if (err.code === 'UNAUTHORIZED') {
    showError(AI_ERRORS.unauthorized);
    return true;
  }
  if (err.code === 'RATE_LIMIT') {
    clearInterval(_rateLimitInterval);
    let secs = 60;
    showError(AI_ERRORS.rate_limit.replace('{secs}', secs));
    _rateLimitInterval = setInterval(() => {
      secs--;
      if (secs <= 0) {
        clearInterval(_rateLimitInterval);
        _rateLimitInterval = null;
        showError(null);
      } else {
        showError(AI_ERRORS.rate_limit.replace('{secs}', secs));
      }
    }, 1000);
    return true;
  }
  if (err.code === 'GATEWAY_TIMEOUT') {
    showError(AI_ERRORS.timeout);
    return true;
  }
  if (err.code === 'SERVICE_UNAVAILABLE') {
    showError(AI_ERRORS.unavailable);
    return true;
  }
  if (err.code === 'JSON_PARSE') {
    showError(AI_ERRORS.json_parse);
    return true;
  }
  if (err.code === 'TOKEN_LIMIT') {
    showError(AI_ERRORS.token_limit);
    return true;
  }
  if (err.status === 400) {
    showError(err.message && !err.message.startsWith('HTTP ') ? err.message : AI_ERRORS.token_limit);
    return true;
  }
  if (err.message?.toLowerCase().includes('network') || err.message?.toLowerCase().includes('fetch')) {
    showError(AI_ERRORS.network);
    return true;
  }
  showError(err.message || AI_ERRORS.generic);
  return true;
}

// ── Failure logging ───────────────────────────────────────────────────────────
// Call from every feature's catch block. Never throws — never affects UX.
export async function logFailure(feature, err, inputPreview = '') {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('generation_failures').insert({
      user_id:       session?.user?.id || null,
      feature,
      error_type:    err?.code === 'RATE_LIMIT'      ? 'rate_limit'
                   : err?.code === 'GATEWAY_TIMEOUT' ? 'timeout'
                   : 'generic',
      error_message: err?.message || 'Unknown error',
      input_preview: String(inputPreview).substring(0, 100),
    });
  } catch {
    // silent — never affect UX
  }
}

// ── Defence Brief ─────────────────────────────────────────────────────────────

const DEFENCE_BRIEF_ENDPOINT       = '/api/ai?action=defence-brief';
const DEFENCE_BRIEF_COACH_ENDPOINT = '/api/ai?action=defence-brief-coach';

export async function generateDefenceBrief(studentCtx, weaknesses, examinerQuestions) {
  return callClaudeAuth(
    DEFENCE_BRIEF_ENDPOINT,
    [{ role: 'user', content: buildDefenceBriefPrompt(studentCtx, weaknesses, examinerQuestions) }],
    3500,
    { promptType: 'defence-brief' }
  );
}

export async function coachDefenceBriefAnswer(weakSpot, conversationHistory) {
  return callClaudeAuth(
    DEFENCE_BRIEF_COACH_ENDPOINT,
    [{ role: 'user', content: buildDefenceBriefCoachPrompt(weakSpot, conversationHistory) }],
    500,
    { promptType: 'defence-brief-coach' }
  );
}

// ── Push Notifications ────────────────────────────────────────────────────────
export async function subscribePush(subscriptionJson) {
  const token = await getAccessToken();
  if (!token) return;
  await fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'subscribe', subscription: subscriptionJson }),
  });
}

export async function unsubscribePush() {
  const token = await getAccessToken();
  if (!token) return;
  await fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'unsubscribe' }),
  });
}
