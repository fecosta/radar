import { GOVERNANCE_FORUMS, themesForArea } from '../../../radar/canonicalTree.js';
import { SUPPORTED_YEAR_RANGE } from '../../../radar/structureInputs.js';
import { Callout, Field, inputStyle, MonoPath, SectionLabel } from '../ui.jsx';

/**
 * Step 2 — the details a template needs.
 *
 * Fields are driven by `template.fields`, so a template change cannot leave the form out of
 * sync with what the planner actually reads.
 */

const REQUIRED_FIELDS = new Set(['objectName', 'theme', 'meetingLogYear', 'forum', 'meetingDate', 'okrYear']);

function TextField({ field, label, hint, value, error, onChange }) {
  return (
    <Field label={label} hint={hint} error={error} required={REQUIRED_FIELDS.has(field)}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          type="text"
          value={value ?? ''}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(field, e.target.value)}
          style={inputStyle(invalid)}
        />
      )}
    </Field>
  );
}

function SelectField({ field, label, hint, value, error, options, placeholder, onChange }) {
  return (
    <Field label={label} hint={hint} error={error} required={REQUIRED_FIELDS.has(field)}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          value={value ?? ''}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(field, e.target.value)}
          style={inputStyle(invalid)}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export default function DetailsStep({ template, inputs, fieldErrors, onChange, plan }) {
  const has = (field) => template.fields.includes(field);
  const err = (field) => fieldErrors[field];

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* A structure that adds to an existing folder needs its precondition stated before the
          administrator fills the form, not after a blocked preview explains it. */}
      {template.requiresExistingObject ? (
        <Callout tone="info" title="This adds to a folder that must already exist">
          RADAR does not move folders. Move the approved organization folder into Portfolio
          yourself first, then use this to add the operating folders 05–12. The existing
          Sourcing, Screening and Diligence history is left untouched.
        </Callout>
      ) : null}

      {has('objectName') ? (
        <TextField
          field="objectName"
          label={template.objectNameLabel || 'Name'}
          hint={
            template.requiresExistingObject
              ? 'Type the folder name exactly as it appears in Portfolio — matching is exact, including accents and capitalisation.'
              : 'Used exactly as typed. Accents, spaces, +, &amp;, hyphens and apostrophes are kept.'
          }
          value={inputs.objectName}
          error={err('objectName')}
          onChange={onChange}
        />
      ) : null}

      {/* Themes are per location: only the areas v06 defines Cross_Thematic in offer it. */}
      {has('theme') ? (
        <SelectField
          field="theme"
          label="Theme"
          hint={template.themeHint}
          placeholder="Select a theme"
          options={themesForArea(template.themeArea).map((t) => ({ value: t, label: t }))}
          value={inputs.theme}
          error={err('theme')}
          onChange={onChange}
        />
      ) : null}

      {has('forum') ? (
        <SelectField
          field="forum"
          label="Forum"
          hint="Only formal institutional forums. Concept Review and Investment Committee stay with the project."
          placeholder="Select a forum"
          options={GOVERNANCE_FORUMS.map((f) => ({ value: f.id, label: f.label }))}
          value={inputs.forum}
          error={err('forum')}
          onChange={onChange}
        />
      ) : null}

      {has('meetingDate') ? (
        <Field label="Meeting date" hint="The year folder is derived from this date." error={err('meetingDate')} required>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              type="date"
              value={inputs.meetingDate ?? ''}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              onChange={(e) => onChange('meetingDate', e.target.value)}
              style={inputStyle(invalid)}
            />
          )}
        </Field>
      ) : null}

      {has('okrYear') ? (
        <TextField
          field="okrYear"
          label="OKR year"
          hint={`Four digits, ${SUPPORTED_YEAR_RANGE.min}–${SUPPORTED_YEAR_RANGE.max}. Years are never mixed in one folder.`}
          value={inputs.okrYear}
          error={err('okrYear')}
          onChange={onChange}
        />
      ) : null}

      {has('owner') ? (
        <TextField
          field="owner"
          label="Owner"
          hint="Recorded in the Master Registry."
          value={inputs.owner}
          error={err('owner')}
          onChange={onChange}
        />
      ) : null}

      {has('country') ? (
        <TextField
          field="country"
          label="Country or geography"
          hint="Recorded in the Master Registry."
          value={inputs.country}
          error={err('country')}
          onChange={onChange}
        />
      ) : null}

      {has('strategicFocus') ? (
        <TextField
          field="strategicFocus"
          label="Strategic focus"
          hint="Metadata only — strategic focus never becomes a folder in the path."
          value={inputs.strategicFocus}
          error={err('strategicFocus')}
          onChange={onChange}
        />
      ) : null}

      {has('meetingLogYear') ? (
        <TextField
          field="meetingLogYear"
          label="Meeting log year"
          hint="Names the yearly living Meeting Log and its Raw_Notes folder."
          value={inputs.meetingLogYear}
          error={err('meetingLogYear')}
          onChange={onChange}
        />
      ) : null}

      {plan ? (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <SectionLabel>Destination</SectionLabel>
          <div style={{ marginTop: 6 }}>
            <MonoPath>{plan.destination.path}</MonoPath>
          </div>
        </div>
      ) : null}
    </div>
  );
}
