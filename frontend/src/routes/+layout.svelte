<script>
	import './layout.css';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { page } from '$app/state';
	import { goto, onNavigate } from '$app/navigation';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { notificationsStore } from '$lib/stores/notifications.svelte.js';
	import { initTheme } from '$lib/stores/theme.svelte.js';
	import { uiStore } from '$lib/stores/ui.svelte.js';
	import { featureStore } from '$lib/stores/features.svelte.js';
	import SideNav from '$lib/components/SideNav.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import MobileNav from '$lib/components/MobileNav.svelte';
	import LiquidBackground from '$lib/components/LiquidBackground.svelte';
	import PwaPrompt from '$lib/components/PwaPrompt.svelte';
	import CookieBanner from '$lib/components/CookieBanner.svelte';

	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		// En móvil las view transitions snapshot+crossfadeean la página entera (incluido glass con blur),
		// lo que es costoso por navegación en低端. Navegación instantánea en móvil; PC mantiene la transición.
		if (window.matchMedia('(max-width: 768px)').matches) return;
		if (navigation.to?.url.href === navigation.from?.url.href) return;
		if (
			navigation.to?.url.pathname === navigation.from?.url.pathname &&
			navigation.to?.url.hash !== navigation.from?.url.hash
		)
			return;

		return new Promise((resolve) => {
			const transition = document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
			// Evitar excepciones no capturadas si la transición se aborta
			if (transition.ready) transition.ready.catch(() => {});
			if (transition.finished) transition.finished.catch(() => {});
			if (transition.updateCallbackDone) transition.updateCallbackDone.catch(() => {});
		});
	});

	initTheme();

	let { children, data } = $props();

	$effect(() => {
		if (data?.globalSettings) {
			featureStore.initFeatures(data.globalSettings);
		}
	});

	// Modo de plataforma → atributo en <html>, mismo patrón que data-theme.
	// Como el socket 'global_settings_update' dispara invalidateAll(), este $effect
	// re-corre y el layout muta sin recargar en todos los clientes conectados.
	$effect(() => {
		if (typeof document === 'undefined') return;
		const mode = data?.globalSettings?.platform_mode || 'custom';
		document.documentElement.setAttribute('data-platform-mode', mode);
	});

	$effect(() => {
		const handleSettingsUpdate = () => {
			import('$app/navigation').then(({ invalidateAll }) => {
				invalidateAll();
			});
		};
		window.addEventListener('global_settings_update', handleSettingsUpdate);
		return () => window.removeEventListener('global_settings_update', handleSettingsUpdate);
	});

	let installChecked = $derived(data?.isInstalled !== undefined);
	let isInstalled = $derived(data?.isInstalled ?? false);

	const publicRoutes = [
		'/',
		'/login',
		'/register',
		'/install',
		'/setup',
		'/privacy',
		'/terms',
		'/cookies'
	];
	const isPublicRoute = $derived(
		publicRoutes.some(
			(r) =>
				page.url.pathname === r ||
				page.url.pathname.startsWith('/install') ||
				page.url.pathname.startsWith('/setup')
		)
	);
	const isAdminRoute = $derived(page.url.pathname.startsWith('/admin'));
	const isReelsRoute = $derived(page.url.pathname.startsWith('/reels'));

	onMount(async () => {
		authStore.initialize();

		if (data?.isInstalled === undefined) {
			try {
				const res = await fetch('/api/install');
				if (res.ok) {
					const status = await res.json();
					isInstalled = !!status.installed;
				}
			} catch (err) {
				console.error('[Layout] Failed to check installation status:', err);
			}
		}

		if (!isInstalled && page.url.pathname !== '/install') {
			installChecked = true;
			goto('/install');
			return;
		}

		if (isInstalled && page.url.pathname === '/install') {
			installChecked = true;
			goto('/');
			return;
		}

		if (isInstalled) {
			try {
				const setupRes = await fetch('/api/setup');
				if (setupRes.ok) {
					const setupData = await setupRes.json();
					if (setupData.needsSetup && page.url.pathname !== '/setup') {
						installChecked = true;
						goto('/setup');
						return;
					}
					if (!setupData.needsSetup && page.url.pathname === '/setup') {
						installChecked = true;
						goto('/login');
						return;
					}
				}
			} catch {}
		}

		installChecked = true;

		if (!isPublicRoute && !authStore.isAuthenticated) {
			goto('/login');
			return;
		}

		if (authStore.isAuthenticated && authStore.token) {
			notificationsStore.connect(authStore.token);
		}
	});

	onMount(() => {
		// Motor de Físicas para Scroll Horizontal (Momentum/Lerp)
		let scrollTarget = 0;
		let scrollCurrent = 0;
		let isScrolling = false;
		let activeWheelListenerTarget = null;

		const applyMomentum = () => {
			if (!activeWheelListenerTarget) {
				isScrolling = false;
				return;
			}
			scrollCurrent += (scrollTarget - scrollCurrent) * 0.12;
			activeWheelListenerTarget.scrollLeft = scrollCurrent;

			if (Math.abs(scrollTarget - scrollCurrent) > 0.5) {
				requestAnimationFrame(applyMomentum);
			} else {
				activeWheelListenerTarget.scrollLeft = scrollTarget;
				isScrolling = false;
			}
		};

		const wheelHandler = (e) => {
			if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
			e.preventDefault(); // Bloquear scroll vertical solo dentro del slider

			scrollTarget += e.deltaY * 1.2;
			const maxScroll =
				activeWheelListenerTarget.scrollWidth - activeWheelListenerTarget.clientWidth;
			scrollTarget = Math.max(0, Math.min(scrollTarget, maxScroll));

			if (!isScrolling) {
				isScrolling = true;
				requestAnimationFrame(applyMomentum);
			}
		};

		// Delegación dinámica: Solo aplicamos "passive: false" al elemento bajo el cursor
		// Esto libera el hilo principal (compositor thread) para el scroll del resto de la página.
		const pointerOverHandler = (e) => {
			const path = window.location.pathname;
			if (path === '/' || path === '/about/verified') {
				if (activeWheelListenerTarget) {
					activeWheelListenerTarget.removeEventListener('wheel', wheelHandler);
					activeWheelListenerTarget = null;
					isScrolling = false;
				}
				return;
			}

			const slider = e.target.closest('.overflow-x-auto, .hide-scrollbar');
			if (slider && slider.scrollWidth > slider.clientWidth) {
				if (activeWheelListenerTarget !== slider) {
					if (activeWheelListenerTarget) {
						activeWheelListenerTarget.removeEventListener('wheel', wheelHandler);
					}
					activeWheelListenerTarget = slider;
					activeWheelListenerTarget.addEventListener('wheel', wheelHandler, { passive: false });
					scrollTarget = activeWheelListenerTarget.scrollLeft;
					scrollCurrent = activeWheelListenerTarget.scrollLeft;
				}
			} else if (activeWheelListenerTarget) {
				activeWheelListenerTarget.removeEventListener('wheel', wheelHandler);
				activeWheelListenerTarget = null;
				isScrolling = false;
			}
		};

		window.addEventListener('mouseover', pointerOverHandler);

		return () => {
			window.removeEventListener('mouseover', pointerOverHandler);
			if (activeWheelListenerTarget) {
				activeWheelListenerTarget.removeEventListener('wheel', wheelHandler);
			}
		};
	});

	$effect(() => {
		let heartbeatTimer;
		if (authStore.isAuthenticated) {
			// Gamification: Heartbeat (Time online)
			heartbeatTimer = setInterval(
				async () => {
					if (document.visibilityState === 'visible') {
						try {
							const res = await fetch('/api/gamification/heartbeat', {
								method: 'POST',
								headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}
							});
							if (res.ok) {
								const data = await res.json();
								if (data.awarded && data.amount > 0 && authStore.user) {
									authStore.user.xp_points = (authStore.user.xp_points || 0) + data.amount;
								}
							}
						} catch (_e) {
							// Ignorar errores de red en el ping de fondo para evitar cerrar sesión accidentalmente
						}
					}
				},
				2 * 60 * 1000
			); // 2 minutes
		} else {
			notificationsStore.disconnect();
		}

		return () => {
			if (heartbeatTimer) clearInterval(heartbeatTimer);
		};
	});
</script>

<svelte:head>
	<title>VSocial &mdash; Red Social para Creadores Virtuales</title>
</svelte:head>

<svelte:body class:is-reels={isReelsRoute} />

<LiquidBackground />

{#if !installChecked}
	<div class="vs-boot" data-vs-boot out:fade={{ duration: 400, easing: cubicOut }}>
		<div class="vs-boot__core">
			<div class="vs-boot__prism"></div>
			<h1 class="vs-boot__brand">
				<span class="vs-boot__mark">VS</span>ocial
			</h1>
			<div class="vs-boot__meter">
				<span class="vs-boot__pulse"></span>
				<p class="vs-boot__status">Iniciando Motor</p>
			</div>
		</div>
	</div>
{:else if isPublicRoute}
	{@render children()}
{:else if isAdminRoute}
	{@render children()}
{:else if authStore.isAuthenticated}
	<div
		class="vs-shell"
		class:vs-shell--collapsed={!uiStore.sidebarExpanded}
		class:vs-shell--reels={isReelsRoute}
	>
		<aside class="vs-shell__rail">
			<SideNav />
		</aside>

		<div class="vs-shell__stage">
			<TopBar />
			<main class="vs-shell__canvas">
				{@render children()}
			</main>
		</div>

		<MobileNav />
	</div>
{:else}
	<div class="vs-boot vs-boot--fallback" out:fade={{ duration: 300 }}>
		<span class="vs-boot__spinner"></span>
	</div>
{/if}

<PwaPrompt />
<CookieBanner />

<style>
	:global(body.is-reels),
	:global(html.is-reels) {
		background-color: #05131a !important;
	}

	:global(.vs-shell--reels .vs-shell__canvas) {
		background-color: #05131a !important;
		padding: 0 !important;
		position: relative !important;
		height: 100% !important;
		overflow: hidden !important;
	}
	:global(.vs-shell--reels .vs-shell__canvas::-webkit-scrollbar) {
		display: none;
	}

	.vs-boot {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		background: var(--bg-canvas);
		background-attachment: fixed;
		isolation: isolate;
		animation: vsBootEnter 0.6s var(--ease-out) both;
	}

	.vs-boot::before {
		content: '';
		position: absolute;
		inset: -20%;
		background:
			radial-gradient(circle at 30% 40%, rgba(0, 229, 255, 0.18) 0%, transparent 55%),
			radial-gradient(circle at 70% 60%, rgba(232, 74, 114, 0.14) 0%, transparent 50%),
			radial-gradient(circle at 50% 85%, rgba(255, 215, 0, 0.1) 0%, transparent 60%);
		z-index: -1;
		animation: vsAurora 18s ease-in-out infinite alternate;
		will-change: transform;
	}

	.vs-boot__core {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2rem;
		padding: 3rem 3.5rem;
		border-radius: var(--radius-xl);
		background: var(--glass-bg);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		border: 1px solid transparent;
		border-image: var(--glass-border) 1;
		box-shadow: var(--glass-shadow), var(--glass-inset-highlight);
		overflow: hidden;
		animation: vsCoreFloat 0.8s var(--ease-spring) both;
	}

	.vs-boot__core::before {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--noise-texture);
		opacity: 0.03;
		pointer-events: none;
	}

	.vs-boot__prism {
		position: absolute;
		top: -40%;
		left: 50%;
		width: 220%;
		height: 60%;
		transform: translateX(-50%);
		background: radial-gradient(
			ellipse at 50% 50%,
			rgba(0, 229, 255, 0.12) 0%,
			rgba(232, 74, 114, 0.06) 50%,
			transparent 75%
		);
		pointer-events: none;
	}

	.vs-boot__brand {
		position: relative;
		font-family: var(--font-display);
		font-weight: 900;
		font-size: clamp(3rem, 8vw, 4.25rem);
		letter-spacing: -0.03em;
		color: var(--text-primary);
		margin: 0;
		line-height: 1;
	}

	.vs-boot__mark {
		background: var(--accent-gradient);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		filter: drop-shadow(0 0 18px rgba(0, 229, 255, 0.35));
	}

	.vs-boot__meter {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.vs-boot__pulse {
		width: 2.5rem;
		height: 3px;
		border-radius: 9999px;
		background: var(--accent-gradient);
		background-size: 200% 100%;
		animation: vsPulseSweep 1.6s var(--ease-out) infinite;
		box-shadow: 0 0 14px rgba(0, 229, 255, 0.4);
	}

	.vs-boot__status {
		margin: 0;
		font-family: var(--font-display);
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.28em;
		text-transform: uppercase;
		color: var(--text-secondary);
	}

	.vs-boot--fallback {
		display: grid;
		place-items: center;
	}

	.vs-boot--fallback .vs-boot__spinner {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		border: 3px solid transparent;
		border-top-color: var(--accent-cyan);
		border-right-color: var(--accent-magenta);
		animation: vsSpin 0.9s linear infinite;
		box-shadow: 0 0 20px rgba(0, 229, 255, 0.25);
	}

	.vs-shell {
		display: flex;
		min-height: 100vh;
		position: relative;
	}

	.vs-shell__rail {
		width: 16rem;
		flex-shrink: 0;
		position: sticky;
		top: 0;
		height: 100vh;
		display: none;
		flex-direction: column;
		z-index: 40;
		transition: width var(--t-spring);
	}

	.vs-shell--collapsed .vs-shell__rail {
		width: 5rem;
	}

	.vs-shell__stage {
		flex: 1 1 0%;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.vs-shell__canvas {
		flex: 1 1 0%;
		padding-bottom: 5rem;
	}

	@keyframes vsBootEnter {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes vsCoreFloat {
		from {
			opacity: 0;
			transform: translateY(14px) scale(0.96);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@keyframes vsAurora {
		0% {
			transform: translate(0, 0) scale(1);
		}
		50% {
			transform: translate(-3%, 4%) scale(1.06);
		}
		100% {
			transform: translate(3%, -4%) scale(1);
		}
	}

	@keyframes vsPulseSweep {
		0% {
			background-position: 0% 50%;
			opacity: 0.6;
		}
		50% {
			background-position: 100% 50%;
			opacity: 1;
		}
		100% {
			background-position: 0% 50%;
			opacity: 0.6;
		}
	}

	@keyframes vsSpin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (min-width: 768px) {
		.vs-shell__rail {
			display: flex;
		}
		.vs-shell__canvas {
			padding-bottom: 0;
		}
	}
</style>
