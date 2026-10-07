import { useMemo } from 'react';
import type { NavSection, Role } from '../../types.ts';

export interface MobileTabBarProps {
  role: Role;
  nav: NavSection[];
  active: string;
  onNav: (id: string) => void;
}

// Mobile primary navigation: a fixed bottom bar with the role's most-used
// pages. Roles with more pages keep the surplus in the drawer (hamburger).
// Notifications live in the topbar bell next to the profile pill now, so they
// don't take a tab slot here.
const MAX_TABS = 5;

export function MobileTabBar({ role, nav, active, onNav }: MobileTabBarProps) {
  const items = useMemo(() => {
    // Flatten every nav section into one ranked list. Profile and Log Out are
    // deliberately absent from every role's nav — they live in the profile
    // dropdown instead, so they never reach this bar.
    return nav.flatMap((sec) => sec.items).slice(0, MAX_TABS);
  }, [nav, role]);

  return (
    <nav className="mobile-tabbar" aria-label="Primary">
      <div className="mobile-tabbar-list" role="tablist">
        {items.map((it) => {
          const isActive = active === it.id;
          return (
            <button
              key={it.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? 'page' : undefined}
              className={'mobile-tabbar-item' + (isActive ? ' active' : '')}
              onClick={() => onNav(it.id)}
            >
              <span className="ic" aria-hidden="true">{it.ic}</span>
              <span className="lbl">{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
