// $UD created globally by ../libs/js/ulanzideckApi.js. connect() with no arg → uuid from query.
let ACTION_SETTING = {};
let form = null;
let TYPE = 'repo';
let KEY_LABELS = {
  loading: 'loading…', updated: 'updated', pushed: 'pushed', offline: 'offline', notFound: 'not found', rateLimit: 'rate limited — add a token',
  stars: 'stars', forks: 'forks', issues: 'issues', watchers: 'watchers', prs: 'PRs',
  downloads: 'downloads', published: 'published', noRelease: 'no release',
  commitsWeek: 'commits / 7d', by: 'by', noCommits: 'no commits',
  success: 'passing', failed: 'failing', running: 'running', pending: 'pending', noRuns: 'no runs', run: 'run',
  followers: 'followers', repos: 'repos', gists: 'gists', following: 'following',
  remaining: 'remaining', resets: 'resets', version: 'version', author: 'author', status: 'status'
};
const THEMES = {
  github:  { bg: '#0d1117', up: '#3fb950', down: '#f85149', track: '#21262d', text: '#e6edf3', muted: '#7d8590', accent: '#58a6ff', star: '#e3b341' },
  midnight:{ bg: '#0b1020', up: '#34d399', down: '#fb7185', track: '#1e293b', text: '#e2e8f0', muted: '#64748b', accent: '#818cf8', star: '#fbbf24' },
  carbon:  { bg: '#0a0a0a', up: '#34d399', down: '#f87171', track: '#1f1f1f', text: '#f5f5f5', muted: '#737373', accent: '#a78bfa', star: '#fbbf24' },
  ocean:   { bg: '#011627', up: '#2ec4b6', down: '#e71d36', track: '#0a2a3a', text: '#cde7f0', muted: '#5b7a8a', accent: '#3aa0c4', star: '#ffcf5c' },
  grape:   { bg: '#1a1030', up: '#4ade80', down: '#fb7185', track: '#2e1f4a', text: '#ede9fe', muted: '#8b7aa8', accent: '#c084fc', star: '#fbbf24' },
  mono:    { bg: '#000000', up: '#ffffff', down: '#ff5b5b', track: '#222222', text: '#ffffff', muted: '#888888', accent: '#dddddd', star: '#ffffff' },
  paper:   { bg: '#f5f7fa', up: '#16a34a', down: '#dc2626', track: '#dde3ea', text: '#0f172a', muted: '#64748b', accent: '#2563eb', star: '#d97706' },
  snow:    { bg: '#ffffff', up: '#15803d', down: '#b91c1c', track: '#e5e7eb', text: '#111827', muted: '#6b7280', accent: '#1d4ed8', star: '#b45309' }
};
const REPO_METRICS = ['stars', 'forks', 'issues', 'watchers'];

$UD.connect();   // uuid taken from query → this action

$UD.onConnected(() => {
  TYPE = String($UD.uuid || '').split('.').pop();
  if (!['repo', 'release', 'commits', 'ci', 'issues', 'user', 'rate'].includes(TYPE)) TYPE = 'repo';
  form = document.querySelector('#property-inspector');
  document.querySelector('.udpi-wrapper').classList.remove('hidden');
  applyVisibility();
  buildSwatches(); buildSeg();

  document.getElementById('btn-refresh').addEventListener('click', () => { $UD.sendParamFromPlugin({ forceRefresh: Date.now() }); pulse('btn-refresh'); });
  document.getElementById('btn-tutorial').addEventListener('click', () => { $UD.openUrl('./property-inspector/tutorial.html#lang=' + ($UD.language || 'en') + '&t=' + TYPE, true); });
  const gt = document.getElementById('gen-token');
  if (gt) gt.addEventListener('click', (e) => { e.preventDefault(); $UD.openUrl('https://github.com/settings/tokens/new?description=Ulanzi%20Deck%20GitHub%20Repo%20Stats&scopes=repo', false); });

  const deb = Utils.debounce(() => { collectAndSend(); renderPreview(); }, 250);
  form.addEventListener('input', deb);
  ['repo', 'user', 'token', 'metric', 'intervalMin', 'font'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('change', () => { collectAndSend(); renderPreview(); }); });

  startPreview(); loadTranslations();
});

function applyVisibility() {
  const repoTypes = ['repo', 'release', 'commits', 'ci', 'issues'];
  show('grp-repo', repoTypes.includes(TYPE));
  show('grp-metric', false);
  show('grp-user', TYPE === 'user');
  show('grp-screen', false);
}
function show(id, on) { const el = document.getElementById(id); if (el) el.classList.toggle('hidden', !on); }

function buildSwatches() {
  const wrap = document.getElementById('theme-swatches'); wrap.innerHTML = '';
  Object.keys(THEMES).forEach(name => {
    const tm = THEMES[name];
    const el = document.createElement('div'); el.className = 'theme-swatch'; el.dataset.theme = name; el.title = name;
    el.innerHTML = `<i style="background:${tm.bg}"></i><i style="background:${tm.star}"></i><i style="background:${tm.accent}"></i>`;
    el.addEventListener('click', () => { document.getElementById('theme').value = name; highlightTheme(name); collectAndSend(); renderPreview(); });
    wrap.appendChild(el);
  });
}
function highlightTheme(n) { document.querySelectorAll('.theme-swatch').forEach(el => el.classList.toggle('active', el.dataset.theme === n)); }
function buildSeg() {
  document.querySelectorAll('#screen-seg button').forEach(b => b.addEventListener('click', () => { document.getElementById('screenMode').value = b.dataset.mode; highlightSeg(b.dataset.mode); collectAndSend(); renderPreview(); }));
  highlightSeg(document.getElementById('screenMode').value || '0');
}
function highlightSeg(m) { document.querySelectorAll('#screen-seg button').forEach(b => b.classList.toggle('active', b.dataset.mode === String(m))); }
function pulse(id) { const b = document.getElementById(id); if (!b) return; b.style.transform = 'scale(0.96)'; setTimeout(() => b.style.transform = '', 130); }

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function compact(n) { if (n == null || !isFinite(n)) return '—'; const a = Math.abs(n); if (a >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1).replace(/\.0$/, '') + 'M'; if (a >= 1e3) return (n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1).replace(/\.0$/, '') + 'k'; return String(n); }
function truncate(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function fitSize(s, b) { return Math.round(s.length <= 5 ? b : s.length <= 7 ? b * 0.8 : s.length <= 9 ? b * 0.66 : b * 0.55); }
function relTime(iso) { if (!iso) return ''; const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000); if (s < 3600) return Math.floor(s / 60) + 'm'; if (s < 86400) return Math.floor(s / 3600) + 'h'; if (s < 2592000) return Math.floor(s / 86400) + 'd'; if (s < 31536000) return Math.floor(s / 2592000) + 'mo'; return Math.floor(s / 31536000) + 'y'; }
function starPath(cx, cy, r) { let d = ''; const inner = r * 0.42; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rad = i % 2 === 0 ? r : inner; d += (i === 0 ? 'M' : 'L') + (cx + Math.cos(a) * rad).toFixed(1) + ' ' + (cy + Math.sin(a) * rad).toFixed(1); } return d + 'Z'; }
function estWidth(str, fs) { let w = 0; for (const c of String(str)) w += (c.charCodeAt(0) > 0x2e7f ? fs : fs * 0.58); return w; }
function titleOverflows(title) { return estWidth(String(title || ''), 22) > 232; }

function icon(name, cx, cy, s, color, t) {
  const sw = (s * 0.16).toFixed(1);
  const g = (inner) => `<g fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`;
  const dot = (r) => `<circle cx="${cx}" cy="${cy}" r="${(s * r).toFixed(1)}" fill="${color}"/>`;
  switch (name) {
    case 'star': return `<path d="${starPath(cx, cy, s)}" fill="${color}"/>`;
    case 'fork': { const a = s * 0.66, b = s * 0.72, r = (s * 0.3).toFixed(1); return g(`<circle cx="${cx - a}" cy="${cy - b}" r="${r}"/><circle cx="${cx + a}" cy="${cy - b}" r="${r}"/><circle cx="${cx}" cy="${cy + b}" r="${r}"/><path d="M${cx} ${cy + b - s * 0.3} V${cy - s * 0.1} M${cx - a} ${cy - b + s * 0.3} V${cy - s * 0.1} H${cx + a} V${cy - b + s * 0.3}"/>`); }
    case 'issue': return g(`<circle cx="${cx}" cy="${cy}" r="${s * 0.9}"/>`) + dot(0.3);
    case 'pr': { const a = s * 0.6, r = (s * 0.3).toFixed(1); return g(`<circle cx="${cx - a}" cy="${cy - s * 0.72}" r="${r}"/><circle cx="${cx - a}" cy="${cy + s * 0.72}" r="${r}"/><circle cx="${cx + a}" cy="${cy - s * 0.72}" r="${r}"/><path d="M${cx - a} ${cy - s * 0.42} V${cy + s * 0.42} M${cx + a} ${cy - s * 0.42} V${cy} a${s * 0.7} ${s * 0.7} 0 0 1 ${-s * 0.7} ${s * 0.5}"/>`); }
    case 'eye': return g(`<path d="M${cx - s} ${cy} Q${cx} ${cy - s * 0.85} ${cx + s} ${cy} Q${cx} ${cy + s * 0.85} ${cx - s} ${cy} Z"/>`) + dot(0.34);
    case 'download': return g(`<path d="M${cx} ${cy - s} V${cy + s * 0.35}"/><path d="M${cx - s * 0.5} ${cy - s * 0.15} L${cx} ${cy + s * 0.4} L${cx + s * 0.5} ${cy - s * 0.15}"/><path d="M${cx - s * 0.85} ${cy + s * 0.55} V${cy + s} H${cx + s * 0.85} V${cy + s * 0.55}"/>`);
    case 'tag': return g(`<path d="M${cx - s} ${cy - s * 0.6} L${cx + s * 0.25} ${cy - s * 0.6} A${s * 0.3} ${s * 0.3} 0 0 1 ${cx + s * 0.5} ${cy - s * 0.45} L${cx + s} ${cy} L${cx + s * 0.5} ${cy + s * 0.45} A${s * 0.3} ${s * 0.3} 0 0 1 ${cx + s * 0.25} ${cy + s * 0.6} L${cx - s} ${cy + s * 0.6} Z"/>`) + `<circle cx="${(cx - s * 0.55).toFixed(1)}" cy="${cy}" r="${(s * 0.15).toFixed(1)}" fill="${color}"/>`;
    case 'clock': return g(`<circle cx="${cx}" cy="${cy}" r="${s * 0.9}"/><path d="M${cx} ${cy} V${cy - s * 0.5} M${cx} ${cy} L${cx + s * 0.4} ${cy + s * 0.15}"/>`);
    case 'commit': return g(`<path d="M${cx} ${cy - s} V${cy - s * 0.45} M${cx} ${cy + s * 0.45} V${cy + s}"/><circle cx="${cx}" cy="${cy}" r="${s * 0.45}"/>`) + dot(0.16);
    case 'person': return `<circle cx="${cx}" cy="${(cy - s * 0.45).toFixed(1)}" r="${(s * 0.42).toFixed(1)}" fill="${color}"/><path d="M${cx - s * 0.85} ${cy + s} A${s * 0.85} ${s * 0.85} 0 0 1 ${cx + s * 0.85} ${cy + s} Z" fill="${color}"/>`;
    case 'people': return `<circle cx="${(cx - s * 0.5).toFixed(1)}" cy="${(cy - s * 0.4).toFixed(1)}" r="${(s * 0.36).toFixed(1)}" fill="${color}"/><circle cx="${(cx + s * 0.55).toFixed(1)}" cy="${(cy - s * 0.32).toFixed(1)}" r="${(s * 0.3).toFixed(1)}" fill="${color}" opacity="0.65"/><path d="M${cx - s * 1.05} ${cy + s} A${s * 0.78} ${s * 0.78} 0 0 1 ${cx + s * 0.05} ${cy + s} Z" fill="${color}"/>`;
    case 'repo': return g(`<rect x="${(cx - s * 0.7).toFixed(1)}" y="${(cy - s * 0.9).toFixed(1)}" width="${(s * 1.4).toFixed(1)}" height="${(s * 1.8).toFixed(1)}" rx="3"/><path d="M${cx - s * 0.4} ${cy - s * 0.9} V${cy + s * 0.9}"/>`);
    case 'gist': return g(`<path d="M${cx - s * 0.25} ${cy - s * 0.7} L${cx - s} ${cy} L${cx - s * 0.25} ${cy + s * 0.7}"/><path d="M${cx + s * 0.25} ${cy - s * 0.7} L${cx + s} ${cy} L${cx + s * 0.25} ${cy + s * 0.7}"/>`);
    case 'check': return g(`<circle cx="${cx}" cy="${cy}" r="${s * 0.95}"/><path d="M${cx - s * 0.45} ${cy + s * 0.05} L${cx - s * 0.12} ${cy + s * 0.4} L${cx + s * 0.5} ${cy - s * 0.4}"/>`);
    case 'cross': return g(`<circle cx="${cx}" cy="${cy}" r="${s * 0.95}"/><path d="M${cx - s * 0.4} ${cy - s * 0.4} L${cx + s * 0.4} ${cy + s * 0.4} M${cx + s * 0.4} ${cy - s * 0.4} L${cx - s * 0.4} ${cy + s * 0.4}"/>`);
    case 'spin': return `<circle cx="${cx}" cy="${cy}" r="${s * 0.95}" fill="none" stroke="${t.track}" stroke-width="${sw}"/>` + g(`<path d="M${cx} ${cy - s * 0.95} A${s * 0.95} ${s * 0.95} 0 0 1 ${cx + s * 0.95} ${cy}"/>`);
    case 'gauge': return g(`<path d="M${cx - s} ${cy + s * 0.5} A${s} ${s} 0 0 1 ${cx + s} ${cy + s * 0.5}"/><path d="M${cx} ${cy + s * 0.5} L${cx + s * 0.55} ${cy - s * 0.35}"/>`) + `<circle cx="${cx}" cy="${(cy + s * 0.5).toFixed(1)}" r="${(s * 0.15).toFixed(1)}" fill="${color}"/>`;
    default: return '';
  }
}
function dotsRow(n, i, t) { if (n <= 1) return ''; const gap = 15, x0 = 128 - (n - 1) * gap / 2; let s = ''; for (let k = 0; k < n; k++) s += `<circle cx="${(x0 + k * gap).toFixed(1)}" cy="216" r="${k === i ? 4.5 : 3}" fill="${k === i ? t.accent : t.track}"/>`; return s; }
function viewsFor(type, d, L, t) {
  switch (type) {
    case 'repo': return [{ ic: 'star', value: compact(d.stars), label: L.stars || 'stars', color: t.star }, { ic: 'fork', value: compact(d.forks), label: L.forks || 'forks', color: t.accent }, { ic: 'issue', value: compact(d.issues), label: L.issues || 'issues', color: t.up }, { ic: 'eye', value: compact(d.watchers), label: L.watchers || 'watchers', color: t.accent }];
    case 'release': return [{ ic: 'tag', value: truncate(d.tag || '—', 12), label: L.version || 'version', color: t.text }, { ic: 'download', value: compact(d.downloads), label: L.downloads || 'downloads', color: t.up, vcolor: t.up }, { ic: 'clock', value: d.published ? relTime(d.published) : '—', label: L.published || 'published', color: t.muted }];
    case 'commits': return [{ ic: 'commit', value: compact(d.weekCount), label: L.commitsWeek || 'commits / 7d', color: t.accent }, { ic: 'person', value: truncate(d.lastAuthor || '?', 13), label: L.author || 'author', color: t.accent }, { ic: 'clock', value: d.lastWhen ? relTime(d.lastWhen) : '—', label: L.pushed || 'pushed', color: t.muted }];
    case 'ci': { const c = d.conclusion, running = !c && d.status && d.status !== 'completed'; const color = c === 'success' ? t.up : (c === 'failure' || c === 'timed_out') ? t.down : running ? t.star : t.muted; const word = c === 'success' ? (L.success || 'passing') : (c === 'failure' || c === 'timed_out') ? (L.failed || 'failing') : running ? (L.running || 'running') : c ? c : (L.pending || 'pending'); const ci = c === 'success' ? 'check' : (c === 'failure' || c === 'timed_out') ? 'cross' : 'spin'; return [{ ic: ci, value: word, label: L.status || 'status', color, vcolor: color }, { ic: 'clock', value: d.when ? relTime(d.when) : '—', label: L.run || 'run', color: t.muted }]; }
    case 'issues': return [{ ic: 'issue', value: compact(d.issues), label: L.issues || 'issues', color: t.up }, { ic: 'pr', value: compact(d.prs), label: L.prs || 'PRs', color: t.accent }];
    case 'user': return [{ ic: 'person', value: compact(d.followers), label: L.followers || 'followers', color: t.accent }, { ic: 'repo', value: compact(d.public_repos), label: L.repos || 'repos', color: t.text }, { ic: 'gist', value: compact(d.public_gists), label: L.gists || 'gists', color: t.text }, { ic: 'people', value: compact(d.following), label: L.following || 'following', color: t.muted }];
    case 'rate': { const ratio = d.limit ? Math.max(0, Math.min(1, d.remaining / d.limit)) : 0; const color = ratio > 0.5 ? t.up : ratio > 0.15 ? t.star : t.down; return [{ ic: 'gauge', value: compact(d.remaining), label: L.remaining || 'remaining', color, vcolor: color }, { ic: 'clock', value: d.reset ? Math.max(0, Math.ceil((d.reset * 1000 - Date.now()) / 60000)) + 'm' : '—', label: L.resets || 'resets', color: t.muted }]; }
  }
  return [];
}
function buildTitlePI(title, t, af) {
  title = String(title || ''); const fs = 22, y = 34;
  if (!titleOverflows(title)) return `<text x="128" y="${y}" text-anchor="middle" fill="${t.accent}" font-size="${fs}" font-weight="bold" font-family="Arial">${esc(title)}</text>`;
  const period = estWidth(title, fs) + 44; const x = 14 - ((af * 1.2) % period);
  const one = (xx) => `<text x="${xx.toFixed(1)}" y="${y}" fill="${t.accent}" font-size="${fs}" font-weight="bold" font-family="Arial">${esc(title)}</text>`;
  return one(x) + one(x + period);
}

const DEMO = (() => { const iso = h => new Date(Date.now() - h * 3600000).toISOString(); return {
  repo: { stars: 186093, forks: 40323, issues: 18389, watchers: 3509 },
  release: { tag: 'v2.93.0', published: iso(120), downloads: 860293 },
  commits: { weekCount: 37, lastAuthor: 'Kynan Ware', lastWhen: iso(3) },
  ci: { conclusion: 'success', status: 'completed', name: 'CI', when: iso(0.2) },
  issues: { issues: 823, prs: 49 },
  user: { followers: 306338, public_repos: 12, public_gists: 1, following: 0 },
  rate: { remaining: 42, limit: 60, reset: Math.floor(Date.now() / 1000) + 1320 }
}; })();

// live preview removed (caused flicker + extra CPU while editing the key)
const pv = { frame: 0 };
function startPreview() {}

function renderPreview() {
  const el = document.getElementById('preview'); if (!el) return;
  const t = THEMES[document.getElementById('theme').value || 'github'] || THEMES.github;
  const af = pv.frame;
  const anim = document.getElementById('anim').checked;
  const L = KEY_LABELS;
  const title = TYPE === 'user' ? '@' + (document.getElementById('user').value || 'username').trim().replace(/^@/, '')
    : TYPE === 'rate' ? 'GitHub API'
    : (document.getElementById('repo').value || 'owner/repo').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '');
  const views = viewsFor(TYPE, DEMO[TYPE], L, t);
  const vi = Math.floor(af / 18) % views.length;          // auto-cycle every ~2.2s
  const v = views[vi];

  let body = `<line x1="30" y1="50" x2="226" y2="50" stroke="${t.track}" stroke-width="2"/>`;
  body += icon(v.ic, 128, 86, 27, v.color, t);
  const val = String(v.value);
  body += `<text x="128" y="146" text-anchor="middle" dominant-baseline="middle" fill="${v.vcolor || t.text}" font-size="${fitSize(val, 64)}" font-weight="bold" font-family="Arial">${esc(val)}</text>`;
  body += `<text x="128" y="190" text-anchor="middle" fill="${t.muted}" font-size="20" font-weight="bold" font-family="Arial">${esc((v.label || '').toUpperCase())}</text>`;
  body += dotsRow(views.length, vi, t);
  body += `<text x="128" y="242" text-anchor="middle" fill="${t.muted}" font-size="16" font-family="Arial" opacity="0.85">${esc((L.updated || 'upd') + ' 09:30')}</text>`;

  let defs = '', pre = '';
  if (anim) { const gx = (128 + Math.sin(af * 0.05) * 90).toFixed(1); defs = `<radialGradient id="sw" cx="0.5" cy="0.5" r="0.5" gradientUnits="userSpaceOnUse" gradientTransform="translate(${gx} 70)"><stop offset="0" stop-color="${t.accent}" stop-opacity="0.16"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></radialGradient>`; pre = `<circle cx="${gx}" cy="70" r="150" fill="url(#sw)"/>`; }
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">${defs ? `<defs>${defs}</defs>` : ''}<rect width="256" height="256" fill="${t.bg}"/>${pre}${body}${buildTitlePI(title, t, af)}</svg>`;
}

async function loadTranslations() {
  try {
    let data;
    try { data = await Utils.readJson(`${Utils.getPluginPath()}/${$UD.language}.json?t=${Date.now()}`); }
    catch (e) { const lang = ($UD.language || '').startsWith('pt') ? 'pt_BR' : 'en'; data = await Utils.readJson(`${Utils.getPluginPath()}/${lang}.json?t=${Date.now()}`); }
    const loc = data?.Localization || {};
    for (const k of Object.keys(KEY_LABELS)) if (loc[k]) KEY_LABELS[k] = loc[k];
  } catch (e) {}
  collectAndSend(); renderPreview();
}

function collectAndSend() {
  if (!form) return;
  const v = Utils.getFormValue(form);
  ACTION_SETTING = { ...ACTION_SETTING, ...v };
  $UD.sendParamFromPlugin({ ...ACTION_SETTING, ...KEY_LABELS });
}

function applySettings(p) {
  if (!p) return;
  ACTION_SETTING = { ...ACTION_SETTING, ...p };
  if (!form) return;
  Utils.setFormValue(ACTION_SETTING, form);
  if (p.metric) document.getElementById('metric').value = p.metric;
  document.getElementById('theme').value = ACTION_SETTING.theme || 'github';
  document.getElementById('font').value = ACTION_SETTING.font || 'sans';
  document.getElementById('screenMode').value = ACTION_SETTING.screenMode != null ? ACTION_SETTING.screenMode : 0;
  highlightTheme(document.getElementById('theme').value); highlightSeg(document.getElementById('screenMode').value);
  renderPreview();
}

$UD.onAdd((jsn) => { if (jsn.param) applySettings(jsn.param); renderPreview(); });
$UD.onParamFromApp((jsn) => { if (jsn.param) applySettings(jsn.param); });
$UD.onParamFromPlugin((jsn) => { if (jsn.param && !jsn.param.forceRefresh) applySettings(jsn.param); });
