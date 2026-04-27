// FYPro — Step 6: Defence Prep
// Handles all UI and logic for the Defence Prep card (Part 1) and the
// Defence Simulator full-screen overlay (Part 2).
//
// Part 1 — Red Flag Detector
//   Automatically scans the student's full project context the moment the card
//   mounts. Returns exactly 3 ranked vulnerabilities (Critical, Serious, Minor)
//   which are revealed one-by-one with a staggered animation. After all three
//   appear, two action buttons are shown: Enter Defence Mode and Go Back and Revise.
//
// Part 2 — Defence Mode
//   Full-screen dark overlay with a chat layout. The AI examiner types its label
//   before every question, maintains conversation history across every turn, and
//   scores each student answer (Fail 1-3, Pass 4-6, Merit 7-8, Distinction 9-10).
//   The session runs until the student clicks "End Defence Session", at which point
//   a summary card shows verdict, overall score, strengths, and gaps.
//
// Activated by the 'step6:init' custom event fired from step5-reviewer.js after
// the student confirms their project review. Does NOT use { once: true } so the
// event can re-fire after "Go Back and Revise" + page reload.

(function () {

  // Module-scope state — persists across the two-phase lifecycle of this step.
  var currentRedFlags   = null;              // Array of 3 flag objects returned by the API
  var defenseMessages   = [];               // Conversation history array sent to API on every turn
  var questionCount     = 0;                // Tracks the current question number (increments per student answer)
  var defenseOverlayEl  = null;             // Reference to the full-screen overlay element
  var currentExaminer   = 'The Methodologist'; // Tracks which examiner asks the next question

  // ── Voice state ────────────────────────────────────────────────────────────
  var voiceSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  var ttsSupported   = !!window.speechSynthesis;
  var currentAudio       = null;
  var elevenLabsInFlight = false;
  var recognition    = null;
  var micActive      = false;

  // Listen for 'step6:init' dispatched by step5-reviewer.js after the student
  // confirms their project review. No { once: true } — must re-fire after reload.
  document.addEventListener('step6:init', function () {
    initStep5();
  });

  // Register initStep5 (Defence Prep) for direct invocation by navigateToStep()
  window._fyInits = window._fyInits || {};
  window._fyInits[6] = initStep5;


  // ── Entry point ────────────────────────────────────────────────────────────

  function initStep5() {
    if (State.currentStep !== 5) return;

    var scrollEl = document.querySelector('.app-content__scroll');
    if (!scrollEl) return;

    currentRedFlags  = null;
    defenseMessages  = [];
    questionCount    = 0;
    defenseOverlayEl = null;
    currentExaminer  = 'The Methodologist';

    var card = renderDefensePrepCard();
    scrollEl.innerHTML = '';
    scrollEl.appendChild(card);

    // Restore saved result if this step was previously completed
    if (State.stepResults && State.stepResults['step6']) {
      var saved = State.stepResults['step6'];
      var flagsEl = document.getElementById('dp-flags-section');
      var btnsEl  = document.getElementById('dp-buttons-section');
      if (flagsEl && btnsEl && saved.flags && saved.buttons) {
        flagsEl.innerHTML = saved.flags;
        btnsEl.innerHTML  = saved.buttons;
        var inputEl = document.getElementById('dp-input-section');
        if (inputEl) {
          inputEl.classList.remove('dp-section--visible');
          inputEl.classList.add('dp-section--hidden');
        }
        flagsEl.classList.remove('dp-section--hidden');
        flagsEl.classList.add('dp-section--visible');
        btnsEl.classList.remove('dp-section--hidden');
        btnsEl.classList.add('dp-section--visible');
        currentRedFlags = State.redFlags || [];
        // Re-wire buttons since innerHTML strips event listeners
        var enterBtn = document.getElementById('dp-btn-enter-defense');
        if (enterBtn) enterBtn.addEventListener('click', enterDefenseMode);
        var goBackBtn = document.getElementById('dp-btn-go-back');
        if (goBackBtn) goBackBtn.addEventListener('click', handleGoBackAndRevise);
        var backNavBtn = document.getElementById('dp-btn-back-nav');
        if (backNavBtn) backNavBtn.addEventListener('click', function () { window.navigateToStep(4); });
        return;
      }
    }

    var startBtn = document.getElementById('dp-start-scan');
    if (startBtn) startBtn.addEventListener('click', startRedFlagScan);

    var backBtn = document.getElementById('dp-btn-back-input');
    if (backBtn) backBtn.addEventListener('click', function () {
      window.navigateToStep(4);
    });
  }


  // ── Card builder ───────────────────────────────────────────────────────────

  function renderDefensePrepCard() {
    var card = document.createElement('div');
    card.className = 'dp-card';
    card.id = 'dp-card';

    card.innerHTML =

      // ── Input section — shown first, user clicks to begin scan ────
      '<div id="dp-input-section" class="dp-input-section dp-section--visible">' +
        '<p class="dp-step-label">Step 6: Defence Prep</p>' +
        '<p class="dp-description">FYPro will scan your full project context for the three most critical vulnerabilities your examiners are likely to exploit. Review them, then enter Defence Mode for a live mock examination.</p>' +
        '<button id="dp-start-scan" class="dp-btn-start-scan">Scan for Red Flags</button>' +
        '<button id="dp-btn-back-input" class="fy-back-btn">← Back to Project Reviewer</button>' +
      '</div>' +

      // ── Loading section ───────────────────────────────────
      '<div id="dp-loading-section" class="dp-loading-section dp-section--hidden">' +
        '<div class="skeleton-loader">' +
          '<div class="skeleton-bar" style="width:100%"></div>' +
          '<div class="skeleton-bar" style="width:75%"></div>' +
          '<div class="skeleton-bar" style="width:90%"></div>' +
          '<div class="skeleton-bar" style="width:60%"></div>' +
        '</div>' +
        '<p class="dp-step-label">Step 6: Defence Prep</p>' +
        '<p class="dp-scan-subtext">Scanning your project for vulnerabilities…</p>' +
        '<p id="dp-error-text" class="dp-error-text dp-section--hidden"></p>' +
        '<button id="dp-retry-btn" class="dp-retry-btn dp-section--hidden">Try Again</button>' +
      '</div>' +

      // ── Flags section — populated by revealFlags() ────────
      '<div id="dp-flags-section" class="dp-flags-section dp-section--hidden">' +
        '<p class="dp-flags-header">Project Vulnerabilities Detected</p>' +
        '<div id="dp-flags-list"></div>' +
      '</div>' +

      // ── Buttons section — shown after all flags appear ────
      '<div id="dp-buttons-section" class="dp-buttons-section dp-section--hidden">' +
        '<button id="dp-btn-enter-defense" class="dp-btn-enter-defense">Enter Defence Mode</button>' +
        '<button id="dp-btn-go-back" class="dp-btn-go-back">Go Back and Revise</button>' +
        '<button id="dp-btn-back-nav" class="fy-back-btn">← Back to Project Reviewer</button>' +
      '</div>';

    return card;
  }


  // ── Section visibility ─────────────────────────────────────────────────────

  function showSection(sectionId) {
    var ids = ['dp-input-section', 'dp-loading-section', 'dp-flags-section', 'dp-buttons-section'];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (id === sectionId) {
        el.classList.remove('dp-section--hidden');
        el.classList.add('dp-section--visible');
      } else {
        el.classList.remove('dp-section--visible');
        el.classList.add('dp-section--hidden');
      }
    });
  }


  // ── Red flag scan ──────────────────────────────────────────────────────────

  function startRedFlagScan() {
    showSection('dp-loading-section');

    var chapters      = (State.chapterStructure && State.chapterStructure.chapters) || [];
    var justification = (State.methodology && State.methodology.defense_answer_template) || '';

    API.detectRedFlags(State.studentContext, chapters, justification)
      .then(function (data) {
        State.redFlags = data.flags;
        State.save();

        currentRedFlags = data.flags;
        if (typeof window.showToast === 'function') window.showToast('Analysis complete', 'success');
        revealFlags(data.flags);
      })
      .catch(function (err) {
        if (err && err.message === 'RATE_LIMIT') {
          var errEl = document.getElementById('dp-error-text');
          if (errEl) errEl.classList.remove('dp-section--hidden');
          var secs = 120;
          var setMsg = function () {
            if (errEl) errEl.textContent =
              'FYPro is receiving high demand right now. Please wait 2 minutes and try again. ' +
              'Retrying in ' + secs + 's…';
          };
          setMsg();
          if (typeof window.showToast === 'function') window.showToast('Something went wrong. Try again.', 'error');
          var iv = setInterval(function () {
            secs -= 1;
            if (secs <= 0) {
              clearInterval(iv);
              showScanError('FYPro is receiving high demand right now. Please try again.');
            } else {
              setMsg();
            }
          }, 1000);
        } else if (err && err.message === 'GATEWAY_TIMEOUT') {
          showScanError(
            'This request took too long. Please try again — ' +
            'if the problem persists, try uploading a shorter document.'
          );
        } else {
          showScanError('Scan failed. Please check your connection and try again.');
        }
      });
  }

  function showScanError(message) {
    var errEl = document.getElementById('dp-error-text');
    var retryEl = document.getElementById('dp-retry-btn');

    if (errEl) {
      errEl.textContent = message;
      errEl.classList.remove('dp-section--hidden');
    }

    if (typeof window.showToast === 'function') window.showToast('Something went wrong. Try again.', 'error');

    if (retryEl) {
      retryEl.classList.remove('dp-section--hidden');
      var newRetry = retryEl.cloneNode(true);
      retryEl.parentNode.replaceChild(newRetry, retryEl);
      newRetry.addEventListener('click', function () {
        newRetry.classList.add('dp-section--hidden');
        var e = document.getElementById('dp-error-text');
        if (e) e.classList.add('dp-section--hidden');
        startRedFlagScan();
      });
    }
  }


  // ── Flag reveal ────────────────────────────────────────────────────────────

  function revealFlags(flags) {
    var loadingEl = document.getElementById('dp-loading-section');
    if (loadingEl) {
      loadingEl.classList.remove('dp-section--visible');
      loadingEl.classList.add('dp-section--hidden');
    }

    var flagsEl = document.getElementById('dp-flags-section');
    if (flagsEl) {
      flagsEl.classList.remove('dp-section--hidden');
      flagsEl.classList.add('dp-section--visible');
    }

    var listEl = document.getElementById('dp-flags-list');
    if (!listEl) return;

    flags.forEach(function (flag, index) {
      var flagEl = buildFlagEl(flag);
      listEl.appendChild(flagEl);

      setTimeout(function () {
        flagEl.classList.remove('dp-flag-item--hidden');
        flagEl.classList.add('dp-flag-item--visible');
      }, 500 * (index + 1));
    });

    var totalDelay = 500 * flags.length + 400;
    setTimeout(showButtons, totalDelay);
  }

  function buildFlagEl(flag) {
    var item = document.createElement('div');
    item.className = 'dp-flag-item dp-flag-item--hidden';

    var header = document.createElement('div');
    header.className = 'dp-flag-header';

    var dot = document.createElement('span');
    dot.className = 'dp-flag-dot';
    if (flag.severity === 'Critical') {
      dot.classList.add('dp-flag-dot--critical');
    } else if (flag.severity === 'Serious') {
      dot.classList.add('dp-flag-dot--serious');
    } else {
      dot.classList.add('dp-flag-dot--minor');
    }

    var title = document.createElement('span');
    title.className = 'dp-flag-title';
    title.textContent = escapeHtml(flag.title || '');

    header.appendChild(dot);
    header.appendChild(title);
    item.appendChild(header);

    if (flag.description) {
      var desc = document.createElement('p');
      desc.className = 'dp-flag-description';
      desc.textContent = escapeHtml(flag.description);
      item.appendChild(desc);
    }

    if (flag.likely_question) {
      var qRow = document.createElement('div');
      qRow.className = 'dp-flag-meta-row';

      var qLabel = document.createElement('span');
      qLabel.className = 'dp-flag-meta-label';
      qLabel.textContent = 'Likely Question';

      var qText = document.createElement('p');
      qText.className = 'dp-flag-meta-text';
      qText.textContent = escapeHtml(flag.likely_question);

      qRow.appendChild(qLabel);
      qRow.appendChild(qText);
      item.appendChild(qRow);
    }

    if (flag.advice) {
      var aRow = document.createElement('div');
      aRow.className = 'dp-flag-meta-row';

      var aLabel = document.createElement('span');
      aLabel.className = 'dp-flag-meta-label';
      aLabel.textContent = 'Prepare';

      var aText = document.createElement('p');
      aText.className = 'dp-flag-meta-text';
      aText.textContent = escapeHtml(flag.advice);

      aRow.appendChild(aLabel);
      aRow.appendChild(aText);
      item.appendChild(aRow);
    }

    return item;
  }

  function showButtons() {
    var btnsEl = document.getElementById('dp-buttons-section');
    if (btnsEl) {
      btnsEl.classList.remove('dp-section--hidden');
      btnsEl.classList.add('dp-section--visible');
    }

    var flagsEl = document.getElementById('dp-flags-section');
    State.stepResults = State.stepResults || {};
    State.stepResults['step6'] = {
      flags:   flagsEl ? flagsEl.innerHTML : '',
      buttons: btnsEl  ? btnsEl.innerHTML  : ''
    };
    State.save();

    var enterBtn = document.getElementById('dp-btn-enter-defense');
    if (enterBtn) enterBtn.addEventListener('click', enterDefenseMode);

    var goBackBtn = document.getElementById('dp-btn-go-back');
    if (goBackBtn) goBackBtn.addEventListener('click', handleGoBackAndRevise);

    var backNavBtn = document.getElementById('dp-btn-back-nav');
    if (backNavBtn) {
      backNavBtn.addEventListener('click', function () {
        window.navigateToStep(4);
      });
    }
  }

  function handleGoBackAndRevise() {
    State.currentStep        = 5;
    State.stepsCompleted[5]  = false;
    State.redFlags           = null;
    State.defenseApiMessages = [];
    State.defenseDisplayHistory = [];
    State.defenseQuestionCount  = 0;
    State.defenseStarted        = false;
    State.save();
    window.location.reload();
  }


  // ── Defence Mode — overlay build ──────────────────────────────────────────

  function enterDefenseMode() {
    defenseMessages  = [];
    questionCount    = 0;
    currentExaminer  = 'The Methodologist';

    recognition = initSpeechRecognition();

    defenseOverlayEl = buildDefenseOverlay();
    document.body.appendChild(defenseOverlayEl);

    document.body.style.overflow = 'hidden';

    getFirstQuestion();
  }

  function buildDefenseOverlay() {
    var overlay = document.createElement('div');
    overlay.className = 'dp-defense-overlay';
    overlay.id = 'dp-defense-overlay';

    // ── Header ───────────────────────────────────────────────
    var header = document.createElement('div');
    header.className = 'dp-defense-header';

    var title = document.createElement('span');
    title.className = 'dp-defense-title';
    title.textContent = 'FYPro — Defence Simulator';

    var endBtn = document.createElement('button');
    endBtn.className = 'dp-defense-end-btn';
    endBtn.id = 'dp-end-btn';
    endBtn.textContent = 'End Defence Session';
    endBtn.setAttribute('data-disabled', 'true');
    endBtn.title = 'Complete at least 3 questions to end session';
    endBtn.addEventListener('click', handleEndSession);

    header.appendChild(title);
    header.appendChild(endBtn);

    // ── Chat area ────────────────────────────────────────────
    var chatArea = document.createElement('div');
    chatArea.className = 'dp-chat-area';
    chatArea.id = 'dp-chat-area';

    // ── Input area ───────────────────────────────────────────
    var inputArea = document.createElement('div');
    inputArea.className = 'dp-input-area';
    inputArea.id = 'dp-input-area';

    var textarea = document.createElement('textarea');
    textarea.className = 'dp-student-input';
    textarea.id = 'dp-student-input';
    textarea.placeholder = 'Type your answer here…';
    textarea.disabled = true;

    textarea.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleStudentSubmit();
      }
    });

    var inputRow = document.createElement('div');
    inputRow.className = 'dp-input-row';

    if (voiceSupported) {
      var micBtn = document.createElement('button');
      micBtn.className = 'dp-mic-btn';
      micBtn.id = 'dp-mic-btn';
      micBtn.type = 'button';
      micBtn.disabled = true;
      micBtn.setAttribute('aria-label', 'Speak your answer');
      micBtn.title = 'Speak your answer';
      micBtn.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">' +
          '<path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z"/>' +
          '<path d="M19 11h-2a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V21h2v-3.07A7 7 0 0 0 19 11z"/>' +
        '</svg>';
      Object.assign(micBtn.style, {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '44px', height: '44px', borderRadius: '12px',
        border: '1.5px solid rgba(255,255,255,0.2)', background: 'transparent',
        color: 'rgba(255,255,255,0.6)', cursor: 'pointer', flexShrink: '0',
        transition: 'all 0.2s ease', marginRight: '8px'
      });
      micBtn.addEventListener('click', toggleMic);
      inputRow.appendChild(micBtn);
    }

    var sendBtn = document.createElement('button');
    sendBtn.className = 'dp-send-btn';
    sendBtn.id = 'dp-send-btn';
    sendBtn.textContent = 'Send Answer';
    sendBtn.disabled = true;
    sendBtn.addEventListener('click', handleStudentSubmit);

    inputRow.appendChild(sendBtn);
    inputArea.appendChild(textarea);
    var answerError = document.createElement('p');
    answerError.className = 'dp-answer-error';
    answerError.id = 'dp-answer-error';
    inputArea.appendChild(answerError);
    inputArea.appendChild(inputRow);

    // ── Question counter ──────────────────────────────────────────────────
    var counterSection = document.createElement('div');
    counterSection.className = 'dp-counter-section';
    counterSection.id = 'dp-counter-section';

    var counterTextEl = document.createElement('p');
    counterTextEl.className = 'dp-counter-text';
    counterTextEl.id = 'dp-counter-text';
    counterTextEl.textContent = 'Question 1 of 5';

    var dotsWrap = document.createElement('div');
    dotsWrap.className = 'dp-counter-dots';
    dotsWrap.id = 'dp-counter-dots';
    for (var d = 0; d < 5; d++) {
      var cDot = document.createElement('span');
      cDot.className = 'dp-counter-dot' + (d === 0 ? ' dp-counter-dot--active' : '');
      dotsWrap.appendChild(cDot);
    }

    counterSection.appendChild(counterTextEl);
    counterSection.appendChild(dotsWrap);

    overlay.appendChild(header);
    overlay.appendChild(counterSection);
    overlay.appendChild(chatArea);
    overlay.appendChild(inputArea);

    return overlay;
  }


  // ── First question ─────────────────────────────────────────────────────────

  function getFirstQuestion() {
    var typingEl = appendTypingIndicator();

    var uploadedReview = State.uploadedProject ? State.uploadedProject.reviewData : undefined;
    API.panelFirstQuestion(State.studentContext, currentRedFlags, uploadedReview)
      .then(function (data) {
        removeTypingIndicator(typingEl);

        currentExaminer = data.opening_examiner || 'The Methodologist';

        defenseMessages = [
          { role: 'user',      content: THREE_EXAMINER_FIRST_QUESTION_PROMPT },
          { role: 'assistant', content: JSON.stringify(data) }
        ];

        State.defenseApiMessages = defenseMessages;
        State.defenseStarted     = true;
        State.save();

        if (data.panel_intro) {
          renderPanelIntroBubble(data.panel_intro);
        }

        renderExaminerBubble(data.question, currentExaminer);
        setInputLocked(false);
      })
      .catch(function () {
        removeTypingIndicator(typingEl);
        renderExaminerBubble('There was a connection issue. Please end the session and try again.', 'The Methodologist');
      });
  }

  function renderPanelIntroBubble(introText) {
    var chatArea = document.getElementById('dp-chat-area');
    if (!chatArea) return;

    var introCard = document.createElement('div');
    introCard.className = 'dp-panel-intro-card';
    var intro = document.createElement('p');
    intro.className = 'dp-panel-intro';
    intro.textContent = escapeHtml(introText);
    introCard.appendChild(intro);
    chatArea.appendChild(introCard);
    scrollChatToBottom();
  }


  // ── Examiner bubble ────────────────────────────────────────────────────────

  function renderExaminerBubble(message, examinerName) {
    var chatArea = document.getElementById('dp-chat-area');
    if (!chatArea) return;

    updateQuestionCounter();

    var wrap = document.createElement('div');
    wrap.className = 'dp-examiner-wrap';

    var labelEl = document.createElement('p');
    labelEl.className = 'dp-examiner-label ' + examinerNameToClass(examinerName);

    var bubbleEl = document.createElement('div');
    bubbleEl.className = 'dp-examiner-bubble';

    var textEl = document.createElement('p');
    textEl.className = 'dp-examiner-text';
    textEl.textContent = escapeHtml(message);

    bubbleEl.appendChild(textEl);
    wrap.appendChild(labelEl);
    wrap.appendChild(bubbleEl);
    chatArea.appendChild(wrap);

    scrollChatToBottom();

    typeExaminerLabel(labelEl, examinerName, function () {
      bubbleEl.classList.add('dp-examiner-bubble--visible');
      scrollChatToBottom();
      speakAsExaminer(message, examinerName);
    });
  }

  function examinerNameToClass(name) {
    if (!name) return '';
    var n = name.toLowerCase();
    if (n.indexOf('methodologist') !== -1) return 'dp-examiner-label--methodologist';
    if (n.indexOf('subject') !== -1)       return 'dp-examiner-label--subject-expert';
    if (n.indexOf('devil') !== -1)         return 'dp-examiner-label--devils-advocate';
    return '';
  }

  function typeExaminerLabel(el, examinerName, callback) {
    var label   = examinerName ? examinerName.toUpperCase() + ':' : 'EXAMINER:';
    var current = 0;

    var interval = setInterval(function () {
      el.textContent = label.slice(0, current + 1);
      current++;
      if (current >= label.length) {
        clearInterval(interval);
        if (typeof callback === 'function') callback();
      }
    }, 45);
  }

  function updateQuestionCounter() {
    var counterTextEl = document.getElementById('dp-counter-text');
    var dotsWrap      = document.getElementById('dp-counter-dots');
    if (!counterTextEl || !dotsWrap) return;

    var displayNum = Math.min(questionCount + 1, 5);
    counterTextEl.textContent = 'Question ' + displayNum + ' of 5';

    var dots = dotsWrap.querySelectorAll('.dp-counter-dot');
    dots.forEach(function (dot, i) {
      dot.classList.remove('dp-counter-dot--active', 'dp-counter-dot--done');
      if (i < questionCount) {
        dot.classList.add('dp-counter-dot--done');
      } else if (i === questionCount) {
        dot.classList.add('dp-counter-dot--active');
      }
    });
  }


  // ── Typing indicator ───────────────────────────────────────────────────────

  function appendTypingIndicator() {
    var chatArea = document.getElementById('dp-chat-area');
    if (!chatArea) return null;

    var wrap = document.createElement('div');
    wrap.className = 'dp-typing-wrap';

    var label = document.createElement('p');
    label.className = 'dp-typing-label';
    label.textContent = 'EXAMINER:';

    var indicator = document.createElement('div');
    indicator.className = 'dp-typing-indicator';

    for (var i = 0; i < 3; i++) {
      var dot = document.createElement('span');
      dot.className = 'dp-typing-dot';
      indicator.appendChild(dot);
    }

    wrap.appendChild(label);
    wrap.appendChild(indicator);
    chatArea.appendChild(wrap);
    scrollChatToBottom();

    return wrap;
  }

  function removeTypingIndicator(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }


  // ── Student answer flow ────────────────────────────────────────────────────

  function handleStudentSubmit() {
    var textarea = document.getElementById('dp-student-input');
    if (!textarea) return;

    var answer = textarea.value.trim();
    var errorEl = document.getElementById('dp-answer-error');

    if (answer.length < 10) {
      if (errorEl) {
        errorEl.textContent = 'Please provide an answer before submitting.';
        errorEl.classList.add('dp-answer-error--visible');
      }
      return;
    }
    if (errorEl) errorEl.classList.remove('dp-answer-error--visible');

    textarea.value = '';
    setInputLocked(true);

    var studentWrap = renderStudentBubble(answer);

    questionCount++;
    updateEndButtonState();

    defenseMessages.push({
      role:    'user',
      content: buildThreeExaminerFollowUpPrompt(answer, questionCount)
    });

    State.defenseApiMessages   = defenseMessages;
    State.defenseQuestionCount = questionCount;
    State.save();

    var typingEl = appendTypingIndicator();

    var uploadedReview = State.uploadedProject ? State.uploadedProject.reviewData : undefined;
    API.panelFollowUp(State.studentContext, currentRedFlags, defenseMessages, uploadedReview)
      .then(function (data) {
        defenseMessages.push({
          role:    'assistant',
          content: JSON.stringify(data)
        });
        State.defenseApiMessages = defenseMessages;
        State.save();

        renderThreeScoreBadges(studentWrap, data.scores || []);

        currentExaminer = data.next_examiner || 'The Methodologist';

        setTimeout(function () {
          removeTypingIndicator(typingEl);
          var nextMessage = (data.next_examiner_reaction ? data.next_examiner_reaction + ' ' : '') +
                            (data.next_question || '');
          renderExaminerBubble(nextMessage, currentExaminer);
          setInputLocked(false);
          var ta = document.getElementById('dp-student-input');
          if (ta) ta.focus();
        }, 700);
      })
      .catch(function () {
        removeTypingIndicator(typingEl);
        renderExaminerBubble('There was a connection issue. Please try submitting your answer again.', currentExaminer);
        setInputLocked(false);
      });
  }

  function renderStudentBubble(text) {
    var chatArea = document.getElementById('dp-chat-area');
    if (!chatArea) return null;

    var wrap = document.createElement('div');
    wrap.className = 'dp-student-wrap';

    var bubble = document.createElement('div');
    bubble.className = 'dp-student-bubble';

    var textEl = document.createElement('p');
    textEl.className = 'dp-student-text';
    textEl.textContent = escapeHtml(text);

    bubble.appendChild(textEl);
    wrap.appendChild(bubble);
    chatArea.appendChild(wrap);
    scrollChatToBottom();

    return wrap;
  }

  function renderThreeScoreBadges(container, scores) {
    if (!container || !scores || !scores.length) return;

    scores.forEach(function (scoreObj, index) {
      var examiner   = scoreObj.examiner || '';
      var score      = scoreObj.score;
      var label      = scoreObj.score_label || '';
      var reasoning  = scoreObj.score_reasoning || '';
      var labelLower = label.toLowerCase();

      var slug = examiner.replace(/^the\s+/i, '').toUpperCase();

      var badge = document.createElement('span');
      badge.className = 'dp-score-badge dp-score-badge--' + labelLower +
                        ' dp-score-badge--examiner-' + examinerNameToSlug(examiner);
      badge.textContent = slug + ' · ' + label.toUpperCase() + ' · ' + (score || '?') + '/10';

      var reasonEl = document.createElement('p');
      reasonEl.className = 'dp-score-reasoning';
      reasonEl.textContent = escapeHtml(reasoning);

      container.appendChild(badge);
      container.appendChild(reasonEl);

      var badgeDelay = 150 + (index * 300);
      setTimeout(function () {
        badge.classList.add('dp-score--visible');
      }, badgeDelay);

      setTimeout(function () {
        reasonEl.classList.add('dp-score-reasoning--visible');
        scrollChatToBottom();
      }, badgeDelay + 200);
    });
  }

  function examinerNameToSlug(name) {
    if (!name) return '';
    var n = name.toLowerCase();
    if (n.indexOf('methodologist') !== -1) return 'methodologist';
    if (n.indexOf('subject') !== -1)       return 'subject-expert';
    if (n.indexOf('devil') !== -1)         return 'devils-advocate';
    return '';
  }


  // ── End session ────────────────────────────────────────────────────────────

  function handleEndSession() {
    if (questionCount < 3) return;
    if (questionCount >= 5) {
      doEndSession();
      return;
    }
    showExitWarningModal(questionCount);
  }

  function showExitWarningModal(answeredCount) {
    var modal = document.createElement('div');
    modal.className = 'dp-exit-modal-overlay';
    modal.id = 'dp-exit-modal';

    var box = document.createElement('div');
    box.className = 'dp-exit-modal-box';

    var iconEl = document.createElement('div');
    iconEl.className = 'dp-exit-modal-icon';
    iconEl.textContent = '⚠️';

    var heading = document.createElement('h2');
    heading.className = 'dp-exit-modal-heading';
    heading.textContent = 'Leave Defence Early?';

    var body = document.createElement('p');
    body.className = 'dp-exit-modal-body';
    body.textContent = 'You have only completed ' + answeredCount + ' of 5 questions. Leaving now means your readiness score will be based on incomplete responses — your grade may not reflect your full ability.';

    var btns = document.createElement('div');
    btns.className = 'dp-exit-modal-buttons';

    var continueBtn = document.createElement('button');
    continueBtn.className = 'dp-exit-modal-continue';
    continueBtn.textContent = 'Continue Defence';
    continueBtn.addEventListener('click', closeExitWarningModal);

    var leaveBtn = document.createElement('button');
    leaveBtn.className = 'dp-exit-modal-leave';
    leaveBtn.textContent = 'Leave Anyway';
    leaveBtn.addEventListener('click', function () {
      closeExitWarningModal();
      doEndSession();
    });

    btns.appendChild(continueBtn);
    btns.appendChild(leaveBtn);
    box.appendChild(iconEl);
    box.appendChild(heading);
    box.appendChild(body);
    box.appendChild(btns);
    modal.appendChild(box);
    document.body.appendChild(modal);

    requestAnimationFrame(function () {
      modal.classList.add('dp-exit-modal-overlay--visible');
    });
  }

  function closeExitWarningModal() {
    var modal = document.getElementById('dp-exit-modal');
    if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
  }

  function updateEndButtonState() {
    var endBtn = document.getElementById('dp-end-btn');
    if (!endBtn) return;
    if (questionCount >= 3) {
      endBtn.removeAttribute('data-disabled');
      endBtn.title = '';
    }
  }

  function doEndSession() {
    setInputLocked(true);

    var endBtn = document.getElementById('dp-end-btn');
    if (endBtn) endBtn.setAttribute('data-disabled', 'true');

    var inputArea = document.getElementById('dp-input-area');
    if (inputArea) {
      inputArea.innerHTML =
        '<div class="dp-verdict-loading">' +
          '<div class="skeleton-loader skeleton-loader--dark">' +
            '<div class="skeleton-bar" style="width:100%"></div>' +
            '<div class="skeleton-bar" style="width:75%"></div>' +
            '<div class="skeleton-bar" style="width:90%"></div>' +
          '</div>' +
          '<p class="dp-verdict-loading-text">Generating your verdict…</p>' +
        '</div>';
    }

    var uploadedReview = State.uploadedProject ? State.uploadedProject.reviewData : undefined;
    API.panelSummary(State.studentContext, currentRedFlags, defenseMessages, uploadedReview)
      .then(function (data) {
        State.defenseSummary      = data;
        State.stepsCompleted[5]   = true;
        State.save();

        if (typeof window.refreshShell === 'function') window.refreshShell();
        if (typeof window.showToast === 'function') window.showToast('Analysis complete', 'success');

        renderSummaryCard(data);
      })
      .catch(function () {
        var inputA = document.getElementById('dp-input-area');
        if (inputA) {
          inputA.innerHTML =
            '<div class="dp-verdict-loading">' +
              '<p class="dp-verdict-loading-text" style="color:#F87171">Something went wrong. Please tap "End Defence Session" again to retry.</p>' +
            '</div>';
        }
        if (typeof window.showToast === 'function') window.showToast('Something went wrong. Try again.', 'error');
        if (endBtn) endBtn.removeAttribute('data-disabled');
      });
  }

  function renderSummaryCard(data) {
    var overlay = document.getElementById('dp-defense-overlay');
    if (!overlay) return;

    var chatArea  = document.getElementById('dp-chat-area');
    var inputArea = document.getElementById('dp-input-area');
    if (chatArea)  overlay.removeChild(chatArea);
    if (inputArea) overlay.removeChild(inputArea);

    // Hide question counter — not relevant on results screen
    var counterSection = document.getElementById('dp-counter-section');
    if (counterSection) counterSection.style.display = 'none';

    // ── Sticky results summary bar ──────────────────────────────────────
    var panelScoreLabel = (data.panel_score_label || '').toLowerCase();
    var summaryBar = document.createElement('div');
    summaryBar.className = 'dp-results-bar dp-results-bar--' + panelScoreLabel;
    summaryBar.innerHTML =
      '<span class="dp-results-bar__text">Defence Complete</span>' +
      '<span class="dp-results-bar__divider">·</span>' +
      '<span class="dp-results-bar__score">' + escapeHtml(String(data.panel_score || '?')) + '/10</span>' +
      '<span class="dp-results-bar__divider">·</span>' +
      '<span class="dp-results-bar__label">' + escapeHtml((data.panel_score_label || '').toUpperCase()) + '</span>';
    overlay.appendChild(summaryBar);

    // Scroll to top of page and overlay before results render
    window.scrollTo({ top: 0, behavior: 'smooth' });

    var summaryWrap = document.createElement('div');
    summaryWrap.className = 'dp-summary-wrap';

    var card = document.createElement('div');
    card.className = 'dp-summary-card';

    // ── Three examiner verdicts ───────────────────────────────
    var verdictsSection = document.createElement('div');
    verdictsSection.className = 'dp-summary-verdicts';

    var verdictsLabel = document.createElement('p');
    verdictsLabel.className = 'dp-summary-section-label';
    verdictsLabel.textContent = 'Individual Examiner Verdicts';
    verdictsSection.appendChild(verdictsLabel);

    (data.verdicts || []).forEach(function (v) {
      var row = document.createElement('div');
      row.className = 'dp-summary-verdict-row';

      var nameLabel = document.createElement('span');
      nameLabel.className = 'dp-summary-examiner-name ' + examinerNameToClass(v.examiner);
      nameLabel.textContent = escapeHtml(v.examiner || '');

      var scoreLabelLower = (v.overall_score_label || '').toLowerCase();
      var badge = document.createElement('span');
      badge.className = 'dp-summary-score-badge dp-summary-score--' + scoreLabelLower;
      badge.textContent =
        (v.overall_score_label || '').toUpperCase() +
        ' · ' + (v.overall_score || '?') + '/10';

      var verdictText = document.createElement('p');
      verdictText.className = 'dp-summary-verdict-text';
      verdictText.textContent = escapeHtml(v.verdict || '');

      row.appendChild(nameLabel);
      row.appendChild(badge);
      row.appendChild(verdictText);
      verdictsSection.appendChild(row);
    });

    // ── Panel combined verdict ────────────────────────────────
    var panelVerdict = document.createElement('p');
    panelVerdict.className = 'dp-summary-verdict';
    panelVerdict.textContent = escapeHtml(data.panel_verdict || '');

    // ── Panel overall score badge ─────────────────────────────
    var panelScoreLabelLower = (data.panel_score_label || '').toLowerCase();
    var panelScoreBadge = document.createElement('span');
    panelScoreBadge.className = 'dp-summary-score-badge dp-summary-score--' + panelScoreLabelLower;
    panelScoreBadge.textContent =
      'PANEL · ' +
      (data.panel_score_label || '').toUpperCase() +
      ' · ' + (data.panel_score || '?') + '/10';

    var strengthsSection = buildSummaryListSection(
      'Strengths',
      data.strengths || [],
      'dp-summary-list--strengths'
    );

    var gapsSection = buildSummaryListSection(
      'Areas to Strengthen',
      data.gaps || [],
      'dp-summary-list--gaps'
    );

    var adviceEl = document.createElement('p');
    adviceEl.className = 'dp-summary-advice';
    adviceEl.textContent = escapeHtml(data.final_advice || '');

    var doneBtn = document.createElement('button');
    doneBtn.className = 'dp-summary-done-btn';
    doneBtn.textContent = 'Close Defence Session';
    doneBtn.addEventListener('click', closeDefenseOverlay);

    card.appendChild(verdictsSection);
    card.appendChild(panelVerdict);
    card.appendChild(panelScoreBadge);
    card.appendChild(strengthsSection);
    card.appendChild(gapsSection);
    card.appendChild(adviceEl);
    card.appendChild(doneBtn);

    summaryWrap.appendChild(card);
    overlay.appendChild(summaryWrap);

    // Ensure summary wrap is scrolled to the very top when it first appears
    requestAnimationFrame(function () { summaryWrap.scrollTop = 0; });
  }

  function buildSummaryListSection(labelText, items, listClass) {
    var section = document.createElement('div');
    section.className = 'dp-summary-section';

    var label = document.createElement('p');
    label.className = 'dp-summary-section-label';
    label.textContent = labelText;

    var list = document.createElement('ul');
    list.className = 'dp-summary-list ' + listClass;

    items.forEach(function (itemText) {
      var li = document.createElement('li');
      li.textContent = escapeHtml(itemText);
      list.appendChild(li);
    });

    section.appendChild(label);
    section.appendChild(list);
    return section;
  }

  function closeDefenseOverlay() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
      currentAudio = null;
    }
    elevenLabsInFlight = false;
    if (ttsSupported) window.speechSynthesis.cancel();
    if (micActive && recognition) { recognition.abort(); micActive = false; }
    if (defenseOverlayEl && defenseOverlayEl.parentNode) {
      defenseOverlayEl.parentNode.removeChild(defenseOverlayEl);
    }
    document.body.style.overflow = '';
  }


  // ── Input lock helpers ─────────────────────────────────────────────────────

  function setInputLocked(locked) {
    var textarea  = document.getElementById('dp-student-input');
    var sendBtn   = document.getElementById('dp-send-btn');
    var micBtn    = document.getElementById('dp-mic-btn');
    var inputArea = document.getElementById('dp-input-area');
    if (textarea)  textarea.disabled = locked;
    if (sendBtn)   sendBtn.disabled  = locked;
    if (micBtn)    micBtn.disabled   = locked;
    if (inputArea) inputArea.classList.toggle('dp-input-area--loading', locked);
    if (locked && micActive && recognition) {
      recognition.abort();
      setMicButtonState(false);
      micActive = false;
    }
  }


  // ── Chat scroll helper ─────────────────────────────────────────────────────

  function scrollChatToBottom() {
    var chatArea = document.getElementById('dp-chat-area');
    if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;
  }


  // ── Text-to-Speech ─────────────────────────────────────────────────────────

  function resolveExaminerNameForSpeak(name) {
    if (!name) return 'methodologist';
    var n = name.toLowerCase();
    if (n.indexOf('methodologist') !== -1) return 'methodologist';
    if (n.indexOf('subject') !== -1)       return 'subjectExpert';
    if (n.indexOf('devil') !== -1)         return 'devilsAdvocate';
    return 'methodologist';
  }

  function speakAsExaminer(text, examinerName) {
    if (!text) return;

    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
      currentAudio = null;
    }

    if (elevenLabsInFlight) return;
    elevenLabsInFlight = true;

    fetch('/api/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text, examiner: examinerName })
    })
    .then(function (response) {
      if (!response.ok) {
        return response.text().then(function (body) {
          throw new Error('speak-api-' + response.status + ': ' + body);
        });
      }
      return response.blob();
    })
    .then(function (audioBlob) {
      elevenLabsInFlight = false;

      var audioUrl = URL.createObjectURL(audioBlob);
      var audio    = new Audio(audioUrl);
      currentAudio = audio;

      audio.addEventListener('canplaythrough', function () {
        URL.revokeObjectURL(audioUrl);
      }, { once: true });

      audio.addEventListener('error', function () {
        currentAudio = null;
      }, { once: true });

      audio.play().catch(function () {
        currentAudio = null;
      });
    })
    .catch(function () {
      elevenLabsInFlight = false;
      fallbackSpeakAsExaminer(text, examinerName);
    });
  }

  function fallbackSpeakAsExaminer(text, examinerName) {
    if (!ttsSupported || !text) return;

    var configs = {
      methodologist:  { rate: 0.9,  pitch: 0.85 },
      subjectExpert:  { rate: 1.0,  pitch: 1.1  },
      devilsAdvocate: { rate: 1.15, pitch: 0.95 }
    };
    var key    = resolveExaminerNameForSpeak(examinerName);
    var config = configs[key] || { rate: 1.0, pitch: 1.0 };

    window.speechSynthesis.cancel();
    var utterance = new SpeechSynthesisUtterance(text);
    utterance.rate  = config.rate;
    utterance.pitch = config.pitch;
    utterance.lang  = 'en-NG';
    window.speechSynthesis.speak(utterance);
  }


  // ── Speech recognition (voice input) ──────────────────────────────────────

  function initSpeechRecognition() {
    if (!voiceSupported) return null;
    var SR  = window.SpeechRecognition || window.webkitSpeechRecognition;
    var rec = new SR();
    rec.lang            = 'en-NG';
    rec.continuous      = false;
    rec.interimResults  = false;
    rec.maxAlternatives = 1;

    rec.onresult = function (event) {
      var transcript = event.results[0][0].transcript.trim();
      var textarea   = document.getElementById('dp-student-input');
      if (textarea && transcript) textarea.value = transcript;
      setMicButtonState(false);
      micActive = false;
      setTimeout(handleStudentSubmit, 80);
    };

    rec.onerror = function () {
      setMicButtonState(false);
      micActive = false;
    };

    rec.onend = function () {
      if (micActive) {
        setMicButtonState(false);
        micActive = false;
      }
    };

    return rec;
  }

  function toggleMic() {
    if (!voiceSupported || !recognition) return;
    if (micActive) {
      recognition.abort();
      setMicButtonState(false);
      micActive = false;
    } else {
      try {
        recognition.start();
        setMicButtonState(true);
        micActive = true;
      } catch (e) {
        setMicButtonState(false);
        micActive = false;
      }
    }
  }

  function setMicButtonState(listening) {
    var micBtn = document.getElementById('dp-mic-btn');
    if (!micBtn) return;
    if (listening) {
      micBtn.style.background   = 'rgba(220,38,38,0.2)';
      micBtn.style.borderColor  = 'rgba(220,38,38,0.6)';
      micBtn.style.color        = '#F87171';
      micBtn.setAttribute('aria-label', 'Stop recording');
      micBtn.title = 'Stop recording';
    } else {
      micBtn.style.background   = 'transparent';
      micBtn.style.borderColor  = 'rgba(255,255,255,0.2)';
      micBtn.style.color        = 'rgba(255,255,255,0.6)';
      micBtn.setAttribute('aria-label', 'Speak your answer');
      micBtn.title = 'Speak your answer';
    }
  }


  // ── Utility ────────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

})();
