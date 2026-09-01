// src/landing/landing-mock.ts
// Landing-page-only mock data. This file is consumed ONLY by the landing
// page (Landing.tsx + PlansStrip, TrainersStrip, WhyCardsRow) so the
// marketing surfaces look populated in development without affecting the
// dashboard data stores (which intentionally start empty).
//
// Anything exported here MUST be the same shape as the production domain
// types in src/types.ts, so the same components render it without
// branching.

import type { Plan, Trainer } from '../types.ts';

export const LANDING_PLANS: Plan[] = [
  {
    name: 'Day Pass',
    price: 350,
    period: 'day',
    members: 0,
    perks: [
      'Full gym floor access',
      'Locker & towel service',
      'Cool-down smoothie',
    ],
    featured: false,
    status: 'Active',
    category: 'Drop-in',
  },
  {
    name: 'Monthly Strength',
    price: 2200,
    period: 'mo',
    members: 0,
    perks: [
      'Unlimited gym access',
      '2 group classes / week',
      'Inbody composition scan',
      'Member app access',
    ],
    featured: true,
    status: 'Active',
    category: 'Membership',
  },
  {
    name: 'Annual Champion',
    price: 21000,
    period: 'yr',
    members: 0,
    perks: [
      'Unlimited gym + classes',
      '4 PT sessions / quarter',
      'Nutrition consult (2x)',
      'Guest passes (4 / yr)',
      'Priority booking',
    ],
    featured: false,
    status: 'Active',
    category: 'Membership',
  },
];

export const LANDING_TRAINERS: Trainer[] = [
  {
    id: 'trainer-1',
    name: 'Marco Reyes',
    specialty: 'Powerlifting',
    certs: 'NSCA-CSCS, USAW L1',
    rating: 4.9,
    sessionsWeek: 22,
    status: 'Active',
    sessionPrice: 1200,
    reviews: [],
  },
  {
    id: 'trainer-2',
    name: 'Aria Lim',
    specialty: 'Mobility & Recovery',
    certs: 'FRCms, NASM-CES',
    rating: 4.8,
    sessionsWeek: 18,
    status: 'Active',
    sessionPrice: 1100,
    reviews: [],
  },
  {
    id: 'trainer-3',
    name: 'Diego Cruz',
    specialty: 'Conditioning',
    certs: 'NASM-CPT, CrossFit L2',
    rating: 4.9,
    sessionsWeek: 25,
    status: 'Active',
    sessionPrice: 1300,
    reviews: [],
  },
  {
    id: 'trainer-4',
    name: 'Bea Santos',
    specialty: 'Olympic Lifting',
    certs: 'USAW L2, PN-L1',
    rating: 5.0,
    sessionsWeek: 16,
    status: 'Active',
    sessionPrice: 1400,
    reviews: [],
  },
];

// Stat tiles shown under the hero (currently hard-coded in LandingHero,
// but exposing them here so they're easy to wire up later without
// re-touching the hero).
export const LANDING_STATS = [
  { label: 'Active Members', value: '1,200+' },
  { label: 'Classes Weekly',  value: '50+'    },
  { label: 'Avg Rating',      value: '4.8★'   },
] as const;
