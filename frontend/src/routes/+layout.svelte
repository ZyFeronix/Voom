<script>
	import '$lib/styles/fonts.css';
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
	import FpsHud from '$lib/components/FpsHud.svelte';
	import RouteProgress from '$lib/components/RouteProgress.svelte';
	import PwaPrompt from '$lib/components/PwaPrompt.svelte';
	import CookieBanner from '$lib/components/CookieBanner.svelte';
	import MediaLightbox from '$lib/components/MediaLightbox.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import LevelUpModal from '$lib/components/gamification/LevelUpModal.svelte';
	import { perfStore } from '$lib/stores/perf.svelte.js';

	onNavigate((navigation) => {
		// La View Transitions API es el único requisito. Ningún perfil de
		// rendimiento la bloquea: cada perfil tiene sus propias duraciones
		// CSS calibradas (enabled=0.32s, fast=0.26s, lite=0.22s, disabled=0.16s).
		if (!document.startViewTransition) return;

		// Solo transiciones entre rutas distintas: los cambios de query/hash en
		// la misma ruta (p. ej. filtros ?filter=) no disparan snapshot global —
		// eran los que dejaban el overlay ::view-transition pegado.
		if (
			navigation.to?.url.href === navigation.from?.url.href ||
			navigation.to?.url.pathname === navigation.from?.url.pathname
		)
			return;

		// Congela transiciones CSS de entrada mientras dura el snapshot de la
		// View Transition: evita que animaciones propias de cada página (stagger,
		// fades) compitan con el crossfade y ensucien el fundido.
		document.documentElement.classList.add('is-vt-active');

		return new Promise((resolve) => {
			let transition;
			try {
				transition = document.startViewTransition(async () => {
					resolve();
					await navigation.complete;
				});
			} catch (_e) {
				// Sin transición no hay nada que congelar: restaurar y continuar.
				document.documentElement.classList.remove('is-vt-active');
				resolve();
				return;
			}

			// El crossfade no debe esperar al decodificado de imágenes de la
			// página nueva: en cuanto el callback del DOM termina, arrancamos
			// la animación (updateCallbackDone) y dejamos que las imágenes
			// aparezcan dentro del canvas ya fundido. Evita frames vacíos.
			transition.updateCallbackDone.finally(() => {
				document.documentElement.classList.remove('is-vt-active');
			});
			transition.updateCallbackDone.catch(() => {});

			// Rescate anti-congelamiento: si la VT no termina en 1s, se salta
			// para que un overlay colgado no rompa la plataforma visualmente.
			const timeout = setTimeout(() => {
				transition.skipTransition();
			}, 1000);
			transition.finished.finally(() => clearTimeout(timeout)).catch(() => {});

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
		const handleSettingsUpdate = (e) => {
			const detail = e?.detail;
			if (detail && typeof detail === 'object' && Object.keys(detail).length > 0) {
				featureStore.initFeatures(detail);
				if (typeof document !== 'undefined') {
					document.documentElement.setAttribute(
						'data-platform-mode',
						detail.platform_mode || 'custom'
					);
				}
			} else {
				fetch('/api/settings')
					.then((res) => (res.ok ? res.json() : null))
					.then((json) => {
						if (json?.settings) {
							featureStore.initFeatures(json.settings);
							if (typeof document !== 'undefined') {
								document.documentElement.setAttribute(
									'data-platform-mode',
									json.settings.platform_mode || 'custom'
								);
							}
						}
					})
					.catch(() => {});
			}
		};
		window.addEventListener('global_settings_update', handleSettingsUpdate);
		return () => window.removeEventListener('global_settings_update', handleSettingsUpdate);
	});

	let hasBootedInSession = $state(
		typeof window !== 'undefined' && typeof sessionStorage !== 'undefined'
			? sessionStorage.getItem('vsocial_booted') === '1'
			: false
	);
	let installChecked = $state(false);
	let isInstalled = $state(false);
	let bootGraceElapsed = $state(false);
	let isHeavyLoading = $state(false);

	$effect(() => {
		if (data?.isInstalled !== undefined) {
			isInstalled = data.isInstalled;
		}
	});

	onMount(() => {
		if (!hasBootedInSession) {
			// Gracia visual mínima para que el arranque inicial de la sesión sea suave y cinematográfico
			const timer = setTimeout(() => {
				bootGraceElapsed = true;
			}, 400);
			return () => clearTimeout(timer);
		} else {
			bootGraceElapsed = true;
			// En recargas posteriores, solo mostramos el splash si la carga toma demasiado tiempo (>500ms)
			const heavyTimer = setTimeout(() => {
				if (!installChecked || !authStore.initialized) {
					isHeavyLoading = true;
				}
			}, 500);
			return () => clearTimeout(heavyTimer);
		}
	});

	// Zonas clave donde tiene sentido el Boot Screen (arranque principal de la plataforma)
	const BOOT_KEY_ROUTES = ['/', '/feed'];
	const isBootKeyRoute = $derived(BOOT_KEY_ROUTES.includes(page.url.pathname));

	// Rutas públicas y de acceso general (permiten visualización a visitantes o perfiles directos)
	const publicPrefixes = [
		'/about',
		'/install',
		'/setup',
		'/u',
		'/posts',
		'/reels',
		'/explore',
		'/marketplace',
		'/leaderboard'
	];
	const publicExact = ['/', '/login', '/register', '/privacy', '/terms', '/cookies'];
	const isStrictlyPrivate = $derived(
		page.url.pathname.startsWith('/feed') ||
			page.url.pathname.startsWith('/messages') ||
			page.url.pathname.startsWith('/notifications') ||
			page.url.pathname.startsWith('/settings') ||
			page.url.pathname.startsWith('/studio') ||
			page.url.pathname.startsWith('/posts/create') ||
			page.url.pathname.startsWith('/reels/create') ||
			page.url.pathname.startsWith('/marketplace/create')
	);
	const isPublicRoute = $derived(
		!isStrictlyPrivate &&
			(publicExact.includes(page.url.pathname) ||
				publicPrefixes.some((prefix) => page.url.pathname.startsWith(prefix)))
	);
	const isAdminRoute = $derived(page.url.pathname.startsWith('/admin'));
	const isReelsRoute = $derived(
		page.url.pathname.startsWith('/reels') && !page.url.pathname.startsWith('/reels/create')
	);
	const isInitializing = $derived(!installChecked || !authStore.initialized);

	// El Boot Screen solo se activa en el primer arranque frío de zonas clave (/) o (/feed)
	const showBootScreen = $derived(
		isBootKeyRoute &&
			!isAdminRoute &&
			!(isPublicRoute && !authStore.token) &&
			((!hasBootedInSession && (isInitializing || !bootGraceElapsed)) ||
				(hasBootedInSession && isInitializing && isHeavyLoading))
	);

	onMount(() => {
		perfStore.init();

		// ── Visual Viewport → variables CSS + clase has-keyboard ───────────────
		// En móvil el teclado virtual no redimensiona el layout viewport de forma
		// fiable (iOS sobre todo). Exponemos --vv-height / --vv-top para que los
		// contenedores fijos (messages, reels, drawers) se re-dimensionen y el
		// teclado nunca tape el composer/textarea.
		const vv = window.visualViewport;
		const root = document.documentElement;
		// Se parte de la altura visual ACTUAL (no de innerHeight, que en móvil
		// incluye la barra de URL expandida y provocaría un falso "teclado abierto").
		let maxVvHeight = vv ? vv.height : window.innerHeight;
		let applyRaf = null;

		const apply = () => {
			const h = vv ? vv.height : window.innerHeight;
			const top = vv ? vv.offsetTop : 0;
			maxVvHeight = Math.max(maxVvHeight, h);
			const keyboardOpen = maxVvHeight - h > 120;
			root.style.setProperty('--vv-height', `${h}px`);
			root.style.setProperty('--vv-top', `${top}px`);
			root.classList.toggle('has-keyboard', keyboardOpen);
		};

		const scheduleApply = () => {
			if (applyRaf) return;
			applyRaf = requestAnimationFrame(() => {
				applyRaf = null;
				apply();
			});
		};

		if (vv) {
			apply();
			vv.addEventListener('resize', scheduleApply);
			vv.addEventListener('scroll', scheduleApply);
			window.addEventListener('orientationchange', () => {
				maxVvHeight = 0;
				setTimeout(apply, 200);
			});
			return () => {
				vv.removeEventListener('resize', scheduleApply);
				vv.removeEventListener('scroll', scheduleApply);
			};
		}
	});

	onMount(async () => {
		await authStore.initialize();

		// Respetar estado proveniente de SSR
		if (data?.isInstalled !== undefined) {
			isInstalled = !!data.isInstalled;
		} else {
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

		const needsSetup = data?.needsSetup;
		if (isInstalled && needsSetup && page.url.pathname !== '/setup') {
			installChecked = true;
			goto('/setup');
			return;
		}
		if (isInstalled && needsSetup === false && page.url.pathname === '/setup') {
			installChecked = true;
			goto('/login');
			return;
		}

		installChecked = true;

		// Marcar la sesión como inicializada para evitar pantallas de arranque repetitivas
		if (typeof sessionStorage !== 'undefined') {
			sessionStorage.setItem('vsocial_booted', '1');
			hasBootedInSession = true;
		}
		isHeavyLoading = false;

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
			if (!activeWheelListenerTarget) return;

			const maxScroll =
				activeWheelListenerTarget.scrollWidth - activeWheelListenerTarget.clientWidth;
			if (maxScroll <= 0) return;

			// Si el carrusel ya llegó al límite horizontal, no bloquear el scroll vertical de la página
			if (
				(activeWheelListenerTarget.scrollLeft <= 0 && e.deltaY < 0) ||
				(activeWheelListenerTarget.scrollLeft >= maxScroll && e.deltaY > 0)
			) {
				return;
			}

			e.preventDefault();

			scrollTarget += e.deltaY * 1.2;
			scrollTarget = Math.max(0, Math.min(scrollTarget, maxScroll));

			if (!isScrolling) {
				isScrolling = true;
				requestAnimationFrame(applyMomentum);
			}
		};

		// Delegación dinámica: Solo aplicamos "passive: false" al elemento bajo el cursor
		// Esto libera el hilo principal (compositor thread) para el scroll del resto de la página.
		let pointerRaf = null;
		let lastTarget = null;
		const pointerOverHandler = (e) => {
			if (e.target === lastTarget) return;
			lastTarget = e.target;
			if (pointerRaf) return;
			pointerRaf = requestAnimationFrame(() => {
				pointerRaf = null;
				const path = window.location.pathname;
				if (path === '/' || path === '/about/verified') {
					if (activeWheelListenerTarget) {
						activeWheelListenerTarget.removeEventListener('wheel', wheelHandler);
						activeWheelListenerTarget = null;
						isScrolling = false;
					}
					return;
				}

				const slider = lastTarget?.closest?.('.horizontal-wheel-slider, .story-slider');
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
			});
		};

		window.addEventListener('mouseover', pointerOverHandler);

		return () => {
			if (pointerRaf) cancelAnimationFrame(pointerRaf);
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
<FpsHud />
<RouteProgress />
{#if showBootScreen}
	<div class="vs-boot" data-vs-boot out:fade={{ duration: 450, easing: cubicOut }}>
		<!-- Bioluminescent ambient plasma glow -->
		<div class="vs-boot__backdrop-glow vs-boot__glow--cyan"></div>
		<div class="vs-boot__backdrop-glow vs-boot__glow--magenta"></div>
		<div class="vs-boot__backdrop-glow vs-boot__glow--teal"></div>

		<!-- Holographic Liquid-Glass Core -->
		<div class="vs-boot__core">
			<div class="vs-boot__prism"></div>
			<div class="vs-boot__orbit-ring"></div>
			<div class="vs-boot__orbit-ring vs-boot__orbit-ring--reverse"></div>

			<!-- Brand Emblem & Typography -->
			<div class="vs-boot__brand-group">
				<div class="vs-boot__emblem">
					<span class="vs-boot__emblem-glow"></span>
					<span class="vs-boot__emblem-mark">VS</span>
				</div>
				<div class="vs-boot__titles">
					<h1 class="vs-boot__brand">
						<span class="vs-boot__mark">VS</span><span class="vs-boot__suffix">ocial</span>
					</h1>
					<span class="vs-boot__tagline">NEXT-GEN CREATOR NETWORK</span>
				</div>
			</div>

			<!-- Dynamic Quantum Progress Meter -->
			<div class="vs-boot__meter">
				<div class="vs-boot__track">
					<div class="vs-boot__fill"></div>
					<div class="vs-boot__scanner"></div>
				</div>
				<div class="vs-boot__meta">
					<span class="vs-boot__live-dot"></span>
					<p class="vs-boot__status">
						{hasBootedInSession ? 'Cargando Datos...' : 'Sincronizando Entorno'}
					</p>
				</div>
			</div>
		</div>
	</div>
{:else if isAdminRoute}
	{@render children()}
{:else if authStore.isAuthenticated}
	<div
		class="vs-shell app-layout-container"
		class:vs-shell--collapsed={!uiStore.sidebarExpanded}
		class:sidebar-expanded={uiStore.sidebarExpanded}
		class:vs-shell--reels={isReelsRoute}
		style="--sidebar-width: {uiStore.sidebarExpanded ? '250px' : '80px'};"
	>
		<aside class="vs-shell__rail">
			<SideNav />
		</aside>

		<div class="vs-shell__stage">
			<!-- En /reels la página es inmersiva a pantalla completa: la TopBar global
				   se oculta para que no se cruce con los controles propios del reproductor. -->
			{#if !isReelsRoute}
				<TopBar />
			{/if}
			<main class="vs-shell__canvas">
				{@render children()}
			</main>
		</div>

		<MobileNav />
		<!-- Drawer overlay for collapsed sidebar on tablets -->
		<div
			class="vs-sidebar-drawer"
			class:open={uiStore.drawerOpen}
			role="button"
			tabindex="-1"
			aria-label="Cerrar menú de navegación"
			onclick={() => (uiStore.drawerOpen = false)}
			onkeydown={(e) => {
				if (e.key === 'Escape') uiStore.drawerOpen = false;
			}}
		>
			<aside class="vs-sidebar-drawer__panel">
				<SideNav />
			</aside>
		</div>
	</div>
{:else if isPublicRoute}
	{@render children()}
{/if}

<PwaPrompt />
<CookieBanner />
<MediaLightbox />
<ConfirmModal />
<LevelUpModal />

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
		background: radial-gradient(circle at 50% 50%, #061e2d 0%, #030f17 60%, #02090e 100%);
		isolation: isolate;
		z-index: 9999;
		overflow: hidden;
		animation: vsBootEnter 0.5s var(--ease-out) both;
	}

	.vs-boot__backdrop-glow {
		position: absolute;
		border-radius: 9999px;
		filter: blur(80px);
		pointer-events: none;
		opacity: 0.35;
		will-change: transform, opacity;
	}

	.vs-boot__glow--cyan {
		width: 480px;
		height: 480px;
		top: 15%;
		left: 20%;
		background: radial-gradient(circle, rgba(0, 229, 255, 0.45) 0%, transparent 70%);
		animation: bootFloatOrb1 12s ease-in-out infinite alternate;
	}

	.vs-boot__glow--magenta {
		width: 420px;
		height: 420px;
		bottom: 15%;
		right: 20%;
		background: radial-gradient(circle, rgba(236, 72, 153, 0.35) 0%, transparent 70%);
		animation: bootFloatOrb2 14s ease-in-out infinite alternate;
	}

	.vs-boot__glow--teal {
		width: 380px;
		height: 380px;
		bottom: 25%;
		left: 30%;
		background: radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, transparent 70%);
		animation: bootFloatOrb3 10s ease-in-out infinite alternate;
	}

	.vs-boot__core {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2.25rem;
		padding: 3.25rem 4rem;
		border-radius: 28px;
		background: rgba(12, 35, 55, 0.65);
		backdrop-filter: blur(24px) saturate(1.35);
		-webkit-backdrop-filter: blur(24px) saturate(1.35);
		border: 1px solid rgba(255, 255, 255, 0.16);
		box-shadow:
			0 24px 64px -12px rgba(0, 0, 0, 0.65),
			0 0 35px rgba(0, 229, 255, 0.15),
			inset 0 1px 2px rgba(255, 255, 255, 0.4),
			inset 0 -1px 2px rgba(0, 229, 255, 0.2);
		overflow: hidden;
		animation: vsCoreFloat 0.75s var(--ease-spring) both;
		z-index: 10;
		max-width: 90vw;
	}

	.vs-boot__core::before {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--noise-texture);
		opacity: 0.035;
		pointer-events: none;
	}

	.vs-boot__prism {
		position: absolute;
		top: -50%;
		left: 50%;
		width: 200%;
		height: 80%;
		transform: translateX(-50%);
		background: radial-gradient(
			ellipse at 50% 50%,
			rgba(0, 229, 255, 0.16) 0%,
			rgba(16, 185, 129, 0.08) 40%,
			rgba(236, 72, 153, 0.04) 65%,
			transparent 80%
		);
		pointer-events: none;
	}

	.vs-boot__orbit-ring {
		position: absolute;
		inset: -40%;
		border-radius: 48%;
		border: 1px dashed rgba(0, 229, 255, 0.12);
		animation: bootOrbit 20s linear infinite;
		pointer-events: none;
	}

	.vs-boot__orbit-ring--reverse {
		inset: -35%;
		border-radius: 46%;
		border: 1px dotted rgba(236, 72, 153, 0.1);
		animation: bootOrbit 28s linear infinite reverse;
	}

	.vs-boot__brand-group {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		position: relative;
		z-index: 2;
	}

	.vs-boot__emblem {
		position: relative;
		width: 64px;
		height: 64px;
		border-radius: 18px;
		background: linear-gradient(135deg, rgba(0, 229, 255, 0.2) 0%, rgba(16, 185, 129, 0.1) 100%);
		border: 1px solid rgba(0, 229, 255, 0.4);
		box-shadow:
			0 8px 24px rgba(0, 229, 255, 0.25),
			inset 0 1px 2px rgba(255, 255, 255, 0.6);
		display: grid;
		place-items: center;
		overflow: hidden;
	}

	.vs-boot__emblem-glow {
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.6) 0%, transparent 60%);
		pointer-events: none;
	}

	.vs-boot__emblem-mark {
		font-family: var(--font-display);
		font-weight: 900;
		font-size: 1.75rem;
		letter-spacing: -0.05em;
		background: linear-gradient(135deg, #ffffff 0%, #00e5ff 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.vs-boot__titles {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.vs-boot__brand {
		position: relative;
		font-family: var(--font-display);
		font-weight: 900;
		font-size: clamp(2.5rem, 6vw, 3.5rem);
		letter-spacing: -0.03em;
		color: #ffffff;
		margin: 0;
		line-height: 1;
	}

	.vs-boot__mark {
		background: var(--accent-gradient);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		text-shadow: 0 0 24px rgba(0, 229, 255, 0.4);
	}

	.vs-boot__suffix {
		color: #ffffff;
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
	}

	.vs-boot__tagline {
		font-family: var(--font-display);
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.25em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.5);
	}

	.vs-boot__meter {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		width: 100%;
		max-width: 260px;
		position: relative;
		z-index: 2;
	}

	.vs-boot__track {
		position: relative;
		width: 100%;
		height: 5px;
		border-radius: 9999px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.1);
		overflow: hidden;
		box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.5);
	}

	.vs-boot__fill {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: linear-gradient(90deg, #00e5ff 0%, #10b981 50%, #ec4899 100%);
		background-size: 200% 100%;
		animation: vsPulseSweep 1.8s ease-in-out infinite;
		box-shadow: 0 0 12px rgba(0, 229, 255, 0.6);
	}

	.vs-boot__scanner {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 40px;
		background: linear-gradient(
			90deg,
			transparent 0%,
			rgba(255, 255, 255, 0.8) 50%,
			transparent 100%
		);
		animation: bootScannerSweep 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
	}

	.vs-boot__meta {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.vs-boot__live-dot {
		width: 7px;
		height: 7px;
		border-radius: 9999px;
		background: #00e5ff;
		box-shadow:
			0 0 10px #00e5ff,
			0 0 16px #00e5ff;
		animation: vsDotPulse 1.2s ease-in-out infinite alternate;
	}

	.vs-boot__status {
		margin: 0;
		font-family: var(--font-display);
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.75);
	}

	.vs-shell {
		--sidebar-width: 250px;
		display: flex;
		min-height: 100vh;
		position: relative;
		box-sizing: border-box;
	}

	.vs-shell.vs-shell--collapsed {
		--sidebar-width: 80px;
	}

	.vs-shell.sidebar-expanded {
		--sidebar-width: 250px;
	}

	.vs-shell__rail {
		width: var(--sidebar-width, 80px);
		flex-shrink: 0;
		position: sticky;
		top: 0;
		height: 100vh;
		display: none;
		flex-direction: column;
		/* z-index elevado para que el sidenav siempre quede sobre el contenido
		   (PostCard hover llega a z-index:40, esta a 100 evita la colisión) */
		z-index: 100;
		transition: width 0.26s cubic-bezier(0.22, 1, 0.36, 1);
		will-change: width;
		contain: layout paint;
		box-sizing: border-box;
	}

	.vs-shell--collapsed .vs-shell__rail {
		width: var(--sidebar-width, 80px);
	}

	.vs-shell__stage {
		flex: 1 1 0%;
		display: flex;
		flex-direction: column;
		min-width: 0;
		/* Crea un stacking context aislado: los z-index del contenido
		   (PostCard, modales, etc.) no escapan al stacking context del shell */
		isolation: isolate;
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
			transform: translateY(18px) scale(0.94);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@keyframes vsPulseSweep {
		0% {
			background-position: 0% 50%;
		}
		50% {
			background-position: 100% 50%;
		}
		100% {
			background-position: 0% 50%;
		}
	}

	@keyframes bootScannerSweep {
		0% {
			left: -40px;
		}
		100% {
			left: 100%;
		}
	}

	@keyframes bootOrbit {
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes vsDotPulse {
		0% {
			transform: scale(0.85);
			opacity: 0.6;
		}
		100% {
			transform: scale(1.2);
			opacity: 1;
		}
	}

	@keyframes bootFloatOrb1 {
		0% {
			transform: translate(0, 0) scale(1);
		}
		100% {
			transform: translate(40px, 30px) scale(1.1);
		}
	}

	@keyframes bootFloatOrb2 {
		0% {
			transform: translate(0, 0) scale(1);
		}
		100% {
			transform: translate(-35px, -25px) scale(1.08);
		}
	}

	@keyframes bootFloatOrb3 {
		0% {
			transform: translate(0, 0) scale(1);
		}
		100% {
			transform: translate(25px, -35px) scale(1.05);
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
