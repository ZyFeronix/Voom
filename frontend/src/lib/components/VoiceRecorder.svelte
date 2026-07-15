<script>
	import { onMount, onDestroy } from 'svelte';
	import { fade, scale, fly } from 'svelte/transition';
	import { backOut } from 'svelte/easing';

	let { onrecorded, oncancel, variant = 'default' } = $props();

	let mediaRecorder = null;
	let audioChunks = [];
	let isRecording = $state(false);
	let isPaused = $state(false);
	let hasStarted = $state(false);
	let devices = $state([]);
	let selectedDeviceId = $state('');
	let showMicDropdown = $state(false);
	let recordingTime = $state(0);
	let timerInterval = null;
	let stream = null;

	async function startRecording() {
		const constraints = {
			audio: {
				deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
				echoCancellation: false,
				noiseSuppression: false,
				autoGainControl: false
			}
		};
		
		try {
			if (stream) stopTracks();
			
			stream = await navigator.mediaDevices.getUserMedia(constraints);
			let options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 };
			if (typeof MediaRecorder !== 'undefined' && !MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
				options = { mimeType: 'audio/webm', audioBitsPerSecond: 128000 };
				if (!MediaRecorder.isTypeSupported('audio/webm')) {
					options = {};
				}
			}
			if (selectedDeviceId) localStorage.setItem('vsocial_mic_id', selectedDeviceId);

			mediaRecorder = new MediaRecorder(stream, options);
			audioChunks = [];

			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					audioChunks.push(event.data);
				}
			};

			mediaRecorder.onstop = () => {
				const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
				if (onrecorded && audioBlob.size > 0) {
					onrecorded(audioBlob);
				}
				stopTracks();
			};

			mediaRecorder.start();
			hasStarted = true;
			isRecording = true;
			isPaused = false;
			recordingTime = 0;
			
			timerInterval = setInterval(() => {
				if (!isPaused) recordingTime++;
			}, 1000);
		} catch (error) {
			console.error("Error accessing microphone:", error);
			alert("No se pudo acceder al micrófono. Por favor revisa los permisos.");
			if (oncancel) oncancel();
		}
	}

	function stopRecording() {
		if (mediaRecorder && isRecording) {
			mediaRecorder.stop();
			isRecording = false;
			clearInterval(timerInterval);
		}
	}

	function cancelRecording() {
		if (mediaRecorder && isRecording) {
			mediaRecorder.onstop = null;
			try { mediaRecorder.stop(); } catch(e) {}
		}
		stopTracks();
		isRecording = false;
		clearInterval(timerInterval);
		if (oncancel) oncancel();
	}

	function stopTracks() {
		if (stream) {
			stream.getTracks().forEach(track => track.stop());
			stream = null;
		}
	}

	function togglePause() {
		if (!mediaRecorder) return;
		if (isPaused) {
			mediaRecorder.resume();
			isPaused = false;
		} else {
			mediaRecorder.pause();
			isPaused = true;
		}
	}

	function selectDevice(id) {
		selectedDeviceId = id;
		showMicDropdown = false;
	}

	function formatTime(seconds) {
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m}:${s < 10 ? '0' : ''}${s}`;
	}

	onMount(async () => {
		try {
			const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const allDevices = await navigator.mediaDevices.enumerateDevices();
			devices = allDevices.filter(d => d.kind === 'audioinput');
			
			const savedDevice = localStorage.getItem('vsocial_mic_id');
			if (savedDevice && devices.find(d => d.deviceId === savedDevice)) {
				selectedDeviceId = savedDevice;
			} else if (devices.length > 0) {
				selectedDeviceId = devices[0].deviceId;
			}

			// Stop temporary permission stream
			tempStream.getTracks().forEach(track => track.stop());
		} catch (error) {
			console.error("Error permissions:", error);
			if (oncancel) oncancel();
		}
	});

	onDestroy(() => {
		cancelRecording();
	});
</script>

<svelte:window onclick={(e) => {
	if (showMicDropdown && !e.target.closest('.custom-select-wrapper')) {
		showMicDropdown = false;
	}
}} />

<div class="voice-recorder-container variant-{variant}">
	{#if !hasStarted}
		<div class="setup-indicator">
			<div class="mic-icon-wrapper">
				<span class="material-icons-round text-muted mic-icon-svg">mic</span>
			</div>
			
			<div style="flex: 1; min-width: 0;">
				<div class="custom-select-wrapper">
					<button 
						class="custom-select-trigger" 
						onclick={() => showMicDropdown = !showMicDropdown}
						type="button"
					>
						<span class="truncate" style="min-width: 0; flex: 1; text-align: left;">{devices.find(d => d.deviceId === selectedDeviceId)?.label || 'Seleccionar micrófono...'}</span>
						<span class="material-icons-round" style="font-size: 16px; margin-left: 4px; transition: transform 0.2s; flex-shrink: 0;" class:rotate={showMicDropdown}>expand_more</span>
					</button>

					{#if showMicDropdown}

						<div class="custom-dropdown-menu-container">
							<div class="custom-dropdown-menu" transition:fly={{ y: 10, duration: 200, easing: backOut }}>
								{#each devices as device}
									<button 
										class="dropdown-item" 
										class:active={device.deviceId === selectedDeviceId}
										onclick={() => selectDevice(device.deviceId)}
										type="button"
									>
										<span class="material-icons-round check-icon" style="flex-shrink: 0;">{device.deviceId === selectedDeviceId ? 'check' : ''}</span>
										<span class="truncate" style="min-width: 0; flex: 1; text-align: left;">{device.label || 'Micrófono desconocido'}</span>
									</button>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
		<div class="actions">
			<button class="action-btn cancel-btn" onclick={cancelRecording} title="Cancelar">
				<span class="material-icons-round" style="font-size: 18px;">close</span>
			</button>
			<button class="action-btn start-btn" onclick={startRecording} title="Iniciar grabación">
				<span class="material-icons-round" style="font-size: 18px;">mic</span>
			</button>
		</div>
	{:else}
		<div class="recording-indicator">
			<div style="flex: 0 0 32px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
				<div class="pulse-dot" class:paused={isPaused}></div>
			</div>
			<span class="recording-time font-bold font-mono">{formatTime(recordingTime)}</span>
		</div>
		
		<div class="actions">
			<button class="action-btn pause-btn" onclick={togglePause} title={isPaused ? "Reanudar" : "Pausar"}>
				<span class="material-icons-round" style="font-size: 18px;">{isPaused ? 'play_arrow' : 'pause'}</span>
			</button>
			
			<button class="action-btn cancel-btn" onclick={cancelRecording} title="Cancelar">
				<span class="material-icons-round" style="font-size: 18px;">delete</span>
			</button>
			
			<button class="action-btn stop-btn" onclick={stopRecording} title="Enviar nota de voz">
				<span class="material-icons-round" style="font-size: 18px;">send</span>
			</button>
		</div>
	{/if}
</div>

<style>
	.voice-recorder-container {
		position: relative;
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: rgba(255, 255, 255, 0.05);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid rgba(27, 133, 243, 0.5);
		border-radius: 20px;
		padding: 2px 4px 2px 2px;
		gap: 4px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1);
		min-width: 200px;
		width: 100%;
		box-sizing: border-box;
		min-height: 44px;
		height: auto;
	}

	.voice-recorder-container.variant-compact {
		background: transparent;
		backdrop-filter: none;
		-webkit-backdrop-filter: none;
		border: none;
		box-shadow: none;
		padding: 0;
		height: auto;
		min-width: 0;
	}

	.mic-icon-wrapper {
		flex: 0 0 32px;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.mic-icon-svg {
		font-size: 18px;
	}

	.variant-compact .mic-icon-wrapper {
		flex: 0 0 32px;
		width: 32px;
		height: 32px;
	}

	.variant-compact .mic-icon-svg {
		font-size: 16px;
	}

	.recording-indicator {
		display: flex;
		align-items: center;
		gap: 4px;
		flex: 1;
	}

	.pulse-dot {
		width: 10px;
		height: 10px;
		background-color: #ef4444; /* red-500 */
		border-radius: 50%;
		box-shadow: 0 0 8px rgba(239, 68, 68, 0.8);
		animation: pulse 1.5s infinite ease-in-out;
	}

	.recording-time {
		color: var(--text-main);
		font-size: 0.85rem;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px !important;
		height: 32px !important;
		min-width: 32px !important;
		min-height: 32px !important;
		max-width: 32px !important;
		max-height: 32px !important;
		flex: 0 0 32px !important;
		border-radius: 50% !important;
		border: none !important;
		cursor: pointer;
		transition: all var(--t-fast);
		color: white;
		padding: 0 !important;
		margin: 0 !important;
		aspect-ratio: 1 / 1 !important;
		box-sizing: border-box !important;
		overflow: hidden !important;
	}

	.cancel-btn {
		background: rgba(239, 68, 68, 0.2);
		color: #ef4444;
	}

	.cancel-btn:hover {
		background: #ef4444;
		color: white;
		box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
	}

	.stop-btn {
		background: linear-gradient(135deg, var(--aero-sky), var(--aero-blue));
		box-shadow: 0 4px 12px rgba(27, 133, 243, 0.3);
	}

	.stop-btn:hover {
		transform: scale(1.05);
		box-shadow: 0 6px 16px rgba(27, 133, 243, 0.5);
	}

	@keyframes pulse {
		0% {
			transform: scale(0.95);
			box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
		}
		70% {
			transform: scale(1);
			box-shadow: 0 0 0 6px rgba(239, 68, 68, 0);
		}
		100% {
			transform: scale(0.95);
			box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
		}
	}

	.pulse-dot.paused {
		animation-play-state: paused;
		background: var(--aero-amber, #f5a623);
		box-shadow: none;
	}

	.pause-btn {
		background: rgba(255, 255, 255, 0.15);
		color: var(--text-primary);
	}

	.pause-btn:hover {
		background: rgba(255, 255, 255, 0.25);
	}

	.setup-indicator {
		display: flex;
		align-items: center;
		gap: 4px;
		flex: 1;
		min-width: 0;
	}

	.custom-select-wrapper {
		position: relative;
		display: block;
		width: 100%;
		min-width: 0;
	}

	.custom-select-trigger {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid var(--glass-border);
		color: var(--text-primary);
		padding: 6px 12px;
		border-radius: 12px;
		font-size: 0.85rem;
		outline: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		min-width: 0;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.variant-compact .custom-select-trigger {
		border-radius: 20px;
		padding: 8px 16px;
	}

	.custom-select-trigger:hover, .custom-select-trigger:focus {
		background: rgba(255, 255, 255, 0.1);
		border-color: var(--aero-sky);
	}

	.custom-select-trigger .rotate {
		transform: rotate(180deg);
	}



	.custom-dropdown-menu-container {
		position: absolute;
		bottom: calc(100% + 12px);
		left: 0;
		width: 100%;
		z-index: 100;
	}

	.custom-dropdown-menu {
		width: 100%;
		background: rgba(15, 23, 42, 0.85);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border: 1px solid var(--glass-border);
		border-radius: 16px;
		padding: 6px;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		gap: 8px;
		background: transparent;
		border: none;
		color: var(--text-secondary);
		padding: 8px 12px;
		border-radius: 10px;
		cursor: pointer;
		font-size: 0.85rem;
		text-align: left;
		transition: all 0.2s ease;
		width: 100%;
	}

	.dropdown-item:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-primary);
	}

	.dropdown-item.active {
		background: rgba(27, 133, 243, 0.15);
		color: var(--aero-sky);
	}

	.dropdown-item .check-icon {
		font-size: 16px;
		width: 16px;
	}

	.truncate {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.start-btn {
		background: var(--aero-amber, #f5a623);
		box-shadow: 0 4px 12px rgba(245, 166, 35, 0.3);
	}

	.start-btn:hover {
		transform: scale(1.05);
		box-shadow: 0 6px 16px rgba(245, 166, 35, 0.5);
	}
</style>
