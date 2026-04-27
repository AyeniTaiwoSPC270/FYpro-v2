// FYPro — Premium Visual Enhancements
// Card spotlight, animated loading dots, back-arrow wrap, resume card class,
// toast notifications, progress bar, keyboard hints, step transitions, Enter key

(function () {
  'use strict';

  /* ── Toast System ────────────────────────────────────────── */
  var toastContainer = null;

  function getToastContainer() {
    if (!toastContainer || !document.getElementById('fy-toast-container')) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'fy-toast-container';
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  window.showToast = function (message, type) {
    var container = getToastContainer();
    var toast = document.createElement('div');
    toast.className = 'fy-toast fy-toast--' + (type || 'success');

    var icons = { success: '✓', error: '⚠', unlock: '→' };
    var icon = icons[type] || '✓';

    toast.innerHTML =
      '<span class="fy-toast-icon">' + icon + '</span>' +
      '<span>' + message + '</span>';
    container.appendChild(toast);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        toast.classList.add('fy-toast--visible');
      });
    });

    setTimeout(function () {
      toast.classList.remove('fy-toast--visible');
      toast.classList.add('fy-toast--leaving');
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 320);
    }, 3000);
  };

  /* ── Progress Bar System ─────────────────────────────────── */
  window.fy = window.fy || {};

  function injectProgressBar(card) {
    if (card.querySelector('.fy-progress-bar-wrap')) return;
    var wrap = document.createElement('div');
    wrap.className = 'fy-progress-bar-wrap';
    var bar = document.createElement('div');
    bar.className = 'fy-progress-bar';
    wrap.appendChild(bar);
    card.insertBefore(wrap, card.firstChild);
  }

  window.fy.startProgress = function (cardEl) {
    if (!cardEl) return;
    var wrap = cardEl.querySelector('.fy-progress-bar-wrap');
    var bar = wrap && wrap.querySelector('.fy-progress-bar');
    if (!wrap || !bar) return;
    bar.style.transition = 'none';
    bar.style.width = '0%';
    bar.classList.remove('is-filling', 'is-complete');
    wrap.classList.add('is-active');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        bar.style.transition = '';
        bar.classList.add('is-filling');
      });
    });
  };

  window.fy.completeProgress = function (cardEl) {
    if (!cardEl) return;
    var wrap = cardEl.querySelector('.fy-progress-bar-wrap');
    var bar = wrap && wrap.querySelector('.fy-progress-bar');
    if (!wrap || !bar) return;
    bar.classList.remove('is-filling');
    bar.classList.add('is-complete');
    setTimeout(function () {
      wrap.classList.remove('is-active');
      setTimeout(function () {
        bar.classList.remove('is-complete');
        bar.style.transition = 'none';
        bar.style.width = '0%';
      }, 200);
    }, 350);
  };

  /* ── Keyboard Shortcut Hints ─────────────────────────────── */
  var PRIMARY_BTN_SELECTORS = [
    '.tv-btn-validate', '.ca-btn-generate', '.ma-btn-analyse',
    '.di-btn-generate', '.wp-btn-generate', '.dp-btn-start-scan'
  ];

  function attachKbdHint(btn) {
    if (btn.dataset.fxKbd) return;
    btn.dataset.fxKbd = '1';
    var hint = document.createElement('span');
    hint.className = 'fy-kbd-hint';
    hint.textContent = '↵ Enter';
    var wrap = document.createElement('span');
    wrap.className = 'fy-kbd-hint-wrap';
    btn.parentNode.insertBefore(wrap, btn);
    wrap.appendChild(btn);
    wrap.appendChild(hint);
  }

  function scanPrimaryButtons() {
    PRIMARY_BTN_SELECTORS.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (btn) {
        if (!btn.dataset.fxKbd) attachKbdHint(btn);
      });
    });
  }

  /* ── Enter Key → Primary Action ──────────────────────────── */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var tag = e.target && e.target.tagName;
    if (tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A' || tag === 'SELECT') return;
    var found = null;
    PRIMARY_BTN_SELECTORS.forEach(function (sel) {
      if (found) return;
      var btn = document.querySelector(sel);
      if (btn && !btn.disabled) found = btn;
    });
    if (found) {
      e.preventDefault();
      found.click();
    }
  });

  /* ── Step Transition Animation ───────────────────────────── */
  var STEP_CARD_NAMES = ['tv-card', 'ca-card', 'ma-card', 'di-card', 'wp-card', 'dp-card', 'se-card'];

  function attachStepTransition(card) {
    if (card.dataset.fxTransition) return;
    card.dataset.fxTransition = '1';
    var dir = window._fyNavDir || 'forward';
    var cls = dir === 'back' ? 'fy-step-enter-back' : 'fy-step-enter-forward';
    card.classList.add(cls);
    card.addEventListener('animationend', function () {
      card.classList.remove(cls);
    }, { once: true });
  }

  function scanStepCards() {
    STEP_CARD_NAMES.forEach(function (name) {
      document.querySelectorAll('.' + name).forEach(function (card) {
        if (!card.dataset.fxTransition) attachStepTransition(card);
        injectProgressBar(card);
      });
    });
  }

  /* ── Card Spotlight ──────────────────────────────────────── */
  var CARD_SELECTOR = '.tv-card, .ca-card, .ma-card, .di-card, .wp-card, .dp-card, .se-card';

  function attachSpotlight(card) {
    if (card.dataset.fxSpotlight) return;
    card.dataset.fxSpotlight = '1';

    var layer = document.createElement('div');
    layer.className = 'fx-spotlight-layer';
    card.insertBefore(layer, card.firstChild);

    card.addEventListener('mousemove', function (e) {
      var rect = card.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      layer.style.background =
        'radial-gradient(320px circle at ' + x + 'px ' + y + 'px, ' +
        'rgba(37,99,235,0.06) 0%, transparent 70%)';
      layer.classList.add('is-active');
    });

    card.addEventListener('mouseleave', function () {
      layer.classList.remove('is-active');
      layer.style.background = '';
    });
  }

  function scanCards() {
    document.querySelectorAll(CARD_SELECTOR).forEach(attachSpotlight);
  }

  /* ── Animated Loading Dots ───────────────────────────────── */
  function enhanceLoadingEl(el) {
    if (el.dataset.fxDots) return;
    el.dataset.fxDots = '1';
    var text = el.textContent.replace(/[.…]+$/, '').trimEnd();
    el.textContent = text;
    ['fx-dot-1', 'fx-dot-2', 'fx-dot-3'].forEach(function (cls) {
      var s = document.createElement('span');
      s.className = 'fx-dot ' + cls;
      s.textContent = '.';
      el.appendChild(s);
    });
  }

  function scanLoadingTexts() {
    document.querySelectorAll('.tv-loading-text, .dp-verdict-loading-text')
      .forEach(enhanceLoadingEl);
  }

  /* ── Back Button Arrow Wrap ──────────────────────────────── */
  function wrapBackArrows() {
    document.querySelectorAll('.fy-back-btn').forEach(function (btn) {
      if (btn.dataset.fxArrow) return;
      btn.dataset.fxArrow = '1';
      var html = btn.innerHTML;
      // Wrap any leading ← character in a span
      btn.innerHTML = html.replace(/^(\s*←)/, '<span class="fy-back-arrow">$1</span>');
    });
  }

  /* ── Session Restore Card ────────────────────────────────── */
  function enhanceResumeCard() {
    var scroll = document.querySelector('.app-content__scroll');
    if (!scroll) return;
    var first = scroll.firstElementChild;
    if (!first || first.dataset.fxResume) return;
    // Identify by inline style borderRadius — unique to the resume card
    if (first.style && first.style.borderRadius === '16px' && !first.className) {
      first.dataset.fxResume = '1';
      first.classList.add('fx-resume-card');
      // Also enhance its button
      var btn = first.querySelector('button');
      if (btn) btn.classList.add('fx-resume-btn');
    }
  }

  /* ── MutationObserver — watch for DOM changes ────────────── */
  var observer = new MutationObserver(function () {
    scanCards();
    scanLoadingTexts();
    wrapBackArrows();
    enhanceResumeCard();
    scanPrimaryButtons();
    scanStepCards();
  });

  document.addEventListener('DOMContentLoaded', function () {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    // Initial pass
    scanCards();
    scanLoadingTexts();
    wrapBackArrows();
    enhanceResumeCard();
    scanPrimaryButtons();
    scanStepCards();
  });

})();
