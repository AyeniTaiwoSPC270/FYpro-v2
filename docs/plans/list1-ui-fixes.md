# Plan: List 1 UI/Accessibility Bug Fixes

## Global Constraints
- Stack: React (Vite), Tailwind, custom CSS in src/styles/
- CSS variables ONLY — never hardcode hex values in CSS
- Never mix step CSS prefixes (tv-, ca-, ma-, di-, wp-, dp-, se-)
- All new CSS appends to the relevant existing file — no new CSS files except landing.css for Task 7
- index.css imports CSS files with @import — must stay as CSS @imports (Tailwind v3 constraint)
- No new npm packages
- Run: npm run typecheck && npm test after every task — both must pass

## Baseline commit: 27164bd970a627c2deeccdda0aa527b022b5052c

## Task 1: Add prefers-reduced-motion global guard
File: src/styles/base.css
After the `*, *::before, *::after` reset block, add:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```
Nothing else to change.

## Task 2: Fix secondary text contrast failures on white cards
Files: src/styles/steps-core.css, src/styles/defense.css, src/styles/instrument-builder.css
Find every instance of `rgba(13,27,42,0.5)` used as a text color and change to `rgba(13,27,42,0.65)`.
Also change `rgba(13,27,42,0.45)` text to `rgba(13,27,42,0.60)`.
Also change `rgba(13,27,42,0.4)` label text (uppercase labels, tiny labels) to `rgba(13,27,42,0.55)`.
Target classes: .tv-description, .ca-description, .ma-description, .ca-structure-note,
.tv-refined-explanation, .tv-alt-explanation, .ma-trade-offs, .ca-toggle-hint,
.ca-toggle-btn (inactive color), .tv-papers-heading, .tv-refined-label, .ca-form-label,
.ca-body-label, .ma-section-label, .ca-word-target, .ma-defense-hint, dp- descriptions.
Do NOT change border colors or background rgba values — only text color properties.

## Task 3: Fix sidebar topic text and locked step contrast
File: src/styles/base.css
1. Change .context-card__item--topic color from rgba(255,255,255,0.4) to rgba(255,255,255,0.55)
2. Change .step-list__item--locked opacity from 0.35 to 0.55
3. Add cursor: not-allowed to .step-list__item--locked

## Task 4: Replace #7ab8ff hover text on white surfaces
Files: src/styles/steps-core.css
Find every `color: #7ab8ff` that is a hover text color on a white/light background and replace with `color: var(--color-blue-primary)`.
Affected: .tv-btn-edit:hover, .ca-btn-regenerate:hover, .tv-btn-use-alt:hover, .ca-btn-edit-chapter:hover, .ca-btn-save-chapter:hover (if applicable), .ma-recommended-tag.
Note: #7ab8ff is fine on DARK backgrounds (e.g. inside sidebar dark navy). Only replace instances where the parent background is white or light.
The .ma-recommended-tag uses color: #7ab8ff on background: rgba(0,102,255,0.1) which is a light tint — replace with color: var(--color-blue-primary).

## Task 5: Add focus-visible to all buttons and cursor-pointer to step list items
Files: src/styles/design-system.css, src/styles/base.css

In design-system.css, add after the :root block:
```css
button:focus-visible,
[role="button"]:focus-visible,
a:focus-visible,
select:focus-visible,
textarea:focus-visible,
input:focus-visible {
  outline: 2px solid var(--color-blue-primary);
  outline-offset: 2px;
}
```

In base.css, add to the step list item rules:
```css
.step-list__item--current,
.step-list__item--completed { cursor: pointer; }
```
(cursor: not-allowed for locked is handled in Task 3)

## Task 6: Replace emoji push notification icon with SVG
Find the JSX that renders the push notification card (search TopicValidator.jsx or features/topicValidator/).
The .tv-push-card__icon div currently contains an emoji.
Replace with an inline SVG bell icon (24x24, aria-hidden="true").
Also update .tv-push-card__icon in steps-core.css: remove font-size, add display:flex, align-items:center, justify-content:center, width:24px, height:24px.

Bell SVG path to use:
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
</svg>
Set color via CSS: .tv-push-card__icon { color: var(--color-blue-primary); }

## Task 7: Fix LandingPage.jsx — emoji stars, inline style tag, hardcoded hex
File: src/pages/LandingPage.jsx, src/styles/landing.css (new file), src/index.css

(a) Create a StarIcon component at the top of LandingPage.jsx:
```jsx
function StarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="#F59E0B" aria-hidden="true">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  )
}
```
Replace the 5 `★` spans in TestiCard with `<StarIcon />` components. Remove the `color: '#F59E0B'` from the span style and the lp-star CSS class.

(b) Extract the inline <style> block from HeroMockup into src/styles/landing.css.
The content to extract is the 6 @keyframes + 4 utility classes (.lp-timer-fill, .lp-typing-dot, .lp-live-dot, etc.).
Remove the <style> JSX element entirely.
Add `@import './styles/landing.css';` to src/index.css (at the end of the @import list).

(c) In TESTI_DATA avatarStyle objects, replace hardcoded hex gradient strings with Tailwind className patterns:
- Move gradient from inline style to a className on the avatar div
- Use Tailwind: `from-blue-600 to-blue-400 bg-gradient-to-br`, etc.
- Or define CSS variables for the three avatar gradients if Tailwind approach is not clean

## Task 8: Add aria-expanded to chapter accordion in ChapterArchitect.jsx
File: src/features/chapterArchitect/ChapterArchitect.jsx
Find .ca-chapter-header div. Add:
- role="button"
- tabIndex={0}
- aria-expanded={isOpen} (use whatever boolean tracks open state)
- aria-controls={`ca-chapter-body-${index}`} (or whatever index variable exists)
- onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleChapter(index); } }}
Also add id={`ca-chapter-body-${index}`} to the corresponding .ca-chapter-body div.

## Task 9: Add aria-hidden to blurred paywall in MethodologyAdvisor.jsx
File: src/features/methodology/MethodologyAdvisor.jsx
Find the div with className containing 'ma-defense-body--blurred' (or conditionally applied).
Add aria-hidden="true" when the blurred class is active.
Pattern: aria-hidden={isBlurred ? true : undefined}

## Task 10: Add skip-to-content link in AppShell.jsx
File: src/features/shell/AppShell.jsx
Add as the FIRST child inside the outermost div:
```jsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[999] focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-semibold focus:no-underline"
  style={{ background: 'var(--color-blue-primary)', color: '#ffffff' }}
>
  Skip to main content
</a>
```
Add id="main-content" to the .app-content__scroll div (or equivalent main content container).
