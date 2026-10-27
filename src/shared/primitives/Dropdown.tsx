// @ts-nocheck
import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useEnterMotion } from '../hooks/useEnterMotion';

export interface DropdownOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  badge?: string;
}

export interface DropdownProps {
  value: string;
  onChange: (v: string) => void;
  options: DropdownOption[];
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  variant?: 'default' | 'subtle';
  fullWidth?: boolean;
  className?: string;
  ariaLabel?: string;
}

function getNextIndex(current: number, options: DropdownOption[], direction: 1 | -1): number {
  if (options.length === 0) return -1;
  let index = current;
  for (let i = 0; i < options.length; i += 1) {
    index = (index + direction + options.length) % options.length;
    if (!options[index].disabled) return index;
  }
  return current;
}

export function Dropdown({
  value, onChange, options, label, placeholder = 'Select…', disabled, size = 'md',
  variant = 'default', fullWidth, className, ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const triggerRef = useRef(null);
  const listRef = useEnterMotion<HTMLUListElement>(open, 4);
  const wrapRef = useRef(null);
  const listId = useId();

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  useEffect(() => {
    if (!open) return undefined;
    const onDocDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const start = selectedIndex >= 0 ? selectedIndex : Math.max(0, options.findIndex((o) => !o.disabled));
      setHighlight(start);
      requestAnimationFrame(() => {
        const node = listRef.current?.querySelector(`[data-index="${start}"]`);
        node?.scrollIntoView({ block: 'nearest' });
      });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (option) => {
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (event) => {
    if (disabled) return;
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = getNextIndex(highlight, options, 1);
      setHighlight(next);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const next = getNextIndex(highlight, options, -1);
      setHighlight(next);
    } else if (event.key === 'Home') {
      event.preventDefault();
      const next = options.findIndex((o) => !o.disabled);
      if (next >= 0) setHighlight(next);
    } else if (event.key === 'End') {
      event.preventDefault();
      for (let i = options.length - 1; i >= 0; i -= 1) {
        if (!options[i].disabled) { setHighlight(i); break; }
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = options[highlight];
      if (option) commit(option);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  const sizeClass = size === 'sm' ? 'vddx-sm' : 'vddx-md';
  const variantClass = variant === 'subtle' ? 'vddx-subtle' : '';

  return (
    <div
      ref={wrapRef}
      className={['vddx', sizeClass, variantClass, fullWidth ? 'vddx-full' : '', className || ''].join(' ').trim()}
      data-open={open || undefined}
    >
      {label && <label className="vddx-label">{label}</label>}
      <button
        ref={triggerRef}
        type="button"
        className="vddx-trigger"
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && highlight >= 0 ? `${listId}-opt-${highlight}` : undefined}
        aria-label={ariaLabel || label}
      >
        <span className="vddx-trigger-value">
          {selected ? (
            <>
              <span className="vddx-trigger-label">{selected.label}</span>
              {selected.badge && <span className="vddx-trigger-badge">{selected.badge}</span>}
            </>
          ) : (
            <span className="vddx-trigger-placeholder">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={16} className="vddx-trigger-chevron" aria-hidden="true" />
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="vddx-list"
          aria-label={ariaLabel || label}
        >
          {options.length === 0 && <li className="vddx-empty" role="presentation">No options</li>}
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isHighlighted = index === highlight;
            return (
              <li
                id={`${listId}-opt-${index}`}
                key={option.value}
                role="option"
                aria-selected={isSelected}
                data-index={index}
                data-disabled={option.disabled || undefined}
                className={[
                  'vddx-option',
                  isSelected ? 'vddx-option-selected' : '',
                  isHighlighted ? 'vddx-option-highlighted' : '',
                  option.disabled ? 'vddx-option-disabled' : '',
                ].join(' ').trim()}
                onMouseEnter={() => !option.disabled && setHighlight(index)}
                onClick={() => commit(option)}
              >
                <span className="vddx-option-main">
                  <span className="vddx-option-label">{option.label}</span>
                  {option.badge && <span className="vddx-option-badge">{option.badge}</span>}
                </span>
                {option.description && <span className="vddx-option-desc">{option.description}</span>}
                {isSelected && <Check size={14} className="vddx-option-check" aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
