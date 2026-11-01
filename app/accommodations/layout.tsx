import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stay & Things To Do — Historic Broyhill",
  description: "Where guests stay and what to do around Historic Broyhill in Clemmons, NC: on-site suite, partner hotels and Tanglewood Park nearby.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
