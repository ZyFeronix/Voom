<script>
	import { fade, scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import CustomSelect from '$lib/components/CustomSelect.svelte';

	let {
		rtcStore,
		chatStore,
		onCloseDeviceSetup,
		onConfirmDeviceSetup,
		onUpdatePreview,
		onEndCall,
		onToggleMic,
		onToggleCam,
		onStartScreenShare,
		onAcceptCall,
		onDeclineCall
	} = $props();

	let camOptions = $derived(
		(rtcStore.availableCams || []).map((cam) => ({
			value: cam.deviceId,
			label: cam.label || `Cámara ${cam.deviceId.slice(0, 5)}`,
			icon: 'videocam'
		}))
	);

	let micOptions = $derived(
		(rtcStore.availableMics || []).map((mic) => ({
			value: mic.deviceId,
			label: mic.label || `Micrófono ${mic.deviceId.slice(0, 5)}`,
			icon: 'mic'
		}))
	);

	function srcObject(node, stream) {
		node.srcObject = stream;
		return {
			update(s) {
				node.srcObject = s;
			}
		};
	}

	function formatDuration(secs) {
		const h = Math.floor(secs / 3600);
		const m = Math.floor((secs % 3600) / 60);
		const s = secs % 60;
		if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
		return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	}
</script>

<!-- ════════════════════════════════════════════════════════════════════ -->
<!-- Device Setup Modal                                                   -->
<!-- ════════════════════════════════════════════════════════════════════ -->
{#if rtcStore.showDeviceSetup}
	<div class="rtc-modal-overlay" style="z-index: 10000;" transition:fade={{ duration: 200 }}>
		<div
			class="rtc-modal-glass"
			style="max-width: 400px; padding: 24px;"
			transition:scale={{ duration: 300, easing: backOut, start: 0.9 }}
		>
			<div class="rtc-header" style="padding: 0; margin-bottom: 16px; border-bottom: none;">
				<h2 style="font-size: 1.25rem; margin:0;">Configuración de llamada</h2>
				<button
					class="aero-icon-btn text-white/70 hover:text-white"
					onclick={onCloseDeviceSetup}
					title="Cancelar"><span class="material-icons-round">close</span></button
				>
			</div>

			<div class="flex flex-col gap-4">
				<!-- Preview -->
				<div
					class="relative w-full rounded-2xl overflow-hidden bg-black/50 aspect-video flex items-center justify-center border border-white/10 shadow-inner"
				>
					{#if rtcStore.previewStream && rtcStore.pendingCallType === 'video'}
						<video
							use:srcObject={rtcStore.previewStream}
							autoplay
							muted
							playsinline
							class="w-full h-full object-cover"
						></video>
					{:else}
						<div class="flex flex-col items-center justify-center text-white/50">
							<span class="material-icons-round text-4xl mb-2"
								>{rtcStore.pendingCallType === 'video'
									? 'videocam_off'
									: rtcStore.pendingCallType === 'screen'
										? 'present_to_all'
										: 'mic'}</span
							>
						</div>
					{/if}
				</div>

				<!-- Selectors -->
				<div class="flex flex-col gap-3">
					{#if rtcStore.availableCams.length > 0 && rtcStore.pendingCallType === 'video'}
						<div class="flex flex-col gap-1">
							<label for="cam-select" class="text-xs text-muted font-medium">Cámara</label>
							<CustomSelect
								id="cam-select"
								bind:value={rtcStore.selectedCamId}
								options={camOptions}
								onchange={onUpdatePreview}
								icon="videocam"
							/>
						</div>
					{/if}

					{#if rtcStore.availableMics.length > 0}
						<div class="flex flex-col gap-1">
							<label for="mic-select" class="text-xs text-muted font-medium">Micrófono</label>
							<CustomSelect
								id="mic-select"
								bind:value={rtcStore.selectedMicId}
								options={micOptions}
								onchange={onUpdatePreview}
								icon="mic"
							/>
						</div>
					{/if}
				</div>

				<div class="mt-2">
					<button
						class="btn-aero-primary w-full py-2.5 flex items-center justify-center gap-2"
						onclick={onConfirmDeviceSetup}
						aria-label="Unirse"
					>
						<span class="material-icons-round text-[18px]"
							>{rtcStore.pendingCallType === 'screen'
								? 'present_to_all'
								: rtcStore.pendingCallType === 'video'
									? 'videocam'
									: 'call'}</span
						>
						Unirse a la llamada
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- ════════════════════════════════════════════════════════════════════ -->
<!-- WebRTC Call Modal Overlay                                          -->
<!-- ════════════════════════════════════════════════════════════════════ -->
{#if rtcStore.showCallModal}
	<div class="rtc-modal-overlay" transition:fade={{ duration: 200 }}>
		<div class="rtc-modal-glass" transition:scale={{ duration: 300, easing: backOut, start: 0.9 }}>
			<!-- Header -->
			<div class="rtc-header">
				<div class="flex items-center gap-2">
					<span class="material-icons-round text-sm" style="color: var(--accent-blue-base)">
						{rtcStore.callType === 'screen'
							? 'present_to_all'
							: rtcStore.callType === 'video'
								? 'videocam'
								: 'call'}
					</span>
					<h3 class="font-bold text-sm m-0">
						{rtcStore.callType === 'screen'
							? 'Compartiendo pantalla'
							: rtcStore.callType === 'video'
								? 'Videollamada'
								: 'Llamada de audio'}
					</h3>
					<span class="rtc-duration">{formatDuration(rtcStore.callDurationSecs)}</span>
				</div>
				<button
					class="aero-icon-btn !w-7 !h-7 bg-transparent hover:bg-white/10"
					title="Minimizar"
					onclick={() => (rtcStore.showCallModal = false)}
				>
					<span class="material-icons-round text-sm">minimize</span>
				</button>
			</div>

			<!-- Video Grid -->
			<div
				class="rtc-video-grid"
				class:multi={rtcStore.remoteStreams.length > 0 && rtcStore.callType !== 'audio'}
			>
				<!-- Local feed -->
				{#if rtcStore.callType === 'screen' && rtcStore.localStream}
					<div class="rtc-video-wrapper">
						<video use:srcObject={rtcStore.localStream} autoplay muted playsinline class="rtc-video"
						></video>
						<span class="rtc-label">Tu pantalla</span>
					</div>
				{:else if rtcStore.callType === 'video' && rtcStore.localStream}
					<div class="rtc-video-wrapper rtc-self-cam">
						<video
							use:srcObject={rtcStore.localStream}
							autoplay
							muted
							playsinline
							class="rtc-video"
							style={rtcStore.camMuted ? 'filter:brightness(0.2)' : ''}
						></video>
						<span class="rtc-label">Tú</span>
						{#if rtcStore.camMuted}
							<div class="rtc-cam-off-overlay">
								<span class="material-icons-round">videocam_off</span>
							</div>
						{/if}
					</div>
				{:else}
					<!-- Audio-only placeholder -->
					<div class="rtc-audio-pulse">
						<div
							class="rtc-avatar-ring"
							style={rtcStore.micMuted ? 'border-color:rgba(255,100,100,.4)' : ''}
						>
							{#if chatStore.activeConv?.peer_avatar}
								<img
									src={chatStore.activeConv.peer_avatar}
									alt={chatStore.activeConv.peer_display_name}
									class="w-full h-full object-cover squircle"
									width="80"
									height="80"
									loading="lazy"
									decoding="async"
								/>
							{:else}
								<span class="material-icons-round" style="font-size:2.5rem;"
									>{rtcStore.micMuted ? 'mic_off' : 'mic'}</span
								>
							{/if}
						</div>
						<p class="text-sm font-semibold mt-2" style="color: var(--text-primary);">
							{chatStore.activeConv?.peer_display_name ||
								chatStore.activeConv?.peer_username ||
								'Participante'}
						</p>
						{#if rtcStore.remoteStreams.length === 0}
							<p class="text-xs text-muted">Llamando...</p>
						{:else}
							<p class="text-xs" style="color:var(--accent-blue-base);">Conectado ✓</p>
						{/if}
					</div>
				{/if}

				<!-- Remote feeds -->
				{#each rtcStore.remoteStreams as rs (rs.peerId)}
					<div class="rtc-video-wrapper">
						<video use:srcObject={rs.stream} autoplay playsinline class="rtc-video"></video>
						<span class="rtc-label"
							>{chatStore.activeConv?.peer_display_name ||
								chatStore.activeConv?.peer_username ||
								'Peer'}</span
						>
					</div>
				{/each}
			</div>

			<!-- Controls Bar -->
			<div class="rtc-controls">
				<!-- Mute / Unmute Mic -->
				<button
					class="rtc-btn"
					class:rtc-btn-active={rtcStore.micMuted}
					onclick={onToggleMic}
					title={rtcStore.micMuted ? 'Activar micrófono' : 'Silenciar micrófono'}
					aria-label={rtcStore.micMuted ? 'Activar micrófono' : 'Silenciar micrófono'}
				>
					<span class="material-icons-round">{rtcStore.micMuted ? 'mic_off' : 'mic'}</span>
				</button>

				<!-- Toggle Camera (if not audio-only) -->
				{#if rtcStore.callType !== 'audio'}
					<button
						class="rtc-btn"
						class:rtc-btn-active={rtcStore.camMuted}
						onclick={onToggleCam}
						title={rtcStore.camMuted ? 'Encender cámara' : 'Apagar cámara'}
						aria-label={rtcStore.camMuted ? 'Encender cámara' : 'Apagar cámara'}
					>
						<span class="material-icons-round"
							>{rtcStore.camMuted ? 'videocam_off' : 'videocam'}</span
						>
					</button>
				{/if}

				<!-- Share Screen (if not screen share already) -->
				{#if rtcStore.callType !== 'screen'}
					<button
						class="rtc-btn"
						onclick={onStartScreenShare}
						title="Compartir pantalla"
						aria-label="Compartir pantalla"
					>
						<span class="material-icons-round">present_to_all</span>
					</button>
				{/if}

				<!-- Hangup -->
				<button
					class="rtc-btn hangup"
					onclick={onEndCall}
					title="Colgar"
					aria-label="Finalizar llamada"
				>
					<span class="material-icons-round">call_end</span>
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- ════════════════════════════════════════════════════════════════════ -->
<!-- Incoming Call Notification (Aero Toast)                             -->
<!-- ════════════════════════════════════════════════════════════════════ -->
{#if rtcStore.incomingCall}
	<div
		class="incoming-call-toast"
		transition:fade={{ duration: 250 }}
		role="alert"
		aria-live="assertive"
	>
		<div class="flex items-center gap-3">
			<div class="incoming-call-icon" style="animation: ring-bounce 0.6s infinite alternate;">
				<span class="material-icons-round text-white text-xl"
					>{rtcStore.incomingCall.callType === 'video' ? 'videocam' : 'call'}</span
				>
			</div>
			<div class="flex flex-col min-w-0">
				<span class="text-xs font-bold uppercase tracking-wider text-emerald-400">
					{rtcStore.incomingCall.callType === 'video' ? 'Videollamada' : 'Llamada de audio'} entrante
				</span>
				<span class="text-sm font-semibold truncate" style="color: var(--text-primary);">
					{chatStore.conversations.find((c) => c.peer_id === rtcStore.incomingCall.callerId)
						?.peer_display_name ||
						chatStore.conversations.find((c) => c.peer_id === rtcStore.incomingCall.callerId)
							?.peer_username ||
						'Usuario'}
				</span>
			</div>
		</div>

		<div class="flex gap-2 mt-1">
			<button class="rtc-answer-btn accept" onclick={onAcceptCall} aria-label="Aceptar llamada">
				<span class="material-icons-round text-base">call</span>
				Aceptar
			</button>
			<button class="rtc-answer-btn decline" onclick={onDeclineCall} aria-label="Rechazar llamada">
				<span class="material-icons-round text-base">call_end</span>
				Rechazar
			</button>
		</div>
	</div>
{/if}

<!-- ════════════════════════════════════════════════════════════════════ -->
<!-- Minimized Active Call Badge                                         -->
<!-- ════════════════════════════════════════════════════════════════════ -->
{#if rtcStore.isInCall && !rtcStore.showCallModal}
	<button
		class="rtc-minimized-badge"
		onclick={() => (rtcStore.showCallModal = true)}
		title="Expandir llamada activa"
		aria-label="Expandir llamada activa"
		transition:fade={{ duration: 200 }}
	>
		<span class="material-icons-round" style="font-size:1rem; color:#4ade80;"
			>fiber_manual_record</span
		>
		<span>{formatDuration(rtcStore.callDurationSecs)}</span>
		<span class="material-icons-round text-sm">open_in_full</span>
	</button>
{/if}

<style>
	/* ── WebRTC call UI styling ── */
	.rtc-modal-overlay {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal-backdrop);
		background: rgba(10, 25, 47, 0.65);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
	}

	.rtc-modal-glass {
		position: relative;
		width: 480px;
		max-width: 100%;
		background: var(--bg-surface-solid, rgba(15, 23, 42, 0.9));
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		padding: 20px;
		box-shadow:
			0 20px 50px rgba(0, 0, 0, 0.25),
			inset 0 1px 0 var(--glass-border-t, rgba(255, 255, 255, 0.15));
		display: flex;
		flex-direction: column;
		gap: 16px;
		overflow: hidden;
	}
	.rtc-modal-glass::before {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--noise-texture);
		opacity: 0.02;
		pointer-events: none;
		z-index: 1;
	}

	.rtc-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		color: var(--text-primary);
		z-index: 2;
	}

	.rtc-video-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 12px;
		width: 100%;
		z-index: 2;
	}
	.rtc-video-grid.multi {
		grid-template-columns: 1fr 1fr;
	}

	.rtc-video-wrapper {
		position: relative;
		aspect-ratio: 16/9;
		border-radius: var(--radius-md);
		overflow: hidden;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid var(--border-subtle);
		box-shadow: var(--shadow-sm);
	}

	.rtc-video {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.rtc-label {
		position: absolute;
		bottom: 8px;
		left: 8px;
		background: rgba(10, 25, 47, 0.75);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		color: #fff;
		padding: 3px 8px;
		border-radius: var(--radius-xs);
		font-size: 0.7rem;
		font-weight: 600;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.rtc-audio-pulse {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 24px 20px;
		background: var(--bg-surface);
		border-radius: var(--radius-md);
		border: 1px solid var(--border-subtle);
		color: var(--accent-blue-base);
		position: relative;
		z-index: 2;
	}

	.rtc-avatar-ring {
		width: 72px;
		height: 72px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		border: 3px solid rgba(var(--accent-blue-rgb), 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--accent-blue-base);
		overflow: hidden;
		animation: pulseGlow 2s ease-in-out infinite;
		box-shadow:
			0 0 0 6px rgba(var(--accent-blue-rgb), 0.08),
			0 0 0 12px rgba(var(--accent-blue-rgb), 0.03);
	}

	.rtc-duration {
		font-size: 0.72rem;
		font-variant-numeric: tabular-nums;
		color: var(--accent-blue-base);
		background: rgba(var(--accent-blue-rgb), 0.1);
		border: 1px solid rgba(var(--accent-blue-rgb), 0.2);
		border-radius: var(--radius-sm);
		padding: 2px 8px;
		font-weight: 600;
	}

	.rtc-self-cam {
		position: relative;
	}
	.rtc-cam-off-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.5);
		color: rgba(255, 255, 255, 0.6);
		font-size: 2rem;
		border-radius: inherit;
	}

	@keyframes pulseGlow {
		0%,
		100% {
			transform: scale(1);
			box-shadow:
				0 0 0 6px rgba(var(--accent-blue-rgb), 0.08),
				0 0 0 12px rgba(var(--accent-blue-rgb), 0.03);
		}
		50% {
			transform: scale(1.04);
			box-shadow:
				0 0 0 10px rgba(var(--accent-blue-rgb), 0.12),
				0 0 0 18px rgba(var(--accent-blue-rgb), 0.05);
		}
	}

	.rtc-controls {
		display: flex;
		justify-content: center;
		gap: 12px;
		z-index: 2;
	}

	.rtc-btn {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-primary);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		cursor: pointer;
		transition:
			transform var(--t-spring),
			background var(--t-base),
			box-shadow var(--t-base);
	}
	.rtc-btn:hover {
		transform: translateY(-2px) scale(1.06);
		background: var(--bg-surface-hover);
	}
	.rtc-btn:active {
		transform: scale(0.95);
	}
	.rtc-btn.rtc-btn-active {
		background: rgba(239, 68, 68, 0.15) !important;
		border-color: rgba(239, 68, 68, 0.4);
		color: #ef4444;
	}
	.rtc-btn.hangup {
		background: linear-gradient(135deg, #ef4444, #dc2626) !important;
		box-shadow: 0 4px 16px rgba(239, 68, 68, 0.35);
		color: #ffffff;
		border: none;
	}
	.rtc-btn.hangup:hover {
		box-shadow: 0 6px 20px rgba(239, 68, 68, 0.5);
	}

	.incoming-call-toast {
		position: fixed;
		bottom: 90px;
		right: 20px;
		background: var(--bg-surface-solid, rgba(8, 20, 40, 0.94));
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		padding: 16px;
		box-shadow:
			0 10px 40px rgba(0, 0, 0, 0.35),
			0 0 0 1px rgba(var(--accent-blue-rgb), 0.08);
		z-index: var(--z-critical);
		width: 280px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.incoming-call-icon {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: linear-gradient(135deg, #22c55e, #16a34a);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		box-shadow: 0 0 14px rgba(34, 197, 94, 0.35);
	}

	@keyframes ring-bounce {
		from {
			transform: scale(1) rotate(-8deg);
		}
		to {
			transform: scale(1.08) rotate(8deg);
		}
	}

	.rtc-answer-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		flex: 1;
		padding: 7px 10px;
		border-radius: var(--radius-sm);
		font-size: 0.76rem;
		font-weight: 700;
		border: none;
		cursor: pointer;
		color: #fff;
		transition:
			transform var(--t-spring),
			box-shadow var(--t-base);
	}
	.rtc-answer-btn.accept {
		background: linear-gradient(135deg, #22c55e, #16a34a);
		box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);
	}
	.rtc-answer-btn.decline {
		background: linear-gradient(135deg, #ef4444, #dc2626);
		box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);
	}
	.rtc-answer-btn:hover {
		transform: translateY(-1px) scale(1.03);
	}
	.rtc-answer-btn:active {
		transform: scale(0.97);
	}

	.rtc-minimized-badge {
		position: fixed;
		bottom: 80px;
		right: 20px;
		background: var(--bg-surface-solid, rgba(8, 20, 40, 0.92));
		backdrop-filter: blur(12px);
		border: 1px solid rgba(74, 222, 128, 0.3);
		border-radius: var(--radius-xl);
		padding: 6px 14px;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--text-main);
		cursor: pointer;
		z-index: var(--z-critical);
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
		transition:
			transform var(--t-spring),
			box-shadow var(--t-base);
	}
	.rtc-minimized-badge:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5);
	}
	.aero-icon-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 4px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.2s;
	}
</style>
