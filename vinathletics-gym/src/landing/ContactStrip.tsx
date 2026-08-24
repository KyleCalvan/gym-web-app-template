// @ts-nocheck
function ContactStrip({ contactRef }) {
  return (
    <section className="contact-strip" id="contact" ref={contactRef}>
      <div className="contact-strip-inner">
        <h2>Visit or Get in Touch</h2>
        <p className="sub">Drop by, call, or message us — we're happy to help you start.</p>
        <div className="contact-grid">
          <div className="contact-card">
            <div className="ic">📍</div>
            <div className="label">Location</div>
            <div className="value">123 Bonifacio St., Makati</div>
          </div>
          <div className="contact-card">
            <div className="ic">📞</div>
            <div className="label">Phone</div>
            <div className="value">+63 917 555 0142</div>
          </div>
          <div className="contact-card">
            <div className="ic">✉️</div>
            <div className="label">Email</div>
            <div className="value">hello@vinathletics.gym</div>
          </div>
          <div className="contact-card">
            <div className="ic">⏰</div>
            <div className="label">Hours</div>
            <div className="value">Mon–Sun · 5AM – 11PM</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ContactStrip;