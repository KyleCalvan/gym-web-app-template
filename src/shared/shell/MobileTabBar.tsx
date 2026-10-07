import { useMemo } from 'react';
import type { NavSection, Role } from '../../types.ts';

export interface MobileTabBarProps {
  role: Role;
  nav: NavSection[];
  active: string;
  onNav: (id: string) => void;
}

// Mobile primary navigation: a fixed bottom bar holding every page the role can
// reach. Roles vary widely in page count (trainer 3, admin 9, super admin 6),
// so the bar scrolls sideways instead of dropping the surplus items the way a
// fixed tab count would. Notifications live in the topbar bell and Profile /
// Log Out live in the profile sheet, so none of them take a tab slot here.
export function MobileTabBar({ role, nav, active, onNav }: MobileTabBarProps) {
  // Flatten every nav section into one ranked list. Profile and Log Out are
  // deliberately absent from every role's nav — they live in the profile
  // dropdown instead, so they never reach this bar.
  const items = useMemo(() => nav.flatMap((sec) => sec.items), [nav, role]);

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
