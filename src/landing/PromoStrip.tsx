// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import RevealCard from './RevealCard.tsx';
import SectionHeading from './SectionHeading.tsx';

function PromoStrip({ promotionsRef, activePromos }) {
  // Respect prefers-reduced-motion: skip autoplay entirely if the user
  // has it set (no carousel movement on its own).
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The carousel is a desktop affordance. Below 901px the promotions fall into
  // the same two-column grid the rest of the page uses (see landing.css), so
  // embla is stood down there rather than left fighting the grid layout. It's
  // kept mounted but inactive — `active:false` stops it from dragging the track,
  // transforming it, or autoplaying, while leaving the markup untouched. The
  // matchMedia is read up front so the first paint is already right.
  const [isWide, setIsWide] = useState<boolean>(
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(min-width: 901px)').matches
      : true
  );
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 901px)');
    const sync = () => setIsWide(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const [emblaRef, emblaApi] = useEmblaCarousel(
    isWide
      ? {
          align: 'start',
          // No loop: the four 560px slides total 2294px against this strip's
          // 1180px, so max scroll is 1114px — but a start-aligned snap sits at
          // every slide boundary, and the last one lands at 1734px, far past
          // the end of the content. Looping to it scrolls the frame through
          // empty space, showing a fully blank viewport for a beat every cycle.
          // trimSnaps already drops that unreachable snap (see the basis
          // comment in landing.css for the arithmetic), and the Autoplay plugin
          // loops back to snap 0 itself once canScrollNext() is false.
          loop: false,
          skipSnaps: false,
          containScroll: 'trimSnaps',
        }
      : { active: false },
    prefersReducedMotion || !isWide
      ? []
      : [Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true, stopOnFocusIn: true })]
  );
  const [canPrev, setCanPrev] = useState<boolean>(false);
  const [canNext, setCanNext] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [snapCount, setSnapCount] = useState<number>(0);

  const onSelect = useCallback((api) => {
    setCanPrev(api.canScrollPrev());
    setCanNext(api.canScrollNext());
    setSelectedIndex(api.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    setSnapCount(emblaApi.scrollSnapList().length);
    onSelect(emblaApi);
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  // Keyboard arrow support when carousel has focus
  const onKeyDown = (e) => {
    if (!emblaApi) return;
    if (e.key === 'ArrowLeft')  { e.preventDefault(); emblaApi.scrollPrev(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); emblaApi.scrollNext(); }
  };

  const scrollTo = (i) => emblaApi && emblaApi.scrollTo(i);

  return (
    <section
      className="promo-strip dark-section"
      id="promotions"
      ref={promotionsRef}
      aria-labelledby="promotions-heading"
    >
      <div className="promo-strip-inner">
        <SectionHeading
          id="promotions-heading"
          title="Current Promotions"
          sub="Take advantage of our limited-time offers"
        />

        {activePromos.length === 0 ? (
          <div className="empty-state">No active promotions right now.</div>
        ) : (
          <div
            className="promo-carousel"
            ref={emblaRef}
            onKeyDown={onKeyDown}
            tabIndex={0}
            role="region"
            aria-roledescription="carousel"
            aria-label="Current promotions"
          >
            <div className="promo-carousel-track">
              {activePromos.map((p, i) => (
                <RevealCard
                  as="article"
                  key={p.id}
                  index={i}
                  className="promo-card soft-card"
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`Promotion ${i + 1} of ${activePromos.length}: ${p.title}`}
                >
                  <img
                    className="thumb"
                    src={p.imageUrl || '/gym-interior.jpg'}
                    alt={p.title + ' promotional artwork'}
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="body">
                    <span className="tag">
                      {p.discountType === 'Percentage' ? (p.discount + '% OFF') :
                       p.discountType === 'Bundle'     ? 'BUNDLE DEAL' :
                       p.discountType === 'Fixed'      ? ('₱' + p.discount + ' OFF') :
                       'SPECIAL'}
                    </span>
                    <h3>{p.title}</h3>
                    <p>{p.code ? 'Use code ' + p.code + ' at checkout.' : 'Limited time offer.'}</p>
                    <div className="valid">VALID UNTIL {String(p.validUntil).toUpperCase()}</div>
                  </div>
                </RevealCard>
              ))}
            </div>

            <div className="promo-carousel-controls">
              <button
                type="button"
                className="promo-nav"
                onClick={() => emblaApi && emblaApi.scrollPrev()}
                disabled={!canPrev}
                aria-label="Previous promotion"
              >
                <ChevronLeft size={20} strokeWidth={2.5} />
              </button>

              <div className="promo-dots" role="tablist" aria-label="Choose promotion">
                {Array.from({ length: snapCount }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={'promo-dot' + (i === selectedIndex ? ' active' : '')}
                    onClick={() => scrollTo(i)}
                    role="tab"
                    aria-selected={i === selectedIndex}
                    aria-label={`Go to promotion ${i + 1}`}
                  />
                ))}
              </div>

              <button
                type="button"
                className="promo-nav"
                onClick={() => emblaApi && emblaApi.scrollNext()}
                disabled={!canNext}
                aria-label="Next promotion"
              >
                <ChevronRight size={20} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default PromoStrip;
