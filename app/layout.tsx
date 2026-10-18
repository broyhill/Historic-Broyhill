import './globals.css';
import type { Metadata } from 'next';
import { Playfair_Display, EB_Garamond } from 'next/font/google';

const display = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});
const body = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Historic Broyhill — Event Venue & Class A Offices in Clemmons, NC',
  description:
    'A 1920s landmark in Clemmons, North Carolina, reimagined as premier event spaces, Class A executive offices, a virtual office program, and a turnkey podcast studio. Request a tour.',
  openGraph: {
    title: 'Historic Broyhill',
    description:
      'Southern-charm event spaces and Class A offices in a restored 1920s landmark near Winston-Salem.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Each page sets its own theme: the public site is warm/light, the staff console is dark. */}
      <body className={`${display.variable} ${body.variable} min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  );
}
