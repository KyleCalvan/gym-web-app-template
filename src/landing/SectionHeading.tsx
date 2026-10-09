import type { ReactNode } from 'react';

/**
 * The heading + supporting-line pair that opens every content strip.
 *
 * Styling stays keyed to the parent strip in landing.css (`.promo-strip h2`,
 * `.plans-strip .sub`, the `::before` bar on `.hero-cards-row-inner h2`), so
 * this component carries no presentation of its own — pass the same `id` the
 * section's `aria-labelledby` points at.
 */
export default function SectionHeading({
  id,
  title,
  sub,
}: {
  id: string;
  title: ReactNode;
  sub: string;
}) {
  return (
    <>
      <h2 id={id}>{title}</h2>
      <p className="sub">{sub}</p>
    </>
  );
}
