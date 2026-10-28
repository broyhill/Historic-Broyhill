/* Site header with two-tier navigation matching Graylyn structure */
/* Historic Broyhill brand: navy (#182c3e), cream (#f4ecda), gold (#c2a15a) */

export default function SiteHeader() {
  return (
    <>
      {/* Top bar */}
      <div className="bg-[#182c3e] border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-2">
          <a href="/" className="text-[11px] text-[#cdd5d9] hover:text-white">
            &lt;&lt; BACK TO HOME
          </a>
          
          <div className="flex flex-col items-center">
            <span className="hb-display text-xl tracking-wide text-[#f4ecda]">HISTORIC BROYHILL</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#d4c4a0]">EVENTS &amp; MEETINGS</span>
          </div>
          
          <a href="#visit" className="rounded bg-[#c2a15a] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#182c3e] hover:bg-[#d2b268]">
            REQUEST FOR PROPOSAL
          </a>
        </div>
      </div>

      {/* Divider line with circle */}
      <div className="bg-[#182c3e]">
        <div className="mx-auto max-w-6xl px-5">
          <div className="h-px bg-white/20 relative">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white" />
          </div>
        </div>
      </div>

      {/* Main navigation */}
      <div className="bg-[#182c3e] border-b border-white/10">
        <div className="mx-auto max-w-6xl px-5">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <a href="#venues" className="text-[13px] font-medium text-[#cdd5d9] hover:text-white">
                MEETINGS &amp; CORPORATE EVENTS
              </a>
              <a href="/team-building" className="text-[13px] font-medium text-[#cdd5d9] hover:text-white">
                TEAM BUILDING
              </a>
              <a href="/packages" className="text-[13px] font-medium text-[#cdd5d9] hover:text-white">
                PACKAGES
              </a>
              <a href="/enhancements" className="text-[13px] font-medium text-[#cdd5d9] hover:text-white">
                ENHANCEMENTS
              </a>
              <a href="/accommodations" className="text-[13px] font-medium text-[#cdd5d9] hover:text-white">
                ACCOMMODATIONS
              </a>
              <a href="/gallery" className="text-[13px] font-medium text-[#cdd5d9] hover:text-white">
                GALLERY
              </a>
            </div>
          </nav>
        </div>
      </div>
    </>
  );
}
