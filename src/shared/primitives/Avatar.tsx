import { useState } from 'react';
import { INITIALS } from '../../data';
export function Avatar({ src, name, size = 26 }: { src?: string; name: string; size?: number }) {
  const [failed, setFailed] = useState<string>();
  const style = { width: size, height: size, minWidth: size, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' as const, display: 'inline-flex', verticalAlign: 'middle' };
  if (src && failed !== src) return <img src={src} alt={name} className="avatar-img" style={style} onError={() => setFailed(src)} />;
  return <span className="avatar-sm" style={{ ...style, fontSize: Math.max(11, Math.round(size / 2.4)) }} role="img" aria-label={name}>{INITIALS(name)}</span>;
}
