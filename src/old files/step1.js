// FYPro — Step 1: Topic Validator
// Handles all UI and logic for the Topic Validator card.
// Activated by the 'step1:init' custom event fired from app.js after the shell renders.

(function () {

  // Wait for app.js to fire 'step1:init' before doing anything.
  // { once: true } removed so that back navigation (which re-dispatches the event)
  // can re-enter this step without requiring a page reload.
  document.addEventListener('step1:init', function () {
    initStep1();
  });

  // Register initStep1 in the global _fyInits registry so navigateToStep() can
  // call it directly when the student returns to this step via back navigation.
  // The event-listener path is consumed on first fire; _fyInits is the re-entry path.
  window._fyInits = window._fyInits || {};
  window._fyInits[1] = initStep1;


  // ── Entry point ────────────────────────────────────────────────────────────

  function initStep1() {
    if (State.currentStep !== 0) return;

    var scrollEl = document.querySelector('.app-content__scroll');
    if (!scrollEl) return;

    var card = renderValidatorCard();
    scrollEl.innerHTML = '';
    scrollEl.appendChild(card);

    // Restore saved result if this step was previously completed
    if (State.stepResults && State.stepResults['step1']) {
      var resultSection = document.getElementById('tv-result-section');
      if (resultSection) {
        resultSection.innerHTML = State.stepResults['step1'];
        showSection('tv-result-section');
        return;
      }
    }

    // Wire up the primary interactive buttons
    document.getElementById('btn-validate').addEventListener('click', handleValidate);
  }


  // ── Card builder ───────────────────────────────────────────────────────────

  function renderValidatorCard() {
    var card = document.createElement('div');
    card.className = 'tv-card';
    card.id = 'tv-card';

    card.innerHTML =
      // ── Input Section ──────────────────────────────────────
      '<div id="tv-input-section" class="tv-input-section tv-section--visible">' +
        '<p class="tv-step-label">Step 1: Topic Validator</p>' +
        '<p class="tv-description">Edit your topic if needed, then validate it. FYPro will check scope, originality, faculty fit, and data-collection feasibility.</p>' +
        '<textarea id="tv-textarea" class="tv-textarea" rows="4" placeholder="e.g. Impact of social media on academic performance among undergraduates"></textarea>' +
        '<p id="tv-error-text" class="tv-error-text tv-section--hidden"></p>' +
        '<button id="btn-validate" class="tv-btn-validate">Validate Topic</button>' +
      '</div>' +

      // ── Loading Section ────────────────────────────────────
      '<div id="tv-loading-section" class="tv-loading-section tv-section--hidden">' +
        '<div class="skeleton-loader">' +
          '<div class="skeleton-bar" style="width:100%"></div>' +
          '<div class="skeleton-bar" style="width:75%"></div>' +
          '<div class="skeleton-bar" style="width:90%"></div>' +
          '<div class="skeleton-bar" style="width:60%"></div>' +
        '</div>' +
        '<p class="tv-loading-text">Analysing your topic…</p>' +
      '</div>' +

      // ── Result Section ─────────────────────────────────────
      '<div id="tv-result-section" class="tv-result-section tv-section--hidden">' +

        // Verdict block
        '<div class="tv-verdict-block">' +
          '<p id="tv-verdict-label" class="tv-verdict-label"></p>' +
          '<p id="tv-verdict-reason" class="tv-verdict-reason"></p>' +
        '</div>' +

        '<hr class="tv-divider">' +

        // Refined topic block
        '<div class="tv-refined-block">' +
          '<p class="tv-refined-label">Refined Topic</p>' +
          '<p id="tv-refined-text" class="tv-refined-text"></p>' +
          '<p id="tv-refined-explanation" class="tv-refined-explanation"></p>' +
          '<div class="tv-refined-actions">' +
            '<button id="btn-edit" class="tv-btn-edit">Edit</button>' +
          '</div>' +
        '</div>' +

        '<button id="btn-use" class="tv-btn-use">Use This Topic</button>' +

        // Alternatives block — shown only when verdict is Not Suitable
        '<div id="tv-alternatives" class="tv-alternatives tv-section--hidden">' +
          '<p class="tv-alternatives-heading">Alternative topics for your department</p>' +
          '<div id="tv-alternatives-list"></div>' +
        '</div>' +

      '</div>';

    // Pre-fill the textarea with whatever the student typed during onboarding
    var textarea = card.querySelector('#tv-textarea');
    textarea.value = State.roughTopic || '';

    return card;
  }


  // ── Section visibility ─────────────────────────────────────────────────────

  function showSection(sectionId) {
    var ids = ['tv-input-section', 'tv-loading-section', 'tv-result-section'];
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


  // ── Validate handler ───────────────────────────────────────────────────────

  function handleValidate() {
    var textarea = document.getElementById('tv-textarea');
    var topic = textarea ? textarea.value.trim() : '';

    // Guard: require at least a few characters before calling the API
    if (!topic || topic.length < 5) {
      textarea.classList.add('tv-textarea--shake');
      textarea.addEventListener('animationend', function () {
        textarea.classList.remove('tv-textarea--shake');
      }, { once: true });
      showError('Please enter your research topic before validating.');
      return;
    }

    // Clear any previous error and update State with whatever the student typed
    hideError();
    State.roughTopic = topic;
    State.save();

    // Transition to loading state
    showSection('tv-loading-section');

    // Disable the validate button to prevent double-clicks
    var btn = document.getElementById('btn-validate');
    if (btn) btn.disabled = true;

    // Call the API via the existing API client in api.js
    API.validateTopic(State.studentContext, topic)
      .then(function (data) {
        renderResult(data);
        showSection('tv-result-section');
        if (typeof window.showToast === 'function') window.showToast('Analysis complete', 'success');
        // Stop any running typewriter so the full refined text is captured in the save
        var refinedEl = document.getElementById('tv-refined-text');
        if (refinedEl && refinedEl._twInterval) {
          clearInterval(refinedEl._twInterval);
          refinedEl._twInterval = null;
          refinedEl.textContent = refinedEl.dataset.fullText || refinedEl.textContent;
          refinedEl.classList.remove('tv-typewriter--active');
        }
        State.stepResults = State.stepResults || {};
        State.stepResults['step1'] = document.getElementById('tv-result-section').innerHTML;
        State.save();
      })
      .catch(function (err) {
        showSection('tv-input-section');
        if (!API.handleError(err, showError, btn)) {
          if (btn) btn.disabled = false;
          showError('Something went wrong. Please check your connection and try again.');
          if (typeof window.showToast === 'function') window.showToast('Something went wrong. Try again.', 'error');
        }
      });
  }


  // ── Error display helpers ──────────────────────────────────────────────────

  function showError(message) {
    var el = document.getElementById('tv-error-text');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('tv-section--hidden');
  }

  function hideError() {
    var el = document.getElementById('tv-error-text');
    if (!el) return;
    el.textContent = '';
    el.classList.add('tv-section--hidden');
  }


  // ── Result renderer ────────────────────────────────────────────────────────

  function renderResult(data) {
    var card = document.getElementById('tv-card');

    // Apply verdict colour tint to the card background
    card.classList.remove('tv-card--green', 'tv-card--yellow', 'tv-card--red');
    var verdictClass = {
      'Researchable':     'tv-card--green',
      'Needs Refinement': 'tv-card--yellow',
      'Not Suitable':     'tv-card--red'
    }[data.verdict] || 'tv-card--yellow';
    card.classList.add(verdictClass);

    // Populate the verdict label (JetBrains Mono via CSS) with its colour modifier
    var labelEl = document.getElementById('tv-verdict-label');
    labelEl.textContent = data.verdict;
    labelEl.className = 'tv-verdict-label';
    var labelColour = {
      'Researchable':     'tv-verdict-label--green',
      'Needs Refinement': 'tv-verdict-label--yellow',
      'Not Suitable':     'tv-verdict-label--red'
    }[data.verdict] || 'tv-verdict-label--yellow';
    labelEl.classList.add(labelColour);

    // Populate verdict reason
    var reasonEl = document.getElementById('tv-verdict-reason');
    reasonEl.textContent = data.verdict_reason || '';

    // Set up refined topic for typewriter effect
    var refinedEl = document.getElementById('tv-refined-text');
    refinedEl.dataset.fullText = data.refined_topic || '';
    refinedEl.textContent = '';
    startTypewriter(refinedEl);

    // Populate refined explanation
    var explanationEl = document.getElementById('tv-refined-explanation');
    explanationEl.textContent = data.refined_explanation || '';

    // Wire up Edit and Use This Topic buttons (clone to remove any prior listeners)
    wireResultButtons(data);

    // Show alternatives only when the verdict is Not Suitable
    var altsContainer = document.getElementById('tv-alternatives');
    if (data.verdict === 'Not Suitable' && data.alternatives && data.alternatives.length) {
      renderAlternatives(data.alternatives);
      altsContainer.classList.remove('tv-section--hidden');
      altsContainer.classList.add('tv-section--visible');
    } else {
      altsContainer.classList.add('tv-section--hidden');
      altsContainer.classList.remove('tv-section--visible');
    }
  }

  function wireResultButtons(data) {
    // Replace Edit button
    var editBtn = document.getElementById('btn-edit');
    if (editBtn) {
      var newEdit = editBtn.cloneNode(true);
      newEdit.textContent = 'Edit';
      newEdit.className = 'tv-btn-edit';
      editBtn.parentNode.replaceChild(newEdit, editBtn);
      newEdit.addEventListener('click', handleEdit);
    }

    // Replace Use This Topic button
    var useBtn = document.getElementById('btn-use');
    if (useBtn) {
      var newUse = useBtn.cloneNode(true);
      newUse.textContent = 'Use This Topic';
      newUse.className = 'tv-btn-use';
      useBtn.parentNode.replaceChild(newUse, useBtn);
      newUse.addEventListener('click', handleUseThisTopic);
    }
  }


  // ── Typewriter effect ──────────────────────────────────────────────────────

  function startTypewriter(element) {
    if (element._twInterval) {
      clearInterval(element._twInterval);
      element._twInterval = null;
    }

    var fullText = element.dataset.fullText || '';
    var index = 0;
    element.textContent = '';
    element.classList.add('tv-typewriter--active');

    element._twInterval = setInterval(function () {
      if (index < fullText.length) {
        element.textContent += fullText[index];
        index++;
      } else {
        clearInterval(element._twInterval);
        element._twInterval = null;
        element.classList.remove('tv-typewriter--active');
      }
    }, 28);
  }


  // ── Edit handler ───────────────────────────────────────────────────────────

  function handleEdit() {
    var refinedEl = document.getElementById('tv-refined-text');
    if (!refinedEl) return;

    // Stop any running typewriter so the full text is available immediately
    if (refinedEl._twInterval) {
      clearInterval(refinedEl._twInterval);
      refinedEl._twInterval = null;
      refinedEl.classList.remove('tv-typewriter--active');
    }
    var currentText = refinedEl.dataset.fullText || refinedEl.textContent;

    var editArea = document.createElement('textarea');
    editArea.id = 'tv-refined-edit-area';
    editArea.className = 'tv-refined-edit-area';
    editArea.value = currentText;
    editArea.rows = 3;

    refinedEl.parentNode.replaceChild(editArea, refinedEl);
    editArea.focus();

    // Swap the Edit button for a Save button
    var editBtn = document.getElementById('btn-edit');
    if (editBtn) {
      var saveBtn = document.createElement('button');
      saveBtn.id = 'btn-save';
      saveBtn.className = 'tv-btn-save';
      saveBtn.textContent = 'Save';
      editBtn.parentNode.replaceChild(saveBtn, editBtn);
      saveBtn.addEventListener('click', handleSave);
    }
  }

  function handleSave() {
    var editArea = document.getElementById('tv-refined-edit-area');
    if (!editArea) return;

    var newText = editArea.value.trim() || editArea.value;

    var para = document.createElement('p');
    para.id = 'tv-refined-text';
    para.className = 'tv-refined-text';
    para.textContent = newText;
    para.dataset.fullText = newText;

    editArea.parentNode.replaceChild(para, editArea);

    // Swap Save back to Edit
    var saveBtn = document.getElementById('btn-save');
    if (saveBtn) {
      var editBtn = document.createElement('button');
      editBtn.id = 'btn-edit';
      editBtn.className = 'tv-btn-edit';
      editBtn.textContent = 'Edit';
      saveBtn.parentNode.replaceChild(editBtn, saveBtn);
      editBtn.addEventListener('click', handleEdit);
    }
  }


  // ── Use This Topic handler ─────────────────────────────────────────────────

  function handleUseThisTopic() {
    var refinedEl = document.getElementById('tv-refined-text');
    var editArea  = document.getElementById('tv-refined-edit-area');

    var finalTopic = '';
    if (editArea) {
      finalTopic = editArea.value.trim();
    } else if (refinedEl) {
      finalTopic = (refinedEl.dataset.fullText || refinedEl.textContent).trim();
    }

    if (!finalTopic) return;

    State.validatedTopic     = finalTopic;
    State.stepsCompleted[0]  = true;
    State.currentStep        = 1;
    State.save();

    if (typeof window.refreshShell === 'function') {
      window.refreshShell();
    }

    if (typeof window.showToast === 'function') window.showToast('Step 2 unlocked', 'unlock');
    document.dispatchEvent(new CustomEvent('step2:init'));
  }


  // ── Alternatives renderer ──────────────────────────────────────────────────

  function renderAlternatives(alternatives) {
    var listEl = document.getElementById('tv-alternatives-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    alternatives.forEach(function (alt) {
      var diffKey = (alt.difficulty || 'moderate').toLowerCase();
      if (diffKey !== 'easy' && diffKey !== 'moderate' && diffKey !== 'challenging') {
        diffKey = 'moderate';
      }

      var card = document.createElement('div');
      card.className = 'tv-alt-card';

      card.innerHTML =
        '<p class="tv-alt-topic">' + escapeHtml(alt.topic) + '</p>' +
        '<p class="tv-alt-explanation">' + escapeHtml(alt.explanation) + '</p>' +
        '<div class="tv-alt-footer">' +
          '<span class="tv-difficulty-badge tv-difficulty--' + diffKey + '">' + escapeHtml(alt.difficulty) + '</span>' +
          '<button class="tv-btn-use-alt">Use This Instead</button>' +
        '</div>';

      card.querySelector('.tv-btn-use-alt').addEventListener('click', function () {
        handleSelectAlternative(alt.topic);
      });

      listEl.appendChild(card);
    });
  }

  function handleSelectAlternative(topic) {
    var textarea = document.getElementById('tv-textarea');
    if (textarea) {
      textarea.value = topic;
      State.roughTopic = topic;
    }
    var btn = document.getElementById('btn-validate');
    if (btn) btn.disabled = false;
    hideError();
    showSection('tv-input-section');
    if (textarea) textarea.focus();
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
