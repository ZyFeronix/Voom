/**
 * VSocial API Client
 * Centralized HTTP client for all backend API calls.
 * Base URL: /api
 */

const API_BASE = '/api';

/**
 * Get auth token from localStorage.
 */
function getToken() {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem('vsocial_token');
}

/**
 * Core fetch wrapper with auth and error handling.
 */
async function request(path, options = {}) {
	const token = getToken();
	const headers = {
		'Content-Type': 'application/json',
		...(token ? { Authorization: `Bearer ${token}` } : {}),
		...options.headers
	};

	const response = await fetch(`${API_BASE}${path}`, {
		...options,
		headers
	});

	// Handle empty responses
	const contentType = response.headers.get('content-type');
	const isJson = contentType && contentType.includes('application/json');
	const data = isJson ? await response.json() : null;

	if (!response.ok) {
		const error = new Error(data?.error || `HTTP ${response.status}`);
		error.status = response.status;
		error.data = data;
		throw error;
	}

	return data;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const get = (path, opts = {}) => request(path, { method: 'GET', ...opts });
const post = (path, body, opts = {}) =>
	request(path, { method: 'POST', body: JSON.stringify(body), ...opts });
const put = (path, body, opts = {}) =>
	request(path, { method: 'PUT', body: JSON.stringify(body), ...opts });
const del = (path, opts = {}) => request(path, { method: 'DELETE', ...opts });

/**
 * Upload file(s) using multipart/form-data.
 */
async function upload(path, formData) {
	const token = getToken();
	const response = await fetch(`${API_BASE}${path}`, {
		method: 'POST',
		headers: token ? { Authorization: `Bearer ${token}` } : {},
		body: formData
	});
	const data = await response.json();
	if (!response.ok) {
		const error = new Error(data?.error || `HTTP ${response.status}`);
		error.status = response.status;
		throw error;
	}
	return data;
}

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------
export const auth = {
	register: (data) => post('/auth/register', data),
	login: (data) => post('/auth/login', data),
	logout: () => post('/auth/logout', {}),
	me: () => get('/auth/me'),
	changePassword: (data) => put('/auth/change-password', data)
};

// ---------------------------------------------------------------------------
// Feed API
// ---------------------------------------------------------------------------
export const feed = {
	get: (params = {}) => {
		const qs = new URLSearchParams(params).toString();
		return get(`/feed${qs ? '?' + qs : ''}`);
	},
	explore: (params = {}) => {
		const qs = new URLSearchParams(params).toString();
		return get(`/feed/explore${qs ? '?' + qs : ''}`);
	},
	trendingTags: () => get('/feed/trending-tags'),
	preferences: {
		get: () => get('/feed/preferences'),
		update: (data) => put('/feed/preferences', data)
	}
};

// ---------------------------------------------------------------------------
// Posts API
// ---------------------------------------------------------------------------
export const posts = {
	create: (data) => post('/posts', data),
	get: (id) => get(`/posts/${id}`),
	update: (id, data) => put(`/posts/${id}`, data),
	delete: (id) => del(`/posts/${id}`),
	restore: (id) => post(`/posts/${id}/restore`, {}),
	like: (id) => post(`/posts/${id}/like`, {}),
	unlike: (id) => del(`/posts/${id}/like`),
	share: (id, data) => post(`/posts/${id}/share`, data),
	save: (id) => post(`/posts/${id}/save`, {}),
	unsave: (id) => del(`/posts/${id}/save`),
	comments: {
		list: (postId, params = {}) => {
			const qs = new URLSearchParams(params).toString();
			return get(`/posts/${postId}/comments${qs ? '?' + qs : ''}`);
		},
		create: (postId, data) => post(`/posts/${postId}/comments`, data),
		update: (postId, commentId, data) => put(`/posts/${postId}/comments/${commentId}`, data),
		delete: (postId, commentId) => del(`/posts/${postId}/comments/${commentId}`),
		like: (postId, commentId) => post(`/posts/${postId}/comments/${commentId}/like`, {}),
		unlike: (postId, commentId) => del(`/posts/${postId}/comments/${commentId}/like`)
	},
	uploadMedia: (formData) => upload('/posts/media', formData)
};

// ---------------------------------------------------------------------------
// Users API
// ---------------------------------------------------------------------------
export const users = {
	get: (username) => get(`/users/${username}`),
	posts: (username, params = {}) => {
		const qs = new URLSearchParams(params).toString();
		return get(`/users/${username}/posts${qs ? '?' + qs : ''}`);
	},
	follow: (username) => post(`/users/${username}/follow`, {}),
	unfollow: (username) => del(`/users/${username}/follow`),
	followers: (username, params = {}) => {
		const qs = new URLSearchParams(params).toString();
		return get(`/users/${username}/followers${qs ? '?' + qs : ''}`);
	},
	following: (username, params = {}) => {
		const qs = new URLSearchParams(params).toString();
		return get(`/users/${username}/following${qs ? '?' + qs : ''}`);
	},
	search: (query, params = {}) => {
		const qs = new URLSearchParams({ q: query, ...params }).toString();
		return get(`/users/search?${qs}`);
	},
	updateProfile: (data) => put('/users/profile', data),
	updateCustomization: (data) => put('/users/me/customization', data),
	uploadAvatar: (fd) => upload('/users/avatar', fd),
	uploadCover: (fd) => upload('/users/cover', fd),
	settings: {
		get: () => get('/users/settings'),
		update: (data) => put('/users/settings', data)
	},
	suggestedCreators: () => get('/users/suggested'),
	// RGPD: borrado de cuenta (soft-delete con ventana de 30 días)
	deleteAccount: (password) => post('/users/delete-account', { password }),
	// RGPD: exportación de datos — devuelve la Response cruda para .blob()
	exportData: async () => {
		const token = getToken();
		const response = await fetch(`${API_BASE}/users/export`, {
			headers: token ? { Authorization: `Bearer ${token}` } : {}
		});
		if (!response.ok) {
			let msg = `HTTP ${response.status}`;
			try {
				const d = await response.json();
				msg = d?.error || msg;
			} catch (_) {}
			const error = new Error(msg);
			error.status = response.status;
			throw error;
		}
		return response;
	}
};

// ---------------------------------------------------------------------------
// Stories API
// ---------------------------------------------------------------------------
export const stories = {
	feed: () => get('/stories/feed'),
	create: (fd) => upload('/stories', fd),
	view: (id) => post(`/stories/${id}/view`, {}),
	delete: (id) => del(`/stories/${id}`)
};

// ---------------------------------------------------------------------------
// Reels API
// ---------------------------------------------------------------------------
export const reels = {
	feed: (params = {}) => {
		const qs = new URLSearchParams(params).toString();
		return get(`/reels/feed${qs ? '?' + qs : ''}`);
	},
	get: (id) => get(`/reels/${id}`),
	create: (fd) => upload('/reels', fd),
	like: (id) => post(`/reels/${id}/like`, {}),
	unlike: (id) => del(`/reels/${id}/like`),
	view: (id) => post(`/reels/${id}/view`, {}),
	delete: (id) => del(`/reels/${id}`),
	comments: {
		list: (id, params = {}) => {
			const qs = new URLSearchParams(params).toString();
			return get(`/reels/${id}/comments${qs ? '?' + qs : ''}`);
		},
		create: (id, data) => post(`/reels/${id}/comments`, data),
		delete: (id, commentId) => del(`/reels/${id}/comments/${commentId}`),
		like: (id, commentId) => post(`/reels/${id}/comments/${commentId}/like`, {}),
		unlike: (id, commentId) => del(`/reels/${id}/comments/${commentId}/like`)
	}
};

// ---------------------------------------------------------------------------
// Messages API
// ---------------------------------------------------------------------------
export const messages = {
	conversations: {
		list: () => get('/messages/conversations'),
		get: (id) => get(`/messages/conversations/${id}`),
		create: (data) => get(`/messages/conversations/user/${data.user_id}`)
	},
	list: (convId, params = {}) => {
		const qs = new URLSearchParams(params).toString();
		return get(`/messages/conversations/${convId}/messages${qs ? '?' + qs : ''}`);
	},
	markRead: (convId, msgId) => post(`/messages/conversations/${convId}/read/${msgId}`, {}),
	send: (convId, data) => post(`/messages/conversations/${convId}/messages`, data),
	delete: (msgId) => del(`/messages/${msgId}`),
	react: (msgId, emoji) => post(`/messages/${msgId}/reactions`, { emoji }),
	typing: (convId) => post(`/messages/conversations/${convId}/typing`, {}),
	unreadCount: () => get('/messages/unread-count')
};

// ---------------------------------------------------------------------------
// Marketplace API
// ---------------------------------------------------------------------------
export const marketplace = {
	list: (params = {}) => {
		const qs = new URLSearchParams(params).toString();
		return get(`/marketplace${qs ? '?' + qs : ''}`);
	},
	get: (id) => get(`/marketplace/${id}`),
	create: (data) => post('/marketplace', data),
	update: (id, data) => put(`/marketplace/${id}`, data),
	delete: (id) => del(`/marketplace/${id}`),
	offer: (id, data) => post(`/marketplace/${id}/offers`, data),
	review: (id, data) => post(`/marketplace/${id}/reviews`, data),
	categories: () => get('/marketplace/categories'),
	search: (query, params = {}) => {
		const qs = new URLSearchParams({ q: query, ...params }).toString();
		return get(`/marketplace/search?${qs}`);
	}
};

// ---------------------------------------------------------------------------
// Notifications API
// ---------------------------------------------------------------------------
export const notifications = {
	list: (params = {}) => {
		const qs = new URLSearchParams(params).toString();
		return get(`/notifications${qs ? '?' + qs : ''}`);
	},
	read: (id) => post(`/notifications/${id}/read`, {}),
	readAll: () => post('/notifications/read-all', {}),
	delete: (id) => del(`/notifications/${id}`)
};

// ---------------------------------------------------------------------------
// Admin API
// ---------------------------------------------------------------------------
export const admin = {
	dashboard: () => get('/admin/dashboard'),
	users: {
		list: (params = {}) => {
			const qs = new URLSearchParams(params).toString();
			return get(`/admin/users${qs ? '?' + qs : ''}`);
		},
		get: (id) => get(`/admin/users/${id}`),
		create: (data) => post(`/admin/users/create`, data),
		update: (id, data) => put(`/admin/users/${id}`, data),
		ban: (userId, data) => post(`/admin/users/ban`, { user_id: userId, ...data }),
		unban: (userId) => post(`/admin/users/unban`, { user_id: userId }),
		disable: (userId) => post(`/admin/users/disable`, { user_id: userId }),
		enable: (userId) => post(`/admin/users/enable`, { user_id: userId }),
		delete: (id) => del(`/admin/users/${id}`)
	},
	reports: {
		list: (params = {}) => {
			const qs = new URLSearchParams(params).toString();
			return get(`/admin/reports${qs ? '?' + qs : ''}`);
		},
		resolve: (id, data) => post(`/admin/reports/${id}`, data)
	},
	content: {
		list: (params = {}) => {
			const qs = new URLSearchParams(params).toString();
			return get(`/admin/content${qs ? '?' + qs : ''}`);
		},
		delete: (type, id) => del(`/admin/content/${type}/${id}`),
		restore: (id) => post(`/admin/content/trash/${id}`)
	},
	settings: {
		get: () => get('/admin/settings'),
		update: (data) => put('/admin/settings', data)
	},
	analytics: () => get('/admin/analytics')
};

// ---------------------------------------------------------------------------
// Wallet API
// ---------------------------------------------------------------------------
export const wallet = {
	balance: () => get('/wallet'),
	transactions: (params = {}) => {
		const qs = new URLSearchParams(params).toString();
		return get(`/wallet/transactions${qs ? '?' + qs : ''}`);
	},
	transfer: (data) => post('/wallet/transfer', data),
	tip: (data) => post('/wallet/tip', data),
	deposit: (data) => post('/wallet/deposit', data),
	withdraw: (data) => post('/wallet/withdraw', data)
};

// ---------------------------------------------------------------------------
// Search API
// ---------------------------------------------------------------------------
export const search = {
	query: (q, params = {}) => {
		const qs = new URLSearchParams({ q, ...params }).toString();
		return get(`/search${qs ? '?' + qs : ''}`);
	},
	trending: () => get('/search')
};

// ---------------------------------------------------------------------------
// Media API
// ---------------------------------------------------------------------------
export const media = {
	upload: (formData) => upload('/upload', formData)
};

// ---------------------------------------------------------------------------
// Activity API
// ---------------------------------------------------------------------------
export const activity = {
	view: (data) => post('/activity/view', data),
	history: (filter = 'all') => get(`/activity/history?filter=${filter}`)
};

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------
export const health = () => get('/health');

export default {
	auth,
	feed,
	posts,
	users,
	stories,
	reels,
	messages,
	marketplace,
	notifications,
	admin,
	wallet,
	search,
	media,
	activity,
	health
};
