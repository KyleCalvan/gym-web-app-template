// @ts-nocheck
/**
 * BackToTop
 * Fixed bottom-right button that appears after the user has scrolled
 * 400px down. Smooth-scrolls back to the <main id="main"> landmark.
 */
import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export default function BackToTop() {
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const onClick = () => {
    const main = document.getElementById('main');
    if (main) {
      main.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <button
      type="button"
      className={'back-to-top' + (visible ? ' visible' : '')}
      onClick={onClick}
      aria-label="Back to top"
      tabIndex={visible ? 0 : -1}
    >
      <ArrowUp size={20} strokeWidth={2.5} />
    </button>
  );
}
