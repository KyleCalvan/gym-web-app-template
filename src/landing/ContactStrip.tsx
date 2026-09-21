// @ts-nocheck
import { MapPin, Phone, Mail, Clock } from 'lucide-react';

function ContactStrip({ contactRef }) {
  return (
    <section
      className="contact-strip"
      id="contact"
      ref={contactRef}
      aria-labelledby="contact-heading"
    >
      <div className="contact-strip-inner">
        <h2 id="contact-heading">Visit or Get in Touch</h2>
        <p className="sub">Drop by, call, or message us — we're happy to help you start.</p>
        <div className="contact-grid">
          <div className="contact-card soft-card">
            <div className="ic" aria-hidden="true"><MapPin size={22} strokeWidth={2} /></div>
            <div className="label">Location</div>
            <address className="value">123 Bonifacio St., Makati</address>
          </div>
          <a className="contact-card soft-card" href="tel:+639175550142" aria-label="Call us at +63 917 555 0142">
            <div className="ic" aria-hidden="true"><Phone size={22} strokeWidth={2} /></div>
            <div className="label">Phone</div>
            <div className="value">+63 917 555 0142</div>
          </a>
          <a className="contact-card soft-card" href="mailto:hello@vinathletics.gym" aria-label="Email us at hello@vinathletics.gym">
            <div className="ic" aria-hidden="true"><Mail size={22} strokeWidth={2} /></div>
            <div className="label">Email</div>
            <div className="value">hello@vinathletics.gym</div>
          </a>
          <div className="contact-card soft-card">
            <div className="ic" aria-hidden="true"><Clock size={22} strokeWidth={2} /></div>
            <div className="label">Hours</div>
            <div className="value">Mon–Sun · 5AM – 11PM</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ContactStrip;
