// @ts-nocheck
function PlansStrip({ plansRef, activePlans, onNavigate }) {
  return (
    <section className="plans-strip" id="plans" ref={plansRef}>
      <div className="plans-strip-inner">
        <h2>Membership Plans</h2>
        <p className="sub">Pick a plan that fits your goals — switch or cancel anytime.</p>
        <div className="grid grid-3">
          {activePlans.map((p) => (
            <div className={"plan-card" + (p.featured ? ' featured' : '')} key={p.name}>
              {p.featured && <span className="ribbon">Most Popular</span>}
              <h3 style={{ fontSize: 18 }}>{p.name}</h3>
              <div className="price">₱{p.price.toLocaleString('en-PH')}<span>/{p.period}</span></div>
              <ul>{p.perks.map((perk, i) => <li key={i}>✓ {perk}</li>)}</ul>
              <button
                className={"btn btn-sm btn-block " + (p.featured ? 'btn-signal' : 'btn-outline')}
                onClick={() => onNavigate && onNavigate('/login')}
              >Choose {p.name}</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default PlansStrip;