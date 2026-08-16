import { messages as messagesApi } from '$lib/api.js';

export function createChatStore() {
	let conversations = $state([]);
	let activeConvId = $state(null);
	let messages = $state([]);
	let searchQuery = $state('');
	let loadingConvs = $state(true);
	let loadingMsgs = $state(false);
	let hasMoreMessages = $state(true);
	let loadingMoreMessages = $state(false);
	let chatSessionKey = $state(0);
	let sending = $state(false);

	// Estado de respuesta/edición y confirmaciones de lectura
	let replyingTo = $state(null);
	let editingMessage = $state(null);
	let peerLastReadId = $state(0);

	let activeConv = $derived(conversations.find((c) => c.id === activeConvId));
	let filteredConversations = $derived(
		conversations
			.filter((c) => {
				const name = c.name || c.peer_display_name || c.peer_username || '';
				return name.toLowerCase().includes(searchQuery.toLowerCase());
			})
			// Fijadas primero; el resto conserva el orden del backend (por
			// última actividad). Array.sort es estable en JS moderno.
			.slice()
			.sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0))
	);

	function setConversations(data) {
		conversations = data;
		loadingConvs = false;
	}

	function setActiveConvId(id) {
		activeConvId = id;
		chatSessionKey += 1;
		replyingTo = null;
		editingMessage = null;
		peerLastReadId = 0;
	}

	function setMessages(data) {
		messages = data;
		loadingMsgs = false;
	}

	// Aplica el id del último mensaje leído por el peer a los mensajes propios,
	// marcándolos como leídos (read_at) para mostrar el doble check.
	function applyPeerLastRead(lastReadId) {
		if (!lastReadId) return;
		peerLastReadId = Math.max(peerLastReadId, Number(lastReadId));
		let changed = false;
		messages = messages.map((m) => {
			if (Number(m.id) <= peerLastReadId && !m.read_at && !m.pending) {
				changed = true;
				return { ...m, read_at: m.read_at || new Date().toISOString() };
			}
			return m;
		});
		if (!changed) messages = [...messages];
	}

	function addMessage(msg) {
		messages = [...messages, msg].slice(-200);
	}

	function updateMessage(id, newData) {
		const index = messages.findIndex((m) => m.id === id);
		if (index !== -1) {
			messages[index] = { ...messages[index], ...newData };
			messages = [...messages];
		}
	}

	function deleteMessage(id) {
		messages = messages.map((m) => {
			if (m.id === id) {
				return { ...m, is_deleted: true, body: null, content: null, media_url: null };
			}
			return m;
		});
	}

	async function loadMoreMessages(convId, lastMsgId) {
		if (!hasMoreMessages || loadingMoreMessages || !lastMsgId) return;
		loadingMoreMessages = true;
		try {
			const result = await messagesApi.list(convId, { limit: 50, before: lastMsgId });
			if (result.messages) {
				// Reverse because API might return newest first
				const older = result.messages.reverse();
				if (older.length < 50) {
					hasMoreMessages = false;
				}
				messages = [...older, ...messages];
			}
		} catch (error) {
			console.error('Error fetching older messages:', error);
		} finally {
			loadingMoreMessages = false;
		}
	}

	return {
		get conversations() {
			return conversations;
		},
		set conversations(v) {
			conversations = v;
		},
		get activeConvId() {
			return activeConvId;
		},
		set activeConvId(v) {
			activeConvId = v;
		},
		get messages() {
			return messages;
		},
		set messages(v) {
			messages = v;
		},
		get searchQuery() {
			return searchQuery;
		},
		set searchQuery(v) {
			searchQuery = v;
		},
		get loadingConvs() {
			return loadingConvs;
		},
		set loadingConvs(v) {
			loadingConvs = v;
		},
		get loadingMsgs() {
			return loadingMsgs;
		},
		set loadingMsgs(v) {
			loadingMsgs = v;
		},
		get hasMoreMessages() {
			return hasMoreMessages;
		},
		set hasMoreMessages(v) {
			hasMoreMessages = v;
		},
		get loadingMoreMessages() {
			return loadingMoreMessages;
		},
		set loadingMoreMessages(v) {
			loadingMoreMessages = v;
		},
		get chatSessionKey() {
			return chatSessionKey;
		},
		set chatSessionKey(v) {
			chatSessionKey = v;
		},
		get sending() {
			return sending;
		},
		set sending(v) {
			sending = v;
		},

		get replyingTo() {
			return replyingTo;
		},
		set replyingTo(v) {
			replyingTo = v;
		},
		get editingMessage() {
			return editingMessage;
		},
		set editingMessage(v) {
			editingMessage = v;
		},
		get peerLastReadId() {
			return peerLastReadId;
		},
		set peerLastReadId(v) {
			peerLastReadId = v;
		},

		get activeConv() {
			return activeConv;
		},
		get filteredConversations() {
			return filteredConversations;
		},

		setConversations,
		setActiveConvId,
		setMessages,
		applyPeerLastRead,
		addMessage,
		updateMessage,
		deleteMessage,
		loadMoreMessages
	};
}
