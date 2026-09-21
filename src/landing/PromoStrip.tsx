// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dur, ease, stagger } from '../motion.tsx';

function PromoStrip({ promotionsRef, activePromos }) {
  // Respect prefers-reduced-motion: skip autoplay entirely if the user
  // has it set (no carousel movement on its own).
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      align: 'start',
      loop: true,
      skipSnaps: false,
      containScroll: 'trimSnaps',
    },
    prefersReducedMotion
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
        <h2 id="promotions-heading">Current Promotions</h2>
        <p className="sub">Take advantage of our limited-time offers</p>

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
                <motion.article
                  className="promo-card soft-card"
                  key={p.id}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: dur.base, delay: i * stagger.list, ease: ease.out }}
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
                </motion.article>
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
