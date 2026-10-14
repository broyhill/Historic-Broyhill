"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["Heritage", "/heritage"],
  ["Event spaces", "/event-spaces"],
  ["Availability", "/availability"],
  ["Stay", "/stay"],
  ["Office suites", "/office-suites"],
  ["Contact", "/contact"],
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <Link className="wordmark" href="/" aria-label="Historic Broyhill home">
        <span>HISTORIC</span><strong>BROYHILL</strong>
      </Link>
      <nav aria-label="Main navigation" className="site-nav">
        {links.map(([label, href]) => (
          <Link
            aria-current={pathname === href ? "page" : undefined}
            href={href}
            key={href}
          >
            {label}
          </Link>
        ))}
      </nav>
      <Link className="header-cta" href="/plan-your-event">Plan an event <span aria-hidden="true">↗</span></Link>
    </header>
  );
}
