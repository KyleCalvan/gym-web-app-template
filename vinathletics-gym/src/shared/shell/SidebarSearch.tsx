import { useState } from 'react';
import './sidebar.css';

// Search + multi-select section filters, shown above the nav list.
// Used by roles that manage a lot of nav items (admin, staff) so
// staff/admins can quickly jump to a page without scanning every group.
export function SidebarSearch({
  sections, onQueryChange, onFiltersChange,
}: {
  sections: string[];
  onQueryChange: (v: string) => void;
  onFiltersChange: (f: string[]) => void;
}) {
  const [query, setQuery] = useState<string>('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const toggleFilter = (name: string) => {
    const next = activeFilters.includes(name)
      ? activeFilters.filter((f) => f !== name)
      : [...activeFilters, name];
    setActiveFilters(next);
    onFiltersChange(next);
  };

  const handleQuery = (v: string) => {
    setQuery(v);
    onQueryChange(v);
  };

  return (
    <div className="sidebar-search">
      <div className="ss-input-wrap">
        <span className="ss-ic">⌕</span>
        <input
          type="text"
          placeholder="Search pages…"
          value={query}
          onChange={(e) => handleQuery(e.target.value)}
        />
      </div>
      <div className="ss-filters">
        {sections.map((s) => (
          <button
            key={s}
            type="button"
            className={"ss-chip" + (activeFilters.includes(s) ? " active" : "")}
            onClick={() => toggleFilter(s)}
          >{s}</button>
        ))}
      </div>
    </div>
  );
}
