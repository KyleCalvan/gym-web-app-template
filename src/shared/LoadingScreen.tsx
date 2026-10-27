export function LoadingScreen({ label = 'Getting your gym ready' }: { label?: string }) {
  return (
    <main className="loading-screen" aria-busy="true" aria-label="Loading VinAthletics">
      <div className="loading-screen-content" role="status" aria-live="polite">
        <img className="loading-screen-logo" src="/logo.jpg" alt="" width="64" height="64" />
        <span className="loading-screen-brand">VinAthletics</span>
        <h1>{label}</h1>
        <p>Your space to train, connect, and grow.</p>
        <div className="loading-screen-track" aria-hidden="true"><span /></div>
        <span className="loading-screen-caption">Loading. Please wait…</span>
      </div>
    </main>
  );
}
