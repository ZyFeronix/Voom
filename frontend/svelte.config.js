import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({
			out: 'build',
			precompress: true,
			envPrefix: ''
		}),
		prerender: {
			// Páginas estáticas sin datos (legales + about). El +layout.js raíz tiene prerender=false,
			// así que el crawler no fuerza rutas dinámicas (p.ej. /feed); estas entradas explícitas
			// garantizan el prerender aunque alguna no esté enlazada en el crawl desde '/'.
			entries: ['/', '/privacy', '/terms', '/cookies', '/about', '/about/verified'],
			// Assets faltantes referenciados en metas globales (p.ej. og-image.png) no deben abortar el prerender.
			handleHttpError: ({ path, message }) => {
				if (
					path.endsWith('.png') ||
					path.endsWith('.ico') ||
					path.endsWith('.jpg') ||
					path.endsWith('.svg')
				) {
					return;
				}
				throw new Error(message);
			}
		}
	}
};

export default config;
