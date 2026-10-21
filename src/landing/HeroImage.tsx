// @ts-nocheck
/**
 * HeroImage
 * Renders the gym-interior photograph as a responsive <picture> element
 * with WebP + JPEG sources at 4 widths and a sizes attribute tuned to the
 * hero placement. Falls back to a CSS-backgrounded <div> with the original
 * single JPEG if the responsive variants are not yet generated (development
 * convenience).
 */
import { useEffect, useState } from 'react';

interface HeroImageProps {
  className?: string;
  alt?: string;
  /** When true, the component renders the CSS-background variant using
   *  the original single JPEG (used when /img/hero-*.{webp,jpg} files
   *  are not yet on disk). */
  useFallback?: boolean;
}

export default function HeroImage({
  className,
  alt = 'Athletes training inside VinAthletics Gym — strength and conditioning floor.',
  useFallback = false,
}: HeroImageProps) {
  // Detect whether the generated responsive variants exist. We probe with
  // a HEAD request to the 1024-wide WebP file. If it 404s, we fall back
  // to the original single JPEG via a CSS background.
  const [hasVariants, setHasVariants] = useState<boolean>(false);
  const [probed, setProbed] = useState<boolean>(false);

  useEffect(() => {
    if (useFallback) {
      setProbed(true);
      return;
    }
    let cancelled = false;
    fetch('/img/hero-1024.webp', { method: 'HEAD' })
      .then((res) => {
        if (cancelled) return;
        setHasVariants(res.ok);
        setProbed(true);
      })
      .catch(() => {
        if (cancelled) return;
        setHasVariants(false);
        setProbed(true);
      });
    return () => { cancelled = true; };
  }, [useFallback]);

  // While probing or when variants are missing, render a CSS background.
  if (!probed || !hasVariants) {
    return (
      <div
        className={className || 'hero-photo-bg'}
        style={{ backgroundImage: 'url(/gym-interior.jpg)' }}
        aria-hidden="true"
      />
    );
  }

  // Render responsive <picture> once we know the variants exist.
  return (
    <picture className={className || 'hero-photo-bg'}>
      <source
        type="image/webp"
        srcSet={
          '/img/hero-640.webp 640w, ' +
          '/img/hero-1024.webp 1024w, ' +
          '/img/hero-1600.webp 1600w, ' +
          '/img/hero-2400.webp 2400w'
        }
        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 90vw, 1080px"
      />
      <source
        type="image/jpeg"
        srcSet={
          '/img/hero-640.jpg 640w, ' +
          '/img/hero-1024.jpg 1024w, ' +
          '/img/hero-1600.jpg 1600w, ' +
          '/img/hero-2400.jpg 2400w'
        }
        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 90vw, 1080px"
      />
      <img
        src="/img/hero-1024.jpg"
        alt={alt}
        width={1600}
        height={900}
        loading="eager"
        fetchPriority="high"
        decoding="async"
      />
    </picture>
  );
}
