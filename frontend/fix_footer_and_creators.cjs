const fs = require('fs');

const file = 'src/routes/+page.svelte';
let content = fs.readFileSync(file, 'utf-8');

// 1. Get the head (script, svelte:head) up to <!-- Hero Mockup Start -->
let heroIdx = content.indexOf('<!-- Hero Mockup Start -->');
if (heroIdx === -1) {
	console.error('No Hero Mockup Start found in +page.svelte!');
	// If not found, look for '<div class="aero-wrapper'
	heroIdx = content.indexOf('<div class="aero-wrapper');
}

const headContent = content.substring(0, heroIdx);

// 2. Get the style block
const styleIdx = content.indexOf('<style>');
if (styleIdx === -1) {
	console.error('No <style> tag found in +page.svelte!');
	process.exit(1);
}
const styleContent = content.substring(styleIdx);

// 3. Read the new_content.html
let newHtml = fs.readFileSync('new_content.html', 'utf-8');

// 4. Fix newHtml - creators-spotlight
newHtml = newHtml.replace(
	/<div class="creator-card glass-panel hover-lift"/g,
	'<div class="creator-card"'
);
newHtml = newHtml.replace(
	/<div class="btn-liquidglass-wrap primary-wrap w-full mt-4" style="flex: 0 0 44px; min-height: 44px;">/g,
	'<div class="btn-liquidglass-wrap primary-wrap" style="width: 100%; margin-top: 1.25rem; flex: 0 0 44px; min-height: 44px;">'
);
newHtml = newHtml.replace(
	/<button class="btn-liquidglass-primary w-full h-full">/g,
	'<button class="btn-liquidglass-primary" style="width: 100%; height: 100%;">'
);

// 5. Fix newHtml - aero-footer
// In new_content.html, aero-footer is just <footer class="aero-footer">
// But maybe the footer was missing glass styling because the user said it was broken. Let's add the glass styles directly just in case the CSS parser strips it, though it shouldn't.
// Actually, the original CSS had `.aero-footer { ... }` so it's fine.
// I will just make sure to add the refraction inside it.
newHtml = newHtml.replace(
	'<footer class="aero-footer">',
	'<footer class="aero-footer">\n    <div class="footer-refraction" style="position:absolute; inset:0; background: radial-gradient(circle at top, var(--accent-glow), transparent 70%); z-index:1; opacity:0.5; pointer-events: none;"></div>'
);

// 6. Fix SVG filter
const svgFilter = `
<svg style="position: absolute; width: 0; height: 0; pointer-events: none;" aria-hidden="true">
  <filter id="lg-dist" x="-20%" y="-20%" width="140%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="0.008 0.008" numOctaves="2" seed="92" result="noise" />
    <feGaussianBlur in="noise" stdDeviation="2" result="blurred" />
    <feDisplacementMap in="SourceGraphic" in2="blurred" scale="16" xChannelSelector="R" yChannelSelector="G" />
  </filter>
</svg>
`;

const finalContent = headContent + newHtml + '\n\n' + svgFilter + '\n\n' + styleContent;

fs.writeFileSync(file, finalContent, 'utf-8');
console.log('Successfully reconstructed +page.svelte with fixes!');
