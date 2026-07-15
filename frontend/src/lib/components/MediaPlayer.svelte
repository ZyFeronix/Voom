<script>
	let { src, type = 'video', poster = null, class: className = '', autoplay = false, entityId = null, entityType = null } = $props();

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
	
	// New features inspired by svelte-video-player
	let buffered = $state();
	let isBuffering = $state(false);
	let timelineHoverPercent = $state(0);
	let isHoveringTimeline = $state(false);
	
	let contextMenu = $state({ show: false, x: 0, y: 0 });
	let centerAction = $state({ show: false, icon: 'play_arrow', id: 0 });
	
	import { activity as activityApi } from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	let viewLogged = false;

	let progressPercentage = $derived(duration > 0 ? (currentTime / duration) * 100 : 0);
	let volumePercentage = $derived(muted ? 0 : volume * 100);
	let hoverTime = $derived(duration * timelineHoverPercent);
	
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
		centerAction = { show: true, icon, id: Date.now() };
		setTimeout(() => {
			if (centerAction.id === centerAction.id) {
				centerAction.show = false;
			}
		}, 600);
	}

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
	
	function handleMouseMove() {
		if (type === 'audio') return;
		showControls = true;
		clearTimeout(hideTimeout);
		if (!paused && !showSettings && !showVolumeSlider && !isDraggingTimeline && !contextMenu.show) {
			hideTimeout = setTimeout(() => { showControls = false; }, 2500);
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
			const updateMeta = () => { duration = videoElement.duration || 0; };
			const updateTime = () => {
				if (!isDraggingTimeline && !isDraggingAudioTimeline) {
					currentTime = videoElement.currentTime || 0;
				}
			};
			videoElement.addEventListener('loadedmetadata', updateMeta);
			videoElement.addEventListener('durationchange', updateMeta);
			videoElement.addEventListener('timeupdate', updateTime);
			return () => {
				videoElement.removeEventListener('loadedmetadata', updateMeta);
				videoElement.removeEventListener('durationchange', updateMeta);
				videoElement.removeEventListener('timeupdate', updateTime);
			};
		}
	});


	function formatTime(seconds) {
		if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
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
		if (!playerWrapper?.contains(document.activeElement) && document.activeElement !== playerWrapper) return;
		
		switch(e.key) {
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
		} catch (err) {}
		closeContextMenu();
	}
</script>

<svelte:window onkeydown={handleKeyDown} onclick={() => { closeContextMenu(); showSettings = false; }} onpointermove={onWindowPointerMove} onpointerup={onWindowPointerUp} />

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
		<div class="v-video-container" onclick={handleVideoClick} ondblclick={toggleFullscreen} aria-hidden="true">
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
				onwaiting={() => isBuffering = true}
				onplaying={() => isBuffering = false}
				oncanplay={() => isBuffering = false}
				class="v-native-video"
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
			</div>
		{/if}

		<div class="v-controls-overlay" class:visible={showControls} onclick={(e) => e.stopPropagation()} aria-hidden="true">
			{#if showSettings}
				<div class="v-settings-menu">
					<div class="v-settings-header">Velocidad</div>
					<div class="v-settings-row">
						{#each [0.5, 1, 1.5, 2] as speed}
							<button class="v-speed-btn" class:active={playbackRate === speed} onclick={() => changeSpeed(speed)}>
								{speed}x
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<div class="v-bottom-bar">
				<button class="v-ctrl-btn" onclick={togglePlay} aria-label={paused ? 'Reproducir' : 'Pausar'}>
					<span class="material-icons-round">{paused ? 'play_arrow' : 'pause'}</span>
				</button>
				
				<button class="v-ctrl-btn v-vol-hover" aria-label="Volumen">
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<span class="material-icons-round" onclick={toggleMute}>{muted || volume === 0 ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}</span>
					<div class="v-vol-slider-container">
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div 
							class="v-vol-track" 
							onpointerdown={startVolumeDrag}
						>
							<div class="v-vol-progress" style="width: {volumePercentage}%"></div>
							<div class="v-vol-thumb" style="left: {volumePercentage}%"></div>
						</div>
					</div>
				</button>
				
				<span class="v-time-display">{formatTime(currentTime)} / {formatTime(duration)}</span>

				<div 
					class="v-timeline-container" 
					role="slider"
					tabindex="0"
					aria-valuemin="0"
					aria-valuemax={duration}
					aria-valuenow={currentTime}
					onpointerenter={() => isHoveringTimeline = true}
					onpointerleave={() => isHoveringTimeline = false}
					onpointermove={(e) => {
						const rect = e.currentTarget.getBoundingClientRect();
						timelineHoverPercent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
						if (isDraggingTimeline) {
							// fallback direct visual update if not using window pointer
							timelineHoverPercent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
						}
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

				<button class="v-ctrl-btn" onclick={(e) => { e.stopPropagation(); showSettings = !showSettings; }} aria-label="Configuración">
					<span class="material-icons-round" style="transform: rotate({showSettings ? 45 : 0}deg); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);">settings</span>
				</button>
				<button class="v-ctrl-btn" onclick={toggleFullscreen} aria-label="Pantalla completa">
					<span class="material-icons-round">fullscreen</span>
				</button>
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
				crossorigin="anonymous"
			></audio>
			
			<button class="v-audio-play" onclick={togglePlay} aria-label={paused ? 'Reproducir audio' : 'Pausar audio'}>
				<span class="material-icons-round" style="font-size: 20px;">{paused ? 'play_arrow' : 'pause'}</span>
			</button>
			
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="v-audio-timeline" onpointerdown={startAudioTimelineDrag}>
				<div class="v-audio-track">
					<div class="v-audio-progress" style="width: {progressPercentage}%"></div>
				</div>
			</div>
			
			<span class="v-audio-time">{formatTime(currentTime)}</span>
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
		background: rgba(0,0,0,0.5);
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
	.v-action-ripple .material-icons-round { font-size: 40px; }
	
	@keyframes rippleAction {
		0% { transform: translate(-50%, -50%) scale(0.6); opacity: 1; }
		50% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
		100% { transform: translate(-50%, -50%) scale(1.3); opacity: 0; }
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
		border: 4px solid rgba(255,255,255,0.2);
		border-top-color: var(--aero-blue);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.v-context-menu {
		position: absolute;
		background: rgba(20, 20, 20, 0.85);
		backdrop-filter: blur(20px) saturate(1.5);
		-webkit-backdrop-filter: blur(20px) saturate(1.5);
		border: 1px solid rgba(255,255,255,0.1);
		border-radius: var(--radius-md);
		padding: 6px;
		min-width: 180px;
		box-shadow: 0 10px 40px rgba(0,0,0,0.5);
		display: flex;
		flex-direction: column;
		gap: 2px;
		z-index: 30;
		animation: fadeInScale 0.15s cubic-bezier(0.16, 1, 0.3, 1);
		transform-origin: top left;
	}
	@keyframes fadeInScale {
		from { opacity: 0; transform: scale(0.95); }
		to { opacity: 1; transform: scale(1); }
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
	.v-context-item:hover { background: rgba(255,255,255,0.15); }
	.v-context-item .material-icons-round { font-size: 18px; color: var(--text-muted); }

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
		bottom: 60px;
		right: 16px;
		background: rgba(20, 20, 20, 0.85);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border: 1px solid rgba(255,255,255,0.1);
		border-radius: var(--radius-md);
		padding: 12px;
		color: #fff;
		box-shadow: 0 8px 32px rgba(0,0,0,0.5);
		display: flex;
		flex-direction: column;
		gap: 8px;
		animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
		transform-origin: bottom right;
		z-index: 20;
		pointer-events: auto;
	}
	@keyframes popIn {
		0% { opacity: 0; transform: scale(0.9) translateY(10px); }
		100% { opacity: 1; transform: scale(1) translateY(0); }
	}
	.v-settings-header {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 4px;
	}
	.v-settings-row { display: flex; gap: 4px; }
	.v-speed-btn {
		background: rgba(255,255,255,0.1);
		border: none;
		color: #fff;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 0.8rem;
		font-family: var(--font-mono, monospace);
		cursor: pointer;
		transition: all 0.2s;
	}
	.v-speed-btn:hover { background: rgba(255,255,255,0.2); }
	.v-speed-btn.active { background: var(--grad-primary); font-weight: bold; }

	.v-bottom-bar {
		position: relative;
		width: 100%;
		min-height: 48px;
		padding: 8px 12px;
		background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0) 100%);
		display: flex;
		align-items: center;
		gap: 8px;
		pointer-events: auto;
		transform: translateY(100%);
		visibility: hidden;
		transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.4s;
	}
	.v-controls-overlay.visible .v-bottom-bar {
		transform: translateY(0);
		visibility: visible;
	}

	.v-timeline-container {
		flex-grow: 1;
		height: 24px;
		display: flex;
		align-items: center;
		cursor: pointer;
		position: relative;
		touch-action: none;
		margin: 0 4px;
	}
	.v-timeline-track {
		width: 100%;
		height: 4px;
		background: rgba(255,255,255,0.25);
		border-radius: 2px;
		position: relative;
		transition: height 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s;
	}
	.v-timeline-container:hover .v-timeline-track {
		height: 6px;
		border-radius: 3px;
	}
	.v-timeline-buffer {
		position: absolute;
		top: 0; left: 0; bottom: 0;
		background: rgba(255,255,255,0.4);
		border-radius: inherit;
		transition: width 0.2s;
	}
	.v-timeline-progress {
		position: absolute;
		top: 0; left: 0; bottom: 0;
		background: var(--aero-blue);
		border-radius: inherit;
		box-shadow: 0 0 10px rgba(46,134,232,0.4);
	}
	.v-timeline-thumb {
		position: absolute;
		top: 50%;
		width: 14px;
		height: 14px;
		background: #fff;
		border-radius: 50%;
		transform: translate(-50%, -50%) scale(0);
		transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
		box-shadow: 0 0 8px rgba(0,0,0,0.4);
		pointer-events: none;
	}
	.v-timeline-container:hover .v-timeline-thumb { transform: translate(-50%, -50%) scale(1); }
	
	.v-timeline-tooltip {
		position: absolute;
		bottom: 150%;
		transform: translateX(-50%);
		background: rgba(0,0,0,0.8);
		color: #fff;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 0.75rem;
		font-family: var(--font-mono, monospace);
		font-weight: 500;
		pointer-events: none;
		white-space: nowrap;
		box-shadow: 0 2px 8px rgba(0,0,0,0.5);
		animation: fadeInScale 0.15s cubic-bezier(0.16, 1, 0.3, 1);
	}

	/* Deleted old .v-controls-row blocks */

	.v-ctrl-btn {
		background: transparent;
		border: none;
		color: #fff;
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		border-radius: 50%;
		transition: background 0.2s, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}
	.v-ctrl-btn:hover {
		background: rgba(255,255,255,0.15);
	}
	.v-ctrl-btn:active { transform: scale(0.85); }
	.v-ctrl-btn .material-icons-round { 
		font-size: 24px; 
		text-shadow: 0 2px 6px rgba(0,0,0,0.5); 
	}

	.v-time-display {
		color: #fff;
		font-size: 0.8rem;
		font-family: var(--font-mono, monospace);
		margin-left: 8px;
		font-weight: 500;
		opacity: 0.9;
		pointer-events: none;
		text-shadow: 0 1px 4px rgba(0,0,0,0.8);
	}

	.v-vol-hover {
		display: flex;
		align-items: center;
		width: auto;
		border-radius: 18px;
		padding: 0 6px;
	}
	.v-vol-hover:hover { background: rgba(255,255,255,0.15); }
	.v-vol-slider-container {
		width: 0;
		height: 36px;
		overflow: hidden;
		transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s, margin 0.3s;
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
		background: rgba(255,255,255,0.3);
		border-radius: 2px;
		position: relative;
		cursor: pointer;
		display: flex;
		align-items: center;
		touch-action: none;
	}
	.v-vol-progress {
		position: absolute;
		left: 0; top: 0; bottom: 0;
		background: var(--aero-blue);
		border-radius: inherit;
	}
	.v-vol-thumb {
		position: absolute;
		width: 12px; height: 12px;
		background: #fff;
		border-radius: 50%;
		transform: translate(-50%, 0);
		box-shadow: 0 0 6px rgba(0,0,0,0.3);
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
	:global(body.dark) .v-audio-pill { background: rgba(255, 255, 255, 0.05); }

	.v-audio-play {
		width: 36px; height: 36px;
		flex-shrink: 0;
		border-radius: 50%;
		background: var(--grad-primary);
		color: #fff;
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 4px 10px rgba(46,134,232,0.3);
		transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}
	.v-audio-play:hover { transform: scale(1.08); }
	.v-audio-timeline {
		flex: 1; height: 24px; display: flex; align-items: center; cursor: pointer; touch-action: none;
	}
	.v-audio-track {
		width: 100%; height: 4px; background: rgba(120,120,120,0.3); border-radius: 2px; position: relative; overflow: hidden;
	}
	.v-audio-progress {
		position: absolute; top: 0; left: 0; bottom: 0; background: var(--aero-blue); border-radius: 2px;
	}
	.v-audio-time { font-size: 0.75rem; font-family: var(--font-mono, monospace); color: var(--text-primary); font-weight: 600; }
</style>
