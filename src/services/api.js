import {
  buildTopicValidatorPrompt, TOPIC_VALIDATOR_SYSTEM,
  buildChapterArchitectPrompt, CHAPTER_ARCHITECT_SYSTEM,
  buildMethodologyAdvisorPrompt, METHODOLOGY_ADVISOR_SYSTEM,
  buildInstrumentBuilderPrompt, INSTRUMENT_BUILDER_SYSTEM,
  buildWritingPlannerPrompt, WRITING_PLANNER_SYSTEM,
  buildSupervisorEmailPrompt, SUPERVISOR_EMAIL_SYSTEM,
  buildRedFlagPrompt, RED_FLAG_DETECTOR_SYSTEM,
  buildThreeExaminerPanelSystem, THREE_EXAMINER_FIRST_QUESTION_PROMPT,
  buildThreeExaminerFollowUpPrompt, THREE_EXAMINER_SUMMARY_PROMPT,
  buildAbstractGeneratorPrompt, ABSTRACT_GENERATOR_SYSTEM,
  buildLiteratureMapPrompt, LITERATURE_MAP_SYSTEM,
  buildProjectReviewerPrompt, PROJECT_REVIEWER_SYSTEM,
  buildProjectReviewerPDFPrompt,
  buildDocumentRelevanceCheckPrompt, DOCUMENT_RELEVANCE_CHECK_SYSTEM,
  buildDocumentRelevanceCheckPDFPrompt,
  buildPreviousStepsContext,
} from './prompts.js';
import { supabase } from '../lib/supabase';

const ENDPOINT                  = '/api/ai';
const TOPIC_VALIDATOR_ENDPOINT  = '/api/research?action=validate';
const LITERATURE_MAP_ENDPOINT   = '/api/research?action=lit-map';
const DEFENSE_ENDPOINT          = '/api/ai?action=defense';
const REVIEWER_ENDPOINT         = '/api/project-reviewer';

async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function callClaude(system, messages, maxTokens = 2000, step = null) {
  const token = await getAccessToken();
  if (!token) {
    const err = new Error('Session expired');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  const body = { system, messages, max_tokens: maxTokens };
  if (step) body.step = step;
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

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
async function callTopicValidator(system, messages, topic) {
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
    body: JSON.stringify({ system, messages, max_tokens: 2000, topic }),
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
async function callLiteratureMap(system, messages, topic) {
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
    body:    JSON.stringify({ system, messages, max_tokens: 3000, topic }),
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

// Auth-aware variant — attaches user JWT so server can verify entitlement
async function callClaudeAuth(endpoint, system, messages, maxTokens = 2000) {
  const token = await getAccessToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ system, messages, max_tokens: maxTokens }),
  });

  if (res.status === 401) {
    const err = new Error('Not authenticated');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  if (res.status === 403) {
    const err = new Error('Feature not unlocked');
    err.code = 'FORBIDDEN';
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

async function callClaudeAuthRaw(endpoint, system, messages, maxTokens = 2000, extra = {}) {
  const token = await getAccessToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ system, messages, max_tokens: maxTokens, ...extra }),
  });

  if (res.status === 401) {
    const err = new Error('Not authenticated');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  if (res.status === 403) {
    const err = new Error('Feature not unlocked');
    err.code = 'FORBIDDEN';
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
    TOPIC_VALIDATOR_SYSTEM,
    [{ role: 'user', content: buildTopicValidatorPrompt(studentCtx, roughTopic) }],
    roughTopic
  );
}

// ── Step 2: Chapter Architect ────────────────────────────────────────────────
export async function buildChapters(studentCtx, validatedTopic, structureType, totalWordCount, features = []) {
  const isFree = !features.includes('student_pack') && !features.includes('defense_pack');
  const system = isFree
    ? CHAPTER_ARCHITECT_SYSTEM + '\n\nProvide a basic chapter outline only. List chapter titles and one sentence per chapter. Do not provide detailed breakdowns, subsections, or content guidance.'
    : CHAPTER_ARCHITECT_SYSTEM;
  return callClaude(
    system,
    [{ role: 'user', content: buildChapterArchitectPrompt(studentCtx, structureType, totalWordCount) }],
    3000
  );
}

// ── Step 2 companion: Abstract Generator ────────────────────────────────────
export async function generateAbstract(studentCtx, validatedTopic, chapterStructure) {
  return callClaude(
    ABSTRACT_GENERATOR_SYSTEM,
    [{ role: 'user', content: buildAbstractGeneratorPrompt(studentCtx, chapterStructure) }]
  );
}

// ── Step 2 companion: Literature Map ─────────────────────────────────────────
export async function generateLiteratureMap(studentCtx, validatedTopic, chapterStructure) {
  return callLiteratureMap(
    LITERATURE_MAP_SYSTEM,
    [{ role: 'user', content: buildLiteratureMapPrompt(studentCtx, chapterStructure) }],
    validatedTopic
  );
}

// ── Step 3: Methodology Advisor ──────────────────────────────────────────────
export async function adviseMethodology(studentCtx, validatedTopic, chapterStructure, features = []) {
  const isFree = !features.includes('student_pack') && !features.includes('defense_pack');
  const system = isFree
    ? METHODOLOGY_ADVISOR_SYSTEM + '\n\nProvide a methodology recommendation only. State which methodology is most suitable and give one paragraph of reasoning. Do not include the defense_answer_template field in your JSON response — omit it entirely.'
    : METHODOLOGY_ADVISOR_SYSTEM;
  return callClaude(
    system,
    [{ role: 'user', content: buildMethodologyAdvisorPrompt(studentCtx) }],
    4000,
    'methodology-advisor'
  );
}

// ── Step 3 inline: Instrument Builder ───────────────────────────────────────
export async function buildInstrument(studentCtx, validatedTopic, chosenMethodology, chapterStructure) {
  return callClaude(
    INSTRUMENT_BUILDER_SYSTEM,
    [{ role: 'user', content: buildInstrumentBuilderPrompt(studentCtx, chosenMethodology) }],
    4000
  );
}

// ── Step 4: Writing Planner ──────────────────────────────────────────────────
export async function buildWritingPlan(studentCtx, submissionDeadline, currentDate, previousSteps = {}, features = []) {
  const isFree = !features.includes('student_pack') && !features.includes('defense_pack');
  const contextBlock = buildPreviousStepsContext(previousSteps);
  const system = contextBlock ? contextBlock + '\n\n' + WRITING_PLANNER_SYSTEM : WRITING_PLANNER_SYSTEM;
  const result = await callClaude(
    system,
    [{ role: 'user', content: buildWritingPlannerPrompt(studentCtx, submissionDeadline, currentDate) }]
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
    DOCUMENT_RELEVANCE_CHECK_SYSTEM,
    [{ role: 'user', content: buildDocumentRelevanceCheckPrompt(studentCtx, extractedText) }],
    200
  );
}

export async function checkDocumentRelevancePDF(studentCtx, base64Data, mediaType = 'application/pdf') {
  const userContent = [
    { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64Data } },
    { type: 'text', text: buildDocumentRelevanceCheckPDFPrompt(studentCtx) },
  ];
  return callClaudeAuth(
    REVIEWER_ENDPOINT,
    DOCUMENT_RELEVANCE_CHECK_SYSTEM,
    [{ role: 'user', content: userContent }],
    200
  );
}

// ── Step 5: Project Reviewer (text) ─────────────────────────────────────────
export async function reviewProject(studentCtx, validatedTopic, extractedText, previousSteps = {}) {
  const contextBlock = buildPreviousStepsContext(previousSteps);
  const system = contextBlock ? contextBlock + '\n\n' + PROJECT_REVIEWER_SYSTEM : PROJECT_REVIEWER_SYSTEM;
  return callClaudeAuth(
    REVIEWER_ENDPOINT,
    system,
    [{ role: 'user', content: buildProjectReviewerPrompt(studentCtx, extractedText) }]
  );
}

// ── Step 5: Project Reviewer (PDF base64) ────────────────────────────────────
export async function reviewProjectPDF(studentCtx, validatedTopic, base64Data, mediaType = 'application/pdf', previousSteps = {}) {
  const contextBlock = buildPreviousStepsContext(previousSteps);
  const system = contextBlock ? contextBlock + '\n\n' + PROJECT_REVIEWER_SYSTEM : PROJECT_REVIEWER_SYSTEM;
  const userContent = [
    { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64Data } },
    { type: 'text', text: buildProjectReviewerPDFPrompt(studentCtx) },
  ];
  return callClaudeAuth(
    REVIEWER_ENDPOINT,
    system,
    [{ role: 'user', content: userContent }]
  );
}

// ── Step 6: Red Flag Detector ────────────────────────────────────────────────
export async function detectRedFlags(studentCtx, validatedTopic, methodology, chapterStructure) {
  return callClaudeAuth(
    DEFENSE_ENDPOINT,
    RED_FLAG_DETECTOR_SYSTEM,
    [{ role: 'user', content: buildRedFlagPrompt(studentCtx, chapterStructure, methodology) }]
  );
}

// ── Step 6: Three-Examiner Panel — first question ────────────────────────────
export async function panelFirstQuestion(studentCtx, redFlags, uploadedReview) {
  const system = buildThreeExaminerPanelSystem(studentCtx, redFlags, uploadedReview);
  const { parsed, rawText } = await callClaudeAuthRaw(
    DEFENSE_ENDPOINT,
    system,
    [{ role: 'user', content: THREE_EXAMINER_FIRST_QUESTION_PROMPT }],
    2000
  );
  return { parsed, rawText, system };
}

// ── Step 6: Three-Examiner Panel — follow-up ─────────────────────────────────
export async function panelFollowUp(system, apiMessages, studentAnswer) {
  const messages = [
    ...apiMessages,
    { role: 'user', content: buildThreeExaminerFollowUpPrompt(studentAnswer) },
  ];
  const answerWordCount = studentAnswer.trim() === '' ? 0 : studentAnswer.trim().split(/\s+/).length;
  const { parsed, rawText } = await callClaudeAuthRaw(DEFENSE_ENDPOINT, system, messages, 2000, { answerWordCount });
  return { parsed, rawText };
}

// ── Step 6: Three-Examiner Panel — summary ───────────────────────────────────
export async function panelSummary(system, apiMessages) {
  const messages = [
    ...apiMessages,
    { role: 'user', content: THREE_EXAMINER_SUMMARY_PROMPT },
  ];
  return callClaudeAuth(DEFENSE_ENDPOINT, system, messages, 2000);
}

// ── Bonus: Supervisor Meeting Prep ───────────────────────────────────────────
export async function prepareSupervisorMeeting(stage, lastFeedback, stuckOn) {
  const res = await fetch('/api/ai?action=supervisor-prep', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage, lastFeedback: lastFeedback || '', stuckOn: stuckOn || '' }),
  });

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
    SUPERVISOR_EMAIL_SYSTEM,
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
  if (err.code === 'TOKEN_LIMIT' || err.status === 400) {
    showError(AI_ERRORS.token_limit);
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
