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
			entries: ['/', '/privacy', '/terms', '/cookies', '/about', '/about/verified'],
			handleUnseenRoutes: 'ignore',
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
