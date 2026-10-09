// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import SectionHeading from './SectionHeading.tsx';
import { cx } from './landing-utils.ts';

function PlansStrip({ plansRef, activePlans, onNavigate }) {
  // The plans strip is a native scroll-snap carousel below 900px (see
  // landing.css). These dots are its only controls — the peeking next card
  // does the affordance work, the dots just report position and offer a jump.
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  // A card's x in the track's content space — i.e. the scrollLeft that would
  // park it at the snap position. offsetLeft can't be trusted here (the track
  // isn't positioned), so it's measured off the track's own rect, which stays
  // correct at any zoom because the whole strip is counter-zoomed back to
  // device scale. scrollLeft is added back in because getBoundingClientRect is
  // already scroll-relative.
  const cardX = (track: HTMLElement, card: Element) =>
    card.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft;

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const sync = () => {
      const cards = track.querySelectorAll('.plan-card');
      if (!cards.length) return;
      let best = 0, bestDelta = Infinity;
      cards.forEach((card, i) => {
        const delta = Math.abs(cardX(track, card) - track.scrollLeft);
        if (delta < bestDelta) { bestDelta = delta; best = i; }
      });
      setActiveIndex(best);
    };

    track.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
    return () => {
      track.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [activePlans]);

  const scrollToPlan = (i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelectorAll('.plan-card')[i];
    if (!card) return;
    track.scrollTo({ left: cardX(track, card), behavior: 'smooth' });
  };

  return (
    <section
      className="plans-strip dark-section"
      id="plans"
      ref={plansRef}
      aria-labelledby="plans-heading"
    >
      <div className="plans-strip-inner">
        <SectionHeading
          id="plans-heading"
          title="Membership Plans"
          sub="Pick a plan that fits your goals — switch or cancel anytime."
        />
        <div className="grid grid-3" ref={trackRef}>
          {activePlans.map((p) => (
            <div className={cx('plan-card soft-card', p.featured && 'featured')} key={p.name}>
              {p.featured && <span className="ribbon">Most Popular</span>}
              <h3>{p.name}</h3>
              <div className="price">₱{p.price.toLocaleString('en-PH')}<span>/{p.period}</span></div>
              <ul>{p.perks.map((perk, i) => <li key={i}><Check size={13} strokeWidth={2.5} aria-hidden="true" /><span>{perk}</span></li>)}</ul>
              <button
                className={"btn btn-sm btn-block " + (p.featured ? 'btn-signal' : 'btn-outline')}
                onClick={() => onNavigate && onNavigate('/login')}
              >Choose {p.name}</button>
            </div>
          ))}
          {activePlans.length === 0 && (
            <div className="empty-state">No membership plans available — please check back soon.</div>
          )}
        </div>

        {activePlans.length > 1 && (
          <div className="plan-carousel-dots" aria-label="Choose a membership plan">
            {activePlans.map((p, i) => (
              <button
                key={p.name}
                type="button"
                className={cx('plan-dot', i === activeIndex && 'active')}
                onClick={() => scrollToPlan(i)}
                aria-label={`Go to plan ${i + 1}: ${p.name}`}
                aria-current={i === activeIndex ? 'true' : 'false'}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default PlansStrip;
