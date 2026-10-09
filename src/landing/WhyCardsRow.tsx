// @ts-nocheck
import { LayoutDashboard, Calendar, BarChart3, Shield, ArrowRight } from 'lucide-react';
import RevealCard from './RevealCard.tsx';
import SectionHeading from './SectionHeading.tsx';
import { scrollToSection } from './landing-utils.ts';

const WHY_TILES = [
  { Icon: LayoutDashboard, title: 'A COMMUNITY THAT MOTIVATES', body: 'Train alongside people who share your goals, celebrate your wins, and keep you accountable.' },
  { Icon: Calendar,        title: 'TRACK YOUR PROGRESS', body: 'See your strength, performance, consistency, and milestones improve over time' },
  { Icon: BarChart3,       title: 'BUILT FOR EVERY LEVEL', body: "Whether you're just getting started or chasing your next personal best, train in an environment designed for you" },
  { Icon: Shield,          title: 'FEEL PART OF SOMETHING', body: 'Train alongside a community that brings energy, encouragement, and a shared commitment to getting better' },
];

const WHY_ITEMS = [
  { label: 'ACHIEVE YOUR GOALS', text: 'Programs and tools designed to help you stay focused and make real progress.' },
  { label: 'STAY CONSISTENT', text: 'Easy booking, reminders, and tracking to keep you on track.' },
  { label: 'FEEL CONNECTED', text: 'A supportive community that inspires you to show up and keep going.' },
  { label: 'TRAIN WITH CONFIDENCE', text: 'Quality equipment and certified coaches focused on your safety and results.' },
  { label: 'CELEBRATE EVERY WIN', text: "From small victories to big milestones, we're here to celebrate your journey." },
];

const WHY_TRUST = ['YOUR DATA IS SECURE', 'TRUSTED BY THOUSANDS', "WE'RE WITH YOU EVERY STEP"];

function WhyCardsRow() {
  return (
    <section className="hero-cards-row" id="why" aria-labelledby="why-heading">
      <div className="hero-cards-row-inner">
        <SectionHeading
          id="why-heading"
          title="WHY MEMBERS PICK VINATHLETICS"
          sub="Everything you need under one roof, from world-class equipment to certified coaches."
        />
        <div className="hero-cards-grid">
          {WHY_TILES.map((c, i) => {
            const Icon = c.Icon;
            return (
              <RevealCard key={c.title} index={i} className="hero-card soft-card">
                <div className="ic" aria-hidden="true">
                  <Icon size={22} strokeWidth={2} />
                </div>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
                <a
                  className="link"
                  href="#promotions"
                  onClick={(e) => scrollToSection(e, 'promotions')}
                >Learn More <ArrowRight size={13} strokeWidth={2.5} aria-hidden="true" /></a>
              </RevealCard>
            );
          })}
        </div>

        <div className="why-bottom-section">
          <div className="why-bottom-inner">
            <div className="why-left">
              <h3 className="why-head">MORE THAN A WORKOUT.</h3>
              <h3 className="why-head accent">A BETTER YOU.</h3>
              <p className="why-lede">
                We're here to support every part of your fitness journey, inside and outside the gym.
              </p>
            </div>
            <div className="why-right-grid">
              {WHY_ITEMS.map((item) => (
                <div key={item.label} className="why-item">
                  <h4 className="why-item-label">{item.label}</h4>
                  <p className="why-item-text">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="why-trust-row">
            {WHY_TRUST.map((label) => <span key={label}>{label}</span>)}
          </div>
        </div>
      </div>
    </section>
  );
}

export default WhyCardsRow;
