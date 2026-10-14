import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <Link className="wordmark footer-wordmark" href="/">
          <span>HISTORIC</span><strong>BROYHILL</strong>
        </Link>
        <p>Historic event spaces.<br />Class A offices for lease.</p>
        <Link className="button button-light" href="/contact">Start a conversation <span aria-hidden="true">↗</span></Link>
      </div>
      <div className="footer-bottom">
        <span>© Historic Broyhill</span>
        <span>Site details and imagery are being prepared.</span>
        <Link href="/contact">Contact & directions</Link>
      </div>
    </footer>
  );
}
