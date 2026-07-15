import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { socketPlugin } from './src/lib/server/socket-plugin.js';

export default defineConfig({
	plugins: [sveltekit(), socketPlugin],
	build: {
		minify: 'terser',
		terserOptions: {
			compress: {
				drop_console: true,
				drop_debugger: true,
				passes: 2
			},
			format: {
				comments: false
			}
		},
		rollupOptions: {
			output: {
				manualChunks: (id) => {
					if (id.includes('node_modules')) {
						if (id.includes('socket.io')) return 'vendor-socket';
						if (id.includes('dompurify')) return 'vendor-purify';
						return 'vendor';
					}
				}
			}
		}
	},
	server: {
		allowedHosts: ['.trycloudflare.com'],
		fs: {
			// Allow serving uploads from project root
			allow: ['..']
		}
	}
});
