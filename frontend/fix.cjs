const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            if (!file.includes('node_modules')) results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.svelte') || file.endsWith('.js')) results.push(file);
        }
    });
    return results;
}

const files = walk('src');
for (const file of files) {
    const buf = fs.readFileSync(file);
    let isUtf8 = true;
    try {
        new TextDecoder('utf8', { fatal: true }).decode(buf);
    } catch (e) {
        isUtf8 = false;
    }
    
    let text = '';
    if (!isUtf8) {
        text = new TextDecoder('windows-1252').decode(buf);
    } else {
        text = buf.toString('utf8');
    }
    
    const newText = text
        .split("'$lib/stores/auth.js'").join("'$lib/stores/auth.svelte.js'")
        .split("'$lib/stores/notifications.js'").join("'$lib/stores/notifications.svelte.js'");
        
    fs.writeFileSync(file, newText, 'utf8');
    console.log('Fixed', file);
}
