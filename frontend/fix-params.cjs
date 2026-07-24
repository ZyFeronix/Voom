const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/routes/api/**/+server.js', {
	cwd: 'd:/Vsocial/frontend',
	absolute: true
});
let updated = 0;
for (const file of files) {
	let content = fs.readFileSync(file, 'utf8');
	let original = content;
	content = content.replace(
		/const parts = params\.path \|\| \[\];/g,
		"const parts = params.path ? params.path.split('/') : [];"
	);
	content = content.replace(
		/\(params\.path \|\| \[\]\)\[0\]/g,
		"(params.path ? params.path.split('/') : [])[0]"
	);
	if (content !== original) {
		fs.writeFileSync(file, content);
		console.log('Updated', file);
		updated++;
	}
}
console.log('Total updated:', updated);
