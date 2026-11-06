import Link from "next/link";

// Landing for the Wizard of Oz spine — merged into this app (lib/wizard, routes under
// /api/wizard/** and /admin/wizard-console) as the single-owner test ground.
export default function WizardLanding() {
  return (
    <div className="ins-app min-h-screen p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/admin" className="text-[13px] text-info hover:underline">← Back to console</Link>

        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-navy text-cream flex items-center justify-center text-xl font-bold tracking-tight" aria-hidden="true">OZ</div>
          <div>
            <h1 className="text-2xl font-semibold text-ink font-serif">Wizard of Oz</h1>
            <p className="text-[13.5px] text-muted">Marketing engine test ground — runs inside this app, single-owner</p>
          </div>
        </div>

        <section className="ibox"><div className="ibox-content">
          <h3 className="text-[14px] font-semibold text-ink mb-3">What's inside</h3>
          <ul className="text-[13.5px] text-muted space-y-1.5 list-disc pl-5">
            <li>Agency console — admin login, template editor, block studio</li>
            <li>11-gate dispatch chain — approvals → authorization → live order → kill switch; <strong>inert by default</strong> (fails closed to dry-run)</li>
            <li>Immutable variants — editing an authorized campaign forks a new hash</li>
            <li>Inbound capture (NFC / QR / web) + unsubscribe & suppression</li>
            <li>48h engagement journeys and per-lead activity log</li>
          </ul>
        </div></section>

        <section className="ibox"><div className="ibox-content">
          <h3 className="text-[14px] font-semibold text-ink mb-3">Open the console</h3>
          <p className="text-[13.5px] text-muted mb-3">
            <Link href="/admin/wizard-console" className="text-info hover:underline font-semibold">/admin/wizard-console</Link>{" "}
            — needs <code>WIZARD_AGENCY_DATABASE_URL</code> pointed at a dev Postgres and a seeded owner
            (<code>WIZARD_SEED_ADMIN_EMAIL</code>/<code>WIZARD_SEED_ADMIN_PASSWORD</code>). Without them the console shows its login and nothing more.
          </p>
          <p className="text-[12.5px] text-subtle">Dispatch stays a dry run until the provider adapters are bound — nothing can send on its own.</p>
        </div></section>

        <section className="ibox"><div className="ibox-content">
          <h3 className="text-[14px] font-semibold text-ink mb-3">How it's wired</h3>
          <ul className="text-[13.5px] text-muted space-y-1.5 list-disc pl-5">
            <li>Code lives in <code>lib/wizard/</code> with its own Prisma client — wizard tables are <code>wz_*</code>, no collision with app tables</li>
            <li>API mounted at <code>/api/wizard/**</code>; public intake at <code>/wizard/capture</code>, <code>/wizard/unsubscribe</code></li>
            <li>Tenant/RBAC kept but resolves to one owner silo (<code>WIZARD_DEFAULT_SILO_SLUG</code>)</li>
            <li>Original vendored copy kept at <code>wizard/</code> for reference</li>
          </ul>
        </div></section>
      </div>
    </div>
  );
}
