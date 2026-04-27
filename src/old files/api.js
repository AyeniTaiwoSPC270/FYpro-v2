// FYPro — Frontend API Client
// All Claude API calls go through /api/claude (Vercel serverless function).
// The API key never appears in this file or any frontend code.

const API = {
  async _call(system, messages, maxTokens = 2000) {
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system, messages, max_tokens: maxTokens })
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 429) throw new Error('RATE_LIMIT');
      if (response.status === 504) throw new Error('GATEWAY_TIMEOUT');
      throw new Error(data.error || 'API_FAILURE');
    }

    const text = data.content && data.content[0] ? data.content[0].text : '';

    // Parse JSON — handle cases where model wraps response in markdown
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { return JSON.parse(match[0]); } catch { /* fall through */ }
      }
      throw new Error('JSON_PARSE');
    }
  },

  validateTopic(student, roughTopic) {
    return this._call(
      TOPIC_VALIDATOR_SYSTEM,
      [{ role: 'user', content: buildTopicValidatorPrompt(student, roughTopic) }],
      2000
    );
  },

  buildChapters(student, structureType, totalWordCount) {
    return this._call(
      CHAPTER_ARCHITECT_SYSTEM,
      [{ role: 'user', content: buildChapterArchitectPrompt(student, structureType, totalWordCount) }],
      3000
    );
  },

  adviseMethodology(student) {
    return this._call(
      METHODOLOGY_ADVISOR_SYSTEM,
      [{ role: 'user', content: buildMethodologyAdvisorPrompt(student) }],
      3000
    );
  },

  /**
   * buildInstrument — Calls the Instrument Builder prompt to generate a complete
   * data collection instrument tailored to the student's topic and chosen methodology.
   * Returns a parsed JSON object with an instrument_title and sections array.
   *
   * @param {object} student    — student context from State.studentContext
   * @param {string} methodology — the methodology string the student confirmed in Step 3
   */
  buildInstrument(student, methodology) {
    return this._call(
      INSTRUMENT_BUILDER_SYSTEM,
      [{ role: 'user', content: buildInstrumentBuilderPrompt(student, methodology) }],
      3500
    );
  },

  /**
   * generateLiteratureMap — Calls the Literature Map prompt to produce 4–6
   * thematic areas with targeted search terms, 3–5 recommended source types,
   * and a synthesis guide paragraph anchored to the student's topic and chapters.
   * Token budget is 1800 — enough for 6 themes × 5 terms + source types + the guide.
   *
   * @param {object} student  — student context from State.studentContext
   * @param {Array}  chapters — chapters array from currentData.chapters in step2.js
   */
  generateLiteratureMap(student, chapters) {
    return this._call(
      LITERATURE_MAP_SYSTEM,
      [{ role: 'user', content: buildLiteratureMapPrompt(student, chapters) }],
      1800
    );
  },

  /**
   * generateAbstract — Calls the Abstract Generator prompt to produce a
   * 5-component abstract scaffold for the student's confirmed chapter structure.
   * Returns a parsed JSON object containing background, problem_statement,
   * objectives, methodology, and expected_contribution string fields.
   * Max tokens is intentionally modest — five short paragraphs only.
   *
   * @param {object} student  — student context from State.studentContext
   * @param {Array}  chapters — chapters array from currentData.chapters in step2.js
   */
  generateAbstract(student, chapters) {
    return this._call(
      ABSTRACT_GENERATOR_SYSTEM,
      [{ role: 'user', content: buildAbstractGeneratorPrompt(student, chapters) }],
      1200
    );
  },

  buildWritingPlan(student, submissionDeadline, currentDate) {
    return this._call(
      WRITING_PLANNER_SYSTEM,
      [{ role: 'user', content: buildWritingPlannerPrompt(student, submissionDeadline, currentDate) }],
      3000
    );
  },

  generateEmail(student, chapterSummary) {
    return this._call(
      SUPERVISOR_EMAIL_SYSTEM,
      [{ role: 'user', content: buildSupervisorEmailPrompt(student, chapterSummary) }],
      1500
    );
  },

  detectRedFlags(student, chapters, methodologyJustification) {
    return this._call(
      RED_FLAG_DETECTOR_SYSTEM,
      [{ role: 'user', content: buildRedFlagPrompt(student, chapters, methodologyJustification) }],
      2000
    );
  },

  defenseFirstQuestion(student, redFlags) {
    return this._call(
      buildDefenseSimulatorSystem(student, redFlags),
      [{ role: 'user', content: DEFENSE_FIRST_QUESTION_PROMPT }],
      600
    );
  },

  defenseFollowUp(student, redFlags, messages) {
    return this._call(
      buildDefenseSimulatorSystem(student, redFlags),
      messages,
      800
    );
  },

  defenseSummary(student, redFlags, messages) {
    return this._call(
      buildDefenseSimulatorSystem(student, redFlags),
      [...messages, { role: 'user', content: DEFENSE_SUMMARY_PROMPT }],
      1500
    );
  },

  /**
   * reviewProject — Sends extracted project text to Claude for academic review.
   * Returns grade, 3 strengths, 3 weaknesses, and 5 examiner questions — all
   * specific to the actual uploaded content.
   * Max tokens set to 2500 to accommodate the full structured response.
   *
   * @param {object} student       — student context from State.studentContext
   * @param {string} extractedText — text content extracted from the uploaded file
   */
  reviewProject(student, extractedText) {
    return this._call(
      PROJECT_REVIEWER_SYSTEM,
      [{ role: 'user', content: buildProjectReviewerPrompt(student, extractedText) }],
      2500
    );
  },

  /**
   * reviewProjectPDF — Sends a PDF file as a base64 Anthropic document block.
   * The Anthropic API natively reads the PDF; the prompt instructs Claude to
   * review it using the same rubric as reviewProject.
   * Max tokens 2500 — same as text review.
   *
   * @param {object} student    — student context from State.studentContext
   * @param {string} base64Data — pure base64-encoded PDF (no data URI prefix)
   */
  reviewProjectPDF(student, base64Data) {
    return this._call(
      PROJECT_REVIEWER_SYSTEM,
      [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64Data }
          },
          {
            type: 'text',
            text: buildProjectReviewerPDFPrompt(student)
          }
        ]
      }],
      2500
    );
  },

  /**
   * panelFirstQuestion — Sends the opening prompt to the three-examiner panel.
   * Returns panel_intro, opening_examiner, and the first question.
   * Uses a higher token budget than the old single-examiner first question
   * because the panel intro is richer.
   * When uploadedReview is provided the system prompt includes the pre-assessed
   * project content so the panel attacks specific document weaknesses.
   *
   * @param {object} student         — student context from State.studentContext
   * @param {Array}  redFlags        — 3-item array from State.redFlags
   * @param {object} [uploadedReview] — optional reviewData from State.uploadedProject
   */
  panelFirstQuestion(student, redFlags, uploadedReview) {
    return this._call(
      buildThreeExaminerPanelSystem(student, redFlags, uploadedReview),
      [{ role: 'user', content: THREE_EXAMINER_FIRST_QUESTION_PROMPT }],
      800
    );
  },

  /**
   * panelFollowUp — Sends the student's answer plus full conversation history
   * to the panel. All three examiners score the answer and one asks next question.
   * Higher token budget than the old single-examiner follow-up to accommodate
   * three score objects plus the next question.
   *
   * @param {object} student         — student context from State.studentContext
   * @param {Array}  redFlags        — 3-item array from State.redFlags
   * @param {Array}  messages        — full conversation history (role/content pairs)
   * @param {object} [uploadedReview] — optional reviewData from State.uploadedProject
   */
  panelFollowUp(student, redFlags, messages, uploadedReview) {
    return this._call(
      buildThreeExaminerPanelSystem(student, redFlags, uploadedReview),
      messages,
      1200
    );
  },

  /**
   * panelSummary — Appends the summary prompt to the conversation history and
   * requests the final three-verdict plus panel-level summary object.
   * Uses the highest token budget to ensure all three verdicts fit.
   *
   * @param {object} student         — student context from State.studentContext
   * @param {Array}  redFlags        — 3-item array from State.redFlags
   * @param {Array}  messages        — full conversation history (role/content pairs)
   * @param {object} [uploadedReview] — optional reviewData from State.uploadedProject
   */
  panelSummary(student, redFlags, messages, uploadedReview) {
    return this._call(
      buildThreeExaminerPanelSystem(student, redFlags, uploadedReview),
      [...messages, { role: 'user', content: THREE_EXAMINER_SUMMARY_PROMPT }],
      2000
    );
  },

  /**
   * handleError — Centralised handler for known API error codes.
   * Call from every .catch() block.
   *
   * @param {Error}       err          — the thrown error
   * @param {Function}    showErrorFn  — step-local function that writes a message string to the UI
   * @param {HTMLElement|null} triggerBtn — the button to re-enable after the error is resolved
   * @returns {boolean}  true if the error was handled (caller should skip its own fallback)
   */
  handleError: function (err, showErrorFn, triggerBtn) {
    var code = err && err.message;

    if (code === 'RATE_LIMIT') {
      var secs = 120;
      if (triggerBtn) triggerBtn.disabled = true;
      var update = function () {
        showErrorFn(
          'FYPro is receiving high demand right now. Please wait 2 minutes and try again. ' +
          'Retrying in ' + secs + 's\u2026'
        );
      };
      update();
      var iv = setInterval(function () {
        secs -= 1;
        if (secs <= 0) {
          clearInterval(iv);
          if (triggerBtn) triggerBtn.disabled = false;
          showErrorFn('FYPro is receiving high demand right now. Please try again.');
        } else {
          update();
        }
      }, 1000);
      return true;
    }

    if (code === 'GATEWAY_TIMEOUT') {
      showErrorFn(
        'This request took too long. Please try again \u2014 ' +
        'if the problem persists, try uploading a shorter document.'
      );
      if (triggerBtn) triggerBtn.disabled = false;
      return true;
    }

    return false;
  }
};
