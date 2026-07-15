import fs from 'fs';
import path from 'path';

const pageSvelte = path.join('D:/Vsocial/frontend/src/routes', '+page.svelte');
let content = fs.readFileSync(pageSvelte, 'utf-8');

// Replace `onmousemove` with `role="presentation" onmousemove`
// Actually, it's safer to just do a global replace on the exact strings.
content = content.replace(/<div class="quick-stats glass-panel" onmousemove/g, '<div class="quick-stats glass-panel" role="presentation" onmousemove');
content = content.replace(/<div class="mock-post glass-card" onmousemove/g, '<div class="mock-post glass-card" role="presentation" onmousemove');
content = content.replace(/<div class="analytic-card glass-card" onmousemove/g, '<div class="analytic-card glass-card" role="presentation" onmousemove');
content = content.replace(/<div class="analytics-chart-container glass-card" onmousemove/g, '<div class="analytics-chart-container glass-card" role="presentation" onmousemove');
content = content.replace(/<div class="features-grid"/g, '<div class="features-grid" role="presentation"');
content = content.replace(/<div class="features-card glass-card hover-lift" onmousemove/g, '<div class="features-card glass-card hover-lift" role="presentation" onmousemove');
content = content.replace(/<div class="theme-customizer glass-panel" onmousemove/g, '<div class="theme-customizer glass-panel" role="presentation" onmousemove');
content = content.replace(/<div class="live-sandbox glass-panel" onmousemove/g, '<div class="live-sandbox glass-panel" role="presentation" onmousemove');
content = content.replace(/<div class="sandbox-post-item glass-card" onmousemove/g, '<div class="sandbox-post-item glass-card" role="presentation" onmousemove');
content = content.replace(/<div class="creator-card glass-panel" onmousemove/g, '<div class="creator-card glass-panel" role="presentation" onmousemove');
content = content.replace(/<div class="performance-visual glass-panel" onmousemove/g, '<div class="performance-visual glass-panel" role="presentation" onmousemove');

// Remove unused CSS selectors
const cssToRemove = [
  '[data-theme="dark"] .aero-header',
  '[data-theme="dark"] .aero-window',
  '[data-theme="dark"] .window-sidebar',
  '[data-theme="dark"] .window-body',
  '[data-theme="dark"] .mock-post',
  '[data-theme="dark"] .post-visual-chart',
  '[data-theme="dark"] .analytic-card',
  '[data-theme="dark"] .analytics-chart-container',
  '[data-theme="dark"] .feature-tag'
];

for (const css of cssToRemove) {
  // Regex to remove block: `[data-theme="dark"] .className { ... }`
  const escaped = css.replace(/\[/g, '\\[').replace(/\]/g, '\\]').replace(/\./g, '\\.');
  const regex = new RegExp(`${escaped}\\s*\\{[^}]*\\}`, 'g');
  content = content.replace(regex, '');
}

fs.writeFileSync(pageSvelte, content, 'utf-8');

const customSelect = path.join('D:/Vsocial/frontend/src/lib/components', 'CustomSelect.svelte');
let selectContent = fs.readFileSync(customSelect, 'utf-8');
selectContent = selectContent.replace(/<div class="custom-select-wrapper" onclick/g, '<div class="custom-select-wrapper" role="presentation" onclick');
fs.writeFileSync(customSelect, selectContent, 'utf-8');

console.log('Cleaned up warnings in +page.svelte and CustomSelect.svelte');
