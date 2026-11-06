import type { Metadata } from "next";
import AuditFlow from "./AuditFlow";

export const metadata: Metadata = {
  title: "Landing page audit — free tool | Historic Broyhill",
  description: "Score any landing page in seconds: ten checks that decide whether a page converts — free, no account needed.",
};

export default function LandingPageAudit() {
  return <AuditFlow />;
}
