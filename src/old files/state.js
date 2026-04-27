// FYPro — Session State
// Single source of truth for all student data and step results.
// Persists to localStorage. Load on init, save after every mutation.

const State = {
  // Onboarding
  university: '',
  faculty: '',
  department: '',
  level: '',
  roughTopic: '',

  // Step 1 — Topic Validator
  topicValidation: null,
  validatedTopic: '',

  // Step 2 — Chapter Architect
  structureType: 'standard-5',
  totalWordCount: 0,
  chapterStructure: null,

  // Step 3 — Methodology Advisor
  methodology: null,
  chosenMethodology: '',

  // Step 4 — Writing Planner
  submissionDeadline: '',
  writingPlan: null,

  // Step 5 — Project Reviewer
  uploadedProject: null,       // { fileName, fileType, reviewData } set when student uploads

  // Step 6 — Defense Prep
  redFlags: null,

  // Defense Simulator
  defenseMode: 'text',
  defenseStarted: false,
  defenseApiMessages: [],
  defenseDisplayHistory: [],
  defenseSummary: null,
  defenseQuestionCount: 0,

  // Progress — 6 steps: Validator, Architect, Methodology, Planner, Reviewer, Defence
  stepsCompleted: [false, false, false, false, false, false],
  currentStep: 0,

  // Bookmarks (saved lines)
  bookmarks: [],

  // Cached rendered HTML for each step — used to restore results on back navigation
  stepResults: {},

  // Derived
  get isFullyComplete() {
    return this.stepsCompleted.every(Boolean);
  },

  get studentContext() {
    return {
      university: this.university,
      faculty: this.faculty,
      department: this.department,
      level: this.level,
      validatedTopic: this.validatedTopic || this.roughTopic,
      methodology: this.chosenMethodology,
      chapterCount: this.chapterStructure ? this.chapterStructure.total_chapters : null
    };
  },

  save() {
    const snapshot = {
      university: this.university,
      faculty: this.faculty,
      department: this.department,
      level: this.level,
      roughTopic: this.roughTopic,
      topicValidation: this.topicValidation,
      validatedTopic: this.validatedTopic,
      structureType: this.structureType,
      totalWordCount: this.totalWordCount,
      chapterStructure: this.chapterStructure,
      methodology: this.methodology,
      chosenMethodology: this.chosenMethodology,
      submissionDeadline: this.submissionDeadline,
      writingPlan: this.writingPlan,
      uploadedProject: this.uploadedProject,
      redFlags: this.redFlags,
      defenseMode: this.defenseMode,
      defenseStarted: this.defenseStarted,
      defenseApiMessages: this.defenseApiMessages,
      defenseDisplayHistory: this.defenseDisplayHistory,
      defenseSummary: this.defenseSummary,
      defenseQuestionCount: this.defenseQuestionCount,
      stepsCompleted: this.stepsCompleted,
      currentStep: this.currentStep,
      bookmarks: this.bookmarks,
      stepResults: this.stepResults || {}
    };
    try {
      localStorage.setItem('fypro_session', JSON.stringify(snapshot));
    } catch (e) {
      // Storage full — silent fail
    }
  },

  load() {
    const raw = localStorage.getItem('fypro_session');
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      Object.assign(this, data);
      return !!(this.university && this.roughTopic);
    } catch {
      return false;
    }
  },

  clear() {
    localStorage.removeItem('fypro_session');
    this.university = '';
    this.faculty = '';
    this.department = '';
    this.level = '';
    this.roughTopic = '';
    this.topicValidation = null;
    this.validatedTopic = '';
    this.structureType = 'standard-5';
    this.totalWordCount = 0;
    this.chapterStructure = null;
    this.methodology = null;
    this.chosenMethodology = '';
    this.submissionDeadline = '';
    this.writingPlan = null;
    this.uploadedProject = null;
    this.redFlags = null;
    this.defenseMode = 'text';
    this.defenseStarted = false;
    this.defenseApiMessages = [];
    this.defenseDisplayHistory = [];
    this.defenseSummary = null;
    this.defenseQuestionCount = 0;
    this.stepsCompleted = [false, false, false, false, false, false];
    this.currentStep = 0;
    this.bookmarks = [];
    this.stepResults = {};
  }
};
