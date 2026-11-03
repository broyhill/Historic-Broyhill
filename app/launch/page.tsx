import type { Metadata } from "next";
import LaunchFlow from "./LaunchFlow";

export const metadata: Metadata = {
  title: "Launch your campaign — Historic Broyhill",
  description: "Drop your website. We read your brand, find your competitors, and draft your campaign plan in about a minute.",
};

export default function LaunchPage() {
  return <LaunchFlow />;
}
