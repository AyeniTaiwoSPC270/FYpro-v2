// FYPro — Step 2: Chapter Architect
// Handles all UI and logic for the Chapter Architect card.
// Activated by the 'step2:init' custom event fired from step1.js after the student
// confirms their validated topic. Follows the same IIFE + event pattern as step1.js.

(function () {

  // SVG path for the down-pointing chevron used on accordion rows
  var CHEVRON_PATH = 'M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z';

  // Module-scope variables that persist between generate / regenerate cycles
  var currentData      = null;   // latest API response object
  var currentStructure = 'standard-5'; // selected structure type
  var currentWordCount = 0;           // word count entered by the student
  var abstractCardInserted  = false;  // ensures the ag-card is only appended once
  var litMapCardInserted    = false;  // ensures the lm-card is only appended once

  // Wait for step1.js to fire 'step2:init' before doing anything.
  // { once: true } removed so the step can be re-entered after back navigation.
  document.addEventListener('step2:init', function () {
    initStep2();
  });

  // Register initStep2 for direct invocation by navigateToStep() on back navigation.
  window._fyInits = window._fyInits || {};
  window._fyInits[2] = initStep2;


  // ── Entry point ────────────────────────────────────────────────────────────

  function initStep2() {
    if (State.currentStep !== 1) return;

    // Reset module-scope state so back navigation renders a fresh card.
    currentData           = null;
    currentStructure      = 'standard-5';
    currentWordCount      = 0;
    abstractCardInserted  = false;
    litMapCardInserted    = false;

    var scrollEl = document.querySelector('.app-content__scroll');
    if (!scrollEl) return;

    var card = renderArchitectCard();
    scrollEl.innerHTML = '';
    scrollEl.appendChild(card);

    // Restore saved result if this step was previously completed
    if (State.stepResults && State.stepResults['step2']) {
      var resultSection = document.getElementById('ca-result-section');
      if (resultSection) {
        resultSection.innerHTML = State.stepResults['step2'];
        showSection('ca-result-section');
        return;
      }
    }

    // Wire the Generate button now that the card is in the DOM
    document.getElementById('btn-generate').addEventListener('click', handleGenerate);

    // Wire the Back button to return to Step 1 (Topic Validator)
    document.getElementById('btn-back-step2').addEventListener('click', function () {
      window.navigateToStep(0);
    });
  }


  // ── Card builder ───────────────────────────────────────────────────────────

  function renderArchitectCard() {
    var card = document.createElement('div');
    card.className = 'ca-card';
    card.id = 'ca-card';

    card.innerHTML =

      // ── Input Section ──────────────────────────────────────
      '<div id="ca-input-section" class="ca-input-section tv-section--visible">' +
        '<button id="btn-back-step2" class="fy-back-btn">← Back to Topic Validator</button>' +
        '<p class="ca-step-label">Step 2: Chapter Architect</p>' +
        '<p class="ca-description">Choose a structure type, enter your total word count target, then let FYPro map out your chapters — each with a core question, content outline, and word allocation.</p>' +

        // Structure type segmented toggle
        '<div class="ca-form-group">' +
          '<p class="ca-form-label">Structure Type</p>' +
          '<div class="ca-structure-toggle" id="ca-structure-toggle">' +
            '<button class="ca-toggle-btn ca-toggle-btn--active" data-value="standard-5">Standard 5-Chapter</button>' +
            '<button class="ca-toggle-btn" data-value="custom">Custom</button>' +
          '</div>' +
          '<p class="ca-toggle-hint" id="ca-toggle-hint">Intro → Literature Review → Methodology → Results &amp; Discussion → Conclusion</p>' +
        '</div>' +

        // Word count input
        '<div class="ca-form-group">' +
          '<p class="ca-form-label">Total Word Count Target</p>' +
          '<input id="ca-word-count" class="ca-word-count-input" type="number" min="5000" placeholder="e.g. 15000" />' +
        '</div>' +

        '<p id="ca-error-text" class="ca-error-text tv-section--hidden"></p>' +
        '<button id="btn-generate" class="ca-btn-generate">Generate Chapters</button>' +
      '</div>' +

      // ── Loading Section ────────────────────────────────────
      '<div id="ca-loading-section" class="ca-loading-section tv-section--hidden">' +
        '<div class="skeleton-loader">' +
          '<div class="skeleton-bar" style="width:100%"></div>' +
          '<div class="skeleton-bar" style="width:75%"></div>' +
          '<div class="skeleton-bar" style="width:90%"></div>' +
          '<div class="skeleton-bar" style="width:60%"></div>' +
        '</div>' +
        '<p class="tv-loading-text">Mapping your chapters…</p>' +
      '</div>' +

      // ── Result Section ─────────────────────────────────────
      '<div id="ca-result-section" class="ca-result-section tv-section--hidden">' +
        '<p id="ca-structure-note" class="ca-structure-note"></p>' +
        '<div id="ca-chapters-list" class="ca-chapters-list"></div>' +
        '<button id="btn-regenerate" class="ca-btn-regenerate">Regenerate</button>' +
        '<button id="btn-confirm" class="ca-btn-confirm">I am satisfied with this structure — Continue</button>' +
      '</div>';

    // Wire the structure type toggle buttons
    wireStructureToggle(card);

    return card;
  }


  // ── Structure toggle ───────────────────────────────────────────────────────

  function wireStructureToggle(card) {
    var toggleBtns = card.querySelectorAll('.ca-toggle-btn');
    var hintEl = card.querySelector('#ca-toggle-hint');

    toggleBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        toggleBtns.forEach(function (b) { b.classList.remove('ca-toggle-btn--active'); });
        btn.classList.add('ca-toggle-btn--active');
        currentStructure = btn.dataset.value;

        if (hintEl) {
          hintEl.style.display = currentStructure === 'standard-5' ? 'block' : 'none';
        }
      });
    });
  }


  // ── Section visibility ─────────────────────────────────────────────────────

  function showSection(sectionId) {
    var ids = ['ca-input-section', 'ca-loading-section', 'ca-result-section'];
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


  // ── Generate handler ───────────────────────────────────────────────────────

  function handleGenerate() {
    var wordCountEl = document.getElementById('ca-word-count');
    var wordCount = wordCountEl ? parseInt(wordCountEl.value, 10) : 0;

    if (!wordCount || wordCount < 5000) {
      showError('Please enter a word count of at least 5,000 before generating.');
      if (wordCountEl) {
        wordCountEl.classList.add('ca-input--shake');
        wordCountEl.addEventListener('animationend', function () {
          wordCountEl.classList.remove('ca-input--shake');
        }, { once: true });
      }
      return;
    }

    currentWordCount = wordCount;
    hideError();

    var btn = document.getElementById('btn-generate');
    if (btn) btn.disabled = true;

    showSection('ca-loading-section');

    API.buildChapters(State.studentContext, currentStructure, currentWordCount)
      .then(function (data) {
        currentData = data;
        renderResult(data);
        showSection('ca-result-section');
        if (typeof window.showToast === 'function') window.showToast('Analysis complete', 'success');
        State.stepResults = State.stepResults || {};
        State.stepResults['step2'] = document.getElementById('ca-result-section').innerHTML;
        State.save();
        ensureAbstractCard();
        ensureLiteratureMapCard();
      })
      .catch(function (err) {
        showSection('ca-input-section');
        if (!API.handleError(err, showError, btn)) {
          if (btn) btn.disabled = false;
          showError('Something went wrong. Please check your connection and try again.');
          if (typeof window.showToast === 'function') window.showToast('Something went wrong. Try again.', 'error');
        }
      });
  }


  // ── Error display helpers ──────────────────────────────────────────────────

  function showError(message) {
    var el = document.getElementById('ca-error-text');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('tv-section--hidden');
  }

  function hideError() {
    var el = document.getElementById('ca-error-text');
    if (!el) return;
    el.textContent = '';
    el.classList.add('tv-section--hidden');
  }


  // ── Result renderer ────────────────────────────────────────────────────────

  function renderResult(data) {
    var noteEl = document.getElementById('ca-structure-note');
    if (noteEl) noteEl.textContent = data.structure_note || '';

    var listEl = document.getElementById('ca-chapters-list');
    if (listEl) renderChapterList(listEl, data.chapters || []);

    var regenBtn = document.getElementById('btn-regenerate');
    if (regenBtn) {
      var newRegen = regenBtn.cloneNode(true);
      regenBtn.parentNode.replaceChild(newRegen, regenBtn);
      newRegen.addEventListener('click', handleRegenerate);
    }

    var confirmBtn = document.getElementById('btn-confirm');
    if (confirmBtn) {
      var newConfirm = confirmBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
      newConfirm.addEventListener('click', handleConfirm);
    }
  }


  // ── Chapter accordion ──────────────────────────────────────────────────────

  function renderChapterList(listEl, chapters) {
    listEl.innerHTML = '';
    chapters.forEach(function (chapter) {
      var row = buildChapterRow(chapter);
      listEl.appendChild(row);
    });
  }

  function buildChapterRow(chapter) {
    var row = document.createElement('div');
    row.className = 'ca-chapter-row';

    var numStr = String(chapter.number).padStart(2, '0');
    var pct    = chapter.word_count_percentage || 0;

    var ringHtml = buildProgressRing(pct);

    var contentItemsHtml = (chapter.key_content || []).map(function (point) {
      return '<li class="ca-content-item">' + escapeHtml(point) + '</li>';
    }).join('');

    row.innerHTML =
      '<div class="ca-chapter-header">' +
        '<span class="ca-chapter-num-bg" aria-hidden="true">' + escapeHtml(numStr) + '</span>' +
        '<p class="ca-chapter-title-text" data-field="title">' + escapeHtml(chapter.title) + '</p>' +
        ringHtml +
        '<svg class="ca-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="16" height="16" fill="currentColor" aria-hidden="true">' +
          '<path d="' + CHEVRON_PATH + '"></path>' +
        '</svg>' +
      '</div>' +

      '<div class="ca-chapter-body">' +
        '<div class="ca-chapter-body-inner">' +
          '<p class="ca-body-label">Core Question</p>' +
          '<p class="ca-body-text" data-field="core_question">' + escapeHtml(chapter.core_question) + '</p>' +
          '<p class="ca-body-label" style="margin-top:14px">Key Content</p>' +
          '<ul class="ca-key-content-list" data-field="key_content">' + contentItemsHtml + '</ul>' +
          '<p class="ca-word-target">' +
            '<span class="ca-word-count-val">' + (chapter.word_count_target || 0).toLocaleString() + '</span>' +
            ' words &nbsp;·&nbsp; ' +
            '<span class="ca-pct-val">' + pct + '%</span> of total' +
          '</p>' +
          '<button class="ca-btn-edit-chapter">Edit Chapter</button>' +
        '</div>' +
      '</div>';

    row._chapterData = {
      number:              chapter.number,
      title:               chapter.title,
      core_question:       chapter.core_question,
      key_content:         (chapter.key_content || []).slice(),
      word_count_target:   chapter.word_count_target,
      word_count_percentage: pct
    };

    var header = row.querySelector('.ca-chapter-header');
    var body   = row.querySelector('.ca-chapter-body');
    header.addEventListener('click', function (e) {
      if (e.target.closest('.ca-btn-edit-chapter, .ca-btn-save-chapter')) return;
      toggleAccordion(row, body);
    });

    var editBtn = row.querySelector('.ca-btn-edit-chapter');
    editBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      handleEditChapter(row, body);
    });

    return row;
  }

  function buildProgressRing(pct) {
    var radius = 18;
    var circumference = 2 * Math.PI * radius;
    var offset = circumference * (1 - pct / 100);

    return (
      '<svg class="ca-chapter-ring" width="44" height="44" viewBox="0 0 44 44" aria-label="' + pct + '% of total word count" role="img">' +
        '<circle cx="22" cy="22" r="' + radius + '" fill="none" stroke="rgba(0,0,0,0.08)" stroke-width="3.5"/>' +
        '<circle cx="22" cy="22" r="' + radius + '" fill="none" stroke="#0066FF" stroke-width="3.5"' +
          ' stroke-dasharray="' + circumference.toFixed(2) + '"' +
          ' stroke-dashoffset="' + offset.toFixed(2) + '"' +
          ' stroke-linecap="round"' +
          ' transform="rotate(-90 22 22)"/>' +
        '<text x="22" y="26" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="8" font-weight="500" fill="#0D1B2A">' + pct + '%</text>' +
      '</svg>'
    );
  }

  function toggleAccordion(row, body) {
    var isOpen = row.classList.contains('ca-chapter-row--open');

    if (isOpen) {
      body.style.maxHeight = body.scrollHeight + 'px';
      body.getBoundingClientRect();
      body.style.maxHeight = '0';
      row.classList.remove('ca-chapter-row--open');
    } else {
      body.style.maxHeight = body.scrollHeight + 'px';
      row.classList.add('ca-chapter-row--open');
    }
  }


  // ── Chapter inline editing ─────────────────────────────────────────────────

  function handleEditChapter(row, body) {
    var data = row._chapterData;
    if (!data) return;

    if (!row.classList.contains('ca-chapter-row--open')) {
      toggleAccordion(row, body);
    }

    var titleEl = row.querySelector('.ca-chapter-title-text');
    if (titleEl) {
      var titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.className = 'ca-edit-input ca-edit-title';
      titleInput.value = data.title;
      titleEl.parentNode.replaceChild(titleInput, titleEl);
    }

    var coreEl = row.querySelector('[data-field="core_question"]');
    if (coreEl) {
      var coreArea = document.createElement('textarea');
      coreArea.className = 'ca-edit-textarea';
      coreArea.rows = 3;
      coreArea.value = data.core_question;
      coreEl.parentNode.replaceChild(coreArea, coreEl);
    }

    var keyListEl = row.querySelector('[data-field="key_content"]');
    if (keyListEl) {
      keyListEl.innerHTML = '';
      data.key_content.forEach(function (point, idx) {
        var li = document.createElement('li');
        li.className = 'ca-content-item';
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'ca-edit-input';
        inp.value = point;
        inp.dataset.idx = idx;
        li.appendChild(inp);
        keyListEl.appendChild(li);
      });
    }

    var editBtn = row.querySelector('.ca-btn-edit-chapter');
    if (editBtn) {
      var saveBtn = document.createElement('button');
      saveBtn.className = 'ca-btn-save-chapter';
      saveBtn.textContent = 'Save Chapter';
      editBtn.parentNode.replaceChild(saveBtn, editBtn);
      saveBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        handleSaveChapter(row, body);
      });
    }

    body.style.maxHeight = body.scrollHeight + 'px';
  }

  function handleSaveChapter(row, body) {
    var data = row._chapterData;
    if (!data) return;

    var titleInput = row.querySelector('.ca-edit-title');
    if (titleInput) data.title = titleInput.value.trim() || data.title;

    var coreArea = row.querySelector('.ca-edit-textarea');
    if (coreArea) data.core_question = coreArea.value.trim() || data.core_question;

    var keyInputs = row.querySelectorAll('.ca-edit-input[data-idx]');
    keyInputs.forEach(function (inp) {
      var idx = parseInt(inp.dataset.idx, 10);
      if (!isNaN(idx)) data.key_content[idx] = inp.value.trim() || data.key_content[idx];
    });

    var titleInput2 = row.querySelector('.ca-edit-title');
    if (titleInput2) {
      var titlePara = document.createElement('p');
      titlePara.className = 'ca-chapter-title-text';
      titlePara.dataset.field = 'title';
      titlePara.textContent = data.title;
      titleInput2.parentNode.replaceChild(titlePara, titleInput2);
    }

    var coreArea2 = row.querySelector('.ca-edit-textarea');
    if (coreArea2) {
      var corePara = document.createElement('p');
      corePara.className = 'ca-body-text';
      corePara.dataset.field = 'core_question';
      corePara.textContent = data.core_question;
      coreArea2.parentNode.replaceChild(corePara, coreArea2);
    }

    var keyListEl = row.querySelector('[data-field="key_content"]');
    if (keyListEl) {
      keyListEl.innerHTML = '';
      data.key_content.forEach(function (point) {
        var li = document.createElement('li');
        li.className = 'ca-content-item';
        li.textContent = point;
        keyListEl.appendChild(li);
      });
    }

    var saveBtn = row.querySelector('.ca-btn-save-chapter');
    if (saveBtn) {
      var newEditBtn = document.createElement('button');
      newEditBtn.className = 'ca-btn-edit-chapter';
      newEditBtn.textContent = 'Edit Chapter';
      saveBtn.parentNode.replaceChild(newEditBtn, saveBtn);
      newEditBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        handleEditChapter(row, body);
      });
    }

    if (currentData && currentData.chapters) {
      var match = currentData.chapters.find(function (c) { return c.number === data.number; });
      if (match) {
        match.title        = data.title;
        match.core_question = data.core_question;
        match.key_content  = data.key_content.slice();
      }
    }

    body.style.maxHeight = body.scrollHeight + 'px';
  }


  // ── Regenerate handler ─────────────────────────────────────────────────────

  function handleRegenerate() {
    showSection('ca-loading-section');

    API.buildChapters(State.studentContext, currentStructure, currentWordCount)
      .then(function (data) {
        currentData = data;
        renderResult(data);
        showSection('ca-result-section');
        if (typeof window.showToast === 'function') window.showToast('Analysis complete', 'success');
        State.stepResults = State.stepResults || {};
        State.stepResults['step2'] = document.getElementById('ca-result-section').innerHTML;
        State.save();
        ensureAbstractCard();
        ensureLiteratureMapCard();
      })
      .catch(function (err) {
        showSection('ca-result-section');
        var noteEl = document.getElementById('ca-structure-note');
        if (noteEl) {
          var setNote = function (msg) { noteEl.textContent = msg; };
          if (!API.handleError(err, setNote, null)) {
            noteEl.textContent = 'Regeneration failed. Your previous structure is still displayed.';
            if (typeof window.showToast === 'function') window.showToast('Something went wrong. Try again.', 'error');
          }
        }
      });
  }


  // ── Confirm handler ────────────────────────────────────────────────────────

  function handleConfirm() {
    if (!currentData) return;

    State.chapterStructure = currentData;
    State.structureType    = currentStructure;
    State.totalWordCount   = currentWordCount;
    State.stepsCompleted[1] = true;
    State.currentStep       = 2;
    State.save();

    if (typeof window.refreshShell === 'function') {
      window.refreshShell();
    }

    if (typeof window.showToast === 'function') window.showToast('Step 3 unlocked', 'unlock');
    document.dispatchEvent(new CustomEvent('step3:init'));
  }


  // ── Abstract Generator companion card ─────────────────────────────────────

  function ensureAbstractCard() {
    if (!abstractCardInserted) {
      var scrollEl = document.querySelector('.app-content__scroll');
      if (!scrollEl) return;

      var agCard = renderAbstractCard();
      scrollEl.appendChild(agCard);
      abstractCardInserted = true;

      document.getElementById('ag-btn-generate').addEventListener('click', handleGenerateAbstract);
    } else {
      showAgSection('ag-input-section');
      var genBtn = document.getElementById('ag-btn-generate');
      if (genBtn) genBtn.disabled = false;

      var descEl = document.querySelector('#ag-input-section .ag-description');
      if (descEl) {
        descEl.style.color = '';
        descEl.textContent =
          'FYPro will draft a structured abstract scaffold for your project — five labelled ' +
          'components for you to refine. This is not a finished abstract; it is a starting ' +
          'point calibrated to your topic and chapter structure.';
      }
    }
  }

  function renderAbstractCard() {
    var card = document.createElement('div');
    card.className = 'ag-card';
    card.id = 'ag-card';

    card.innerHTML =
      '<div id="ag-input-section" class="ag-input-section tv-section--visible">' +
        '<p class="ag-step-label">Abstract Generator</p>' +
        '<span class="ag-companion-badge">Companion Card</span>' +
        '<p class="ag-description">FYPro will draft a structured abstract scaffold for your project — five labelled ' +
          'components for you to refine. This is not a finished abstract; it is a starting point ' +
          'calibrated to your topic and chapter structure.</p>' +
        '<button id="ag-btn-generate" class="ag-btn-generate">Generate Abstract</button>' +
      '</div>' +

      '<div id="ag-loading-section" class="ag-loading-section tv-section--hidden">' +
        '<div class="skeleton-loader">' +
          '<div class="skeleton-bar" style="width:100%"></div>' +
          '<div class="skeleton-bar" style="width:75%"></div>' +
          '<div class="skeleton-bar" style="width:90%"></div>' +
          '<div class="skeleton-bar" style="width:60%"></div>' +
        '</div>' +
        '<p class="tv-loading-text">Drafting your abstract scaffold…</p>' +
      '</div>' +

      '<div id="ag-result-section" class="ag-result-section tv-section--hidden">' +
        '<div class="ag-scaffold-notice">⚠ Scaffold — Not Final Abstract</div>' +
        '<div id="ag-components-list" class="ag-components-list"></div>' +
        '<button id="ag-btn-copy" class="ag-btn-copy">Copy Scaffold</button>' +
      '</div>';

    return card;
  }

  function showAgSection(sectionId) {
    var ids = ['ag-input-section', 'ag-loading-section', 'ag-result-section'];
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

  function handleGenerateAbstract() {
    var btn = document.getElementById('ag-btn-generate');
    if (btn) btn.disabled = true;

    showAgSection('ag-loading-section');

    var chapters = currentData && currentData.chapters ? currentData.chapters : [];

    API.generateAbstract(State.studentContext, chapters)
      .then(function (data) {
        showAgSection('ag-result-section');
        renderAbstractComponents(data);
        if (typeof window.showToast === 'function') window.showToast('Analysis complete', 'success');

        var copyBtn = document.getElementById('ag-btn-copy');
        if (copyBtn) {
          var newCopy = copyBtn.cloneNode(true);
          copyBtn.parentNode.replaceChild(newCopy, copyBtn);
          newCopy.addEventListener('click', function () { copyAbstractToClipboard(data); });
        }
      })
      .catch(function (err) {
        showAgSection('ag-input-section');
        var descEl = document.querySelector('#ag-input-section .ag-description');
        if (descEl) descEl.style.color = '#DC2626';
        var setDesc = function (msg) { if (descEl) descEl.textContent = msg; };
        if (!API.handleError(err, setDesc, btn)) {
          if (btn) btn.disabled = false;
          setDesc('Something went wrong generating the abstract. Please try again.');
          if (typeof window.showToast === 'function') window.showToast('Something went wrong. Try again.', 'error');
        }
      });
  }

  function renderAbstractComponents(data) {
    var listEl = document.getElementById('ag-components-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    var components = [
      { key: 'background',            label: 'Background' },
      { key: 'problem_statement',     label: 'Problem Statement' },
      { key: 'objectives',            label: 'Objectives' },
      { key: 'methodology',           label: 'Methodology' },
      { key: 'expected_contribution', label: 'Expected Contribution' }
    ];

    var els = components.map(function (comp) {
      var block = document.createElement('div');
      block.className = 'ag-component';

      var labelEl = document.createElement('p');
      labelEl.className = 'ag-component-label';
      labelEl.textContent = comp.label;

      var textEl = document.createElement('p');
      textEl.className = 'ag-component-text';
      textEl.textContent = data[comp.key] || '';

      block.appendChild(labelEl);
      block.appendChild(textEl);
      listEl.appendChild(block);
      return block;
    });

    els.forEach(function (el, idx) {
      setTimeout(function () {
        el.classList.add('ag-component--visible');
      }, idx * 350);
    });
  }

  function copyAbstractToClipboard(data) {
    var text = [
      'ABSTRACT SCAFFOLD — NOT FINAL ABSTRACT',
      '',
      'Background',
      data.background || '',
      '',
      'Problem Statement',
      data.problem_statement || '',
      '',
      'Objectives',
      data.objectives || '',
      '',
      'Methodology',
      data.methodology || '',
      '',
      'Expected Contribution',
      data.expected_contribution || ''
    ].join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(flashCopyButton)
        .catch(flashCopyButton);
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* silent fallback failure */ }
      document.body.removeChild(ta);
      flashCopyButton();
    }
  }

  function flashCopyButton() {
    var btn = document.getElementById('ag-btn-copy');
    if (!btn) return;
    btn.textContent = 'Copied to clipboard';
    btn.classList.add('ag-btn-copy--copied');
    setTimeout(function () {
      btn.textContent = 'Copy Scaffold';
      btn.classList.remove('ag-btn-copy--copied');
    }, 1800);
  }


  // ── Literature Map companion card ─────────────────────────────────────────

  function ensureLiteratureMapCard() {
    if (!litMapCardInserted) {
      var scrollEl = document.querySelector('.app-content__scroll');
      if (!scrollEl) return;

      var lmCard = renderLiteratureMapCard();
      scrollEl.appendChild(lmCard);
      litMapCardInserted = true;

      document.getElementById('lm-btn-generate').addEventListener('click', handleGenerateLiteratureMap);
    } else {
      showLmSection('lm-input-section');
      var genBtn = document.getElementById('lm-btn-generate');
      if (genBtn) genBtn.disabled = false;

      var descEl = document.querySelector('#lm-input-section .lm-description');
      if (descEl) {
        descEl.style.color = '';
        descEl.textContent =
          'FYPro will map the intellectual territory of your topic — thematic areas with ' +
          'targeted search terms, the most useful source types for your field, and a ' +
          'synthesis guide explaining how to build an argument across papers, not just summarise them.';
      }
    }
  }

  function renderLiteratureMapCard() {
    var card = document.createElement('div');
    card.className = 'lm-card';
    card.id = 'lm-card';

    card.innerHTML =
      '<div id="lm-input-section" class="lm-input-section tv-section--visible">' +
        '<p class="lm-step-label">Literature Map</p>' +
        '<span class="lm-companion-badge">Companion Card</span>' +
        '<p class="lm-description">FYPro will map the intellectual territory of your topic — thematic areas with ' +
          'targeted search terms, the most useful source types for your field, and a ' +
          'synthesis guide explaining how to build an argument across papers, not just summarise them.</p>' +
        '<button id="lm-btn-generate" class="lm-btn-generate">Generate Literature Map</button>' +
      '</div>' +

      '<div id="lm-loading-section" class="lm-loading-section tv-section--hidden">' +
        '<div class="skeleton-loader">' +
          '<div class="skeleton-bar" style="width:100%"></div>' +
          '<div class="skeleton-bar" style="width:75%"></div>' +
          '<div class="skeleton-bar" style="width:90%"></div>' +
          '<div class="skeleton-bar" style="width:60%"></div>' +
        '</div>' +
        '<p class="tv-loading-text">Mapping your literature…</p>' +
      '</div>' +

      '<div id="lm-result-section" class="lm-result-section tv-section--hidden">' +
        '<p class="lm-section-heading">Thematic Areas</p>' +
        '<div id="lm-themes-list" class="lm-themes-list"></div>' +
        '<p class="lm-section-heading lm-section-heading--spaced">Recommended Sources</p>' +
        '<div id="lm-sources-list" class="lm-sources-list"></div>' +
        '<p class="lm-section-heading lm-section-heading--spaced">Synthesis Guide</p>' +
        '<div id="lm-synthesis-block" class="lm-synthesis-block"></div>' +
        '<button id="lm-btn-copy" class="lm-btn-copy">Copy Literature Map</button>' +
      '</div>';

    return card;
  }

  function showLmSection(sectionId) {
    var ids = ['lm-input-section', 'lm-loading-section', 'lm-result-section'];
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

  function handleGenerateLiteratureMap() {
    var btn = document.getElementById('lm-btn-generate');
    if (btn) btn.disabled = true;

    showLmSection('lm-loading-section');

    var chapters = currentData && currentData.chapters ? currentData.chapters : [];

    API.generateLiteratureMap(State.studentContext, chapters)
      .then(function (data) {
        showLmSection('lm-result-section');
        renderLiteratureMapResult(data);
        if (typeof window.showToast === 'function') window.showToast('Analysis complete', 'success');

        var copyBtn = document.getElementById('lm-btn-copy');
        if (copyBtn) {
          var newCopy = copyBtn.cloneNode(true);
          copyBtn.parentNode.replaceChild(newCopy, copyBtn);
          newCopy.addEventListener('click', function () { copyLiteratureMapToClipboard(data); });
        }
      })
      .catch(function (err) {
        showLmSection('lm-input-section');
        var descEl = document.querySelector('#lm-input-section .lm-description');
        if (descEl) descEl.style.color = '#DC2626';
        var setDesc = function (msg) { if (descEl) descEl.textContent = msg; };
        if (!API.handleError(err, setDesc, btn)) {
          if (btn) btn.disabled = false;
          setDesc('Something went wrong generating the literature map. Please try again.');
          if (typeof window.showToast === 'function') window.showToast('Something went wrong. Try again.', 'error');
        }
      });
  }

  function renderLiteratureMapResult(data) {
    var themesEl = document.getElementById('lm-themes-list');
    if (themesEl) {
      themesEl.innerHTML = '';
      (data.thematic_areas || []).forEach(function (area, idx) {
        var card = buildThemeCard(area, idx);
        themesEl.appendChild(card);
      });
    }

    var sourcesEl = document.getElementById('lm-sources-list');
    if (sourcesEl) {
      sourcesEl.innerHTML = '';
      (data.source_types || []).forEach(function (st) {
        var row = buildSourceTypeRow(st);
        sourcesEl.appendChild(row);
      });
    }

    var synthEl = document.getElementById('lm-synthesis-block');
    if (synthEl) {
      synthEl.innerHTML = '<p class="lm-synthesis-text">' + escapeHtml(data.synthesis_guide || '') + '</p>';
    }
  }

  function buildThemeCard(area, idx) {
    var card = document.createElement('div');
    card.className = 'lm-theme-card';

    var numStr = String(idx + 1).padStart(2, '0');

    var chipsHtml = (area.search_terms || []).map(function (term) {
      return (
        '<button class="lm-search-chip" title="Click to copy" data-term="' + escapeHtml(term) + '">' +
          escapeHtml(term) +
          '<span class="lm-chip-icon" aria-hidden="true">&#x2398;</span>' +
        '</button>'
      );
    }).join('');

    card.innerHTML =
      '<span class="lm-theme-num-bg" aria-hidden="true">' + escapeHtml(numStr) + '</span>' +
      '<p class="lm-theme-name">' + escapeHtml(area.theme || '') + '</p>' +
      '<div class="lm-chips">' + chipsHtml + '</div>';

    card.querySelectorAll('.lm-search-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var term = chip.dataset.term || chip.textContent.trim();
        copyTermToClipboard(term, chip);
      });
    });

    return card;
  }

  function buildSourceTypeRow(st) {
    var row = document.createElement('div');
    row.className = 'lm-source-row';

    row.innerHTML =
      '<p class="lm-source-type">' + escapeHtml(st.type || '') + '</p>' +
      '<p class="lm-source-rationale">' + escapeHtml(st.rationale || '') + '</p>' +
      '<p class="lm-source-access"><span class="lm-access-label">Access:</span> ' + escapeHtml(st.access || '') + '</p>';

    return row;
  }

  function copyTermToClipboard(term, chip) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(term)
        .then(function () { flashChip(chip); })
        .catch(function () { flashChip(chip); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = term;
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* silent fallback failure */ }
      document.body.removeChild(ta);
      flashChip(chip);
    }
  }

  function flashChip(chip) {
    chip.classList.add('lm-search-chip--copied');
    setTimeout(function () {
      chip.classList.remove('lm-search-chip--copied');
    }, 1400);
  }

  function copyLiteratureMapToClipboard(data) {
    var lines = ['LITERATURE MAP', ''];

    lines.push('THEMATIC AREAS');
    (data.thematic_areas || []).forEach(function (area, idx) {
      lines.push('');
      lines.push((idx + 1) + '. ' + (area.theme || ''));
      (area.search_terms || []).forEach(function (term) {
        lines.push('   • ' + term);
      });
    });

    lines.push('');
    lines.push('RECOMMENDED SOURCES');
    (data.source_types || []).forEach(function (st) {
      lines.push('');
      lines.push((st.type || '') + ' — ' + (st.rationale || ''));
      lines.push('Access: ' + (st.access || ''));
    });

    lines.push('');
    lines.push('SYNTHESIS GUIDE');
    lines.push(data.synthesis_guide || '');

    var text = lines.join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(flashLmCopyButton)
        .catch(flashLmCopyButton);
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* silent fallback failure */ }
      document.body.removeChild(ta);
      flashLmCopyButton();
    }
  }

  function flashLmCopyButton() {
    var btn = document.getElementById('lm-btn-copy');
    if (!btn) return;
    btn.textContent = 'Copied to clipboard';
    btn.classList.add('lm-btn-copy--copied');
    setTimeout(function () {
      btn.textContent = 'Copy Literature Map';
      btn.classList.remove('lm-btn-copy--copied');
    }, 1800);
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
