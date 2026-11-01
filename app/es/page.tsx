import type { Metadata } from "next";
import SiteHeader from "../components/SiteHeader";
import InquiryForm from "../components/InquiryForm";
import { SPACES } from "@/lib/spaces";
import { VENUE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Historic Broyhill — Salón de eventos en Clemmons, NC",
  description:
    "Salones para bodas, quinceañeras, reuniones de empresa, iglesias y organizaciones sin fines de lucro en un edificio histórico de los años 1920 en Clemmons, Carolina del Norte. Pida una propuesta.",
  alternates: { canonical: "/es", languages: { en: "/", es: "/es" } },
};

/* Spanish landing page. Facts are the same four rooms and contacts as the English site
   (issue #6 fact sheet); copy is a translation of those facts only. [CONFIRM: translation reviewed by a native speaker] */
export default function SpanishPage() {
  return (
    <main lang="es" className="hb-body bg-[#f6f1e7] text-[#273440]">
      <SiteHeader />
      <section className="bg-[#182c3e] text-[#e9e2d3]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b574]">Clemmons, Carolina del Norte</p>
          <h1 className="hb-display mt-5 text-4xl text-[#f4ecda] sm:text-5xl">Un lugar histórico para su celebración.</h1>
          <p className="mt-5 max-w-2xl text-[18px] leading-relaxed text-[#bcc6c9]">
            Bodas, quinceañeras, bautizos, fiestas de empresa, reuniones de iglesia y eventos comunitarios en una antigua escuela de los años 1920,
            a minutos de Winston-Salem. Nuestro equipo le ayuda a planear cada detalle.
          </p>
          <a href="#solicitud" className="mt-8 inline-flex min-h-[48px] items-center rounded-md bg-[#c2a15a] px-6 text-sm font-semibold uppercase tracking-[0.1em] text-[#182c3e] transition hover:bg-[#d6b574]">
            Pedir una propuesta
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12 md:py-16">
        <h2 className="hb-display text-3xl text-[#182c3e]">Nuestros salones</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {SPACES.map((s) => (
            <li key={s.id} className="rounded-xl border border-[#e4dac6] bg-white/60 p-5">
              <h3 className="hb-display text-xl text-[#182c3e]">{s.name}</h3>
              <p className="mt-1 text-[14px] text-[#7a6f58]">{s.maxGuests ? `Hasta ${s.maxGuests} invitados` : "Capacidad a consultar"}</p>
              <a href={`/event-spaces/${s.id}`} className="mt-3 inline-flex min-h-[44px] items-center text-sm font-semibold text-[#182c3e] hover:text-[#a8853f]">Ver detalles (en inglés) →</a>
            </li>
          ))}
        </ul>
      </section>

      <section id="solicitud" className="border-t border-[#e4dac6] bg-[#efe7d6]">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 md:grid-cols-5 md:py-16">
          <div className="md:col-span-2">
            <h2 className="hb-display text-3xl text-[#182c3e]">Cuéntenos su plan</h2>
            <p className="mt-4 text-[16px] text-[#5a6672]">Complete el formulario (en inglés) y le responderemos por correo electrónico, normalmente en un día hábil. También puede llamar o escribir:</p>
            <ul className="mt-5 space-y-2 text-[16px]">
              <li><a href={VENUE.phoneHref} className="inline-flex min-h-[44px] items-center font-semibold text-[#182c3e]">{VENUE.phone}</a></li>
              <li><a href={`mailto:${VENUE.email}`} className="inline-flex min-h-[44px] items-center font-semibold text-[#182c3e]">{VENUE.email}</a></li>
              <li className="text-[#5a6672]">{VENUE.street}, {VENUE.city}, {VENUE.state} {VENUE.zip}</li>
            </ul>
            <p className="mt-4 text-[13px] text-[#7a6f58]">¿Prefiere hablar en español? Indíquelo en el mensaje y buscaremos la forma de atenderle. [CONFIRM: Spanish-speaking staff availability]</p>
          </div>
          <div className="md:col-span-3">
            <InquiryForm initialEventType="Quinceañera" ctaLabel="Enviar solicitud" />
          </div>
        </div>
      </section>
    </main>
  );
}
