/**
 * Registro único de emoticones MSN de Voom!.
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
	{ name: 'smile', code: ':)', label: 'Sonrisa', file: 'smile.webp', cat: 'caras' },
	{
		name: 'open-mouthed-smile',
		code: ':D',
		label: 'Risa',
		file: 'open-mouthed-smile.webp',
		cat: 'caras'
	},
	{ name: 'winking-smile', code: ';)', label: 'Guiño', file: 'winking-smile.webp', cat: 'caras' },
	{
		name: 'surprised-smile',
		code: ':-O',
		label: 'Sorpresa',
		file: 'surprised-smile.webp',
		cat: 'caras'
	},
	{
		name: 'smile-with-tongue-out',
		code: ':P',
		label: 'Lengua',
		file: 'smile-with-tongue-out.webp',
		cat: 'caras'
	},
	{ name: 'hot-smile', code: '(H)', label: 'Gafas de sol', file: 'hot-smile.webp', cat: 'caras' },
	{ name: 'angry-smile', code: ':@', label: 'Enfadado', file: 'angry-smile.webp', cat: 'caras' },
	{
		name: 'embarrassed-smile',
		code: ':$',
		label: 'Ruborizado',
		file: 'embarrassed-smile.webp',
		cat: 'caras'
	},
	{
		name: 'confused-smile',
		code: ':S',
		label: 'Confuso',
		file: 'confused-smile.webp',
		cat: 'caras'
	},
	{ name: 'sad-smile', code: ':(', label: 'Triste', file: 'sad-smile.webp', cat: 'caras' },
	{ name: 'crying-face', code: ":'(", label: 'Llanto', file: 'crying-face.webp', cat: 'caras' },
	{
		name: 'disappointed-smile',
		code: ':|',
		label: 'Decepción',
		file: 'disappointed-smile.webp',
		cat: 'caras'
	},
	{ name: 'devil', code: '(6)', label: 'Diablillo', file: 'devil.webp', cat: 'caras' },
	{ name: 'angel', code: '(A)', label: 'Ángel', file: 'angel.webp', cat: 'caras' },
	{
		name: 'dont-tell-anyone-smile',
		code: ':-#',
		label: 'No lo cuentes',
		file: 'dont-tell-anyone-smile.webp',
		cat: 'caras'
	},
	{
		name: 'baring-teeth-smile',
		code: '8o|',
		label: 'Dientes',
		file: 'baring-teeth-smile.webp',
		cat: 'caras'
	},
	{ name: 'nerd-smile', code: '8-|', label: 'Nerd', file: 'nerd-smile.webp', cat: 'caras' },
	{
		name: 'sarcastic-smile',
		code: '^o)',
		label: 'Sarcasmo',
		file: 'sarcastic-smile.webp',
		cat: 'caras'
	},
	{
		name: 'secret-telling-smile',
		code: ':-*',
		label: 'Secreto',
		file: 'secret-telling-smile.webp',
		cat: 'caras'
	},
	{ name: 'sick-smile', code: '+o(', label: 'Mareado', file: 'sick-smile.webp', cat: 'caras' },
	{
		name: 'i-dont-know-smile',
		code: ':^)',
		label: 'No sé',
		file: 'i-dont-know-smile.webp',
		cat: 'caras'
	},
	{
		name: 'thinking-smile',
		code: '*-)',
		label: 'Pensando',
		file: 'thinking-smile.webp',
		cat: 'caras'
	},
	{ name: 'party-smile', code: '<:o)', label: 'Fiesta', file: 'party-smile.webp', cat: 'caras' },
	{
		name: 'eye-rolling-smile',
		code: '8-)',
		label: 'Ojos en blanco',
		file: 'eye-rolling-smile.webp',
		cat: 'caras'
	},
	{ name: 'sleepy-smile', code: '|-)', label: 'Sueño', file: 'sleepy-smile.webp', cat: 'caras' },
	// --- Gestos ---
	{ name: 'thumbs-up', code: '(Y)', label: 'Pulgar arriba', file: 'thumbs-up.webp', cat: 'gestos' },
	{
		name: 'thumbs-down',
		code: '(N)',
		label: 'Pulgar abajo',
		file: 'thumbs-down.webp',
		cat: 'gestos'
	},
	{
		name: 'high-five',
		code: '(h5)',
		label: 'Choca esos cinco',
		file: 'high-five.webp',
		cat: 'gestos'
	},
	{ name: 'left-hug', code: '({)', label: 'Abrazo izq.', file: 'left-hug.webp', cat: 'gestos' },
	{ name: 'right-hug', code: '(})', label: 'Abrazo der.', file: 'right-hug.webp', cat: 'gestos' },
	{ name: 'boy', code: '(Z)', label: 'Chico', file: 'boy.webp', cat: 'gestos' },
	{ name: 'girl', code: '(X)', label: 'Chica', file: 'girl.webp', cat: 'gestos' },
	// --- Amor ---
	{
		name: 'red-heart',
		code: '(L)',
		emoji: '❤️',
		label: 'Corazón',
		file: 'red-heart.webp',
		cat: 'amor'
	},
	{
		name: 'broken-heart',
		code: '(U)',
		label: 'Corazón roto',
		file: 'broken-heart.webp',
		cat: 'amor'
	},
	{ name: 'red-lips', code: '(K)', label: 'Beso', file: 'red-lips.webp', cat: 'amor' },
	{ name: 'red-rose', code: '(F)', label: 'Rosa', file: 'red-rose.webp', cat: 'amor' },
	{
		name: 'wilted-rose',
		code: '(W)',
		label: 'Rosa marchita',
		file: 'wilted-rose.webp',
		cat: 'amor'
	},
	{
		name: 'gift-with-a-bow',
		code: '(G)',
		label: 'Regalo',
		file: 'gift-with-a-bow.webp',
		cat: 'amor'
	},
	// --- Animales ---
	{ name: 'cat-face', code: '(@)', label: 'Gato', file: 'cat-face.webp', cat: 'animales' },
	{ name: 'dog-face', code: '(&)', label: 'Perro', file: 'dog-face.webp', cat: 'animales' },
	{ name: 'goat', code: '(nnh)', label: 'Cabra', file: 'goat.webp', cat: 'animales' },
	{
		name: 'black-sheep',
		code: '(bah)',
		label: 'Oveja negra',
		file: 'black-sheep.webp',
		cat: 'animales'
	},
	{ name: 'snail', code: '(sn)', label: 'Caracol', file: 'snail.webp', cat: 'animales' },
	{ name: 'turtle', code: '(tu)', label: 'Tortuga', file: 'turtle.webp', cat: 'animales' },
	{ name: 'bunny', code: "('.')", label: 'Conejo', file: 'bunny.webp', cat: 'animales' },
	{
		name: 'vampire-bat',
		code: ':[',
		label: 'Murciélago',
		file: 'vampire-bat.webp',
		cat: 'animales'
	},
	// --- Comida ---
	{ name: 'coffee-cup', code: '(C)', label: 'Café', file: 'coffee-cup.webp', cat: 'comida' },
	{ name: 'beer-mug', code: '(B)', label: 'Cerveza', file: 'beer-mug.webp', cat: 'comida' },
	{
		name: 'martini-glass',
		code: '(D)',
		label: 'Cóctel',
		file: 'martini-glass.webp',
		cat: 'comida'
	},
	{ name: 'pizza', code: '(pi)', label: 'Pizza', file: 'pizza.webp', cat: 'comida' },
	{ name: 'plate', code: '(pl)', label: 'Plato', file: 'plate.webp', cat: 'comida' },
	{ name: 'bowl', code: '(||)', label: 'Cuenco', file: 'bowl.webp', cat: 'comida' },
	{ name: 'birthday-cake', code: '(^)', label: 'Tarta', file: 'birthday-cake.webp', cat: 'comida' },
	// --- Objetos ---
	{ name: 'messenger', code: '(M)', label: 'Messenger', file: 'messenger.webp', cat: 'objetos' },
	{ name: 'star', code: '(*)', label: 'Estrella', file: 'star.webp', cat: 'objetos' },
	{ name: 'filmstrip', code: '(~)', label: 'Película', file: 'filmstrip.webp', cat: 'objetos' },
	{ name: 'note', code: '(8)', label: 'Nota musical', file: 'note.webp', cat: 'objetos' },
	{ name: 'e-mail', code: '(E)', label: 'Correo', file: 'e-mail.webp', cat: 'objetos' },
	{ name: 'clock', code: '(O)', label: 'Reloj', file: 'clock.webp', cat: 'objetos' },
	{ name: 'camera', code: '(P)', label: 'Cámara', file: 'camera.webp', cat: 'objetos' },
	{ name: 'light-bulb', code: '(I)', label: 'Idea', file: 'light-bulb.webp', cat: 'objetos' },
	{
		name: 'telephone-receiver',
		code: '(T)',
		label: 'Teléfono',
		file: 'telephone-receiver.webp',
		cat: 'objetos'
	},
	{ name: 'mobile-phone', code: '(mp)', label: 'Móvil', file: 'mobile-phone.webp', cat: 'objetos' },
	{ name: 'computer', code: '(co)', label: 'Ordenador', file: 'computer.webp', cat: 'objetos' },
	{ name: 'money', code: '(mo)', label: 'Dinero', file: 'money.webp', cat: 'objetos' },
	{ name: 'auto', code: '(au)', label: 'Coche', file: 'auto.webp', cat: 'objetos' },
	{ name: 'airplane', code: '(ap)', label: 'Avión', file: 'airplane.webp', cat: 'objetos' },
	{ name: 'soccer-ball', code: '(so)', label: 'Balón', file: 'soccer-ball.webp', cat: 'objetos' },
	{
		name: 'be-right-back',
		code: '(brb)',
		label: 'Vuelvo enseguida',
		file: 'be-right-back.webp',
		cat: 'objetos'
	},
	// --- Mundo ---
	{ name: 'sun', code: '(#)', label: 'Sol', file: 'sun.webp', cat: 'mundo' },
	{ name: 'rainbow', code: '(R)', label: 'Arcoíris', file: 'rainbow.webp', cat: 'mundo' },
	{ name: 'storm-cloud', code: '(st)', label: 'Tormenta', file: 'storm-cloud.webp', cat: 'mundo' },
	{ name: 'lightning', code: '(li)', label: 'Rayo', file: 'lightning.webp', cat: 'mundo' },
	{ name: 'umbrella', code: '(um)', label: 'Paraguas', file: 'umbrella.webp', cat: 'mundo' },
	{
		name: 'sleeping-half-moon',
		code: '(S)',
		label: 'Luna',
		file: 'sleeping-half-moon.webp',
		cat: 'mundo'
	},
	{
		name: 'island-with-a-palm-tree',
		code: '(ip)',
		label: 'Isla',
		file: 'island-with-a-palm-tree.webp',
		cat: 'mundo'
	},
	// --- Voomojis: set propio de Voom! (generate_voomojis.py → build_emoticons.py).
	// El `code` ES el emoji unicode: al insertarlo, el parser lo renderiza como emote.
	// --- Reacciones ---
	{ name: 'fire', code: '🔥', emoji: '🔥', label: 'Fuego', file: 'fire.webp', cat: 'reacciones' },
	{
		name: 'sparkles',
		code: '✨',
		emoji: '✨',
		label: 'Brillos',
		file: 'sparkles.webp',
		cat: 'reacciones'
	},
	{
		name: 'hundred',
		code: '💯',
		emoji: '💯',
		label: 'Cien',
		file: 'hundred.webp',
		cat: 'reacciones'
	},
	{
		name: 'party-popper',
		code: '🎉',
		emoji: '🎉',
		label: 'Celebración',
		file: 'party-popper.webp',
		cat: 'reacciones'
	},
	{
		name: 'speech-balloon',
		code: '💬',
		emoji: '💬',
		label: 'Globo',
		file: 'speech-balloon.webp',
		cat: 'reacciones'
	},
	{ name: 'check', code: '✅', emoji: '✅', label: 'Ok', file: 'check.webp', cat: 'reacciones' },
	{ name: 'cross', code: '❌', emoji: '❌', label: 'No', file: 'cross.webp', cat: 'reacciones' },
	{
		name: 'star',
		code: '⭐',
		emoji: '⭐',
		label: 'Estrella',
		file: 'star.webp',
		cat: 'reacciones'
	},
	{
		name: 'lightning-emoji',
		code: '⚡',
		emoji: '⚡',
		label: 'Rayo',
		file: 'lightning.webp',
		cat: 'reacciones'
	},
	{
		name: 'collision',
		code: '💥',
		emoji: '💥',
		label: '¡Booom!',
		file: 'collision.webp',
		cat: 'reacciones'
	},
	{
		name: 'balloon',
		code: '🎈',
		emoji: '🎈',
		label: 'Globito',
		file: 'balloon.webp',
		cat: 'reacciones'
	},
	{
		name: 'heart-on-fire',
		code: '❤️‍🔥',
		emoji: '❤️‍🔥',
		label: 'Corazón en llamas',
		file: 'heart-on-fire.webp',
		cat: 'reacciones'
	},
	// --- Caras ---
	{
		name: 'smile-happy',
		code: '😁',
		emoji: '😁',
		label: 'Sonrisón',
		file: 'smile-happy.webp',
		cat: 'caras'
	},
	{
		name: 'laughing-tears',
		code: '😂',
		emoji: '😂',
		label: 'Risa y llanto',
		file: 'laughing-tears.webp',
		cat: 'caras'
	},
	{
		name: 'rofl',
		code: '🤣',
		emoji: '🤣',
		label: 'Risa infinita',
		file: 'rofl.webp',
		cat: 'caras'
	},
	{
		name: 'heart-eyes',
		code: '😍',
		emoji: '😍',
		label: 'Ojos de corazón',
		file: 'heart-eyes.webp',
		cat: 'caras'
	},
	{
		name: 'smiling-hearts',
		code: '🥰',
		emoji: '🥰',
		label: 'Enamorado',
		file: 'smiling-hearts.webp',
		cat: 'caras'
	},
	{
		name: 'kiss-wink',
		code: '😘',
		emoji: '😘',
		label: 'Beso y guiño',
		file: 'kiss-wink.webp',
		cat: 'caras'
	},
	{
		name: 'pleading',
		code: '🥺',
		emoji: '🥺',
		label: 'Suplicante',
		file: 'pleading.webp',
		cat: 'caras'
	},
	{ name: 'scream', code: '😱', emoji: '😱', label: 'Grito', file: 'scream.webp', cat: 'caras' },
	{
		name: 'exploding-head',
		code: '🤯',
		emoji: '🤯',
		label: 'Mente explotada',
		file: 'exploding-head.webp',
		cat: 'caras'
	},
	{
		name: 'triumph',
		code: '😤',
		emoji: '😤',
		label: 'Triunfo',
		file: 'triumph.webp',
		cat: 'caras'
	},
	{ name: 'cold', code: '🥶', emoji: '🥶', label: 'Frío', file: 'cold.webp', cat: 'caras' },
	{ name: 'hot', code: '🥵', emoji: '🥵', label: 'Calor', file: 'hot.webp', cat: 'caras' },
	{
		name: 'anxious',
		code: '😰',
		emoji: '😰',
		label: 'Ansioso',
		file: 'anxious.webp',
		cat: 'caras'
	},
	{
		name: 'partying',
		code: '🥳',
		emoji: '🥳',
		label: 'Fiesta',
		file: 'partying.webp',
		cat: 'caras'
	},
	{
		name: 'yawning',
		code: '🥱',
		emoji: '🥱',
		label: 'Bostezo',
		file: 'yawning.webp',
		cat: 'caras'
	},
	{ name: 'cowboy', code: '🤠', emoji: '🤠', label: 'Vaquero', file: 'cowboy.webp', cat: 'caras' },
	{ name: 'clown', code: '🤡', emoji: '🤡', label: 'Payaso', file: 'clown.webp', cat: 'caras' },
	{ name: 'mask', code: '😷', emoji: '😷', label: 'Mascarilla', file: 'mask.webp', cat: 'caras' },
	{ name: 'woozy', code: '🥴', emoji: '🥴', label: 'Mareado', file: 'woozy.webp', cat: 'caras' },
	{
		name: 'grimacing',
		code: '😬',
		emoji: '😬',
		label: 'Dientes apretados',
		file: 'grimacing.webp',
		cat: 'caras'
	},
	{
		name: 'astonished',
		code: '😲',
		emoji: '😲',
		label: 'Asombrado',
		file: 'astonished.webp',
		cat: 'caras'
	},
	{
		name: 'flushed',
		code: '😳',
		emoji: '😳',
		label: 'Sonrojado',
		file: 'flushed.webp',
		cat: 'caras'
	},
	{
		name: 'drooling',
		code: '🤤',
		emoji: '🤤',
		label: 'Babas',
		file: 'drooling.webp',
		cat: 'caras'
	},
	{ name: 'yum', code: '😋', emoji: '😋', label: 'Rico', file: 'yum.webp', cat: 'caras' },
	{
		name: 'thermometer',
		code: '🤒',
		emoji: '🤒',
		label: 'Enfermo',
		file: 'thermometer.webp',
		cat: 'caras'
	},
	{
		name: 'money-mouth',
		code: '🤑',
		emoji: '🤑',
		label: 'Dinero',
		file: 'money-mouth.webp',
		cat: 'caras'
	},
	{ name: 'hugging', code: '🤗', emoji: '🤗', label: 'Abrazo', file: 'hugging.webp', cat: 'caras' },
	{
		name: 'hand-over-mouth',
		code: '🤭',
		emoji: '🤭',
		label: 'Risita',
		file: 'hand-over-mouth.webp',
		cat: 'caras'
	},
	{ name: 'shushing', code: '🤫', emoji: '🤫', label: 'Shhh', file: 'shushing.webp', cat: 'caras' },
	{ name: 'zany', code: '🤪', emoji: '🤪', label: 'Chiflado', file: 'zany.webp', cat: 'caras' },
	{
		name: 'star-struck',
		code: '🤩',
		emoji: '🤩',
		label: 'Estrellado',
		file: 'star-struck.webp',
		cat: 'caras'
	},
	{ name: 'salute', code: '🫡', emoji: '🫡', label: 'Saludo', file: 'salute.webp', cat: 'caras' },
	// --- Gestos ---
	{
		name: 'clapping',
		code: '👏',
		emoji: '👏',
		label: 'Aplauso',
		file: 'clapping.webp',
		cat: 'gestos'
	},
	{
		name: 'raising-hands',
		code: '🙌',
		emoji: '🙌',
		label: 'Manos arriba',
		file: 'raising-hands.webp',
		cat: 'gestos'
	},
	{
		name: 'folded-hands',
		code: '🙏',
		emoji: '🙏',
		label: 'Gracias',
		file: 'folded-hands.webp',
		cat: 'gestos'
	},
	{
		name: 'flexed-arm',
		code: '💪',
		emoji: '💪',
		label: 'Fuerza',
		file: 'flexed-arm.webp',
		cat: 'gestos'
	},
	{
		name: 'fist-bump',
		code: '👊',
		emoji: '👊',
		label: 'Puño',
		file: 'fist-bump.webp',
		cat: 'gestos'
	},
	{ name: 'victory', code: '✌️', emoji: '✌️', label: 'Paz', file: 'victory.webp', cat: 'gestos' },
	{
		name: 'heart-hands',
		code: '🫶',
		emoji: '🫶',
		label: 'Manos corazón',
		file: 'heart-hands.webp',
		cat: 'gestos'
	},
	{ name: 'eyes', code: '👀', emoji: '👀', label: 'Ojos', file: 'eyes.webp', cat: 'gestos' },
	{
		name: 'handshake',
		code: '🤝',
		emoji: '🤝',
		label: 'Apretón',
		file: 'handshake.webp',
		cat: 'gestos'
	},
	// --- Amor (corazones de color) ---
	{
		name: 'heart-blue',
		code: '💙',
		emoji: '💙',
		label: 'Corazón azul',
		file: 'heart-blue.webp',
		cat: 'amor'
	},
	{
		name: 'heart-green',
		code: '💚',
		emoji: '💚',
		label: 'Corazón verde',
		file: 'heart-green.webp',
		cat: 'amor'
	},
	{
		name: 'heart-purple',
		code: '💜',
		emoji: '💜',
		label: 'Corazón morado',
		file: 'heart-purple.webp',
		cat: 'amor'
	},
	{
		name: 'heart-orange',
		code: '🧡',
		emoji: '🧡',
		label: 'Corazón naranja',
		file: 'heart-orange.webp',
		cat: 'amor'
	},
	{
		name: 'heart-yellow',
		code: '💛',
		emoji: '💛',
		label: 'Corazón amarillo',
		file: 'heart-yellow.webp',
		cat: 'amor'
	},
	{
		name: 'heart-black',
		code: '🖤',
		emoji: '🖤',
		label: 'Corazón negro',
		file: 'heart-black.webp',
		cat: 'amor'
	},
	{
		name: 'heart-white',
		code: '🤍',
		emoji: '🤍',
		label: 'Corazón blanco',
		file: 'heart-white.webp',
		cat: 'amor'
	},
	{
		name: 'two-hearts',
		code: '💕',
		emoji: '💕',
		label: 'Dos corazones',
		file: 'two-hearts.webp',
		cat: 'amor'
	},
	// --- Comida ---
	{ name: 'burger', code: '🍔', emoji: '🍔', label: 'Burger', file: 'burger.webp', cat: 'comida' },
	{ name: 'fries', code: '🍟', emoji: '🍟', label: 'Papas', file: 'fries.webp', cat: 'comida' },
	{ name: 'donut', code: '🍩', emoji: '🍩', label: 'Dona', file: 'donut.webp', cat: 'comida' },
	{
		name: 'popcorn',
		code: '🍿',
		emoji: '🍿',
		label: 'Palomitas',
		file: 'popcorn.webp',
		cat: 'comida'
	},
	// --- Animales ---
	{
		name: 'unicorn',
		code: '🦄',
		emoji: '🦄',
		label: 'Unicornio',
		file: 'unicorn.webp',
		cat: 'animales'
	},
	// --- Objetos ---
	{ name: 'trophy', code: '🏆', emoji: '🏆', label: 'Trofeo', file: 'trophy.webp', cat: 'objetos' },
	{
		name: 'gold-medal',
		code: '🥇',
		emoji: '🥇',
		label: 'Medalla',
		file: 'gold-medal.webp',
		cat: 'objetos'
	},
	{ name: 'crown', code: '👑', emoji: '👑', label: 'Corona', file: 'crown.webp', cat: 'objetos' },
	{ name: 'gem', code: '💎', emoji: '💎', label: 'Gema', file: 'gem.webp', cat: 'objetos' },
	{ name: 'rocket', code: '🚀', emoji: '🚀', label: 'Cohete', file: 'rocket.webp', cat: 'objetos' },
	{
		name: 'controller',
		code: '🎮',
		emoji: '🎮',
		label: 'Mando',
		file: 'controller.webp',
		cat: 'objetos'
	},
	{
		name: 'headphone',
		code: '🎧',
		emoji: '🎧',
		label: 'Cascos',
		file: 'headphone.webp',
		cat: 'objetos'
	},
	{
		name: 'music-note',
		code: '🎵',
		emoji: '🎵',
		label: 'Nota',
		file: 'music-note.webp',
		cat: 'objetos'
	},
	{ name: 'ghost', code: '👻', emoji: '👻', label: 'Fantasma', file: 'ghost.webp', cat: 'objetos' },
	{ name: 'robot', code: '🤖', emoji: '🤖', label: 'Robot', file: 'robot.webp', cat: 'objetos' },
	{ name: 'skull', code: '💀', emoji: '💀', label: 'Calavera', file: 'skull.webp', cat: 'objetos' },
	{
		name: 'guitar',
		code: '🎸',
		emoji: '🎸',
		label: 'Guitarra',
		file: 'guitar.webp',
		cat: 'objetos'
	},
	{
		name: 'clapper',
		code: '🎬',
		emoji: '🎬',
		label: 'Claqueta',
		file: 'clapper.webp',
		cat: 'objetos'
	},
	{ name: 'dice', code: '🎲', emoji: '🎲', label: 'Dado', file: 'dice.webp', cat: 'objetos' },
	{ name: 'books', code: '📚', emoji: '📚', label: 'Libros', file: 'books.webp', cat: 'objetos' },
	{ name: 'bell', code: '🔔', emoji: '🔔', label: 'Campana', file: 'bell.webp', cat: 'objetos' },
	{ name: 'target', code: '🎯', emoji: '🎯', label: 'Diana', file: 'target.webp', cat: 'objetos' },
	{ name: 'pin', code: '📌', emoji: '📌', label: 'Chincheta', file: 'pin.webp', cat: 'objetos' },
	{ name: 'pencil', code: '✏️', emoji: '✏️', label: 'Lápiz', file: 'pencil.webp', cat: 'objetos' },
	{ name: 'cart', code: '🛒', emoji: '🛒', label: 'Carrito', file: 'cart.webp', cat: 'objetos' },
	// --- Mundo ---
	{ name: 'moon', code: '🌙', emoji: '🌙', label: 'Luna', file: 'moon.webp', cat: 'mundo' },
	{
		name: 'snowflake',
		code: '❄️',
		emoji: '❄️',
		label: 'Copito',
		file: 'snowflake.webp',
		cat: 'mundo'
	},
	{ name: 'flower', code: '🌸', emoji: '🌸', label: 'Flor', file: 'flower.webp', cat: 'mundo' },
	{ name: 'clover', code: '🍀', emoji: '🍀', label: 'Trébol', file: 'clover.webp', cat: 'mundo' }
];

// Mapa código -> ruta pública de imagen (para twemojiAction).
export const EMOTICON_MAP = Object.fromEntries(
	EMOTICON_LIST.map((e) => [e.code, `/emoticons/${e.file}`])
);

/**
 * Quita el variation selector U+FE0F: el usuario puede escribir ❤️ (con VS16)
 * o ❤ (sin él) y ambos deben resolver al mismo emote.
 */
const stripVS = (s) => s.replaceAll('️', '');

// Mapa emoji unicode -> ruta pública (solo entradas que tienen `emoji`).
export const EMOJI_TO_EMOTE = Object.fromEntries(
	EMOTICON_LIST.filter((e) => e.emoji).map((e) => [stripVS(e.emoji), `/emoticons/${e.file}`])
);

// Mapa emoji unicode -> nombre canónico del emote (para titles).
const EMOJI_TO_NAME = Object.fromEntries(
	EMOTICON_LIST.filter((e) => e.emoji).map((e) => [stripVS(e.emoji), e.name])
);

/**
 * Datos de render para un emoji unicode: { url, name, emoji } o null si no
 * tiene emote propio (normaliza el variation selector U+FE0F).
 */
export function emoteFor(emoji) {
	if (!emoji) return null;
	const key = stripVS(String(emoji));
	const url = EMOJI_TO_EMOTE[key];
	return url ? { url, name: EMOJI_TO_NAME[key] || key, emoji: key } : null;
}

// Conjunto de todos los códigos (para heurísticas como isEmojiOnly).
export const EMOTICON_CODES = EMOTICON_LIST.map((e) => e.code);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Alternancia precompilada: códigos MSN + emojis mapeados. Ordenada por
// longitud del patrón (desc) para que '❤️‍🔥' gane a '❤️' y '(brb)' a '(b)'.
const _TOKENS = [
	...EMOTICON_CODES.map((c) => ({ raw: c, pat: escapeRe(c) })),
	...Object.keys(EMOJI_TO_EMOTE).map((e) => ({ raw: e, pat: escapeRe(e) }))
].sort((a, b) => b.pat.length - a.pat.length);
const TOKEN_RE = new RegExp(_TOKENS.map((t) => t.pat).join('|'), 'g');

/**
 * Función Svelte-safe para parsear un texto y devolver un array de fragmentos
 * (texto o emote). Matchea códigos MSN clásicos y emojis unicode con emote
 * propio (EMOJI_TO_EMOTE); el resto del texto queda como texto plano y se
 * renderiza con la fuente del sistema. Evita la mutación del DOM y permite
 * renderizar de forma segura con {#each}.
 */
export function parseMsnEmotes(text) {
	if (!text) return [];
	const norm = stripVS(String(text));
	const parts = [];
	let last = 0;
	TOKEN_RE.lastIndex = 0;
	let m;
	while ((m = TOKEN_RE.exec(norm)) !== null) {
		const tok = m[0];
		if (tok.length === 0) {
			// salvaguarda contra alternancias de longitud cero
			TOKEN_RE.lastIndex += 1;
			continue;
		}
		if (m.index > last) {
			parts.push({ type: 'text', content: norm.slice(last, m.index) });
		}
		parts.push({
			type: 'emote',
			code: tok,
			url: EMOTICON_MAP[tok] || EMOJI_TO_EMOTE[tok]
		});
		last = m.index + tok.length;
	}
	if (last < norm.length) {
		parts.push({ type: 'text', content: norm.slice(last) });
	}
	return parts;
}
