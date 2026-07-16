import UlanzideckApi from '../libs/node/ulanzideckApi.js';
import https from 'https';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import opentype from 'opentype.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_VERSION = '1.0.1';
const DEBUG = process.env.REPOSTATS_DEBUG === '1';
function log(...a) { if (DEBUG) console.log('[RepoStats]', ...a); }

const DATA_DIR = (() => {
  const base = os.platform() === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support')
    : (process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'));
  const d = path.join(base, 'UlanziDeck', 'com.github.repostats.deck');
  try { fs.mkdirSync(d, { recursive: true }); } catch (e) {}
  return d;
})();
const SAMPLE_FILE = path.join(DATA_DIR, 'stars.json');

// ── color themes ──────────────────────────────────────────────────────────────
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

// ── vector fonts ────────────────────────────────────────────────────────────────
const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
const FONT_FILES = { sans: 'sans.ttf', mono: 'mono.ttf', serif: 'serif.ttf', display: 'display.ttf' };
const _fontCache = {};
function loadFont(key) {
  if (key in _fontCache) return _fontCache[key];
  try { _fontCache[key] = opentype.parse(fs.readFileSync(path.join(FONT_DIR, FONT_FILES[key] || FONT_FILES.sans)).buffer); }
  catch (e) { log('font fail', key, e.message); _fontCache[key] = null; }
  return _fontCache[key];
}
function textPath(font, text, size) {
  const p = new opentype.Path(); let x = 0; const sc = size / font.unitsPerEm;
  for (const ch of String(text)) { const g = font.charToGlyph(ch); p.extend(g.getPath(x, 0, size)); x += g.advanceWidth * sc; }
  return p;
}
// glyph geometry (opentype path + bbox) is expensive — memoize per font/size/text
const _glyphCache = new Map();
function glyphGeom(fontKey, text, size) {
  const k = fontKey + '|' + size + '|' + text;
  if (_glyphCache.has(k)) return _glyphCache.get(k);
  let g = null;
  const font = loadFont(fontKey);
  if (font) { const p = textPath(font, text, size); g = { d: p.toPathData(2), bb: p.getBoundingBox() }; }
  if (_glyphCache.size > 400) _glyphCache.clear();
  _glyphCache.set(k, g);
  return g;
}
// true only when the vector font can draw EVERY char. CJK/Arabic/etc. aren't in
// the bundled Latin fonts, so those must fall back to a system <text> font — else
// opentype renders .notdef "tofu" boxes (e.g. Chinese CI status words).
const _hasGlyphCache = new Map();
function fontHasAll(fontKey, str) {
  const k = fontKey + '|' + str;
  if (_hasGlyphCache.has(k)) return _hasGlyphCache.get(k);
  const font = loadFont(fontKey);
  let ok = true;
  if (font) { for (const ch of String(str)) { if (ch === ' ') continue; if (font.charToGlyphIndex(ch) === 0) { ok = false; break; } } }
  if (_hasGlyphCache.size > 400) _hasGlyphCache.clear();
  _hasGlyphCache.set(k, ok);
  return ok;
}
function glyph(fontKey, text, cx, cy, size, fill, anchor = 'middle') {
  // non-Latin (Chinese, …): render with a system font so it isn't a tofu box
  if (!fontHasAll(fontKey, text)) return `<text x="${cx}" y="${cy}" text-anchor="${anchor}" dominant-baseline="middle" fill="${fill}" font-size="${size}" font-weight="bold" font-family="Arial, Helvetica, sans-serif">${esc(text)}</text>`;
  const g = glyphGeom(fontKey, text, size);
  if (!g) return `<text x="${cx}" y="${cy}" text-anchor="${anchor}" dominant-baseline="middle" fill="${fill}" font-size="${size}" font-weight="bold" font-family="Arial, Helvetica, sans-serif">${esc(text)}</text>`;
  const bb = g.bb; const w = bb.x2 - bb.x1, h = bb.y2 - bb.y1;
  let dx = cx - bb.x1; if (anchor === 'middle') dx = cx - (bb.x1 + w / 2); else if (anchor === 'end') dx = cx - bb.x2;
  const dy = cy - (bb.y1 + h / 2);
  return `<path transform="translate(${dx.toFixed(1)} ${dy.toFixed(1)})" d="${g.d}" fill="${fill}"/>`;
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ── helpers ─────────────────────────────────────────────────────────────────────
function compact(n) {
  if (n == null || !isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return String(n);
}
function relTime(iso) {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  if (s < 2592000) return Math.floor(s / 86400) + 'd';
  if (s < 31536000) return Math.floor(s / 2592000) + 'mo';
  return Math.floor(s / 31536000) + 'y';
}
function truncate(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function starPath(cx, cy, r) {
  let d = ''; const inner = r * 0.42;
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rad = i % 2 === 0 ? r : inner; d += (i === 0 ? 'M' : 'L') + (cx + Math.cos(a) * rad).toFixed(1) + ' ' + (cy + Math.sin(a) * rad).toFixed(1); }
  return d + 'Z';
}
function buildSpark(samples, x0, y0, w, h, color, track) {
  if (!samples || samples.length < 2) return `<line x1="${x0}" y1="${(y0 + h / 2).toFixed(1)}" x2="${x0 + w}" y2="${(y0 + h / 2).toFixed(1)}" stroke="${track}" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 8" opacity="0.7"/>`;
  const lo = Math.min(...samples), hi = Math.max(...samples), rng = (hi - lo) || 1;
  const pts = samples.map((v, i) => `${(x0 + (i / (samples.length - 1)) * w).toFixed(1)},${(y0 + h - ((v - lo) / rng) * h).toFixed(1)}`);
  const last = pts[pts.length - 1].split(',');
  return `<polygon points="${x0},${(y0 + h).toFixed(1)} ${pts.join(' ')} ${x0 + w},${(y0 + h).toFixed(1)}" fill="${color}" opacity="0.12"/>` +
         `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>` +
         `<circle cx="${last[0]}" cy="${last[1]}" r="4" fill="${color}"/>`;
}
function fitSize(str, b) { return Math.round(str.length <= 5 ? b : str.length <= 7 ? b * 0.8 : str.length <= 9 ? b * 0.66 : b * 0.55); }

// ── icon library (centered drawn glyphs) ───────────────────────────────────────
function icon(name, cx, cy, s, color, t) {
  const sw = (s * 0.16).toFixed(1);
  const g = (inner) => `<g fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`;
  const dot = (r) => `<circle cx="${cx}" cy="${cy}" r="${(s * r).toFixed(1)}" fill="${color}"/>`;
  switch (name) {
    case 'star': return `<path d="${starPath(cx, cy, s)}" fill="${color}"/>`;
    case 'fork': { const a = s * 0.66, b = s * 0.72, r = (s * 0.3).toFixed(1);
      return g(`<circle cx="${cx - a}" cy="${cy - b}" r="${r}"/><circle cx="${cx + a}" cy="${cy - b}" r="${r}"/><circle cx="${cx}" cy="${cy + b}" r="${r}"/><path d="M${cx} ${cy + b - s * 0.3} V${cy - s * 0.1} M${cx - a} ${cy - b + s * 0.3} V${cy - s * 0.1} H${cx + a} V${cy - b + s * 0.3}"/>`); }
    case 'issue': return g(`<circle cx="${cx}" cy="${cy}" r="${s * 0.9}"/>`) + dot(0.3);
    case 'pr': { const a = s * 0.6, r = (s * 0.3).toFixed(1);
      return g(`<circle cx="${cx - a}" cy="${cy - s * 0.72}" r="${r}"/><circle cx="${cx - a}" cy="${cy + s * 0.72}" r="${r}"/><circle cx="${cx + a}" cy="${cy - s * 0.72}" r="${r}"/><path d="M${cx - a} ${cy - s * 0.42} V${cy + s * 0.42} M${cx + a} ${cy - s * 0.42} V${cy} a${s * 0.7} ${s * 0.7} 0 0 1 ${-s * 0.7} ${s * 0.5}"/>`); }
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

function dotsRow(n, i, t) {
  if (n <= 1) return '';
  const gap = 15, x0 = 128 - (n - 1) * gap / 2; let s = '';
  for (let k = 0; k < n; k++) s += `<circle cx="${(x0 + k * gap).toFixed(1)}" cy="216" r="${k === i ? 4.5 : 3}" fill="${k === i ? t.accent : t.track}"/>`;
  return s;
}

// rough text width (latin ~0.58em, CJK ~1em) — used to decide marquee + loop length
function estWidth(str, fs) { let w = 0; for (const c of String(str)) w += (c.charCodeAt(0) > 0x2e7f ? fs : fs * 0.58); return w; }
function titleOverflows(title) { return estWidth(String(title || ''), 22) > 232; }

// the views (sub-metrics) a key cycles through on press, one centered at a time
function viewsFor(type, d, L, t) {
  switch (type) {
    case 'repo': return [
      { ic: 'star', value: compact(d.stars), label: L.stars || 'stars', color: t.star },
      { ic: 'fork', value: compact(d.forks), label: L.forks || 'forks', color: t.accent },
      { ic: 'issue', value: compact(d.issues), label: L.issues || 'issues', color: t.up },
      { ic: 'eye', value: compact(d.watchers), label: L.watchers || 'watchers', color: t.accent }];
    case 'release': return [
      { ic: 'tag', value: truncate(d.tag || '—', 12), label: L.version || 'version', color: t.text },
      { ic: 'download', value: compact(d.downloads), label: L.downloads || 'downloads', color: t.up, vcolor: t.up },
      { ic: 'clock', value: d.published ? relTime(d.published) : '—', label: L.published || 'published', color: t.muted }];
    case 'commits': return [
      { ic: 'commit', value: compact(d.weekCount) + (d.weekCapped ? '+' : ''), label: L.commitsWeek || 'commits / 7d', color: t.accent },
      { ic: 'person', value: truncate(d.lastAuthor || '?', 13), label: L.author || 'author', color: t.accent },
      { ic: 'clock', value: d.lastWhen ? relTime(d.lastWhen) : '—', label: L.pushed || 'pushed', color: t.muted }];
    case 'ci': {
      const c = d.conclusion, running = !c && d.status && d.status !== 'completed';
      const color = c === 'success' ? t.up : (c === 'failure' || c === 'timed_out') ? t.down : running ? t.star : t.muted;
      const word = c === 'success' ? (L.success || 'passing') : (c === 'failure' || c === 'timed_out') ? (L.failed || 'failing') : running ? (L.running || 'running') : c ? c : (L.pending || 'pending');
      const ci = c === 'success' ? 'check' : (c === 'failure' || c === 'timed_out') ? 'cross' : 'spin';
      return [
        { ic: ci, value: word, label: L.status || 'status', color, vcolor: color },
        { ic: 'clock', value: d.when ? relTime(d.when) : '—', label: L.run || 'run', color: t.muted }];
    }
    case 'issues': return [
      { ic: 'issue', value: compact(d.issues), label: L.issues || 'issues', color: t.up },
      { ic: 'pr', value: compact(d.prs), label: L.prs || 'PRs', color: t.accent }];
    case 'user': return [
      { ic: 'person', value: compact(d.followers), label: L.followers || 'followers', color: t.accent },
      { ic: 'repo', value: compact(d.public_repos), label: L.repos || 'repos', color: t.text },
      { ic: 'gist', value: compact(d.public_gists), label: L.gists || 'gists', color: t.text },
      { ic: 'people', value: compact(d.following), label: L.following || 'following', color: t.muted }];
    case 'rate': {
      const ratio = d.limit ? Math.max(0, Math.min(1, d.remaining / d.limit)) : 0;
      const color = ratio > 0.5 ? t.up : ratio > 0.15 ? t.star : t.down;
      return [
        { ic: 'gauge', value: compact(d.remaining), label: L.remaining || 'remaining', color, vcolor: color },
        { ic: 'clock', value: d.reset ? Math.max(0, Math.ceil((d.reset * 1000 - Date.now()) / 60000)) + 'm' : '—', label: L.resets || 'resets', color: t.muted }];
    }
  }
  return [];
}

// Static body for ONE centered view (title is drawn separately for marquee support).
function generateBody(o) {
  const t = THEMES[o.theme] || THEMES.github;
  const L = o.labels || {};
  let body = `<line x1="30" y1="50" x2="226" y2="50" stroke="${t.track}" stroke-width="2"/>`;

  if (o.loading && !o.data) {
    body += `<text x="128" y="128" text-anchor="middle" dominant-baseline="middle" fill="${t.muted}" font-size="40" font-weight="bold" font-family="Arial, Helvetica, sans-serif">…</text>`;
    body += `<text x="128" y="184" text-anchor="middle" fill="${t.muted}" font-size="18" font-family="Arial, Helvetica, sans-serif">${esc(L.loading || 'loading…')}</text>`;
    return body;
  }
  if (!o.data && o.error) {
    const msg = o.error === 'notfound' ? (o.type === 'release' ? (L.noRelease || 'no release') : o.type === 'ci' ? (L.noRuns || 'no runs') : o.type === 'commits' ? (L.noCommits || 'no commits') : (L.notFound || 'not found'))
      : o.error === 'ratelimit' ? (L.rateLimit || 'rate limited — add a token') : (L.offline || 'offline');
    body += `<text x="128" y="138" text-anchor="middle" fill="${t.down}" font-size="18" font-family="Arial, Helvetica, sans-serif">${esc(msg)}</text>`;
    return body;
  }

  const views = viewsFor(o.type, o.data, L, t);
  if (!views.length) return body;
  const vi = (((o.viewIndex || 0) % views.length) + views.length) % views.length;
  const v = views[vi];

  body += icon(v.ic, 128, 86, 27, v.color, t);
  const val = String(v.value);
  body += glyph(o.font, val, 128, 146, fitSize(val, 64), v.vcolor || t.text);
  body += `<text x="128" y="190" text-anchor="middle" fill="${t.muted}" font-size="20" font-weight="bold" font-family="Arial, Helvetica, sans-serif">${esc((v.label || '').toUpperCase())}</text>`;
  body += dotsRow(views.length, vi, t);
  if (o.updated) body += `<text x="128" y="242" text-anchor="middle" fill="${t.muted}" font-size="16" font-family="Arial, Helvetica, sans-serif" opacity="0.85">${esc((L.updated || 'upd') + ' ' + o.updated)}</text>`;
  if (o.error) body += `<circle cx="240" cy="15" r="5" fill="${t.down}"/>`;
  return body;
}

// Title (top). Marquee-scrolls when it would overflow the key; otherwise centered.
function buildTitle(o, af) {
  const t = THEMES[o.theme] || THEMES.github;
  const title = String(o.title || '');
  const fs = 22, y = 34;
  if (!titleOverflows(title)) {
    return `<text x="128" y="${y}" text-anchor="middle" fill="${t.accent}" font-size="${fs}" font-weight="bold" font-family="Arial, Helvetica, sans-serif">${esc(title)}</text>`;
  }
  const period = estWidth(title, fs) + 44;
  const x = 14 - ((af * 1.2) % period);
  const one = (xx) => `<text x="${xx.toFixed(1)}" y="${y}" fill="${t.accent}" font-size="${fs}" font-weight="bold" font-family="Arial, Helvetica, sans-serif">${esc(title)}</text>`;
  return one(x) + one(x + period);
}

function wrap(t, defs, body) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">${defs ? `<defs>${defs}</defs>` : ''}<rect width="256" height="256" fill="${t.bg}"/>${body}</svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}
// Compose final data-URI: static body + (marquee) title.
function compose(t, body, titleSvg) {
  return wrap(t, '', body + (titleSvg || ''));
}

// ── HTTPS GET ───────────────────────────────────────────────────────────────────
function httpGet(url, token, timeoutMs = 9000) {
  return new Promise((resolve, reject) => {
    const headers = { 'User-Agent': 'UlanziRepoStats/1.0', 'Accept': 'application/vnd.github+json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = https.get(url, { headers }, (r) => { let dd = ''; r.on('data', c => dd += c); r.on('end', () => resolve({ status: r.statusCode, body: dd, headers: r.headers })); });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
  });
}

// ── shared star-sample store ──────────────────────────────────────────────────────
// One in-memory copy + one debounced writer for ALL keys (was N reads + N clobbering
// writes of the same file).
let _samples = null, _samplesSaveT = null;
function samplesStore() {
  if (!_samples) { try { _samples = JSON.parse(fs.readFileSync(SAMPLE_FILE, 'utf8')) || {}; } catch (e) { _samples = {}; } }
  return _samples;
}
function saveSamplesStore() {
  if (_samplesSaveT) clearTimeout(_samplesSaveT);
  _samplesSaveT = setTimeout(() => { try { fs.writeFileSync(SAMPLE_FILE, JSON.stringify(_samples || {})); } catch (e) {} }, 5000);
}

// ── single shared marquee ticker ────────────────────────────────────────────────
// One timer drives every key whose title overflows, regardless of key count. Empty
// set => no timer at all (zero idle CPU). Fewer fps as more keys scroll at once.
const _animSet = new Set();
let _animTimer = null;
let _addSeq = 0; // staggers each new key's first fetch
function _animInterval() { const n = _animSet.size; return n <= 2 ? 120 : n <= 4 ? 200 : 300; }
function _animRestart() {
  if (_animTimer) { clearInterval(_animTimer); _animTimer = null; }
  if (_animSet.size) _animTimer = setInterval(() => { for (const it of _animSet) { it.animFrame++; it._paint(); } }, _animInterval());
}
function animJoin(inst) { _animSet.add(inst); _animRestart(); }
function animLeave(inst) { _animSet.delete(inst); _animRestart(); }

// ── Monitor (one per key; type set from the action uuid) ──────────────────────────
class Monitor {
  constructor(context, $UD, type) {
    this.$UD = $UD; this.context = context; this.type = type;
    this.config = { repo: 'microsoft/vscode', user: 'torvalds', token: '', metric: 'stars', intervalMin: 30, theme: 'github', font: 'sans', screenMode: 0, labels: {} };
    this.data = null; this.error = null; this.loading = false; this.updated = '';
    this.prevStars = null; this.deltaStars = null; this.samples = [];
    this.viewIndex = 0; this._marquee = false;
    this.animFrame = 0; this.refreshTimer = null;
    this._all = samplesStore(); // shared store (one copy for all keys)
    // paint the loading state once, then clear the flag so refresh() isn't blocked
    // by its own `if (this.loading) return` guard.
    this.loading = true; this.render(); this.loading = false;
    // stagger the first fetch so adding several keys at once doesn't burst
    const slot = Math.min(_addSeq++, 12);
    this.refreshTimer = setTimeout(() => this.refresh(), slot * 180);
  }
  // press cycles to the next sub-metric (centered view); no fetch
  cycle() { this.viewIndex++; this.render(); }
  _target() { return this.type === 'user' ? this.config.user : this.config.repo; }
  _title() { return this.type === 'user' ? (this.config.user || 'user') : this.type === 'rate' ? 'GitHub API' : (this.config.repo || 'owner/repo'); }

  setConfig(p) {
    if (!p) return;
    if (p.forceRefresh) { this.refresh(); return; }
    const before = this._target();
    if (p.repo !== undefined) this.config.repo = this._norm(p.repo);
    if (p.user !== undefined) this.config.user = String(p.user || '').trim().replace(/^@/, '');
    if (p.token !== undefined) this.config.token = String(p.token || '').trim();
    if (p.metric && REPO_METRICS.includes(p.metric)) this.config.metric = p.metric;
    if (p.intervalMin !== undefined) { const m = parseInt(p.intervalMin, 10); if (isFinite(m) && m >= 1) this.config.intervalMin = m; }
    if (p.theme) this.config.theme = p.theme;
    if (p.font) this.config.font = p.font;
    if (p.screenMode !== undefined) this.config.screenMode = parseInt(p.screenMode, 10) || 0;
    for (const k in p) if (typeof p[k] === 'string' && !['repo', 'user', 'token', 'metric', 'theme', 'font'].includes(k)) this.config.labels[k] = p[k];
    this._ensureTimer();
    if (before !== this._target()) {
      this.data = null; this.error = null; this.prevStars = null; this.deltaStars = null;
      this.samples = (this._all[(this.config.repo || '').toLowerCase()] || []).slice(-40);
      this.refresh();
    } else if (this.data == null && !this.loading) {
      this.refresh(); // first load (e.g. onAdd with same target) — fetch now
    } else {
      this._schedule(); this.render();
    }
  }
  _norm(v) { let s = String(v || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/^\/+|\/+$/g, ''); const p = s.split('/').filter(Boolean); return p.length >= 2 ? p[0] + '/' + p[1] : s; }

  async _get(urlPath) { return httpGet('https://api.github.com' + urlPath, this.config.token); }

  async refresh() {
    if (this.loading) return;
    const repo = this.config.repo; const user = this.config.user;
    if (this.type !== 'rate' && this.type !== 'user' && (!repo || !repo.includes('/'))) { this.error = 'notfound'; this.render(); return; }
    if (this.type === 'user' && !user) { this.error = 'notfound'; this.render(); return; }
    this.loading = true; if (!this.data) this.render();
    try {
      let r, j, data = null;
      const chk = (resp) => { if (resp.status === 404) throw 'notfound'; if (resp.status === 403 && resp.headers['x-ratelimit-remaining'] === '0') throw 'ratelimit'; if (resp.status < 200 || resp.status >= 300) throw 'offline'; return JSON.parse(resp.body); };
      switch (this.type) {
        case 'repo': {
          j = chk(await this._get('/repos/' + repo));
          data = { stars: j.stargazers_count, forks: j.forks_count, issues: j.open_issues_count, watchers: j.subscribers_count, pushedAt: j.pushed_at };
          this._recordStars(data.stars); break;
        }
        case 'release': {
          j = chk(await this._get('/repos/' + repo + '/releases/latest'));
          data = { tag: j.tag_name, name: j.name, published: j.published_at, downloads: (j.assets || []).reduce((a, x) => a + (x.download_count || 0), 0) }; break;
        }
        case 'commits': {
          const since = new Date(Date.now() - 7 * 86400000).toISOString();
          j = chk(await this._get('/repos/' + repo + '/commits?per_page=100&since=' + since));
          const last = j[0];
          data = { weekCount: j.length, weekCapped: j.length >= 100, lastAuthor: last && (last.commit.author.name), lastWhen: last && last.commit.author.date, lastMsg: last && (last.commit.message || '').split('\n')[0] };
          break;
        }
        case 'ci': {
          // exclude_pull_requests halves GitHub's server time + payload (~26KB→13KB)
          j = chk(await this._get('/repos/' + repo + '/actions/runs?per_page=1&exclude_pull_requests=true'));
          const run = j.workflow_runs && j.workflow_runs[0];
          if (!run) throw 'notfound';
          data = { conclusion: run.conclusion, status: run.status, name: run.name || run.display_title, when: run.created_at }; break;
        }
        case 'issues': {
          const a = chk(await this._get('/search/issues?per_page=1&q=' + encodeURIComponent('repo:' + repo + ' is:issue is:open')));
          const b = chk(await this._get('/search/issues?per_page=1&q=' + encodeURIComponent('repo:' + repo + ' is:pr is:open')));
          data = { issues: a.total_count, prs: b.total_count }; break;
        }
        case 'user': {
          j = chk(await this._get('/users/' + encodeURIComponent(user)));
          data = { login: j.login, followers: j.followers, public_repos: j.public_repos, public_gists: j.public_gists, following: j.following }; break;
        }
        case 'rate': {
          const resp = await this._get('/rate_limit'); j = chk(resp);
          const core = j.resources && j.resources.core || {};
          data = { remaining: core.remaining, limit: core.limit, reset: core.reset }; break;
        }
      }
      this.data = data; this.error = null;
      const dt = new Date(); this.updated = String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
    } catch (e) { this.error = (typeof e === 'string') ? e : 'offline'; log('fail', this.type, e && e.message || e); }
    finally { this.loading = false; this._schedule(); this.render(); }
  }

  _recordStars(stars) {
    this.prevStars = this.data ? this.data.stars : this.prevStars;
    if (this.prevStars != null) this.deltaStars = stars - this.prevStars;
    const key = (this.config.repo || '').toLowerCase();
    const arr = this._all[key] || [];
    if (arr[arr.length - 1] !== stars) { arr.push(stars); while (arr.length > 60) arr.shift(); }
    this._all[key] = arr; this.samples = arr.slice(-40); saveSamplesStore();
  }

  _schedule() { if (this.refreshTimer) clearTimeout(this.refreshTimer); this.refreshTimer = setTimeout(() => this.refresh(), Math.max(1, this.config.intervalMin) * 60000); }
  // Join/leave the single shared ticker — only a marquee title (overflow) needs
  // motion. A static short-title key runs no loop at all.
  _ensureTimer() { if (this._marquee) animJoin(this); else animLeave(this); }

  // Rebuild the static body (heavy: glyph/layout) — only on data/config/state change.
  render() {
    try {
      this._th = THEMES[this.config.theme] || THEMES.github;
      this._marquee = titleOverflows(this._title());
      this._body = generateBody({
        type: this.type, title: this._title(), data: this.data, viewIndex: this.viewIndex,
        theme: this.config.theme, font: this.config.font,
        updated: this.updated, loading: this.loading, error: this.error, labels: this.config.labels
      });
      this._ensureTimer();
      this._paint();
    } catch (e) { log('render err', e.message); }
  }
  // Cheap recompose for the tick — reuses the cached body, rebuilds only the (marquee)
  // title. Dedup: never push an identical image to the deck (firmware rasterization is
  // the real bottleneck). Static short-title key pushes only when data changes.
  _paint() {
    if (!this._th) return;
    const titleSvg = buildTitle({ title: this._title(), theme: this.config.theme }, this.animFrame);
    const uri = compose(this._th, this._body || '', titleSvg);
    if (uri === this._lastUri) return;
    this._lastUri = uri;
    try { this.$UD.setBaseDataIcon(this.context, uri); } catch (e) {}
  }
  destroy() { animLeave(this); if (this.refreshTimer) clearTimeout(this.refreshTimer); }
}

function typeOf(uuid) { const s = String(uuid || '').split('.').pop(); return ['repo', 'release', 'commits', 'ci', 'issues', 'user', 'rate'].includes(s) ? s : 'repo'; }

// ── Bootstrap ───────────────────────────────────────────────────────────────────
const $UD = new UlanzideckApi();
const CACHE = {};
$UD.connect('com.github.repostats.deck');
$UD.onConnected(() => log('connected v' + PLUGIN_VERSION));
$UD.onError((e) => log('err', typeof e === 'string' ? e : ''));
function ensure(jsn) { const ctx = jsn.context; if (!CACHE[ctx]) CACHE[ctx] = new Monitor(ctx, $UD, typeOf(jsn.uuid || $UD.decodeContext(ctx).uuid)); return CACHE[ctx]; }
$UD.onAdd((jsn) => { const m = ensure(jsn); if (jsn.param) m.setConfig(jsn.param); });
$UD.onParamFromApp((jsn) => { const m = CACHE[jsn.context]; if (m && jsn.param) m.setConfig(jsn.param); });
$UD.onParamFromPlugin((jsn) => { const m = CACHE[jsn.context]; if (m && jsn.param) m.setConfig(jsn.param); });
$UD.onRun((jsn) => { ensure(jsn).cycle(); });
$UD.onSetActive((jsn) => { const m = CACHE[jsn.context]; if (m) m.render(); });
$UD.onClear((jsn) => { if (!jsn.param) return; for (const it of jsn.param) { const m = CACHE[it.context]; if (m) { m.destroy(); delete CACHE[it.context]; } } });
