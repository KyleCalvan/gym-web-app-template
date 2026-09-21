// @ts-nocheck
function CtaBand({ onNavigate }) {
  return (
    <section className="cta-band dark-section" aria-labelledby="cta-heading">
      <h2 id="cta-heading">BUILT FOR GYMS. DESIGNED FOR <span className="accent-word">CHAMPIONS.</span></h2>
      <button
        className="btn btn-signal"
        onClick={() => onNavigate && onNavigate('/login')}
      >Get Started Today</button>
    </section>
  );
}

export default CtaBand;
