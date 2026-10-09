/**
 * Server-rendered HTML for GET /api/health in a browser: the endpoint
 * catalogue grouped by module, with live status filled in by a small inline
 * script that polls /api/health/check. No build step, no external assets.
 * Every interpolated string goes through esc().
 */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const MODULE_TITLES = {
  health: 'Health', auth: 'Auth', customers: 'Customers', menu: 'Menu', orders: 'Orders', billing: 'Billing',
  tables: 'Tables', reservations: 'Reservations', inventory: 'Inventory', staff: 'Staff', analytics: 'Analytics',
  notifications: 'Notifications', settings: 'Settings',
};

function accessLine(entry) {
  if (entry.auth === 'none') return 'Public; no token needed.';
  if (entry.auth === 'optional') return 'Public; a Bearer token is used if sent.';
  if (!entry.roles.length) return 'Bearer token required; any signed-in role.';
  const where = entry.rolesSource === 'handler' ? 'checked in the handler' : 'requireRole guard';
  return `Bearer token required; roles: ${entry.roles.join(', ')} (${where}).`;
}

function roleChips(entry) {
  if (entry.auth !== 'required') return '<span class="chip">public</span>';
  if (!entry.roles.length) return '<span class="chip">signed-in</span>';
  return entry.roles.map((r) => `<span class="chip">${esc(r)}</span>`).join('');
}

function fieldTable(title, fields) {
  if (!fields || !Object.keys(fields).length) return '';
  const rows = Object.entries(fields)
    .map(([name, f]) => `<tr><td><code>${esc(name)}</code></td><td>${esc(f.type)}</td><td>${f.required ? 'required' : 'optional'}</td><td>${esc(f.note)}</td></tr>`)
    .join('');
  return `<div class="block"><h4>${esc(title)}</h4><div class="tablewrap"><table class="fields"><thead><tr><th>Field</th><th>Type</th><th></th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

function details(entry) {
  const parts = [];
  parts.push(`<p class="summary-text">${esc(entry.summary)}</p>`);
  const access = entry.access ? `${accessLine(entry)} ${entry.access}` : accessLine(entry);
  parts.push(`<div class="block"><h4>Access</h4><p>${esc(access)}</p></div>`);
  if (entry.params.length) {
    parts.push(`<div class="block"><h4>Path parameters</h4><p>${entry.params.map((p) => `<code>:${esc(p)}</code>`).join(' ')}</p></div>`);
  }
  parts.push(fieldTable('Query string', entry.query));
  parts.push(fieldTable('JSON body', entry.body));
  if (entry.response) {
    parts.push(
      `<div class="block"><h4>Response <span class="muted">${esc(entry.response.status)} · application/json · example shape</span></h4>`
      + `<pre>${esc(JSON.stringify(entry.response.example, null, 2))}</pre></div>`,
    );
  }
  if (entry.errors.length) {
    parts.push(`<div class="block"><h4>Errors</h4><ul>${entry.errors.map((e) => `<li>${esc(e)}</li>`).join('')}<li>All errors: <code>{ "error": "message" }</code></li></ul></div>`);
  }
  const probe = entry.probe.enabled
    ? '<p class="probe-detail" data-probe-detail>Waiting for the first check.</p>'
    : `<p>${esc(entry.probe.reason)}${entry.method === 'GET' ? '' : ': calling it could change data, so this page never does'}.</p>`;
  parts.push(`<div class="block"><h4>Live probe</h4>${probe}</div>`);
  return parts.join('');
}

function row(entry) {
  const search = [entry.method, entry.path, entry.summary, entry.module, ...entry.roles].join(' ').toLowerCase();
  const initial = entry.probe.enabled ? 'pending' : 'skipped';
  const statusText = entry.probe.enabled ? 'Checking' : 'Not probed';
  return `<details class="ep" data-id="${esc(entry.id)}" data-method="${esc(entry.method)}" data-status="${initial}" data-search="${esc(search)}"${entry.documented ? '' : ' data-undocumented'}>
<summary>
<span class="m">${esc(entry.method)}</span>
<span class="p"><code>${esc(entry.path)}</code>${entry.documented ? '' : ' <span class="flag">undocumented</span>'}</span>
<span class="r">${roleChips(entry)}</span>
<span class="s"><i class="dot"></i><span data-status-text>${statusText}</span></span>
<span class="l" data-latency>–</span>
</summary>
<div class="body">${details(entry)}</div>
</details>`;
}

function section(module, entries) {
  const title = MODULE_TITLES[module] ?? module;
  return `<section class="module" data-module="${esc(module)}">
<h2 id="m-${esc(module)}">${esc(title)} <span class="count">${entries.length} endpoint${entries.length === 1 ? '' : 's'}</span></h2>
<div class="head" aria-hidden="true"><span>Method</span><span>Path</span><span>Access</span><span>Status</span><span class="l">Latency</span></div>
${entries.map(row).join('\n')}
</section>`;
}

function formatUptime(seconds) {
  if (!Number.isFinite(seconds)) return 'Unknown';
  const s = Math.floor(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

const CSS = `
:root{--bg:#f7f7f5;--panel:#fff;--text:#1c1c1a;--muted:#6b6b66;--line:#e2e2dd;--line-strong:#cfcfc8;--code-bg:#f1f1ed;
--up:#1f7a3d;--auth:#2c6e8f;--warn:#9a6200;--down:#b42318;--idle:#8a8a84;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--panel:#1b1b1a;--text:#e8e8e3;--muted:#9a9a93;--line:#2c2c2a;--line-strong:#3a3a37;--code-bg:#232321;
--up:#5cc27f;--auth:#6fb3d6;--warn:#e0a94a;--down:#f0776b;--idle:#76766f;color-scheme:dark}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
code,pre,.m,.l,.num{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace}
.wrap{max-width:1120px;margin:0 auto;padding:24px 16px 48px}
header{border-bottom:1px solid var(--line-strong);padding-bottom:16px;margin-bottom:16px}
.eyebrow{font-size:12px;color:var(--muted);letter-spacing:.02em;margin:0 0 4px}
h1{font-size:22px;font-weight:600;margin:0 0 12px}
.overall{display:inline-flex;align-items:center;gap:8px;font-weight:600}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0;border:1px solid var(--line);background:var(--panel);margin-top:12px}
.meta div{padding:10px 12px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);margin:0 -1px -1px 0}
.meta dt{font-size:12px;color:var(--muted)}.meta dd{margin:2px 0 0;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.ind{display:inline-flex;align-items:baseline;gap:6px}.ind .dot{position:relative;top:-1px}
.tally{display:flex;flex-wrap:wrap;gap:6px 18px;margin:14px 0 0;padding:0;list-style:none;font-variant-numeric:tabular-nums}
.tally li{display:flex;align-items:center;gap:6px}.tally b{font-weight:600}
.controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:16px 0 8px}
.controls input,.controls select,.controls button{font:inherit;color:var(--text);background:var(--panel);border:1px solid var(--line-strong);border-radius:4px;padding:6px 8px;min-height:34px}
.controls input{flex:1 1 240px;min-width:0}
.controls select{min-width:0;max-width:100%}
.controls button{cursor:pointer}.controls button:hover{border-color:var(--muted)}
.controls .spacer{flex:1}
:focus-visible{outline:2px solid var(--auth);outline-offset:1px}
nav.toc{font-size:13px;color:var(--muted);margin:4px 0 8px}
nav.toc a{color:var(--muted);margin-right:10px;white-space:nowrap}
.module{margin-top:28px}
h2{font-size:15px;font-weight:600;margin:0 0 6px;display:flex;align-items:baseline;gap:10px}
h2 .count{font-weight:400;font-size:12px;color:var(--muted)}
.head,.ep>summary{display:grid;grid-template-columns:64px minmax(0,1fr) minmax(0,220px) 150px 72px;gap:12px;align-items:center}
.head{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);padding:0 12px 4px;border-bottom:1px solid var(--line-strong)}
.ep{background:var(--panel);border-bottom:1px solid var(--line)}
.ep>summary{padding:8px 12px;cursor:pointer;list-style:none}
.ep>summary::-webkit-details-marker{display:none}
.ep>summary:hover{background:var(--code-bg)}
.ep[open]>summary{border-bottom:1px solid var(--line)}
.m{font-size:12px;font-weight:600;border:1px solid var(--line-strong);border-radius:3px;text-align:center;padding:1px 0;color:var(--text)}
.p{min-width:0;overflow-wrap:anywhere}.p code{font-size:13px}
.r{display:flex;flex-wrap:wrap;gap:4px}
.chip{font-size:11px;padding:0 6px;border-radius:3px;background:var(--code-bg);color:var(--muted);border:1px solid var(--line);white-space:nowrap}
.flag{font-size:11px;color:var(--warn);border:1px solid currentColor;border-radius:3px;padding:0 4px;margin-left:4px}
.s{display:flex;align-items:center;gap:6px;font-size:13px;white-space:nowrap}
.l{text-align:right;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--idle);flex:none}
[data-status=up] .dot,.dot.up{background:var(--up)}[data-status=auth] .dot,.dot.auth{background:var(--auth)}
[data-status=warn] .dot,.dot.warn{background:var(--warn)}[data-status=down] .dot,.dot.down{background:var(--down)}
[data-status=skipped] .dot{background:transparent;border:1px solid var(--idle)}
[data-status=down] .s{color:var(--down);font-weight:600}
.body{padding:12px 12px 16px 88px;font-size:13px}
.body p{margin:0}.summary-text{margin-bottom:10px!important}
.block{margin-top:12px}
h4{margin:0 0 4px;font-size:12px;font-weight:600}
.muted{color:var(--muted);font-weight:400}
.tablewrap{overflow-x:auto}
table.fields{border-collapse:collapse;width:100%}
.fields th,.fields td{text-align:left;padding:4px 10px 4px 0;border-bottom:1px solid var(--line);vertical-align:top}
.fields th{font-size:11px;color:var(--muted);font-weight:500}
.fields td:nth-child(3){color:var(--muted)}
pre{background:var(--code-bg);border:1px solid var(--line);padding:10px;margin:0;overflow:auto;max-height:340px;font-size:12px;line-height:1.45}
ul{margin:0;padding-left:18px}
.empty{color:var(--muted);padding:24px 0;display:none}
footer{margin-top:36px;border-top:1px solid var(--line-strong);padding-top:12px;font-size:12px;color:var(--muted)}
footer a{color:inherit}
footer dl{display:grid;grid-template-columns:max-content 1fr;gap:2px 12px;margin:8px 0}
footer dt{display:flex;align-items:center;gap:6px}
.hidden{display:none!important}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:720px){
 .head{display:none}
 .ep>summary{grid-template-columns:56px minmax(0,1fr) auto;grid-template-areas:"m p p" "r r s";row-gap:6px}
 .m{grid-area:m}.p{grid-area:p}.r{grid-area:r}.s{grid-area:s;justify-self:end}.l{display:none}
 .ep[data-latency-shown] .s::after{content:attr(data-ms);color:var(--muted);font-size:12px;font-family:ui-monospace,Menlo,Consolas,monospace}
 .s{white-space:normal;text-align:right}
 .body{padding:12px}
 .meta{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
 .controls input{flex-basis:100%}
 .controls select{flex:1 1 calc(50% - 4px)}
 .controls .spacer{display:none}
 .controls button{flex:1 1 auto}
 nav.toc a{display:inline-block;margin-bottom:2px}
}
`;

const SCRIPT = `
(function(){
  var base = location.pathname.replace(/\\/+$/, '');
  var LABEL = {up:'Up', auth:'Up · auth required', warn:'Unexpected 4xx', down:'Down', skipped:'Not probed', pending:'Checking'};
  var rows = Array.prototype.slice.call(document.querySelectorAll('.ep'));
  var byId = {}; rows.forEach(function(r){ byId[r.getAttribute('data-id')] = r; });
  var $ = function(id){ return document.getElementById(id); };
  var timer = null, paused = false, INTERVAL = 15000;

  function setText(el, text){ if (el) el.textContent = text; }

  function apply(data){
    data.results.forEach(function(res){
      var row = byId[res.id]; if (!row) return;
      row.setAttribute('data-status', res.status);
      setText(row.querySelector('[data-status-text]'), LABEL[res.status] || res.status);
      var lat = row.querySelector('[data-latency]');
      var s = row.querySelector('.s');
      if (typeof res.latencyMs === 'number') {
        setText(lat, res.latencyMs + ' ms');
        s.setAttribute('data-ms', ' ' + res.latencyMs + ' ms'); row.setAttribute('data-latency-shown', '');
      }
      var d = row.querySelector('[data-probe-detail]');
      if (d) setText(d, 'GET ' + (res.probedPath || '') + ' without a token → ' + (res.httpStatus == null ? (res.reason || 'no response') : 'HTTP ' + res.httpStatus) + (typeof res.latencyMs === 'number' ? ' in ' + res.latencyMs + ' ms' : '') + '. ' + (LABEL[res.status] || '') + '.');
    });
    var s = data.summary;
    setText($('n-up'), s.up); setText($('n-auth'), s.auth); setText($('n-warn'), s.warn); setText($('n-down'), s.down); setText($('n-skipped'), s.skipped);
    var probed = s.up + s.auth + s.warn + s.down;
    var overall = s.down > 0 || data.database.status === 'down' ? 'down' : s.warn > 0 ? 'warn' : 'up';
    var ov = $('overall');
    ov.querySelector('.dot').className = 'dot ' + overall;
    setText(ov.querySelector('span'), overall === 'up' ? 'All probed endpoints responding' : overall === 'warn' ? 'Responding, with warnings' : (s.down + ' of ' + probed + ' probed endpoints down' + (data.database.status === 'down' ? ', database unreachable' : '')));
    var db = data.database;
    $('db-dot').className = 'dot ' + (db.status === 'up' ? 'up' : db.status === 'down' ? 'down' : '');
    setText($('db-text'),db.enabled ? 'Postgres · ' + (db.status === 'up' ? 'reachable, ' + db.latencyMs + ' ms' : 'unreachable') : 'In-memory only (no database configured)');
    setText($('checked'), new Date(data.checkedAt).toLocaleTimeString() + ' · took ' + data.durationMs + ' ms');
    filter();
  }

  function fail(){
    setText($('checked'), 'Check failed at ' + new Date().toLocaleTimeString() + ' · retrying');
    var ov = $('overall'); ov.querySelector('.dot').className = 'dot down';
    setText(ov.querySelector('span'), 'Status check unavailable');
  }

  function check(){
    clearTimeout(timer);
    setText($('refresh-state'), 'Checking…');
    fetch(base + '/check', {headers:{accept:'application/json'}, cache:'no-store'})
      .then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(apply, fail)
      .then(schedule);
  }

  function schedule(){
    clearTimeout(timer);
    if (paused || document.hidden) { setText($('refresh-state'), paused ? 'Auto-refresh paused' : 'Paused while tab is hidden'); return; }
    setText($('refresh-state'), 'Refreshing every ' + INTERVAL / 1000 + ' s');
    timer = setTimeout(check, INTERVAL);
  }

  function filter(){
    var q = $('q').value.trim().toLowerCase();
    var method = $('f-method').value, status = $('f-status').value, mod = $('f-module').value;
    var shown = 0;
    document.querySelectorAll('.module').forEach(function(sec){
      var any = false;
      sec.querySelectorAll('.ep').forEach(function(r){
        var st = r.getAttribute('data-status');
        var ok = (!q || r.getAttribute('data-search').indexOf(q) !== -1)
          && (!method || r.getAttribute('data-method') === method)
          && (!mod || sec.getAttribute('data-module') === mod)
          && (!status || (status === 'up' ? (st === 'up' || st === 'auth') : status === 'undocumented' ? r.hasAttribute('data-undocumented') : st === status));
        r.classList.toggle('hidden', !ok); if (ok) { any = true; shown++; }
      });
      sec.classList.toggle('hidden', !any);
    });
    $('empty').style.display = shown ? 'none' : 'block';
    setText($('shown'), shown + ' shown');
  }

  ['q','f-method','f-status','f-module'].forEach(function(id){ $(id).addEventListener('input', filter); });
  $('toggle').addEventListener('click', function(){ paused = !paused; this.textContent = paused ? 'Resume' : 'Pause'; this.setAttribute('aria-pressed', String(paused)); schedule(); });
  $('now').addEventListener('click', check);
  document.addEventListener('visibilitychange', function(){ if (!document.hidden && !paused) check(); else schedule(); });
  filter();
  check();
})();
`;

/**
 * @param {{ catalog: object[], service: string, uptimeSeconds: number, persistence: boolean, nonce: string, generatedAt: string }} input
 */
export function renderHealthPage({ catalog, service, uptimeSeconds, persistence, nonce, generatedAt }) {
  const modules = [];
  const grouped = new Map();
  for (const e of catalog) {
    if (!grouped.has(e.module)) {
      grouped.set(e.module, []);
      modules.push(e.module);
    }
    grouped.get(e.module).push(e);
  }
  const methods = [...new Set(catalog.map((e) => e.method))];
  const undocumented = catalog.filter((e) => !e.documented).length;
  const probed = catalog.filter((e) => e.probe.enabled).length;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<link rel="icon" href="data:,">
<title>API status · ${esc(service)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
<header>
<p class="eyebrow">${esc(service)} · REST API</p>
<h1>API status</h1>
<div class="overall" id="overall" role="status" aria-live="polite"><i class="dot"></i><span>Running first check…</span></div>
<dl class="meta">
<div><dt>Last checked</dt><dd id="checked">Not yet</dd></div>
<div><dt>Refresh</dt><dd id="refresh-state">Starting</dd></div>
<div><dt>Persistence</dt><dd><span class="ind"><i class="dot" id="db-dot"></i><span id="db-text">${persistence ? 'Postgres · checking' : 'In-memory only (no database configured)'}</span></span></dd></div>
<div><dt>Process uptime</dt><dd class="num">${esc(formatUptime(uptimeSeconds))}</dd></div>
<div><dt>Endpoints</dt><dd class="num">${catalog.length} total · ${probed} probed${undocumented ? ` · ${undocumented} undocumented` : ''}</dd></div>
</dl>
<ul class="tally" aria-label="Probe results">
<li><i class="dot up"></i><b id="n-up">–</b> up</li>
<li><i class="dot auth"></i><b id="n-auth">–</b> up, auth required</li>
<li><i class="dot warn"></i><b id="n-warn">–</b> unexpected 4xx</li>
<li><i class="dot down"></i><b id="n-down">–</b> down</li>
<li><i class="dot"></i><b id="n-skipped">–</b> not probed</li>
</ul>
</header>

<div class="controls">
<label class="sr" for="q">Search endpoints</label>
<input id="q" type="search" placeholder="Search path, description, role" autocomplete="off">
<label class="sr" for="f-module">Module</label>
<select id="f-module"><option value="">All modules</option>${modules.map((m) => `<option value="${esc(m)}">${esc(MODULE_TITLES[m] ?? m)}</option>`).join('')}</select>
<label class="sr" for="f-method">Method</label>
<select id="f-method"><option value="">All methods</option>${methods.map((m) => `<option>${esc(m)}</option>`).join('')}</select>
<label class="sr" for="f-status">Status</label>
<select id="f-status"><option value="">Any status</option><option value="up">Up</option><option value="down">Down</option><option value="warn">Unexpected 4xx</option><option value="skipped">Not probed</option><option value="undocumented">Undocumented</option></select>
<span class="spacer"></span>
<span class="muted" id="shown"></span>
<button type="button" id="now">Check now</button>
<button type="button" id="toggle" aria-pressed="false">Pause</button>
</div>
<nav class="toc" aria-label="Modules">${modules.map((m) => `<a href="#m-${esc(m)}">${esc(MODULE_TITLES[m] ?? m)}</a>`).join('')}</nav>

${modules.map((m) => section(m, grouped.get(m))).join('\n')}
<p class="empty" id="empty">No endpoints match these filters.</p>

<footer>
<dl>
<dt><i class="dot up"></i>Up</dt><dd>Answered 2xx to an anonymous GET.</dd>
<dt><i class="dot auth"></i>Up, auth required</dt><dd>Answered 401/403 to an anonymous GET: the route is alive and protected.</dd>
<dt><i class="dot warn"></i>Unexpected 4xx</dt><dd>Answered, but with a client error other than 401/403.</dd>
<dt><i class="dot down"></i>Down</dt><dd>5xx, no response, or no answer within 4 s.</dd>
<dt><i class="dot"></i>Not probed</dt><dd>POST, PUT, PATCH and DELETE routes are never called by this page.</dd>
</dl>
<p>Probes send GET requests through this API with no credentials. Example responses are illustrative shapes, not live data. Errors always use <code>{ "error": "message" }</code>.
Machine-readable: <a href="?format=json">status JSON</a> · <a href="/api/health/endpoints" id="lnk-endpoints">endpoint catalogue</a> · <a href="/api/health/check" id="lnk-check">live check</a>. Rendered ${esc(generatedAt)}.</p>
</footer>
</div>
<script nonce="${esc(nonce)}">
(function(){var b=location.pathname.replace(/\\/+$/,'');document.getElementById('lnk-endpoints').href=b+'/endpoints';document.getElementById('lnk-check').href=b+'/check';})();
${SCRIPT}
</script>
</body>
</html>`;
}
