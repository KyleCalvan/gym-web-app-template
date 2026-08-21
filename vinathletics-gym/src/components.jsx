import { useState, useEffect, useRef, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { dur, ease, stagger, spring, Ticker, drawDonut, growBar, fadeUp } from './motion.jsx';

// ===== Layout =====

export function TabbedCard({label, title, right, children}){
  return (
    <div className="card tabbed">
      {label && <span className="tab-label">{label}</span>}
      {title && (
        <div className="card-head">
          <h2>{title}</h2>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

// ===== Form helpers =====

export function Field({label, children}){
  return (
    <div className="form-group">
      {label && <label>{label}</label>}
      {children}
    </div>
  );
}

export function TextInput({value, onChange, type='text', ...rest}){
  return (
    <input
      className="form-control"
      type={type}
      value={value}
      onChange={e=>onChange(e.target.value)}
      {...rest}
    />
  );
}

export function Select({value, onChange, children, ...rest}){
  return (
    <select
      className="form-control"
      value={value}
      onChange={e=>onChange(e.target.value)}
      {...rest}
    >
      {children}
    </select>
  );
}

// ===== CSV / export helpers =====

export function downloadCSV(filename, rows){
  const csv = rows.map(r =>
    r.map(v => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')
  ).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

// ===== Stat tile — fade-up + staggered, numeric value can be a number, string, or {to,prefix,suffix,format} =====

export function StatTile({label, value, delta, tone, index = 0}){
  // If `value` is an object, render a Ticker; otherwise plain text.
  const valueNode =
    value && typeof value === 'object' && 'to' in value ? (
      <Ticker to={value.to} prefix={value.prefix || ''} suffix={value.suffix || ''} format={value.format} />
    ) : (
      value
    );
  return (
    <motion.div
      className={"stat-tile" + (tone ? " "+tone : "")}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * stagger.tile, duration: dur.base, ease: ease.out }}
    >
      <div className="l">{label}</div>
      <div className="n mono">{valueNode}</div>
      {delta && (
        <motion.div
          className={"d" + (String(delta).startsWith('-') ? " down" : "")}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * stagger.tile + 0.08, duration: dur.base, ease: ease.out }}
        >
          {delta}
        </motion.div>
      )}
    </motion.div>
  );
}

// ===== Badge — pulses scale on status change =====

export function Badge({status}){
  const map = {
    Active:'ok', Paid:'ok', Confirmed:'ok', Approved:'ok', Completed:'ok', Published:'ok',
    Pending:'warn', Expiring:'warn', 'On Leave':'warn', Draft:'warn',
    Frozen:'mute', Expired:'bad', Refunded:'bad', Cancelled:'bad', Declined:'bad', Void:'bad',
  };
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={status}
        className={"badge " + (map[status] || 'mute')}
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: [1.12, 1], opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ duration: 0.22, ease: ease.out }}
        style={{ display: 'inline-block' }}
      >
        {status}
      </motion.span>
    </AnimatePresence>
  );
}

// ===== Bar chart — bars rise from baseline =====

export function BarChart({data, valueKey, labelKey, prefix}){
  const max = Math.max(...data.map(d=>d[valueKey]));
  return (
    <div className="bar-chart">
      {data.map((d,i)=>{
        const targetPx = (d[valueKey]/max*110)+'px';
        return (
          <div className="col" key={i}>
            <div className="mono" style={{fontSize:10, color:'var(--steel)'}}>{prefix||''}{(d[valueKey]/1000).toFixed(0)}k</div>
            <motion.div
              className={"bar" + (i===data.length-1?" signal":"")}
              initial={{ height: 0 }}
              animate={{ height: targetPx }}
              transition={{ duration: dur.bar, delay: i * 0.05, ease: ease.out }}
            />
            <div className="lab">{d[labelKey]}</div>
          </div>
        );
      })}
    </div>
  );
}

// ===== Donut — segments draw in via strokeDashoffset =====
// (pathLength animation only works on <path>/<line>, not <circle>.)

export function Donut({data, size=140}){
  const total = data.reduce((a,d)=>a+d.v,0);
  let acc = 0;
  const r = size/2 - 14;
  const c = 2*Math.PI*r;
  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`translate(${size/2},${size/2}) rotate(-90)`}>
          <circle r={r} fill="none" stroke="var(--steel-soft)" strokeWidth="16" />
          {data.map((d,i)=>{
            const frac = d.v/total;
            const dash = frac*c;
            // Each segment starts with the dash "hidden" (offset pushes it past the
            // visible circumference) and animates dashoffset to its final position
            // so the segment sweeps in clockwise.
            const finalOffset = -acc;
            const startOffset = -(acc + dash);
            return (
              <motion.circle
                key={i}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth="16"
                strokeDasharray={`${dash} ${c-dash}`}
                initial={{ strokeDashoffset: startOffset }}
                animate={{ strokeDashoffset: finalOffset }}
                transition={{ duration: dur.donut, delay: i * stagger.chart, ease: ease.out }}
              />
            );
          })}
        </g>
        <Ticker to={total} asText />
        <text x="50%" y="60%" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fill="var(--steel)">TOTAL</text>
      </svg>
      <div>
        {data.map((d,i)=>(
          <div className="legend-item" key={i}>
            <span className="legend-dot" style={{background:d.color}}></span>
            <span>{d.l}</span>
            <span className="mono" style={{marginLeft:6, color:'var(--steel)'}}>{d.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== Table =====

export function Table({columns, rows, renderRow}){
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead><tr>{columns.map((c,i)=><th key={i}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.length===0 ? (
            <tr><td colSpan={columns.length}><div className="empty-state"><div className="ic">🗂️</div>No records found.</div></td></tr>
          ) : rows.map(renderRow)}
        </tbody>
      </table>
    </div>
  );
}

// ===== Modal — animated overlay + panel =====

export function Modal({title, onClose, children, wide}){
  useEffect(()=>{
    const onKey = e => { if(e.key==='Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return ()=>window.removeEventListener('keydown', onKey);
  },[]);
  return createPortal(
    <motion.div
      className="modal-overlay"
      onMouseDown={e=>{if(e.target===e.currentTarget) onClose();}}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: ease.out }}
    >
      <motion.div
        className="modal"
        style={wide?{maxWidth:640}:undefined}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.22, ease: ease.out }}
      >
        <div className="modal-head">
          <h2 style={{fontSize:18, textTransform:'uppercase'}}>{title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {children}
      </motion.div>
    </motion.div>,
    document.body
  );
}

// ===== Toast — slide-in with bounce, fade-out =====

export function Toast({message, onDone}){
  useEffect(()=>{ const t = setTimeout(onDone, 2600); return ()=>clearTimeout(t); },[]);
  return (
    <motion.div
      className="toast"
      initial={{ x: 24, opacity: 0, scale: 0.95 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }}
      transition={spring.toast}
    >
      <span className="dot"></span>{message}
    </motion.div>
  );
}

export function useToast(){
  const [toast, setToast] = useState(null);
  const fire = (msg) => setToast(msg);
  const node = (
    <AnimatePresence>
      {toast ? <Toast key={toast} message={toast} onDone={()=>setToast(null)} /> : null}
    </AnimatePresence>
  );
  return [node, fire];
}

// ===== Switch — knob slides via motion.x =====

export function Switch({on, onClick}){
  return (
    <div className={"switch"+(on?" on":"")} onClick={onClick}>
      <motion.div
        className="knob"
        animate={{ x: on ? 18 : 0 }}
        transition={{ duration: 0.18, ease: ease.inOut }}
      />
    </div>
  );
}

// ===== StepTrack (legacy, non-animated) =====

export function StepTrack({steps, current}){
  return (
    <div className="step-track">
      {steps.map((s,i)=>(
        <Fragment key={s}>
          <div className={"step"+(i<current?' done':'')+(i===current?' current':'')}>
            <span className="dot">{i<current?'✓':i+1}</span>{s}
          </div>
          {i<steps.length-1 && <div className="sep"></div>}
        </Fragment>
      ))}
    </div>
  );
}

// ===== AnimatedStepTrack — same props as StepTrack, dots fill on done, separators grow =====

export function AnimatedStepTrack({steps, current}){
  return (
    <div className="step-track">
      {steps.map((s,i)=>(
        <Fragment key={s}>
          <motion.div
            className={"step"+(i<current?' done':'')+(i===current?' current':'')}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: dur.base, ease: ease.out }}
          >
            <span className="dot">{i<current?'✓':i+1}</span>{s}
          </motion.div>
          {i<steps.length-1 && (
            <div className="sep" style={{ position: 'relative', overflow: 'hidden' }}>
              <motion.div
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  background: 'var(--court)',
                  transformOrigin: 'left center',
                }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: i < current ? 1 : 0 }}
                transition={{ duration: 0.32, ease: ease.out, delay: 0.05 }}
              />
            </div>
          )}
        </Fragment>
      ))}
    </div>
  );
}
