/**
 * Every word the tour says, in one place.
 *
 * Drawn from docs/operations/using-radar.md and README.md so the tour restates the product's
 * own language instead of inventing a second version of it.
 *
 * DELIBERATELY ABSENT: canonical folder names, paths, and routing rules. The approved
 * specification and the Folder Use Guidelines own the taxonomy; if the tour repeated any of it,
 * it would become a third source of truth that drifts silently the next time the tree changes.
 * The tour teaches what the three workflows are *for*.
 */

/** Read-only / writes-to-Drive, said the same way on every step that needs it. */
const READ_ONLY = 'Read-only — nothing is changed.';

export const WELCOME = {
  id: 'welcome',
  title: 'Welcome to RADAR',
  body:
    'RADAR helps you find information, decide where documents belong, and create approved ' +
    'folder structures in the Shared Drive.',
  /** The three workflows, introduced before any of them is highlighted. */
  workflows: [
    {
      name: 'Search',
      text: 'Find files and information across the RADAR Shared Drive.',
    },
    {
      name: 'Classify',
      text: 'Describe a document and RADAR recommends its official location and file name.',
    },
    {
      name: 'Create structure',
      text:
        'Build approved folder structures safely after reviewing exactly what RADAR will ' +
        'create.',
    },
  ],
  safety: 'RADAR never deletes, moves or renames files, and it never changes permissions.',
  primary: 'Take the tour',
  secondary: 'Skip for now',
};

/**
 * The three feature steps.
 *
 * `target` is the `data-tour` value to spotlight. `activatesTab` is the mode to switch to while
 * the step is shown — deliberately null for create-structure: opening that workflow presents a
 * Google permission request, and a tour must never nudge someone into granting write access
 * they have not chosen to grant. See the note on that step.
 */
export const FEATURE_STEPS = [
  {
    id: 'search',
    target: 'search',
    activatesTab: 'search',
    title: 'Find what already exists',
    body:
      'Search looks across file names and file contents in the RADAR Shared Drive. Use ' +
      'filters to narrow results, then open the original file in Google Drive when you need ' +
      'to work with it.',
    note: READ_ONLY,
  },
  {
    id: 'classify',
    target: 'classify',
    activatesTab: 'classify',
    title: 'Know where a document belongs',
    body:
      'Describe what you want to save and RADAR recommends the official folder and naming ' +
      'convention. Check the confidence, read “Why”, and add Object, Context or Theme when ' +
      'RADAR needs more information.',
    note: 'Read-only. It recommends a location but never moves the document.',
  },
  {
    id: 'create-structure',
    /* Matches the tab's own mode key, which is what `data-tour` is derived from — one
       identifier, not a parallel naming scheme that can drift. */
    target: 'create',
    activatesTab: null,
    title: 'Create approved structures safely',
    body:
      'Create structure builds approved folder structures in the Shared Drive. RADAR checks ' +
      'the live Drive first, shows a preview, and creates only what is missing after you ' +
      'explicitly confirm.',
    note:
      'Nothing is deleted, moved or renamed, and permissions are never changed. This workflow ' +
      'asks for additional Google permission when you open it yourself.',
  },
];

export const COMPLETE = {
  id: 'complete',
  title: 'You’re ready to use RADAR',
  body:
    'Start by searching for something you know already exists, or use Classify when you’re ' +
    'unsure where a document belongs.',
  primary: 'Start searching',
  secondary: 'Done',
  replayHint: 'You can reopen this any time with “Take the RADAR tour”.',
};

/** Shared button labels, so Back/Next/Skip read identically on every step. */
export const LABELS = {
  back: 'Back',
  next: 'Next',
  finish: 'Finish',
  skip: 'Skip tour',
};

/** "Step 2 of 3" — counts only the feature steps, so the numbers match what is highlighted. */
export function progressLabel(featureIndex) {
  return `Step ${featureIndex + 1} of ${FEATURE_STEPS.length}`;
}
