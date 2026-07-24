<script>
	import { onMount } from 'svelte';
	import { notifications as notificationsApi } from '$lib/api.js';
	import { notificationsStore } from '$lib/stores/notifications.svelte.js';

	let activeTab = $state('all');
	let loading = $state(true);

	let filteredNotifications = $derived(
		notificationsStore.items.filter((item) => {
			if (activeTab === 'all') return true;
			return item.type === activeTab;
		})
	);

	onMount(async () => {
		loading = true;
		try {
			const data = await notificationsApi.list();
			notificationsStore.setNotifications(data.notifications || []);
		} catch (err) {
			console.error('Failed to load notifications:', err);
			notificationsStore.setNotifications([
				{
					id: 1,
					type: 'like',
					is_read: false,
					created_at: new Date(Date.now() - 3600000).toISOString(),
					actor_username: 'sora_chan',
					actor_name: 'Sora VTuber',
					message: 'le dio like a tu publicación',
					entity_id: 12
				},
				{
					id: 2,
					type: 'follow',
					is_read: false,
					created_at: new Date(Date.now() - 7200000).toISOString(),
					actor_username: 'kuro_draws',
					actor_name: 'Kuro Art',
					message: 'empezó a seguirte'
				},
				{
					id: 3,
					type: 'comment',
					is_read: true,
					created_at: new Date(Date.now() - 86400000).toISOString(),
					actor_username: 'luna_stream',
					actor_name: 'Luna Streams',
					message: 'comentó: "¡Me encanta tu avatar!"',
					entity_id: 12
				},
				{
					id: 4,
					type: 'system',
					is_read: true,
					created_at: new Date(Date.now() - 172800000).toISOString(),
					message: 'Tu cuenta ha sido verificada con éxito como Creador Oficial.'
				}
			]);
		} finally {
			loading = false;
		}
	});

	async function markAsRead(notification) {
		if (notification.is_read) return;
		try {
			await notificationsApi.read(notification.id);
			notificationsStore.markRead(notification.id);
		} catch (err) {
			console.error('Failed to mark read:', err);
			notificationsStore.markRead(notification.id);
		}
	}

	async function markAllAsRead() {
		try {
			await notificationsApi.readAll();
			notificationsStore.markAllRead();
		} catch (err) {
			console.error('Failed to mark all read:', err);
			notificationsStore.markAllRead();
		}
	}

	function relativeTime(dateStr) {
		if (!dateStr) return '';
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'ahora';
		if (mins < 60) return `hace ${mins}m`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `hace ${hours}h`;
		const days = Math.floor(hours / 24);
		if (days < 7) return `hace ${days}d`;
		return new Date(dateStr).toLocaleDateString('es', { month: 'short', day: 'numeric' });
	}

	function getNotificationConfig(type) {
		switch (type) {
			case 'like':
				return { icon: 'favorite', colorClass: 'notif-like' };
			case 'comment':
				return { icon: 'chat_bubble', colorClass: 'notif-comment' };
			case 'follow':
				return { icon: 'person_add', colorClass: 'notif-follow' };
			case 'mention':
				return { icon: 'alternate_email', colorClass: 'notif-mention' };
			case 'system':
				return { icon: 'notifications', colorClass: 'notif-system' };
			default:
				return { icon: 'notifications', colorClass: 'notif-default' };
		}
	}

	const tabs = [
		{ id: 'all', label: 'Todas' },
		{ id: 'mention', label: 'Menciones' },
		{ id: 'like', label: 'Likes' },
		{ id: 'comment', label: 'Comentarios' },
		{ id: 'follow', label: 'Seguidores' },
		{ id: 'system', label: 'Sistema' }
	];
</script>

<svelte:head>
	<title>Notificaciones — VSocial</title>
</svelte:head>

<div class="notif-page">
	<div class="notif-header glass-panel">
		<div class="notif-header-text">
			<h1 class="notif-title">Notificaciones</h1>
			<p class="notif-subtitle">Mantente al tanto de lo que pasa en tu comunidad.</p>
		</div>
		{#if notificationsStore.unreadCount > 0}
			<button onclick={markAllAsRead} class="btn-aero-secondary notif-mark-btn">
				<span class="material-icons-round" style="font-size:16px">done_all</span>
				Marcar todo
			</button>
		{/if}
	</div>

	<div class="notif-tabs-scroll">
		<div class="notif-tabs">
			{#each tabs as tab}
				<button
					onclick={() => (activeTab = tab.id)}
					class="notif-tab {activeTab === tab.id ? 'active' : ''}"
				>
					{tab.label}
				</button>
			{/each}
		</div>
	</div>

	<div class="notif-feed">
		{#if loading}
			{#each Array(5) as _}
				<div class="notif-skeleton glass-panel">
					<div class="skeleton-icon"></div>
					<div class="skeleton-avatar"></div>
					<div class="skeleton-text">
						<div class="skeleton-line skeleton-w60"></div>
						<div class="skeleton-line skeleton-w40"></div>
					</div>
				</div>
			{/each}
		{:else if filteredNotifications.length === 0}
			<div class="notif-empty glass-panel">
				<span class="material-icons-round notif-empty-icon">notifications_none</span>
				<h3 class="notif-empty-title">Todo al día</h3>
				<p class="notif-empty-desc">No tienes notificaciones en esta sección.</p>
			</div>
		{:else}
			{#each filteredNotifications as notification (notification.id)}
				{@const config = getNotificationConfig(notification.type)}
				<button
					onclick={() => markAsRead(notification)}
					class="notif-card glass-card {notification.is_read ? 'is-read' : 'is-unread'}"
				>
					<div class="notif-card-inner">
						<div class="notif-left">
							{#if notification.actor_username}
								<div class="notif-avatar-wrap">
									{#if notification.actor_avatar}
										<img
											src={notification.actor_avatar}
											alt={notification.actor_username}
											class="notif-avatar-img"
										/>
									{:else}
										<div class="notif-avatar-fallback">
											{(notification.actor_name ||
												notification.actor_username ||
												'?')[0].toUpperCase()}
										</div>
									{/if}
									<div class="notif-type-badge {config.colorClass}">
										<span class="material-icons-round">{config.icon}</span>
									</div>
								</div>
							{:else}
								<div class="notif-icon-wrap {config.colorClass}">
									<span class="material-icons-round">{config.icon}</span>
								</div>
							{/if}
							<div class="notif-content">
								<p class="notif-message">{notification.message || 'Nueva notificación'}</p>
								<p class="notif-time">
									<span class="material-icons-round" style="font-size:12px">schedule</span>
									{relativeTime(notification.created_at)}
								</p>
							</div>
						</div>
						<div class="notif-right">
							{#if !notification.is_read}
								<span class="notif-unread-dot"></span>
							{/if}
							{#if notification.entity_id && (notification.type === 'like' || notification.type === 'comment')}
								<a href="/feed" class="notif-view-btn" onclick={(e) => e.stopPropagation()}>Ver</a>
							{/if}
						</div>
					</div>
				</button>
			{/each}
		{/if}
	</div>
</div>

<style>
	.notif-page {
		max-width: 48rem;
		margin: 0 auto;
		padding: 1.5rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.notif-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.25rem 1.5rem;
	}
	.notif-title {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 900;
		color: var(--text-primary);
	}
	.notif-subtitle {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin-top: 2px;
	}
	.notif-mark-btn {
		padding: 6px 14px;
		font-size: 0.78rem;
	}
	.notif-tabs-scroll {
		overflow-x: auto;
		scrollbar-width: none;
		padding-bottom: 0.25rem;
	}
	.notif-tabs-scroll::-webkit-scrollbar {
		display: none;
	}
	.notif-tabs {
		display: flex;
		gap: 4px;
		padding: 4px;
		background: var(--bg-overlay);
		border: 1px solid var(--border-glass);
		border-radius: var(--radius-full);
		width: max-content;
	}
	.notif-tab {
		padding: 8px 18px;
		font-family: var(--font-display);
		font-size: 0.84rem;
		font-weight: 600;
		color: var(--text-secondary);
		background: transparent;
		border: none;
		border-radius: var(--radius-full);
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.2s var(--ease-out);
	}
	.notif-tab:hover {
		color: var(--text-primary);
		background: var(--bg-surface);
	}
	.notif-tab.active {
		background: var(--grad-primary);
		color: var(--text-on-accent);
		box-shadow: 0 2px 8px rgba(46, 134, 232, 0.3);
	}
	.notif-feed {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.notif-card {
		display: block;
		width: 100%;
		text-align: left;
		padding: 1rem 1.25rem;
		border-radius: var(--radius-lg);
		cursor: pointer;
		background: none;
		border: none;
		font-family: inherit;
		transition:
			transform 0.2s var(--ease-out),
			box-shadow 0.2s var(--ease-out);
	}
	.notif-card:hover {
		transform: translateY(-2px);
	}
	.notif-card.is-unread {
		border: 1px solid rgba(46, 134, 232, 0.2);
		box-shadow: 0 0 15px rgba(46, 134, 232, 0.08);
	}
	.notif-card.is-read {
		opacity: 0.65;
	}
	.notif-card-inner {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}
	.notif-left {
		display: flex;
		gap: 0.85rem;
		align-items: center;
		min-width: 0;
		flex: 1;
	}
	.notif-avatar-wrap {
		position: relative;
		flex-shrink: 0;
		width: 44px;
		height: 44px;
	}
	.notif-avatar-img {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid var(--border-glass);
	}
	.notif-avatar-fallback {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--grad-primary);
		color: #fff;
		font-weight: 800;
		font-size: 1rem;
		border: 2px solid var(--border-glass);
	}
	.notif-type-badge {
		position: absolute;
		bottom: -3px;
		right: -3px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px solid var(--bg-surface);
	}
	.notif-type-badge .material-icons-round {
		font-size: 10px;
		color: #fff;
	}
	.notif-icon-wrap {
		flex-shrink: 0;
		width: 40px;
		height: 40px;
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border-glass);
	}
	.notif-icon-wrap .material-icons-round {
		font-size: 1.2rem;
	}
	.notif-like {
		background: var(--aero-rose);
	}
	.notif-comment {
		background: var(--aero-sky);
	}
	.notif-follow {
		background: var(--aero-indigo);
	}
	.notif-mention {
		background: var(--aero-amber);
	}
	.notif-system {
		background: var(--aero-mint);
	}
	.notif-default {
		background: var(--aero-blue);
	}
	.notif-icon-wrap.notif-like {
		background: rgba(232, 74, 114, 0.1);
		border-color: rgba(232, 74, 114, 0.2);
	}
	.notif-icon-wrap.notif-like .material-icons-round {
		color: var(--aero-rose);
	}
	.notif-icon-wrap.notif-comment {
		background: rgba(74, 171, 223, 0.1);
		border-color: rgba(74, 171, 223, 0.2);
	}
	.notif-icon-wrap.notif-comment .material-icons-round {
		color: var(--aero-sky);
	}
	.notif-icon-wrap.notif-follow {
		background: rgba(91, 114, 204, 0.1);
		border-color: rgba(91, 114, 204, 0.2);
	}
	.notif-icon-wrap.notif-follow .material-icons-round {
		color: var(--aero-indigo);
	}
	.notif-icon-wrap.notif-mention {
		background: rgba(232, 160, 35, 0.1);
		border-color: rgba(232, 160, 35, 0.2);
	}
	.notif-icon-wrap.notif-mention .material-icons-round {
		color: var(--aero-amber);
	}
	.notif-icon-wrap.notif-system {
		background: rgba(61, 199, 154, 0.1);
		border-color: rgba(61, 199, 154, 0.2);
	}
	.notif-icon-wrap.notif-system .material-icons-round {
		color: var(--aero-mint);
	}
	.notif-content {
		min-width: 0;
		flex: 1;
	}
	.notif-message {
		font-size: 0.88rem;
		color: var(--text-primary);
		line-height: 1.4;
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.is-read .notif-message {
		color: var(--text-secondary);
	}
	.notif-time {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.72rem;
		color: var(--text-muted);
		margin-top: 4px;
		font-weight: 500;
	}
	.notif-right {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 8px;
	}
	.notif-unread-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--aero-blue);
		box-shadow: 0 0 8px rgba(46, 134, 232, 0.5);
	}
	.notif-view-btn {
		padding: 4px 12px;
		font-size: 0.72rem;
		font-weight: 700;
		font-family: var(--font-display);
		color: var(--aero-blue);
		background: rgba(46, 134, 232, 0.08);
		border: 1px solid rgba(46, 134, 232, 0.2);
		border-radius: var(--radius-full);
		text-decoration: none;
		transition: all 0.15s ease;
	}
	.notif-view-btn:hover {
		background: rgba(46, 134, 232, 0.15);
	}
	.notif-skeleton {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 1rem 1.25rem;
		animation: pulse 1.5s ease-in-out infinite;
	}
	.skeleton-icon {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-sm);
		background: var(--bg-overlay);
	}
	.skeleton-avatar {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--bg-overlay);
	}
	.skeleton-text {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.skeleton-line {
		height: 10px;
		border-radius: 5px;
		background: var(--bg-overlay);
	}
	.skeleton-w60 {
		width: 60%;
	}
	.skeleton-w40 {
		width: 40%;
	}
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
	.notif-empty {
		padding: 4rem 2rem;
		text-align: center;
	}
	.notif-empty-icon {
		font-size: 3.5rem;
		color: var(--text-muted);
		opacity: 0.3;
		display: block;
		margin-bottom: 1rem;
	}
	.notif-empty-title {
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-weight: 800;
		color: var(--text-primary);
		margin-bottom: 0.5rem;
	}
	.notif-empty-desc {
		font-size: 0.82rem;
		color: var(--text-muted);
		max-width: 280px;
		margin: 0 auto;
	}
</style>
