/**
 * likeSparkles.js — Generador de destellos y partículas Neo-Aero para la animación de Like.
 *
 * Proporciona un estallido radial simétrico con variación orgánica en ángulos,
 * distancias, tamaños y la paleta de colores cromática de V-SOCIAL.
 */

export function generateLikeSparkles(count = 8, baseDist = 22) {
	const colors = [
		'#f43f5e', // Ruby Rose principal
		'#ec4899', // Aero Rose
		'#38bdf8', // Aero Sky
		'#00d4aa', // Aero Mint
		'#c084fc', // Neo Purple
		'#fbbf24', // Amber Gold
		'#fb7185', // Coral Light
		'#f43f5e' // Ruby Rose
	];

	return Array.from({ length: count }, (_, i) => {
		const angleStep = 360 / count;
		const jitter = Math.round(Math.random() * 10 - 5);
		const angle = Math.round(i * angleStep + jitter);
		const dist = Math.round(baseDist + Math.random() * 6);
		const size = i % 2 === 0 ? 4 : 3;
		const color = colors[i % colors.length];
		const delay = (i % 3) * 15;

		return {
			id: `${Date.now()}_${i}_${Math.random()}`,
			angle,
			dist,
			size,
			color,
			delay
		};
	});
}
