import type { Metadata, Viewport } from 'next';
import { Oswald, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import '../src/styles.css';

// Self-hosted via next/font so the fonts load without a render-blocking
// request to Google and stay available offline.
const oswald = Oswald({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-oxford',
  display: 'swap',
});
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://vinathletics.gym'),
  title: 'VinAthletics — Modern Gym Management Built for Champions',
  description:
    'VinAthletics is a complete gym management platform: memberships, coaching schedules, point-of-sale and reporting — one ledger for admins, staff, trainers and members. Visit our Makati gym or book a free tour.',
  alternates: { canonical: 'https://vinathletics.gym/' },
  openGraph: {
    type: 'website',
    title: 'VinAthletics — Modern Gym Management Built for Champions',
    description: 'Memberships, coaching, point-of-sale and reporting — one platform for your gym.',
    url: 'https://vinathletics.gym/',
    siteName: 'VinAthletics',
    images: ['/gym-interior.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VinAthletics — Modern Gym Management',
    description: 'Memberships, coaching, POS and reporting — one platform for your gym.',
    images: ['/gym-interior.jpg'],
  },
  icons: {
    icon: [{ type: 'image/jpeg', url: '/logo.jpg' }],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#16241F',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${oswald.variable} ${plexSans.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        {/* Applies the saved theme before first paint. Dark is the default, so
           the attribute is only ever set for light — and only from
           localStorage, the one source of truth — which keeps the SSR markup
           and the first client paint identical except when the user has
           already opted into light. Without this the whole page would flash
           dark before React mounts and reads the preference. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('vinathletics-theme');" +
              "if(t==='light')document.documentElement.dataset.theme='light';}catch(e){}",
          }}
        />
        {children}
      </body>
    </html>
  );
}
