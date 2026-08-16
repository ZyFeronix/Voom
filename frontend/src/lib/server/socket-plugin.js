import { initSocketIO } from './socket.js';

export const socketPlugin = {
	name: 'socket-io-plugin',
	configureServer(server) {
		if (server.httpServer) {
			initSocketIO(server.httpServer);
		}
	}
};
