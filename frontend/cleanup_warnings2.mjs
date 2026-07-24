import fs from 'fs';
import path from 'path';

const designPage = path.join('D:/Vsocial/frontend/src/routes/settings/design', '+page.svelte');
let content = fs.readFileSync(designPage, 'utf-8');

// Replace `<label class="flex justify-between text-muted text-xs italic">`
// with `<span class="flex justify-between text-muted text-xs italic">`
content = content.replace(
	/<label class="flex justify-between text-muted text-xs italic">/g,
	'<span class="flex justify-between text-muted text-xs italic">'
);
content = content.replace(
	/<\/label>\s*<\/div>\s*<\/div>\s*<\/div>\s*<!-- Background Upload/g,
	'</span>\n            </div>\n          </div>\n        </div>\n\n        <!-- Background Upload'
);

// Remove unused CSS selector .block-controls
content = content.replace(/\.block-controls\s*\{[^}]*\}/g, '');

fs.writeFileSync(designPage, content, 'utf-8');
console.log('Cleaned up warnings in settings/design/+page.svelte');
