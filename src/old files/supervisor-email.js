// FYPro — Supervisor Email Generator (Bonus Feature)
// Activated by the 'supervisor-email:open' custom event, dispatched from the
// sidebar bonus button rendered in app.js after all 4 core steps are complete.
// Does NOT update State.stepsCompleted or State.currentStep — it is a bonus
// feature that sits outside the main step progression.
// Unlike step IIFE files this listener does NOT use { once: true } because the
// user may open the email card multiple times to regenerate or re-copy.

(function () {

  // SVG path for the FYPro shield icon — identical to the shield in step1–step4.
  var SHIELD_PATH = 'M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z';

  // Module-scope cache for the last successful API result.
  // Reset to null each time the card is freshly opened via the sidebar button.
  var currentData = null;


  // ── Event listener ──────────────────────────────────────────────────────────

  // Listen for the bonus button click (dispatched by app.js renderSidebarSteps).
  // No { once: true } — the user can open this card as many times as they like.
  document.addEventListener('supervisor-email:open', function () {
    initEmailCard();
  });


  // ── Entry point ─────────────────────────────────────────────────────────────

  /**
   * initEmailCard — Resets module state, builds the email card, clears the
   * scroll area, and inserts the fresh card. Called every time the sidebar
   * bonus button is clicked. Wires the Generate button after the card is in the DOM.
   */
  function initEmailCard() {
    currentData = null;

    var scrollEl = document.querySelector('.app-content__scroll');
    if (!scrollEl) return;

    var card = renderEmailCard();
    scrollEl.innerHTML = '';
    scrollEl.appendChild(card);

    // Wire the generate button now that the card element is in the DOM
    var generateBtn = document.getElementById('btn-generate-email');
    if (generateBtn) generateBtn.addEventListener('click', handleGenerate);
  }


  // ── Card builder ────────────────────────────────────────────────────────────

  /**
   * renderEmailCard — Builds and returns the complete email card DOM element.
   * Three sections toggle in/out using tv-section--visible / tv-section--hidden:
   *   1. #se-input-section   — headline, description, Generate Email button
   *   2. #se-loading-section — spinning shield + "Drafting your email…" text
   *   3. #se-result-section  — staggered email preview, Copy button, reminder note
   * Returns the element without inserting it into the DOM.
   */
  function renderEmailCard() {
    var card = document.createElement('div');
    card.className = 'se-card';
    card.id = 'se-card';

    card.innerHTML =
      // ── Input Section ──────────────────────────────────────
      '<div id="se-input-section" class="se-input-section tv-section--visible">' +
        '<p class="se-step-label">Supervisor Email</p>' +
        '<p class="se-description">Generate a formal email to send your supervisor introducing your project — topic, objectives, methodology, and a meeting request. All in one.</p>' +
        '<p id="se-error-text" class="se-error-text tv-section--hidden"></p>' +
        '<button id="btn-generate-email" class="se-btn-generate">Generate Email</button>' +
      '</div>' +

      // ── Loading Section ────────────────────────────────────
      '<div id="se-loading-section" class="se-loading-section tv-section--hidden">' +
        '<svg id="se-loading-shield" class="tv-loading-shield" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="72" height="72" fill="#0066FF" aria-hidden="true">' +
          '<path d="' + SHIELD_PATH + '"></path>' +
        '</svg>' +
        '<p class="tv-loading-text">Drafting your email\u2026</p>' +
      '</div>' +

      // ── Result Section ─────────────────────────────────────
      '<div id="se-result-section" class="se-result-section tv-section--hidden">' +

        // Email preview box — four parts fade in sequentially
        '<div class="se-email-preview">' +

          // Subject — revealed first (0 ms delay)
          '<div id="se-part-subject" class="se-email-part se-email-part--hidden">' +
            '<span class="se-part-label">Subject</span>' +
            '<p id="se-subject-text" class="se-subject-text"></p>' +
          '</div>' +

          '<div class="se-email-divider"></div>' +

          // Greeting — revealed second (400 ms)
          '<div id="se-part-greeting" class="se-email-part se-email-part--hidden se-body-text"></div>' +

          // Body — revealed third (800 ms)
          '<div id="se-part-body" class="se-email-part se-email-part--hidden se-body-text"></div>' +

          // Sign-off — revealed fourth (1200 ms)
          '<div id="se-part-signoff" class="se-email-part se-email-part--hidden se-body-text"></div>' +

        '</div>' +

        // Actions row
        '<div class="se-actions">' +
          '<button id="btn-copy-email" class="se-btn-copy">Copy Email</button>' +
        '</div>' +

        // Reminder note
        '<p class="se-note">Remember to replace [Supervisor Name] before sending.</p>' +

      '</div>';

    return card;
  }


  // ── Generate handler ─────────────────────────────────────────────────────────

  /**
   * handleGenerate — Transitions to the loading state and calls API.generateEmail
   * with the student context and a chapter summary derived from State.chapterStructure.
   * On success, populates the four email parts and triggers the staggered reveal.
   * On failure, reverts to the input section and shows a user-friendly error message.
   */
  function handleGenerate() {
    hideError();
    showSection('se-loading-section');

    var shield = document.getElementById('se-loading-shield');
    if (shield) shield.classList.add('tv-shield--spinning');

    // Derive a concise chapter list for the API prompt
    var chapterSummary = buildChapterSummary();

    API.generateEmail(State.studentContext, chapterSummary)
      .then(function (data) {
        stopSpinner();
        currentData = data;
        populateEmailParts(data);
        showSection('se-result-section');
        revealEmailParts();     // staggered fade-in: 0 / 400 / 800 / 1200 ms
        wireCopyButton(data);
      })
      .catch(function (err) {
        stopSpinner();
        showSection('se-input-section');
        if (!API.handleError(err, showError, null)) {
          showError('Something went wrong. Please check your connection and try again.');
        }
      });
  }


  // ── Chapter summary builder ────────────────────────────────────────────────

  /**
   * buildChapterSummary — Derives a concise chapter title list from
   * State.chapterStructure. Format: "1. Chapter Title; 2. Chapter Title; …"
   * Falls back to the validated topic string when chapter data is absent.
   */
  function buildChapterSummary() {
    var cs = State.chapterStructure;
    if (cs && cs.chapters && cs.chapters.length) {
      return cs.chapters.map(function (c) {
        return c.number + '. ' + c.title;
      }).join('; ');
    }
    return State.validatedTopic || State.roughTopic || '';
  }


  // ── Email parts populator ─────────────────────────────────────────────────

  /**
   * populateEmailParts — Fills the four hidden email part divs with content
   * from the API response before the staggered reveal begins.
   * Splits the body string on blank lines to separate greeting, middle
   * paragraphs, and sign-off. All content is set via textContent to prevent XSS.
   *
   * @param {object} data - API response: { subject: string, body: string }
   */
  function populateEmailParts(data) {
    // Subject line
    var subjectEl = document.getElementById('se-subject-text');
    if (subjectEl) subjectEl.textContent = data.subject || '';

    // Group the raw body string into logical paragraphs.
    // Consecutive non-empty lines form one paragraph block; blank lines act as separators.
    var rawLines = (data.body || '').split('\n');
    var paragraphs = [];
    var current = [];

    rawLines.forEach(function (line) {
      if (line.trim() === '') {
        if (current.length) {
          paragraphs.push(current.join('\n'));
          current = [];
        }
      } else {
        current.push(line);
      }
    });
    if (current.length) paragraphs.push(current.join('\n'));

    // Assign paragraphs to the three body sections
    var greetingEl = document.getElementById('se-part-greeting');
    var bodyEl     = document.getElementById('se-part-body');
    var signoffEl  = document.getElementById('se-part-signoff');

    // First paragraph = greeting
    if (greetingEl) greetingEl.textContent = paragraphs[0] || '';

    // Middle paragraphs = main body (everything between first and last)
    if (bodyEl) {
      var middle = paragraphs.length > 2
        ? paragraphs.slice(1, paragraphs.length - 1)
        : [];
      bodyEl.textContent = middle.join('\n\n');
    }

    // Last paragraph = sign-off (falls back to same as greeting when only one paragraph)
    if (signoffEl) {
      signoffEl.textContent = paragraphs.length > 1
        ? paragraphs[paragraphs.length - 1]
        : '';
    }
  }


  // ── Staggered reveal ─────────────────────────────────────────────────────────

  /**
   * revealEmailParts — Fades each email part in sequentially using setTimeout.
   * Delays: subject at 0 ms, greeting at 400 ms, body at 800 ms, sign-off at 1200 ms.
   * Transitions each part from se-email-part--hidden to se-email-part--revealed.
   */
  function revealEmailParts() {
    var DELAY_MS  = 400;
    var partIds   = ['se-part-subject', 'se-part-greeting', 'se-part-body', 'se-part-signoff'];

    partIds.forEach(function (id, i) {
      setTimeout(function () {
        var el = document.getElementById(id);
        if (!el) return;
        el.classList.remove('se-email-part--hidden');
        el.classList.add('se-email-part--revealed');
      }, i * DELAY_MS);
    });
  }


  // ── Copy button ──────────────────────────────────────────────────────────────

  /**
   * wireCopyButton — Attaches the clipboard handler to the Copy Email button.
   * Writes "Subject: …\n\n<body>" to the clipboard, changes the button label to
   * "✓ Copied" for 2 seconds, then resets it to "Copy Email".
   * Uses node cloning to safely remove any prior listener from a previous generate cycle.
   *
   * @param {object} data - API response: { subject: string, body: string }
   */
  function wireCopyButton(data) {
    var btn = document.getElementById('btn-copy-email');
    if (!btn) return;

    // Clone to clear any listener attached during a prior generate cycle
    var fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);

    fresh.addEventListener('click', function () {
      var fullText = 'Subject: ' + (data.subject || '') + '\n\n' + (data.body || '');

      navigator.clipboard.writeText(fullText).then(function () {
        fresh.textContent = '\u2713 Copied';
        setTimeout(function () {
          fresh.textContent = 'Copy Email';
        }, 2000);
      }).catch(function () {
        // Clipboard API unavailable (non-HTTPS or denied) — silently ignore
      });
    });
  }


  // ── Section toggle ───────────────────────────────────────────────────────────

  /**
   * showSection — Makes the target section visible and hides the other two.
   * Mirrors the pattern used in step1–step4 (tv-section--visible / tv-section--hidden).
   *
   * @param {string} visibleId - The id of the section to reveal.
   */
  function showSection(visibleId) {
    ['se-input-section', 'se-loading-section', 'se-result-section'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (id === visibleId) {
        el.classList.remove('tv-section--hidden');
        el.classList.add('tv-section--visible');
      } else {
        el.classList.remove('tv-section--visible');
        el.classList.add('tv-section--hidden');
      }
    });
  }


  // ── Spinner helper ────────────────────────────────────────────────────────────

  /**
   * stopSpinner — Removes the spinning class from the loading shield SVG.
   * Safe to call even when the spinner is not currently running.
   */
  function stopSpinner() {
    var shield = document.getElementById('se-loading-shield');
    if (shield) shield.classList.remove('tv-shield--spinning');
  }


  // ── Error helpers ─────────────────────────────────────────────────────────────

  /**
   * showError — Displays an inline error message above the Generate button.
   *
   * @param {string} msg - Human-readable error message to display.
   */
  function showError(msg) {
    var el = document.getElementById('se-error-text');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('tv-section--hidden');
  }

  /**
   * hideError — Clears and hides the inline error message.
   */
  function hideError() {
    var el = document.getElementById('se-error-text');
    if (!el) return;
    el.textContent = '';
    el.classList.add('tv-section--hidden');
  }

})();
