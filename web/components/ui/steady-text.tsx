/**
 * Text that browser extensions may rewrite, such as phone numbers. Click-to-call extensions (3CX and
 * others) replace the text around a number with their own link, and React then crashes the page when it
 * next updates or removes the text node it made. Keeping the text alone in its own span confines the
 * extension's changes to that span. Keying the span by its text means a change swaps the whole span,
 * so React never edits the replaced text node.
 */
export function SteadyText({ text, className }: { text?: string | null; className?: string }) {
  if (!text) return null;
  return (
    <span key={text} className={className}>
      {text}
    </span>
  );
}
