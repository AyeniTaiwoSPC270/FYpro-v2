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
} from './prompts.js';
import { supabase } from '../lib/supabase';

const ENDPOINT         = '/api/claude';
const DEFENSE_ENDPOINT = '/api/defense-claude';
const REVIEWER_ENDPOINT = '/api/project-reviewer';

async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function callClaude(system, messages, maxTokens = 2000) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, messages, max_tokens: maxTokens }),
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
    const err = new Error(`HTTP ${res.status}`);
    err.code = 'HTTP_ERROR';
    err.status = res.status;
    throw err;
  }

  const raw = await res.json();
  console.log('[FYPro] full raw response:', JSON.stringify(raw));
  const text = raw?.content?.[0]?.text ?? '';

  console.log('[FYPro] raw API response:', text);

  let parsed;
  try {
    const cleaned = text
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
  } catch {
    const err = new Error('JSON parse failed');
    err.code = 'JSON_PARSE';
    err.raw = text;
    throw err;
  }

  return parsed;
}

// Returns { parsed, rawText } without JSON parsing — used for defense chat
async function callClaudeRaw(system, messages, maxTokens = 2000) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, messages, max_tokens: maxTokens }),
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
    const err = new Error(`HTTP ${res.status}`);
    err.code = 'HTTP_ERROR';
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

  return parsed;
}

async function callClaudeAuthRaw(endpoint, system, messages, maxTokens = 2000) {
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
  return callClaude(
    TOPIC_VALIDATOR_SYSTEM,
    [{ role: 'user', content: buildTopicValidatorPrompt(studentCtx, roughTopic) }]
  );
}

// ── Step 2: Chapter Architect ────────────────────────────────────────────────
export async function buildChapters(studentCtx, validatedTopic, structureType, totalWordCount) {
  return callClaude(
    CHAPTER_ARCHITECT_SYSTEM,
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
  return callClaude(
    LITERATURE_MAP_SYSTEM,
    [{ role: 'user', content: buildLiteratureMapPrompt(studentCtx, chapterStructure) }]
  );
}

// ── Step 3: Methodology Advisor ──────────────────────────────────────────────
export async function adviseMethodology(studentCtx, validatedTopic, chapterStructure) {
  return callClaude(
    METHODOLOGY_ADVISOR_SYSTEM,
    [{ role: 'user', content: buildMethodologyAdvisorPrompt(studentCtx) }],
    4000
  );
}

// ── Step 3 inline: Instrument Builder ───────────────────────────────────────
export async function buildInstrument(studentCtx, validatedTopic, chosenMethodology, chapterStructure) {
  console.log('[buildInstrument] chosenMethodology:', chosenMethodology)
  return callClaude(
    INSTRUMENT_BUILDER_SYSTEM,
    [{ role: 'user', content: buildInstrumentBuilderPrompt(studentCtx, chosenMethodology) }],
    4000
  );
}

// ── Step 4: Writing Planner ──────────────────────────────────────────────────
export async function buildWritingPlan(studentCtx, submissionDeadline, currentDate) {
  return callClaude(
    WRITING_PLANNER_SYSTEM,
    [{ role: 'user', content: buildWritingPlannerPrompt(studentCtx, submissionDeadline, currentDate) }]
  );
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
export async function reviewProject(studentCtx, validatedTopic, extractedText) {
  return callClaudeAuth(
    REVIEWER_ENDPOINT,
    PROJECT_REVIEWER_SYSTEM,
    [{ role: 'user', content: buildProjectReviewerPrompt(studentCtx, extractedText) }]
  );
}

// ── Step 5: Project Reviewer (PDF base64) ────────────────────────────────────
export async function reviewProjectPDF(studentCtx, validatedTopic, base64Data, mediaType = 'application/pdf') {
  const userContent = [
    { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64Data } },
    { type: 'text', text: buildProjectReviewerPDFPrompt(studentCtx) },
  ];
  return callClaudeAuth(
    REVIEWER_ENDPOINT,
    PROJECT_REVIEWER_SYSTEM,
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
  const { parsed, rawText } = await callClaudeAuthRaw(DEFENSE_ENDPOINT, system, messages, 2000);
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

// ── Bonus: Supervisor Email ──────────────────────────────────────────────────
export async function generateEmail(studentCtx, validatedTopic, chapterStructure, methodology) {
  return callClaude(
    SUPERVISOR_EMAIL_SYSTEM,
    [{ role: 'user', content: buildSupervisorEmailPrompt(studentCtx, chapterStructure) }]
  );
}

// ── Error handler (call from components) ─────────────────────────────────────
// Returns true if error was handled, false if caller should do fallback
export function handleApiError(err, showError) {
  if (err.code === 'FORBIDDEN') {
    showError('This feature requires a paid upgrade. Please visit the Pricing page to unlock it.');
    return true;
  }
  if (err.code === 'UNAUTHORIZED') {
    showError('Your session has expired. Please sign in again.');
    return true;
  }
  if (err.code === 'RATE_LIMIT') {
    let secs = 30;
    showError(`Rate limited. Retrying in ${secs}s…`);
    const interval = setInterval(() => {
      secs--;
      if (secs <= 0) {
        clearInterval(interval);
        showError(null);
      } else {
        showError(`Rate limited. Retrying in ${secs}s…`);
      }
    }, 1000);
    return true;
  }
  if (err.code === 'GATEWAY_TIMEOUT') {
    showError('The server took too long to respond. Please try again.');
    return true;
  }
  if (err.code === 'JSON_PARSE') {
    showError('Received an unexpected response. Please try again.');
    return true;
  }
  showError(err.message || 'Something went wrong. Please try again.');
  return true;
}
