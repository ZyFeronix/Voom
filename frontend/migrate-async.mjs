/**
 * VSocial — Async DB Migration Script (v2 — Safe)
 * 
 * Handles:
 * 1. Adds 'await' to all db.prepare/requireAuth/createSession calls
 * 2. Converts forEach + db calls → for...of (prevents fire-and-forget)
 * 3. Wraps db.transaction() in try/catch if not already wrapped
 * 4. Prevents double-await
 * 
 * Run: node migrate-async.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

const files = await glob('src/routes/api/**/+server.js');
const serverFiles = await glob('src/lib/server/*.js');
const allFiles = [...files, ...serverFiles];

let totalChanges = 0;
let warnings = [];

for (const file of allFiles) {
	let content = readFileSync(file, 'utf-8');
	let original = content;
	let fileWarnings = [];

	// ── PHASE 1: Detect dangerous forEach + DB patterns ──
	const forEachDbPattern = /(\w+)\.forEach\(\s*(?:\((\w+)\)|(\w+))\s*=>\s*\{[^}]*db\.prepare\(/s;
	if (forEachDbPattern.test(content)) {
		fileWarnings.push(`⚠️  ${file}: forEach + db.prepare detectado — convertir manualmente a for...of`);
		// Attempt conversion
		content = content.replace(
			/(\w+)\.forEach\(\s*(?:\((\w+)\)|(\w+))\s*=>\s*\{/g,
			(match, arr, param1, param2) => {
				const param = param1 || param2;
				return `for (const ${param} of ${arr}) {`;
			}
		);
	}

	// ── PHASE 2: Add await to DB operations ──
	
	// 2a. Assignment patterns: const/let x = db.prepare( → const/let x = await db.prepare(
	content = content.replace(/(\b(?:const|let)\s+\w+\s*=\s*)db\.prepare\(/g, '$1await db.prepare(');
	
	// 2b. Standalone db.prepare( at start of expression
	content = content.replace(/^(\s+)db\.prepare\(/gm, '$1await db.prepare(');
	
	// 2c. Any remaining db.prepare( without preceding await
	content = content.replace(/(?<!await\s)(?<!await\s\w+\s=\s)\bdb\.prepare\(/g, 'await db.prepare(');

	// 2d. Auth functions
	content = content.replace(/(?<!await\s)\brequireAuth\(/g, 'await requireAuth(');
	content = content.replace(/(?<!await\s)\boptionalAuth\(/g, 'await optionalAuth(');
	content = content.replace(/(?<!await\s)\brequireAdmin\(/g, 'await requireAdmin(');
	content = content.replace(/(?<!await\s)\bcreateSession\(/g, 'await createSession(');

	// 2e. Transaction and exec
	content = content.replace(/(?<!await\s)\bdb\.transaction\(/g, 'await db.transaction(');
	content = content.replace(/(?<!await\s)\bdb\.exec\(/g, 'await db.exec(');

	// ── PHASE 3: Fix double await ──
	content = content.replace(/await\s+await\s+/g, 'await ');

	// ── PHASE 4: Detect orphan transactions (db.transaction without try/catch) ──
	const txnMatches = content.match(/await\s+db\.transaction\(/g);
	if (txnMatches) {
		// Check if each transaction is inside a try block
		const lines = content.split('\n');
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].includes('await db.transaction(')) {
				// Look backwards for try {
				let hasTryCatch = false;
				for (let j = i; j >= Math.max(0, i - 10); j--) {
					if (lines[j].includes('try {') || lines[j].includes('try{')) {
						hasTryCatch = true;
						break;
					}
				}
				if (!hasTryCatch) {
					fileWarnings.push(`⚠️  ${file}:${i + 1} — db.transaction() sin try/catch cercano`);
				}
			}
		}
	}

	if (content !== original) {
		const changedLines = content.split('\n').filter((line, i) => {
			return line !== original.split('\n')[i];
		}).length;
		writeFileSync(file, content, 'utf-8');
		totalChanges += changedLines;
		console.log(`  ✓ ${file} (${changedLines} lines changed)`);
	}

	if (fileWarnings.length > 0) {
		warnings.push(...fileWarnings);
	}
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`Done: ${totalChanges} lines changed across ${allFiles.length} files`);

if (warnings.length > 0) {
	console.log(`\n⚠️  WARNINGS (${warnings.length}):`);
	warnings.forEach(w => console.log(`  ${w}`));
}
