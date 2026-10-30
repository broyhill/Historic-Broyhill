import { Source_Sans_3 } from "next/font/google";

// Console body face, scoped to /admin. Headings reuse the public site's
// Playfair Display (--font-display from the root layout) so both faces of the
// building share one identity.
const sourceSans = Source_Sans_3({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-admin", display: "swap" });

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className={sourceSans.variable}>{children}</div>;
}
