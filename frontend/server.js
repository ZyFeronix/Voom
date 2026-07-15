import { handler } from './build/handler.js';
import { createServer } from 'http';
import { initSocketIO } from './src/lib/server/socket.js';

const port = process.env.PORT || 3000;
const host = process.env.HOST || '0.0.0.0';

const server = createServer((req, res) => {
	// Let SvelteKit handle all HTTP requests
	handler(req, res);
});

// Initialize Socket.IO on the same HTTP server
initSocketIO(server);

server.listen(port, host, () => {
	console.log(`[V-SOCIAL] Production server running on http://${host}:${port}`);
});
