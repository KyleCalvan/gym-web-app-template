// @ts-nocheck
import { useState, useRef, useEffect } from 'react';
import type { RefObject } from 'react';
import { useMotionValue, useTransform } from 'framer-motion';
import './landing/landing.css';
import type { Plan, Promotion, Trainer } from './types.ts';
import LandingNav from './landing/LandingNav.tsx';
import LandingHero from './landing/LandingHero.tsx';
import WhyCardsRow from './landing/WhyCardsRow.tsx';
import PromoStrip from './landing/PromoStrip.tsx';
import PlansStrip from './landing/PlansStrip.tsx';
import TrainersStrip from './landing/TrainersStrip.tsx';
import ContactStrip from './landing/ContactStrip.tsx';
import CtaBand from './landing/CtaBand.tsx';
import SiteFooter from './landing/SiteFooter.tsx';

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
  const heroRef = useRef<HTMLDivElement | null>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const cardX = useTransform(mx, (v) => v * 4);
  const cardY = useTransform(my, (v) => v * 8);
  const onHeroMove = (e: React.MouseEvent) => {
    const r = heroRef.current?.getBoundingClientRect();
    if (!r) return;
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    mx.set(nx);
    my.set(ny);
  };
  const onHeroLeave = () => { mx.set(0); my.set(0); };

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

  const activePromos = (promotions || []).filter((p) => p.status === 'Published').slice(0, 4);
  const activePlans  = (plans || []).filter((p) => p.status !== 'Inactive');
  const activeTrainers = (trainers || []).filter((t) => t.status !== 'On Leave');

  return (
    <div className="landing">
      <LandingNav stuck={stuck} activeSection={activeSection} onNavigate={onNavigate} />
      <LandingHero
        heroRef={heroRef}
        onHeroMove={onHeroMove}
        onHeroLeave={onHeroLeave}
        cardX={cardX}
        cardY={cardY}
        onNavigate={onNavigate}
      />
      <WhyCardsRow />
      <PromoStrip promotionsRef={refs.promotions} activePromos={activePromos} />
      <PlansStrip plansRef={refs.plans} activePlans={activePlans} onNavigate={onNavigate} />
      <TrainersStrip trainersRef={refs.trainers} activeTrainers={activeTrainers} onNavigate={onNavigate} />
      <ContactStrip contactRef={refs.contact} />
      <CtaBand />
      <SiteFooter />
    </div>
  );
}