import Link from "next/link";

// Landing for the vendored Wizard of Oz spine (wizard/ in this repo, copied
// from XSELLNET E68). Single-user test ground — the app itself runs standalone
// (`cd wizard && npm install && npm run dev`) until its models reconcile into
// the root schema.
export default function WizardLanding() {
  return (
    <div className="ins-app min-h-screen p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/admin" className="text-[13px] text-info hover:underline">← Back to console</Link>

        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-navy text-cream flex items-center justify-center text-xl font-bold tracking-tight" aria-hidden="true">OZ</div>
          <div>
            <h1 className="text-2xl font-semibold text-ink font-serif">Wizard of Oz</h1>
            <p className="text-[13.5px] text-muted">Marketing engine test ground — vendored into this repo at <code>wizard/</code></p>
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
          <h3 className="text-[14px] font-semibold text-ink mb-3">Run it</h3>
          <pre className="text-[12.5px] bg-navy text-cream rounded-md p-4 overflow-x-auto">cd wizard
npm install
npm run db:push:dev    # guarded — refuses anything but a dev DB
npm run dev            # → localhost:3000/admin</pre>
          <p className="text-[12.5px] text-subtle mt-3">Dispatch stays a dry run until the provider adapters are bound — nothing can send on its own.</p>
        </div></section>

        <section className="ibox"><div className="ibox-content">
          <h3 className="text-[14px] font-semibold text-ink mb-3">Before it merges into this app</h3>
          <ul className="text-[13.5px] text-muted space-y-1.5 list-disc pl-5">
            <li><code>LeadProfile</code>, <code>JourneyRun</code>, <code>AiContentPipeline</code>, <code>Business</code> exist in both schemas with different fields — reconcile into the root Prisma schema</li>
            <li>Tenant/RBAC plumbing collapses to a single-owner scope for single-user HB</li>
          </ul>
        </div></section>
      </div>
    </div>
  );
}
