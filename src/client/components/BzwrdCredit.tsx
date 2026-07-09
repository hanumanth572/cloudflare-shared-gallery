/**
 * "Designed by bzwrd" attribution, the self-contained embed variant from the
 * bzwrd brand pack (this project is not on the bzwrd token system). House
 * rules encoded here: wordmark lowercase, one caret only, Volt #CCFF00 is the
 * sole accent, the caret blinks as a live cursor and freezes under
 * prefers-reduced-motion. Styles live in styles.css under .bzwrd-credit.
 */
export default function BzwrdCredit() {
  return (
    <a
      className="bzwrd-credit"
      href="https://bzwrd.co.uk"
      rel="noopener"
      aria-label="Designed by bzwrd"
    >
      Designed by{" "}
      <span className="bzwrd-credit__wm">
        bzwrd
        <span className="bzwrd-credit__caret" aria-hidden="true" />
      </span>
    </a>
  );
}
