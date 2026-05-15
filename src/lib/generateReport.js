// ── PDF Report Generator ────────────────────────────────────────────────────
// Uses html2pdf.js (html2canvas + jsPDF) to render a fully styled HTML
// template to PDF. Fonts, colors, and layout match the FYPro design system.
// Footer (brand + page numbers) is stamped per-page via the jsPDF callback.

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(str) {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function loadLogoDataUrl() {
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
    img.src = '/fypro-logo.png'
  })
}

// ── Shared HTML primitives ────────────────────────────────────────────────────

const DIVIDER = `<div style="height:1px;background:rgba(13,27,42,0.08);margin:32px 0;"></div>`

function sectionHeading(label) {
  return `
    <h2 style="
      font-family:'DM Serif Display',Georgia,serif;
      font-size:22px;font-weight:400;
      color:#0D1B2A;
      border-left:4px solid #0066FF;
      padding-left:16px;
      margin:0 0 16px 0;
      line-height:1.2;
    ">${label}</h2>`
}

function bodyText(text) {
  if (!text) return ''
  return `<p style="
    font-family:'Poppins','Helvetica Neue',sans-serif;
    font-size:14px;font-weight:400;
    color:#374151;line-height:1.7;
    margin:8px 0;
  ">${esc(text)}</p>`
}

function infoBox(text) {
  if (!text) return ''
  return `<div class="info-box" style="
    background:#EFF6FF;
    border:1px solid #BFDBFE;
    border-left:4px solid #0066FF;
    border-radius:8px;
    padding:16px 20px;margin:16px 0;
    font-family:'Poppins','Helvetica Neue',sans-serif;
    font-size:13px;color:#1E40AF;line-height:1.6;
  ">${esc(text)}</div>`
}

function warningBox(label, text) {
  if (!text) return ''
  return `<div class="warning-box" style="
    background:#FFFBEB;
    border-left:4px solid #F59E0B;
    border-radius:8px;
    padding:16px 20px;margin:16px 0;
    font-family:'Poppins','Helvetica Neue',sans-serif;
    font-size:13px;color:#92400E;line-height:1.6;
  "><strong>${esc(label)}</strong> ${esc(text)}</div>`
}

function badge(text, color) {
  if (!text) return ''
  return `<span style="
    display:inline-block;
    background:${color};color:#FFFFFF;
    font-family:'JetBrains Mono','Courier New',monospace;
    font-size:10px;font-weight:700;
    padding:4px 10px;
    border-radius:999px;
    letter-spacing:0.8px;
    margin:8px 0 12px 0;
  ">${esc(text)}</span>`
}

function kvRow(label, value) {
  if (!value) return ''
  return `<div style="
    display:flex;gap:12px;margin:6px 0;
    font-family:'Poppins','Helvetica Neue',sans-serif;
    font-size:13px;line-height:1.5;
  ">
    <span style="
      font-weight:600;color:#6B7280;
      text-transform:uppercase;font-size:10px;
      letter-spacing:0.5px;min-width:110px;padding-top:2px;
    ">${esc(label)}</span>
    <span style="color:#0D1B2A;font-weight:400;">${esc(value)}</span>
  </div>`
}

function bulletList(items, color = '#374151') {
  if (!items?.length) return ''
  return items.map(item => `
    <div style="
      display:flex;gap:10px;margin:4px 0;
      font-family:'Poppins','Helvetica Neue',sans-serif;
      font-size:13px;color:${color};line-height:1.6;
    ">
      <span style="color:#0066FF;font-size:16px;line-height:1;margin-top:1px;flex-shrink:0;">•</span>
      <span>${esc(String(item))}</span>
    </div>`).join('')
}

function subsectionLabel(text, color = '#0D1B2A') {
  return `<p style="
    font-family:'Poppins','Helvetica Neue',sans-serif;
    font-size:11px;font-weight:600;color:${color};
    text-transform:uppercase;letter-spacing:0.6px;
    margin:16px 0 8px 0;
  ">${esc(text)}</p>`
}

function companionSectionHeading(label) {
  return `
    <h2 style="
      font-family:'DM Serif Display',Georgia,serif;
      font-size:20px;font-weight:400;
      color:#0D1B2A;
      border-left:4px solid #0891B2;
      padding-left:16px;
      margin:0 0 16px 0;
      line-height:1.2;
    ">${label}</h2>`
}

// ── Step section builders ─────────────────────────────────────────────────────

function buildStep1(state) {
  const tv    = state.topicValidation
  const topic = state.validatedTopic || tv?.refined_topic || state.roughTopic || ''
  const vColor = tv?.verdict === 'Researchable'      ? '#16A34A'
               : tv?.verdict === 'Needs Refinement'  ? '#F59E0B'
               : '#DC2626'

  return `
    <div class="step-section" style="margin-bottom:40px;">
      ${sectionHeading('Step 1 — Topic Validator')}
      ${topic ? `<p style="
        font-family:'DM Serif Display',Georgia,serif;
        font-size:17px;color:#0D1B2A;
        margin:0 0 12px 0;line-height:1.4;
      ">${esc(topic)}</p>` : ''}
      ${tv?.verdict ? badge(tv.verdict.toUpperCase(), vColor) : ''}
      ${tv?.verdict_reason ? bodyText(tv.verdict_reason) : ''}
    </div>
    ${DIVIDER}`
}

function buildStep2(state) {
  const cs            = state.chapterStructure
  const totalChapters = cs.total_chapters || cs.chapters?.length || 0
  const totalWords    = (cs.total_word_count || 0).toLocaleString()

  const chapRows = cs.chapters?.length ? cs.chapters.map(ch => `
    <div style="
      display:flex;align-items:center;gap:12px;
      padding:10px 16px;margin:4px 0;
      background:#F8FAFC;
      border-left:3px solid #3B82F6;
      border-radius:0 6px 6px 0;
    ">
      <span style="
        font-family:'JetBrains Mono','Courier New',monospace;
        font-size:11px;font-weight:700;color:#3B82F6;min-width:38px;
      ">Ch.${ch.number}</span>
      <span style="
        font-family:'Poppins',sans-serif;font-size:13px;
        color:#0D1B2A;font-weight:500;flex:1;
      ">${esc(ch.title || '')}</span>
      ${ch.word_count_target ? `<span style="
        font-family:'JetBrains Mono','Courier New',monospace;
        font-size:10px;color:#6B7280;white-space:nowrap;
        min-width:80px;text-align:right;
      ">${ch.word_count_target.toLocaleString()} words</span>` : ''}
    </div>`).join('') : ''

  return `
    <div class="step-section" style="margin-bottom:40px;">
      ${sectionHeading('Step 2 — Chapter Architect')}
      ${kvRow('Structure', `${totalChapters} chapters · ${totalWords} words total`)}
      ${cs.structure_note ? bodyText(cs.structure_note) : ''}
      ${chapRows ? `<div class="chapter-table" style="margin-top:16px;">${chapRows}</div>` : ''}
    </div>
    ${DIVIDER}`
}

function buildStep3(state) {
  const ma     = state.methodology
  const chosen = ma?.options?.find(o => o.methodology === state.chosenMethodology)

  return `
    <div class="step-section" style="margin-bottom:40px;">
      ${sectionHeading('Step 3 — Methodology Advisor')}
      ${state.chosenMethodology ? `<p style="
        font-family:'DM Serif Display',Georgia,serif;
        font-size:17px;color:#0D1B2A;margin:0 0 12px 0;
      ">${esc(state.chosenMethodology)}</p>` : ''}
      ${ma?.recommended_reason ? bodyText(ma.recommended_reason) : ''}
      ${chosen?.data_collection?.length ? `
        ${subsectionLabel('Data Collection')}
        ${bulletList(chosen.data_collection)}
      ` : ''}
      ${ma?.watch_out ? warningBox('Examiner watch-out:', ma.watch_out) : ''}
    </div>
    ${DIVIDER}`
}

function buildStep4(state) {
  const wp = state.writingPlan
  const deadline = state.submissionDeadline
    ? new Date(state.submissionDeadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Not set'

  const shown    = Math.min(wp.weeks?.length || 0, 10)
  const weekRows = wp.weeks?.length ? wp.weeks.slice(0, 10).map(wk => {
    const isBuf    = wk.is_buffer_week
    const isHol    = wk.is_holiday_week
    const bg       = isBuf ? '#FFFBEB' : isHol ? '#FFF5F5' : '#F8FAFC'
    const border   = isBuf ? '#F59E0B' : isHol ? '#DC2626' : '#3B82F6'
    const numColor = isBuf ? '#92400E' : isHol ? '#991B1B' : '#1E3A5F'
    const focus    = (wk.focus || '').replace(/^This week you are (writing|reviewing|preparing|formatting|finalising)\s*/i, '')

    return `<div style="
      display:flex;align-items:flex-start;gap:12px;
      padding:8px 14px;margin:3px 0;
      background:${bg};border-left:3px solid ${border};
      border-radius:0 6px 6px 0;
      font-family:'Poppins',sans-serif;font-size:12px;
    ">
      <span style="font-weight:700;color:${numColor};min-width:36px;">Wk ${wk.week_number}</span>
      <span style="color:#6B7280;min-width:90px;flex-shrink:0;white-space:nowrap;">${esc(wk.dates || '')}</span>
      <span style="color:#374151;flex:1;">${esc(focus)}</span>
    </div>`
  }).join('') : ''

  return `
    <div class="step-section" style="margin-bottom:40px;">
      ${sectionHeading('Step 4 — Writing Planner')}
      ${kvRow('Deadline', deadline)}
      ${wp.total_weeks    ? kvRow('Duration',   `${wp.total_weeks} weeks`) : ''}
      ${wp.weekly_average ? kvRow('Weekly avg', `${wp.weekly_average.toLocaleString()} words / week`) : ''}
      ${wp.buffer_weeks   ? kvRow('Buffer weeks', String(wp.buffer_weeks)) : ''}
      ${weekRows ? `
        ${subsectionLabel(`Schedule overview (${shown} of ${wp.weeks.length} weeks shown)`)}
        <div style="margin-top:4px;">${weekRows}</div>
        ${wp.weeks.length > 10 ? `<p style="font-size:12px;color:#6B7280;margin:6px 0 0 0;">+ ${wp.weeks.length - 10} more weeks</p>` : ''}
      ` : ''}
    </div>
    ${DIVIDER}`
}

function buildStep5(state) {
  const up = state.uploadedProject || {}
  const rd = up.reviewData || state.projectReview || null

  if (!rd && !up.fileName) return ''  // nothing to show

  const gColorMap = { 'Distinction': '#16A34A', 'Merit': '#0066FF', 'Pass': '#F59E0B' }
  const gColor    = gColorMap[rd?.grade] || '#DC2626'
  const gradeText = rd?.grade && rd?.score_estimate
    ? `${rd.grade}  —  ${rd.score_estimate}`
    : rd?.grade || ''

  return `
    <div class="step-section" style="margin-bottom:40px;">
      ${sectionHeading('Step 5 — Project Reviewer')}
      ${up.fileName ? kvRow('Document', up.fileName) : ''}
      ${rd ? `
        ${gradeText ? badge(gradeText, gColor) : ''}
        ${rd.grade_justification ? bodyText(rd.grade_justification) : ''}
        ${rd.strengths?.length ? `
          ${subsectionLabel('Strengths', '#16A34A')}
          ${bulletList(rd.strengths.map(s => `${s.title}: ${s.detail}`))}
        ` : ''}
        ${rd.weaknesses?.length ? `
          ${subsectionLabel('Areas for Improvement', '#DC2626')}
          ${bulletList(rd.weaknesses.map(w => `${w.title}: ${w.detail}`))}
        ` : ''}
      ` : ''}
    </div>
    ${DIVIDER}`
}

function buildStep6(state) {
  const flagsHTML = state.redFlags?.flags?.length ? state.redFlags.flags.map(flag => {
    const sev   = flag.severity
    const color = sev === 'Critical' ? '#DC2626' : sev === 'Serious' ? '#F59E0B' : '#6B7280'
    const bg    = sev === 'Critical' ? '#FFF5F5' : sev === 'Serious'  ? '#FFFBEB' : '#F8FAFC'

    return `<div style="
      background:${bg};border-left:4px solid ${color};
      border-radius:0 8px 8px 0;
      padding:12px 16px;margin:6px 0;
      font-family:'Poppins',sans-serif;
    ">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
        <span style="
          font-family:'JetBrains Mono','Courier New',monospace;
          font-size:9px;font-weight:700;color:${color};letter-spacing:0.8px;
        ">${esc(sev?.toUpperCase())}</span>
        <span style="font-size:13px;font-weight:600;color:#0D1B2A;">${esc(flag.title || '')}</span>
      </div>
      ${flag.advice ? `<p style="font-size:12px;color:#374151;margin:0;line-height:1.5;">
        <strong>Prep:</strong> ${esc(flag.advice)}
      </p>` : ''}
    </div>`
  }).join('') : ''

  const ds = state.defenseSummary
  const sColor = ds?.panel_score >= 8 ? '#16A34A'
               : ds?.panel_score >= 6 ? '#0066FF'
               : ds?.panel_score >= 4 ? '#F59E0B'
               : '#DC2626'

  const summaryHTML = ds ? `
    ${ds.panel_score !== undefined ? `
      <div style="
        background:${sColor};border-radius:8px;
        padding:14px 24px;text-align:center;margin:16px 0;
      ">
        <span style="
          font-family:'JetBrains Mono','Courier New',monospace;
          font-size:15px;font-weight:700;color:#FFFFFF;letter-spacing:0.5px;
        ">Readiness Score: ${ds.panel_score} / 10  —  ${esc(ds.panel_score_label || '')}</span>
      </div>` : ''}
    ${ds.panel_verdict ? `<p style="
      font-family:'DM Serif Display',Georgia,serif;
      font-size:15px;color:#0D1B2A;margin:12px 0;
    ">${esc(ds.panel_verdict)}</p>` : ''}
    ${ds.strengths?.length ? `
      ${subsectionLabel('Demonstrated Strengths', '#16A34A')}
      ${bulletList(ds.strengths)}
    ` : ''}
    ${ds.gaps?.length ? `
      ${subsectionLabel('Gaps to Address Before Real Defence', '#F59E0B')}
      ${bulletList(ds.gaps)}
    ` : ''}
    ${ds.final_advice ? infoBox(ds.final_advice) : ''}
  ` : ''

  return `
    <div class="step-section" style="margin-bottom:40px;">
      ${sectionHeading('Step 6 — Defense Prep')}
      ${flagsHTML ? `
        ${subsectionLabel('Red Flags Identified')}
        ${flagsHTML}
      ` : ''}
      ${summaryHTML}
    </div>`
}

function buildExaminerQs(examinerQs) {
  const rows = examinerQs.map((q, idx) => {
    const num = q.number || idx + 1
    return `<div style="
      background:#F8FAFC;
      border-left:3px solid #7C3AED;
      border-radius:0 8px 8px 0;
      padding:12px 16px;margin:8px 0;
      font-family:'Poppins',sans-serif;
    ">
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <span style="
          font-family:'JetBrains Mono','Courier New',monospace;
          font-size:10px;font-weight:700;color:#7C3AED;
          min-width:26px;flex-shrink:0;padding-top:2px;
        ">Q${num}</span>
        <div style="flex:1;">
          <p style="font-size:13px;color:#0D1B2A;margin:0 0 4px 0;line-height:1.5;">${esc(q.question || '')}</p>
          ${q.target ? `<p style="font-size:11px;color:#6B7280;margin:0;font-style:italic;">${esc(q.target)}</p>` : ''}
        </div>
      </div>
    </div>`
  }).join('')

  return `
    ${DIVIDER}
    <div class="step-section" style="margin-bottom:40px;">
      ${sectionHeading('Examiner Questions — From Your Project')}
      <p style="
        font-family:'Poppins',sans-serif;font-size:13px;color:#6B7280;margin-bottom:16px;
      ">Generated by Project Reviewer — prepare answers before your real defence.</p>
      ${rows}
    </div>`
}

function buildLiteratureMap(state) {
  const lm = state.literatureMap
  if (!lm) return ''

  const thematicHTML = lm.thematic_areas?.length ? lm.thematic_areas.map(area => `
    <div style="
      background:#F0FDFA;border-left:3px solid #0891B2;
      border-radius:0 6px 6px 0;
      padding:10px 14px;margin:6px 0;
    ">
      <p style="font-family:'Poppins',sans-serif;font-size:13px;font-weight:600;color:#0D1B2A;margin:0 0 4px 0;">
        ${esc(area.theme || '')}
      </p>
      ${area.search_terms?.length ? `<p style="font-family:'JetBrains Mono','Courier New',monospace;font-size:10px;color:#0891B2;margin:0;">
        ${area.search_terms.map(t => esc(t)).join(' · ')}
      </p>` : ''}
    </div>`).join('') : ''

  const sourceHTML = lm.source_types?.length ? lm.source_types.map(src => `
    <div style="
      display:flex;gap:12px;margin:6px 0;
      font-family:'Poppins',sans-serif;font-size:12px;line-height:1.5;
    ">
      <span style="font-weight:600;color:#0891B2;min-width:130px;flex-shrink:0;">${esc(src.type || '')}</span>
      <span style="color:#374151;flex:1;">${esc(src.rationale || '')}${src.access ? ` · ${esc(src.access)}` : ''}</span>
    </div>`).join('') : ''

  const papersHTML = lm.papers?.length ? lm.papers.slice(0, 8).map(p => {
    const authors = Array.isArray(p.authors)
      ? p.authors.slice(0, 3).join(', ') + (p.authors.length > 3 ? ' et al.' : '')
      : ''
    return `<div style="
      padding:8px 0;border-bottom:1px solid rgba(13,27,42,0.06);
      font-family:'Poppins',sans-serif;
    ">
      <p style="font-size:12px;font-weight:500;color:#0D1B2A;margin:0 0 2px 0;line-height:1.4;">${esc(p.title || '')}</p>
      <p style="font-size:11px;color:#6B7280;margin:0;">
        ${authors ? esc(authors) : ''}${p.year ? ` · ${esc(String(p.year))}` : ''}${p.doi ? ` · doi:${esc(p.doi)}` : ''}
      </p>
    </div>`
  }).join('') : ''

  return `
    <div class="step-section" style="margin-bottom:40px;">
      ${companionSectionHeading('Companion — Literature Map')}
      ${thematicHTML ? `${subsectionLabel('Thematic Areas')}${thematicHTML}` : ''}
      ${sourceHTML   ? `${subsectionLabel('Source Types')}${sourceHTML}` : ''}
      ${lm.synthesis_guide ? `${subsectionLabel('Synthesis Guide')}${infoBox(lm.synthesis_guide)}` : ''}
      ${papersHTML ? `
        ${subsectionLabel(`Real Papers (${Math.min(lm.papers.length, 8)} of ${lm.papers.length} shown)`)}
        <div style="margin-top:4px;">${papersHTML}</div>
      ` : ''}
    </div>
    ${DIVIDER}`
}

function buildAbstractGenerator(state) {
  const ag = state.abstractData
  if (!ag) return ''

  const LABELS = [
    ['background',            'Background'],
    ['problem_statement',     'Problem Statement'],
    ['objectives',            'Objectives'],
    ['methodology',           'Methodology'],
    ['expected_contribution', 'Expected Contribution'],
  ]

  const sectionsHTML = LABELS.map(([key, label]) => {
    const text = ag[key]
    if (!text) return ''
    return `${subsectionLabel(label)}${bodyText(text)}`
  }).join('')

  return `
    <div class="step-section" style="margin-bottom:40px;">
      ${companionSectionHeading('Companion — Abstract Generator')}
      ${sectionsHTML}
    </div>
    ${DIVIDER}`
}

function buildInstrumentBuilder(state) {
  const ib = state.instrumentBuilder
  if (!ib) return ''

  const sectionsHTML = ib.sections?.length ? ib.sections.map(sec => `
    <div style="margin:16px 0;">
      <p style="
        font-family:'Poppins',sans-serif;font-size:12px;font-weight:700;
        color:#0D1B2A;text-transform:uppercase;letter-spacing:0.5px;
        margin:0 0 8px 0;border-bottom:1px solid rgba(13,27,42,0.08);padding-bottom:6px;
      ">${esc(sec.section_title || '')}</p>
      ${sec.questions?.length ? sec.questions.map(q => `
        <div style="
          display:flex;gap:10px;padding:7px 0;
          border-bottom:1px solid rgba(13,27,42,0.04);
          font-family:'Poppins',sans-serif;
        ">
          <span style="
            font-family:'JetBrains Mono','Courier New',monospace;
            font-size:10px;font-weight:700;color:#0891B2;
            min-width:28px;flex-shrink:0;padding-top:2px;
          ">Q${esc(String(q.number || ''))}</span>
          <div style="flex:1;">
            <p style="font-size:12px;color:#0D1B2A;margin:0 0 2px 0;line-height:1.5;">${esc(q.text || '')}</p>
            <p style="font-size:10px;color:#6B7280;margin:0;font-style:italic;">
              ${esc(q.type || '')}${q.scale ? ` · ${esc(q.scale)}` : ''}
            </p>
          </div>
        </div>`).join('') : ''}
    </div>`).join('') : ''

  return `
    <div class="step-section" style="margin-bottom:40px;">
      ${companionSectionHeading('Companion — Instrument Builder')}
      ${ib.instrument_title ? `<p style="
        font-family:'DM Serif Display',Georgia,serif;
        font-size:16px;color:#0D1B2A;margin:0 0 12px 0;
      ">${esc(ib.instrument_title)}</p>` : ''}
      ${ib.methodology ? badge(ib.methodology.toUpperCase(), '#0891B2') : ''}
      ${sectionsHTML}
    </div>
    ${DIVIDER}`
}

// ── Full HTML assembly ────────────────────────────────────────────────────────

function buildReportHTML(state, logoDataUrl) {
  const name  = state.name       || 'Student'
  const dept  = state.department || ''
  const lvl   = state.level      || ''
  const completedCount = (state.stepsCompleted || []).filter(Boolean).length
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const studentLine = [name, dept, lvl].filter(Boolean).join(' · ')

  const logoHTML = logoDataUrl
    ? `<img src="${logoDataUrl}" style="height:36px;width:auto;display:block;" alt="FYPro">`
    : `<span style="font-family:'DM Serif Display',Georgia,serif;font-size:22px;font-weight:400;color:#FFFFFF;">FYPro</span>`

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
    stepsHTML = `<div style="
      background:#F0F4F8;border-radius:8px;
      padding:40px;text-align:center;margin:32px 0;
    ">
      <p style="font-family:'Poppins',sans-serif;font-size:14px;color:rgba(13,27,42,0.5);">
        No steps completed yet. Complete at least one step to populate this report.
      </p>
    </div>`
  }

  return `
    <div style="width:794px;max-width:794px;box-sizing:border-box;overflow:hidden;background:#FFFFFF;font-family:'Poppins','Helvetica Neue',sans-serif;">

      <style>
        .step-section { page-break-before: auto; }
        .examiner-watchout, .info-box, .warning-box { page-break-inside: avoid; break-inside: avoid; }
        .chapter-table { page-break-inside: avoid; break-inside: avoid; }
        p { orphans: 3; widows: 3; }
      </style>

      <!-- ── Header ── -->
      <div style="
        background:#060E18;padding:24px 32px;box-sizing:border-box;
        display:flex;justify-content:space-between;align-items:center;
      ">
        <div>${logoHTML}</div>
        <div style="text-align:right;max-width:380px;word-break:break-word;white-space:normal;">
          <div style="
            font-family:'DM Serif Display',Georgia,serif;
            font-size:15px;font-weight:400;color:#FFFFFF;
            margin-bottom:6px;line-height:1.2;white-space:nowrap;
          ">Progress Report</div>
          <div style="
            font-family:'Poppins','Helvetica Neue',sans-serif;
            font-weight:400;font-size:13px;
            color:rgba(255,255,255,0.85);margin-bottom:4px;white-space:nowrap;
          ">${esc(studentLine)}</div>
          <div style="
            font-family:'JetBrains Mono','Courier New',monospace;
            font-weight:500;font-size:11px;
            color:#7ab8ff;white-space:nowrap;
          ">Generated ${esc(dateStr)}</div>
        </div>
      </div>

      <!-- ── Accent bar ── -->
      <div style="height:3px;background:linear-gradient(90deg,#0066FF,#3B82F6,transparent);width:100%;"></div>

      <!-- ── Content ── -->
      <div style="background:#FFFFFF;padding:48px;padding-bottom:32px;padding-left:32px;padding-right:32px;box-sizing:border-box;">
        ${stepsHTML}
      </div>

      <!-- ── Footer ── -->
      <div style="
        background:#060E18;padding:12px 32px;box-sizing:border-box;
        display:flex;justify-content:space-between;align-items:center;
      ">
        <span style="
          font-family:'Poppins','Helvetica Neue',sans-serif;
          font-size:10px;color:rgba(255,255,255,0.8);
          white-space:nowrap;
        ">Generated by FYPro · fypro.com.ng</span>
        <span style="
          font-family:'JetBrains Mono','Courier New',monospace;
          font-size:10px;color:#7ab8ff;
          white-space:nowrap;
        ">${esc(dateStr)}</span>
      </div>

    </div>`
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function downloadProgressReport(state) {
  const [logoDataUrl] = await Promise.all([
    loadLogoDataUrl(),
    document.fonts.load('400 "DM Serif Display"').catch(() => {}),
    document.fonts.load('400 "Poppins"').catch(() => {}),
    document.fonts.load('600 "Poppins"').catch(() => {}),
    document.fonts.load('500 "JetBrains Mono"').catch(() => {}),
  ])

  const htmlContent = buildReportHTML(state, logoDataUrl)

  const container = document.createElement('div')
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
        margin: [10, 10, 10, 10],
        filename: `FYPro-Progress-Report-${slug}.pdf`,
        image:     { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          width: 794,
          windowWidth: 794,
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait',
        },
        pagebreak: {
          mode: ['css'],
        },
      })
      .from(container.firstElementChild)
      .save()
  } finally {
    document.body.removeChild(container)
  }
}
