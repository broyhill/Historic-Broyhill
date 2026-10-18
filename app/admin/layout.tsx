import { Open_Sans } from "next/font/google";

// Inspinia's typeface. Scoped to the /admin subtree so the public site keeps
// its Playfair/EB Garamond branding.
const openSans = Open_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-admin", display: "swap" });

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className={openSans.variable}>{children}</div>;
}
