<script>
	import { fade, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { onMount } from 'svelte';

	let _isMounted = $state(false);

	// Navigation anchor tracking
	let activeSection = $state('hero');

	// Active tab in Ecosystem Explorer
	let activeEcosystemTab = $state('feed'); // 'feed' | 'realtime' | 'market' | 'gamification' | 'verified'

	// Interactive Mood Scroller state
	let selectedMood = $state('vibing');
	const moods = [
		{ id: 'vibing', label: '🎧 Vibing', desc: 'Sintiendo el ritmo' },
		{ id: 'creative', label: '🎨 Creativo', desc: 'Dibujando / Modelando' },
		{ id: 'gaming', label: '🎮 En Directo', desc: 'Jugando con el chat' },
		{ id: 'hype', label: '🔥 On Fire', desc: '¡Nuevo récord!' },
		{ id: 'chill', label: '🌙 Chill', desc: 'Descanso nocturno' }
	];

	// Interactive Gamification / XP Simulator
	let simulatedXp = $state(4250);
	let simulatedStreak = $state(18);

	let calculatedLevel = $derived(Math.floor(simulatedXp / 500) + 1);
	let currentLevelProgress = $derived(Math.min(100, Math.floor(((simulatedXp % 500) / 500) * 100)));
	let rankTitle = $derived.by(() => {
		if (calculatedLevel < 5) return 'Novato Astral 🌟';
		if (calculatedLevel < 10) return 'Creador Emergente 🚀';
		if (calculatedLevel < 20) return 'Maestro Holográfico 💎';
		return 'Leyenda Neo-Aero 👑';
	});

	// Interactive Marketplace P2P Economy Simulator
	let commissionPrice = $state(150);
	let vsocialTake = $derived((0).toFixed(2));
	let creatorGets = $derived(Number(commissionPrice).toFixed(2));
	let legacyPlatformTake = $derived((commissionPrice * 0.3).toFixed(2));
	let legacyCreatorGets = $derived((commissionPrice * 0.7).toFixed(2));

	// Realtime Simulation State
	let chatMessages = $state([
		{
			id: 1,
			user: 'Aria_Live2D',
			text: '¡El nuevo rig 3D ya está listo para el stream de hoy! ✨',
			time: '12:04'
		},
		{
			id: 2,
			user: 'Kuro_Streamer',
			text: '¡Quedó increíble! Probando la llamada WebRTC de baja latencia 🚀',
			time: '12:05'
		}
	]);
	let newChatInput = $state('');

	function handleSendChatMessage() {
		if (!newChatInput.trim()) return;
		chatMessages = [
			...chatMessages,
			{
				id: Date.now(),
				user: 'Tú',
				text: newChatInput.trim(),
				time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			}
		];
		newChatInput = '';
	}

	// Interactive FAQ Accordion State
	let openFaq = $state(0); // 0-indexed opened item

	function toggleFaq(index) {
		openFaq = openFaq === index ? -1 : index;
	}

	const faqs = [
		{
			q: '¿Qué es V-SOCIAL y por qué nació?',
			a: 'V-SOCIAL es una red social y plataforma de creadores de próxima generación, concebida específicamente para VTubers, streamers, ilustradores, modeladores 3D y comunidades virtuales. Nació como respuesta al minimalismo estéril de las redes tradicionales y a las políticas abusivas de comisiones y algoritmos opacos.'
		},
		{
			q: '¿Cómo funciona la economía de creadores y comisiones?',
			a: 'V-SOCIAL opera bajo un modelo de economía 100% P2P (Peer-to-Peer) sin intermediación financiera ni custodia de fondos. Los creadores y artistas conectan directamente sus métodos de cobro externos (PayPal, Ko-fi, Patreon) en su perfil y reciben el 100% de sus ingresos directos con 0% de comisiones por parte de la plataforma.'
		},
		{
			q: '¿Cómo obtengo una insignia de verificación?',
			a: 'Contamos con una jerarquía de verificación transparente y pública con categorías especializadas para Creadores/Artistas, Streamers/VTubers, Organizaciones y Personalidades. Puedes consultar los requisitos y postularte desde nuestro portal de verificación en /about/verified.'
		},
		{
			q: '¿Qué tecnologías impulsan la velocidad extrema de V-SOCIAL?',
			a: 'Utilizamos SvelteKit 5 con Runes nativos ($state, $derived) para una reactividad quirúrgica en el DOM sin sobrecarga de Virtual DOM, acoplado a SQLite 3 en modo WAL (Write-Ahead Logging) para lecturas O(1) concurrentes, Socket.IO para eventos en tiempo real y WebRTC para llamadas P2P de voz y video en alta fidelidad.'
		},
		{
			q: '¿Cómo protege V-SOCIAL mi privacidad y datos personales?',
			a: 'Adoptamos arquitectura Zero-Trust y cumplimiento estricto del RGPD europeo: cero cookies de rastreo publicitario de terceros, derecho a la portabilidad (exportación de todos tus datos en JSON en 1 clic) y derecho al olvido con eliminación irreversible automatizada.'
		},
		{
			q: '¿V-SOCIAL funciona en dispositivos móviles?',
			a: 'Sí. Toda la interfaz está construida con diseño responsive fluido, escudos volumétricos contra el colapso táctil y soporte PWA (Progressive Web App) para instalarse como aplicación nativa en iOS, Android y escritorio con rendimiento de 60 FPS.'
		}
	];

	// Specular lighting handler for interactive cards
	function handleCardMouseMove(e) {
		const card = e.currentTarget;
		const rect = card.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		card.style.setProperty('--mouse-x', `${x}px`);
		card.style.setProperty('--mouse-y', `${y}px`);
	}

	onMount(() => {
		_isMounted = true;
	});
</script>

<svelte:head>
	<title>Sobre V-SOCIAL - Manifiesto, Ecosistema y Arquitectura</title>
	<meta
		name="description"
		content="Conoce V-SOCIAL: la red social de próxima generación para VTubers, streamers, artistas y comunidades virtuales con estética Glassmorphism 2.0, Svelte 5 y rendimiento extremo."
	/>
</svelte:head>

<div class="about-page-wrapper">
	<!-- Quick Floating Anchor Navigation -->
	<nav class="quick-nav-pill glass-card" aria-label="Navegación de secciones">
		<a
			href="#mision"
			class="nav-link {activeSection === 'mision' ? 'active' : ''}"
			onclick={() => (activeSection = 'mision')}
		>
			<span class="material-icons-round">auto_awesome</span>
			<span>Misión</span>
		</a>
		<a
			href="#ecosistema"
			class="nav-link {activeSection === 'ecosistema' ? 'active' : ''}"
			onclick={() => (activeSection = 'ecosistema')}
		>
			<span class="material-icons-round">hub</span>
			<span>Ecosistema</span>
		</a>
		<a
			href="#arquitectura"
			class="nav-link {activeSection === 'arquitectura' ? 'active' : ''}"
			onclick={() => (activeSection = 'arquitectura')}
		>
			<span class="material-icons-round">memory</span>
			<span>Arquitectura</span>
		</a>
		<a
			href="#creadores"
			class="nav-link {activeSection === 'creadores' ? 'active' : ''}"
			onclick={() => (activeSection = 'creadores')}
		>
			<span class="material-icons-round">groups</span>
			<span>Creadores</span>
		</a>
		<a
			href="#seguridad"
			class="nav-link {activeSection === 'seguridad' ? 'active' : ''}"
			onclick={() => (activeSection = 'seguridad')}
		>
			<span class="material-icons-round">verified_user</span>
			<span>Seguridad</span>
		</a>
		<a
			href="#faq"
			class="nav-link {activeSection === 'faq' ? 'active' : ''}"
			onclick={() => (activeSection = 'faq')}
		>
			<span class="material-icons-round">help_outline</span>
			<span>FAQ</span>
		</a>
		<a href="#unirse" class="nav-link cta-pill" onclick={() => (activeSection = 'unirse')}>
			<span class="material-icons-round">rocket_launch</span>
			<span>Unirse</span>
		</a>
	</nav>

	<main class="about-main-content" in:fade={{ duration: 500 }}>
		<!-- ══════════════════════════════════════════════════════════════════ -->
		<!-- 1. HERO SECTION                                                  -->
		<!-- ══════════════════════════════════════════════════════════════════ -->
		<section
			id="hero"
			class="hero-showcase aero-glass"
			role="presentation"
			onmousemove={handleCardMouseMove}
		>
			<div class="hero-ambient-glow"></div>
			<div class="hero-mesh-overlay"></div>

			<div class="hero-badge-pill">
				<span class="badge-dot"></span>
				<span class="badge-text font-bold"
					>V-SOCIAL v3.0 • Ecosistema Digital de Próxima Generación</span
				>
			</div>

			<h1 class="hero-headline">
				El Ecosistema Social y Creativo <br />
				<span class="hero-gradient-text">Sin Filtros Corporativos</span>
			</h1>

			<p class="hero-lead">
				Diseñado desde cero para <strong>VTubers, streamers, artistas digitales</strong> y sus
				comunidades. Fusionamos la profundidad visual del <em>Glassmorphism 2.0</em> con la
				velocidad implacable de <em>SvelteKit 5 + SQLite WAL</em>.
			</p>

			<!-- Live Telemetry Badges -->
			<div class="hero-metrics-bar">
				<div class="metric-pill">
					<span class="metric-icon material-icons-round text-emerald">bolt</span>
					<div class="metric-info">
						<span class="metric-val">&lt; 1 ms</span>
						<span class="metric-lbl">Reactividad DOM</span>
					</div>
				</div>
				<div class="metric-divider"></div>
				<div class="metric-pill">
					<span class="metric-icon material-icons-round text-cyan">speed</span>
					<div class="metric-info">
						<span class="metric-val">60 FPS</span>
						<span class="metric-lbl">Fluidez GPU</span>
					</div>
				</div>
				<div class="metric-divider"></div>
				<div class="metric-pill">
					<span class="metric-icon material-icons-round text-rose">lock</span>
					<div class="metric-info">
						<span class="metric-val">Zero-Trust</span>
						<span class="metric-lbl">RGPD & Soberanía</span>
					</div>
				</div>
				<div class="metric-divider"></div>
				<div class="metric-pill">
					<span class="metric-icon material-icons-round text-amber">savings</span>
					<div class="metric-info">
						<span class="metric-val">100% Ingresos</span>
						<span class="metric-lbl">0% Comisiones P2P</span>
					</div>
				</div>
			</div>

			<!-- Hero CTAs -->
			<div class="hero-action-group">
				<a href="/feed" class="btn-aero-primary btn-hero-main">
					<span class="material-icons-round">explore</span>
					<span>Explorar el Feed</span>
				</a>
				<a href="/about/verified" class="btn-aero-secondary btn-hero-sub">
					<span class="material-icons-round text-cyan">verified</span>
					<span>Verificaciones Oficiales</span>
				</a>
				<a href="#ecosistema" class="btn-aero-ghost btn-hero-demo">
					<span class="material-icons-round">smart_toy</span>
					<span>Demo Interactiva</span>
				</a>
			</div>
		</section>

		<!-- ══════════════════════════════════════════════════════════════════ -->
		<!-- 2. EL MANIFIESTO (PILARES FUNDAMENTALES)                         -->
		<!-- ══════════════════════════════════════════════════════════════════ -->
		<section id="mision" class="manifesto-section">
			<div class="section-header">
				<div class="section-eyebrow">
					<span class="material-icons-round">flag</span>
					<span>Nuestra Filosofía</span>
				</div>
				<h2 class="section-title">El Manifiesto V-Social</h2>
				<p class="section-subtitle">
					Rechazamos el minimalismo estéril y los algoritmos diseñados para la retención tóxica.
					Construimos software con alma, rendimiento y respeto.
				</p>
			</div>

			<div class="manifesto-grid">
				<!-- Pillar 1 -->
				<div
					class="glass-card pillar-card"
					role="presentation"
					onmousemove={handleCardMouseMove}
					in:fade={{ duration: 400, delay: 100 }}
				>
					<div
						class="pillar-icon-box bg-cyan-glass"
						style="flex: 0 0 54px; min-width: 54px; min-height: 54px;"
					>
						<span class="material-icons-round text-cyan">blur_on</span>
					</div>
					<h3 class="pillar-heading">Estética Glassmorphism 2.0</h3>
					<p class="pillar-body">
						La interfaz vuelve a ser tangible. Desenfocado multicapa (<code class="code-tag"
							>backdrop-filter</code
						>), saturación dinámica, sombras de neón del color primario y micro-física de resorte
						con <code class="code-tag">--ease-spring</code>.
					</p>
					<div class="pillar-tag text-cyan">Experiencia Visceral</div>
				</div>

				<!-- Pillar 2 -->
				<div
					class="glass-card pillar-card"
					role="presentation"
					onmousemove={handleCardMouseMove}
					in:fade={{ duration: 400, delay: 200 }}
				>
					<div
						class="pillar-icon-box bg-emerald-glass"
						style="flex: 0 0 54px; min-width: 54px; min-height: 54px;"
					>
						<span class="material-icons-round text-emerald">bolt</span>
					</div>
					<h3 class="pillar-heading">Rendimiento Extremo</h3>
					<p class="pillar-body">
						Impulsado por <strong>Svelte 5 Runes</strong> y base de datos SQLite transaccional con
						<strong>Write-Ahead Logging (WAL)</strong>. Cada consulta preparada se ejecuta en
						sub-milisegundos, sin frameworks pesados ni latencia oculta.
					</p>
					<div class="pillar-tag text-emerald">Reactividad Quirúrgica</div>
				</div>

				<!-- Pillar 3 -->
				<div
					class="glass-card pillar-card"
					role="presentation"
					onmousemove={handleCardMouseMove}
					in:fade={{ duration: 400, delay: 300 }}
				>
					<div
						class="pillar-icon-box bg-amber-glass"
						style="flex: 0 0 54px; min-width: 54px; min-height: 54px;"
					>
						<span class="material-icons-round text-amber">monetization_on</span>
					</div>
					<h3 class="pillar-heading">Soberanía Creativa</h3>
					<p class="pillar-body">
						Marketplace nativo de activos (modelos Live2D, 3D, emotes, overlays) y servicios
						freelance sin intermediarios financieros. Tú decides el valor de tu arte y recibes el
						100% de tus ingresos vía pagos directos P2P (PayPal, Ko-fi, Patreon).
					</p>
					<div class="pillar-tag text-amber">Economía 100% P2P</div>
				</div>

				<!-- Pillar 4 -->
				<div
					class="glass-card pillar-card"
					role="presentation"
					onmousemove={handleCardMouseMove}
					in:fade={{ duration: 400, delay: 400 }}
				>
					<div
						class="pillar-icon-box bg-rose-glass"
						style="flex: 0 0 54px; min-width: 54px; min-height: 54px;"
					>
						<span class="material-icons-round text-rose">privacy_tip</span>
					</div>
					<h3 class="pillar-heading">Privacidad & RGPD Nativo</h3>
					<p class="pillar-body">
						Tus datos son tuyos. Cumplimiento estricto con exportación completa en 1-clic (<code
							class="code-tag">/api/users/export</code
						>), cero píxeles de rastreo publicitario de terceros y derecho al olvido automatizado.
					</p>
					<div class="pillar-tag text-rose">Zero-Trust Real</div>
				</div>
			</div>
		</section>

		<!-- ══════════════════════════════════════════════════════════════════ -->
		<!-- 3. EXPLORADOR INTERACTIVO DEL ECOSISTEMA                         -->
		<!-- ══════════════════════════════════════════════════════════════════ -->
		<section id="ecosistema" class="ecosystem-section">
			<div class="section-header">
				<div class="section-eyebrow">
					<span class="material-icons-round">widgets</span>
					<span>Funcionalidades Vivas</span>
				</div>
				<h2 class="section-title">Explora el Ecosistema V-Social</h2>
				<p class="section-subtitle">
					Interactúa con los componentes reales de la plataforma. Diseñados para potenciar la
					expresión, la comunidad y el crecimiento de creadores.
				</p>
			</div>

			<!-- Tab Switcher Bar -->
			<div class="ecosystem-tabs-bar glass-card">
				<button
					class="eco-tab-btn {activeEcosystemTab === 'feed' ? 'active' : ''}"
					onclick={() => (activeEcosystemTab = 'feed')}
				>
					<span class="material-icons-round">dynamic_feed</span>
					<span>Feed & Moods</span>
				</button>
				<button
					class="eco-tab-btn {activeEcosystemTab === 'realtime' ? 'active' : ''}"
					onclick={() => (activeEcosystemTab = 'realtime')}
				>
					<span class="material-icons-round">forum</span>
					<span>Chat & WebRTC</span>
				</button>
				<button
					class="eco-tab-btn {activeEcosystemTab === 'market' ? 'active' : ''}"
					onclick={() => (activeEcosystemTab = 'market')}
				>
					<span class="material-icons-round">storefront</span>
					<span>Marketplace</span>
				</button>
				<button
					class="eco-tab-btn {activeEcosystemTab === 'gamification' ? 'active' : ''}"
					onclick={() => (activeEcosystemTab = 'gamification')}
				>
					<span class="material-icons-round">military_tech</span>
					<span>Gamificación</span>
				</button>
				<button
					class="eco-tab-btn {activeEcosystemTab === 'verified' ? 'active' : ''}"
					onclick={() => (activeEcosystemTab = 'verified')}
				>
					<span class="material-icons-round">verified</span>
					<span>Verificación</span>
				</button>
			</div>

			<!-- Dynamic Tab Content -->
			<div class="ecosystem-tab-viewport glass-panel aero-card">
				<!-- TAB 1: FEED & CREATION -->
				{#if activeEcosystemTab === 'feed'}
					<div class="tab-pane" in:fade={{ duration: 300 }}>
						<div class="tab-pane-grid">
							<div class="tab-info-col">
								<span class="pill-mini text-cyan">Publicación Multiformato</span>
								<h3 class="tab-title">Posts Expresivos con Estados de Ánimo</h3>
								<p class="tab-desc">
									El selector <strong>Mood Scroller</strong> permite etiquetar tus estados de ánimo con
									física de arrastre inercial. Añade encuestas en tiempo real, reproductores de audio/video
									nativos, embeds de alta calidad y etiquetas contextuales.
								</p>
								<ul class="feature-bullets">
									<li>
										<span class="material-icons-round text-cyan">check_circle</span>
										Soporte para imágenes HD sin compresión destructiva
									</li>
									<li>
										<span class="material-icons-round text-cyan">check_circle</span>
										Reproductor multimedia integrado con controles Neo-Aero
									</li>
									<li>
										<span class="material-icons-round text-cyan">check_circle</span>
										Encuestas instantáneas con actualización por WebSocket
									</li>
								</ul>
							</div>

							<!-- Interactive Interactive Mockup: Feed -->
							<div class="tab-demo-col">
								<div class="mock-post-card glass-card">
									<div class="mock-post-header">
										<div
											class="mock-avatar-shield"
											style="flex: 0 0 44px; min-width: 44px; min-height: 44px;"
										>
											<img
												src="/uploads/avatars/avatar_1_1784999564684.jpg"
												alt="Avatar de demo"
												class="mock-avatar"
											/>
										</div>
										<div class="mock-user-meta">
											<div class="mock-user-name">
												<span>Aria Live2D</span>
												<span class="mock-verified-badge material-icons-round">verified</span>
											</div>
											<span class="mock-handle">@Aria_Art • Hace 5 min</span>
										</div>
										<div class="mock-mood-badge">
											{moods.find((m) => m.id === selectedMood)?.label}
										</div>
									</div>

									<div class="mock-post-body">
										<p>
											¡Terminando los últimos detalles del modelo VTuber para el stream de este
											viernes! ✨🎨 ¿Les gusta la iluminación aero?
										</p>
									</div>

									<!-- Interactive Mood Selector Simulation -->
									<div class="mood-selector-bar">
										<span class="mood-bar-label">Prueba un estado de ánimo:</span>
										<div class="mood-chips-scroller">
											{#each moods as m}
												<button
													class="mood-chip {selectedMood === m.id ? 'selected' : ''}"
													onclick={() => (selectedMood = m.id)}
												>
													{m.label}
												</button>
											{/each}
										</div>
									</div>

									<div class="mock-post-actions">
										<div class="mock-action-btn text-rose">
											<span class="material-icons-round">favorite</span>
											<span>142</span>
										</div>
										<div class="mock-action-btn text-cyan">
											<span class="material-icons-round">chat_bubble_outline</span>
											<span>28</span>
										</div>
										<div class="mock-action-btn text-emerald">
											<span class="material-icons-round">repeat</span>
											<span>15</span>
										</div>
										<div class="mock-action-btn">
											<span class="material-icons-round">bookmark_border</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				{/if}

				<!-- TAB 2: REALTIME & WEBRTC -->
				{#if activeEcosystemTab === 'realtime'}
					<div class="tab-pane" in:fade={{ duration: 300 }}>
						<div class="tab-pane-grid">
							<div class="tab-info-col">
								<span class="pill-mini text-emerald">Socket.IO + WebRTC</span>
								<h3 class="tab-title">Mensajería Instantánea & Llamadas P2P</h3>
								<p class="tab-desc">
									Sin servidores intermedios de voz pesados. Las llamadas de voz y video se
									establecen directamente entre navegadores vía <strong>WebRTC</strong> con cifrado de
									punto a punto, acompañadas de zumbidos hápticos, notas de voz y presencia en vivo.
								</p>
								<ul class="feature-bullets">
									<li>
										<span class="material-icons-round text-emerald">check_circle</span>
										Latencia ultra-baja garantizada por Socket.IO en memoria
									</li>
									<li>
										<span class="material-icons-round text-emerald">check_circle</span>
										Llamadas de voz y video HD sin compresión destructiva
									</li>
									<li>
										<span class="material-icons-round text-emerald">check_circle</span>
										Zumbidos MSN retro-modernizados con animación física
									</li>
								</ul>
							</div>

							<!-- Interactive Mockup: Realtime Chat -->
							<div class="tab-demo-col">
								<div class="mock-chat-card glass-card">
									<div class="mock-chat-topbar">
										<div class="chat-status-indicator online"></div>
										<span class="chat-peer-name">Sala de Voz #creadores-live</span>
										<div class="chat-webrtc-pill">
											<span class="material-icons-round text-emerald">call</span>
											<span>HD P2P Activo</span>
										</div>
									</div>

									<div class="mock-chat-feed">
										{#each chatMessages as msg (msg.id)}
											<div class="mock-bubble {msg.user === 'Tú' ? 'outgoing' : 'incoming'}">
												<div class="bubble-sender">{msg.user}</div>
												<div class="bubble-text">{msg.text}</div>
												<div class="bubble-time">{msg.time}</div>
											</div>
										{/each}
									</div>

									<form
										class="mock-chat-input-bar"
										onsubmit={(e) => {
											e.preventDefault();
											handleSendChatMessage();
										}}
									>
										<input
											type="text"
											bind:value={newChatInput}
											placeholder="Escribe un mensaje de prueba..."
											class="mock-text-input"
										/>
										<button
											type="submit"
											class="btn-aero-primary btn-icon-send"
											style="flex: 0 0 38px; min-width: 38px; min-height: 38px;"
										>
											<span class="material-icons-round">send</span>
										</button>
									</form>
								</div>
							</div>
						</div>
					</div>
				{/if}

				<!-- TAB 3: MARKETPLACE & GIGS -->
				{#if activeEcosystemTab === 'market'}
					<div class="tab-pane" in:fade={{ duration: 300 }}>
						<div class="tab-pane-grid">
							<div class="tab-info-col">
								<span class="pill-mini text-amber">Economía para Creadores</span>
								<h3 class="tab-title">Marketplace & Pagos P2P Directos</h3>
								<p class="tab-desc">
									Publica ofertas de rigging Live2D, diseño de overlays, emotes personalizados o
									música para directos. V-SOCIAL opera bajo un modelo 100% P2P:
									<strong>100% para ti</strong> mediante tu PayPal, Ko-fi o Patreon, con
									<strong>0% de comisión</strong> por parte de la plataforma.
								</p>

								<!-- Calculator Box -->
								<div class="calc-box glass-card">
									<div class="calc-label-row">
										<span>Precio de tu Trabajo ($ USD):</span>
										<span class="calc-val font-bold">${commissionPrice}</span>
									</div>
									<input
										type="range"
										min="10"
										max="1000"
										step="10"
										bind:value={commissionPrice}
										class="calc-slider"
									/>

									<div class="calc-comparison">
										<div class="calc-side vsocial">
											<span class="calc-platform-name">V-SOCIAL (0% P2P)</span>
											<span class="calc-payout">${creatorGets}</span>
											<span class="calc-sub">Recibes directo (comisión: ${vsocialTake})</span>
										</div>
										<div class="calc-vs">vs</div>
										<div class="calc-side legacy">
											<span class="calc-platform-name">Otras Plataformas (30%)</span>
											<span class="calc-payout strike">${legacyCreatorGets}</span>
											<span class="calc-sub">Pierdes ${legacyPlatformTake} en retenciones</span>
										</div>
									</div>
								</div>
							</div>

							<!-- Interactive Mockup: Creator Asset Cards -->
							<div class="tab-demo-col">
								<div class="mock-gigs-grid">
									<div class="mock-gig-card glass-card">
										<div class="gig-category text-cyan">Live2D Rigging</div>
										<h4 class="gig-title">Modelo VTuber 2D con Físicas Avanzadas</h4>
										<div class="gig-seller">@RigMaster • 5.0 ⭐ (42)</div>
										<div class="gig-footer">
											<span class="gig-price">$280 USD</span>
											<span class="gig-tag">Entrega 7 días</span>
										</div>
									</div>

									<div class="mock-gig-card glass-card">
										<div class="gig-category text-amber">Stream Overlays</div>
										<h4 class="gig-title">Pack Completo Neo-Aero para Twitch/Kick</h4>
										<div class="gig-seller">@DesignVibe • 4.9 ⭐ (89)</div>
										<div class="gig-footer">
											<span class="gig-price">$45 USD</span>
											<span class="gig-tag">Descarga Inmediata</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				{/if}

				<!-- TAB 4: GAMIFICACIÓN & XP -->
				{#if activeEcosystemTab === 'gamification'}
					<div class="tab-pane" in:fade={{ duration: 300 }}>
						<div class="tab-pane-grid">
							<div class="tab-info-col">
								<span class="pill-mini text-rose">Recompensas Reales</span>
								<h3 class="tab-title">Niveles, Títulos y Rachas de Check-in</h3>
								<p class="tab-desc">
									Cada post, comentario e interacción premia tu lealtad con puntos de experiencia
									(XP). Sube de nivel para desbloquear cosméticos visuales, títulos prestigiosos y
									posiciones destacadas en el Leaderboard global.
								</p>

								<!-- XP Simulator -->
								<div class="xp-sim-box glass-card">
									<div class="xp-sim-header">
										<span>Simulador de Experiencia:</span>
										<span class="xp-count">{simulatedXp} XP</span>
									</div>
									<input
										type="range"
										min="0"
										max="15000"
										step="250"
										bind:value={simulatedXp}
										class="calc-slider"
									/>
									<div class="streak-counter">
										<span class="material-icons-round text-amber">local_fire_department</span>
										<span>Racha Activa: <strong>{simulatedStreak} días consecutivos</strong></span>
									</div>
								</div>
							</div>

							<!-- Interactive Gamification Card -->
							<div class="tab-demo-col">
								<div class="gamification-preview-card glass-card aero-card">
									<div class="level-badge-circle">
										<span class="level-num">{calculatedLevel}</span>
										<span class="level-lbl">NIVEL</span>
									</div>

									<div class="user-rank-info">
										<h4 class="rank-name">{rankTitle}</h4>
										<span class="rank-sub">Progreso hacia el siguiente nivel</span>
									</div>

									<!-- XP Progress Bar -->
									<div class="xp-bar-container">
										<div class="xp-bar-fill" style="width: {currentLevelProgress}%"></div>
									</div>
									<div class="xp-bar-meta">
										<span>{simulatedXp % 500} / 500 XP</span>
										<span>{currentLevelProgress}%</span>
									</div>

									<div class="unlocked-perks-grid">
										<div class="perk-pill active">
											<span class="material-icons-round text-emerald">check</span>
											<span>Insignia de Perfil</span>
										</div>
										<div class="perk-pill {calculatedLevel >= 5 ? 'active' : 'locked'}">
											<span class="material-icons-round"
												>{calculatedLevel >= 5 ? 'check' : 'lock'}</span
											>
											<span>Borde Luminoso</span>
										</div>
										<div class="perk-pill {calculatedLevel >= 10 ? 'active' : 'locked'}">
											<span class="material-icons-round"
												>{calculatedLevel >= 10 ? 'check' : 'lock'}</span
											>
											<span>Título Personalizado</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				{/if}

				<!-- TAB 5: JERARQUÍA DE VERIFICACIÓN -->
				{#if activeEcosystemTab === 'verified'}
					<div class="tab-pane" in:fade={{ duration: 300 }}>
						<div class="tab-pane-grid">
							<div class="tab-info-col">
								<span class="pill-mini text-cyan">Autenticidad & Prestigio</span>
								<h3 class="tab-title">Jerarquía de Verificación Transparente</h3>
								<p class="tab-desc">
									En V-SOCIAL, las insignias no se compran con suscripciones vacías. Cada insignia
									representa un rol verificado en la comunidad con estándares y revisión humana.
								</p>
								<div class="verification-ctas">
									<a href="/about/verified" class="btn-aero-primary">
										<span class="material-icons-round">verified</span>
										<span>Ver Jerarquía Completa</span>
									</a>
									<a href="/about/verified/apply" class="btn-aero-secondary">
										<span class="material-icons-round">assignment_turned_in</span>
										<span>Postular mi Perfil</span>
									</a>
								</div>
							</div>

							<!-- Badges Showcase Grid -->
							<div class="tab-demo-col">
								<div class="badges-showcase-grid">
									<div class="badge-item-card glass-card">
										<span class="material-icons-round badge-icon text-amber"
											>admin_panel_settings</span
										>
										<div class="badge-info">
											<div class="badge-title text-amber">Staff & Admin</div>
											<div class="badge-desc">Ingeniería y arquitectura central</div>
										</div>
									</div>
									<div class="badge-item-card glass-card">
										<span class="material-icons-round badge-icon text-emerald">security</span>
										<div class="badge-info">
											<div class="badge-title text-emerald">Moderación Oficial</div>
											<div class="badge-desc">Seguridad y convivencia comunitaria</div>
										</div>
									</div>
									<div class="badge-item-card glass-card">
										<span class="material-icons-round badge-icon text-cyan">verified</span>
										<div class="badge-info">
											<div class="badge-title text-cyan">VTubers & Streamers</div>
											<div class="badge-desc">Creadores en directo y producción 2D/3D</div>
										</div>
									</div>
									<div class="badge-item-card glass-card">
										<span class="material-icons-round badge-icon text-rose">palette</span>
										<div class="badge-info">
											<div class="badge-title text-rose">Artistas Digitales</div>
											<div class="badge-desc">Ilustración, concept art y Live2D</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</section>

		<!-- ══════════════════════════════════════════════════════════════════ -->
		<!-- 4. ARQUITECTURA TÉCNICA ("BAJO EL CAPÓ")                        -->
		<!-- ══════════════════════════════════════════════════════════════════ -->
		<section id="arquitectura" class="architecture-section">
			<div class="section-header">
				<div class="section-eyebrow">
					<span class="material-icons-round">developer_board</span>
					<span>Rendimiento Extremo</span>
				</div>
				<h2 class="section-title">Ingeniería Bajo el Capó</h2>
				<p class="section-subtitle">
					Diseñado sin deuda técnica innecesaria. Cada capa del stack está optimizada para la menor
					huella de memoria y máxima velocidad de respuesta.
				</p>
			</div>

			<div class="arch-cards-grid">
				<!-- Svelte 5 Runes -->
				<div class="glass-card arch-card" role="presentation" onmousemove={handleCardMouseMove}>
					<div class="arch-header">
						<div
							class="arch-icon bg-rose-glass"
							style="flex: 0 0 46px; min-width: 46px; min-height: 46px;"
						>
							<span class="material-icons-round text-rose">code</span>
						</div>
						<div>
							<h3 class="arch-title">SvelteKit 5 + Runes</h3>
							<span class="arch-badge">Frontend de Vanguardia</span>
						</div>
					</div>
					<p class="arch-desc">
						Reemplazo total de stores tradicionales por reactividad granular pura con <code
							class="code-tag">$state</code
						>, <code class="code-tag">$derived</code> y <code class="code-tag">$props</code>. Cero
						sobrecarga de Virtual DOM.
					</p>
					<div class="arch-stat-row">
						<span class="stat-lbl">Sobrecarga de Framework:</span>
						<span class="stat-val text-emerald">0% Virtual DOM</span>
					</div>
				</div>

				<!-- SQLite WAL -->
				<div class="glass-card arch-card" role="presentation" onmousemove={handleCardMouseMove}>
					<div class="arch-header">
						<div
							class="arch-icon bg-cyan-glass"
							style="flex: 0 0 46px; min-width: 46px; min-height: 46px;"
						>
							<span class="material-icons-round text-cyan">storage</span>
						</div>
						<div>
							<h3 class="arch-title">SQLite 3 + @libsql/client</h3>
							<span class="arch-badge">Persistencia Transaccional</span>
						</div>
					</div>
					<p class="arch-desc">
						Modo Write-Ahead Logging (WAL) con transacciones ACID, prepared statements compilados e
						índices compuestos para lecturas instantáneas O(1).
					</p>
					<div class="arch-stat-row">
						<span class="stat-lbl">Tiempo de Consulta Medio:</span>
						<span class="stat-val text-cyan">&lt; 0.5 ms</span>
					</div>
				</div>

				<!-- Realtime WebRTC & Sockets -->
				<div class="glass-card arch-card" role="presentation" onmousemove={handleCardMouseMove}>
					<div class="arch-header">
						<div
							class="arch-icon bg-emerald-glass"
							style="flex: 0 0 46px; min-width: 46px; min-height: 46px;"
						>
							<span class="material-icons-round text-emerald">podcasts</span>
						</div>
						<div>
							<h3 class="arch-title">Socket.IO & WebRTC</h3>
							<span class="arch-badge">Tiempo Real Nativo</span>
						</div>
					</div>
					<p class="arch-desc">
						Motor bidireccional en memoria para presencia y typing, junto a transporte P2P
						encriptado para transmisiones de voz y video sin intermediación.
					</p>
					<div class="arch-stat-row">
						<span class="stat-lbl">Latencia de Señalización:</span>
						<span class="stat-val text-emerald">&lt; 15 ms</span>
					</div>
				</div>

				<!-- Hardware Accelerated UI -->
				<div class="glass-card arch-card" role="presentation" onmousemove={handleCardMouseMove}>
					<div class="arch-header">
						<div
							class="arch-icon bg-amber-glass"
							style="flex: 0 0 46px; min-width: 46px; min-height: 46px;"
						>
							<span class="material-icons-round text-amber">auto_fix_high</span>
						</div>
						<div>
							<h3 class="arch-title">GPU Layer Promotion</h3>
							<span class="arch-badge">Renderizado 60 FPS</span>
						</div>
					</div>
					<p class="arch-desc">
						Aislamiento de capas con <code class="code-tag">contain: layout style paint</code> y
						transformaciones <code class="code-tag">translate3d</code> para evitar layout thrashing.
					</p>
					<div class="arch-stat-row">
						<span class="stat-lbl">Tasa de Cuadros:</span>
						<span class="stat-val text-amber">60 FPS Estable</span>
					</div>
				</div>
			</div>
		</section>

		<!-- ══════════════════════════════════════════════════════════════════ -->
		<!-- 5. DISEÑADO PARA CADA CREADOR                                   -->
		<!-- ══════════════════════════════════════════════════════════════════ -->
		<section id="creadores" class="audiences-section">
			<div class="section-header">
				<div class="section-eyebrow">
					<span class="material-icons-round">groups_3</span>
					<span>Comunidades</span>
				</div>
				<h2 class="section-title">Una Plataforma para Cada Creador</h2>
				<p class="section-subtitle">
					Construida para satisfacer las necesidades específicas de la era digital y virtual.
				</p>
			</div>

			<div class="audiences-grid">
				<div class="audience-card glass-card">
					<div
						class="audience-icon text-cyan"
						style="flex: 0 0 50px; min-width: 50px; min-height: 50px;"
					>
						<span class="material-icons-round">videocam</span>
					</div>
					<h3 class="audience-title">VTubers & Streamers</h3>
					<p class="audience-desc">
						Difunde tus directos, publica teasers de debuts, organiza dinámicas con tus fans y vende
						mercancía digital sin intermediarios.
					</p>
				</div>

				<div class="audience-card glass-card">
					<div
						class="audience-icon text-rose"
						style="flex: 0 0 50px; min-width: 50px; min-height: 50px;"
					>
						<span class="material-icons-round">brush</span>
					</div>
					<h3 class="audience-title">Ilustradores & Diseñadores</h3>
					<p class="audience-desc">
						Portafolios integrados en el perfil con subida de alta resolución, gestión de comisiones
						y protección de derechos de autor.
					</p>
				</div>

				<div class="audience-card glass-card">
					<div
						class="audience-icon text-amber"
						style="flex: 0 0 50px; min-width: 50px; min-height: 50px;"
					>
						<span class="material-icons-round">diversity_2</span>
					</div>
					<h3 class="audience-title">Fandoms & Gremios</h3>
					<p class="audience-desc">
						Grupos con canales de debate, salas de voz exclusivas, eventos comunitarios y
						clasificaciones de lealtad por insignias.
					</p>
				</div>

				<div class="audience-card glass-card">
					<div
						class="audience-icon text-emerald"
						style="flex: 0 0 50px; min-width: 50px; min-height: 50px;"
					>
						<span class="material-icons-round">terminal</span>
					</div>
					<h3 class="audience-title">Desarrolladores & Web3</h3>
					<p class="audience-desc">
						API abierta y arquitectura transparente. Sin trampas de algoritmos que entierran tu
						contenido detrás de muros de pago.
					</p>
				</div>
			</div>
		</section>

		<!-- ══════════════════════════════════════════════════════════════════ -->
		<!-- 6. SEGURIDAD Y PRIVACIDAD RGPD                                  -->
		<!-- ══════════════════════════════════════════════════════════════════ -->
		<section id="seguridad" class="privacy-section">
			<div class="privacy-box glass-panel aero-card">
				<div class="privacy-header-content">
					<div
						class="privacy-shield-icon"
						style="flex: 0 0 64px; min-width: 64px; min-height: 64px;"
					>
						<span class="material-icons-round text-emerald">gpp_good</span>
					</div>
					<div>
						<h2 class="privacy-title">Privacidad y Soberanía por Diseño</h2>
						<p class="privacy-subtitle">
							El cumplimiento del Reglamento General de Protección de Datos (RGPD) no es una opción
							secundaria: es el núcleo de nuestra arquitectura.
						</p>
					</div>
				</div>

				<div class="privacy-guarantees-grid">
					<div class="guarantee-item">
						<span class="material-icons-round text-emerald">download_for_offline</span>
						<div>
							<h4>Portabilidad Total en 1-Clic</h4>
							<p>
								Exporta todas tus publicaciones, mensajes, compras y transacciones en formato JSON
								estandarizado en cualquier momento.
							</p>
						</div>
					</div>

					<div class="guarantee-item">
						<span class="material-icons-round text-emerald">delete_sweep</span>
						<div>
							<h4>Derecho al Olvido Automatizado</h4>
							<p>
								Al solicitar la eliminación de tu cuenta, todos tus datos y archivos multimedia se
								purgan de forma irreversible.
							</p>
						</div>
					</div>

					<div class="guarantee-item">
						<span class="material-icons-round text-emerald">no_accounts</span>
						<div>
							<h4>Cero Rastreadores de Terceros</h4>
							<p>
								Sin píxeles de Facebook, sin Google Ads, sin venta de telemetría a brokers de datos.
								Tu actividad permanece privada.
							</p>
						</div>
					</div>

					<div class="guarantee-item">
						<span class="material-icons-round text-emerald">key</span>
						<div>
							<h4>Sesiones Criptográficas SHA-256</h4>
							<p>
								Tokens firmados y sesiones validadas criptográficamente contra la base de datos con
								protección estricta contra CSRF.
							</p>
						</div>
					</div>
				</div>

				<div class="privacy-legal-links">
					<a href="/privacy" class="legal-link">Política de Privacidad</a>
					<span class="bullet">•</span>
					<a href="/terms" class="legal-link">Términos del Servicio</a>
					<span class="bullet">•</span>
					<a href="/cookies" class="legal-link">Uso de Cookies</a>
				</div>
			</div>
		</section>

		<!-- ══════════════════════════════════════════════════════════════════ -->
		<!-- 7. PREGUNTAS FRECUENTES (FAQ INTERACTIVO)                        -->
		<!-- ══════════════════════════════════════════════════════════════════ -->
		<section id="faq" class="faq-section">
			<div class="section-header">
				<div class="section-eyebrow">
					<span class="material-icons-round">quiz</span>
					<span>Preguntas Frecuentes</span>
				</div>
				<h2 class="section-title">Todo lo que Necesitas Saber</h2>
				<p class="section-subtitle">
					Respuestas claras sobre la plataforma, monetización, verificación y privacidad.
				</p>
			</div>

			<div class="faq-accordion-list">
				{#each faqs as faq, i}
					<div class="faq-item glass-panel" class:open={openFaq === i}>
						<button
							class="faq-question"
							onclick={() => toggleFaq(i)}
							type="button"
							aria-expanded={openFaq === i}
							aria-controls="faq-ans-{i}"
						>
							<span>{faq.q}</span>
							<span class="material-icons-round chevron">expand_more</span>
						</button>

						{#if openFaq === i}
							<div
								id="faq-ans-{i}"
								class="faq-answer-container"
								transition:slide={{ duration: 250, easing: cubicOut }}
							>
								<div class="faq-answer">
									<p>{faq.a}</p>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</section>

		<!-- ══════════════════════════════════════════════════════════════════ -->
		<!-- 8. HUB DE LLAMADA A LA ACCIÓN (CTA FINAL)                         -->
		<!-- ══════════════════════════════════════════════════════════════════ -->
		<section id="unirse" class="cta-hub-section">
			<div
				class="cta-hub-card glass-panel aero-card"
				role="presentation"
				onmousemove={handleCardMouseMove}
			>
				<div class="cta-glow-bg"></div>

				<div class="cta-content-wrap">
					<span class="cta-tag font-bold">✨ Forma Parte del Futuro</span>
					<h2 class="cta-main-title">Únete a la Revolución de V-SOCIAL</h2>
					<p class="cta-main-desc">
						Crea tu cuenta en segundos, personaliza tu perfil con estética Neo-Aero y conecta con
						miles de creadores y fans en un entorno pensado para ti.
					</p>

					<div class="cta-hub-buttons">
						<a href="/register" class="btn-aero-primary btn-cta-large">
							<span class="material-icons-round">person_add</span>
							<span>Crear Cuenta Gratis</span>
						</a>
						<a href="/feed" class="btn-aero-secondary btn-cta-large">
							<span class="material-icons-round">explore</span>
							<span>Ver el Feed Público</span>
						</a>
						<a href="/about/verified" class="btn-aero-ghost btn-cta-large">
							<span class="material-icons-round text-cyan">verified</span>
							<span>Solicitar Verificación</span>
						</a>
					</div>
				</div>
			</div>
		</section>
	</main>
</div>

<style>
	/* ══════════════════════════════════════════════════════════════════════
	   CONTENEDOR PRINCIPAL & WRAPPER
	   ══════════════════════════════════════════════════════════════════════ */
	.about-page-wrapper {
		width: 100%;
		max-width: 1240px;
		margin: 0 auto;
		padding: 1.5rem 1rem 5rem 1rem;
		position: relative;
		z-index: 1;
		font-family: var(--font-sans);
	}

	.about-main-content {
		display: flex;
		flex-direction: column;
		gap: 5rem;
		position: relative;
	}

	/* ══════════════════════════════════════════════════════════════════════
	   FLOATING QUICK NAVIGATION BAR
	   ══════════════════════════════════════════════════════════════════════ */
	.quick-nav-pill {
		position: sticky;
		top: 1rem;
		z-index: var(--z-sticky, 200);
		margin: 0 auto 2.5rem auto;
		width: fit-content;
		max-width: 95%;
		padding: 0.45rem 0.6rem;
		border-radius: var(--radius-full);
		display: flex;
		align-items: center;
		gap: 0.35rem;
		overflow-x: auto;
		background: var(--bg-surface);
		backdrop-filter: var(--glass-blur);
		border: 1px solid var(--border-subtle);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
	}

	.nav-link {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.85rem;
		border-radius: var(--radius-full);
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-secondary);
		text-decoration: none;
		white-space: nowrap;
		transition: all var(--t-fast);
	}

	.nav-link span.material-icons-round {
		font-size: 1.1rem;
	}

	.nav-link:hover {
		color: var(--text-primary);
		background: rgba(var(--accent-blue-rgb), 0.12);
	}

	.nav-link.active {
		color: #ffffff;
		background: var(--accent-blue-base);
		box-shadow: 0 4px 14px rgba(var(--accent-blue-rgb), 0.4);
	}

	.nav-link.cta-pill {
		background: linear-gradient(90deg, var(--aero-blue), var(--aero-mint));
		color: #ffffff;
		font-weight: 700;
	}

	/* ══════════════════════════════════════════════════════════════════
	   1. HERO SECTION
	   ══════════════════════════════════════════════════════════════════ */
	.hero-showcase {
		position: relative;
		padding: 4.5rem 2rem;
		border-radius: var(--radius-xl);
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
		backdrop-filter: blur(24px) saturate(1.2);
		box-shadow:
			0 24px 60px rgba(0, 0, 0, 0.12),
			inset 0 1px 2px rgba(255, 255, 255, 0.4);
	}

	.hero-ambient-glow {
		position: absolute;
		top: -40%;
		left: -30%;
		width: 160%;
		height: 180%;
		background:
			radial-gradient(circle at 30% 30%, rgba(var(--accent-blue-rgb), 0.18) 0%, transparent 60%),
			radial-gradient(circle at 70% 60%, rgba(var(--aero-mint-rgb), 0.14) 0%, transparent 50%),
			radial-gradient(circle at 50% 80%, rgba(var(--aero-rose-rgb), 0.1) 0%, transparent 55%);
		filter: blur(60px);
		pointer-events: none;
		z-index: 0;
		animation: pulseGlow 14s ease-in-out infinite alternate;
	}

	@keyframes pulseGlow {
		0% {
			transform: scale(0.95) rotate(0deg);
		}
		100% {
			transform: scale(1.05) rotate(5deg);
		}
	}

	.hero-badge-pill {
		position: relative;
		z-index: 1;
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.4rem 1rem;
		border-radius: var(--radius-full);
		background: rgba(var(--accent-blue-rgb), 0.12);
		border: 1px solid rgba(var(--accent-blue-rgb), 0.3);
		color: var(--accent-blue-light);
		font-size: 0.85rem;
		margin-bottom: 1.8rem;
		box-shadow: 0 4px 15px rgba(var(--accent-blue-rgb), 0.15);
	}

	.badge-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--aero-mint);
		box-shadow: 0 0 10px var(--aero-mint);
		animation: blinkDot 2s infinite ease-in-out;
	}

	@keyframes blinkDot {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.4;
			transform: scale(0.8);
		}
	}

	.hero-headline {
		position: relative;
		z-index: 1;
		font-family: var(--font-display);
		font-size: clamp(2.4rem, 5.5vw, 4.4rem);
		font-weight: 900;
		line-height: 1.12;
		letter-spacing: -0.03em;
		color: var(--text-primary);
		margin-bottom: 1.5rem;
		max-width: 950px;
	}

	.hero-gradient-text {
		background: linear-gradient(135deg, var(--aero-sky) 0%, var(--aero-mint) 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		display: inline-block;
	}

	.hero-lead {
		position: relative;
		z-index: 1;
		font-size: clamp(1.05rem, 1.8vw, 1.3rem);
		color: var(--text-secondary);
		max-width: 780px;
		line-height: 1.65;
		margin-bottom: 2.5rem;
	}

	.hero-lead strong {
		color: var(--text-primary);
	}

	/* Hero Metrics Bar */
	.hero-metrics-bar {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 1.2rem;
		padding: 1rem 1.8rem;
		border-radius: var(--radius-lg);
		background: rgba(var(--accent-blue-rgb), 0.05);
		border: 1px solid var(--border-subtle);
		backdrop-filter: blur(12px);
		margin-bottom: 2.8rem;
		box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.15);
	}

	.metric-pill {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.3rem 0.5rem;
	}

	.metric-icon {
		font-size: 1.7rem;
	}

	.metric-info {
		display: flex;
		flex-direction: column;
		text-align: left;
	}

	.metric-val {
		font-size: 1.05rem;
		font-weight: 800;
		color: var(--text-primary);
		font-family: var(--font-display);
	}

	.metric-lbl {
		font-size: 0.75rem;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.metric-divider {
		width: 1px;
		height: 28px;
		background: var(--border-subtle);
	}

	/* Hero CTAs */
	.hero-action-group {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.btn-hero-main,
	.btn-hero-sub,
	.btn-hero-demo {
		padding: 0.85rem 1.6rem;
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		transition: all var(--t-spring);
	}

	.btn-hero-main {
		box-shadow: 0 6px 20px rgba(var(--accent-blue-rgb), 0.35);
	}

	.btn-hero-main:hover {
		transform: translateY(-3px) scale(1.02);
		box-shadow: 0 10px 28px rgba(var(--accent-blue-rgb), 0.5);
	}

	/* ══════════════════════════════════════════════════════════════════
	   SECTION HEADERS (GENÉRICO)
	   ══════════════════════════════════════════════════════════════════ */
	.section-header {
		text-align: center;
		margin-bottom: 2.8rem;
	}

	.section-eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.35rem 0.85rem;
		border-radius: var(--radius-full);
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--accent-blue-light);
		background: rgba(var(--accent-blue-rgb), 0.1);
		border: 1px solid rgba(var(--accent-blue-rgb), 0.25);
		margin-bottom: 1rem;
	}

	.section-eyebrow span.material-icons-round {
		font-size: 1.1rem;
	}

	.section-title {
		font-family: var(--font-display);
		font-size: clamp(2rem, 3.8vw, 3rem);
		font-weight: 900;
		color: var(--text-primary);
		letter-spacing: -0.02em;
		margin-bottom: 0.8rem;
	}

	.section-subtitle {
		font-size: 1.1rem;
		color: var(--text-secondary);
		max-width: 680px;
		margin: 0 auto;
		line-height: 1.6;
	}

	/* ══════════════════════════════════════════════════════════════════
	   2. MANIFIESTO / PILARES
	   ══════════════════════════════════════════════════════════════════ */
	.manifesto-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 1.8rem;
	}

	.pillar-card {
		padding: 2.2rem 1.8rem;
		border-radius: var(--radius-lg);
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		position: relative;
		overflow: hidden;
		transition: all var(--t-spring);
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
	}

	.pillar-card:hover {
		transform: translateY(-8px);
		box-shadow: 0 20px 45px rgba(0, 0, 0, 0.25);
		border-color: rgba(var(--accent-blue-rgb), 0.4);
	}

	.pillar-icon-box {
		width: 54px;
		height: 54px;
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 1.4rem;
		border: 1px solid var(--border-subtle);
	}

	.pillar-icon-box span {
		font-size: 1.9rem;
	}

	.pillar-heading {
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 800;
		color: var(--text-primary);
		margin-bottom: 0.8rem;
	}

	.pillar-body {
		font-size: 0.95rem;
		color: var(--text-secondary);
		line-height: 1.65;
		margin-bottom: 1.5rem;
		flex-grow: 1;
	}

	.pillar-tag {
		font-size: 0.8rem;
		font-weight: 700;
		padding: 0.3rem 0.75rem;
		border-radius: var(--radius-sm);
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid var(--border-subtle);
	}

	/* ══════════════════════════════════════════════════════════════════
	   3. ECOSISTEMA (TABS INTERACTIVAS)
	   ══════════════════════════════════════════════════════════════════ */
	.ecosystem-tabs-bar {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		padding: 0.6rem;
		border-radius: var(--radius-xl);
		margin-bottom: 2rem;
		overflow-x: auto;
		background: var(--bg-surface);
	}

	.eco-tab-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.7rem 1.4rem;
		border-radius: var(--radius-lg);
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--text-secondary);
		background: transparent;
		border: none;
		cursor: pointer;
		white-space: nowrap;
		transition: all var(--t-spring);
	}

	.eco-tab-btn:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.08);
	}

	.eco-tab-btn.active {
		color: #ffffff;
		background: var(--accent-blue-base);
		box-shadow: 0 6px 18px rgba(var(--accent-blue-rgb), 0.4);
	}

	.ecosystem-tab-viewport {
		padding: 2.8rem 2.2rem;
		border-radius: var(--radius-xl);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
	}

	.tab-pane-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2.5rem;
		align-items: center;
	}

	@media (max-width: 860px) {
		.tab-pane-grid {
			grid-template-columns: 1fr;
		}
	}

	.pill-mini {
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		display: inline-block;
		margin-bottom: 0.6rem;
	}

	.tab-title {
		font-family: var(--font-display);
		font-size: 1.8rem;
		font-weight: 800;
		color: var(--text-primary);
		margin-bottom: 1rem;
		line-height: 1.25;
	}

	.tab-desc {
		font-size: 1rem;
		color: var(--text-secondary);
		line-height: 1.65;
		margin-bottom: 1.5rem;
	}

	.feature-bullets {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.feature-bullets li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.95rem;
		color: var(--text-secondary);
	}

	.feature-bullets li span.material-icons-round {
		font-size: 1.2rem;
	}

	/* Mockup: Feed */
	.mock-post-card {
		padding: 1.6rem;
		border-radius: var(--radius-lg);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
	}

	.mock-post-header {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		margin-bottom: 1rem;
	}

	.mock-avatar {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid var(--accent-blue-base);
	}

	.mock-user-meta {
		display: flex;
		flex-direction: column;
		flex-grow: 1;
	}

	.mock-user-name {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-weight: 800;
		color: var(--text-primary);
	}

	.mock-verified-badge {
		font-size: 1rem;
		color: var(--aero-sky);
	}

	.mock-handle {
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.mock-mood-badge {
		font-size: 0.8rem;
		font-weight: 700;
		padding: 0.25rem 0.65rem;
		border-radius: var(--radius-full);
		background: rgba(var(--accent-blue-rgb), 0.15);
		color: var(--accent-blue-light);
		border: 1px solid rgba(var(--accent-blue-rgb), 0.3);
	}

	.mock-post-body {
		font-size: 0.95rem;
		color: var(--text-primary);
		line-height: 1.55;
		margin-bottom: 1.2rem;
	}

	.mood-selector-bar {
		padding: 0.8rem;
		border-radius: var(--radius-md);
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--border-subtle);
		margin-bottom: 1.2rem;
	}

	.mood-bar-label {
		display: block;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-secondary);
		margin-bottom: 0.5rem;
		text-transform: uppercase;
	}

	.mood-chips-scroller {
		display: flex;
		gap: 0.45rem;
		overflow-x: auto;
		padding-bottom: 0.2rem;
	}

	.mood-chip {
		padding: 0.35rem 0.75rem;
		border-radius: var(--radius-full);
		font-size: 0.8rem;
		font-weight: 600;
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-secondary);
		border: 1px solid var(--border-subtle);
		cursor: pointer;
		white-space: nowrap;
		transition: all var(--t-fast);
	}

	.mood-chip:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.12);
	}

	.mood-chip.selected {
		background: var(--accent-blue-base);
		color: #ffffff;
		border-color: transparent;
	}

	.mock-post-actions {
		display: flex;
		align-items: center;
		justify-content: space-around;
		padding-top: 0.8rem;
		border-top: 1px solid var(--border-subtle);
	}

	.mock-action-btn {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-secondary);
		cursor: pointer;
	}

	.mock-action-btn span.material-icons-round {
		font-size: 1.15rem;
	}

	/* Mockup: Chat */
	.mock-chat-card {
		border-radius: var(--radius-lg);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		height: 380px;
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
	}

	.mock-chat-topbar {
		padding: 0.8rem 1.2rem;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		border-bottom: 1px solid var(--border-subtle);
		background: rgba(255, 255, 255, 0.03);
	}

	.chat-status-indicator {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.chat-status-indicator.online {
		background: var(--aero-mint);
		box-shadow: 0 0 8px var(--aero-mint);
	}

	.chat-peer-name {
		font-weight: 700;
		color: var(--text-primary);
		font-size: 0.9rem;
		flex-grow: 1;
	}

	.chat-webrtc-pill {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		font-weight: 700;
		padding: 0.25rem 0.6rem;
		border-radius: var(--radius-full);
		background: rgba(0, 212, 170, 0.12);
		color: var(--aero-mint);
		border: 1px solid rgba(0, 212, 170, 0.3);
	}

	.mock-chat-feed {
		flex-grow: 1;
		padding: 1.2rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.mock-bubble {
		max-width: 85%;
		padding: 0.65rem 0.95rem;
		border-radius: var(--radius-md);
		font-size: 0.85rem;
		line-height: 1.4;
	}

	.mock-bubble.incoming {
		align-self: flex-start;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid var(--border-subtle);
	}

	.mock-bubble.outgoing {
		align-self: flex-end;
		background: var(--accent-blue-base);
		color: #ffffff;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.bubble-sender {
		font-size: 0.7rem;
		font-weight: 700;
		opacity: 0.75;
		margin-bottom: 0.2rem;
	}

	.bubble-time {
		font-size: 0.65rem;
		opacity: 0.6;
		text-align: right;
		margin-top: 0.2rem;
	}

	.mock-chat-input-bar {
		padding: 0.75rem 1rem;
		display: flex;
		gap: 0.6rem;
		border-top: 1px solid var(--border-subtle);
		background: rgba(0, 0, 0, 0.1);
	}

	.mock-text-input {
		flex-grow: 1;
		padding: 0.5rem 0.9rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-subtle);
		background: var(--bg-input);
		color: var(--text-primary);
		font-size: 0.85rem;
		outline: none;
	}

	.btn-icon-send {
		padding: 0;
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		cursor: pointer;
	}

	/* Mockup: Marketplace Calculator */
	.calc-box {
		padding: 1.4rem;
		border-radius: var(--radius-lg);
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--border-subtle);
	}

	.calc-label-row {
		display: flex;
		justify-content: space-between;
		font-size: 0.95rem;
		color: var(--text-primary);
		margin-bottom: 0.8rem;
	}

	.calc-slider {
		width: 100%;
		accent-color: var(--accent-blue-base);
		cursor: pointer;
		margin-bottom: 1.2rem;
	}

	.calc-comparison {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 0.8rem;
		align-items: center;
		text-align: center;
	}

	.calc-side {
		padding: 0.8rem;
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.calc-side.vsocial {
		background: rgba(0, 212, 170, 0.1);
		border: 1px solid rgba(0, 212, 170, 0.3);
	}

	.calc-side.legacy {
		background: rgba(244, 63, 94, 0.1);
		border: 1px solid rgba(244, 63, 94, 0.25);
	}

	.calc-platform-name {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
	}

	.calc-payout {
		font-size: 1.3rem;
		font-weight: 900;
		color: var(--text-primary);
		font-family: var(--font-display);
	}

	.calc-payout.strike {
		color: var(--aero-rose);
		text-decoration: line-through;
	}

	.calc-sub {
		font-size: 0.7rem;
		color: var(--text-secondary);
	}

	.calc-vs {
		font-weight: 800;
		color: var(--text-secondary);
		font-size: 0.8rem;
	}

	.mock-gigs-grid {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.mock-gig-card {
		padding: 1.2rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
	}

	.gig-category {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		margin-bottom: 0.3rem;
	}

	.gig-title {
		font-size: 1rem;
		font-weight: 800;
		color: var(--text-primary);
		margin-bottom: 0.4rem;
	}

	.gig-seller {
		font-size: 0.8rem;
		color: var(--text-secondary);
		margin-bottom: 0.8rem;
	}

	.gig-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.gig-price {
		font-size: 1.15rem;
		font-weight: 900;
		color: var(--aero-mint);
		font-family: var(--font-display);
	}

	.gig-tag {
		font-size: 0.75rem;
		padding: 0.25rem 0.55rem;
		border-radius: var(--radius-sm);
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-secondary);
	}

	/* Mockup: Gamification */
	.xp-sim-box {
		padding: 1.2rem;
		border-radius: var(--radius-md);
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--border-subtle);
	}

	.xp-sim-header {
		display: flex;
		justify-content: space-between;
		font-size: 0.9rem;
		color: var(--text-primary);
		margin-bottom: 0.6rem;
		font-weight: 600;
	}

	.xp-count {
		font-weight: 800;
		color: var(--aero-sky);
	}

	.streak-counter {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.85rem;
		color: var(--text-primary);
		margin-top: 0.8rem;
	}

	.gamification-preview-card {
		padding: 2rem;
		border-radius: var(--radius-lg);
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
	}

	.level-badge-circle {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--aero-blue), var(--aero-mint));
		color: #ffffff;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		box-shadow: 0 8px 24px rgba(var(--accent-blue-rgb), 0.4);
		margin-bottom: 1rem;
	}

	.level-num {
		font-size: 1.7rem;
		font-weight: 900;
		line-height: 1;
		font-family: var(--font-display);
	}

	.level-lbl {
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.05em;
	}

	.user-rank-info {
		margin-bottom: 1.4rem;
	}

	.rank-name {
		font-size: 1.3rem;
		font-weight: 800;
		color: var(--text-primary);
		margin-bottom: 0.2rem;
	}

	.rank-sub {
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.xp-bar-container {
		width: 100%;
		height: 10px;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.1);
		overflow: hidden;
		margin-bottom: 0.4rem;
	}

	.xp-bar-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--aero-sky), var(--aero-mint));
		border-radius: var(--radius-full);
		transition: width 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.xp-bar-meta {
		width: 100%;
		display: flex;
		justify-content: space-between;
		font-size: 0.75rem;
		color: var(--text-secondary);
		margin-bottom: 1.4rem;
	}

	.unlocked-perks-grid {
		width: 100%;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
	}

	.perk-pill {
		padding: 0.5rem 0.3rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		border: 1px solid var(--border-subtle);
		background: rgba(255, 255, 255, 0.04);
	}

	.perk-pill.active {
		border-color: rgba(0, 212, 170, 0.4);
		color: var(--text-primary);
	}

	.perk-pill.locked {
		opacity: 0.45;
		color: var(--text-secondary);
	}

	/* Mockup: Badges */
	.badges-showcase-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.9rem;
	}

	.badge-item-card {
		padding: 1rem;
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		gap: 0.8rem;
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
	}

	.badge-icon {
		font-size: 2rem;
	}

	.badge-title {
		font-size: 0.9rem;
		font-weight: 800;
	}

	.badge-desc {
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.verification-ctas {
		display: flex;
		gap: 0.8rem;
		flex-wrap: wrap;
	}

	/* ══════════════════════════════════════════════════════════════════
	   4. ARQUITECTURA TÉCNICA
	   ══════════════════════════════════════════════════════════════════ */
	.arch-cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
		gap: 1.8rem;
	}

	.arch-card {
		padding: 2rem 1.6rem;
		border-radius: var(--radius-lg);
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
		transition: all var(--t-spring);
	}

	.arch-card:hover {
		transform: translateY(-6px);
		border-color: rgba(var(--accent-blue-rgb), 0.4);
		box-shadow: 0 16px 36px rgba(0, 0, 0, 0.2);
	}

	.arch-header {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		margin-bottom: 1.2rem;
	}

	.arch-icon {
		width: 46px;
		height: 46px;
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border-subtle);
	}

	.arch-icon span {
		font-size: 1.6rem;
	}

	.arch-title {
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 800;
		color: var(--text-primary);
	}

	.arch-badge {
		font-size: 0.75rem;
		color: var(--text-secondary);
		font-weight: 600;
	}

	.arch-desc {
		font-size: 0.9rem;
		color: var(--text-secondary);
		line-height: 1.6;
		margin-bottom: 1.5rem;
		flex-grow: 1;
	}

	.arch-stat-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: 0.8rem;
		border-top: 1px solid var(--border-subtle);
		font-size: 0.8rem;
	}

	.stat-lbl {
		color: var(--text-secondary);
	}

	.stat-val {
		font-weight: 800;
		font-family: var(--font-display);
	}

	/* ══════════════════════════════════════════════════════════════════
	   5. AUDIENCIAS / COMUNIDADES
	   ══════════════════════════════════════════════════════════════════ */
	.audiences-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1.6rem;
	}

	.audience-card {
		padding: 2rem 1.6rem;
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
		transition: all var(--t-spring);
	}

	.audience-card:hover {
		transform: translateY(-6px);
		box-shadow: 0 16px 36px rgba(0, 0, 0, 0.2);
	}

	.audience-icon {
		width: 50px;
		height: 50px;
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid var(--border-subtle);
		margin-bottom: 1.2rem;
	}

	.audience-icon span {
		font-size: 1.8rem;
	}

	.audience-title {
		font-family: var(--font-display);
		font-size: 1.2rem;
		font-weight: 800;
		color: var(--text-primary);
		margin-bottom: 0.6rem;
	}

	.audience-desc {
		font-size: 0.9rem;
		color: var(--text-secondary);
		line-height: 1.6;
	}

	/* ══════════════════════════════════════════════════════════════════
	   6. PRIVACIDAD RGPD
	   ══════════════════════════════════════════════════════════════════ */
	.privacy-box {
		padding: 3.5rem 2.5rem;
		border-radius: var(--radius-xl);
		background: var(--bg-surface);
		border: 1px solid rgba(0, 212, 170, 0.3);
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
	}

	.privacy-header-content {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		margin-bottom: 2.5rem;
	}

	.privacy-shield-icon {
		width: 64px;
		height: 64px;
		border-radius: var(--radius-lg);
		background: rgba(0, 212, 170, 0.12);
		border: 1px solid rgba(0, 212, 170, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.privacy-shield-icon span {
		font-size: 2.4rem;
	}

	.privacy-title {
		font-family: var(--font-display);
		font-size: 1.85rem;
		font-weight: 800;
		color: var(--text-primary);
		margin-bottom: 0.3rem;
	}

	.privacy-subtitle {
		font-size: 1.05rem;
		color: var(--text-secondary);
	}

	.privacy-guarantees-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 1.6rem;
		margin-bottom: 2.5rem;
	}

	.guarantee-item {
		display: flex;
		gap: 0.9rem;
		padding: 1.2rem;
		border-radius: var(--radius-md);
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid var(--border-subtle);
	}

	.guarantee-item span.material-icons-round {
		font-size: 1.8rem;
		flex-shrink: 0;
	}

	.guarantee-item h4 {
		font-size: 1rem;
		font-weight: 800;
		color: var(--text-primary);
		margin-bottom: 0.35rem;
	}

	.guarantee-item p {
		font-size: 0.85rem;
		color: var(--text-secondary);
		line-height: 1.5;
	}

	.privacy-legal-links {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		font-size: 0.85rem;
		color: var(--text-secondary);
		padding-top: 1.5rem;
		border-top: 1px solid var(--border-subtle);
	}

	.legal-link {
		color: var(--accent-blue-light);
		text-decoration: none;
		font-weight: 600;
	}

	.legal-link:hover {
		text-decoration: underline;
	}

	/* ══════════════════════════════════════════════════════════════════
	   7. FAQ ACCORDION
	   ══════════════════════════════════════════════════════════════════ */
	.faq-accordion-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: 840px;
		margin: 0 auto;
	}

	.faq-item {
		overflow: hidden;
		transition:
			box-shadow var(--t-base),
			border-color var(--t-base);
	}

	.faq-item.open {
		box-shadow:
			var(--glass-shadow),
			0 0 20px rgba(var(--accent-blue-rgb), 0.2);
		border-color: rgba(var(--accent-blue-rgb), 0.4);
	}

	.faq-question {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.15rem 1.6rem;
		background: none;
		border: none;
		color: var(--text-primary);
		font-size: 0.98rem;
		font-weight: 600;
		cursor: pointer;
		text-align: left;
		gap: 1rem;
		transition: color var(--t-fast);
	}

	.faq-question:hover {
		color: var(--accent-blue-light);
	}

	.faq-item.open .faq-question {
		color: var(--accent-blue-light);
	}

	.chevron {
		transition: transform var(--t-base) var(--ease-spring);
		flex-shrink: 0;
		color: var(--accent-blue-light);
	}

	.faq-item.open .chevron {
		transform: rotate(180deg);
	}

	.faq-answer-container {
		overflow: hidden;
	}

	.faq-answer {
		padding: 0 1.6rem 1.35rem;
	}

	.faq-answer p {
		font-size: 0.92rem;
		line-height: 1.7;
		color: var(--text-secondary);
		margin: 0;
	}

	/* ══════════════════════════════════════════════════════════════════
	   8. CTA HUB FINAL
	   ══════════════════════════════════════════════════════════════════ */
	.cta-hub-card {
		padding: 5rem 2rem;
		border-radius: var(--radius-xl);
		text-align: center;
		position: relative;
		overflow: hidden;
		border: 1px solid rgba(var(--accent-blue-rgb), 0.35);
		background: var(--bg-surface);
		box-shadow:
			0 24px 60px rgba(0, 0, 0, 0.2),
			inset 0 1px 2px rgba(255, 255, 255, 0.4);
	}

	.cta-glow-bg {
		position: absolute;
		top: -50%;
		left: -20%;
		width: 140%;
		height: 200%;
		background: radial-gradient(
			circle at center,
			rgba(var(--accent-blue-rgb), 0.2) 0%,
			rgba(var(--aero-mint-rgb), 0.1) 40%,
			transparent 70%
		);
		filter: blur(50px);
		pointer-events: none;
		z-index: 0;
	}

	.cta-content-wrap {
		position: relative;
		z-index: 1;
		max-width: 750px;
		margin: 0 auto;
	}

	.cta-tag {
		font-size: 0.85rem;
		color: var(--aero-sky);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		display: inline-block;
		margin-bottom: 1rem;
	}

	.cta-main-title {
		font-family: var(--font-display);
		font-size: clamp(2.2rem, 4vw, 3.4rem);
		font-weight: 900;
		color: var(--text-primary);
		letter-spacing: -0.02em;
		margin-bottom: 1rem;
	}

	.cta-main-desc {
		font-size: 1.15rem;
		color: var(--text-secondary);
		line-height: 1.65;
		margin-bottom: 2.5rem;
	}

	.cta-hub-buttons {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.btn-cta-large {
		padding: 0.95rem 1.8rem;
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		transition: all var(--t-spring);
	}

	.btn-cta-large:hover {
		transform: translateY(-3px) scale(1.02);
	}

	/* ══════════════════════════════════════════════════════════════════
	   UTILIDADES DE COLORWAY NEO-AERO
	   ══════════════════════════════════════════════════════════════════ */
	.text-cyan {
		color: var(--aero-sky);
	}
	.text-emerald {
		color: var(--aero-mint);
	}
	.text-rose {
		color: var(--aero-rose);
	}
	.text-amber {
		color: var(--aero-amber);
	}

	.bg-cyan-glass {
		background: rgba(var(--accent-sky-rgb, 46, 180, 255), 0.12);
		border-color: rgba(var(--accent-sky-rgb, 46, 180, 255), 0.3) !important;
	}
	.bg-emerald-glass {
		background: rgba(var(--aero-mint-rgb, 0, 212, 170), 0.12);
		border-color: rgba(var(--aero-mint-rgb, 0, 212, 170), 0.3) !important;
	}
	.bg-rose-glass {
		background: rgba(var(--aero-rose-rgb, 236, 72, 153), 0.12);
		border-color: rgba(var(--aero-rose-rgb, 236, 72, 153), 0.3) !important;
	}
	.bg-amber-glass {
		background: rgba(var(--aero-amber-rgb, 245, 166, 35), 0.12);
		border-color: rgba(var(--aero-amber-rgb, 245, 166, 35), 0.3) !important;
	}

	.code-tag {
		font-family: monospace;
		font-size: 0.85em;
		padding: 0.15rem 0.45rem;
		border-radius: var(--radius-xs);
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid var(--border-subtle);
		color: var(--aero-sky);
	}

	/* Responsive tweaks */
	@media (max-width: 640px) {
		.hero-showcase {
			padding: 3rem 1.2rem;
		}
		.hero-metrics-bar {
			flex-direction: column;
			gap: 0.6rem;
		}
		.metric-divider {
			display: none;
		}
		.ecosystem-tab-viewport {
			padding: 1.5rem 1rem;
		}
		.privacy-box {
			padding: 2rem 1.2rem;
		}
		.privacy-header-content {
			flex-direction: column;
			text-align: center;
		}
		.cta-hub-card {
			padding: 3rem 1.2rem;
		}
	}
</style>
