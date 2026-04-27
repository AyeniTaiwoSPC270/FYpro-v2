// FYPro — Step 4: Writing Planner
// Handles all UI and logic for the Writing Planner card.
// Activated by the 'step4:init' custom event fired from step3.js after the student
// confirms their methodology. Follows the same IIFE + event pattern as all prior steps.

(function () {

  // Module-scope variable that persists across the card's lifecycle.
  var currentData = null;

  // Wait for step3.js to fire 'step4:init' before doing anything.
  // { once: true } removed so the step can be re-entered after back navigation.
  document.addEventListener('step4:init', function () {
    initStep4();
  });

  // Register initStep4 for direct invocation by navigateToStep() on back navigation.
  window._fyInits = window._fyInits || {};
  window._fyInits[4] = initStep4;


  // ── Entry point ────────────────────────────────────────────────────────────

  function initStep4() {
    if (State.currentStep !== 3) return;

    currentData = null;

    var scrollEl = document.querySelector('.app-content__scroll');
    if (!scrollEl) return;

    var card = renderPlannerCard();
    scrollEl.innerHTML = '';
    scrollEl.appendChild(card);

    // Restore saved result if this step was previously completed
    if (State.stepResults && State.stepResults['step4']) {
      var resultSection = document.getElementById('wp-result-section');
      if (resultSection) {
        resultSection.innerHTML = State.stepResults['step4'];
        showSection('wp-result-section');
        return;
      }
    }

    var dateInput = document.getElementById('wp-date-input');
    if (dateInput) {
      dateInput.min = new Date().toISOString().slice(0, 10);
      dateInput.addEventListener('change', handleDateChange);
    }

    var generateBtn = document.getElementById('btn-generate-plan');
    if (generateBtn) generateBtn.addEventListener('click', handleGenerate);

    document.getElementById('btn-back-step4').addEventListener('click', function () {
      window.navigateToStep(2);
    });
  }


  // ── Card builder ───────────────────────────────────────────────────────────

  function renderPlannerCard() {
    var card = document.createElement('div');
    card.className = 'wp-card';
    card.id = 'wp-card';

    card.innerHTML =

      // ── Input Section ──────────────────────────────────────
      '<div id="wp-input-section" class="wp-input-section tv-section--visible">' +
        '<button id="btn-back-step4" class="fy-back-btn">← Back to Methodology Advisor</button>' +
        '<p class="wp-step-label">Step 4: Writing Planner</p>' +
        '<p class="wp-description">FYPro will build a realistic week-by-week writing schedule from today to your submission deadline — weighted by chapter complexity and adjusted for Nigerian public holidays and exam periods.</p>' +
        '<div class="wp-date-field">' +
          '<label class="wp-date-label" for="wp-date-input">Submission Deadline</label>' +
          '<input id="wp-date-input" class="wp-date-input" type="date" />' +
        '</div>' +
        '<div id="wp-urgency" class="wp-urgency tv-section--hidden">' +
          '<span id="wp-urgency-icon" class="wp-urgency__icon"></span>' +
          '<span id="wp-urgency-text" class="wp-urgency__text"></span>' +
        '</div>' +
        '<p id="wp-error-text" class="wp-error-text tv-section--hidden"></p>' +
        '<button id="btn-generate-plan" class="wp-btn-generate" disabled>Generate Writing Plan</button>' +
      '</div>' +

      // ── Loading Section ────────────────────────────────────
      '<div id="wp-loading-section" class="wp-loading-section tv-section--hidden">' +
        '<div class="skeleton-loader">' +
          '<div class="skeleton-bar" style="width:100%"></div>' +
          '<div class="skeleton-bar" style="width:75%"></div>' +
          '<div class="skeleton-bar" style="width:90%"></div>' +
          '<div class="skeleton-bar" style="width:60%"></div>' +
        '</div>' +
        '<p class="tv-loading-text">Building your writing plan…</p>' +
      '</div>' +

      // ── Result Section ─────────────────────────────────────
      '<div id="wp-result-section" class="wp-result-section tv-section--hidden">' +

        '<div class="wp-summary-bar">' +
          '<div class="wp-summary-stat">' +
            '<span id="wp-stat-weeks" class="wp-summary-stat__value"></span>' +
            '<span class="wp-summary-stat__label">total weeks</span>' +
          '</div>' +
          '<div class="wp-summary-divider"></div>' +
          '<div class="wp-summary-stat">' +
            '<span id="wp-stat-avg" class="wp-summary-stat__value"></span>' +
            '<span class="wp-summary-stat__label">words / week avg</span>' +
          '</div>' +
          '<div class="wp-summary-divider"></div>' +
          '<div class="wp-summary-stat">' +
            '<span id="wp-stat-total" class="wp-summary-stat__value"></span>' +
            '<span class="wp-summary-stat__label">total words</span>' +
          '</div>' +
        '</div>' +

        '<div id="wp-timeline" class="wp-timeline"></div>' +

        '<button id="btn-confirm-plan" class="wp-btn-confirm" disabled>Confirm Plan — Continue</button>' +

      '</div>';

    return card;
  }


  // ── Section visibility ─────────────────────────────────────────────────────

  function showSection(sectionId) {
    var ids = ['wp-input-section', 'wp-loading-section', 'wp-result-section'];
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


  // ── Date change handler ────────────────────────────────────────────────────

  function handleDateChange() {
    var dateInput = document.getElementById('wp-date-input');
    if (!dateInput) return;

    var value = dateInput.value;

    if (!value) {
      hideUrgency();
      disableGenerateButton();
      return;
    }

    var today    = new Date();
    var todayMs  = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    var deadline = new Date(value + 'T00:00:00');
    var deadlineMs = deadline.getTime();

    if (deadlineMs <= todayMs) {
      showError('Please select a future date — the deadline must be after today.');
      hideUrgency();
      disableGenerateButton();
      return;
    }

    hideError();

    var msPerWeek      = 7 * 24 * 60 * 60 * 1000;
    var weeksRemaining = Math.floor((deadlineMs - todayMs) / msPerWeek);

    var tier, icon, text;
    if (weeksRemaining > 8) {
      tier = 'green';
      icon = '●';
      text = weeksRemaining + ' weeks remaining — you have good time';
    } else if (weeksRemaining >= 4) {
      tier = 'amber';
      icon = '●';
      text = weeksRemaining + ' weeks remaining — moderate urgency';
    } else {
      tier = 'red';
      icon = '!';
      text = weeksRemaining + ' week' + (weeksRemaining === 1 ? '' : 's') + ' remaining — tight deadline';
    }

    var urgencyEl = document.getElementById('wp-urgency');
    if (urgencyEl) {
      urgencyEl.classList.remove('wp-urgency--green', 'wp-urgency--amber', 'wp-urgency--red');
      urgencyEl.classList.add('wp-urgency--' + tier);
    }

    var iconEl = document.getElementById('wp-urgency-icon');
    var textEl = document.getElementById('wp-urgency-text');
    if (iconEl) iconEl.textContent = icon;
    if (textEl) textEl.textContent = text;

    showUrgency();
    enableGenerateButton();

    var resultSection = document.getElementById('wp-result-section');
    if (resultSection && resultSection.classList.contains('tv-section--visible')) {
      currentData = null;
      showSection('wp-input-section');
    }
  }


  // ── Generate handler ───────────────────────────────────────────────────────

  function handleGenerate() {
    hideError();

    var dateInput = document.getElementById('wp-date-input');
    if (!dateInput || !dateInput.value) return;

    var value    = dateInput.value;
    var today    = new Date();
    var todayMs  = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    var deadlineMs = new Date(value + 'T00:00:00').getTime();

    if (deadlineMs <= todayMs) {
      showError('Please select a future date before generating a plan.');
      return;
    }

    disableGenerateButton();
    showSection('wp-loading-section');

    var currentDate = new Date().toISOString().slice(0, 10);

    API.buildWritingPlan(State.studentContext, value, currentDate)
      .then(function (data) {
        currentData = data;
        renderResult(data);
        showSection('wp-result-section');
        if (typeof window.showToast === 'function') window.showToast('Analysis complete', 'success');
        State.stepResults = State.stepResults || {};
        State.stepResults['step4'] = document.getElementById('wp-result-section').innerHTML;
        State.save();
      })
      .catch(function (err) {
        showSection('wp-input-section');
        if (!API.handleError(err, showError, document.getElementById('btn-generate-plan'))) {
          enableGenerateButton();
          showError('Something went wrong. Please check your connection and try again.');
          if (typeof window.showToast === 'function') window.showToast('Something went wrong. Try again.', 'error');
        }
      });
  }


  // ── Error display helpers ──────────────────────────────────────────────────

  function showError(message) {
    var el = document.getElementById('wp-error-text');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('tv-section--hidden');
  }

  function hideError() {
    var el = document.getElementById('wp-error-text');
    if (!el) return;
    el.textContent = '';
    el.classList.add('tv-section--hidden');
  }


  // ── Urgency indicator helpers ──────────────────────────────────────────────

  function showUrgency() {
    var el = document.getElementById('wp-urgency');
    if (!el) return;
    el.classList.remove('tv-section--hidden');
    el.classList.add('tv-section--visible');
  }

  function hideUrgency() {
    var el = document.getElementById('wp-urgency');
    if (!el) return;
    el.classList.remove('tv-section--visible');
    el.classList.add('tv-section--hidden');
  }


  // ── Generate button state helpers ──────────────────────────────────────────

  function enableGenerateButton() {
    var btn = document.getElementById('btn-generate-plan');
    if (btn) btn.disabled = false;
  }

  function disableGenerateButton() {
    var btn = document.getElementById('btn-generate-plan');
    if (btn) btn.disabled = true;
  }


  // ── Result renderer ────────────────────────────────────────────────────────

  function renderResult(data) {
    var weeksEl = document.getElementById('wp-stat-weeks');
    var avgEl   = document.getElementById('wp-stat-avg');
    var totalEl = document.getElementById('wp-stat-total');

    if (weeksEl) weeksEl.textContent = String(data.total_weeks  || 0);
    if (avgEl)   avgEl.textContent   = String(data.weekly_average || 0);
    if (totalEl) totalEl.textContent = String(data.total_words  || 0);

    var timelineEl = document.getElementById('wp-timeline');
    if (timelineEl) renderTimeline(timelineEl, data.weeks || []);

    var confirmBtn = document.getElementById('btn-confirm-plan');
    if (confirmBtn) {
      var newConfirm = confirmBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
      newConfirm.disabled = false;
      newConfirm.addEventListener('click', handleConfirm);
    }
  }


  // ── Timeline renderer ──────────────────────────────────────────────────────

  function renderTimeline(container, weeks) {
    container.innerHTML = '';
    weeks.forEach(function (week) {
      var node = buildWeekNode(week);
      container.appendChild(node);
    });
  }

  function buildWeekNode(week) {
    var node = document.createElement('div');
    node.className = 'wp-week-node';

    if (week.is_current_week) node.classList.add('wp-week-node--current');
    if (week.is_buffer_week)  node.classList.add('wp-week-node--buffer');
    if (week.is_holiday_week) node.classList.add('wp-week-node--holiday');

    var dot = document.createElement('div');
    dot.className = 'wp-week-dot';

    var content = document.createElement('div');
    content.className = 'wp-week-content';

    var header = document.createElement('div');
    header.className = 'wp-week-header';

    var weekNum = document.createElement('span');
    weekNum.className = 'wp-week-number';
    weekNum.textContent = 'Week ' + week.week_number;

    var dates = document.createElement('span');
    dates.className = 'wp-week-dates';
    dates.textContent = escapeHtml(week.dates || '');

    header.appendChild(weekNum);
    header.appendChild(dates);

    if (week.is_current_week) {
      var badge = document.createElement('span');
      badge.className = 'wp-you-are-here';
      badge.textContent = 'You Are Here';
      header.appendChild(badge);
    }

    content.appendChild(header);

    if (week.focus) {
      var focus = document.createElement('p');
      focus.className = 'wp-week-focus';
      focus.textContent = escapeHtml(week.focus);
      content.appendChild(focus);
    }

    if (week.is_buffer_week) {
      var bufferTag = document.createElement('span');
      bufferTag.className = 'wp-week-tag wp-week-tag--buffer';
      bufferTag.textContent = 'Buffer Week';
      content.appendChild(bufferTag);

    } else if (week.is_holiday_week) {
      var holidayTag = document.createElement('span');
      holidayTag.className = 'wp-week-tag wp-week-tag--holiday';
      holidayTag.textContent = 'Holiday Week';
      content.appendChild(holidayTag);

      if (week.holiday_note) {
        var holidayNote = document.createElement('p');
        holidayNote.className = 'wp-week-holiday-note';
        holidayNote.textContent = escapeHtml(week.holiday_note);
        content.appendChild(holidayNote);
      }

    } else {
      var target = document.createElement('p');
      target.className = 'wp-week-target';
      target.textContent = escapeHtml(String(week.word_target || 0)) + ' words';
      content.appendChild(target);
    }

    node.appendChild(dot);
    node.appendChild(content);
    return node;
  }


  // ── Confirm handler ────────────────────────────────────────────────────────

  function handleConfirm() {
    if (!currentData) return;

    State.writingPlan = currentData;

    var dateInput = document.getElementById('wp-date-input');
    if (dateInput) State.submissionDeadline = dateInput.value;

    State.stepsCompleted[3] = true;
    State.currentStep       = 4;
    State.save();

    if (typeof window.refreshShell === 'function') {
      window.refreshShell();
    }

    if (typeof window.showToast === 'function') window.showToast('Step 5 unlocked', 'unlock');
    document.dispatchEvent(new CustomEvent('step5:init'));
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
