#!/usr/bin/env node
/**
 * export-icons.js
 *
 * Exports all 162 CapTech brand icons from the Proto-Lab Design System Figma file
 * as SVG files and writes them into the icons/ directory, organised by category
 * and color mode.
 *
 * Usage:
 *   FIGMA_TOKEN=<your-personal-access-token> node scripts/export-icons.js
 *
 * Optional env vars:
 *   FIGMA_TOKEN   — Figma personal access token (required)
 *   COLOR_MODE    — one of: duotone | monotone | greyscale | inverse | all (default: all)
 *   CONCURRENCY   — max parallel Figma API requests (default: 5)
 *
 * How to get a Figma personal access token:
 *   Figma → Account Settings → Personal access tokens → Generate new token
 */

const fs   = require('fs');
const path = require('path');
const https = require('https');

// ─── Configuration ─────────────────────────────────────────────────────────────

const FIGMA_FILE_KEY = 'ADyu4GaQPThxZXCkuABH98';
const FIGMA_TOKEN    = process.env.FIGMA_TOKEN;
const COLOR_MODE_ARG = (process.env.COLOR_MODE || 'all').toLowerCase();
const CONCURRENCY    = parseInt(process.env.CONCURRENCY || '5', 10);

const ICONS_DIR        = path.resolve(__dirname, '..', 'icons');
const ICONOGRAPHY_JSON = path.resolve(__dirname, '..', 'tokens', 'iconography.json');

// Color-mode recolor maps (primary → secondary fill values applied via SVG rewrite)
const COLOR_MODES = {
  duotone:   { primary: '#005eb8', secondary: '#fdda24' },
  monotone:  { primary: '#005eb8', secondary: 'rgba(0,94,184,0.3)' },
  greyscale: { primary: '#333f48', secondary: 'rgba(51,63,72,0.3)' },
  inverse:   { primary: '#ffffff', secondary: 'rgba(255,255,255,0.5)' },
};

const ACTIVE_MODES = COLOR_MODE_ARG === 'all'
  ? Object.keys(COLOR_MODES)
  : [COLOR_MODE_ARG];

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Slugify an icon name to a safe filename, e.g. "AI Sparkle" → "ai-sparkle" */
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Simple HTTPS GET returning the full body as a string. */
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirects (Figma image URLs redirect to S3)
        httpsGet(res.headers.location, {}).then(resolve).catch(reject);
        return;
      }
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
        } else {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
  });
}

/** Call the Figma images API and return { nodeId: svgUrl } map. */
async function fetchImageUrls(nodeIds) {
  const ids = nodeIds.join(',');
  const url = `https://api.figma.com/v1/images/${FIGMA_FILE_KEY}?ids=${encodeURIComponent(ids)}&format=svg&svg_include_id=true`;
  const body = await httpsGet(url, { 'X-Figma-Token': FIGMA_TOKEN });
  const json = JSON.parse(body);
  if (json.err) throw new Error(`Figma API error: ${json.err}`);
  return json.images; // { "nodeId": "https://..." }
}

/** Download SVG content from a URL. */
async function downloadSvg(url) {
  return httpsGet(url);
}

/**
 * Recolor an SVG string so that the Figma-exported colors are replaced with
 * the target color-mode palette.  The exported SVGs use the duotone palette
 * by default; this function swaps primary / secondary colors to produce the
 * other three modes.
 *
 * Strategy: replace hex / rgba color literals in fill/stroke attributes.
 */
function recolorSvg(svgText, mode) {
  const src = COLOR_MODES.duotone;   // source palette (as exported from Figma)
  const dst = COLOR_MODES[mode];

  if (mode === 'duotone') return svgText; // nothing to do

  let out = svgText;

  // Primary: #005eb8  (case-insensitive)
  out = out.replace(/#005eb8/gi, dst.primary);

  // Secondary yellow: #fdda24
  // Map to the mode's secondary value
  out = out.replace(/#fdda24/gi, dst.secondary);

  return out;
}

/** Run an array of async tasks with a concurrency limit. */
async function runWithConcurrency(tasks, limit) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!FIGMA_TOKEN) {
    console.error('Error: FIGMA_TOKEN environment variable is required.');
    console.error('  export FIGMA_TOKEN=<your-personal-access-token>');
    process.exit(1);
  }

  const iconography = JSON.parse(fs.readFileSync(ICONOGRAPHY_JSON, 'utf8'));

  // Build a flat list of { category, name, nodeId } entries
  const allIcons = [];
  for (const [category, data] of Object.entries(iconography.categories)) {
    for (const [name, nodeId] of Object.entries(data.icons)) {
      allIcons.push({ category, name, nodeId });
    }
  }

  console.log(`Found ${allIcons.length} icons across ${Object.keys(iconography.categories).length} categories.`);
  console.log(`Color modes to export: ${ACTIVE_MODES.join(', ')}`);

  // Fetch SVG URLs from Figma in batches of 100 (API limit)
  const BATCH_SIZE = 100;
  const urlMap = {}; // nodeId → svgUrl

  for (let i = 0; i < allIcons.length; i += BATCH_SIZE) {
    const batch = allIcons.slice(i, i + BATCH_SIZE);
    const nodeIds = batch.map((ic) => ic.nodeId);
    console.log(`\nFetching image URLs for icons ${i + 1}–${Math.min(i + BATCH_SIZE, allIcons.length)}…`);
    const urls = await fetchImageUrls(nodeIds);
    Object.assign(urlMap, urls);
  }

  // Download SVGs and write files
  const tasks = allIcons.map((icon) => async () => {
    const svgUrl = urlMap[icon.nodeId];
    if (!svgUrl) {
      console.warn(`  [WARN] No URL returned for "${icon.name}" (${icon.nodeId})`);
      return;
    }

    let svgSource;
    try {
      svgSource = await downloadSvg(svgUrl);
    } catch (err) {
      console.warn(`  [WARN] Failed to download "${icon.name}": ${err.message}`);
      return;
    }

    const filename = `${slugify(icon.name)}.svg`;

    for (const mode of ACTIVE_MODES) {
      const outDir  = path.join(ICONS_DIR, icon.category, mode);
      fs.mkdirSync(outDir, { recursive: true });

      const outPath = path.join(outDir, filename);
      const svgOut  = recolorSvg(svgSource, mode);
      fs.writeFileSync(outPath, svgOut, 'utf8');
    }

    process.stdout.write('.');
  });

  console.log(`\nDownloading and writing SVGs (concurrency=${CONCURRENCY})…`);
  await runWithConcurrency(tasks, CONCURRENCY);

  console.log('\n\nDone! SVGs written to:', ICONS_DIR);

  // Print a summary
  const categories = Object.keys(iconography.categories);
  for (const cat of categories) {
    const count = Object.keys(iconography.categories[cat].icons).length;
    console.log(`  ${cat}: ${count} icons`);
  }
}

main().catch((err) => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
