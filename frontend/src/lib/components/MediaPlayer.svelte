<script module>
	// Registro global de players activos: garantiza que solo uno reproduzca a la vez
	// y evita que decenas de <video> del feed decodifiquen en paralelo (causa de trabones).
	const activePlayers = new Set();

	function pauseOthers(current) {
		for (const el of activePlayers) {
			if (el !== current && !el.paused) {
				try {
					el.pause();
				} catch (_) {}
			}
		}
	}
</script>

<script>
	import { activity as activityApi } from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';

	let {
		src,
		type = 'video',
		poster = null,
		class: className = '',
		autoplay = false,
		entityId = null,
		entityType = null
	} = $props();

	let playerWrapper = $state();
	let videoElement = $state();
	let paused = $state(true);
	let currentTime = $state(0);
	let duration = $state(0);
	let volume = $state(1);
	let muted = $state(false);

	let showControls = $state(true);
	let hideTimeout;
	let showSettings = $state(false);
	let showVolumeSlider = $state(false);
	let playbackRate = $state(1);
	let showRemaining = $state(false);
	let showAbout = $state(false);
	let aboutClosing = $state(false);
	let aboutCloseTimer;

	function openAbout() {
		clearTimeout(aboutCloseTimer);
		aboutClosing = false;
		showAbout = true;
	}
	function closeAbout() {
		if (!showAbout) return;
		// Dispara la animación de fade-out y desmonta al terminar
		aboutClosing = true;
		clearTimeout(aboutCloseTimer);
		aboutCloseTimer = setTimeout(() => {
			showAbout = false;
			aboutClosing = false;
		}, 260);
	}

	// New features inspired by svelte-video-player
	let buffered = $state();
	let isBuffering = $state(false);
	let timelineHoverPercent = $state(0);
	let isHoveringTimeline = $state(false);

	let contextMenu = $state({ show: false, x: 0, y: 0 });
	let centerAction = $state({ show: false, icon: 'play_arrow', id: 0 });

	// ── Rendimiento: pausar fuera de viewport + reanudar ────────────────────
	let wasPlayingBeforeHidden = false;
	let viewLogged = false;

	let progressPercentage = $derived(duration > 0 ? (currentTime / duration) * 100 : 0);
	let volumePercentage = $derived(muted ? 0 : volume * 100);
	let hoverTime = $derived(duration * timelineHoverPercent);
	let remainingTime = $derived(Math.max(0, duration - currentTime));

	let bufferPercentage = $derived.by(() => {
		if (!buffered || buffered.length === 0 || duration === 0) return 0;
		// Find the farthest buffered range
		let maxBuffer = 0;
		for (let i = 0; i < buffered.length; i++) {
			if (buffered[i].end > maxBuffer) {
				maxBuffer = buffered[i].end;
			}
		}
		return (maxBuffer / duration) * 100;
	});

	function triggerCenterAnimation(icon) {
		const id = ++centerActionCounter;
		centerAction = { show: true, icon, id };
		setTimeout(() => {
			// Solo ocultar si sigue siendo la misma animación (no una más reciente)
			if (centerAction.id === id) {
				centerAction = { ...centerAction, show: false };
			}
		}, 600);
	}
	let centerActionCounter = 0;

	function togglePlay(e) {
		if (e) e.stopPropagation();
		if (!videoElement) return;
		if (paused) {
			videoElement.play();
			triggerCenterAnimation('play_arrow');
		} else {
			videoElement.pause();
			triggerCenterAnimation('pause');
		}
	}

	// ── Registro de visualización (una sola vez, tras ~3s de reproducción) ──
	function maybeLogView() {
		if (viewLogged || !entityId || !entityType || !authStore?.isAuthenticated) return;
		if (currentTime < 3 && progressPercentage < 25) return;
		viewLogged = true;
		activityApi.view({ entity_type: entityType, entity_id: entityId }).catch(() => {});
	}

	// ── Skip ±N segundos ────────────────────────────────────────────────────
	function skip(seconds) {
		if (!videoElement || !duration) return;
		videoElement.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
		currentTime = videoElement.currentTime;
		triggerCenterAnimation(seconds > 0 ? 'forward_10' : 'replay_10');
	}

	function handleVideoDblTap(e) {
		// Doble-tap lateral: izquierda = -10s, derecha = +10s
		if (type === 'audio' || !playerWrapper) return;
		const rect = playerWrapper.getBoundingClientRect();
		const x = e.clientX - rect.left;
		if (x < rect.width / 3) {
			skip(-10);
		} else if (x > (rect.width * 2) / 3) {
			skip(10);
		} else {
			toggleFullscreen(e);
		}
	}

	function handleMouseMove() {
		if (type === 'audio') return;
		showControls = true;
		clearTimeout(hideTimeout);
		if (!paused && !showSettings && !showVolumeSlider && !isDraggingTimeline && !contextMenu.show) {
			hideTimeout = setTimeout(() => {
				showControls = false;
			}, 2500);
		}
	}

	function handleMouseLeave() {
		if (type === 'audio') return;
		if (!paused && !showSettings && !showVolumeSlider && !isDraggingTimeline && !contextMenu.show) {
			showControls = false;
		}
		showSettings = false;
	}

	$effect(() => {
		if (paused) {
			showControls = true;
			clearTimeout(hideTimeout);
		} else {
			handleMouseMove();
		}
	});

	$effect(() => {
		if (videoElement) {
			if (videoElement.readyState >= 1) {
				duration = videoElement.duration || 0;
				currentTime = videoElement.currentTime || 0;
			}
			const el = videoElement;
			activePlayers.add(el);

			const updateMeta = () => {
				duration = el.duration || 0;
			};
			const updateTime = () => {
				if (!isDraggingTimeline && !isDraggingAudioTimeline) {
					currentTime = el.currentTime || 0;
				}
				maybeLogView();
			};
			// Al reproducir, pausar cualquier otro player activo (solo uno suena a la vez)
			const onPlay = () => {
				pauseOthers(el);
				syncMediaSession();
			};
			const onPause = () => syncMediaSession();

			el.addEventListener('loadedmetadata', updateMeta);
			el.addEventListener('durationchange', updateMeta);
			el.addEventListener('timeupdate', updateTime);
			el.addEventListener('play', onPlay);
			el.addEventListener('pause', onPause);
			return () => {
				el.removeEventListener('loadedmetadata', updateMeta);
				el.removeEventListener('durationchange', updateMeta);
				el.removeEventListener('timeupdate', updateTime);
				el.removeEventListener('play', onPlay);
				el.removeEventListener('pause', onPause);
				activePlayers.delete(el);
			};
		}
	});

	// ── IntersectionObserver: pausar fuera de viewport, reanudar al volver ──
	$effect(() => {
		if (!playerWrapper || type === 'audio') return;
		const wrapper = playerWrapper;
		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (!entry.isIntersecting) {
					// Fuera de vista: si estaba reproduciendo, pausar y recordar
					if (videoElement && !videoElement.paused) {
						wasPlayingBeforeHidden = true;
						videoElement.pause();
					}
				} else if (wasPlayingBeforeHidden && videoElement) {
					// De vuelta a la vista: reanudar solo si el usuario no lo había pausado
					wasPlayingBeforeHidden = false;
					videoElement.play().catch(() => {});
				}
			},
			{ threshold: 0.35 }
		);
		observer.observe(wrapper);
		return () => observer.disconnect();
	});

	// ── Media Session API: controles del SO / auriculares ──────────────────
	function syncMediaSession() {
		if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !videoElement) return;
		try {
			navigator.mediaSession.playbackState = videoElement.paused ? 'paused' : 'playing';
		} catch (_) {}
	}

	$effect(() => {
		if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || type === 'audio')
			return;
		const ms = navigator.mediaSession;
		const handlers = {
			play: () => videoElement?.play(),
			pause: () => videoElement?.pause(),
			seekbackward: () => skip(-10),
			seekforward: () => skip(10)
		};
		for (const [action, fn] of Object.entries(handlers)) {
			try {
				ms.setActionHandler(action, fn);
			} catch (_) {}
		}
		return () => {
			for (const action of Object.keys(handlers)) {
				try {
					ms.setActionHandler(action, null);
				} catch (_) {}
			}
		};
	});

	function formatTime(seconds) {
		if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	let isDraggingTimeline = $state(false);
	let isDraggingVolume = $state(false);
	let isDraggingAudioTimeline = $state(false);

	let timelineRect = $state(null);
	let volumeRect = $state(null);
	let audioTimelineRect = $state(null);
	let wasPaused = $state(false);

	function onWindowPointerMove(e) {
		if (isDraggingTimeline && timelineRect) {
			const x = e.clientX - timelineRect.left;
			const percent = Math.max(0, Math.min(1, x / timelineRect.width));
			currentTime = percent * duration;
			if (videoElement) videoElement.currentTime = currentTime;
			timelineHoverPercent = percent;
		}
		if (isDraggingAudioTimeline && audioTimelineRect) {
			const x = e.clientX - audioTimelineRect.left;
			const percent = Math.max(0, Math.min(1, x / audioTimelineRect.width));
			currentTime = percent * duration;
			if (videoElement) videoElement.currentTime = currentTime;
		}
		if (isDraggingVolume && volumeRect) {
			const x = e.clientX - volumeRect.left;
			let percent = Math.max(0, Math.min(1, x / volumeRect.width));
			volume = percent;
			muted = volume === 0;
		}
	}

	function onWindowPointerUp() {
		if (isDraggingTimeline) {
			isDraggingTimeline = false;
			if (!wasPaused && videoElement) videoElement.play();
		}
		if (isDraggingAudioTimeline) {
			isDraggingAudioTimeline = false;
			if (!wasPaused && videoElement) videoElement.play();
		}
		if (isDraggingVolume) {
			isDraggingVolume = false;
		}
	}

	function startTimelineDrag(e) {
		e.preventDefault();
		timelineRect = e.currentTarget.getBoundingClientRect();
		isDraggingTimeline = true;
		wasPaused = paused;
		paused = true;
		onWindowPointerMove(e);
	}

	function startVolumeDrag(e) {
		e.preventDefault();
		volumeRect = e.currentTarget.getBoundingClientRect();
		isDraggingVolume = true;
		onWindowPointerMove(e);
	}

	function startAudioTimelineDrag(e) {
		e.preventDefault();
		audioTimelineRect = e.currentTarget.getBoundingClientRect();
		isDraggingAudioTimeline = true;
		wasPaused = paused;
		paused = true;
		onWindowPointerMove(e);
	}

	function toggleMute(e) {
		if (e) e.stopPropagation();
		muted = !muted;
		if (!muted && volume === 0) volume = 1;
	}

	function toggleFullscreen(e) {
		if (e) e.stopPropagation();
		if (!videoElement || !playerWrapper) return;
		if (document.fullscreenElement) {
			document.exitFullscreen();
		} else {
			if (playerWrapper.requestFullscreen) {
				playerWrapper.requestFullscreen();
			} else if (playerWrapper.webkitRequestFullscreen) {
				playerWrapper.webkitRequestFullscreen();
			}
		}
	}

	function handleKeyDown(e) {
		if (
			!playerWrapper?.contains(document.activeElement) &&
			document.activeElement !== playerWrapper
		)
			return;

		switch (e.key) {
			case 'Escape':
				if (showAbout) {
					e.preventDefault();
					closeAbout();
				}
				break;
			case ' ':
			case 'k':
				e.preventDefault();
				togglePlay();
				break;
			case 'f':
				e.preventDefault();
				toggleFullscreen();
				break;
			case 'm':
				e.preventDefault();
				toggleMute();
				break;
			case 'ArrowRight':
				e.preventDefault();
				if (videoElement) {
					videoElement.currentTime = Math.min(duration, currentTime + 5);
					currentTime = videoElement.currentTime;
					triggerCenterAnimation('forward_5');
				}
				break;
			case 'ArrowLeft':
				e.preventDefault();
				if (videoElement) {
					videoElement.currentTime = Math.max(0, currentTime - 5);
					currentTime = videoElement.currentTime;
					triggerCenterAnimation('replay_5');
				}
				break;
			case 'ArrowUp':
				e.preventDefault();
				volume = Math.min(1, volume + 0.1);
				if (volume > 0) muted = false;
				break;
			case 'ArrowDown':
				e.preventDefault();
				volume = Math.max(0, volume - 0.1);
				if (volume === 0) muted = true;
				break;
		}
		handleMouseMove();
	}

	function changeSpeed(speed) {
		playbackRate = speed;
		if (videoElement) videoElement.playbackRate = speed;
		showSettings = false;
	}

	// Navegación de la timeline con teclado (accesibilidad)
	function handleTimelineKey(e) {
		switch (e.key) {
			case 'ArrowRight':
				e.preventDefault();
				skip(5);
				break;
			case 'ArrowLeft':
				e.preventDefault();
				skip(-5);
				break;
			case 'Home':
				e.preventDefault();
				if (videoElement) {
					videoElement.currentTime = 0;
					currentTime = 0;
				}
				break;
			case 'End':
				e.preventDefault();
				if (videoElement && duration) {
					videoElement.currentTime = duration;
					currentTime = duration;
				}
				break;
		}
	}

	async function togglePiP(e) {
		if (e) e.stopPropagation();
		if (document.pictureInPictureElement) {
			await document.exitPictureInPicture();
		} else if (videoElement) {
			await videoElement.requestPictureInPicture();
		}
		showSettings = false;
		contextMenu.show = false;
	}

	function handleContextMenu(e) {
		if (type === 'audio') return;
		e.preventDefault();
		const wrapperRect = playerWrapper.getBoundingClientRect();
		let x = e.clientX - wrapperRect.left;
		let y = e.clientY - wrapperRect.top;

		if (x + 200 > wrapperRect.width) x = wrapperRect.width - 200;
		if (y + 150 > wrapperRect.height) y = wrapperRect.height - 150;

		contextMenu = { show: true, x, y };
	}

	function closeContextMenu() {
		contextMenu.show = false;
	}

	function handleVideoClick(e) {
		closeContextMenu();
		showSettings = false;
		togglePlay(e);
	}

	function toggleLoop() {
		if (videoElement) {
			videoElement.loop = !videoElement.loop;
		}
		closeContextMenu();
	}

	async function copyVideoUrl() {
		try {
			await navigator.clipboard.writeText(window.location.href);
		} catch (_err) {}
		closeContextMenu();
	}
</script>

<svelte:window
	onkeydown={handleKeyDown}
	onclick={() => {
		closeContextMenu();
		showSettings = false;
	}}
	onpointermove={onWindowPointerMove}
	onpointerup={onWindowPointerUp}
/>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	bind:this={playerWrapper}
	class="media-player-wrapper {className} {type}"
	role="region"
	aria-label="Reproductor multimedia"
	tabindex="0"
	onmousemove={handleMouseMove}
	onmouseleave={handleMouseLeave}
	oncontextmenu={handleContextMenu}
	style="cursor: {!showControls && !paused ? 'none' : 'default'};"
>
	{#if type === 'video'}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="v-video-container" onclick={handleVideoClick} ondblclick={handleVideoDblTap}>
			<!-- svelte-ignore a11y_media_has_caption -->
			<video
				bind:this={videoElement}
				{src}
				{poster}
				{autoplay}
				bind:paused
				bind:volume
				bind:muted
				bind:buffered
				onwaiting={() => (isBuffering = true)}
				onplaying={() => (isBuffering = false)}
				oncanplay={() => (isBuffering = false)}
				class="v-native-video"
				preload="metadata"
				playsinline
				crossorigin="anonymous"
			></video>
		</div>

		{#if isBuffering}
			<div class="v-spinner-container">
				<div class="v-spinner"></div>
			</div>
		{/if}

		{#if centerAction.show}
			<div class="v-action-ripple">
				<span class="material-icons-round">{centerAction.icon}</span>
			</div>
		{/if}

		{#if contextMenu.show}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="v-context-menu"
				style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
				onclick={(e) => e.stopPropagation()}
			>
				<button class="v-context-item" onclick={toggleLoop}>
					<span class="material-icons-round">loop</span>
					<span>{videoElement?.loop ? 'Desactivar Bucle' : 'Bucle'}</span>
				</button>
				<button class="v-context-item" onclick={copyVideoUrl}>
					<span class="material-icons-round">link</span>
					<span>Copiar URL del video</span>
				</button>
				<button class="v-context-item" onclick={togglePiP}>
					<span class="material-icons-round">picture_in_picture_alt</span>
					<span>Picture in Picture</span>
				</button>
				<div class="v-context-divider"></div>
				<button
					class="v-context-item"
					onclick={(e) => {
						e.stopPropagation();
						openAbout();
						closeContextMenu();
					}}
				>
					<span class="material-icons-round">info</span>
					<span>Acerca de este reproductor</span>
				</button>
			</div>
		{/if}

		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="v-controls-overlay"
			class:visible={showControls}
			onclick={(e) => e.stopPropagation()}
		>
			{#if showSettings}
				<div class="v-settings-menu">
					<div class="v-settings-header">Velocidad</div>
					<div class="v-settings-row">
						{#each [0.5, 1, 1.5, 2] as speed}
							<button
								class="v-speed-btn"
								class:active={playbackRate === speed}
								onclick={() => changeSpeed(speed)}
							>
								{speed}x
							</button>
						{/each}
					</div>
					<div class="v-settings-divider"></div>
					<button
						class="v-settings-about-btn"
						onclick={(e) => {
							e.stopPropagation();
							openAbout();
							showSettings = false;
						}}
					>
						<span class="material-icons-round">info</span>
						<span>Acerca de este reproductor</span>
					</button>
				</div>
			{/if}

			<div class="v-bottom-bar">
				<!-- Timeline a lo ancho (arriba de los botones) -->
				<div
					class="v-timeline-container"
					role="slider"
					tabindex="0"
					aria-label="Barra de progreso"
					aria-valuemin="0"
					aria-valuemax={duration}
					aria-valuenow={currentTime}
					onkeydown={handleTimelineKey}
					onpointerenter={() => (isHoveringTimeline = true)}
					onpointerleave={() => (isHoveringTimeline = false)}
					onpointermove={(e) => {
						const rect = e.currentTarget.getBoundingClientRect();
						timelineHoverPercent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
					}}
					onpointerdown={startTimelineDrag}
				>
					<div class="v-timeline-track">
						<div class="v-timeline-buffer" style="width: {bufferPercentage}%"></div>
						<div class="v-timeline-progress" style="width: {progressPercentage}%"></div>
						<div class="v-timeline-thumb" style="left: {progressPercentage}%"></div>
						{#if isHoveringTimeline && duration > 0}
							<div class="v-timeline-tooltip" style="left: {timelineHoverPercent * 100}%">
								{formatTime(hoverTime)}
							</div>
						{/if}
					</div>
				</div>

				<div class="v-buttons-row">
					<button
						class="v-ctrl-btn"
						onclick={togglePlay}
						aria-label={paused ? 'Reproducir' : 'Pausar'}
					>
						<span class="material-icons-round">{paused ? 'play_arrow' : 'pause'}</span>
					</button>

					<button
						class="v-ctrl-btn v-hide-narrow"
						onclick={(e) => {
							e.stopPropagation();
							skip(-10);
						}}
						aria-label="Retroceder 10 segundos"
					>
						<span class="material-icons-round">replay_10</span>
					</button>
					<button
						class="v-ctrl-btn v-hide-narrow"
						onclick={(e) => {
							e.stopPropagation();
							skip(10);
						}}
						aria-label="Avanzar 10 segundos"
					>
						<span class="material-icons-round">forward_10</span>
					</button>

					<button class="v-ctrl-btn v-vol-hover" aria-label="Volumen">
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<span class="material-icons-round" onclick={toggleMute}
							>{muted || volume === 0
								? 'volume_off'
								: volume < 0.5
									? 'volume_down'
									: 'volume_up'}</span
						>
						<div class="v-vol-slider-container">
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div class="v-vol-track" onpointerdown={startVolumeDrag}>
								<div class="v-vol-progress" style="width: {volumePercentage}%"></div>
								<div class="v-vol-thumb" style="left: {volumePercentage}%"></div>
							</div>
						</div>
					</button>

					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<span
						class="v-time-display"
						onclick={(e) => {
							e.stopPropagation();
							showRemaining = !showRemaining;
						}}
						title="Alternar tiempo restante"
					>
						{#if showRemaining}
							-{formatTime(remainingTime)}
						{:else}
							{formatTime(currentTime)} / {formatTime(duration)}
						{/if}
					</span>

					<span class="v-spacer"></span>

					<button
						class="v-ctrl-btn v-hide-narrow"
						onclick={togglePiP}
						aria-label="Picture in Picture"
					>
						<span class="material-icons-round">picture_in_picture_alt</span>
					</button>
					<button
						class="v-ctrl-btn"
						onclick={(e) => {
							e.stopPropagation();
							showSettings = !showSettings;
						}}
						aria-label="Configuración"
					>
						<span
							class="material-icons-round"
							style="transform: rotate({showSettings
								? 45
								: 0}deg); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);">settings</span
						>
					</button>
					<button class="v-ctrl-btn" onclick={toggleFullscreen} aria-label="Pantalla completa">
						<span class="material-icons-round">fullscreen</span>
					</button>
				</div>
			</div>
		</div>
	{:else}
		<div class="v-audio-pill" onclick={(e) => e.stopPropagation()} aria-hidden="true">
			<audio
				bind:this={videoElement}
				{src}
				{autoplay}
				bind:paused
				bind:volume
				bind:muted
				preload="metadata"
				crossorigin="anonymous"
			></audio>

			<button
				class="v-audio-play"
				onclick={togglePlay}
				aria-label={paused ? 'Reproducir audio' : 'Pausar audio'}
			>
				<span class="material-icons-round" style="font-size: 20px;"
					>{paused ? 'play_arrow' : 'pause'}</span
				>
			</button>

			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="v-audio-timeline"
				class:dragging={isDraggingAudioTimeline}
				onpointerdown={startAudioTimelineDrag}
			>
				<div class="v-audio-track">
					<div class="v-audio-progress" style="width: {progressPercentage}%"></div>
					<div class="v-audio-thumb" style="left: {progressPercentage}%"></div>
				</div>
			</div>

			<span class="v-audio-time">{formatTime(currentTime)} / {formatTime(duration)}</span>
		</div>
	{/if}

	{#if showAbout}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="v-about-backdrop"
			class:closing={aboutClosing}
			onclick={(e) => {
				e.stopPropagation();
				closeAbout();
			}}
		>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="v-about-panel" class:closing={aboutClosing} onclick={(e) => e.stopPropagation()}>
				<button class="v-about-close" onclick={closeAbout} aria-label="Cerrar"></button>
				<div class="v-about-logo">
					<span class="material-icons-round">play_circle</span>
				</div>
				<div class="v-about-title">Reproductor de VSocial</div>
				<div class="v-about-info" class:closing={aboutClosing}>
					<div class="v-about-version">Versión v0.5 Alpha</div>
					<div class="v-about-copy">© 2026 VSocial · AGPLv3</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.media-player-wrapper {
		position: relative;
		width: 100%;
		border-radius: var(--radius-md);
		overflow: hidden;
		background: #000;
		display: flex;
		align-items: center;
		justify-content: center;
		isolation: isolate;
		border: 1px solid var(--glass-border);
		box-shadow: var(--shadow-sm);
		outline: none;
		max-height: 80vh;
	}

	/* Cuando el player es un video de feed (no reels), dejar que el padre controle la altura */
	.media-player-wrapper.video-solo,
	.media-player-wrapper.video-grid {
		max-height: none;
	}

	.v-video-container {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: inherit;
	}

	.v-native-video {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
		background: #000;
	}

	.media-player-wrapper.audio {
		background: transparent;
		border-radius: 40px;
		overflow: visible;
		border: none;
		box-shadow: none;
		display: block;
		max-height: none;
	}

	.v-action-ripple {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 72px;
		height: 72px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		animation: rippleAction 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
		z-index: 15;
	}
	.v-action-ripple .material-icons-round {
		font-size: 40px;
	}

	@keyframes rippleAction {
		0% {
			transform: translate(-50%, -50%) scale(0.6);
			opacity: 1;
		}
		50% {
			transform: translate(-50%, -50%) scale(1.1);
			opacity: 1;
		}
		100% {
			transform: translate(-50%, -50%) scale(1.3);
			opacity: 0;
		}
	}

	/* Spinner de carga */
	.v-spinner-container {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 14;
		pointer-events: none;
	}
	.v-spinner {
		width: 48px;
		height: 48px;
		border: 4px solid rgba(255, 255, 255, 0.2);
		border-top-color: var(--aero-blue);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.v-context-menu {
		position: absolute;
		background: rgba(20, 20, 20, 0.85);
		backdrop-filter: blur(20px) saturate(1.5);
		-webkit-backdrop-filter: blur(20px) saturate(1.5);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-md);
		padding: 6px;
		min-width: 180px;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
		display: flex;
		flex-direction: column;
		gap: 2px;
		z-index: 30;
		animation: fadeInScale 0.15s cubic-bezier(0.16, 1, 0.3, 1);
		transform-origin: top left;
	}
	@keyframes fadeInScale {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
	.v-context-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		background: transparent;
		border: none;
		color: #fff;
		font-size: 0.85rem;
		border-radius: 6px;
		cursor: pointer;
		text-align: left;
		transition: background 0.2s;
	}
	.v-context-item:hover {
		background: rgba(255, 255, 255, 0.15);
	}
	.v-context-item .material-icons-round {
		font-size: 18px;
		color: var(--text-muted);
	}
	.v-context-divider {
		height: 1px;
		background: rgba(255, 255, 255, 0.12);
		margin: 4px 6px;
	}

	.v-controls-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		z-index: 10;
		overflow: hidden; /* so bottom bar slides out of view */
	}

	.v-settings-menu {
		position: absolute;
		bottom: 72px;
		right: 16px;
		background: rgba(20, 20, 20, 0.85);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-md);
		padding: 12px;
		color: #fff;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
		display: flex;
		flex-direction: column;
		gap: 8px;
		animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
		transform-origin: bottom right;
		z-index: 20;
		pointer-events: auto;
	}
	@keyframes popIn {
		0% {
			opacity: 0;
			transform: scale(0.9) translateY(10px);
		}
		100% {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}
	.v-settings-header {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 4px;
	}
	.v-settings-row {
		display: flex;
		gap: 4px;
	}
	.v-speed-btn {
		background: rgba(255, 255, 255, 0.1);
		border: none;
		color: #fff;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 0.8rem;
		font-family: var(--font-mono, monospace);
		cursor: pointer;
		transition: all 0.2s;
	}
	.v-speed-btn:hover {
		background: rgba(255, 255, 255, 0.2);
	}
	.v-speed-btn.active {
		background: var(--grad-primary);
		font-weight: bold;
	}

	.v-bottom-bar {
		position: relative;
		width: 100%;
		padding: 24px 14px 10px;
		background: linear-gradient(
			to top,
			rgba(0, 0, 0, 0.88) 0%,
			rgba(0, 0, 0, 0.55) 45%,
			rgba(0, 0, 0, 0) 100%
		);
		display: flex;
		flex-direction: column;
		gap: 6px;
		pointer-events: auto;
		transform: translateY(100%);
		visibility: hidden;
		transition:
			transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
			visibility 0.4s;
	}
	.v-controls-overlay.visible .v-bottom-bar {
		transform: translateY(0);
		visibility: visible;
	}

	.v-buttons-row {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.v-spacer {
		flex: 1;
	}

	.v-timeline-container {
		width: 100%;
		height: 20px;
		display: flex;
		align-items: center;
		cursor: pointer;
		position: relative;
		touch-action: none;
		outline: none;
	}
	.v-timeline-container:focus-visible .v-timeline-track {
		box-shadow: 0 0 0 2px var(--accent-blue-light, #2eb4ff);
	}
	.v-timeline-track {
		width: 100%;
		height: 5px;
		background: rgba(255, 255, 255, 0.22);
		border-radius: 3px;
		position: relative;
		transition: height 0.25s cubic-bezier(0.16, 1, 0.3, 1);
	}
	.v-timeline-container:hover .v-timeline-track {
		height: 8px;
		border-radius: 4px;
	}
	.v-timeline-buffer {
		position: absolute;
		top: 0;
		left: 0;
		bottom: 0;
		background: rgba(255, 255, 255, 0.38);
		border-radius: inherit;
		transition: width 0.2s;
	}
	.v-timeline-progress {
		position: absolute;
		top: 0;
		left: 0;
		bottom: 0;
		background: var(--grad-primary, linear-gradient(90deg, #0ea5e9, #10b981));
		border-radius: inherit;
		box-shadow: 0 0 12px rgba(14, 165, 233, 0.55);
	}
	.v-timeline-thumb {
		position: absolute;
		top: 50%;
		width: 15px;
		height: 15px;
		background: #fff;
		border-radius: 50%;
		transform: translate(-50%, -50%) scale(0);
		transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
		box-shadow:
			0 0 0 4px rgba(14, 165, 233, 0.35),
			0 2px 8px rgba(0, 0, 0, 0.5);
		pointer-events: none;
	}
	.v-timeline-container:hover .v-timeline-thumb,
	.v-timeline-container:focus-visible .v-timeline-thumb {
		transform: translate(-50%, -50%) scale(1);
	}

	.v-timeline-tooltip {
		position: absolute;
		bottom: 180%;
		transform: translateX(-50%);
		background: rgba(0, 0, 0, 0.85);
		color: #fff;
		padding: 4px 8px;
		border-radius: 6px;
		font-size: 0.75rem;
		font-family: var(--font-mono, monospace);
		font-weight: 500;
		pointer-events: none;
		white-space: nowrap;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
		animation: fadeInScale 0.15s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.v-ctrl-btn {
		background: transparent;
		border: none;
		color: #fff;
		width: 38px;
		height: 38px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		border-radius: 50%;
		flex-shrink: 0;
		transition:
			background 0.2s,
			transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}
	.v-ctrl-btn:hover {
		background: rgba(255, 255, 255, 0.18);
	}
	.v-ctrl-btn:active {
		transform: scale(0.85);
	}
	.v-ctrl-btn .material-icons-round {
		font-size: 24px;
		text-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
	}

	.v-time-display {
		color: #fff;
		font-size: 0.8rem;
		font-family: var(--font-mono, monospace);
		margin-left: 6px;
		font-weight: 500;
		opacity: 0.95;
		cursor: pointer;
		user-select: none;
		white-space: nowrap;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
		transition: opacity 0.2s;
	}
	.v-time-display:hover {
		opacity: 1;
	}

	/* En anchos reducidos (reels/grid vertical) ocultar controles secundarios */
	.media-player-wrapper.video-grid .v-hide-narrow {
		display: none;
	}
	@media (max-width: 420px) {
		.v-hide-narrow {
			display: none;
		}
	}

	.v-vol-hover {
		display: flex;
		align-items: center;
		width: auto;
		border-radius: 18px;
		padding: 0 6px;
	}
	.v-vol-hover:hover {
		background: rgba(255, 255, 255, 0.15);
	}
	.v-vol-slider-container {
		width: 0;
		height: 36px;
		overflow: hidden;
		transition:
			width 0.3s cubic-bezier(0.16, 1, 0.3, 1),
			opacity 0.3s,
			margin 0.3s;
		display: flex;
		align-items: center;
		opacity: 0;
		margin-left: 0;
	}
	.v-vol-hover:hover .v-vol-slider-container {
		width: 60px;
		opacity: 1;
		margin-left: 4px;
	}
	.v-vol-track {
		width: 50px;
		height: 4px;
		background: rgba(255, 255, 255, 0.3);
		border-radius: 2px;
		position: relative;
		cursor: pointer;
		display: flex;
		align-items: center;
		touch-action: none;
	}
	.v-vol-progress {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		background: var(--aero-blue);
		border-radius: inherit;
	}
	.v-vol-thumb {
		position: absolute;
		width: 12px;
		height: 12px;
		background: #fff;
		border-radius: 50%;
		transform: translate(-50%, 0);
		box-shadow: 0 0 6px rgba(0, 0, 0, 0.3);
		top: -4px;
	}

	.v-audio-pill {
		display: flex;
		align-items: center;
		gap: 12px;
		background: rgba(0, 0, 0, 0.15);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid var(--glass-border);
		box-shadow: var(--shadow-sm);
		padding: 8px 14px 8px 8px;
		border-radius: 40px;
		width: 100%;
		max-width: 320px;
	}
	:global(body.dark) .v-audio-pill {
		background: rgba(255, 255, 255, 0.05);
	}

	.v-audio-play {
		width: 36px;
		height: 36px;
		flex-shrink: 0;
		border-radius: 50%;
		background: var(--grad-primary);
		color: #fff;
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 4px 10px rgba(46, 134, 232, 0.3);
		transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}
	.v-audio-play:hover {
		transform: scale(1.08);
	}
	.v-audio-timeline {
		flex: 1;
		height: 32px;
		display: flex;
		align-items: center;
		cursor: pointer;
		touch-action: none;
		padding: 4px 0;
	}
	.v-audio-track {
		width: 100%;
		height: 6px;
		background: rgba(120, 120, 120, 0.3);
		border-radius: 4px;
		position: relative;
		transition: height 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}
	.v-audio-timeline:hover .v-audio-track,
	.v-audio-timeline.dragging .v-audio-track {
		height: 9px;
	}
	.v-audio-progress {
		position: absolute;
		top: 0;
		left: 0;
		bottom: 0;
		background: var(--grad-primary, linear-gradient(90deg, #0ea5e9, #10b981));
		border-radius: 4px;
	}
	.v-audio-thumb {
		position: absolute;
		top: 50%;
		width: 15px;
		height: 15px;
		background: #fff;
		border-radius: 50%;
		transform: translate(-50%, -50%);
		box-shadow:
			0 0 0 3px rgba(14, 165, 233, 0.35),
			0 1px 5px rgba(0, 0, 0, 0.35);
		transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.v-audio-timeline:hover .v-audio-thumb {
		transform: translate(-50%, -50%) scale(1.15);
	}
	.v-audio-timeline.dragging .v-audio-thumb {
		transform: translate(-50%, -50%) scale(1.35);
	}
	.v-audio-time {
		font-size: 0.75rem;
		font-family: var(--font-mono, monospace);
		color: var(--text-primary);
		font-weight: 600;
		white-space: nowrap;
	}

	/* ── Menú de ajustes: divisor + botón "Acerca de" ─────────────────────── */
	.v-settings-divider {
		height: 1px;
		background: rgba(255, 255, 255, 0.12);
		margin: 4px -4px 2px;
	}
	.v-settings-about-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 7px 8px;
		background: transparent;
		border: none;
		border-radius: 8px;
		color: rgba(255, 255, 255, 0.85);
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		text-align: left;
		transition:
			background 0.18s,
			color 0.18s;
	}
	.v-settings-about-btn:hover {
		background: rgba(255, 255, 255, 0.12);
		color: #fff;
	}
	.v-settings-about-btn .material-icons-round {
		font-size: 18px;
		opacity: 0.8;
	}

	/* ── Panel "Acerca de" estilo macOS ───────────────────────────────────── */
	.v-about-backdrop {
		position: absolute;
		inset: 0;
		z-index: 40;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		animation: aboutBackdropIn 0.22s ease forwards;
	}
	.v-about-backdrop.closing {
		animation: aboutBackdropOut 0.26s ease forwards;
	}
	@keyframes aboutBackdropIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes aboutBackdropOut {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}

	.v-about-panel {
		position: relative;
		width: min(300px, 82%);
		padding: 30px 26px 22px;
		text-align: center;
		border-radius: 20px;
		background: linear-gradient(160deg, rgba(46, 46, 52, 0.92) 0%, rgba(24, 24, 28, 0.94) 100%);
		border: 1px solid rgba(255, 255, 255, 0.14);
		box-shadow:
			0 24px 60px rgba(0, 0, 0, 0.55),
			inset 0 1px 0 rgba(255, 255, 255, 0.14);
		backdrop-filter: blur(30px) saturate(1.4);
		-webkit-backdrop-filter: blur(30px) saturate(1.4);
		color: #fff;
		animation: aboutPanelIn 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}
	.v-about-panel.closing {
		animation: aboutPanelOut 0.26s cubic-bezier(0.4, 0, 1, 1) forwards;
	}
	@keyframes aboutPanelIn {
		0% {
			opacity: 0;
			transform: scale(0.9) translateY(8px);
		}
		100% {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}
	@keyframes aboutPanelOut {
		0% {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
		100% {
			opacity: 0;
			transform: scale(0.94) translateY(6px);
		}
	}
	.v-about-close {
		position: absolute;
		top: 12px;
		left: 12px;
		width: 13px;
		height: 13px;
		border-radius: 50%;
		border: none;
		background: #ff5f57;
		box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.2);
		cursor: pointer;
		padding: 0;
		transition: filter 0.15s;
	}
	.v-about-close:hover {
		filter: brightness(1.15);
	}
	.v-about-logo {
		width: 68px;
		height: 68px;
		margin: 0 auto 16px;
		border-radius: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--grad-primary, linear-gradient(140deg, #0ea5e9, #10b981));
		box-shadow:
			0 8px 22px rgba(14, 165, 233, 0.4),
			inset 0 1px 0 rgba(255, 255, 255, 0.4);
	}
	.v-about-logo .material-icons-round {
		font-size: 40px;
		color: #fff;
	}
	.v-about-title {
		font-size: 1.05rem;
		font-weight: 700;
		letter-spacing: -0.01em;
		margin-bottom: 4px;
	}
	.v-about-info {
		margin-top: 2px;
		opacity: 1;
		transition: opacity 0.22s ease;
	}
	.v-about-info.closing {
		opacity: 0;
	}
	.v-about-version {
		font-size: 0.82rem;
		color: rgba(255, 255, 255, 0.6);
		font-weight: 500;
		margin-bottom: 14px;
	}
	.v-about-copy {
		font-size: 0.7rem;
		color: rgba(255, 255, 255, 0.4);
		letter-spacing: 0.02em;
	}
</style>
