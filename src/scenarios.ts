/**
 * Demo scenarios.
 *
 * A demo aid, not a product surface. Everything the switcher needs lives in
 * this file, `components/ScenarioSwitcher.tsx`, and the `applyScenario` block in
 * `store.tsx`. Deleting those three and the one line in `App.tsx` removes it
 * completely.
 */

export type ScenarioId =
  | 'signup-existing-tenant'
  | 'signup-first-of-domain'
  | 'signup-personal-provider'
  | 'signup-invited'
  | 'signup-nothing-open'
  | 'landing-long-document'
  | 'landing-first-visit'
  | 'landing-return'
  | 'extraction-low-confidence'
  | 'extraction-attachments'
  | 'matching-no-po'
  | 'matching-no-grn'
  | 'matching-po-balance'
  | 'matching-duplicate'
  | 'matching-variance'
  | 'posting-ready'
  | 'posting-sample-blocked'
  | 'posting-exported'
  | 'memory-about-to-form'
  | 'config-drift'
  | 'stp-inert'
  | 'queue-empty'
  | 'reset';

export interface Scenario {
  id: ScenarioId;
  group: string;
  label: string;
  detail: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'reset',
    group: 'Start',
    label: 'Opening position',
    detail: 'Signup screen, everything back to defaults. The same as reloading the page.',
  },

  {
    id: 'signup-existing-tenant',
    group: 'Signup',
    label: 'Domain already on Neoflo',
    detail: 'Stages the form with a neoflo.ai address. Sign in and you pick a workspace next.',
  },
  {
    id: 'signup-first-of-domain',
    group: 'Signup',
    label: 'First from a domain',
    detail: 'Stages the form with an unknown domain. Same signup, but no workspace list exists yet.',
  },
  {
    id: 'signup-personal-provider',
    group: 'Signup',
    label: 'Personal email refused',
    detail: 'Stages a gmail address. Both signup routes are blocked, with the reason on screen.'
  },
  {
    id: 'signup-invited',
    group: 'Signup',
    label: 'Arrived on an invitation',
    detail: 'Straight into AP EMEA as Reviewer. The workspace question is never asked.',
  },
  {
    id: 'signup-nothing-open',
    group: 'Signup',
    label: 'Tenant exists, nothing open to join',
    detail: 'Every workspace is private, so signing in reaches an empty routing screen.',
  },

  {
    id: 'landing-first-visit',
    group: 'Landing',
    label: 'First visit',
    detail: 'Welcome greeting, and the activation checklist leads.',
  },
  {
    id: 'landing-return',
    group: 'Landing',
    label: 'Returning visit',
    detail: 'Time-of-day greeting, a resume card for the last invoice, then the briefing.',
  },
  {
    id: 'landing-long-document',
    group: 'Landing',
    label: 'A long document already indexed',
    detail:
      'A 187-page contract bundle, for asking across a document no general assistant would take. Ask when a vendor can raise prices, or about notice on termination.',
  },

  {
    id: 'extraction-low-confidence',
    group: 'Extraction',
    label: 'Four fields below threshold',
    detail: 'INV-77120. Four fields flagged below the threshold, and the queue says a person should look. Nothing is blocked.',
  },
  {
    id: 'extraction-attachments',
    group: 'Extraction',
    label: 'Faktur Pajak attached',
    detail: 'INV-77120. Stored and carried to posting, never validated or compared.',
  },

  {
    id: 'matching-no-po',
    group: 'Matching',
    label: 'Hard block: no purchase order',
    detail: 'An invoice uploaded on its own with no ERP connected, so nothing can be matched.',
  },
  {
    id: 'matching-no-grn',
    group: 'Matching',
    label: 'Hard block: no goods receipt',
    detail: 'INV-88213 on a 3-way match. No override offered, because nothing was compared.',
  },
  {
    id: 'matching-po-balance',
    group: 'Matching',
    label: 'Exceeds the PO balance',
    detail: 'INV-44320. Overridable with a written reason, unlike a missing document.',
  },
  {
    id: 'matching-duplicate',
    group: 'Matching',
    label: 'Duplicate caught',
    detail: 'The third sample, matched. Other checks skipped, and rejection is the only way out.',
  },
  {
    id: 'matching-variance',
    group: 'Matching',
    label: 'Line variance against PO and GRN',
    detail: 'The second sample, matched. 120 invoiced against 100 ordered and received.',
  },

  {
    id: 'posting-ready',
    group: 'Posting',
    label: 'Cleared and ready to post',
    detail: 'INV-88213 with its GRN supplied and all three checks passed.',
  },
  {
    id: 'posting-sample-blocked',
    group: 'Posting',
    label: 'Sample cannot post',
    detail: 'The clean sample, cleared. Posting is disabled, so it finishes at Exported.',
  },
  {
    id: 'posting-exported',
    group: 'Posting',
    label: 'Exported is terminal',
    detail: 'INV-55891. Downloadable again, but it can never be posted.',
  },

  {
    id: 'memory-about-to-form',
    group: 'Memory',
    label: 'One correction from a memory',
    detail: 'A Cascade invoice at posting. Set a line to US-CA-SALES-7.25 and the memory forms.',
  },

  {
    id: 'config-drift',
    group: 'Configuration',
    label: 'Config changed, result did not',
    detail: 'Match type is 2-way while INV-88213 still holds its 3-way block, until it re-runs.',
  },
  {
    id: 'stp-inert',
    group: 'Configuration',
    label: 'Straight-through, but inert',
    detail: 'No ERP connected, so the setting reads as on while having nowhere to post.',
  },

  {
    id: 'queue-empty',
    group: 'Queue',
    label: 'Nothing in the queue',
    detail: 'A brand new workspace, before anything has been ingested.',
  },
];

export const SCENARIO_GROUPS = [
  'Start',
  'Signup',
  'Landing',
  'Extraction',
  'Matching',
  'Posting',
  'Memory',
  'Configuration',
  'Queue',
];
