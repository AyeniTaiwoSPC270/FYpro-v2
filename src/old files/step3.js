// FYPro — Step 3: Methodology Advisor
// Handles all UI and logic for the Methodology Advisor card.
// Activated by the 'step3:init' custom event fired from step2.js after the student
// confirms their chapter structure. Follows the same IIFE + event pattern as step1 and step2.

(function () {

  // Module-scope variables that persist across the card's lifecycle
  var currentData        = null; // latest API response object
  var selectedMethodology = '';  // the methodology string the student actively picks
  var instrumentPlainText = '';  // plain-text copy buffer for the instrument

  // Wait for step2.js to fire 'step3:init' before doing anything.
  // { once: true } removed so the step can be re-entered after back navigation.
  document.addEventListener('step3:init', function () {
    initStep3();
  });

  // Register initStep3 for direct invocation by navigateToStep() on back navigation.
  window._fyInits = window._fyInits || {};
  window._fyInits[3] = initStep3;


  // ── Entry point ────────────────────────────────────────────────────────────

  function initStep3() {
    if (State.currentStep !== 2) return;

    currentData         = null;
    selectedMethodology = '';
    instrumentPlainText = '';

    var scrollEl = document.querySelector('.app-content__scroll');
    if (!scrollEl) return;

    var card = renderAdvisorCard();
    scrollEl.innerHTML = '';
    scrollEl.appendChild(card);

    // Restore saved result if this step was previously completed
    if (State.stepResults && State.stepResults['step3']) {
      var resultSection = document.getElementById('ma-result-section');
      if (resultSection) {
        resultSection.innerHTML = State.stepResults['step3'];
        showSection('ma-result-section');
        return;
      }
    }

    document.getElementById('btn-analyse').addEventListener('click', handleAnalyse);

    document.getElementById('btn-back-step3').addEventListener('click', function () {
      window.navigateToStep(1);
    });
  }


  // ── Card builder ───────────────────────────────────────────────────────────

  function renderAdvisorCard() {
    var card = document.createElement('div');
    card.className = 'ma-card';
    card.id = 'ma-card';

    card.innerHTML =

      // ── Input Section ──────────────────────────────────────
      '<div id="ma-input-section" class="ma-input-section tv-section--visible">' +
        '<button id="btn-back-step3" class="fy-back-btn">← Back to Chapter Architect</button>' +
        '<p class="ma-step-label">Step 3: Methodology Advisor</p>' +
        '<p class="ma-description">FYPro will analyse all three research paradigms for your specific topic — Quantitative, Qualitative, and Mixed Methods — and explain the trade-offs of each. Claude will recommend one, but the final choice is yours.</p>' +
        '<p id="ma-error-text" class="ma-error-text tv-section--hidden"></p>' +
        '<button id="btn-analyse" class="ma-btn-analyse">Analyse Methodology</button>' +
      '</div>' +

      // ── Loading Section ────────────────────────────────────
      '<div id="ma-loading-section" class="ma-loading-section tv-section--hidden">' +
        '<div class="skeleton-loader">' +
          '<div class="skeleton-bar" style="width:100%"></div>' +
          '<div class="skeleton-bar" style="width:75%"></div>' +
          '<div class="skeleton-bar" style="width:90%"></div>' +
          '<div class="skeleton-bar" style="width:60%"></div>' +
        '</div>' +
        '<p class="tv-loading-text">Weighing your methodology options…</p>' +
      '</div>' +

      // ── Result Section ─────────────────────────────────────
      '<div id="ma-result-section" class="ma-result-section tv-section--hidden">' +

        '<div class="ma-bento-grid">' +

          // Row 1: Claude Recommends (full width)
          '<div id="ma-rec-banner" class="ma-bento-rec">' +
            '<p class="ma-rec-label">Claude Recommends</p>' +
            '<p id="ma-rec-name" class="ma-rec-name"></p>' +
          '</div>' +

          // Row 2: Justification | Defense Answer
          '<div class="ma-bento-row2">' +
            '<div class="ma-bento-justification">' +
              '<p class="ma-bento-cell-label">Justification</p>' +
              '<p id="ma-rec-reason" class="ma-bento-cell-body"></p>' +
            '</div>' +
            '<div class="ma-bento-defense" id="ma-defense-section">' +
              '<p class="ma-bento-cell-label">Defense Answer</p>' +
              '<p class="ma-defense-hint">A word-for-word script to memorise and deliver if asked to justify your methodology choice in your defense.</p>' +
              '<div id="ma-defense-body" class="ma-defense-body ma-defense-body--blurred">' +
                '<p id="ma-defense-text" class="ma-defense-text"></p>' +
              '</div>' +
              '<button id="btn-reveal-defense" class="ma-btn-reveal">Reveal Defense Answer</button>' +
            '</div>' +
          '</div>' +

          // Row 3: Watch Out (full width, red tinted)
          '<div id="ma-watch-out" class="ma-bento-watchout">' +
            '<p class="ma-watch-out-label">⚠ Watch Out</p>' +
            '<p id="ma-watch-out-text" class="ma-bento-cell-body"></p>' +
          '</div>' +

        '</div>' +

        '<div id="ma-options-list" class="ma-options-list"></div>' +

        '<button id="btn-confirm-method" class="ma-btn-confirm" disabled>Confirm Methodology — Continue</button>' +

      '</div>';

    return card;
  }


  // ── Section visibility ─────────────────────────────────────────────────────

  function showSection(sectionId) {
    var ids = ['ma-input-section', 'ma-loading-section', 'ma-result-section'];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (id === sectionId) {
        el.classList.remove('tv-section--hidden');
        el.classList.add('tv-section--visible');
      } else {
        el.classList.remove('tv-section--visible');
        el.classList.add('tv-section--hidden');
      }
    });
  }


  // ── Analyse handler ────────────────────────────────────────────────────────

  function handleAnalyse() {
    hideError();

    var btn = document.getElementById('btn-analyse');
    if (btn) btn.disabled = true;

    showSection('ma-loading-section');

    API.adviseMethodology(State.studentContext)
      .then(function (data) {
        currentData = data;
        renderResult(data);
        showSection('ma-result-section');
        if (typeof window.showToast === 'function') window.showToast('Analysis complete', 'success');
        State.stepResults = State.stepResults || {};
        State.stepResults['step3'] = document.getElementById('ma-result-section').innerHTML;
        State.save();
      })
      .catch(function (err) {
        showSection('ma-input-section');
        if (!API.handleError(err, showError, btn)) {
          if (btn) btn.disabled = false;
          showError('Something went wrong. Please check your connection and try again.');
          if (typeof window.showToast === 'function') window.showToast('Something went wrong. Try again.', 'error');
        }
      });
  }


  // ── Error display helpers ──────────────────────────────────────────────────

  function showError(message) {
    var el = document.getElementById('ma-error-text');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('tv-section--hidden');
  }

  function hideError() {
    var el = document.getElementById('ma-error-text');
    if (!el) return;
    el.textContent = '';
    el.classList.add('tv-section--hidden');
  }


  // ── Result renderer ────────────────────────────────────────────────────────

  function renderResult(data) {
    var recNameEl   = document.getElementById('ma-rec-name');
    var recReasonEl = document.getElementById('ma-rec-reason');
    if (recNameEl)   recNameEl.textContent   = data.recommended || '';
    if (recReasonEl) recReasonEl.textContent = data.recommended_reason || '';

    var listEl = document.getElementById('ma-options-list');
    if (listEl) renderOptionCards(listEl, data.options || [], data.recommended);

    var defenseTextEl = document.getElementById('ma-defense-text');
    if (defenseTextEl) defenseTextEl.textContent = data.defense_answer_template || '';

    var revealBtn = document.getElementById('btn-reveal-defense');
    if (revealBtn) {
      var newReveal = revealBtn.cloneNode(true);
      revealBtn.parentNode.replaceChild(newReveal, revealBtn);
      newReveal.addEventListener('click', handleRevealDefense);
    }

    var watchOutEl = document.getElementById('ma-watch-out-text');
    if (watchOutEl) watchOutEl.textContent = data.watch_out || '';

    var confirmBtn = document.getElementById('btn-confirm-method');
    if (confirmBtn) {
      var newConfirm = confirmBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
      newConfirm.addEventListener('click', handleConfirm);
      newConfirm.disabled = true;
    }
  }


  // ── Option cards ───────────────────────────────────────────────────────────

  function renderOptionCards(listEl, options, recommended) {
    listEl.innerHTML = '';
    options.forEach(function (option) {
      var card = buildOptionCard(option, recommended);
      listEl.appendChild(card);
    });
  }

  function buildOptionCard(option, recommended) {
    var card = document.createElement('div');
    card.className = 'ma-option-card';
    card.dataset.methodology = option.methodology;

    var fitKey = (option.fit_score || 'moderate').toLowerCase();
    if (fitKey !== 'strong' && fitKey !== 'moderate' && fitKey !== 'weak') {
      fitKey = 'moderate';
    }

    var isRecommended = (option.methodology === recommended);
    var recTag = isRecommended
      ? '<span class="ma-recommended-tag">★ Recommended</span>'
      : '';

    var instrumentsHtml = (option.instruments || []).map(function (inst) {
      return (
        '<li class="ma-instrument-item">' +
          '<p class="ma-instrument-name">' + escapeHtml(inst.name) + '</p>' +
          '<p class="ma-instrument-access">' + escapeHtml(inst.access) + '</p>' +
        '</li>'
      );
    }).join('');

    var dataCollectionHtml = (option.data_collection || []).map(function (method) {
      return '<li>' + escapeHtml(method) + '</li>';
    }).join('');

    card.innerHTML =
      '<div class="ma-option-header">' +
        '<p class="ma-option-name">' + escapeHtml(option.methodology) + '</p>' +
        '<span class="ma-fit-badge ma-fit-badge--' + fitKey + '">' + escapeHtml(option.fit_score) + '</span>' +
        recTag +
      '</div>' +
      '<p class="ma-explanation">' + escapeHtml(option.explanation) + '</p>' +
      '<div>' +
        '<p class="ma-section-label">Data Collection</p>' +
        '<ul class="ma-data-list">' + dataCollectionHtml + '</ul>' +
      '</div>' +
      '<div>' +
        '<p class="ma-section-label">Instruments</p>' +
        '<ul class="ma-instruments-list">' + instrumentsHtml + '</ul>' +
      '</div>' +
      '<div>' +
        '<p class="ma-section-label">Trade-offs</p>' +
        '<p class="ma-trade-offs">' + escapeHtml(option.trade_offs) + '</p>' +
      '</div>' +
      '<button class="ma-btn-select">Select This Methodology</button>';

    var selectBtn = card.querySelector('.ma-btn-select');
    selectBtn.addEventListener('click', function () {
      handleSelectMethodology(option.methodology);
    });

    return card;
  }

  function handleSelectMethodology(methodology) {
    selectedMethodology = methodology;

    var allCards = document.querySelectorAll('.ma-option-card');
    allCards.forEach(function (c) {
      var isChosen = c.dataset.methodology === methodology;
      c.classList.toggle('ma-option-card--selected', isChosen);
      c.classList.toggle('ma-option-card--dimmed',   !isChosen);

      var btn = c.querySelector('.ma-btn-select');
      if (btn) {
        btn.textContent = isChosen ? 'Selected ✓' : 'Select This Methodology';
        btn.classList.toggle('ma-btn-select--active', isChosen);
      }
    });

    var confirmBtn = document.getElementById('btn-confirm-method');
    if (confirmBtn) confirmBtn.disabled = false;
  }


  // ── Defense answer reveal ──────────────────────────────────────────────────

  function handleRevealDefense() {
    var defenseBody = document.getElementById('ma-defense-body');
    if (defenseBody) defenseBody.classList.remove('ma-defense-body--blurred');

    var revealBtn = document.getElementById('btn-reveal-defense');
    if (revealBtn) revealBtn.style.display = 'none';
  }


  // ── Confirm handler ────────────────────────────────────────────────────────

  function handleConfirm() {
    if (!currentData || !selectedMethodology) return;

    State.methodology       = currentData;
    State.chosenMethodology = selectedMethodology;
    State.stepsCompleted[2] = true;
    State.currentStep       = 3;
    State.save();

    if (typeof window.refreshShell === 'function') {
      window.refreshShell();
    }

    if (typeof window.showToast === 'function') window.showToast('Step 4 unlocked', 'unlock');
    showInstrumentCard(selectedMethodology);
  }


  // ── Data Collection Instrument Builder ────────────────────────────────────

  function renderInstrumentCard(methodology) {
    var card = document.createElement('div');
    card.className = 'di-card';
    card.id = 'di-card';

    card.innerHTML =

      '<div id="di-input-section" class="di-input-section tv-section--visible">' +
        '<p class="di-step-label">Step 4: Data Collection Instrument</p>' +
        '<span class="di-methodology-badge">' + escapeHtml(methodology) + '</span>' +
        '<p class="di-description">FYPro will draft a complete, topic-specific data collection instrument based on your confirmed methodology — structured questionnaire, interview guide, or both.</p>' +
        '<p id="di-error-text" class="di-error-text tv-section--hidden"></p>' +
        '<button id="btn-generate-instrument" class="di-btn-generate">Generate Instrument</button>' +
      '</div>' +

      '<div id="di-loading-section" class="di-loading-section tv-section--hidden">' +
        '<div class="skeleton-loader">' +
          '<div class="skeleton-bar" style="width:100%"></div>' +
          '<div class="skeleton-bar" style="width:75%"></div>' +
          '<div class="skeleton-bar" style="width:90%"></div>' +
          '<div class="skeleton-bar" style="width:60%"></div>' +
        '</div>' +
        '<p class="tv-loading-text">Drafting your research instrument…</p>' +
      '</div>' +

      '<div id="di-result-section" class="di-result-section tv-section--hidden">' +
        '<p id="di-instrument-title" class="di-instrument-title"></p>' +
        '<div id="di-instrument-body" class="di-instrument-body"></div>' +
        '<div class="di-actions">' +
          '<button id="btn-copy-instrument" class="di-btn-copy">Copy Instrument</button>' +
          '<button id="btn-instrument-continue" class="di-btn-continue">Continue — Writing Planner</button>' +
        '</div>' +
      '</div>';

    return card;
  }

  function showInstrumentCard(methodology) {
    var scrollEl = document.querySelector('.app-content__scroll');
    if (!scrollEl) return;

    var card = renderInstrumentCard(methodology);
    scrollEl.appendChild(card);

    card.scrollIntoView({ behavior: 'smooth', block: 'start' });

    var generateBtn = document.getElementById('btn-generate-instrument');
    if (generateBtn) {
      generateBtn.addEventListener('click', handleGenerateInstrument);
    }
  }

  function showDiSection(sectionId) {
    var ids = ['di-input-section', 'di-loading-section', 'di-result-section'];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (id === sectionId) {
        el.classList.remove('tv-section--hidden');
        el.classList.add('tv-section--visible');
      } else {
        el.classList.remove('tv-section--visible');
        el.classList.add('tv-section--hidden');
      }
    });
  }

  function showDiError(message) {
    var el = document.getElementById('di-error-text');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('tv-section--hidden');
  }

  function hideDiError() {
    var el = document.getElementById('di-error-text');
    if (!el) return;
    el.textContent = '';
    el.classList.add('tv-section--hidden');
  }

  function handleGenerateInstrument() {
    hideDiError();

    var generateBtn = document.getElementById('btn-generate-instrument');
    if (generateBtn) generateBtn.disabled = true;

    showDiSection('di-loading-section');

    API.buildInstrument(State.studentContext, State.chosenMethodology)
      .then(function (data) {
        renderInstrumentResult(data);
        showDiSection('di-result-section');
        if (typeof window.showToast === 'function') window.showToast('Analysis complete', 'success');
      })
      .catch(function (err) {
        console.error('[buildInstrument error]', err);
        showDiSection('di-input-section');
        if (!API.handleError(err, showDiError, generateBtn)) {
          if (generateBtn) generateBtn.disabled = false;
          showDiError('Something went wrong. Please check your connection and try again.');
          if (typeof window.showToast === 'function') window.showToast('Something went wrong. Try again.', 'error');
        }
      });
  }

  function renderInstrumentResult(data) {
    var titleEl = document.getElementById('di-instrument-title');
    if (titleEl) titleEl.textContent = data.instrument_title || 'Research Instrument';

    var bodyEl = document.getElementById('di-instrument-body');
    if (bodyEl) bodyEl.innerHTML = buildInstrumentBodyHtml(data.sections || []);

    instrumentPlainText = buildInstrumentPlainText(data);

    var copyBtn = document.getElementById('btn-copy-instrument');
    if (copyBtn) {
      var newCopy = copyBtn.cloneNode(true);
      copyBtn.parentNode.replaceChild(newCopy, copyBtn);
      newCopy.addEventListener('click', handleCopyInstrument);
    }

    var continueBtn = document.getElementById('btn-instrument-continue');
    if (continueBtn) {
      var newContinue = continueBtn.cloneNode(true);
      continueBtn.parentNode.replaceChild(newContinue, continueBtn);
      newContinue.addEventListener('click', handleInstrumentContinue);
    }
  }

  function buildInstrumentBodyHtml(sections) {
    return sections.map(function (section) {
      var questionsHtml = (section.questions || []).map(function (q) {
        var scaleOrLine = '';
        if (q.type === 'likert' && q.scale) {
          var pills = q.scale.split('/').map(function (label) {
            return '<span class="di-likert-option">' + escapeHtml(label.trim()) + '</span>';
          }).join('');
          scaleOrLine = '<div class="di-likert-scale">' + pills + '</div>';
        } else {
          scaleOrLine = '<div class="di-open-line"></div>';
        }

        return (
          '<div class="di-question">' +
            '<span class="di-question-number">' + escapeHtml(String(q.number)) + '.</span>' +
            '<div class="di-question-content">' +
              '<p class="di-question-text">' + escapeHtml(q.text) + '</p>' +
              scaleOrLine +
            '</div>' +
          '</div>'
        );
      }).join('');

      return (
        '<div class="di-section">' +
          '<p class="di-section-title">' + escapeHtml(section.section_title) + '</p>' +
          questionsHtml +
        '</div>'
      );
    }).join('');
  }

  function buildInstrumentPlainText(data) {
    var lines = [];
    lines.push(data.instrument_title || 'Research Instrument');
    lines.push('Methodology: ' + (data.methodology || ''));
    lines.push('Topic: ' + (State.studentContext && State.studentContext.validatedTopic
      ? State.studentContext.validatedTopic : ''));
    lines.push('');

    (data.sections || []).forEach(function (section) {
      lines.push((section.section_title || '').toUpperCase());
      lines.push('');
      (section.questions || []).forEach(function (q) {
        var line = q.number + '. ' + (q.text || '');
        if (q.type === 'likert' && q.scale) {
          line += '  [SA] [A] [N] [D] [SD]';
        } else {
          line += '\n   _______________________________________________';
        }
        lines.push(line);
        lines.push('');
      });
      lines.push('');
    });

    return lines.join('\n');
  }

  function handleCopyInstrument() {
    var btn = document.getElementById('btn-copy-instrument');

    function onSuccess() {
      if (btn) {
        btn.textContent = 'Copied ✓';
        setTimeout(function () { btn.textContent = 'Copy Instrument'; }, 2000);
      }
    }

    function onFail() {
      var textarea = document.createElement('textarea');
      textarea.value = instrumentPlainText;
      textarea.style.position = 'fixed';
      textarea.style.opacity  = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try { document.execCommand('copy'); onSuccess(); } catch (e) { /* silent */ }
      document.body.removeChild(textarea);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(instrumentPlainText).then(onSuccess).catch(onFail);
    } else {
      onFail();
    }
  }

  function handleInstrumentContinue() {
    if (typeof window.showToast === 'function') window.showToast('Step 5 unlocked', 'unlock');
    document.dispatchEvent(new CustomEvent('step4:init'));
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
