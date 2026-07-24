import fs from 'fs';
const file = 'd:/Vsocial/frontend/src/routes/+page.svelte';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
	/^\s*<div class="glass-clip-container"><div class="glass-filter glass-filter-(primary|secondary)"><\/div><\/div>\r?\n/gm,
	''
);
fs.writeFileSync(file, content);
