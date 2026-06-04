import { describe, it, expect } from 'vitest'
import {
  esc, STEP_COLORS, SHIELD_PATH,
  badge, bodyText, bulletList, subsectionLabel, warningBox, infoBox, kvRow,
  buildStepCard, buildHeader, buildProgressBar, buildFooter,
  buildStep1, buildStep2, buildStep3, buildStep4, buildStep5, buildStep6,
  buildLiteratureMap, buildAbstractGenerator, buildInstrumentBuilder,
  buildExaminerQs, buildClosingMessage, buildReportHTML,
} from './generateReport.js'

// ── esc ───────────────────────────────────────────────────────────────────────
describe('esc', () => {
  it('escapes special chars', () => expect(esc('<b>a & "b"</b>')).toBe('&lt;b&gt;a &amp; &quot;b&quot;&lt;/b&gt;'))
  it('returns empty for null',      () => expect(esc(null)).toBe(''))
  it('returns empty for undefined', () => expect(esc(undefined)).toBe(''))
  it('converts number to string',   () => expect(esc(42)).toBe('42'))
})

// ── STEP_COLORS ───────────────────────────────────────────────────────────────
describe('STEP_COLORS', () => {
  it('has 6 entries', () => expect(STEP_COLORS).toHaveLength(6))
  it('each has border/bg/label/name', () => {
    STEP_COLORS.forEach((c, i) => {
      expect(c.border, `step ${i}`).toBeTruthy()
      expect(c.bg,     `step ${i}`).toBeTruthy()
      expect(c.label,  `step ${i}`).toBeTruthy()
      expect(c.name,   `step ${i}`).toBeTruthy()
    })
  })
  it('colors', () => {
    expect(STEP_COLORS[0].border).toBe('#0066FF')
    expect(STEP_COLORS[1].border).toBe('#0891B2')
    expect(STEP_COLORS[2].border).toBe('#7C3AED')
    expect(STEP_COLORS[3].border).toBe('#F59E0B')
    expect(STEP_COLORS[4].border).toBe('#16A34A')
    expect(STEP_COLORS[5].border).toBe('#DC2626')
  })
})

// ── buildStepCard ─────────────────────────────────────────────────────────────
describe('buildStepCard', () => {
  it('wraps in white card', () => { expect(buildStepCard(0, '')).toContain('background:#FFFFFF') })
  it('applies step 0 blue border', () => { expect(buildStepCard(0, '')).toContain('border-left:5px solid #0066FF') })
  it('applies step 2 purple border', () => { expect(buildStepCard(2, '')).toContain('border-left:5px solid #7C3AED') })
  it('renders step 1 number watermark', () => { expect(buildStepCard(0, '')).toContain('>1<') })
  it('renders step 5 number watermark', () => { expect(buildStepCard(4, '')).toContain('>5<') })
  it('watermark has low opacity', () => { expect(buildStepCard(0, '')).toContain('opacity:0.06') })
})

// ── buildProgressBar ──────────────────────────────────────────────────────────
describe('buildProgressBar', () => {
  it('renders 6 segments', () => {
    const matches = buildProgressBar([]).match(/flex:1/g)
    expect(matches).toHaveLength(6)
  })
  it('completed step is green',   () => { expect(buildProgressBar([true])).toContain('#16A34A') })
  it('incomplete step is dim',    () => { expect(buildProgressBar([false])).toContain('rgba(255,255,255,0.15)') })
})

// ── buildHeader ───────────────────────────────────────────────────────────────
describe('buildHeader', () => {
  const s = { name: 'Temi', department: 'CS', level: '400L', university: 'UNILAG', stepsCompleted: [true, true], validatedTopic: 'My Topic' }
  it('renders name and department', () => { expect(buildHeader(s, null)).toContain('Temi') })
  it('renders topic',               () => { expect(buildHeader(s, null)).toContain('My Topic') })
  it('includes shield path',        () => { expect(buildHeader(s, null)).toContain(SHIELD_PATH) })
  it('shows completion count',      () => { expect(buildHeader(s, null)).toContain('2 / 6') })
  it('falls back to FYPro text',    () => { expect(buildHeader(s, null)).toContain('FYPro') })
})

// ── buildFooter ───────────────────────────────────────────────────────────────
describe('buildFooter', () => {
  it('contains fypro.com.ng', () => { expect(buildFooter('04 Jun')).toContain('fypro.com.ng') })
  it('contains date',          () => { expect(buildFooter('04 Jun')).toContain('04 Jun') })
})

// ── buildStep1 ────────────────────────────────────────────────────────────────
describe('buildStep1', () => {
  const s = { stepsCompleted:[true], validatedTopic:'My Topic', roughTopic:'', topicValidation:{ verdict:'Researchable', verdict_reason:'Strong.' } }
  it('renders topic',                () => { expect(buildStep1(s)).toContain('My Topic') })
  it('renders green badge',          () => { const h = buildStep1(s); expect(h).toContain('RESEARCHABLE'); expect(h).toContain('#16A34A') })
  it('renders verdict reason',       () => { expect(buildStep1(s)).toContain('Strong.') })
  it('amber for Needs Refinement',   () => { expect(buildStep1({...s, topicValidation:{verdict:'Needs Refinement',verdict_reason:''}})).toContain('#F59E0B') })
  it('red for Not Viable',           () => { expect(buildStep1({...s, topicValidation:{verdict:'Not Viable',verdict_reason:''}})).toContain('#DC2626') })
  it('falls back to roughTopic',     () => { expect(buildStep1({stepsCompleted:[true],validatedTopic:'',roughTopic:'Rough',topicValidation:null})).toContain('Rough') })
})

// ── buildStep2 ────────────────────────────────────────────────────────────────
describe('buildStep2', () => {
  const s = { chapterStructure:{ total_chapters:5, total_word_count:12500, structure_note:'Standard.', chapters:[{number:1,title:'Introduction',word_count_target:1500}] } }
  it('renders totals',         () => { const h = buildStep2(s); expect(h).toContain('5'); expect(h).toContain('12,500') })
  it('renders chapter row',    () => { expect(buildStep2(s)).toContain('Introduction') })
  it('renders Ch.1',           () => { expect(buildStep2(s)).toContain('Ch.1') })
  it('renders structure note', () => { expect(buildStep2(s)).toContain('Standard.') })
  it('returns empty string when chapterStructure is null', () => { expect(buildStep2({ chapterStructure: null })).toBe('') })
})

// ── buildStep3 ────────────────────────────────────────────────────────────────
describe('buildStep3', () => {
  const s = {
    chosenMethodology:'Survey Research',
    methodology:{ recommended_reason:'Best fit.', watch_out:'Justify sample.', options:[{methodology:'Survey Research',data_collection:['Questionnaire']}] }
  }
  it('renders chosen methodology', () => { expect(buildStep3(s)).toContain('Survey Research') })
  it('renders recommended reason', () => { expect(buildStep3(s)).toContain('Best fit.') })
  it('renders watch_out',          () => { expect(buildStep3(s)).toContain('Justify sample.') })
  it('renders data collection',    () => { expect(buildStep3(s)).toContain('Questionnaire') })
  it('returns empty when no methodology', () => { expect(buildStep3({ chosenMethodology: null, methodology: null })).toBe('') })
})

// ── buildStep4 ────────────────────────────────────────────────────────────────
describe('buildStep4', () => {
  const s = {
    submissionDeadline:'2026-08-30',
    writingPlan:{ total_weeks:14, weekly_average:893, weeks:[
      {week_number:1,dates:'28 Apr',focus:'Chapter 1',is_buffer_week:false,is_holiday_week:false},
      {week_number:5,dates:'26 May',focus:'Holiday',  is_buffer_week:false,is_holiday_week:true},
    ]}
  }
  it('renders deadline',    () => { expect(buildStep4(s)).toContain('30 August 2026') })
  it('renders total weeks', () => { expect(buildStep4(s)).toContain('14') })
  it('renders week row',    () => { expect(buildStep4(s)).toContain('Chapter 1') })
  it('holiday week is red', () => { expect(buildStep4(s)).toContain('#DC2626') })
  it('shows overflow',      () => {
    const many = {...s, writingPlan:{...s.writingPlan, weeks:Array.from({length:12},(_,i)=>({week_number:i+1,dates:'',focus:`W${i+1}`,is_buffer_week:false,is_holiday_week:false}))}}
    expect(buildStep4(many)).toContain('+ 2 more weeks')
  })
  it('returns empty when no writingPlan', () => { expect(buildStep4({ writingPlan: null })).toBe('') })
})

// ── buildStep5 ────────────────────────────────────────────────────────────────
describe('buildStep5', () => {
  const s = { stepsCompleted:[true,true,true,true,true], uploadedProject:{ fileName:'thesis.pdf', reviewData:{ grade:'Merit', score_estimate:'68%', grade_justification:'Good.', strengths:[{title:'Clear aims',detail:'Well defined.'}], weaknesses:[{title:'Sample size',detail:'Needs justification.'}] } } }
  it('renders filename',    () => { expect(buildStep5(s)).toContain('thesis.pdf') })
  it('renders grade badge', () => { const h = buildStep5(s); expect(h).toContain('MERIT'); expect(h).toContain('68%') })
  it('renders strengths',   () => { expect(buildStep5(s)).toContain('Clear aims') })
  it('renders weaknesses',  () => { expect(buildStep5(s)).toContain('Sample size') })
  it('empty when no data',  () => { expect(buildStep5({stepsCompleted:[true,true,true,true,false]})).toBe('') })
})

// ── buildStep6 ────────────────────────────────────────────────────────────────
describe('buildStep6', () => {
  const s = {
    defenseSummary:{ panel_score:8, panel_score_label:'Ready', panel_verdict:'Strong.', strengths:['Good awareness'], gaps:['Methodology depth'] },
    redFlags:{ flags:[{severity:'Critical',title:'Sample Size',advice:'Use Cochran.'},{severity:'Serious',title:'Mixed Methods',advice:'Justify.'}] }
  }
  it('renders score badge',    () => { const h = buildStep6(s); expect(h).toContain('8 / 10'); expect(h).toContain('Ready') })
  it('renders panel verdict',  () => { expect(buildStep6(s)).toContain('Strong.') })
  it('renders CRITICAL flag',  () => { expect(buildStep6(s)).toContain('CRITICAL') })
  it('critical uses red',      () => { expect(buildStep6(s)).toContain('#DC2626') })
  it('serious uses amber',     () => { expect(buildStep6(s)).toContain('#F59E0B') })
  it('renders strengths/gaps', () => { const h = buildStep6(s); expect(h).toContain('Good awareness'); expect(h).toContain('Methodology depth') })
})

// ── Companion cards ───────────────────────────────────────────────────────────
describe('buildLiteratureMap', () => {
  const s = { literatureMap:{ thematic_areas:[{theme:'Digital Finance',search_terms:['fintech']}], source_types:[], papers:[{title:'Mobile Payments',authors:['Osei, K'],year:2023}] } }
  it('empty when no literatureMap', () => { expect(buildLiteratureMap({})).toBe('') })
  it('uses dashed border',          () => { expect(buildLiteratureMap(s)).toContain('dashed') })
  it('renders theme',               () => { expect(buildLiteratureMap(s)).toContain('Digital Finance') })
  it('shows Companion — prefix',    () => { expect(buildLiteratureMap(s)).toContain('Companion —') })
  it('renders paper title',         () => { expect(buildLiteratureMap(s)).toContain('Mobile Payments') })
})

describe('buildAbstractGenerator', () => {
  const s = { abstractData:{ background:'Mobile banking is growing.', problem_statement:'Rural excluded.', objectives:'Assess barriers.', methodology:'Mixed.', expected_contribution:'Policy.' } }
  it('empty when no abstractData', () => { expect(buildAbstractGenerator({})).toBe('') })
  it('uses dashed border',         () => { expect(buildAbstractGenerator(s)).toContain('dashed') })
  it('renders background',         () => { expect(buildAbstractGenerator(s)).toContain('Mobile banking is growing.') })
  it('shows Companion — prefix',   () => { expect(buildAbstractGenerator(s)).toContain('Companion —') })
})

describe('buildInstrumentBuilder', () => {
  const s = { instrumentBuilder:{ instrument_title:'My Survey', methodology:'Survey', sections:[{section_title:'Sec A',questions:[{number:1,text:'Your age?',type:'MCQ',scale:null}]}] } }
  it('empty when no instrumentBuilder', () => { expect(buildInstrumentBuilder({})).toBe('') })
  it('uses dashed border',              () => { expect(buildInstrumentBuilder(s)).toContain('dashed') })
  it('renders title',                   () => { expect(buildInstrumentBuilder(s)).toContain('My Survey') })
  it('renders question text',           () => { expect(buildInstrumentBuilder(s)).toContain('Your age?') })
})

// ── buildClosingMessage ───────────────────────────────────────────────────────
describe('buildClosingMessage', () => {
  it('contains heading',     () => { expect(buildClosingMessage()).toContain("You've done the thinking") })
  it('contains shield path', () => { expect(buildClosingMessage()).toContain(SHIELD_PATH) })
  it('contains FYPro brand', () => { expect(buildClosingMessage()).toContain('FYPro') })
  it('dark navy background', () => { expect(buildClosingMessage()).toContain('#0D1B2A') })
})

// ── buildExaminerQs ───────────────────────────────────────────────────────────
describe('buildExaminerQs', () => {
  const qs = [{number:1,question:'Why this sample size?',target:'Methodology'}]
  it('renders question', () => { expect(buildExaminerQs(qs)).toContain('Why this sample size?') })
  it('renders Q label',  () => { expect(buildExaminerQs(qs)).toContain('Q1') })
  it('returns empty for null input', () => { expect(buildExaminerQs(null)).toBe('') })
  it('returns empty for empty array', () => { expect(buildExaminerQs([])).toBe('') })
})

// ── buildReportHTML ───────────────────────────────────────────────────────────
describe('buildReportHTML', () => {
  const full = {
    name:'Temi', department:'CS', level:'400L', university:'UNILAG',
    validatedTopic:'My Topic', roughTopic:'',
    stepsCompleted:[true,true,true,true,true,true],
    topicValidation:{ verdict:'Researchable', verdict_reason:'Good.' },
    chapterStructure:{ total_chapters:5, total_word_count:12500, chapters:[{number:1,title:'Intro',word_count_target:1500}] },
    chosenMethodology:'Survey', methodology:{ recommended_reason:'Best.', watch_out:'Check.', options:[{methodology:'Survey',data_collection:['Q']}] },
    submissionDeadline:'2026-08-30',
    writingPlan:{ total_weeks:14, weekly_average:893, weeks:[{week_number:1,dates:'',focus:'Ch1',is_buffer_week:false,is_holiday_week:false}] },
    uploadedProject:{ fileName:'thesis.pdf', reviewData:{ grade:'Merit', score_estimate:'68%', grade_justification:'Good.', strengths:[], weaknesses:[] } },
    defenseSummary:{ panel_score:8, panel_score_label:'Ready', panel_verdict:'Strong.', strengths:[], gaps:[] },
    redFlags:{ flags:[] },
  }
  it('contains topic',              () => { expect(buildReportHTML(full, null)).toContain('My Topic') })
  it('contains all 6 step names',   () => {
    const h = buildReportHTML(full, null)
    expect(h).toContain('Topic Validator'); expect(h).toContain('Chapter Architect')
    expect(h).toContain('Methodology Advisor'); expect(h).toContain('Writing Planner')
    expect(h).toContain('Project Reviewer'); expect(h).toContain('Defense Prep')
  })
  it('contains closing message',    () => { expect(buildReportHTML(full, null)).toContain("You've done the thinking") })
  it('contains footer',             () => { expect(buildReportHTML(full, null)).toContain('fypro.com.ng') })
  it('skips step2 if no chapters',  () => { expect(buildReportHTML({...full, chapterStructure:null}, null)).not.toContain('Chapter Architect') })
  it('empty state shows placeholder', () => { expect(buildReportHTML({...full, stepsCompleted:[]}, null)).toContain('No steps completed yet') })
  it('closing message always shown',  () => { expect(buildReportHTML({...full, stepsCompleted:[]}, null)).toContain("You've done the thinking") })
  it('wraps in 794px container',    () => { expect(buildReportHTML(full, null)).toContain('794px') })
})
