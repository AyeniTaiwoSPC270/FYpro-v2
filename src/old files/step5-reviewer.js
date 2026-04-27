// FYPro — Step 5: Project Reviewer
// Handles all UI and logic for the Project Reviewer card.
//
// The student uploads their full project or a single chapter as PDF, Word (.docx),
// or plain text (.txt). FYPro extracts the content and calls the Claude API to
// produce:
//   • An overall grade (Distinction / Merit / Pass / Fail)
//   • 3 specific strengths from the actual uploaded content
//   • 3 specific weaknesses, each with a one-sentence actionable fix
//   • 5 examiner questions generated directly from the real content
//
// On completion, the review is saved to State.uploadedProject so the Defence Prep
// (Step 6) can auto-detect it and use the real document content — not just the
// topic and methodology metadata — to generate examiner questions.
//
// Activated by the 'step5:init' custom event fired from step4.js (Writing Planner)
// after the student confirms their writing plan.

(function () {

  // Upload SVG icon — document with upward arrow
  var UPLOAD_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="44" height="44" fill="currentColor" aria-hidden="true"><path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Zm-42.34-77.66a8,8,0,0,1-11.32,11.32L136,139.31V184a8,8,0,0,1-16,0V139.31l-10.34,10.35a8,8,0,0,1-11.32-11.32l24-24a8,8,0,0,1,11.32,0Z"></path></svg>';

  // Module-scope state — reset on every init
  var selectedFile    = null;    // The File object chosen by the student
  var isProcessing    = false;   // Guard against double-submission

  // Listen for 'step5:init' dispatched by step4.js (Writing Planner) after the
  // student confirms their writing plan. { once: true } removed so the step can
  // be re-entered after back navigation without a page reload.
  document.addEventListener('step5:init', function () {
    initStep5Reviewer();
  });

  // Register initStep5Reviewer for direct invocation by navigateToStep() on back navigation.
  window._fyInits = window._fyInits || {};
  window._fyInits[5] = initStep5Reviewer;


  // ── Entry point ────────────────────────────────────────────────────────────

  function initStep5Reviewer() {
    if (State.currentStep !== 4) return;

    var scrollEl = document.querySelector('.app-content__scroll');
    if (!scrollEl) return;

    selectedFile  = null;
    isProcessing  = false;

    var card = renderReviewerCard();
    scrollEl.innerHTML = '';
    scrollEl.appendChild(card);

    // Restore saved result if this step was previously completed
    if (State.uploadedProject && State.uploadedProject.reviewData) {
      renderResults(State.uploadedProject.reviewData);
      showSection('pr-result-section');
      var confirmBtn = document.getElementById('pr-btn-confirm');
      if (confirmBtn) confirmBtn.addEventListener('click', handleConfirm);
      return;
    }

    wireUploadArea();

    var backBtn = document.getElementById('btn-back-step5');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        window.navigateToStep(3);
      });
    }
  }


  // ── Card builder ───────────────────────────────────────────────────────────

  function renderReviewerCard() {
    var card = document.createElement('div');
    card.className = 'pr-card';
    card.id = 'pr-card';

    card.innerHTML =

      '<span class="pr-watermark" aria-hidden="true">5</span>' +

      // ── Input Section ──────────────────────────────────────
      '<div id="pr-input-section" class="pr-input-section tv-section--visible">' +

        '<button id="btn-back-step5" class="fy-back-btn">← Back to Writing Planner</button>' +
        '<p class="pr-step-label">Step 5: Project Reviewer</p>' +
        '<p class="pr-description">Upload your full project or a single chapter. FYPro will grade it, identify 3 strengths and 3 weaknesses specific to your content, and generate the 5 most dangerous examiner questions from your actual work.</p>' +

        '<div id="pr-upload-zone" class="pr-upload-zone" tabindex="0" role="button" aria-label="Click to upload your project file">' +
          '<div class="pr-upload-icon">' + UPLOAD_SVG + '</div>' +
          '<p class="pr-upload-primary">Drop your file here or <span class="pr-upload-link">click to browse</span></p>' +
          '<p class="pr-upload-formats">PDF &middot; Word (.docx) &middot; Plain text (.txt) &middot; Max 4 MB</p>' +
          '<input id="pr-file-input" type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" class="pr-file-hidden" aria-hidden="true" />' +
        '</div>' +

        '<div id="pr-file-chip" class="pr-file-chip tv-section--hidden">' +
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="16" height="16" fill="currentColor" class="pr-chip-icon" aria-hidden="true"><path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Z"></path></svg>' +
          '<span id="pr-file-name" class="pr-file-name-text"></span>' +
          '<button id="pr-btn-remove" class="pr-btn-remove" aria-label="Remove file">&times;</button>' +
        '</div>' +

        '<p id="pr-error-text" class="pr-error-text tv-section--hidden"></p>' +
        '<button id="pr-btn-review" class="pr-btn-review" disabled>Review My Project</button>' +

      '</div>' +

      // ── Loading Section ────────────────────────────────────
      '<div id="pr-loading-section" class="pr-loading-section tv-section--hidden">' +
        '<div class="skeleton-loader">' +
          '<div class="skeleton-bar" style="width:100%"></div>' +
          '<div class="skeleton-bar" style="width:75%"></div>' +
          '<div class="skeleton-bar" style="width:90%"></div>' +
          '<div class="skeleton-bar" style="width:60%"></div>' +
        '</div>' +
        '<p class="tv-loading-text">Reviewing your project…</p>' +
        '<p class="pr-loading-subtext">FYPro is reading your content and assessing academic quality</p>' +
      '</div>' +

      // ── Result Section ─────────────────────────────────────
      '<div id="pr-result-section" class="pr-result-section tv-section--hidden">' +

        '<div id="pr-grade-block" class="pr-grade-block"></div>' +

        '<div class="pr-feedback-block">' +
          '<p class="pr-feedback-heading pr-feedback-heading--strength">Strengths</p>' +
          '<div id="pr-strengths-list" class="pr-feedback-list"></div>' +
        '</div>' +

        '<div class="pr-feedback-block">' +
          '<p class="pr-feedback-heading pr-feedback-heading--weakness">Weaknesses &amp; Gaps</p>' +
          '<div id="pr-weaknesses-list" class="pr-feedback-list"></div>' +
        '</div>' +

        '<div class="pr-feedback-block">' +
          '<p class="pr-feedback-heading pr-feedback-heading--questions">5 Examiner Questions From Your Content</p>' +
          '<p class="pr-questions-context">These questions were generated from what you actually wrote. Prepare answers before entering Defence Prep.</p>' +
          '<div id="pr-questions-list" class="pr-questions-list"></div>' +
        '</div>' +

        '<button id="pr-btn-confirm" class="pr-btn-confirm">Continue to Defence Prep</button>' +

      '</div>';

    return card;
  }


  // ── Section visibility ─────────────────────────────────────────────────────

  function showSection(sectionId) {
    var ids = ['pr-input-section', 'pr-loading-section', 'pr-result-section'];
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


  // ── Error helpers ──────────────────────────────────────────────────────────

  function showError(msg) {
    var el = document.getElementById('pr-error-text');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('tv-section--hidden');
    el.classList.add('tv-section--visible');
  }

  function hideError() {
    var el = document.getElementById('pr-error-text');
    if (!el) return;
    el.classList.remove('tv-section--visible');
    el.classList.add('tv-section--hidden');
  }


  // ── Upload area wiring ─────────────────────────────────────────────────────

  function wireUploadArea() {
    var zone      = document.getElementById('pr-upload-zone');
    var fileInput = document.getElementById('pr-file-input');
    var removeBtn = document.getElementById('pr-btn-remove');
    var reviewBtn = document.getElementById('pr-btn-review');

    if (!zone || !fileInput || !reviewBtn) return;

    zone.addEventListener('click', function () {
      fileInput.click();
    });

    zone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    zone.addEventListener('dragover', function (e) {
      e.preventDefault();
      zone.classList.add('pr-upload-zone--drag');
    });
    zone.addEventListener('dragleave', function () {
      zone.classList.remove('pr-upload-zone--drag');
    });
    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.classList.remove('pr-upload-zone--drag');
      var files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length > 0) handleFileSelect(files[0]);
    });

    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files.length > 0) {
        handleFileSelect(fileInput.files[0]);
      }
    });

    if (removeBtn) {
      removeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        clearFileSelection();
      });
    }

    reviewBtn.addEventListener('click', handleReview);
  }

  function handleFileSelect(file) {
    hideError();

    var name = file.name || '';
    var ext  = name.split('.').pop().toLowerCase();
    var allowed = ['pdf', 'docx', 'txt'];
    if (allowed.indexOf(ext) === -1) {
      showError('Unsupported file type. Please upload a PDF, Word (.docx), or plain text (.txt) file.');
      return;
    }

    var MAX_BYTES = 4 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      showError('File is too large (' + (file.size / 1024 / 1024).toFixed(1) + ' MB). Please upload a file under 4 MB, or paste your content as a .txt file.');
      return;
    }

    selectedFile = file;

    var chip     = document.getElementById('pr-file-chip');
    var nameSpan = document.getElementById('pr-file-name');
    if (chip && nameSpan) {
      nameSpan.textContent = escapeHtml(name);
      chip.classList.remove('tv-section--hidden');
      chip.classList.add('tv-section--visible');
    }

    var reviewBtn = document.getElementById('pr-btn-review');
    if (reviewBtn) reviewBtn.disabled = false;
  }

  function clearFileSelection() {
    selectedFile = null;

    var chip      = document.getElementById('pr-file-chip');
    var fileInput = document.getElementById('pr-file-input');
    var reviewBtn = document.getElementById('pr-btn-review');

    if (chip) {
      chip.classList.remove('tv-section--visible');
      chip.classList.add('tv-section--hidden');
    }
    if (fileInput) fileInput.value = '';
    if (reviewBtn) reviewBtn.disabled = true;

    hideError();
  }


  // ── File extraction ────────────────────────────────────────────────────────

  function extractTextFromFile(file, callback) {
    var ext = (file.name || '').split('.').pop().toLowerCase();

    if (ext === 'pdf') {
      extractPDF(file, callback);
    } else if (ext === 'docx') {
      extractDOCX(file, callback);
    } else {
      extractTXT(file, callback);
    }
  }

  function extractTXT(file, callback) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var content = e.target.result || '';
      if (content.trim().length < 20) {
        callback(new Error('The text file appears to be empty or too short to review.'));
        return;
      }
      callback(null, { text: content });
    };
    reader.onerror = function () {
      callback(new Error('Could not read the text file. Please try again.'));
    };
    reader.readAsText(file);
  }

  function extractPDF(file, callback) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var dataUrl = e.target.result || '';
      var commaIdx = dataUrl.indexOf(',');
      if (commaIdx === -1) {
        callback(new Error('Could not encode the PDF file. Please try again.'));
        return;
      }
      var base64 = dataUrl.slice(commaIdx + 1);
      if (!base64) {
        callback(new Error('PDF appears to be empty. Please try a different file.'));
        return;
      }
      callback(null, { pdf: base64 });
    };
    reader.onerror = function () {
      callback(new Error('Could not read the PDF file. Please try again.'));
    };
    reader.readAsDataURL(file);
  }

  function extractDOCX(file, callback) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var buffer = e.target.result;

      var bytes = new Uint8Array(buffer);
      var rawText = '';
      try {
        rawText = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      } catch (decodeErr) {
        for (var i = 0; i < Math.min(bytes.length, 200000); i++) {
          rawText += String.fromCharCode(bytes[i]);
        }
      }

      var wTMatches = rawText.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
      var extracted = wTMatches.map(function (m) {
        return m.replace(/<[^>]+>/g, '');
      }).filter(function (s) {
        return s.trim().length > 0;
      }).join(' ');

      if (extracted.length >= 100) {
        callback(null, { text: extracted });
        return;
      }

      var stripped = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      var printable = stripped.replace(/[^\x20-\x7E -ɏ\n]/g, ' ').replace(/\s+/g, ' ').trim();

      if (printable.length >= 100) {
        callback(null, { text: '[Extracted from Word file — some formatting may be missing]\n\n' + printable });
        return;
      }

      callback(new Error(
        'Could not extract text from this Word file (it may be compressed). ' +
        'Please save it as a PDF or .txt file and upload again.'
      ));
    };

    reader.onerror = function () {
      callback(new Error('Could not read the Word file. Please try again.'));
    };

    reader.readAsArrayBuffer(file);
  }


  // ── Review handler ─────────────────────────────────────────────────────────

  function handleReview() {
    if (isProcessing || !selectedFile) return;
    isProcessing = true;
    hideError();

    var reviewBtn = document.getElementById('pr-btn-review');
    if (reviewBtn) reviewBtn.disabled = true;
    showSection('pr-loading-section');

    extractTextFromFile(selectedFile, function (err, result) {
      if (err) {
        isProcessing = false;
        showSection('pr-input-section');
        if (reviewBtn) reviewBtn.disabled = false;
        showError(err.message);
        return;
      }

      var apiCall;
      if (result.pdf) {
        apiCall = API.reviewProjectPDF(State.studentContext, result.pdf);
      } else {
        apiCall = API.reviewProject(State.studentContext, result.text);
      }

      apiCall
        .then(function (data) {
          isProcessing = false;
          onReviewComplete(data);
          if (typeof window.showToast === 'function') window.showToast('Analysis complete', 'success');
        })
        .catch(function (apiErr) {
          isProcessing = false;
          showSection('pr-input-section');
          if (!API.handleError(apiErr, showError, reviewBtn)) {
            if (reviewBtn) reviewBtn.disabled = false;
            showError('Something went wrong during the review. Please try again.');
            if (typeof window.showToast === 'function') window.showToast('Something went wrong. Try again.', 'error');
          }
        });
    });
  }

  function onReviewComplete(data) {
    if (!data || !data.grade || !data.strengths || !data.weaknesses || !data.examiner_questions) {
      showSection('pr-input-section');
      showError('The review returned an unexpected format. Please try again.');
      return;
    }

    State.uploadedProject = {
      fileName:   selectedFile ? selectedFile.name : 'uploaded-project',
      fileType:   selectedFile ? (selectedFile.name || '').split('.').pop().toLowerCase() : 'unknown',
      reviewData: data
    };
    State.save();

    renderResults(data);
    showSection('pr-result-section');
    State.stepResults = State.stepResults || {};
    State.stepResults['step5'] = document.getElementById('pr-result-section').innerHTML;
    State.save();

    var confirmBtn = document.getElementById('pr-btn-confirm');
    if (confirmBtn) confirmBtn.addEventListener('click', handleConfirm);
  }


  // ── Result rendering ───────────────────────────────────────────────────────

  function renderResults(data) {
    renderGradeBlock(data);
    renderFeedbackList('pr-strengths-list',  data.strengths,          'strength');
    renderFeedbackList('pr-weaknesses-list', data.weaknesses,         'weakness');
    renderQuestionsList('pr-questions-list', data.examiner_questions);
  }

  function renderGradeBlock(data) {
    var el = document.getElementById('pr-grade-block');
    if (!el) return;

    var grade       = escapeHtml(data.grade || 'Unknown');
    var rawScore    = escapeHtml(data.score_estimate || '');
    var score       = rawScore.replace(/\s*[—-]\s*\S+\s*$/, '');
    var justifyText = escapeHtml(data.grade_justification || '');
    var gradeSlug   = (data.grade || '').toLowerCase();

    el.innerHTML =
      '<div class="pr-grade-badge" data-grade="' + gradeSlug + '">' +
        '<span class="pr-grade-label">' + grade + (score ? ' — ' + score : '') + '</span>' +
      '</div>' +
      (justifyText
        ? '<p class="pr-grade-justification">' + justifyText + '</p>'
        : '');
  }

  function renderFeedbackList(containerId, items, type) {
    var container = document.getElementById(containerId);
    if (!container || !items) return;
    container.innerHTML = '';

    items.forEach(function (item, idx) {
      var itemEl = document.createElement('div');
      itemEl.className = 'pr-feedback-item pr-feedback-item--' + type;

      var titleHtml  = '<p class="pr-feedback-title">' + escapeHtml(item.title  || '') + '</p>';
      var detailHtml = '<p class="pr-feedback-detail">' + escapeHtml(item.detail || '') + '</p>';
      var fixHtml    = '';

      if (type === 'weakness' && item.fix) {
        fixHtml = '<p class="pr-feedback-fix"><span class="pr-fix-label">Fix:</span> ' + escapeHtml(item.fix) + '</p>';
      }

      itemEl.innerHTML = titleHtml + detailHtml + fixHtml;
      container.appendChild(itemEl);

      setTimeout(function () {
        itemEl.classList.add('pr-feedback-item--visible');
      }, idx * 80);
    });
  }

  function renderQuestionsList(containerId, questions) {
    var container = document.getElementById(containerId);
    if (!container || !questions) return;
    container.innerHTML = '';

    questions.forEach(function (q, idx) {
      var itemEl = document.createElement('div');
      itemEl.className = 'pr-question-item';

      itemEl.innerHTML =
        '<div class="pr-question-number">' + escapeHtml(String(q.number || (idx + 1))) + '</div>' +
        '<div class="pr-question-body">' +
          '<p class="pr-question-text">' + escapeHtml(q.question || '') + '</p>' +
          (q.target
            ? '<p class="pr-question-target"><span class="pr-target-label">Target:</span> ' + escapeHtml(q.target) + '</p>'
            : '') +
        '</div>';

      container.appendChild(itemEl);

      setTimeout(function () {
        itemEl.classList.add('pr-question-item--visible');
      }, idx * 100);
    });
  }


  // ── Confirm handler ────────────────────────────────────────────────────────

  function handleConfirm() {
    State.stepsCompleted[4] = true;
    State.currentStep       = 5;
    State.save();

    if (typeof window.refreshShell === 'function') {
      window.refreshShell();
    }

    if (typeof window.showToast === 'function') window.showToast('Step 6 unlocked', 'unlock');
    document.dispatchEvent(new CustomEvent('step6:init'));
  }


  // ── Utility ────────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
