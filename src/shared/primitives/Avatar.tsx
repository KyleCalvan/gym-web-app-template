// @ts-nocheck
import { INITIALS } from '../../data.ts';

// Avatar: shows a user's profile photo when present, falls back to initials.
// Used by admin / staff / member / trainer lists and by the Topbar role pill.

export function Avatar({ src, name, size = 26 }: { src?: string; name: string; size?: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="avatar-img"
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
      />
    );
  }
  return (
    <span
      className="avatar-sm"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size / 2.4)),
      }}
    >
      {INITIALS(name)}
    </span>
  );
}
