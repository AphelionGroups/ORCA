// Measured semantic palette including the maximum mint wash composite.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const css = fs.readFileSync('web/src/styles/theme.css', 'utf8');
const rgb = hex => hex.replace('#', '').match(/../g).map(value => parseInt(value, 16));
const luminance = color => color.map(value => { const n = value / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
const ratio = (a, b) => { const values = [luminance(a), luminance(b)].sort((a, b) => b - a); return (values[0] + .05) / (values[1] + .05); };
const results = [];
for (const [i, block] of [...css.matchAll(/\{([^{}]+)\}/g)].slice(0, 2).entries()) {
  const theme = i ? 'dark' : 'light'; const tokens = {};
  for (const match of block[1].matchAll(/--([\w-]+):\s*(#[\da-fA-F]{6})\s*;/g)) tokens[match[1]] = rgb(match[2]);
  const check = (name, foreground, background, minimum) => {
    const contrast = ratio(foreground, background); results.push({ theme, name, ratio: +contrast.toFixed(2), minimum });
    assert.ok(contrast >= minimum, `${theme} ${name}: ${contrast.toFixed(2)} < ${minimum}`);
  };
  for (const surface of ['background', 'surface-panel', 'surface-muted']) {
    for (const text of ['text-primary', 'text-secondary', 'status-error', 'status-warning', 'status-success']) check(`${text} / ${surface}`, tokens[text], tokens[surface], 4.5);
    check(`focus / ${surface}`, tokens['focus-ring'], tokens[surface], 3);
    check(`control border / ${surface}`, tokens['border-control'], tokens[surface], 3);
  }
  const composite = (base, opacity) => base.map((value, i) => value * (1 - opacity) + tokens.accent[i] * opacity);
  check('primary base', tokens['action-primary-text'], tokens['action-primary'], 4.5);
  check('primary hover + wash', tokens['action-primary-text'], composite(tokens['action-primary-hover'], i ? .12 : .10), 4.5);
  check('secondary hover + wash', tokens['text-primary'], composite(tokens['surface-muted'], i ? .28 : .36), 4.5);
  check('secondary hover border + wash', tokens['text-secondary'], composite(tokens['surface-muted'], i ? .28 : .36), 3);
}
fs.mkdirSync('docs/screenshots/redesign-2026-10-10', { recursive: true });
fs.writeFileSync('docs/screenshots/redesign-2026-10-10/contrast.json', JSON.stringify(results, null, 2));
console.log(`PASS ${results.length} semantic contrast pairs, including composited hover states`);
