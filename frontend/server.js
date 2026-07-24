import { handler } from './build/handler.js';
import { createServer } from 'http';
import { initSocketIO } from './src/lib/server/socket.js';

const port = process.env.PORT || 3000;
const host = process.env.HOST || '0.0.0.0';

const server = createServer((req, res) => {
	if (req.url && req.url.startsWith('/_app/immutable/')) {
		res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
	} else if (
		req.url &&
		(req.url.startsWith('/uploads/') ||
			req.url.startsWith('/favicon') ||
			req.url.startsWith('/manifest.json'))
	) {
		res.setHeader('Cache-Control', 'public, max-age=86400');
	}
	// Let SvelteKit handle all HTTP requests
	handler(req, res);
});

// Initialize Socket.IO on the same HTTP server
initSocketIO(server);

server.listen(port, host, () => {
	console.log(`[V-SOCIAL] Production server running on http://${host}:${port}`);
});
