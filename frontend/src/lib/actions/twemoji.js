/**
 * Reemplaza en el nodo los emojis unicode que tienen emote propio del set
 * Voom! (msnEmoticons.js → /emoticons/*.webp) por <img> en línea; el resto
 * del texto sigue con la fuente del sistema. Los emojis se insertan con
 * alt=unicode real para conservar el texto al copiar/pegar.
 * Uso: <div use:twemojiAction>{texto}</div>
 */
import { emoteFor } from '$lib/data/msnEmoticons.js';

// Un solo grapheme emoji: pictográfico + VS16 + secuencias ZWJ + skin tones.
const EMOJI_SEQ =
	/(\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])(\uFE0F)?(\u200D(?:\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])(\uFE0F)?)*/gu;

export function twemojiAction(node) {
	const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
	const targets = [];
	while (walker.nextNode()) {
		const t = walker.currentNode;
		if (t.textContent && /[\p{Extended_Pictographic}]/u.test(t.textContent)) {
			targets.push(t);
		}
	}
	for (const textNode of targets) {
		const parts = partsFor(textNode.textContent);
		if (!parts) continue;
		const frag = document.createDocumentFragment();
		for (const p of parts) {
			if (p.type === 'text') {
				frag.append(document.createTextNode(p.content));
			} else {
				const img = document.createElement('img');
				img.className = 'msn-emoji-render';
				img.src = p.url;
				img.alt = p.emoji;
				img.title = p.name;
				img.loading = 'lazy';
				img.decoding = 'async';
				frag.append(img);
			}
		}
		textNode.replaceWith(frag);
	}
	return {
		destroy() {}
	};
}

function partsFor(text) {
	const parts = [];
	let last = 0;
	let m;
	EMOJI_SEQ.lastIndex = 0;
	while ((m = EMOJI_SEQ.exec(text)) !== null) {
		const meta = emoteFor(m[0]);
		if (!meta) continue;
		if (m.index > last) {
			parts.push({ type: 'text', content: text.slice(last, m.index) });
		}
		parts.push({ type: 'emote', ...meta });
		last = m.index + m[0].length;
	}
	if (parts.length === 0) return null;
	if (last < text.length) parts.push({ type: 'text', content: text.slice(last) });
	return parts;
}
