<script>
	import { page } from '$app/state';
	import { notificationsStore } from '$lib/stores/notifications.svelte.js';

	const items = [
		{ href: '/feed',         icon: 'home',         label: 'Inicio' },
		{ href: '/explore',      icon: 'explore',      label: 'Explorar' },
		{ href: '/posts/create', icon: 'post_add',     label: 'Crear',   accent: true },
		{ href: '/reels',        icon: 'play_circle',  label: 'Reels' },
		{ href: '/messages',     icon: 'chat_bubble',  label: 'Mensajes' },
	];
</script>

<nav class="vs-mobile-nav md:hidden">
	<div class="vs-mobile-container">
		{#each items as item}
			<a
				href={item.href}
				class="vs-mobile-item {page.url.pathname.startsWith(item.href) && !item.accent ? 'active' : ''} {item.accent ? 'accent-item' : ''}"
				aria-label={item.label}
			>
				{#if item.accent}
					<div class="vs-accent-pill">
						<span class="material-icons-round" style="font-size:26px; color:#fff">{item.icon}</span>
					</div>
				{:else}
					<div class="vs-icon-wrap">
						<span class="material-icons-round vs-mob-icon">{item.icon}</span>
						{#if item.href === '/messages' && notificationsStore.unreadMessageCount > 0}
							<span class="vs-mob-badge">
								{notificationsStore.unreadMessageCount > 9 ? '9+' : notificationsStore.unreadMessageCount}
							</span>
						{/if}
						{#if item.href === '/notifications' && notificationsStore.unreadCount > 0}
							<span class="vs-mob-badge">
								{notificationsStore.unreadCount > 9 ? '9+' : notificationsStore.unreadCount}
							</span>
						{/if}
					</div>
					<span class="vs-mob-label">{item.label}</span>
				{/if}
			</a>
		{/each}
	</div>
</nav>

<style>
	/* ─── Container ─────────────────────────────── */
	.vs-mobile-nav {
		position: fixed;
		bottom: 0; left: 0; right: 0;
		z-index: var(--z-sticky, 200);
		padding: 8px 12px 20px;
	}

	.vs-mobile-container {
		display: flex;
		justify-content: space-around;
		align-items: center;
		padding: 6px 4px;

		background: var(--glass-bg);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		will-change: transform;
		transform: translateZ(0);
		border: 1px solid var(--glass-border);
		border-top-color: var(--glass-border-t);
		border-radius: 24px;
		box-shadow: var(--shadow-lg), var(--glass-inset);
	}

	/* ─── Nav items ─────────────────────────────── */
	.vs-mobile-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3px;
		padding: 6px 10px;
		border-radius: 16px;
		color: var(--text-muted);
		text-decoration: none;
		transition: color var(--t-base), background var(--t-base), transform var(--t-spring);
		flex: 1;
		min-width: 0;
		position: relative;
	}

	.vs-mobile-item:hover {
		color: var(--aero-blue);
	}

	.vs-mobile-item.active {
		color: var(--aero-blue);
	}

	/* ─── Icon wrap ─────────────────────────────── */
	.vs-icon-wrap {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.vs-mob-icon {
		font-size: 23px;
		transition: transform var(--t-spring);
	}

	.vs-mobile-item:hover .vs-mob-icon,
	.vs-mobile-item.active .vs-mob-icon {
		transform: translateY(-2px) scale(1.10);
	}

	/* Active indicator dot */
	.vs-mobile-item.active::after {
		content: '';
		position: absolute;
		bottom: -2px;
		width: 4px; height: 4px;
		border-radius: 50%;
		background: var(--aero-blue);
		box-shadow: 0 0 6px rgba(46,134,232,0.50);
	}

	.vs-mob-label {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.01em;
		white-space: nowrap;
	}

	/* ─── Notification badge ─────────────────────── */
	.vs-mob-badge {
		position: absolute;
		top: -5px; right: -7px;
		background: var(--aero-rose);
		color: #fff;
		font-size: 8px;
		font-weight: 700;
		min-width: 14px; height: 14px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 2px;
		border: 2px solid var(--bg-canvas);
		box-shadow: 0 2px 6px rgba(232,74,114,0.40);
	}

	/* ─── Accent (Create) button ─────────────────── */
	.accent-item {
		color: transparent;
		position: relative;
		padding-top: 0;
	}

	.vs-accent-pill {
		width: 52px; height: 52px;
		border-radius: 50%;
		background: var(--grad-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: -24px;
		border: none;
		box-shadow: 0 4px 16px rgba(46,134,232,0.4), inset 0 1px 2px rgba(255,255,255,0.4);
		transition: transform var(--t-spring), box-shadow var(--t-base);
		position: relative;
		z-index: 10;
	}
	.vs-accent-pill::before {
		content: '';
		position: absolute;
		top: 0; left: 0; right: 0;
		height: 45%;
		background: linear-gradient(180deg, rgba(255,255,255,0.20) 0%, transparent 100%);
		border-radius: 50% 50% 0 0;
		pointer-events: none;
	}

	.accent-item:hover .vs-accent-pill {
		transform: translateY(-5px) scale(1.06);
		box-shadow: 0 12px 28px rgba(46,134,232,0.46), inset 0 1px 0 rgba(255,255,255,0.40);
	}

	/* ─── Dark mode refinements ──────────────────── */
	:global([data-theme="dark"]) .vs-mobile-container {
		box-shadow: 0 -2px 20px rgba(0,0,0,0.30), var(--shadow-lg), var(--glass-inset);
	}
</style>