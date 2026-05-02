import { jsPDF } from 'jspdf'

// ── Page constants ──────────────────────────────────────────────────────────
const W = 210
const H = 297
const ML = 18
const MR = 18
const CW = W - ML - MR   // 174mm usable width
const BOTTOM = 278        // trigger new page if y exceeds this

// ── Colour palette ──────────────────────────────────────────────────────────
const NAVY   = [6,  14,  24]
const BLUE   = [0, 102, 255]
const BLUE_L = [59, 130, 246]
const GREEN  = [22, 163,  74]
const AMBER  = [245, 158, 11]
const RED    = [220,  38,  38]
const PURPLE = [139,  92, 246]
const WHITE  = [255, 255, 255]
const SLATE5 = [100, 116, 139]
const SLATE8 = [ 30,  41,  59]
const LIGHT  = [240, 244, 248]

// ── Helpers ─────────────────────────────────────────────────────────────────

function c(doc, type, rgb) {
  if (type === 'text') doc.setTextColor(rgb[0], rgb[1], rgb[2])
  else if (type === 'fill') doc.setFillColor(rgb[0], rgb[1], rgb[2])
  else doc.setDrawColor(rgb[0], rgb[1], rgb[2])
}

function wrap(doc, text, maxW) {
  return doc.splitTextToSize(String(text || ''), maxW)
}

function newPage(doc) {
  doc.addPage()
  return 22
}

function checkY(doc, y, needed = 12) {
  return y + needed > BOTTOM ? newPage(doc) : y
}

function rule(doc, y) {
  c(doc, 'draw', [210, 220, 235])
  doc.setLineWidth(0.25)
  doc.line(ML, y, ML + CW, y)
  return y + 6
}

function sectionBand(doc, y, label, rgb) {
  y = checkY(doc, y, 16)
  c(doc, 'fill', rgb)
  doc.rect(ML, y, CW, 9.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  c(doc, 'text', WHITE)
  doc.text(label, ML + 4, y + 6.5)
  return y + 13.5
}

function bodyText(doc, y, text, opts = {}) {
  if (!text) return y
  const { indent = 0, color = [50, 65, 85], size = 8.5, bold = false } = opts
  const maxW = CW - indent
  const lines = wrap(doc, text, maxW)
  const lineH = size * 0.40
  const needed = lines.length * lineH + 2
  y = checkY(doc, y, needed)
  doc.setFont('helvetica', bold ? 'bold' : 'normal')
  doc.setFontSize(size)
  c(doc, 'text', color)
  doc.text(lines, ML + indent, y)
  return y + needed
}

function kvRow(doc, y, label, value) {
  if (!value) return y
  y = checkY(doc, y, 8)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  c(doc, 'text', [80, 100, 130])
  doc.text(label.toUpperCase() + ':', ML, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  c(doc, 'text', NAVY)
  const lines = wrap(doc, value, CW - 38)
  doc.text(lines, ML + 32, y)
  return y + Math.max(6, lines.length * 4.5) + 1.5
}

function bullet(doc, y, text, indent = 4) {
  if (!text) return y
  const lines = wrap(doc, text, CW - indent - 6)
  const needed = lines.length * 4.5 + 2
  y = checkY(doc, y, needed)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  c(doc, 'text', [50, 65, 85])
  doc.text('•', ML + indent, y)
  doc.text(lines, ML + indent + 5, y)
  return y + needed
}

function verdictBadge(doc, y, text, rgb) {
  y = checkY(doc, y, 10)
  const tw = doc.getTextWidth(text) + 8
  c(doc, 'fill', rgb)
  doc.roundedRect(ML, y, tw, 7.5, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  c(doc, 'text', WHITE)
  doc.text(text, ML + 4, y + 5.2)
  return y + 11
}

// ── Main export ─────────────────────────────────────────────────────────────

export async function downloadProgressReport(state) {
  const logoImg = await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      resolve({ dataUrl: canvas.toDataURL('image/png'), nw: img.naturalWidth, nh: img.naturalHeight })
    }
    img.onerror = reject
    img.src = '/fypro-logo.png'
  })

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let y = 0

  // ── Header ────────────────────────────────────────────────────────────────
  c(doc, 'fill', NAVY)
  doc.rect(0, 0, W, 46, 'F')
  c(doc, 'fill', BLUE)
  doc.rect(0, 46, W, 2, 'F')

  // FYPro logo image
  const logoH = 9
  const logoW = (logoImg.nw / logoImg.nh) * logoH
  doc.addImage(logoImg.dataUrl, 'PNG', ML, 13, logoW, logoH)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  c(doc, 'text', [130, 180, 255])
  doc.text('PROGRESS REPORT', ML, 30)

  // Student info (right-aligned)
  const name = state.name || 'Student'
  const uni  = state.university || '—'
  const dept = state.department || '—'
  const lvl  = state.level || '—'

  doc.setFontSize(8.5)
  c(doc, 'text', [180, 210, 255])
  doc.text(`${name}  ·  ${uni}  ·  ${dept}  ·  ${lvl}`, W - MR, 22, { align: 'right' })

  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  doc.setFontSize(7.5)
  c(doc, 'text', [80, 120, 180])
  doc.text(`Generated ${dateStr}`, W - MR, 30, { align: 'right' })

  const completedCount = (state.stepsCompleted || []).filter(Boolean).length
  c(doc, 'text', [60, 100, 160])
  doc.text(`${completedCount} / 6 steps completed`, W - MR, 38, { align: 'right' })

  y = 58

  // ── Step 1: Topic Validator ──────────────────────────────────────────────
  if (state.stepsCompleted?.[0]) {
    y = sectionBand(doc, y, 'STEP 1 — TOPIC VALIDATOR', BLUE)

    const topic = state.validatedTopic || state.topicValidation?.refined_topic || state.roughTopic || ''
    if (topic) {
      y = checkY(doc, y, 14)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      c(doc, 'text', NAVY)
      const tLines = wrap(doc, topic, CW)
      doc.text(tLines, ML, y)
      y += tLines.length * 5.5 + 4
    }

    const tv = state.topicValidation
    if (tv?.verdict) {
      const vColor = tv.verdict === 'Researchable' ? GREEN : tv.verdict === 'Needs Refinement' ? AMBER : RED
      y = verdictBadge(doc, y, tv.verdict.toUpperCase(), vColor)
    }
    if (tv?.verdict_reason) y = bodyText(doc, y, tv.verdict_reason)

    y += 5
    y = rule(doc, y)
  }

  // ── Step 2: Chapter Architect ────────────────────────────────────────────
  if (state.stepsCompleted?.[1] && state.chapterStructure) {
    y = sectionBand(doc, y, 'STEP 2 — CHAPTER ARCHITECT', BLUE_L)
    const cs = state.chapterStructure

    const totalChapters = cs.total_chapters || cs.chapters?.length || 0
    const totalWords    = (cs.total_word_count || 0).toLocaleString()
    y = kvRow(doc, y, 'Structure', `${totalChapters} chapters  ·  ${totalWords} words total`)

    if (cs.structure_note) {
      y = bodyText(doc, y, cs.structure_note, { color: SLATE5 })
      y += 3
    }

    if (cs.chapters?.length) {
      cs.chapters.forEach((ch) => {
        y = checkY(doc, y, 12)
        c(doc, 'fill', LIGHT)
        doc.rect(ML, y, CW, 8, 'F')
        c(doc, 'fill', BLUE_L)
        doc.rect(ML, y, 1.8, 8, 'F')

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        c(doc, 'text', BLUE_L)
        const chLabel = `Ch. ${ch.number}`
        doc.text(chLabel, ML + 4, y + 5.5)

        const titleX   = ML + 4 + doc.getTextWidth(chLabel) + 4
        const maxTitleW = CW - (titleX - ML) - 22
        doc.setFontSize(8.5)
        c(doc, 'text', NAVY)
        const tLines = wrap(doc, ch.title || '', maxTitleW)
        doc.text(tLines[0] || '', titleX, y + 5.5)

        if (ch.word_count_target) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7.5)
          c(doc, 'text', SLATE5)
          doc.text(`${ch.word_count_target.toLocaleString()} words`, ML + CW - 22, y + 5.5)
        }
        y += 10
      })
    }

    y += 4
    y = rule(doc, y)
  }

  // ── Step 3: Methodology Advisor ──────────────────────────────────────────
  if (state.stepsCompleted?.[2] && (state.chosenMethodology || state.methodology)) {
    y = sectionBand(doc, y, 'STEP 3 — METHODOLOGY ADVISOR', GREEN)

    if (state.chosenMethodology) {
      y = checkY(doc, y, 10)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11.5)
      c(doc, 'text', NAVY)
      doc.text(state.chosenMethodology, ML, y)
      y += 8
    }

    const ma = state.methodology
    if (ma?.recommended_reason) {
      y = bodyText(doc, y, ma.recommended_reason)
      y += 2
    }

    const chosen = ma?.options?.find(o => o.methodology === state.chosenMethodology)
    if (chosen?.data_collection?.length) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      c(doc, 'text', SLATE8)
      y = checkY(doc, y, 6)
      doc.text('Data Collection:', ML, y)
      y += 5
      chosen.data_collection.forEach(m => { y = bullet(doc, y, m) })
    }

    if (ma?.watch_out) {
      y += 3
      const watchLines = wrap(doc, ma.watch_out, CW - 10)
      const boxH = watchLines.length * 4.5 + 10
      y = checkY(doc, y, boxH)
      c(doc, 'fill', [255, 251, 235])
      doc.rect(ML, y, CW, boxH, 'F')
      c(doc, 'fill', AMBER)
      doc.rect(ML, y, 2, boxH, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      c(doc, 'text', [120, 80, 10])
      doc.text('Examiner watch-out:', ML + 5, y + 6)
      doc.setFont('helvetica', 'normal')
      doc.text(watchLines, ML + 5, y + 11)
      y += boxH + 3
    }

    y += 4
    y = rule(doc, y)
  }

  // ── Step 4: Writing Planner ──────────────────────────────────────────────
  if (state.stepsCompleted?.[3] && state.writingPlan) {
    y = sectionBand(doc, y, 'STEP 4 — WRITING PLANNER', AMBER)
    const wp = state.writingPlan

    const deadline = state.submissionDeadline
      ? new Date(state.submissionDeadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'Not set'

    y = kvRow(doc, y, 'Deadline', deadline)
    if (wp.total_weeks)    y = kvRow(doc, y, 'Duration',     `${wp.total_weeks} weeks`)
    if (wp.weekly_average) y = kvRow(doc, y, 'Weekly avg',   `${wp.weekly_average.toLocaleString()} words / week`)
    if (wp.buffer_weeks)   y = kvRow(doc, y, 'Buffer weeks', String(wp.buffer_weeks))

    if (wp.weeks?.length) {
      y += 3
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      c(doc, 'text', SLATE8)
      y = checkY(doc, y, 6)
      const shown = Math.min(wp.weeks.length, 10)
      doc.text(`Schedule overview (${shown} of ${wp.weeks.length} weeks shown)`, ML, y)
      y += 5

      wp.weeks.slice(0, 10).forEach((wk) => {
        y = checkY(doc, y, 9)
        const isBuf  = wk.is_buffer_week
        const isHol  = wk.is_holiday_week
        const bgRgb  = isBuf ? [255, 251, 235] : isHol ? [254, 242, 242] : [248, 250, 252]
        const accRgb = isBuf ? AMBER : isHol ? RED : BLUE_L

        c(doc, 'fill', bgRgb)
        doc.rect(ML, y, CW, 7.5, 'F')
        c(doc, 'fill', accRgb)
        doc.rect(ML, y, 1.8, 7.5, 'F')

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        c(doc, 'text', isBuf ? [120, 80, 10] : isHol ? [153, 27, 27] : SLATE8)
        doc.text(`Wk ${wk.week_number}`, ML + 4, y + 5)

        doc.setFont('helvetica', 'normal')
        c(doc, 'text', SLATE5)
        doc.text(wk.dates || '', ML + 17, y + 5)

        const focus = (wk.focus || '').replace(/^This week you are (writing|reviewing|preparing|formatting|finalising)\s*/i, '')
        const fLines = wrap(doc, focus, CW - 68)
        c(doc, 'text', [50, 65, 85])
        doc.text(fLines[0] || '', ML + 52, y + 5)
        y += 8.5
      })

      if (wp.weeks.length > 10) {
        y = checkY(doc, y, 6)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        c(doc, 'text', SLATE5)
        doc.text(`+ ${wp.weeks.length - 10} more weeks`, ML + 4, y)
        y += 6
      }
    }

    y += 4
    y = rule(doc, y)
  }

  // ── Step 5: Project Reviewer ─────────────────────────────────────────────
  if (state.stepsCompleted?.[4] && state.uploadedProject) {
    y = sectionBand(doc, y, 'STEP 5 — PROJECT REVIEWER', PURPLE)
    const up = state.uploadedProject

    if (up.fileName) y = kvRow(doc, y, 'Document', up.fileName)

    const rd = up.reviewData
    if (rd) {
      y += 2
      if (rd.grade) {
        const gColor = rd.grade === 'Distinction' ? GREEN : rd.grade === 'Merit' ? BLUE : rd.grade === 'Pass' ? AMBER : RED
        const gradeText = rd.score_estimate ? `${rd.grade}  —  ${rd.score_estimate}` : rd.grade
        y = verdictBadge(doc, y, gradeText, gColor)
      }

      if (rd.grade_justification) {
        y = bodyText(doc, y, rd.grade_justification)
        y += 3
      }

      if (rd.strengths?.length) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        c(doc, 'text', GREEN)
        y = checkY(doc, y, 6)
        doc.text('Strengths', ML, y)
        y += 5
        rd.strengths.forEach(s => { y = bullet(doc, y, `${s.title}: ${s.detail}`) })
        y += 2
      }

      if (rd.weaknesses?.length) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        c(doc, 'text', RED)
        y = checkY(doc, y, 6)
        doc.text('Areas for Improvement', ML, y)
        y += 5
        rd.weaknesses.forEach(w => { y = bullet(doc, y, `${w.title}: ${w.detail}`) })
      }
    }

    y += 4
    y = rule(doc, y)
  }

  // ── Step 6: Defense Prep ─────────────────────────────────────────────────
  if (state.stepsCompleted?.[5]) {
    y = sectionBand(doc, y, 'STEP 6 — DEFENSE PREP', NAVY)

    if (state.redFlags?.flags?.length) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      c(doc, 'text', SLATE8)
      y = checkY(doc, y, 6)
      doc.text('Red Flags Identified:', ML, y)
      y += 6

      state.redFlags.flags.forEach(flag => {
        const sevColor = flag.severity === 'Critical' ? RED : flag.severity === 'Serious' ? AMBER : SLATE5
        const bgColor  = flag.severity === 'Critical' ? [254, 242, 242]
                       : flag.severity === 'Serious'  ? [255, 251, 235]
                       : [248, 250, 252]
        y = checkY(doc, y, 20)
        c(doc, 'fill', bgColor)
        doc.rect(ML, y, CW, 8.5, 'F')
        c(doc, 'fill', sevColor)
        doc.rect(ML, y, 2, 8.5, 'F')

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        c(doc, 'text', sevColor)
        const sevLabel = flag.severity.toUpperCase()
        doc.text(sevLabel, ML + 5, y + 5.8)

        const titleX = ML + 5 + doc.getTextWidth(sevLabel) + 5
        doc.setFontSize(8.5)
        c(doc, 'text', NAVY)
        doc.text(flag.title || '', titleX, y + 5.8)
        y += 11

        if (flag.advice) {
          y = bodyText(doc, y, 'Prep: ' + flag.advice, { indent: 5, color: SLATE5, size: 7.5 })
          y += 2
        }
      })
    }

    if (state.defenseSummary) {
      const ds = state.defenseSummary
      y += 4

      if (ds.panel_score !== undefined) {
        const sColor = ds.panel_score >= 8 ? GREEN : ds.panel_score >= 6 ? BLUE_L : ds.panel_score >= 4 ? AMBER : RED
        y = checkY(doc, y, 14)
        c(doc, 'fill', sColor)
        doc.roundedRect(ML, y, CW, 11, 2, 2, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        c(doc, 'text', WHITE)
        doc.text(
          `Readiness Score: ${ds.panel_score} / 10  —  ${ds.panel_score_label || ''}`,
          ML + CW / 2, y + 7.5,
          { align: 'center' }
        )
        y += 15
      }

      if (ds.panel_verdict) {
        y = bodyText(doc, y, ds.panel_verdict, { bold: true, size: 9, color: NAVY })
        y += 2
      }

      if (ds.strengths?.length) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        c(doc, 'text', GREEN)
        y = checkY(doc, y, 6)
        doc.text('Demonstrated Strengths', ML, y)
        y += 5
        ds.strengths.forEach(s => { y = bullet(doc, y, s) })
        y += 2
      }

      if (ds.gaps?.length) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        c(doc, 'text', AMBER)
        y = checkY(doc, y, 6)
        doc.text('Gaps to Address Before Real Defence', ML, y)
        y += 5
        ds.gaps.forEach(g => { y = bullet(doc, y, g) })
        y += 3
      }

      if (ds.final_advice) {
        const advLines = wrap(doc, ds.final_advice, CW - 10)
        const boxH = advLines.length * 4.5 + 12
        y = checkY(doc, y, boxH)
        c(doc, 'fill', [239, 246, 255])
        doc.rect(ML, y, CW, boxH, 'F')
        c(doc, 'fill', BLUE)
        doc.rect(ML, y, 2, boxH, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        c(doc, 'text', BLUE)
        doc.text('Final Advice:', ML + 5, y + 7)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        c(doc, 'text', [20, 50, 120])
        doc.text(advLines, ML + 5, y + 12)
        y += boxH + 4
      }
    }
  }

  // ── Examiner Questions from Project Reviewer ────────────────────────────
  const examinerQs = state.uploadedProject?.reviewData?.examiner_questions
  if (examinerQs?.length) {
    y = sectionBand(doc, y, 'EXAMINER QUESTIONS — FROM YOUR PROJECT', PURPLE)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    c(doc, 'text', SLATE5)
    y = checkY(doc, y, 6)
    doc.text('Generated by Project Reviewer — prepare answers before your real defence.', ML, y)
    y += 7

    examinerQs.forEach((q, idx) => {
      y = checkY(doc, y, 22)
      const num = q.number || idx + 1

      c(doc, 'fill', LIGHT)
      doc.rect(ML, y, CW, 8, 'F')
      c(doc, 'fill', PURPLE)
      doc.rect(ML, y, 1.8, 8, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      c(doc, 'text', PURPLE)
      doc.text(`Q${num}`, ML + 4, y + 5.5)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      c(doc, 'text', NAVY)
      const qLines = wrap(doc, q.question || '', CW - 22)
      doc.text(qLines[0] || '', ML + 14, y + 5.5)
      y += 10

      if (qLines.length > 1) {
        y = bodyText(doc, y, qLines.slice(1).join(' '), { indent: 14, size: 8.5 })
      }

      if (q.target) {
        y = bodyText(doc, y, 'Target: ' + q.target, { indent: 14, color: SLATE5, size: 7.5 })
      }
      y += 2
    })

    y += 4
    y = rule(doc, y)
  }

  // ── If nothing completed, show a note ───────────────────────────────────
  if (completedCount === 0) {
    y = checkY(doc, y, 20)
    c(doc, 'fill', LIGHT)
    doc.rect(ML, y, CW, 16, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    c(doc, 'text', SLATE5)
    doc.text('No steps completed yet. Complete at least one step to populate this report.', ML + CW / 2, y + 9, { align: 'center' })
    y += 20
  }

  // ── Footer on every page ─────────────────────────────────────────────────
  const numPages = doc.internal.getNumberOfPages()
  for (let p = 1; p <= numPages; p++) {
    doc.setPage(p)
    c(doc, 'fill', NAVY)
    doc.rect(0, H - 11, W, 11, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    c(doc, 'text', [80, 120, 170])
    doc.text('FYPro — AI-Powered Research Companion · CBC UNILAG Hackathon 2026', ML, H - 4)
    doc.text(`${p} / ${numPages}`, W - MR, H - 4, { align: 'right' })
  }

  // ── Filename & save ──────────────────────────────────────────────────────
  const rawTopic = state.validatedTopic || state.roughTopic || 'research'
  const slug = rawTopic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)

  doc.save(`FYPro-Progress-Report-${slug}.pdf`)
}
