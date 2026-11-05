/* E27 shared Gantt renderer. Callers supply rows. This file does not load data. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BgopGantt = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var TONES = ['solid', 'weak', 'blocked', 'done', 'planned'];
  var TONE = {};
  for (var i = 0; i < TONES.length; i++) TONE[TONES[i]] = true;

  function instant(value) {
    var t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }

  function toneOf(value) {
    return TONE[value] ? value : 'solid';
  }

  function layout(model) {
    var source = (model && model.rows) || [];
    var usable = [];
    for (var i = 0; i < source.length; i++) {
      var row = source[i] || {};
      var start = instant(row.start);
      var end = instant(row.end);
      if (start === null || end === null) continue;
      if (end < start) end = start;
      usable.push({
        id: String(row.id == null ? i : row.id),
        label: String(row.label == null ? '' : row.label),
        lane: String(row.lane == null ? '' : row.lane),
        href: row.href ? String(row.href) : '',
        title: String(row.title == null ? '' : row.title),
        tone: toneOf(row.tone),
        start: start,
        end: end
      });
    }
    if (!usable.length) {
      return { bars: [], ticks: [], empty: true };
    }
    var min = Infinity;
    var max = -Infinity;
    for (var j = 0; j < usable.length; j++) {
      min = Math.min(min, usable[j].start);
      max = Math.max(max, usable[j].end);
    }
    if (max <= min) max = min + 86400000;
    var span = max - min;
    var bars = [];
    for (var k = 0; k < usable.length; k++) {
      var item = usable[k];
      bars.push({
        id: item.id,
        label: item.label,
        lane: item.lane,
        href: item.href,
        title: item.title,
        tone: item.tone,
        left: (100 * (item.start - min) / span).toFixed(3),
        width: Math.max(100 * (item.end - item.start) / span, 0.15).toFixed(3)
      });
    }
    var ticks = [];
    var ticksN = 6;
    for (var n = 0; n <= ticksN; n++) {
      ticks.push({
        left: (100 * n / ticksN).toFixed(2),
        at: min + span * n / ticksN
      });
    }
    return { bars: bars, ticks: ticks, empty: false, min: min, max: max };
  }

  function tickText(ms, zone) {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: zone || 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date(ms));
    } catch (err) {
      return new Date(ms).toISOString().slice(0, 10);
    }
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function ensureStyle() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('bgop-gantt-style')) return;
    var style = document.createElement('style');
    style.id = 'bgop-gantt-style';
    style.textContent = [
      '.bgop-gantt-row{display:grid;grid-template-columns:340px 1fr;border-bottom:1px solid #f1f1f4}',
      '.bgop-gantt-row:hover{background:#f7f9ff}',
      '.bgop-gantt-doc{padding:4px 10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px}',
      '.bgop-gantt-doc a{color:#1f4e9c;text-decoration:none}',
      '.bgop-gantt-lane-name{color:#6b6b7b;font-size:11px;margin-right:6px}',
      '.bgop-gantt-lane{position:relative;min-height:24px}',
      '.bgop-gantt-bar{position:absolute;top:6px;height:12px;min-width:4px;border-radius:4px;opacity:.85}',
      '.bgop-gantt-tone-solid{background:#1f4e9c}',
      '.bgop-gantt-tone-weak{background:#d97706}',
      '.bgop-gantt-tone-blocked{background:#dc2626}',
      '.bgop-gantt-tone-done{background:#059669}',
      '.bgop-gantt-tone-planned{background:#7c3aed}'
    ].join('');
    document.head.appendChild(style);
  }

  function mount(element, model, options) {
    var view = layout(model || {});
    var zone = (model && model.displayZone) || 'UTC';
    options = options || {};
    if (typeof document === 'undefined' || !element) return view;
    ensureStyle();
    element.innerHTML = '';
    var frag = document.createDocumentFragment();
    for (var i = 0; i < view.bars.length; i++) {
      var bar = view.bars[i];
      var row = document.createElement('div');
      row.className = 'bgop-gantt-row';
      row.setAttribute('data-id', bar.id);
      var label = esc(bar.label);
      var body = bar.href
        ? '<a href="' + esc(bar.href) + '" target="_blank" title="' + esc(bar.title) + '">' + label + '</a>'
        : '<span title="' + esc(bar.title) + '">' + label + '</span>';
      row.innerHTML =
        '<div class="bgop-gantt-doc"><span class="bgop-gantt-lane-name">' + esc(bar.lane) + '</span>' + body + '</div>' +
        '<div class="bgop-gantt-lane"><div class="bgop-gantt-bar bgop-gantt-tone-' + bar.tone + '"' +
        ' style="left:' + bar.left + '%;width:' + bar.width + '%" title="' + esc(bar.title) + '"></div></div>';
      frag.appendChild(row);
    }
    element.appendChild(frag);
    if (options.axis) {
      options.axis.innerHTML = '';
      for (var t = 0; t < view.ticks.length; t++) {
        var tick = view.ticks[t];
        options.axis.insertAdjacentHTML(
          'beforeend',
          '<span style="left:' + tick.left + '%">' + esc(tickText(tick.at, zone)) + '</span>'
        );
      }
    }
    return view;
  }

  return { TONES: TONES, layout: layout, mount: mount };
});
