/**
 * mediaViewer.svelte.js - Store de estado reactivo para el Media Lightbox Universal de V-Social
 * Utiliza Svelte 5 Runes para coordinar la apertura de galerías, posts, avatares y fotos de portada.
 */

import { getProxiedMediaUrl } from '$lib/utils/mediaProxy.js';

function createMediaViewerStore() {
	let isOpen = $state(false);
	let items = $state([]);
	let currentIndex = $state(0);
	let contextType = $state('standalone'); // 'post' | 'profile_avatar' | 'profile_cover' | 'comment' | 'standalone'
	let activePost = $state(null);
	let activeUser = $state(null);
	let title = $state('');
	let caption = $state('');
	let updateListeners = new Set();

	const currentItem = $derived(items[currentIndex] || null);
	const hasNext = $derived(items.length > 1 && currentIndex < items.length - 1);
	const hasPrev = $derived(items.length > 1 && currentIndex > 0);
	const totalItems = $derived(items.length);

	function open({
		mediaList = [],
		initialIndex = 0,
		type = 'standalone',
		post = null,
		user = null,
		mediaTitle = '',
		mediaCaption = ''
	}) {
		items = mediaList.map((item) => {
			if (typeof item === 'string') {
				return {
					url: getProxiedMediaUrl(item),
					type: item.match(/\.(mp4|webm|ogg|mov)$/i) ? 'video' : 'image',
					alt: mediaTitle || 'Media'
				};
			}
			return {
				...item,
				url: getProxiedMediaUrl(item.media_url || item.url),
				type: item.media_type || item.type || 'image',
				alt: item.alt || mediaTitle || 'Media',
				width: item.width || null,
				height: item.height || null
			};
		});

		currentIndex = Math.max(0, Math.min(initialIndex, Math.max(0, items.length - 1)));
		contextType = type;
		activePost = post ? { ...post } : null;
		activeUser = user;
		title = mediaTitle;
		caption = mediaCaption;
		isOpen = true;

		if (typeof document !== 'undefined') {
			document.documentElement.classList.add('is-lightbox-open');
			document.body.classList.add('is-lightbox-open');
			document.documentElement.style.overflow = 'hidden';
			document.body.style.overflow = 'hidden';
		}
	}

	function openPostMedia(post, initialIndex = 0) {
		if (!post) return;
		const media = post.media && post.media.length > 0 ? post.media : [];
		if (media.length === 0) return;

		open({
			mediaList: media,
			initialIndex,
			type: 'post',
			post,
			user: post.author || {
				id: post.user_id,
				username: post.username,
				display_name: post.display_name,
				avatar_url: post.avatar_url,
				is_verified: post.is_verified,
				level: post.level,
				role: post.role,
				title_text: post.title_text,
				title_color: post.title_color
			},
			mediaTitle: `Publicación de @${post.username || 'usuario'}`
		});
	}

	function openProfileAvatar(user) {
		if (!user || !user.avatar_url) return;
		open({
			mediaList: [
				{
					url: user.avatar_url,
					type: 'image',
					alt: `Foto de perfil de ${user.display_name || user.username}`
				}
			],
			initialIndex: 0,
			type: 'profile_avatar',
			user,
			mediaTitle: `Foto de perfil de @${user.username}`,
			mediaCaption: user.display_name || user.username
		});
	}

	function openProfileCover(user) {
		if (!user || !user.cover_url) return;
		open({
			mediaList: [
				{
					url: user.cover_url,
					type: 'image',
					alt: `Foto de portada de ${user.display_name || user.username}`
				}
			],
			initialIndex: 0,
			type: 'profile_cover',
			user,
			mediaTitle: `Foto de portada de @${user.username}`,
			mediaCaption: user.display_name || user.username
		});
	}

	function openImage(url, mediaTitle = '', mediaCaption = '', post = null) {
		if (!url) return;
		open({
			mediaList: [
				{
					url: getProxiedMediaUrl(url),
					type: url.match(/\.(mp4|webm|ogg|mov)$/i) ? 'video' : 'image',
					alt: mediaTitle || 'Imagen'
				}
			],
			initialIndex: 0,
			type: post ? 'post' : 'standalone',
			post,
			mediaTitle,
			mediaCaption
		});
	}

	function next() {
		if (items.length <= 1) return;
		if (currentIndex < items.length - 1) {
			currentIndex += 1;
		} else {
			currentIndex = 0;
		}
	}

	function prev() {
		if (items.length <= 1) return;
		if (currentIndex > 0) {
			currentIndex -= 1;
		} else {
			currentIndex = items.length - 1;
		}
	}

	function setIndex(index) {
		if (index >= 0 && index < items.length) {
			currentIndex = index;
		}
	}

	function updateActivePost(partial) {
		if (activePost) {
			activePost = { ...activePost, ...partial };
			updateListeners.forEach((fn) => {
				try {
					fn(activePost);
				} catch {}
			});
		}
	}

	function onPostUpdated(callback) {
		updateListeners.add(callback);
		return () => updateListeners.delete(callback);
	}

	function close() {
		isOpen = false;
		if (typeof document !== 'undefined') {
			document.documentElement.classList.remove('is-lightbox-open');
			document.body.classList.remove('is-lightbox-open');
			document.documentElement.style.overflow = '';
			document.body.style.overflow = '';
		}
	}

	return {
		get isOpen() {
			return isOpen;
		},
		get items() {
			return items;
		},
		get currentIndex() {
			return currentIndex;
		},
		get currentItem() {
			return currentItem;
		},
		get hasNext() {
			return hasNext;
		},
		get hasPrev() {
			return hasPrev;
		},
		get totalItems() {
			return totalItems;
		},
		get contextType() {
			return contextType;
		},
		get activePost() {
			return activePost;
		},
		get activeUser() {
			return activeUser;
		},
		get title() {
			return title;
		},
		get caption() {
			return caption;
		},
		open,
		openPostMedia,
		openProfileAvatar,
		openProfileCover,
		openImage,
		next,
		prev,
		setIndex,
		updateActivePost,
		onPostUpdated,
		close
	};
}

export const mediaViewer = createMediaViewerStore();
