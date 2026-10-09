// @ts-nocheck
import { useState, useRef, useEffect } from 'react';
import type { RefObject } from 'react';
import type { Plan, Promotion, Trainer } from './types.ts';
import { LANDING_PLANS, LANDING_TRAINERS } from './landing/landing-mock.ts';
import LandingNav from './landing/LandingNav.tsx';
import LandingHero from './landing/LandingHero.tsx';
import WhyCardsRow from './landing/WhyCardsRow.tsx';
import PromoStrip from './landing/PromoStrip.tsx';
import PlansStrip from './landing/PlansStrip.tsx';
import TrainersStrip from './landing/TrainersStrip.tsx';
import ContactStrip from './landing/ContactStrip.tsx';
import CtaBand from './landing/CtaBand.tsx';
import SiteFooter from './landing/SiteFooter.tsx';
import BackToTop from './landing/BackToTop.tsx';

export interface LandingProps {
  onLogin: (role: 'member' | 'staff' | 'trainer' | 'admin') => void;
  plans: Plan[];
  promotions: Promotion[];
  trainers: Trainer[];
  members: unknown[];
  setMembers: unknown;
  onNavigate: (r: string) => void;
}

export default function Landing({ plans, promotions, trainers, onNavigate }: LandingProps) {
  // Section refs for scroll-spy
  const refs: Record<'promotions' | 'plans' | 'trainers' | 'contact', RefObject<HTMLElement>> = {
    promotions: useRef<HTMLElement>(null),
    plans:      useRef<HTMLElement>(null),
    trainers:   useRef<HTMLElement>(null),
    contact:    useRef<HTMLElement>(null),
  };
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [stuck, setStuck] = useState<boolean>(false);
  const landingRef = useRef<HTMLElement>(null);

  // The landing page renders at the desktop design width and is scaled down to
  // fit whatever viewport it's given, so the desktop structure is preserved at
  // every size (see the "Miniaturized desktop view" block in landing.css).
  // `zoom` is used rather than `transform: scale()` because it re-flows the
  // document, leaving no overflow to clip and no empty space below the page.
  const DESIGN_WIDTH = 1180;
  useEffect(() => {
    const el = landingRef.current;
    if (!el) return;
    const fit = () => {
      // window.innerWidth is the wrong anchor for this calculation on mobile.
      // When a page lays out wider than the screen, mobile browsers expand the
      // *layout* viewport to fit the content, so innerWidth reports the
      // content width (1180) rather than the glass (390) -- the scale would
      // come out as 1 and the page would never zoom. Anchoring to the device's
      // own width keeps the fit tied to the actual screen; on desktop the two
      // agree, and on mobile the smaller of the two is always the screen.
      const vw = Math.min(window.innerWidth, window.screen.width || window.innerWidth);
      const scale = Math.min(1, vw / DESIGN_WIDTH);
      el.style.zoom = scale < 1 ? String(scale) : '';
      // Publish the scale so CSS can divide it back out: each content strip
      // counter-zooms by 1/--fit-scale so its text renders at true device
      // pixels instead of the zoomed-down ones (see landing.css).
      el.style.setProperty('--fit-scale', String(scale));
    };
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    return () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 60);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActiveSection(e.target.id); }),
      { rootMargin: '-30% 0px -50% 0px', threshold: 0 }
    );
    Object.values(refs).forEach((r) => r.current && obs.observe(r.current));
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Promotions still come from the real store (already seeded in data.ts).
  // Plans and Trainers fall back to landing-only mock data when the
  // dashboards' data stores are empty — so the marketing surfaces look
  // populated without polluting the role-based data.
  const activePromos    = (promotions || []).filter((p) => p.status === 'Published').slice(0, 4);
  const plansSource     = (plans && plans.length > 0) ? plans : LANDING_PLANS;
  const trainersSource  = (trainers && trainers.length > 0) ? trainers : LANDING_TRAINERS;
  const activePlans     = plansSource.filter((p) => p.status !== 'Inactive');
  const activeTrainers  = trainersSource.filter((t) => t.status !== 'On Leave');

  return (
    <>
      <a href="#main" className="skip-link">Skip to main content</a>
      <main id="main" className="landing" ref={landingRef} tabIndex={-1}>
        <LandingNav stuck={stuck} activeSection={activeSection} onNavigate={onNavigate} />
        <LandingHero onNavigate={onNavigate} />
        <WhyCardsRow />
        <PromoStrip promotionsRef={refs.promotions} activePromos={activePromos} />
        <PlansStrip plansRef={refs.plans} activePlans={activePlans} onNavigate={onNavigate} />
        <TrainersStrip trainersRef={refs.trainers} activeTrainers={activeTrainers} onNavigate={onNavigate} />
        <ContactStrip contactRef={refs.contact} />
        <CtaBand onNavigate={onNavigate} />
        <SiteFooter />
      </main>
      <BackToTop />
    </>
  );
}
