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

	function callerName() {
		return (
			rtcStore.incomingCallOffer?.callerName ||
			chatStore.conversations.find(
				(c) => Number(c.id) === Number(rtcStore.incomingCallOffer?.conversation_id)
			)?.peer_display_name ||
			'Usuario'
		);
	}
</script>

<!-- ════════════════════════════════════════════════════════════════════ -->
<!-- Device Setup Modal                                                   -->
<!-- ════════════════════════════════════════════════════════════════════ -->
{#if rtcStore.showDeviceSetup}
	<div class="rtc-modal-overlay" style="z-index: 10000;" transition:fade={{ duration: 200 }}>
		<div
			class="rtc-modal-glass setup-modal"
			transition:scale={{ duration: 300, easing: backOut, start: 0.9 }}
		>
			<header class="rtc-setup-header">
				<h2 class="rtc-setup-title">Configuración de llamada</h2>
				<button
					class="rtc-close-btn"
					onclick={onCloseDeviceSetup}
					title="Cancelar"
					aria-label="Cancelar"
				>
					<span class="material-icons-round">close</span>
				</button>
			</header>

			<div class="rtc-setup-body">
				<!-- Preview -->
				<div class="rtc-preview-frame">
					{#if rtcStore.previewStream && rtcStore.pendingCallType === 'video'}
						<video
							use:srcObject={rtcStore.previewStream}
							autoplay
							muted
							playsinline
							class="rtc-video"
						></video>
					{:else}
						<div class="rtc-preview-empty">
							<span class="material-icons-round">
								{rtcStore.pendingCallType === 'video'
									? 'videocam_off'
									: rtcStore.pendingCallType === 'screen'
										? 'present_to_all'
										: 'mic'}
							</span>
						</div>
					{/if}
				</div>

				<!-- Selectors -->
				<div class="rtc-selectors">
					{#if rtcStore.availableCams.length > 0 && rtcStore.pendingCallType === 'video'}
						<div class="rtc-selector-row">
							<label for="cam-select" class="rtc-selector-label">Cámara</label>
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
						<div class="rtc-selector-row">
							<label for="mic-select" class="rtc-selector-label">Micrófono</label>
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

				<button
					class="btn-aero-primary rtc-join-btn"
					onclick={onConfirmDeviceSetup}
					aria-label="Unirse"
				>
					<span class="material-icons-round">
						{rtcStore.pendingCallType === 'screen'
							? 'present_to_all'
							: rtcStore.pendingCallType === 'video'
								? 'videocam'
								: 'call'}
					</span>
					Unirse a la llamada
				</button>
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
			<header class="rtc-call-header">
				<div class="rtc-call-title-wrap">
					<span class="material-icons-round rtc-call-type-icon">
						{rtcStore.callType === 'screen'
							? 'present_to_all'
							: rtcStore.callType === 'video'
								? 'videocam'
								: 'call'}
					</span>
					<h3 class="rtc-call-title">
						{rtcStore.callType === 'screen'
							? 'Compartiendo pantalla'
							: rtcStore.callType === 'video'
								? 'Videollamada'
								: 'Llamada de audio'}
					</h3>
					<span class="rtc-duration">{formatDuration(rtcStore.callDurationSecs)}</span>
				</div>
				<button
					class="rtc-close-btn"
					title="Minimizar"
					onclick={() => (rtcStore.showCallModal = false)}
				>
					<span class="material-icons-round">minimize</span>
				</button>
			</header>

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
									width="80"
									height="80"
									loading="lazy"
									decoding="async"
								/>
							{:else}
								<span class="material-icons-round rtc-audio-fallback-icon"
									>{rtcStore.micMuted ? 'mic_off' : 'mic'}</span
								>
							{/if}
						</div>
						<p class="rtc-peer-name">
							{chatStore.activeConv?.peer_display_name ||
								chatStore.activeConv?.peer_username ||
								'Participante'}
						</p>
						{#if rtcStore.remoteStreams.length === 0}
							<p class="rtc-peer-sub">Llamando...</p>
						{:else}
							<p class="rtc-peer-sub connected">Conectado ✓</p>
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
				<button
					class="rtc-btn"
					class:rtc-btn-active={rtcStore.micMuted}
					onclick={onToggleMic}
					title={rtcStore.micMuted ? 'Activar micrófono' : 'Silenciar micrófono'}
					aria-label={rtcStore.micMuted ? 'Activar micrófono' : 'Silenciar micrófono'}
				>
					<span class="material-icons-round">{rtcStore.micMuted ? 'mic_off' : 'mic'}</span>
				</button>

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
<!-- Incoming Call Notification (Aero Toast)                            -->
<!-- ════════════════════════════════════════════════════════════════════ -->
{#if rtcStore.incomingCallOffer && !rtcStore.inCall}
	<div
		class="incoming-call-toast"
		transition:fade={{ duration: 250 }}
		role="alert"
		aria-live="assertive"
	>
		<div class="incoming-call-row">
			<div class="incoming-call-icon">
				<span class="material-icons-round">
					{rtcStore.incomingCallOffer.callType === 'video' ? 'videocam' : 'call'}
				</span>
			</div>
			<div class="incoming-call-text">
				<span class="incoming-call-kind">
					{rtcStore.incomingCallOffer.callType === 'video' ? 'Videollamada' : 'Llamada de audio'} entrante
				</span>
				<span class="incoming-call-name">{callerName()}</span>
			</div>
		</div>

		<div class="incoming-call-actions">
			<button class="rtc-answer-btn accept" onclick={onAcceptCall} aria-label="Aceptar llamada">
				<span class="material-icons-round">call</span>
				Aceptar
			</button>
			<button class="rtc-answer-btn decline" onclick={onDeclineCall} aria-label="Rechazar llamada">
				<span class="material-icons-round">call_end</span>
				Rechazar
			</button>
		</div>
	</div>
{/if}

<!-- ════════════════════════════════════════════════════════════════════ -->
<!-- Minimized Active Call Badge                                        -->
<!-- ════════════════════════════════════════════════════════════════════ -->
{#if rtcStore.inCall && !rtcStore.showCallModal}
	<button
		class="rtc-minimized-badge"
		onclick={() => (rtcStore.showCallModal = true)}
		title="Expandir llamada activa"
		aria-label="Expandir llamada activa"
		transition:fade={{ duration: 200 }}
	>
		<span class="live-dot" aria-hidden="true"></span>
		<span>{formatDuration(rtcStore.callDurationSecs)}</span>
		<span class="material-icons-round expand-icon">open_in_full</span>
	</button>
{/if}

<style>
	/* ═══════════════════════════════════════════════════════════
	   Voom! Messenger — Llamadas WebRTC "Retro-Aero limpio"
	   Escenario oscuro sólido para vídeo, controles circulares,
	   toast de llamada entrante y badge minimizado.
	   ═══════════════════════════════════════════════════════════ */

	.rtc-modal-overlay {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal-backdrop, 9000);
		background: rgba(4, 10, 22, 0.6);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
	}

	.rtc-modal-glass {
		position: relative;
		width: 480px;
		max-width: 100%;
		background: #0d1828;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 18px;
		padding: 18px;
		box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
		display: flex;
		flex-direction: column;
		gap: 14px;
		color: #ffffff;
	}
	.setup-modal {
		width: 400px;
		background: var(--bg-surface-solid, #0d1828);
		color: var(--text-primary, #ffffff);
	}

	.rtc-setup-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.rtc-setup-title {
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 800;
		margin: 0;
		color: var(--text-primary);
	}
	.rtc-close-btn {
		background: rgba(255, 255, 255, 0.08);
		border: none;
		color: inherit;
		cursor: pointer;
		padding: 0;
		width: 30px;
		height: 30px;
		min-width: 30px;
		min-height: 30px;
		border-radius: var(--radius-full);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s ease;
	}
	.rtc-close-btn:hover {
		background: rgba(255, 255, 255, 0.16);
	}
	.rtc-close-btn:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: 2px;
	}
	.rtc-close-btn .material-icons-round {
		font-size: 16px;
	}

	.rtc-setup-body {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.rtc-preview-frame {
		width: 100%;
		aspect-ratio: 4 / 3;
		border-radius: 14px;
		overflow: hidden;
		background: #060c16;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}
	.rtc-video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.rtc-preview-empty {
		color: rgba(255, 255, 255, 0.35);
	}
	.rtc-preview-empty .material-icons-round {
		font-size: 40px;
	}
	.rtc-selectors {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.rtc-selector-row {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.rtc-selector-label {
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--text-muted);
	}
	.rtc-join-btn {
		width: 100%;
		justify-content: center;
		padding: 12px;
		font-size: 0.88rem;
		border-radius: 13px;
	}

	/* ── Modal de llamada activa ────────────────────────────── */
	.rtc-call-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.rtc-call-title-wrap {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.rtc-call-type-icon {
		font-size: 18px !important;
		color: var(--aero-sky, var(--accent-blue-base));
		flex-shrink: 0;
	}
	.rtc-call-title {
		font-family: var(--font-display);
		font-size: 0.95rem;
		font-weight: 800;
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.rtc-duration {
		font-size: 0.78rem;
		font-weight: 700;
		color: var(--aero-mint, #00d4aa);
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
	}

	.rtc-video-grid {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.rtc-video-grid.multi {
		flex-direction: row;
		flex-wrap: wrap;
	}
	.rtc-video-grid.multi .rtc-video-wrapper {
		flex: 1 1 200px;
	}
	.rtc-video-wrapper {
		position: relative;
		width: 100%;
		aspect-ratio: 4 / 3;
		border-radius: 14px;
		overflow: hidden;
		background: #060c16;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}
	.rtc-video-wrapper.rtc-self-cam {
		width: 220px;
		align-self: flex-end;
		border-radius: 12px;
	}
	.rtc-label {
		position: absolute;
		left: 8px;
		bottom: 8px;
		padding: 3px 9px;
		border-radius: var(--radius-full);
		background: rgba(0, 0, 0, 0.6);
		color: #ffffff;
		font-size: 0.68rem;
		font-weight: 700;
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
	}
	.rtc-cam-off-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(6, 12, 22, 0.85);
		color: rgba(255, 255, 255, 0.5);
	}
	.rtc-cam-off-overlay .material-icons-round {
		font-size: 34px;
	}

	/* Audio: avatar + nombre */
	.rtc-audio-pulse {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 28px 16px 22px;
	}
	.rtc-avatar-ring {
		width: 88px;
		height: 88px;
		border-radius: 50%;
		border: 3px solid rgba(var(--accent-blue-rgb), 0.5);
		padding: 3px;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(var(--accent-blue-rgb), 0.1);
		animation: rtc-ring 2s ease-in-out infinite;
	}
	@keyframes rtc-ring {
		0%,
		100% {
			box-shadow: 0 0 0 0 rgba(var(--accent-blue-rgb), 0.35);
		}
		50% {
			box-shadow: 0 0 0 12px rgba(var(--accent-blue-rgb), 0);
		}
	}
	.rtc-avatar-ring img {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}
	.rtc-audio-fallback-icon {
		font-size: 40px !important;
		color: var(--aero-sky, var(--accent-blue-base));
	}
	.rtc-peer-name {
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 800;
		margin: 0;
	}
	.rtc-peer-sub {
		font-size: 0.76rem;
		color: rgba(255, 255, 255, 0.55);
		margin: 0;
	}
	.rtc-peer-sub.connected {
		color: var(--aero-mint, #00d4aa);
		font-weight: 700;
	}

	/* ── Controles ──────────────────────────────────────────── */
	.rtc-controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 10px;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}
	.rtc-btn {
		width: 46px;
		height: 46px;
		min-width: 46px;
		min-height: 46px;
		border-radius: 50%;
		border: none;
		background: rgba(255, 255, 255, 0.1);
		color: #ffffff;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			background 0.15s ease,
			transform 0.14s var(--ease-spring);
	}
	.rtc-btn:hover {
		background: rgba(255, 255, 255, 0.18);
	}
	.rtc-btn:active {
		transform: scale(0.93);
	}
	.rtc-btn:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: 2px;
	}
	.rtc-btn .material-icons-round {
		font-size: 21px;
	}
	.rtc-btn.rtc-btn-active {
		background: rgba(255, 255, 255, 0.85);
		color: #0d1828;
	}
	.rtc-btn.hangup {
		width: 56px;
		height: 56px;
		min-width: 56px;
		min-height: 56px;
		background: #e5484d;
	}
	.rtc-btn.hangup:hover {
		background: #d63c41;
	}

	/* ── Toast de llamada entrante ──────────────────────────── */
	.incoming-call-toast {
		position: fixed;
		top: 18px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 10001;
		width: min(380px, calc(100vw - 24px));
		background: var(--bg-surface-solid, #0d1828);
		border: 1px solid var(--border-subtle);
		border-radius: 16px;
		box-shadow: 0 18px 50px rgba(0, 0, 0, 0.4);
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.incoming-call-row {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}
	.incoming-call-icon {
		width: 44px;
		height: 44px;
		min-width: 44px;
		border-radius: var(--radius-full);
		background: rgba(var(--accent-blue-rgb), 0.14);
		color: var(--accent-blue-base);
		display: flex;
		align-items: center;
		justify-content: center;
		animation: rtc-ring 1.6s ease-in-out infinite;
	}
	.incoming-call-icon .material-icons-round {
		font-size: 22px;
	}
	.incoming-call-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}
	.incoming-call-kind {
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.incoming-call-name {
		font-family: var(--font-display);
		font-size: 0.95rem;
		font-weight: 800;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.incoming-call-actions {
		display: flex;
		gap: 8px;
	}
	.rtc-answer-btn {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 10px;
		border-radius: 12px;
		border: none;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.82rem;
		font-weight: 800;
		transition:
			filter 0.15s ease,
			transform 0.14s var(--ease-spring);
	}
	.rtc-answer-btn:hover {
		filter: brightness(1.08);
	}
	.rtc-answer-btn:active {
		transform: scale(0.97);
	}
	.rtc-answer-btn:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: 2px;
	}
	.rtc-answer-btn .material-icons-round {
		font-size: 18px;
	}
	.rtc-answer-btn.accept {
		background: var(--accent-blue-base);
		color: #ffffff;
	}
	.rtc-answer-btn.decline {
		background: rgba(229, 72, 77, 0.12);
		color: #e5484d;
		border: 1px solid rgba(229, 72, 77, 0.35);
	}

	/* ── Badge de llamada minimizada ────────────────────────── */
	.rtc-minimized-badge {
		position: fixed;
		bottom: 18px;
		right: 18px;
		z-index: 10001;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 9px 14px;
		border-radius: var(--radius-full);
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface-solid, #0d1828);
		color: var(--text-primary);
		cursor: pointer;
		font-family: inherit;
		font-size: 0.8rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
		transition: transform 0.15s var(--ease-spring);
	}
	.rtc-minimized-badge:hover {
		transform: translateY(-2px);
	}
	.rtc-minimized-badge:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: 2px;
	}
	.rtc-minimized-badge .live-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--aero-mint, #00d4aa);
		animation: live-pulse 1.6s ease-in-out infinite;
	}
	@keyframes live-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}
	.rtc-minimized-badge .expand-icon {
		font-size: 15px !important;
		color: var(--text-muted);
	}

	/* Eco/lite: sin animaciones de anillo */
	:global(:root[data-perf='eco']) .rtc-avatar-ring,
	:global(:root[data-perf-profile='lite']) .rtc-avatar-ring,
	:global(:root[data-perf-mode='true']) .rtc-avatar-ring,
	:global(:root[data-perf='eco']) .incoming-call-icon,
	:global(:root[data-perf-profile='lite']) .incoming-call-icon,
	:global(:root[data-perf-mode='true']) .incoming-call-icon {
		animation: none !important;
	}
</style>
