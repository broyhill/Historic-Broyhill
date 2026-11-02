/* Historic Broyhill trip wires — drop <script src="/tripwire.js" defer></script>
   (optionally with data-lead="<leadId>") on any landing page.
   Fires page_visit on load, then engagement wires for elements marked
   data-tw="<event>" e.g. data-tw="rsvp", and any form submit (form_submit). */
(function () {
  var me = document.currentScript;
  var qs = new URLSearchParams(location.search);
  var lead = (me && me.dataset.lead) || qs.get("lid") || localStorage.getItem("hb_lead") || null;
  var email = qs.get("e") || null;
  if (lead) { try { localStorage.setItem("hb_lead", lead); } catch (e) {} }
  if (!lead && !email) return;

  function fire(type, extra) {
    var payload = Object.assign({
      lid: lead, email: email, type: type,
      url: location.href, path: location.pathname,
      referrer: document.referrer || null,
      campaignId: qs.get("c") || qs.get("utm_campaign") || null
    }, extra || {});
    try {
      var blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      if (!navigator.sendBeacon || !navigator.sendBeacon("/api/t/event", blob)) {
        fetch("/api/t/event", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload), keepalive: true });
      }
    } catch (e) { /* a wire never breaks the page */ }
  }

  fire("page_visit");

  document.addEventListener("click", function (ev) {
    var el = ev.target.closest && ev.target.closest("[data-tw]");
    if (el) fire(el.getAttribute("data-tw"), { detail: el.textContent.trim().slice(0, 120) });
  });

  document.addEventListener("submit", function (ev) {
    var f = ev.target;
    fire(f && f.dataset && f.dataset.tw ? f.dataset.tw : "form_submit",
      { detail: (f && f.id) || (f && f.action) || "form" });
  });

  var started = false;
  document.addEventListener("input", function () {
    if (!started) { started = true; fire("form_start"); }
  }, { once: true });
})();
