import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { dur, ease } from '../../motion.tsx';
import type { NavSection } from '../../types.ts';

export interface GlobalSearchProps {
  nav: NavSection[];
  active: string;
  onNav: (id: string) => void;
}

interface FlatItem {
  id: string;
  label: string;
  ic: string;
  section: string;
}

// Universal page search. It lives in the top header so every role sees it in
// the same place on every view — this replaces the old per-section sidebar
// search, which only some roles got and could only narrow one nav list.
export function GlobalSearch({ nav, active, onNav }: GlobalSearchProps) {
  const [query, setQuery] = useState<string>('');
  const [open, setOpen] = useState<boolean>(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [highlight, setHighlight] = useState<number>(0);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const results = useMemo<FlatItem[]>(() => {
    const flat: FlatItem[] = nav.flatMap((sec) =>
      sec.items.map((it) => ({ id: it.id, label: it.label, ic: it.ic, section: sec.section })),
    );
    const q = query.trim().toLowerCase();
    if (!q) return flat;
    // Match the page label or the section it belongs to.
    return flat.filter(
      (it) => it.label.toLowerCase().includes(q) || it.section.toLowerCase().includes(q),
    );
  }, [nav, query]);

  const choose = (id: string) => {
    onNav(id);
    setOpen(false);
    setMobileExpanded(false);
    setQuery('');
    setHighlight(0);
  };

  // Close on an outside click or focus loss.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setMobileExpanded(false);
      }
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  useEffect(() => {
    if (mobileExpanded) inputRef.current?.focus();
  }, [mobileExpanded]);

  // A new query always restarts the highlight at the top.
  useEffect(() => { setHighlight(0); }, [query]);

  // Keep the highlighted row scrolled into view while arrowing around.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && results[highlight]) { e.preventDefault(); choose(results[highlight].id); }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (mobileExpanded) {
        setOpen(false);
        setMobileExpanded(false);
        setQuery('');
        return;
      }
      if (open) {
        setOpen(false);
        return;
      }
      (e.currentTarget as HTMLInputElement).blur();
    }
  };

  return (
    <div className={`global-search${mobileExpanded ? ' mobile-expanded' : ''}`} ref={wrapRef}>
      <button
        type="button"
        className="global-search-trigger"
        aria-label={mobileExpanded ? 'Close page search' : 'Search pages'}
        aria-expanded={mobileExpanded}
        onClick={() => {
          if (mobileExpanded) {
            setMobileExpanded(false);
            setOpen(false);
            setQuery('');
          } else {
            setMobileExpanded(true);
            setOpen(true);
          }
        }}
      >
        {mobileExpanded ? <X size={19} aria-hidden="true" /> : <Search size={19} aria-hidden="true" />}
      </button>
      <span className="gs-ic" aria-hidden="true">⌕</span>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search pages…"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-controls="gs-listbox"
        aria-autocomplete="list"
        aria-label="Search pages"
      />
      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            id="gs-listbox"
            ref={listRef}
            className="gs-dropdown"
            role="listbox"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: dur.fast, ease: ease.out }}
          >
            {results.map((it, i) => (
              <button
                key={it.id}
                type="button"
                data-idx={i}
                role="option"
                aria-selected={highlight === i}
                className={'gs-item' + (highlight === i ? ' hl' : '') + (active === it.id ? ' current' : '')}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => choose(it.id)}
              >
                <span className="ic" aria-hidden="true">{it.ic}</span>
                <span className="gs-label">{it.label}</span>
                <span className="gs-sec">{it.section}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
