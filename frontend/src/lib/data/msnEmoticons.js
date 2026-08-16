/**
 * Registro único de emoticones MSN de VSocial.
 *
 * Fuente de verdad para: el mapa código→imagen usado por la acción
 * `twemojiAction` (render en burbujas), y la lista ordenada usada por el
 * selector de emoticones del chat (MsnEmoticonPicker).
 *
 * Las imágenes viven en /static/emoticons/ (servidas en /emoticons/*),
 * generadas por build_emoticons.py. Códigos según el set clásico de
 * Windows Live Messenger.
 */

// cat: agrupación para el selector (caras | gestos | amor | objetos | animales | comida | mundo)
export const EMOTICON_LIST = [
	// --- Caras ---
	{ name: 'smile', code: ':)', label: 'Sonrisa', file: 'smile.png', cat: 'caras' },
	{
		name: 'open-mouthed-smile',
		code: ':D',
		label: 'Risa',
		file: 'open-mouthed-smile.png',
		cat: 'caras'
	},
	{ name: 'winking-smile', code: ';)', label: 'Guiño', file: 'winking-smile.png', cat: 'caras' },
	{
		name: 'surprised-smile',
		code: ':-O',
		label: 'Sorpresa',
		file: 'surprised-smile.png',
		cat: 'caras'
	},
	{
		name: 'smile-with-tongue-out',
		code: ':P',
		label: 'Lengua',
		file: 'smile-with-tongue-out.png',
		cat: 'caras'
	},
	{ name: 'hot-smile', code: '(H)', label: 'Gafas de sol', file: 'hot-smile.png', cat: 'caras' },
	{ name: 'angry-smile', code: ':@', label: 'Enfadado', file: 'angry-smile.png', cat: 'caras' },
	{
		name: 'embarrassed-smile',
		code: ':$',
		label: 'Ruborizado',
		file: 'embarrassed-smile.png',
		cat: 'caras'
	},
	{
		name: 'confused-smile',
		code: ':S',
		label: 'Confuso',
		file: 'confused-smile.png',
		cat: 'caras'
	},
	{ name: 'sad-smile', code: ':(', label: 'Triste', file: 'sad-smile.png', cat: 'caras' },
	{ name: 'crying-face', code: ":'(", label: 'Llanto', file: 'crying-face.png', cat: 'caras' },
	{
		name: 'disappointed-smile',
		code: ':|',
		label: 'Decepción',
		file: 'disappointed-smile.png',
		cat: 'caras'
	},
	{ name: 'devil', code: '(6)', label: 'Diablillo', file: 'devil.png', cat: 'caras' },
	{ name: 'angel', code: '(A)', label: 'Ángel', file: 'angel.png', cat: 'caras' },
	{
		name: 'dont-tell-anyone-smile',
		code: ':-#',
		label: 'No lo cuentes',
		file: 'dont-tell-anyone-smile.png',
		cat: 'caras'
	},
	{
		name: 'baring-teeth-smile',
		code: '8o|',
		label: 'Dientes',
		file: 'baring-teeth-smile.png',
		cat: 'caras'
	},
	{ name: 'nerd-smile', code: '8-|', label: 'Nerd', file: 'nerd-smile.png', cat: 'caras' },
	{
		name: 'sarcastic-smile',
		code: '^o)',
		label: 'Sarcasmo',
		file: 'sarcastic-smile.png',
		cat: 'caras'
	},
	{
		name: 'secret-telling-smile',
		code: ':-*',
		label: 'Secreto',
		file: 'secret-telling-smile.png',
		cat: 'caras'
	},
	{ name: 'sick-smile', code: '+o(', label: 'Mareado', file: 'sick-smile.png', cat: 'caras' },
	{
		name: 'i-dont-know-smile',
		code: ':^)',
		label: 'No sé',
		file: 'i-dont-know-smile.png',
		cat: 'caras'
	},
	{
		name: 'thinking-smile',
		code: '*-)',
		label: 'Pensando',
		file: 'thinking-smile.png',
		cat: 'caras'
	},
	{ name: 'party-smile', code: '<:o)', label: 'Fiesta', file: 'party-smile.png', cat: 'caras' },
	{
		name: 'eye-rolling-smile',
		code: '8-)',
		label: 'Ojos en blanco',
		file: 'eye-rolling-smile.png',
		cat: 'caras'
	},
	{ name: 'sleepy-smile', code: '|-)', label: 'Sueño', file: 'sleepy-smile.png', cat: 'caras' },
	// --- Gestos ---
	{ name: 'thumbs-up', code: '(Y)', label: 'Pulgar arriba', file: 'thumbs-up.png', cat: 'gestos' },
	{
		name: 'thumbs-down',
		code: '(N)',
		label: 'Pulgar abajo',
		file: 'thumbs-down.png',
		cat: 'gestos'
	},
	{
		name: 'high-five',
		code: '(h5)',
		label: 'Choca esos cinco',
		file: 'high-five.png',
		cat: 'gestos'
	},
	{ name: 'left-hug', code: '({)', label: 'Abrazo izq.', file: 'left-hug.png', cat: 'gestos' },
	{ name: 'right-hug', code: '(})', label: 'Abrazo der.', file: 'right-hug.png', cat: 'gestos' },
	{ name: 'boy', code: '(Z)', label: 'Chico', file: 'boy.png', cat: 'gestos' },
	{ name: 'girl', code: '(X)', label: 'Chica', file: 'girl.png', cat: 'gestos' },
	// --- Amor ---
	{ name: 'red-heart', code: '(L)', label: 'Corazón', file: 'red-heart.png', cat: 'amor' },
	{
		name: 'broken-heart',
		code: '(U)',
		label: 'Corazón roto',
		file: 'broken-heart.png',
		cat: 'amor'
	},
	{ name: 'red-lips', code: '(K)', label: 'Beso', file: 'red-lips.png', cat: 'amor' },
	{ name: 'red-rose', code: '(F)', label: 'Rosa', file: 'red-rose.png', cat: 'amor' },
	{
		name: 'wilted-rose',
		code: '(W)',
		label: 'Rosa marchita',
		file: 'wilted-rose.png',
		cat: 'amor'
	},
	{
		name: 'gift-with-a-bow',
		code: '(G)',
		label: 'Regalo',
		file: 'gift-with-a-bow.png',
		cat: 'amor'
	},
	// --- Animales ---
	{ name: 'cat-face', code: '(@)', label: 'Gato', file: 'cat-face.png', cat: 'animales' },
	{ name: 'dog-face', code: '(&)', label: 'Perro', file: 'dog-face.png', cat: 'animales' },
	{ name: 'goat', code: '(nnh)', label: 'Cabra', file: 'goat.png', cat: 'animales' },
	{
		name: 'black-sheep',
		code: '(bah)',
		label: 'Oveja negra',
		file: 'black-sheep.png',
		cat: 'animales'
	},
	{ name: 'snail', code: '(sn)', label: 'Caracol', file: 'snail.png', cat: 'animales' },
	{ name: 'turtle', code: '(tu)', label: 'Tortuga', file: 'turtle.png', cat: 'animales' },
	{ name: 'bunny', code: "('.')", label: 'Conejo', file: 'bunny.png', cat: 'animales' },
	{
		name: 'vampire-bat',
		code: ':[',
		label: 'Murciélago',
		file: 'vampire-bat.png',
		cat: 'animales'
	},
	// --- Comida ---
	{ name: 'coffee-cup', code: '(C)', label: 'Café', file: 'coffee-cup.png', cat: 'comida' },
	{ name: 'beer-mug', code: '(B)', label: 'Cerveza', file: 'beer-mug.png', cat: 'comida' },
	{ name: 'martini-glass', code: '(D)', label: 'Cóctel', file: 'martini-glass.png', cat: 'comida' },
	{ name: 'pizza', code: '(pi)', label: 'Pizza', file: 'pizza.png', cat: 'comida' },
	{ name: 'plate', code: '(pl)', label: 'Plato', file: 'plate.png', cat: 'comida' },
	{ name: 'bowl', code: '(||)', label: 'Cuenco', file: 'bowl.png', cat: 'comida' },
	{ name: 'birthday-cake', code: '(^)', label: 'Tarta', file: 'birthday-cake.png', cat: 'comida' },
	// --- Objetos ---
	{ name: 'messenger', code: '(M)', label: 'Messenger', file: 'messenger.png', cat: 'objetos' },
	{ name: 'star', code: '(*)', label: 'Estrella', file: 'star.png', cat: 'objetos' },
	{ name: 'filmstrip', code: '(~)', label: 'Película', file: 'filmstrip.png', cat: 'objetos' },
	{ name: 'note', code: '(8)', label: 'Nota musical', file: 'note.png', cat: 'objetos' },
	{ name: 'e-mail', code: '(E)', label: 'Correo', file: 'e-mail.png', cat: 'objetos' },
	{ name: 'clock', code: '(O)', label: 'Reloj', file: 'clock.png', cat: 'objetos' },
	{ name: 'camera', code: '(P)', label: 'Cámara', file: 'camera.png', cat: 'objetos' },
	{ name: 'light-bulb', code: '(I)', label: 'Idea', file: 'light-bulb.png', cat: 'objetos' },
	{
		name: 'telephone-receiver',
		code: '(T)',
		label: 'Teléfono',
		file: 'telephone-receiver.png',
		cat: 'objetos'
	},
	{ name: 'mobile-phone', code: '(mp)', label: 'Móvil', file: 'mobile-phone.png', cat: 'objetos' },
	{ name: 'computer', code: '(co)', label: 'Ordenador', file: 'computer.png', cat: 'objetos' },
	{ name: 'money', code: '(mo)', label: 'Dinero', file: 'money.png', cat: 'objetos' },
	{ name: 'auto', code: '(au)', label: 'Coche', file: 'auto.png', cat: 'objetos' },
	{ name: 'airplane', code: '(ap)', label: 'Avión', file: 'airplane.png', cat: 'objetos' },
	{ name: 'soccer-ball', code: '(so)', label: 'Balón', file: 'soccer-ball.png', cat: 'objetos' },
	{
		name: 'be-right-back',
		code: '(brb)',
		label: 'Vuelvo enseguida',
		file: 'be-right-back.png',
		cat: 'objetos'
	},
	// --- Mundo ---
	{ name: 'sun', code: '(#)', label: 'Sol', file: 'sun.png', cat: 'mundo' },
	{ name: 'rainbow', code: '(R)', label: 'Arcoíris', file: 'rainbow.png', cat: 'mundo' },
	{ name: 'storm-cloud', code: '(st)', label: 'Tormenta', file: 'storm-cloud.png', cat: 'mundo' },
	{ name: 'lightning', code: '(li)', label: 'Rayo', file: 'lightning.png', cat: 'mundo' },
	{ name: 'umbrella', code: '(um)', label: 'Paraguas', file: 'umbrella.png', cat: 'mundo' },
	{
		name: 'sleeping-half-moon',
		code: '(S)',
		label: 'Luna',
		file: 'sleeping-half-moon.png',
		cat: 'mundo'
	},
	{
		name: 'island-with-a-palm-tree',
		code: '(ip)',
		label: 'Isla',
		file: 'island-with-a-palm-tree.png',
		cat: 'mundo'
	}
];

// Mapa código -> ruta pública de imagen (para twemojiAction).
export const EMOTICON_MAP = Object.fromEntries(
	EMOTICON_LIST.map((e) => [e.code, `/emoticons/${e.file}`])
);

// Conjunto de todos los códigos (para heurísticas como isEmojiOnly).
export const EMOTICON_CODES = EMOTICON_LIST.map((e) => e.code);

/**
 * Función Svelte-safe para parsear un texto y devolver un array de fragmentos (texto o emote).
 * Evita la mutación del DOM y permite renderizar de forma segura con {#each}.
 */
export function parseMsnEmotes(text) {
	if (!text) return [];
	const parts = [];
	let current = text;

	// Ordenar códigos de mayor a menor longitud para priorizar coincidencias más largas.
	const codes = [...EMOTICON_CODES].sort((a, b) => b.length - a.length);

	while (current.length > 0) {
		let bestIdx = -1;
		let bestCode = null;

		for (const code of codes) {
			const idx = current.indexOf(code);
			if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
				bestIdx = idx;
				bestCode = code;
			}
		}

		if (bestCode) {
			if (bestIdx > 0) {
				parts.push({ type: 'text', content: current.slice(0, bestIdx) });
			}
			parts.push({ type: 'emote', code: bestCode, url: EMOTICON_MAP[bestCode] });
			current = current.slice(bestIdx + bestCode.length);
		} else {
			parts.push({ type: 'text', content: current });
			break;
		}
	}
	return parts;
}
