(function () {
  // ── Splash → Onboarding transition ──────────────────────────────────────────
  const splash     = document.getElementById('splash-screen');
  const onboarding = document.getElementById('onboarding-screen');

  const ENTRANCE_MS = 700;   // matches splashEnter animation duration
  const HOLD_MS     = 1000;  // 1 second hold at full visibility

  setTimeout(function () {
    splash.classList.add('splash--exiting');
    // If a valid saved session exists, skip onboarding and restore the shell
    // at whichever step the student left off. State.load() returns false when
    // there is no stored session.
    if (State.load() && State.university) {
      showAppShell(true);
    } else {
      onboarding.classList.remove('onboarding--hidden');
      triggerStagger();
    }
  }, ENTRANCE_MS + HOLD_MS); // fires at 1700ms

  // ── Staggered reveal ─────────────────────────────────────────────────────────

  /**
   * triggerStagger — Reveals onboarding form fields one by one with a staggered
   * delay. Each element with class .reveal-item gets .is-visible added after a
   * cumulative delay (300ms base + 220ms per item) so they animate in sequentially
   * rather than all at once.
   */
  function triggerStagger() {
    var items = onboarding.querySelectorAll('.reveal-item');
    items.forEach(function (el, i) {
      setTimeout(function () {
        el.classList.add('is-visible');
      }, 300 + i * 220);
    });
  }

  // ── DOM refs ──────────────────────────────────────────────────────────────────
  var selUniversity = document.getElementById('sel-university');
  var selFaculty    = document.getElementById('sel-faculty');
  var selDepartment = document.getElementById('sel-department');
  var levelBtns     = document.querySelectorAll('.level-btn');
  var inpTopic      = document.getElementById('inp-topic');
  var btnBegin      = document.getElementById('btn-begin');

  var grpFaculty    = selFaculty.closest('.field-group');
  var grpDepartment = selDepartment.closest('.field-group');
  var grpLevel      = document.querySelector('.level-selector').closest('.field-group');
  var grpTopic      = inpTopic.closest('.field-group');

  var selectedLevel = '';

  // App shell refs
  var appShell         = document.getElementById('app-shell');
  var sidebarStepList  = document.getElementById('sidebar-step-list');
  var sidebarBonus     = document.getElementById('sidebar-bonus');
  var stepNavigator    = document.getElementById('step-navigator');
  var placeholderLabel = document.getElementById('placeholder-step-label');
  var ctxUniversity    = document.getElementById('ctx-university');
  var ctxFaculty       = document.getElementById('ctx-faculty');
  var ctxDepartment    = document.getElementById('ctx-department');
  var ctxLevel         = document.getElementById('ctx-level');
  var ctxTopic         = document.getElementById('ctx-topic');

  // ── Step metadata ─────────────────────────────────────────────────────────────
  var STEPS = [
    'Topic Validator',
    'Chapter Architect',
    'Methodology Advisor',
    'Writing Planner',
    'Project Reviewer',
    'Defence Prep'
  ];

  // ── Populate universities ─────────────────────────────────────────────────────
  getUniversities().forEach(function (uni) {
    var opt = document.createElement('option');
    opt.value = uni;
    opt.textContent = uni;
    selUniversity.appendChild(opt);
  });

  // ── University → unlock Faculty ──────────────────────────────────────────────
  selUniversity.addEventListener('change', function () {
    var uni = selUniversity.value;
    resetSelect(selFaculty, 'Select faculty\u2026');
    resetSelect(selDepartment, 'Select department\u2026');
    lockGroup(grpDepartment, selDepartment);
    selectedLevel = '';
    levelBtns.forEach(function (b) {
      b.classList.remove('is-selected');
      b.disabled = true;
    });
    lockGroup(grpLevel);
    inpTopic.value = '';
    lockGroup(grpTopic, inpTopic);
    checkComplete();
    if (!uni) { lockGroup(grpFaculty, selFaculty); return; }
    getFaculties(uni).forEach(function (fac) {
      var opt = document.createElement('option');
      opt.value = fac;
      opt.textContent = fac;
      selFaculty.appendChild(opt);
    });
    unlockGroup(grpFaculty, selFaculty);
  });

  // ── Faculty → unlock Department ──────────────────────────────────────────────
  selFaculty.addEventListener('change', function () {
    var fac = selFaculty.value;
    resetSelect(selDepartment, 'Select department\u2026');
    selectedLevel = '';
    levelBtns.forEach(function (b) {
      b.classList.remove('is-selected');
      b.disabled = true;
    });
    lockGroup(grpLevel);
    inpTopic.value = '';
    lockGroup(grpTopic, inpTopic);
    checkComplete();
    if (!fac) { lockGroup(grpDepartment, selDepartment); return; }
    getDepartments(selUniversity.value, fac).forEach(function (dep) {
      var opt = document.createElement('option');
      opt.value = dep;
      opt.textContent = dep;
      selDepartment.appendChild(opt);
    });
    unlockGroup(grpDepartment, selDepartment);
  });

  // ── Department → unlock Level ────────────────────────────────────────────────
  selDepartment.addEventListener('change', function () {
    selectedLevel = '';
    levelBtns.forEach(function (b) {
      b.classList.remove('is-selected');
      b.disabled = true;
    });
    inpTopic.value = '';
    lockGroup(grpTopic, inpTopic);
    checkComplete();
    if (!selDepartment.value) { lockGroup(grpLevel); return; }
    levelBtns.forEach(function (b) { b.disabled = false; });
    unlockGroup(grpLevel);
  });

  // ── Level → unlock Topic ─────────────────────────────────────────────────────
  levelBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      levelBtns.forEach(function (b) { b.classList.remove('is-selected'); });
      btn.classList.add('is-selected');
      selectedLevel = btn.dataset.level;
      unlockGroup(grpTopic, inpTopic);
      inpTopic.focus();
      checkComplete();
    });
  });

  // ── Topic input → check Begin ────────────────────────────────────────────────
  inpTopic.addEventListener('input', checkComplete);

  // ── Begin button ─────────────────────────────────────────────────────────────
  var pulseFired = false;

  btnBegin.addEventListener('mouseenter', function () {
    if (!pulseFired && btnBegin.classList.contains('is-ready')) {
      btnBegin.classList.add('do-pulse');
      pulseFired = true;
    }
  });

  btnBegin.addEventListener('click', function () {
    if (!btnBegin.classList.contains('is-ready')) return;
    State.university = selUniversity.value;
    State.faculty    = selFaculty.value;
    State.department = selDepartment.value;
    State.level      = selectedLevel;
    State.roughTopic = inpTopic.value.trim();
    State.save();
    showAppShell();
  });

  // ── App Shell ─────────────────────────────────────────────────────────────────

  /**
   * populateContextCard — Fills the sidebar context card with the student's
   * university, faculty, department, level, and validated topic from State.
   * Called on initial shell render and by window.refreshShell() after each step.
   */
  function populateContextCard() {
    ctxUniversity.textContent = State.university;
    ctxFaculty.textContent    = State.faculty;
    ctxDepartment.textContent = State.department;
    ctxLevel.textContent      = 'Level ' + State.level;
    ctxTopic.textContent      = State.validatedTopic || State.roughTopic;
  }

  /**
   * renderSidebarSteps — Clears and rebuilds the sidebar step list from the STEPS
   * array and current State. Each item shows a badge (step number or checkmark SVG),
   * the step name, and a trailing lock or check icon. Completed steps receive a
   * click listener so the student can navigate back to any earlier step by clicking
   * it. Also conditionally renders the bonus Supervisor Email button once the
   * first four steps are complete.
   */
  function renderSidebarSteps() {
    sidebarStepList.innerHTML = '';
    var CHECK_PATH = 'M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z';
    var LOCK_PATH  = 'M208,80H168V56a40,40,0,0,0-80,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM104,56a24,24,0,0,1,48,0V80H104Zm104,152H48V96H208V208Zm-80-48a8,8,0,1,1-8-8A8,8,0,0,1,136,160Z';

    /* The furthest step the student has ever reached — the first incomplete step
       in the linear sequence, or the last step if all are done. All steps up to
       and including this index are accessible regardless of currentStep. */
    var completedCount = State.stepsCompleted.filter(Boolean).length;
    var furthestAccessible = Math.min(completedCount, STEPS.length - 1);

    STEPS.forEach(function (name, i) {
      var isCompleted  = State.stepsCompleted[i];
      var isCurrent    = (i === State.currentStep);
      var isAccessible = (i <= furthestAccessible);
      var isLocked     = !isAccessible;

      var li = document.createElement('li');
      li.className = 'step-list__item';
      if (isCurrent)   li.classList.add('step-list__item--current');
      if (isCompleted) li.classList.add('step-list__item--completed');
      if (isLocked)    li.classList.add('step-list__item--locked');

      var badge = document.createElement('div');
      badge.className = 'step-list__badge';
      if (isCompleted) {
        badge.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="' + CHECK_PATH + '"></path></svg>';
      } else {
        badge.textContent = String(i + 1);
      }

      var nameEl = document.createElement('span');
      nameEl.className = 'step-list__name';
      nameEl.textContent = name;

      li.appendChild(badge);
      li.appendChild(nameEl);

      if (isLocked || isCompleted) {
        var iconEl = document.createElement('span');
        iconEl.className = 'step-list__icon';
        var iconPath = isLocked ? LOCK_PATH : CHECK_PATH;
        var iconFill = isCompleted ? '#0066FF' : 'currentColor';
        iconEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256" fill="' + iconFill + '" aria-hidden="true"><path d="' + iconPath + '"></path></svg>';
        li.appendChild(iconEl);
      }

      sidebarStepList.appendChild(li);

      /* All accessible steps (completed + current working step) are clickable.
         An IIFE captures the correct loop index. */
      if (isAccessible) {
        li.style.cursor = 'pointer';
        li.title = 'Go to ' + name;
        (function (idx) {
          li.addEventListener('click', function () { navigateToStep(idx); });
        }(i));
      }
    });

    // Render the bonus email button when all 4 core steps are complete.
    // The button dispatches 'supervisor-email:open', picked up by supervisor-email.js.
    if (sidebarBonus) {
      var allCoreStepsDone = State.stepsCompleted[0] &&
                             State.stepsCompleted[1] &&
                             State.stepsCompleted[2] &&
                             State.stepsCompleted[3];
      if (allCoreStepsDone) {
        sidebarBonus.innerHTML =
          '<div class="sidebar__bonus-divider"></div>' +
          '<button id="btn-open-email" class="sidebar__bonus-btn">' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">' +
              '<path d="M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48ZM203.43,64,128,133.15,52.57,64ZM216,192H40V74.19l82.59,75.71a8,8,0,0,0,10.82,0L216,74.19V192Z"></path>' +
            '</svg>' +
            'Draft Supervisor Email' +
          '</button>';

        // Wire the click listener after the button is in the DOM
        document.getElementById('btn-open-email')
          .addEventListener('click', function () {
            document.dispatchEvent(new CustomEvent('supervisor-email:open'));
          });
      } else {
        // Clear the bonus section when steps are not yet complete
        sidebarBonus.innerHTML = '';
      }
    }
  }

  /**
   * renderStepNavigator — Clears and rebuilds the top step navigator pill track.
   * Each pill shows a step number or checkmark (when complete), connected by a
   * line that turns blue as steps are completed. Also updates the placeholder
   * label beneath the navigator with the current step name.
   */
  function renderStepNavigator() {
    stepNavigator.innerHTML = '';
    var CHECK_PATH = 'M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z';

    var track = document.createElement('div');
    track.className = 'nav-track';

    var completedCount = State.stepsCompleted.filter(Boolean).length;
    var furthestAccessible = Math.min(completedCount, STEPS.length - 1);

    STEPS.forEach(function (name, i) {
      var isCompleted  = State.stepsCompleted[i];
      var isCurrent    = (i === State.currentStep);
      var isAccessible = (i <= furthestAccessible);

      var pill = document.createElement('div');
      pill.className = 'nav-pill';
      if (isCompleted) pill.classList.add('nav-pill--completed');
      if (isCurrent)   pill.classList.add('nav-pill--current');

      if (isCompleted) {
        pill.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="' + CHECK_PATH + '"></path></svg>';
      } else {
        pill.textContent = String(i + 1);
      }

      var label = document.createElement('span');
      label.className = 'nav-pill__label';
      label.textContent = name.split(' ')[0];
      pill.appendChild(label);

      if (isAccessible) {
        pill.style.cursor = 'pointer';
        pill.title = name;
        (function (idx) {
          pill.addEventListener('click', function () { navigateToStep(idx); });
        }(i));
      }

      track.appendChild(pill);

      if (i < STEPS.length - 1) {
        var connector = document.createElement('div');
        connector.className = 'nav-connector';
        if (isCompleted) connector.classList.add('nav-connector--completed');
        track.appendChild(connector);
      }
    });

    stepNavigator.appendChild(track);
    placeholderLabel.textContent = 'Step ' + (State.currentStep + 1) + ': ' + STEPS[State.currentStep];
  }

  /**
   * showAppShell — Transitions from the onboarding screen to the main app shell.
   * Populates the context card, renders the sidebar and navigator, hides onboarding,
   * shows the shell. On a fresh session (isRestore = false) the current step is
   * initialised immediately. On a session restore (isRestore = true) a resume card
   * is shown instead so no step fires without an explicit button click.
   *
   * @param {boolean} [isRestore] — true when called after loading a saved session
   */
  function showAppShell(isRestore) {
    populateContextCard();
    renderSidebarSteps();
    renderStepNavigator();
    onboarding.classList.add('onboarding--hidden');
    appShell.classList.remove('app-shell--hidden');
    var stepNum = State.currentStep + 1;
    if (isRestore) {
      renderResumeCard(stepNum);
    } else {
      if (window._fyInits && typeof window._fyInits[stepNum] === 'function') {
        window._fyInits[stepNum]();
      } else {
        document.dispatchEvent(new CustomEvent('step' + stepNum + ':init'));
      }
    }
  }

  /**
   * renderResumeCard — Renders a "session restored" placeholder card in the scroll
   * area. Contains a single "Continue Step N" button that triggers the step init
   * when clicked. Used only on session restore so no step runs automatically.
   *
   * @param {number} stepNum — 1-based step number to resume
   */
  function renderResumeCard(stepNum) {
    var scrollEl = document.querySelector('.app-content__scroll');
    if (!scrollEl) return;

    var stepName = STEPS[State.currentStep] || ('Step ' + stepNum);

    var card = document.createElement('div');
    card.style.cssText = [
      'background:linear-gradient(145deg,#0D1B2A 0%,#0F2235 100%)',
      'border-radius:16px',
      'border:1px solid rgba(255,255,255,0.08)',
      'box-shadow:0 4px 24px rgba(0,0,0,0.08),0 1px 4px rgba(0,0,0,0.04)',
      'padding:40px',
      'width:100%',
      'max-width:660px',
      'position:relative',
      'overflow:hidden',
      'box-sizing:border-box'
    ].join(';');

    var label = document.createElement('p');
    label.style.cssText = 'font-family:"JetBrains Mono",monospace;font-size:0.75rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin:0 0 8px;';
    label.textContent = 'Session Restored';

    var heading = document.createElement('p');
    heading.style.cssText = 'font-family:"DM Serif Display",serif;font-size:1.5rem;color:#ffffff;margin:0 0 12px;';
    heading.textContent = 'Continue: Step ' + stepNum + ' \u2014 ' + stepName;

    var desc = document.createElement('p');
    desc.style.cssText = 'font-family:Poppins,sans-serif;font-size:0.875rem;color:rgba(255,255,255,0.6);margin:0 0 32px;line-height:1.6;';
    desc.textContent = 'Welcome back. Your session has been restored. Click below to continue where you left off.';

    var btn = document.createElement('button');
    btn.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'gap:8px',
      'background:linear-gradient(135deg,#0066FF,#0052CC)',
      'color:#fff',
      'border:none',
      'border-radius:12px',
      'padding:14px 28px',
      'font-family:Poppins,sans-serif',
      'font-size:0.875rem',
      'font-weight:600',
      'cursor:pointer',
      'transition:box-shadow 0.2s ease'
    ].join(';');
    btn.textContent = 'Continue Step ' + stepNum;

    btn.addEventListener('mouseenter', function () {
      btn.style.boxShadow = '0 0 20px rgba(0,102,255,0.4)';
    });
    btn.addEventListener('mouseleave', function () {
      btn.style.boxShadow = '';
    });
    btn.addEventListener('click', function () {
      if (window._fyInits && typeof window._fyInits[stepNum] === 'function') {
        window._fyInits[stepNum]();
      } else {
        document.dispatchEvent(new CustomEvent('step' + stepNum + ':init'));
      }
    });

    card.appendChild(label);
    card.appendChild(heading);
    card.appendChild(desc);
    card.appendChild(btn);

    scrollEl.innerHTML = '';
    scrollEl.appendChild(card);
  }

  /**
   * navigateToStep — Jumps directly to any step by its 0-based index.
   * Updates State.currentStep, persists to localStorage, refreshes the sidebar
   * and navigator, clears the scroll content area, then calls the step's registered
   * init function directly via window._fyInits. Using direct function calls (rather
   * than re-dispatching events) is necessary because step event listeners use
   * { once: true } and are consumed after the first fire — they cannot be re-triggered.
   * Exposed globally as window.navigateToStep so Back buttons in step cards can call it.
   *
   * @param {number} stepIndex — 0-based index of the step to navigate to (0 = Step 1)
   */
  function navigateToStep(stepIndex) {
    /* Guard: only allow navigation to completed steps or the current working step */
    var completedCount = State.stepsCompleted.filter(Boolean).length;
    var furthestAccessible = Math.min(completedCount, STEPS.length - 1);
    if (stepIndex > furthestAccessible) return;

    /* Track direction so enhancements.js can apply the correct slide animation */
    window._fyNavDir = stepIndex < State.currentStep ? 'back' : 'forward';

    State.currentStep = stepIndex;
    State.save();
    window.refreshShell();
    /* Clear the scroll area so the target step card renders fresh */
    var scroll = document.querySelector('.app-content__scroll');
    if (scroll) scroll.innerHTML = '';
    /* Call the step's init function directly via the global registry */
    if (window._fyInits && typeof window._fyInits[stepIndex + 1] === 'function') {
      window._fyInits[stepIndex + 1]();
    }
  }
  /* Expose globally so Back buttons and step modules can call window.navigateToStep() */
  window.navigateToStep = navigateToStep;

  /**
   * window.refreshShell — Lightweight shell refresh for step modules.
   * Re-renders the context card, sidebar step list, and navigator pills WITHOUT
   * touching the scroll content area — step modules manage their own content.
   * Called by step modules after completing a step and by navigateToStep().
   */
  window.refreshShell = function () {
    populateContextCard();
    renderSidebarSteps();
    renderStepNavigator();
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────

  /**
   * unlockGroup — Removes the locked CSS class from a field group wrapper and
   * optionally re-enables the associated input or select element so the student
   * can interact with it.
   *
   * @param {Element}  group  — the .field-group wrapper element
   * @param {Element}  [field] — the input/select to enable (optional)
   */
  function unlockGroup(group, field) {
    group.classList.remove('field-group--locked');
    if (field) field.disabled = false;
  }

  /**
   * lockGroup — Adds the locked CSS class to a field group wrapper and optionally
   * disables the associated input or select element to prevent interaction until
   * the preceding dependent field is filled in.
   *
   * @param {Element}  group  — the .field-group wrapper element
   * @param {Element}  [field] — the input/select to disable (optional)
   */
  function lockGroup(group, field) {
    group.classList.add('field-group--locked');
    if (field) field.disabled = true;
  }

  /**
   * resetSelect — Clears all existing options from a select element and inserts
   * a single disabled placeholder option so the select returns to its empty state
   * when an upstream dependency changes (e.g. changing university resets faculty).
   *
   * @param {HTMLSelectElement} sel         — the select element to clear
   * @param {string}            placeholder — text for the empty-value option
   */
  function resetSelect(sel, placeholder) {
    sel.innerHTML = '<option value="">' + placeholder + '</option>';
  }

  /**
   * checkComplete — Validates all five onboarding fields and toggles the Begin
   * button between its ready (enabled, blue) and disabled states. The topic input
   * must contain at least 10 characters for validation to pass.
   */
  function checkComplete() {
    var allDone = selUniversity.value &&
                  selFaculty.value &&
                  selDepartment.value &&
                  selectedLevel &&
                  inpTopic.value.trim().length >= 10;

    if (allDone) {
      btnBegin.classList.add('is-ready');
      btnBegin.disabled = false;
    } else {
      btnBegin.classList.remove('is-ready');
      btnBegin.classList.remove('do-pulse');
      btnBegin.disabled = true;
      pulseFired = false;
    }
  }

})();
