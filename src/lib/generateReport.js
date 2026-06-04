// ── PDF Report Generator (redesigned) ────────────────────────────────────────
// Bold Nigerian Tech direction. Per-step color identity. Shield watermark.
// All builder functions are pure and exported for Vitest unit testing.
// Only loadLogoDataUrl and downloadProgressReport use browser APIs.

// ── Constants ─────────────────────────────────────────────────────────────────

export const STEP_COLORS = [
  { border: '#0066FF', bg: '#EFF6FF', label: '#0066FF', name: 'Topic Validator'     },
  { border: '#0891B2', bg: '#F0FDFA', label: '#0891B2', name: 'Chapter Architect'   },
  { border: '#7C3AED', bg: '#F5F3FF', label: '#7C3AED', name: 'Methodology Advisor' },
  { border: '#F59E0B', bg: '#FFFBEB', label: '#B45309', name: 'Writing Planner'     },
  { border: '#16A34A', bg: '#F0FFF4', label: '#16A34A', name: 'Project Reviewer'    },
  { border: '#DC2626', bg: '#FFF5F5', label: '#DC2626', name: 'Defense Prep'        },
]

// Inlined from public/shield-star.svg — used in header watermark and closing block
export const SHIELD_PATH = 'M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z'

// ── Helpers ───────────────────────────────────────────────────────────────────

export function esc(str) {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Shared primitives ─────────────────────────────────────────────────────────

export function badge(text, color) {
  if (!text) return ''
  return `<span style="display:inline-block;background:${color};color:#FFFFFF;font-family:'JetBrains Mono','Courier New',monospace;font-size:7px;font-weight:700;padding:2px 8px;border-radius:999px;letter-spacing:1px;flex-shrink:0;">${esc(text)}</span>`
}

export function bodyText(text) {
  if (!text) return ''
  return `<p style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8.5px;font-weight:400;color:#374151;line-height:1.6;margin:4px 0;">${esc(text)}</p>`
}

export function bulletList(items, color = '#374151') {
  if (!items?.length) return ''
  return items.map(item => `
    <div style="display:flex;gap:8px;margin:3px 0;font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8.5px;color:${color};line-height:1.6;">
      <span style="color:#0066FF;font-size:12px;line-height:1;margin-top:1px;flex-shrink:0;">•</span>
      <span>${esc(String(item))}</span>
    </div>`).join('')
}

export function subsectionLabel(text, color = '#6B7280') {
  return `<p style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:7.5px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.8px;margin:12px 0 5px 0;">${esc(text)}</p>`
}

export function warningBox(label, text) {
  if (!text) return ''
  return `<div style="background:#FFF7ED;border-left:3px solid #F59E0B;border-radius:0 5px 5px 0;padding:6px 10px;margin:8px 0;">
    <span style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8px;font-weight:700;color:#92400E;">${esc(label)} </span>
    <span style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8px;color:#92400E;line-height:1.5;">${esc(text)}</span>
  </div>`
}

export function infoBox(text) {
  if (!text) return ''
  return `<div style="background:#EFF6FF;border-left:3px solid #0066FF;border-radius:0 5px 5px 0;padding:8px 12px;margin:8px 0;font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8.5px;color:#1E40AF;line-height:1.6;">${esc(text)}</div>`
}

export function kvRow(label, value) {
  if (!value) return ''
  return `<div style="display:flex;gap:10px;margin:4px 0;font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8.5px;line-height:1.5;">
    <span style="font-weight:700;color:#6B7280;text-transform:uppercase;font-size:7.5px;letter-spacing:0.5px;min-width:100px;padding-top:1px;">${esc(label)}</span>
    <span style="color:#0D1B2A;font-weight:400;">${esc(value)}</span>
  </div>`
}

// ── Step card wrapper ─────────────────────────────────────────────────────────

export function buildStepCard(stepIndex, innerHTML) {
  const c   = STEP_COLORS[stepIndex]
  const num = stepIndex + 1
  return `
    <div style="background:#FFFFFF;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
      <div style="background:${c.bg};border-left:5px solid ${c.border};padding:12px 16px;position:relative;overflow:hidden;">
        <div style="position:absolute;right:12px;bottom:-8px;font-family:'Poppins','Helvetica Neue',sans-serif;font-size:72px;font-weight:800;color:${c.border};opacity:0.06;line-height:1;pointer-events:none;user-select:none;">${num}</div>
        ${innerHTML}
      </div>
    </div>`
}

// ── Header ────────────────────────────────────────────────────────────────────

export function buildHeader(state, logoDataUrl) {
  const topic      = state.validatedTopic || state.roughTopic || ''
  const completed  = (state.stepsCompleted || []).filter(Boolean).length
  const dateStr    = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const studentLine = [state.name, state.department, state.level, state.university].filter(Boolean).join(' · ')

  const logoHTML = logoDataUrl
    ? `<img src="${logoDataUrl}" style="height:22px;width:auto;display:block;" alt="FYPro">`
    : `<span style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:13px;font-weight:800;color:#FFFFFF;letter-spacing:1px;">FYPro</span>`

  return `
    <div style="background:linear-gradient(135deg,#0066FF 0%,#1E40AF 100%);padding:20px 24px 18px;position:relative;overflow:hidden;">
      <div style="position:absolute;right:-10px;top:50%;transform:translateY(-50%);opacity:0.06;pointer-events:none;">
        <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" fill="#FFFFFF" viewBox="0 0 256 256"><path d="${SHIELD_PATH}"/></svg>
      </div>
      <div style="position:absolute;bottom:-30px;right:-30px;width:120px;height:120px;background:rgba(255,255,255,0.05);border-radius:50%;"></div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;position:relative;">
        <div style="flex:1;max-width:65%;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;">
            ${logoHTML}
            <span style="color:rgba(255,255,255,0.35);font-size:11px;">·</span>
            <span style="color:rgba(255,255,255,0.55);font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Progress Report</span>
          </div>
          ${topic ? `<div style="color:#FFFFFF;font-family:'Poppins','Helvetica Neue',sans-serif;font-size:13px;font-weight:700;line-height:1.45;margin-bottom:9px;">${esc(topic)}</div>` : ''}
          ${studentLine ? `<div style="color:rgba(255,255,255,0.7);font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8.5px;font-weight:500;">${esc(studentLine)}</div>` : ''}
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:16px;">
          <div style="background:#16A34A;color:#FFFFFF;font-family:'JetBrains Mono','Courier New',monospace;font-size:7px;font-weight:700;padding:3px 9px;border-radius:999px;letter-spacing:1.5px;margin-bottom:6px;display:inline-block;">${completed} / 6 COMPLETE</div>
          <div style="color:rgba(255,255,255,0.4);font-family:'JetBrains Mono','Courier New',monospace;font-size:7.5px;display:block;">${esc(dateStr)}</div>
        </div>
      </div>
    </div>`
}

// ── Progress bar ──────────────────────────────────────────────────────────────

export function buildProgressBar(stepsCompleted) {
  const segments = Array.from({ length: 6 }, (_, i) => {
    const color = stepsCompleted?.[i] ? '#16A34A' : 'rgba(255,255,255,0.15)'
    return `<div style="flex:1;background:${color};"></div>`
  }).join('')
  return `<div style="display:flex;height:5px;gap:1px;background:#0D1B2A;">${segments}</div>`
}

// ── Footer ────────────────────────────────────────────────────────────────────

export function buildFooter(dateStr) {
  return `
    <div style="background:#060E18;padding:10px 24px;display:flex;justify-content:space-between;align-items:center;box-sizing:border-box;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8px;font-weight:700;color:rgba(255,255,255,0.6);">FYPro</span>
        <span style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8px;color:rgba(255,255,255,0.35);">fypro.com.ng</span>
      </div>
      <span style="font-family:'JetBrains Mono','Courier New',monospace;font-size:8px;color:#7ab8ff;">${esc(dateStr)}</span>
    </div>`
}

// ── Step 1 — Topic Validator ──────────────────────────────────────────────────

export function buildStep1(state) {
  const tv      = state.topicValidation
  const topic   = state.validatedTopic || tv?.refined_topic || state.roughTopic || ''
  const verdict = tv?.verdict || ''
  const vColor  = verdict === 'Researchable'     ? '#16A34A'
                : verdict === 'Needs Refinement' ? '#F59E0B'
                : verdict                        ? '#DC2626' : ''
  const c = STEP_COLORS[0]

  const inner = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
      <span style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8px;font-weight:800;color:${c.label};letter-spacing:2px;text-transform:uppercase;">Step 1 · ${c.name}</span>
      ${verdict ? badge(verdict.toUpperCase(), vColor) : ''}
    </div>
    ${topic ? `<div style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:11px;font-weight:700;color:#0D1B2A;line-height:1.5;margin-bottom:4px;">${esc(topic)}</div>` : ''}
    ${tv?.verdict_reason ? bodyText(tv.verdict_reason) : ''}`

  return buildStepCard(0, inner)
}

// ── Step 2 — Chapter Architect ────────────────────────────────────────────────

export function buildStep2(state) {
  const cs         = state.chapterStructure
  if (!state.chapterStructure) return ''
  const totalCh    = cs.total_chapters || cs.chapters?.length || 0
  const totalWords = (cs.total_word_count || 0).toLocaleString()
  const c          = STEP_COLORS[1]

  const chapRows = cs.chapters?.length ? cs.chapters.map(ch => `
    <div style="display:flex;align-items:center;gap:10px;background:rgba(8,145,178,0.06);border-radius:4px;padding:5px 8px;margin:2px 0;">
      <span style="font-family:'JetBrains Mono','Courier New',monospace;font-size:7px;font-weight:700;color:${c.border};min-width:26px;">Ch.${esc(String(ch.number))}</span>
      <span style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8.5px;color:#0D1B2A;flex:1;font-weight:500;">${esc(ch.title || '')}</span>
      ${ch.word_count_target ? `<span style="font-family:'JetBrains Mono','Courier New',monospace;font-size:7px;color:#9CA3AF;white-space:nowrap;">${ch.word_count_target.toLocaleString()} wds</span>` : ''}
    </div>`).join('') : ''

  const inner = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <span style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8px;font-weight:800;color:${c.label};letter-spacing:2px;text-transform:uppercase;">Step 2 · ${c.name}</span>
      <span style="font-family:'JetBrains Mono','Courier New',monospace;font-size:8px;color:#6B7280;">${totalCh} chapters · ${totalWords} words</span>
    </div>
    ${cs.structure_note ? bodyText(cs.structure_note) : ''}
    ${chapRows ? `<div style="margin-top:4px;">${chapRows}</div>` : ''}`

  return buildStepCard(1, inner)
}

// ── Step 3 — Methodology Advisor ──────────────────────────────────────────────

export function buildStep3(state) {
  const ma     = state.methodology
  const chosen = ma?.options?.find(o => o.methodology === state.chosenMethodology)
  const c      = STEP_COLORS[2]
  if (!state.methodology && !state.chosenMethodology) return ''

  const inner = `
    <div style="margin-bottom:6px;">
      <span style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8px;font-weight:800;color:${c.label};letter-spacing:2px;text-transform:uppercase;">Step 3 · ${c.name}</span>
    </div>
    ${state.chosenMethodology ? `<div style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:10.5px;font-weight:700;color:#0D1B2A;margin-bottom:5px;">${esc(state.chosenMethodology)}</div>` : ''}
    ${ma?.recommended_reason ? bodyText(ma.recommended_reason) : ''}
    ${chosen?.data_collection?.length ? `${subsectionLabel('Data Collection')}${bulletList(chosen.data_collection)}` : ''}
    ${ma?.watch_out ? warningBox('Examiner watch-out:', ma.watch_out) : ''}`

  return buildStepCard(2, inner)
}

// ── Step 4 — Writing Planner ──────────────────────────────────────────────────

export function buildStep4(state) {
  const wp       = state.writingPlan
  const c = STEP_COLORS[3]
  if (!state.writingPlan) return ''
  const deadline = state.submissionDeadline
    ? new Date(state.submissionDeadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Not set'

  const weekRows = wp.weeks?.length ? wp.weeks.slice(0, 10).map(wk => {
    const isSpecial = wk.is_buffer_week || wk.is_holiday_week
    const bg        = isSpecial ? '#FFF5F5'              : 'rgba(245,158,11,0.07)'
    const numCol    = isSpecial ? '#DC2626'              : '#B45309'
    const txtCol    = isSpecial ? '#DC2626'              : '#374151'
    const focus     = (wk.focus || '').replace(/^This week you are (writing|reviewing|preparing|formatting|finalising)\s*/i, '')
    return `<div style="display:flex;align-items:center;gap:8px;padding:4px 8px;background:${bg};border-radius:4px;margin:2px 0;">
      <span style="font-family:'JetBrains Mono','Courier New',monospace;font-size:7px;font-weight:700;color:${numCol};min-width:30px;">Wk ${esc(String(wk.week_number))}</span>
      ${wk.dates ? `<span style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:7px;color:#6B7280;min-width:80px;flex-shrink:0;">${esc(wk.dates)}</span>` : ''}
      <span style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8px;color:${txtCol};flex:1;">${esc(focus)}</span>
    </div>`
  }).join('') : ''

  const inner = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">
      <span style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8px;font-weight:800;color:${c.label};letter-spacing:2px;text-transform:uppercase;">Step 4 · ${c.name}</span>
      <span style="font-family:'JetBrains Mono','Courier New',monospace;font-size:8px;color:#6B7280;">${wp.total_weeks || ''} wks · Deadline ${esc(deadline)}</span>
    </div>
    ${wp.weekly_average ? kvRow('Weekly avg', `${wp.weekly_average.toLocaleString()} words / week`) : ''}
    ${weekRows ? `<div style="margin-top:4px;">${weekRows}</div>` : ''}
    ${wp.weeks && wp.weeks.length > 10 ? `<p style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8px;color:#9CA3AF;margin:4px 0 0 8px;">+ ${wp.weeks.length - 10} more weeks</p>` : ''}`

  return buildStepCard(3, inner)
}

// ── Step 5 — Project Reviewer ─────────────────────────────────────────────────

export function buildStep5(state) {
  const up = state.uploadedProject || {}
  const rd = up.reviewData || state.projectReview || null
  if (!rd && !up.fileName) return ''

  const gColorMap = { Distinction: '#16A34A', Merit: '#0066FF', Pass: '#F59E0B' }
  const gColor    = gColorMap[rd?.grade] || '#DC2626'
  const c         = STEP_COLORS[4]

  const inner = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <span style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8px;font-weight:800;color:${c.label};letter-spacing:2px;text-transform:uppercase;">Step 5 · ${c.name}</span>
      ${rd?.grade ? badge(`${rd.grade.toUpperCase()}${rd.score_estimate ? ' — ' + rd.score_estimate : ''}`, gColor) : ''}
    </div>
    ${up.fileName ? kvRow('Document', up.fileName) : ''}
    ${rd?.grade_justification ? bodyText(rd.grade_justification) : ''}
    ${(rd?.strengths?.length || rd?.weaknesses?.length) ? `
      <div style="display:flex;gap:8px;margin-top:8px;">
        ${rd?.strengths?.length ? `<div style="flex:1;background:rgba(22,163,74,0.08);border-radius:6px;padding:7px 9px;">
          ${subsectionLabel('Strengths', '#16A34A')}
          ${bulletList(rd.strengths.map(s => `${s.title}: ${s.detail}`))}
        </div>` : ''}
        ${rd?.weaknesses?.length ? `<div style="flex:1;background:rgba(220,38,38,0.06);border-radius:6px;padding:7px 9px;">
          ${subsectionLabel('To Fix', '#DC2626')}
          ${bulletList(rd.weaknesses.map(w => `${w.title}: ${w.detail}`))}
        </div>` : ''}
      </div>` : ''}`

  return buildStepCard(4, inner)
}

// ── Step 6 — Defense Prep ─────────────────────────────────────────────────────

export function buildStep6(state) {
  const ds = state.defenseSummary
  const c  = STEP_COLORS[5]
  if (!ds && !state.redFlags) return ''

  const sColor = !ds?.panel_score      ? '#6B7280'
               : ds.panel_score >= 8   ? '#16A34A'
               : ds.panel_score >= 6   ? '#0066FF'
               : ds.panel_score >= 4   ? '#F59E0B'
               : '#DC2626'

  const flagsHTML = state.redFlags?.flags?.length ? state.redFlags.flags.map(flag => {
    const sev    = flag.severity
    const fColor = sev === 'Critical' ? '#DC2626' : sev === 'Serious' ? '#F59E0B' : '#6B7280'
    const fBg    = sev === 'Critical' ? '#FFF5F5' : sev === 'Serious' ? '#FFFBEB' : '#F8FAFC'
    return `<div style="background:${fBg};border-left:3px solid ${fColor};border-radius:0 5px 5px 0;padding:7px 10px;margin:4px 0;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
        <span style="font-family:'JetBrains Mono','Courier New',monospace;font-size:6.5px;font-weight:700;color:${fColor};letter-spacing:1px;">${esc(sev?.toUpperCase())}</span>
        <span style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8.5px;font-weight:700;color:#0D1B2A;">${esc(flag.title || '')}</span>
      </div>
      ${flag.advice ? `<p style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8px;color:#374151;margin:0;line-height:1.5;">${esc(flag.advice)}</p>` : ''}
    </div>`
  }).join('') : ''

  const inner = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <span style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8px;font-weight:800;color:${c.label};letter-spacing:2px;text-transform:uppercase;">Step 6 · ${c.name}</span>
      ${ds?.panel_score !== undefined ? badge(`${ds.panel_score} / 10${ds.panel_score_label ? ' — ' + ds.panel_score_label : ''}`, sColor) : ''}
    </div>
    ${ds?.panel_verdict ? `<p style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8.5px;color:#374151;font-style:italic;margin:0 0 8px 0;line-height:1.6;">"${esc(ds.panel_verdict)}"</p>` : ''}
    ${flagsHTML ? `${subsectionLabel('Red Flags')}${flagsHTML}` : ''}
    ${ds?.strengths?.length ? `${subsectionLabel('Demonstrated Strengths', '#16A34A')}${bulletList(ds.strengths)}` : ''}
    ${ds?.gaps?.length      ? `${subsectionLabel('Gaps to Address', '#F59E0B')}${bulletList(ds.gaps)}` : ''}
    ${ds?.final_advice      ? infoBox(ds.final_advice) : ''}`

  return buildStepCard(5, inner)
}

// ── Companion helpers (shared style) ─────────────────────────────────────────

const COMPANION_INNER = 'background:#F0FDFA;border-left:4px dashed #0891B2;padding:12px 16px;position:relative;overflow:hidden;'

function companionCard(labelSuffix, body) {
  return `
    <div style="background:#FFFFFF;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
      <div style="${COMPANION_INNER}">
        <div style="margin-bottom:8px;"><span style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8px;font-weight:800;color:#0891B2;letter-spacing:2px;text-transform:uppercase;">Companion — ${esc(labelSuffix)}</span></div>
        ${body}
      </div>
    </div>`
}

// ── Companion: Literature Map ─────────────────────────────────────────────────

export function buildLiteratureMap(state) {
  const lm = state.literatureMap
  if (!lm) return ''

  const thematicHTML = lm.thematic_areas?.length ? lm.thematic_areas.map(area => `
    <div style="background:rgba(8,145,178,0.06);border-radius:4px;padding:8px 10px;margin:4px 0;">
      <p style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8.5px;font-weight:700;color:#0D1B2A;margin:0 0 3px 0;">${esc(area.theme || '')}</p>
      ${area.search_terms?.length ? `<p style="font-family:'JetBrains Mono','Courier New',monospace;font-size:8px;color:#0891B2;margin:0;">${area.search_terms.map(t => esc(t)).join(' · ')}</p>` : ''}
    </div>`).join('') : ''

  const sourceHTML = lm.source_types?.length ? lm.source_types.map(src => `
    <div style="display:flex;gap:10px;margin:4px 0;font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8.5px;line-height:1.5;">
      <span style="font-weight:700;color:#0891B2;min-width:120px;flex-shrink:0;">${esc(src.type || '')}</span>
      <span style="color:#374151;flex:1;">${esc(src.rationale || '')}${src.access ? ' · ' + esc(src.access) : ''}</span>
    </div>`).join('') : ''

  const papersHTML = lm.papers?.length ? lm.papers.slice(0, 8).map(p => {
    const authors = Array.isArray(p.authors)
      ? p.authors.slice(0, 3).join(', ') + (p.authors.length > 3 ? ' et al.' : '')
      : ''
    return `<div style="padding:6px 0;border-bottom:1px solid rgba(13,27,42,0.06);">
      <p style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8.5px;font-weight:600;color:#0D1B2A;margin:0 0 2px 0;line-height:1.4;">${esc(p.title || '')}</p>
      <p style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8px;color:#6B7280;margin:0;">${authors ? esc(authors) : ''}${p.year ? ' · ' + esc(String(p.year)) : ''}${p.doi ? ' · doi:' + esc(p.doi) : ''}</p>
    </div>`
  }).join('') : ''

  const body = `
    ${thematicHTML ? `${subsectionLabel('Thematic Areas', '#0891B2')}${thematicHTML}` : ''}
    ${sourceHTML   ? `${subsectionLabel('Source Types',   '#0891B2')}${sourceHTML}` : ''}
    ${lm.synthesis_guide ? `${subsectionLabel('Synthesis Guide', '#0891B2')}${infoBox(lm.synthesis_guide)}` : ''}
    ${papersHTML ? `${subsectionLabel(`Real Papers (${Math.min(lm.papers.length, 8)} of ${lm.papers.length} shown)`, '#0891B2')}<div style="margin-top:4px;">${papersHTML}</div>` : ''}`

  return companionCard('Literature Map', body)
}

// ── Companion: Abstract Generator ────────────────────────────────────────────

export function buildAbstractGenerator(state) {
  const ag = state.abstractData
  if (!ag) return ''

  const LABELS = [
    ['background',            'Background'],
    ['problem_statement',     'Problem Statement'],
    ['objectives',            'Objectives'],
    ['methodology',           'Methodology'],
    ['expected_contribution', 'Expected Contribution'],
  ]

  const body = LABELS.map(([key, label]) => {
    if (!ag[key]) return ''
    return `${subsectionLabel(label, '#0891B2')}${bodyText(ag[key])}`
  }).join('')

  return companionCard('Abstract Generator', body)
}

// ── Companion: Instrument Builder ─────────────────────────────────────────────

export function buildInstrumentBuilder(state) {
  const ib = state.instrumentBuilder
  if (!ib) return ''

  const sectionsHTML = ib.sections?.length ? ib.sections.map(sec => `
    <div style="margin:12px 0;">
      <p style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8px;font-weight:700;color:#0D1B2A;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px 0;border-bottom:1px solid rgba(13,27,42,0.08);padding-bottom:4px;">${esc(sec.section_title || '')}</p>
      ${sec.questions?.length ? sec.questions.map(q => `
        <div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid rgba(13,27,42,0.04);">
          <span style="font-family:'JetBrains Mono','Courier New',monospace;font-size:7px;font-weight:700;color:#0891B2;min-width:24px;flex-shrink:0;padding-top:2px;">Q${esc(String(q.number || ''))}</span>
          <div style="flex:1;">
            <p style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8.5px;color:#0D1B2A;margin:0 0 2px 0;line-height:1.5;">${esc(q.text || '')}</p>
            <p style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8px;color:#6B7280;margin:0;font-style:italic;">${esc(q.type || '')}${q.scale ? ' · ' + esc(q.scale) : ''}</p>
          </div>
        </div>`).join('') : ''}
    </div>`).join('') : ''

  const body = `
    ${ib.instrument_title ? `<div style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:11px;font-weight:700;color:#0D1B2A;margin-bottom:6px;">${esc(ib.instrument_title)}</div>` : ''}
    ${ib.methodology ? badge(ib.methodology.toUpperCase(), '#0891B2') : ''}
    ${sectionsHTML}`

  return companionCard('Instrument Builder', body)
}

// ── Examiner Questions ────────────────────────────────────────────────────────

export function buildExaminerQs(examinerQs) {
  if (!examinerQs?.length) return ''
  const rows = examinerQs.map((q, idx) => {
    const num = q.number || idx + 1
    return `<div style="background:#F5F3FF;border-left:3px solid #7C3AED;border-radius:0 6px 6px 0;padding:10px 12px;margin:6px 0;">
      <div style="display:flex;align-items:flex-start;gap:8px;">
        <span style="font-family:'JetBrains Mono','Courier New',monospace;font-size:8px;font-weight:700;color:#7C3AED;min-width:22px;flex-shrink:0;padding-top:2px;">Q${num}</span>
        <div style="flex:1;">
          <p style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8.5px;color:#0D1B2A;margin:0 0 3px 0;line-height:1.5;">${esc(q.question || '')}</p>
          ${q.target ? `<p style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8px;color:#6B7280;margin:0;font-style:italic;">${esc(q.target)}</p>` : ''}
        </div>
      </div>
    </div>`
  }).join('')

  return `
    <div style="background:#FFFFFF;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);margin-top:4px;">
      <div style="background:#F5F3FF;border-left:5px solid #7C3AED;padding:12px 16px;">
        <div style="margin-bottom:8px;"><span style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8px;font-weight:800;color:#7C3AED;letter-spacing:2px;text-transform:uppercase;">Examiner Questions — From Your Project</span></div>
        <p style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8.5px;color:#6B7280;margin:0 0 10px 0;">Prepare answers to these before your real defence.</p>
        ${rows}
      </div>
    </div>`
}

// ── Closing message ───────────────────────────────────────────────────────────

export function buildClosingMessage() {
  return `
    <div style="background:#0D1B2A;border-radius:12px;padding:20px 22px;position:relative;overflow:hidden;margin-top:4px;">
      <div style="position:absolute;right:16px;top:50%;transform:translateY(-50%);opacity:0.07;pointer-events:none;">
        <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="#FFFFFF" viewBox="0 0 256 256"><path d="${SHIELD_PATH}"/></svg>
      </div>
      <div style="display:flex;align-items:flex-start;gap:14px;position:relative;">
        <div style="flex-shrink:0;margin-top:2px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="#0066FF" viewBox="0 0 256 256"><path d="${SHIELD_PATH}"/></svg>
        </div>
        <div>
          <div style="color:#FFFFFF;font-family:'Poppins','Helvetica Neue',sans-serif;font-size:12px;font-weight:700;line-height:1.5;margin-bottom:6px;">You've done the thinking. You built the structure.</div>
          <div style="color:rgba(255,255,255,0.65);font-family:'Poppins','Helvetica Neue',sans-serif;font-size:8.5px;line-height:1.7;">Every step in this report is evidence of real work. Your topic is validated. Your chapters are planned. Your methodology is chosen. Your schedule exists. Now there is only one thing left — walk in and defend it.<br><br>FYPro was built so no Nigerian student walks into their defence unprepared.</div>
        </div>
      </div>
    </div>`
}

// ── Full HTML assembly ────────────────────────────────────────────────────────

export function buildReportHTML(state, logoDataUrl) {
  const completedCount = (state.stepsCompleted || []).filter(Boolean).length
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  let stepsHTML = ''
  if (state.stepsCompleted?.[0])
    stepsHTML += buildStep1(state)
  if (state.stepsCompleted?.[1] && state.chapterStructure)
    stepsHTML += buildStep2(state)
  if (state.literatureMap)
    stepsHTML += buildLiteratureMap(state)
  if (state.abstractData)
    stepsHTML += buildAbstractGenerator(state)
  if (state.stepsCompleted?.[2] && (state.chosenMethodology || state.methodology))
    stepsHTML += buildStep3(state)
  if (state.instrumentBuilder)
    stepsHTML += buildInstrumentBuilder(state)
  if (state.stepsCompleted?.[3] && state.writingPlan)
    stepsHTML += buildStep4(state)
  if (state.stepsCompleted?.[4])
    stepsHTML += buildStep5(state)
  if (state.stepsCompleted?.[5])
    stepsHTML += buildStep6(state)

  const examinerQs = state.uploadedProject?.reviewData?.examiner_questions
  if (examinerQs?.length)
    stepsHTML += buildExaminerQs(examinerQs)

  if (completedCount === 0) {
    stepsHTML = `<div style="background:#F0F4F8;border-radius:8px;padding:40px;text-align:center;margin:32px 0;">
      <p style="font-family:'Poppins','Helvetica Neue',sans-serif;font-size:14px;color:rgba(13,27,42,0.5);">No steps completed yet. Complete at least one step to populate this report.</p>
    </div>`
  }

  return `
    <div style="width:794px;max-width:794px;box-sizing:border-box;overflow:hidden;background:#FFFFFF;font-family:'Poppins','Helvetica Neue',sans-serif;">
      <style>
        div[style*="border-radius:10px"] { page-break-inside: avoid; break-inside: avoid; }
        p { orphans: 3; widows: 3; }
      </style>
      ${buildHeader(state, logoDataUrl)}
      ${buildProgressBar(state.stepsCompleted)}
      <div style="background:#F8FAFC;padding:20px 24px;display:flex;flex-direction:column;gap:12px;background-image:radial-gradient(circle,rgba(0,102,255,0.04) 1px,transparent 1px);background-size:20px 20px;box-sizing:border-box;">
        ${stepsHTML}
        ${buildClosingMessage()}
      </div>
      ${buildFooter(dateStr)}
    </div>`
}

// ── Browser-only export ───────────────────────────────────────────────────────

export async function loadLogoDataUrl() {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width  = img.naturalWidth
      c.height = img.naturalHeight
      c.getContext('2d').drawImage(img, 0, 0)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = () => resolve(null)
    img.src = '/fypro-logo-light.png'
  })
}

export async function downloadProgressReport(state) {
  const [logoDataUrl] = await Promise.all([
    loadLogoDataUrl(),
    document.fonts.load('400 "Poppins"').catch(() => {}),
    document.fonts.load('600 "Poppins"').catch(() => {}),
    document.fonts.load('700 "Poppins"').catch(() => {}),
    document.fonts.load('800 "Poppins"').catch(() => {}),
    document.fonts.load('500 "JetBrains Mono"').catch(() => {}),
    document.fonts.load('700 "JetBrains Mono"').catch(() => {}),
  ])

  const htmlContent = buildReportHTML(state, logoDataUrl)
  const container   = document.createElement('div')
  container.innerHTML = htmlContent
  container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;'
  document.body.appendChild(container)
  await document.fonts.ready

  const rawTopic = state.validatedTopic || state.roughTopic || 'research'
  const slug = rawTopic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)

  try {
    const { default: html2pdf } = await import('html2pdf.js')
    await html2pdf()
      .set({
        margin:      [10, 10, 10, 10],
        filename:    `FYPro-Progress-Report-${slug}.pdf`,
        image:       { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, width: 794, windowWidth: 794 },
        jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:   { mode: ['css'] },
      })
      .from(container.firstElementChild)
      .save()
  } finally {
    document.body.removeChild(container)
  }
}
