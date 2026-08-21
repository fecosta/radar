/**
 * The shell both pre-app screens render into: sign-in and the access gate.
 *
 * An ink brand panel beside the content, per the approved RADAR Mockups sign-in design.
 * Extracted because LoginScreen and AccessGate previously held the same shell recipe copied
 * between them — same gradient, card, radius and shadow, differing only in padding and width
 * — so a design change had to be made twice and drifted in between.
 *
 * The grid, the two panels' layout and the one breakpoint live in index.css (`.auth-split`,
 * `.auth-brand`, `.auth-content`): a media query cannot be expressed in a style attribute, and
 * keeping the layout there means the breakpoint adjusts it without needing !important to beat
 * an inline style.
 */

const ACRONYM = [
  ['R', 'epository for'],
  ['A', 'ssets,'],
  ['D', 'ecisions,'],
  ['A', 'nalysis, and'],
  ['R', 'esearch'],
];

export default function AuthShell({ children }) {
  return (
    <div className="auth-split" style={{ background: 'var(--bg)', fontFamily: 'var(--body)' }}>
      {/* Brand panel */}
      <div className="auth-brand" data-on-ink style={{ background: 'var(--ink)' }}>
        <div>
          <div style={{
            fontFamily: 'var(--sans)',
            fontSize: 46,
            fontWeight: 800,
            letterSpacing: 5,
            color: 'var(--on-ink)',
            lineHeight: 1,
          }}>
            RADAR
          </div>

          {/**
           * Stacked one line per initial, as designed. It is one phrase, so it stays a single
           * element with the line breaks presentational — a screen reader reads the expansion
           * rather than five disconnected fragments.
           */}
          <p style={{
            fontFamily: 'var(--sans)',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            color: 'var(--on-ink-muted)',
            lineHeight: 1.85,
            marginTop: 18,
          }}>
            {ACRONYM.map(([initial, rest], i) => (
              <span key={initial + rest} style={{ display: 'block' }}>
                <span style={{ color: 'var(--on-ink)', fontWeight: 800 }}>{initial}</span>
                {rest}
                {i < ACRONYM.length - 1 ? ' ' : ''}
              </span>
            ))}
          </p>
        </div>

        <div style={{ paddingTop: 28, borderTop: '1.5px dotted var(--ink-border)' }}>
          <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--on-ink)', maxWidth: 420 }}>
            Search the Shared Drive, find where a document belongs, and build canonical
            structures. One place, one taxonomy.
          </p>
          <p style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--on-ink-muted)', maxWidth: 420, marginTop: 10 }}>
            Content Manager access on the Shared Drive is required only for Create structure.
          </p>
          <div style={{
            fontFamily: 'var(--sans)',
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: 1.1,
            textTransform: 'uppercase',
            color: 'var(--on-ink-muted)',
            marginTop: 20,
          }}>
            VélezReyes+ internal tool
          </div>
        </div>
      </div>

      {/* Content panel */}
      <div className="auth-content">
        <div style={{ maxWidth: 420, width: '100%' }}>{children}</div>
      </div>
    </div>
  );
}

/** Section heading for the content panel, shared by both screens. */
export const AuthHeading = ({ children, eyebrow }) => (
  <>
    <h1 style={{
      fontFamily: 'var(--sans)',
      fontSize: 30,
      fontWeight: 800,
      letterSpacing: -0.6,
      color: 'var(--text)',
      lineHeight: 1.15,
    }}>
      {children}
    </h1>
    {eyebrow ? (
      <div style={{
        fontFamily: 'var(--sans)',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        marginTop: 6,
      }}>
        {eyebrow}
      </div>
    ) : null}
  </>
);

/** Body copy for the content panel. */
export const AuthBody = ({ children, style }) => (
  <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, marginTop: 18, ...style }}>
    {children}
  </p>
);

/**
 * A numbered list on accent discs. The digits are decoration beside the text, so they are
 * hidden from assistive tech and the list carries the order semantically.
 */
export const AuthNumberedList = ({ label, items, footnote }) => (
  <div style={{ marginTop: 26, paddingTop: 20, borderTop: '1.5px dotted var(--border)' }}>
    <div style={{
      fontFamily: 'var(--sans)',
      fontSize: 10.5,
      fontWeight: 800,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      marginBottom: 11,
    }}>
      {label}
    </div>
    <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
      {items.map((item, i) => (
        <li key={item} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
          <span aria-hidden="true" style={{
            fontFamily: 'var(--sans)',
            fontSize: 10,
            fontWeight: 800,
            color: 'var(--on-accent)',
            background: 'var(--accent)',
            borderRadius: 'var(--radius-pill)',
            width: 18,
            height: 18,
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {i + 1}
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {item}
          </span>
        </li>
      ))}
    </ol>
    {footnote ? (
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 13 }}>
        {footnote}
      </p>
    ) : null}
  </div>
);
