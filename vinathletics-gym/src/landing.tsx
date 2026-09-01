// @ts-nocheck
import { useState, useRef, useEffect } from 'react';
import type { RefObject } from 'react';
import './landing/landing.css';
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
      <main id="main" className="landing" tabIndex={-1}>
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
