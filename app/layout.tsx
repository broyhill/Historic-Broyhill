import './globals.css';
import type { Metadata } from 'next';

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
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
