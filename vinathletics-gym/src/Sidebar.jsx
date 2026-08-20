import { useState, useMemo } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { dur, ease, stagger } from './motion.jsx';

// Search + multi-select section filters, shown above the nav list.
// Used by roles that manage a lot of nav items (admin, staff) so
// staff/admins can quickly jump to a page without scanning every group.
function SidebarSearch({ sections, onQueryChange, onFiltersChange }){
  const [query, setQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState([]);

  const toggleFilter = (name) => {
    const next = activeFilters.includes(name)
      ? activeFilters.filter(f=>f!==name)
      : [...activeFilters, name];
    setActiveFilters(next);
    onFiltersChange(next);
  };

  const handleQuery = (v) => {
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
          onChange={e=>handleQuery(e.target.value)}
        />
      </div>
      <div className="ss-filters">
        {sections.map(s=>(
          <button
            key={s}
            type="button"
            className={"ss-chip"+(activeFilters.includes(s)?" active":"")}
            onClick={()=>toggleFilter(s)}
          >{s}</button>
        ))}
      </div>
    </div>
  );
}

export default function Sidebar({ role, brand, nav, active, onNav, onLogout, searchable, bell }){
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState([]);
  const bellControls = useAnimationControls();

  const sectionNames = useMemo(()=>nav.map(s=>s.section), [nav]);

  const visibleNav = useMemo(()=>{
    return nav
      .filter(sec => filters.length===0 || filters.includes(sec.section))
      .map(sec => ({
        ...sec,
        items: sec.items.filter(it => it.label.toLowerCase().includes(query.toLowerCase())),
      }))
      .filter(sec => sec.items.length > 0);
  }, [nav, query, filters]);

  const wiggle = () => {
    bellControls.start({
      rotate: [0, -14, 14, -10, 10, -6, 6, 0],
      transition: { duration: 0.55, ease: ease.out },
    });
    bell && bell.onClick && bell.onClick();
  };

  return (
    <aside className="sidebar">
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px 18px', borderBottom:'1px solid #2C4038', marginBottom:14}}>
        <div className="brand" style={{padding:0, border:'none', margin:0, color:'var(--paper)'}}>
          <span className="brand-mark">🏋</span> {brand}
        </div>
        {bell && (
          <motion.button
            className="bell-btn"
            aria-label="Notifications"
            onClick={wiggle}
            animate={bellControls}
            whileTap={{ scale: 0.92 }}
            style={{ marginRight: 0 }}
          >
            🔔
            {bell.count > 0 && (
              <motion.span
                className="bell-dot"
                animate={{ scale: [1, 1.25, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </motion.button>
        )}
      </div>

      {searchable && (
        <SidebarSearch
          sections={sectionNames}
          onQueryChange={setQuery}
          onFiltersChange={setFilters}
        />
      )}

      {visibleNav.length===0 && searchable && (
        <div className="ss-empty" style={{padding:'0 20px'}}>No matching pages.</div>
      )}

      {visibleNav.map(sec=>(
        <div className="nav-section" key={sec.section}>
          <div className="head">{sec.section}</div>
          {sec.items.map((it,i)=>(
            <motion.button
              key={it.id}
              className={"nav-item"+(active===it.id?" active":"")}
              onClick={()=>onNav(it.id)}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: dur.base, delay: i * stagger.list, ease: ease.out }}
              whileHover={{ x: 2 }}
            >
              <span className="ic">{it.ic}</span>{it.label}
            </motion.button>
          ))}
        </div>
      ))}

      <div className="nav-section">
        <div className="head">Session</div>
        <button className="nav-item" onClick={onLogout}><span className="ic">←</span>Log Out</button>
      </div>
    </aside>
  );
}
