/**
 * companyProfile.js — the 11-question Company Profile survey shown after
 * registration, and its persistence.
 *
 * MOCK DATA / PERSISTENCE NOTICE
 * -------------------------------
 * The backend has no schema for these fields (only `name`, `industry`, and a
 * free-text `years` value are accepted by /api/companies/{id}/setup — see
 * wizard.py). Rather than invent backend functionality, answers are kept
 * client-side in localStorage, namespaced per company_id. This is what makes
 * the survey resumable: a user who skips it can return later (via the
 * Profile page's "Complete Profile" button) and pick up where they left off.
 * Replace with a real endpoint once one exists — every read/write goes
 * through the two functions below, so that would be a small, contained change.
 */

const STORAGE_PREFIX = 'nirmaan_profile_';

// ---------------------------------------------------------------------------
// Question metadata — single source of truth for the form AND the read-only
// Profile page display (labels, grouping, option lists).
// ---------------------------------------------------------------------------

export const PROFILE_SECTIONS = [
  { id: 'basics', label: 'Company Basics' },
  { id: 'business', label: 'Business Profile' },
  { id: 'plans', label: 'IPO Plans' },
];

export const PROFILE_QUESTIONS = [
  {
    key: 'legal_name',
    section: 'basics',
    label: "What is your company's legal name?",
    type: 'text',
    required: true,
  },
  {
    key: 'org_type',
    section: 'basics',
    label: 'What type of organization is your company?',
    type: 'select',
    required: true,
    options: [
      'Private Limited Company',
      'Public Limited Company',
      'Limited Liability Partnership (LLP)',
      'Partnership Firm',
      'One Person Company (OPC)',
      'Sole Proprietorship',
    ],
  },
  {
    key: 'industry',
    section: 'basics',
    label: 'Which industry best describes your business?',
    type: 'select',
    required: true,
    options: [
      'Information Technology / Software',
      'Manufacturing',
      'Pharmaceuticals / Healthcare',
      'FMCG',
      'Financial Services',
      'Retail / E-commerce',
      'Textiles',
      'Real Estate / Construction',
      'Logistics',
      'Agriculture',
      'Other',
    ],
  },
  {
    key: 'incorporation_date',
    section: 'basics',
    label: 'When was your company incorporated?',
    type: 'date',
    required: true,
  },
  {
    key: 'cin',
    section: 'basics',
    label: 'What is your Corporate Identification Number (CIN)?',
    type: 'text',
    required: false,
    optional: true,
  },
  {
    key: 'business_model',
    section: 'business',
    label: 'Which best describes your primary business model?',
    type: 'select',
    required: true,
    options: ['B2B', 'B2C', 'B2B & B2C', 'D2C', 'Marketplace', 'Manufacturing', 'Service Provider', 'Other'],
  },
  {
    key: 'employee_count',
    section: 'business',
    label: 'Approximately how many employees does your company have?',
    type: 'select',
    required: true,
    options: ['1–10', '11–25', '26–50', '51–100', '101–250', '251–500', 'More than 500'],
  },
  {
    key: 'annual_revenue',
    section: 'business',
    label: "What is your company's approximate annual revenue?",
    type: 'select',
    required: true,
    options: [
      'Less than ₹5 Crore',
      '₹5–10 Crore',
      '₹10–25 Crore',
      '₹25–50 Crore',
      '₹50–100 Crore',
      'More than ₹100 Crore',
      'Prefer not to answer',
    ],
  },
  {
    key: 'purpose',
    section: 'plans',
    label: 'What brings you to our platform today?',
    type: 'select',
    required: true,
    options: [
      'Preparing for an SME IPO',
      'Exploring IPO readiness',
      'Creating IPO documentation',
      'Evaluating the platform',
      'Other',
    ],
  },
  {
    key: 'ipo_timeline',
    section: 'plans',
    label: 'When are you planning to launch your SME IPO?',
    type: 'select',
    required: true,
    options: ['Within 3 months', '3–6 months', '6–12 months', 'More than 1 year', 'Just exploring'],
  },
  {
    key: 'intermediaries',
    section: 'plans',
    label: 'Have you already appointed any IPO intermediaries?',
    type: 'multiselect',
    required: true,
    options: ['Merchant Banker', 'Legal Advisor', 'Auditor', 'Registrar'],
    noneOption: 'None yet',
  },
];

const REQUIRED_KEYS = PROFILE_QUESTIONS.filter((q) => q.required).map((q) => q.key);

// ---------------------------------------------------------------------------
// Demo account defaults
// ---------------------------------------------------------------------------
// The demo login (demo@nirmaan.ai) is backed by real seeded Company /
// FinancialStatement / OfferDetails / DirectorKMP records in the backend
// (src/extraction/db_session.py: seed_demo_user()), not by this localStorage
// survey — so a fresh demo login has never "answered" these questions and
// shows 0% even though the answers to most of them are already known.
// Prefill from that real seeded data instead of leaving it blank. Fields
// with no real backend equivalent (incorporation_date, employee_count,
// ipo_timeline) are left unanswered rather than guessed.
const DEMO_COMPANY_NAME = 'Nirmaan Technologies Ltd';

const DEMO_PROFILE_DEFAULTS = {
  legal_name: 'Nirmaan Technologies Ltd',
  org_type: 'Private Limited Company',
  industry: 'Manufacturing',
  cin: 'U72200MH2021PTC123456',
  business_model: 'Manufacturing',
  annual_revenue: '₹10–25 Crore',
  purpose: 'Preparing for an SME IPO',
  intermediaries: ['None yet'],
};

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * getCompanyProfile(companyId, companyName?) → saved answers object.
 * For the seeded demo account, unanswered fields fall back to
 * DEMO_PROFILE_DEFAULTS; anything already saved (a real edit) always wins.
 */
export function getCompanyProfile(companyId, companyName) {
  if (!companyId) return {};
  let saved = {};
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + companyId);
    saved = raw ? JSON.parse(raw) : {};
  } catch {
    saved = {};
  }
  if (companyName === DEMO_COMPANY_NAME) {
    return { ...DEMO_PROFILE_DEFAULTS, ...saved };
  }
  return saved;
}

/** saveCompanyProfile(companyId, answers) — merges over any existing saved answers. */
export function saveCompanyProfile(companyId, answers) {
  if (!companyId) return;
  const merged = { ...getCompanyProfile(companyId), ...answers };
  localStorage.setItem(STORAGE_PREFIX + companyId, JSON.stringify(merged));
  return merged;
}

/**
 * computeProfileCompletion(answers) → { percent, answeredCount, totalCount }
 * Only required questions count toward completion — CIN is explicitly optional.
 */
export function computeProfileCompletion(answers = {}) {
  const totalCount = REQUIRED_KEYS.length;
  const answeredCount = REQUIRED_KEYS.filter((key) => {
    const v = answers[key];
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && String(v).trim() !== '';
  }).length;
  const percent = totalCount ? Math.round((answeredCount / totalCount) * 100) : 0;
  return { percent, answeredCount, totalCount };
}
