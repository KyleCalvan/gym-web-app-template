// @ts-nocheck
function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">Site footer</h2>
      <div className="site-footer-inner">
        <div className="brand-block">
          <div className="brand">
            <img src="/logo.jpg" alt="VinAthletics" className="brand-mark-img" />
            <span>VinAthletics</span>
          </div>
          <p>A modern gym platform to manage workouts, track progress, connect with trainers, and stay motivated toward your fitness goals.</p>
        </div>

        <div className="col">
          <h3>Explore</h3>
          <ul>
            <li><a href="#promotions">Promotions</a></li>
            <li><a href="#plans">Membership Plans</a></li>
            <li><a href="#trainers">Trainers</a></li>
            <li><a href="#contact">Contact</a></li>
          </ul>
        </div>

        <div className="col">
          <h3>Connect</h3>
          <address>
            <ul>
              <li>123 Bonifacio St., Makati</li>
              <li><a href="tel:+639175550142">+63 917 555 0142</a></li>
              <li><a href="mailto:hello@vinathletics.gym">hello@vinathletics.gym</a></li>
            </ul>
          </address>
        </div>
      </div>

      <div className="legal">
        <span>© 2026 VINATHLETICS GYM MANAGEMENT SYSTEM. ALL RIGHTS RESERVED.</span>
        <span>
          <a href="#contact">Privacy</a> &nbsp;·&nbsp; <a href="#contact">Terms</a>
        </span>
      </div>
    </footer>
  );
}

export default SiteFooter;
