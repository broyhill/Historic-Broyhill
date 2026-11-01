/** Public facts about the venue. Source: issue #6 fact sheet and www.broyhill.net only. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://historic-broyhill.vercel.app";

export const VENUE = {
  name: "Historic Broyhill",
  phone: "336-793-1191",
  phoneHref: "tel:+13367931191",
  email: "Info@Broyhill.net",
  suitesEmail: "Kristin@Broyhill.net",
  street: "3540 Clemmons Road, Suite 111",
  city: "Clemmons",
  state: "NC",
  zip: "27012",
  instagram: "https://www.instagram.com/historicbroyhill/",
  facebook: "https://web.facebook.com/thebroyhill",
  booking: "https://broyhill.skedda.com/booking",
};

/** schema.org EventVenue — only published facts; no hours, prices or coordinates until confirmed. */
export function venueJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": ["EventVenue", "LocalBusiness"],
    name: VENUE.name,
    url: SITE_URL,
    telephone: VENUE.phone,
    email: VENUE.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: VENUE.street,
      addressLocality: VENUE.city,
      addressRegion: VENUE.state,
      postalCode: VENUE.zip,
      addressCountry: "US",
    },
    sameAs: [VENUE.instagram, VENUE.facebook],
    description:
      "A 1920s school building in Clemmons, North Carolina, converted to event spaces, Class A executive offices, a Virtual Office Program and the HB Podcast Studio.",
  };
}
