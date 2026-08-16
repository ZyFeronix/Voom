<script>
	import { fade, scale, slide, fly } from 'svelte/transition';
	import { backOut, cubicOut } from 'svelte/easing';
	import { onDestroy } from 'svelte';
	import { clickOutside } from '$lib/actions/clickOutside.js';
	import TwemojiPicker from '$lib/components/TwemojiPicker.svelte';
	import MsnEmoticonPicker from '$lib/components/MsnEmoticonPicker.svelte';
	import VoiceRecorder from '$lib/components/VoiceRecorder.svelte';
	import { EMOTICON_LIST } from '$lib/data/msnEmoticons.js';

	let { sending, onSend, chatStore, onTyping } = $props();

	let messageText = $state('');
	let showEmojiPicker = $state(false);
	let emojiTab = $state('msn'); // 'msn' | 'emoji'
	let showVoiceRecorder = $state(false);

	// Barra rápida: un subconjunto representativo del set MSN (con su imagen).
	const QUICK_CODES = ['(H)', ':D', ':)', ';)', ':P', '(A)', '(6)', '(L)', '(Y)', '(B)'];
	const quickEmoticons = QUICK_CODES.map((c) => EMOTICON_LIST.find((e) => e.code === c)).filter(
		Boolean
	);

	function insertEmoticon(code) {
		messageText += code;
		textInput?.focus();
	}

	// El selector MSN inserta el código; el de emoji inserta el carácter Unicode.
	function handleEmojiSelected(value) {
		messageText += value;
		textInput?.focus();
	}

	let fileInput = $state(null);
	let attachedFile = $state(null);
	let attachedFileUrl = $state(null);
	let attachedFileType = $state(null);
	let textInput = $state(null);

	// Sincroniza el modo edición: al activar edición, precargamos el texto.
	let lastEditId = null;
	$effect(() => {
		const editing = chatStore?.editingMessage;
		if (editing && editing.id !== lastEditId) {
			lastEditId = editing.id;
			messageText = editing.body || editing.content || '';
			tick_focus();
		} else if (!editing) {
			lastEditId = null;
		}
	});

	function tick_focus() {
		setTimeout(() => textInput?.focus(), 30);
	}

	export function focus() {
		textInput?.focus();
	}

	function cancelReplyEdit() {
		if (chatStore) {
			chatStore.replyingTo = null;
			if (chatStore.editingMessage) {
				chatStore.editingMessage = null;
				messageText = '';
			}
		}
	}

	function handleAttachClick() {
		if (fileInput) fileInput.click();
	}

	function handleFileSelected(e) {
		const file = e.target.files?.[0];
		if (!file) return;

		// Revocar el blob URL previo antes de reemplazar el adjunto (evita fuga).
		if (attachedFileUrl) URL.revokeObjectURL(attachedFileUrl);
		attachedFile = file;
		attachedFileType = file.type.startsWith('video') ? 'video' : 'image';
		attachedFileUrl = URL.createObjectURL(file);
	}

	function removeAttachment() {
		if (attachedFileUrl) URL.revokeObjectURL(attachedFileUrl);
		attachedFile = null;
		attachedFileUrl = null;
		attachedFileType = null;
		if (fileInput) fileInput.value = '';
	}

	// Revocar cualquier blob URL pendiente al desmontar (evita fuga de memoria).
	onDestroy(() => {
		if (attachedFileUrl) URL.revokeObjectURL(attachedFileUrl);
	});

	function handleKeydown(e) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			submitMessage();
			return;
		}
		if (e.key === 'Escape') {
			cancelReplyEdit();
			return;
		}
	}

	function handleInput() {
		if (!chatStore?.editingMessage) {
			// Emitir "escribiendo" mientras hay texto; emitir "detenido" al vaciar.
			onTyping?.(messageText.trim().length > 0);
		}
	}

	// Al perder el foco, dejar de mostrar "escribiendo…" al peer.
	function handleBlur() {
		if (!chatStore?.editingMessage) onTyping?.(false);
	}

	function submitMessage() {
		if (sending) return;
		const isEditing = !!chatStore?.editingMessage;
		const trimmed = messageText.trim();
		if (!trimmed && !attachedFile && !isEditing) return;

		onTyping?.(false);

		let finalText = messageText;
		if (trimmed.toLowerCase() === '/zumbido' || trimmed.toLowerCase() === '/nudge') {
			finalText = '⚡ ¡ZUMBIDO!';
		}

		onSend({
			text: finalText,
			file: attachedFile
		});

		// Reset composer
		messageText = '';
		removeAttachment();
	}

	function handleVoiceRecorded(blob) {
		onSend({
			text: '',
			voiceBlob: blob
		});
		showVoiceRecorder = false;
	}

	// Extracto legible del mensaje citado/en edición
	function quotePreview(m) {
		if (!m) return '';
		if (m.is_deleted) return 'Mensaje eliminado';
		const body = m.body || m.content;
		if (body) return body;
		if (m.media_type === 'video') return '🎬 Video';
		if (m.media_type === 'audio') return '🎤 Nota de voz';
		if (m.media_url) return '🖼️ Imagen';
		return 'Mensaje';
	}
</script>

<div class="composer-container">
	<!-- Chat Input Area -->
	<div class="input-pane">
		<!-- Barra de atajos de emoticonos (muesca / tab) -->
		{#if !showVoiceRecorder}
			<div class="emoticon-bar" transition:slide={{ duration: 200, easing: cubicOut }}>
				{#each quickEmoticons as e (e.code)}
					<button
						type="button"
						class="emoticon-chip"
						title="{e.label} — {e.code}"
						aria-label="Insertar emoticono {e.code}"
						onclick={() => insertEmoticon(e.code)}
					>
						<img src="/emoticons/{e.file}" alt={e.label} loading="lazy" decoding="async" />
					</button>
				{/each}
			</div>
		{/if}

		<!-- Reply / Edit quote bar -->
		{#if chatStore?.editingMessage || chatStore?.replyingTo}
			{@const ctx = chatStore.editingMessage || chatStore.replyingTo}
			<div class="quote-bar" transition:slide={{ duration: 300, easing: cubicOut }}>
				<span class="material-icons-round quote-icon">
					{chatStore.editingMessage ? 'edit' : 'reply'}
				</span>
				<div class="quote-body">
					<span class="quote-title">
						{chatStore.editingMessage
							? 'Editando mensaje'
							: 'Respondiendo a ' +
								(ctx.sender_display_name || ctx.sender_name || ctx.sender_username || 'mensaje')}
					</span>
					<span class="quote-preview">{quotePreview(ctx)}</span>
				</div>
				<button
					type="button"
					class="quote-close-btn"
					onclick={cancelReplyEdit}
					aria-label="Cancelar"
				>
					<span class="material-icons-round">close</span>
				</button>
			</div>
		{/if}

		<!-- Attachment Preview Bar -->
		{#if attachedFileUrl}
			<div class="attachment-preview-bar" transition:slide={{ duration: 300, easing: cubicOut }}>
				<div class="attachment-preview-card">
					{#if attachedFileType === 'video'}
						<span class="material-icons-round">videocam</span>
					{:else}
						<img
							src={attachedFileUrl}
							alt="Preview"
							width="60"
							height="60"
							loading="lazy"
							decoding="async"
						/>
					{/if}
					<button
						type="button"
						class="remove-attachment-btn"
						onclick={removeAttachment}
						aria-label="Remover archivo"
					>
						<span class="material-icons-round">close</span>
					</button>
				</div>
			</div>
		{/if}

		<form
			onsubmit={(e) => {
				e.preventDefault();
				submitMessage();
			}}
			class="input-form"
		>
			<input
				type="file"
				accept="image/*,video/*"
				bind:this={fileInput}
				onchange={handleFileSelected}
				style="display: none"
			/>

			{#if showVoiceRecorder}
				<div
					class="voice-recorder-wrapper"
					transition:scale={{ duration: 300, start: 0.95, easing: backOut }}
					style="grid-area: composer; display: flex; align-items: center; min-height: 44px; width: 100%;"
				>
					<VoiceRecorder
						onrecorded={handleVoiceRecorded}
						oncancel={() => (showVoiceRecorder = false)}
					/>
				</div>
			{:else}
				<div
					class="composer-group"
					transition:fade={{ duration: 150 }}
					style="grid-area: composer; display: flex; gap: 10px; align-items: center; width: 100%;"
				>
					<div class="chat-composer" class:has-attachment={attachedFileUrl}>
						<button
							type="button"
							onclick={handleAttachClick}
							class="composer-icon-btn composer-attach-btn"
							aria-label="Agregar archivo"
							title="Adjuntar archivo"
						>
							<span class="material-icons-round">add</span>
						</button>
						<input
							type="text"
							placeholder="Escribe tu mensaje..."
							bind:value={messageText}
							bind:this={textInput}
							onkeydown={handleKeydown}
							oninput={handleInput}
							onblur={handleBlur}
							class="composer-input"
							autocomplete="off"
						/>
						<div
							class="emoji-picker-wrapper"
							style="position: relative;"
							use:clickOutside={() => (showEmojiPicker = false)}
						>
							<button
								type="button"
								class="composer-icon-btn composer-emoji-btn"
								aria-label="Emojis"
								title="Emojis"
								onclick={() => (showEmojiPicker = !showEmojiPicker)}
							>
								<span class="material-icons-round">mood</span>
							</button>
							{#if showEmojiPicker}
								<div
									class="emoji-panel"
									transition:fly={{ y: 15, duration: 300, easing: cubicOut }}
								>
									<div class="emoji-panel-tabs" role="tablist">
										<button
											type="button"
											class="emoji-panel-tab"
											class:active={emojiTab === 'msn'}
											role="tab"
											aria-selected={emojiTab === 'msn'}
											onclick={() => (emojiTab = 'msn')}
										>
											MSN
										</button>
										<button
											type="button"
											class="emoji-panel-tab"
											class:active={emojiTab === 'emoji'}
											role="tab"
											aria-selected={emojiTab === 'emoji'}
											onclick={() => (emojiTab = 'emoji')}
										>
											Emoji
										</button>
									</div>
									{#if emojiTab === 'msn'}
										<MsnEmoticonPicker
											variant="inline"
											onSelect={(code) => {
												insertEmoticon(code);
												showEmojiPicker = false;
											}}
											onClose={() => (showEmojiPicker = false)}
										/>
									{:else}
										<TwemojiPicker
											variant="inline"
											onSelect={(e) => {
												handleEmojiSelected(e);
												showEmojiPicker = false;
											}}
											onClose={() => (showEmojiPicker = false)}
										/>
									{/if}
								</div>
							{/if}
						</div>
					</div>
					{#if !messageText.trim() && !attachedFileUrl && !chatStore?.editingMessage}
						<button
							type="button"
							class="composer-icon-btn voice-btn"
							aria-label="Grabar audio"
							title="Grabar audio"
							onclick={() => (showVoiceRecorder = true)}
						>
							<span class="material-icons-round">mic</span>
						</button>
					{:else}
						<button
							type="submit"
							disabled={sending}
							class="composer-send-btn"
							aria-label={chatStore?.editingMessage ? 'Guardar cambios' : 'Enviar mensaje'}
						>
							{#if sending}
								<span class="material-icons-round spin">progress_activity</span>
							{:else}
								<span class="material-icons-round"
									>{chatStore?.editingMessage ? 'check' : 'send'}</span
								>
							{/if}
						</button>
					{/if}
				</div>
			{/if}
		</form>
	</div>
</div>

<style>
	.composer-container {
		display: flex;
		flex-direction: column;
		width: 100%;
	}

	.emoticon-bar {
		position: absolute;
		bottom: 100%;
		left: 16px;
		display: inline-flex;
		width: max-content;
		align-items: center;
		gap: 3px;
		padding: 3px 8px;
		margin-bottom: 0;

		background: var(--bg-surface-solid, #ffffff);
		border: 1px solid var(--border-subtle);
		border-top: 1px solid var(--glass-border-t);
		border-bottom: none;
		border-radius: var(--radius-md) var(--radius-md) 0 0;

		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);

		box-shadow:
			inset 0 1px 1px rgba(255, 255, 255, 0.4),
			0 -4px 16px rgba(0, 0, 0, 0.06);
		z-index: 10;
	}

	.emoticon-chip {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-xs);
		cursor: pointer;
		flex-shrink: 0;
		transition: all 0.2s var(--ease-spring);
	}
	.emoticon-chip:hover {
		background: rgba(var(--accent-blue-rgb), 0.1);
		border-color: rgba(var(--accent-blue-rgb), 0.2);
		transform: translateY(-1px) scale(1.08);
	}
	.emoticon-chip:active {
		transform: scale(0.92);
	}
	.emoticon-chip img {
		width: 18px;
		height: 18px;
		object-fit: contain;
		pointer-events: none;
	}

	/* Panel del selector de emojis con pestañas MSN / Emoji */
	.emoji-panel {
		position: absolute;
		bottom: 38px;
		right: 0;
		z-index: 50;
		width: 300px;
		max-width: 90vw;
		background: var(--bg-surface-solid, #ffffff);
		border: 1px solid var(--border-subtle);
		border-top: 1px solid var(--glass-border-t);
		border-radius: var(--radius-md);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.14);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
	.emoji-panel-tabs {
		display: flex;
		gap: 6px;
		padding: 4px 6px;
		border-bottom: 1px solid var(--border-subtle);
		background: rgba(var(--accent-blue-rgb), 0.04);
	}
	.emoji-panel-tab {
		flex: 1;
		padding: 5px 8px;
		font-size: 0.75rem;
		font-weight: 700;
		border: none;
		border-radius: var(--radius-xs);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.emoji-panel-tab.active {
		background: var(--bg-surface-solid, #ffffff);
		color: var(--accent-blue-base);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}

	.quote-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		margin: 0 0 8px 0;
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		border-left: 3px solid var(--accent-blue-base);
		border-radius: var(--radius-sm);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
	}

	.quote-bar .quote-icon {
		color: var(--accent-blue-base);
		font-size: 18px;
		flex-shrink: 0;
	}

	.quote-body {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}

	.quote-title {
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--accent-blue-base);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.quote-preview {
		font-size: 0.72rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.quote-close-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		padding: 2px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		flex-shrink: 0;
		transition:
			background 0.2s,
			color 0.2s;
	}
	.quote-close-btn:hover {
		background: rgba(244, 63, 94, 0.12);
		color: var(--rose-500, #f43f5e);
	}
	.quote-close-btn .material-icons-round {
		font-size: 16px;
	}

	.attachment-preview-bar {
		padding: 6px 10px;
		margin: 0 0 8px 0;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		display: flex;
		background: var(--bg-surface);
	}

	.attachment-preview-card {
		position: relative;
		width: 48px;
		height: 48px;
		border-radius: var(--radius-sm);
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(var(--accent-blue-rgb), 0.05);
	}

	.attachment-preview-card img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.attachment-preview-card .material-icons-round {
		color: var(--text-primary);
		font-size: 1.3rem;
	}

	.remove-attachment-btn {
		position: absolute;
		top: 2px;
		right: 2px;
		background: rgba(15, 23, 42, 0.75);
		border: none;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		width: 16px;
		height: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0;
		z-index: 10;
	}

	.remove-attachment-btn .material-icons-round {
		font-size: 0.7rem;
		color: #ffffff;
	}

	.input-pane {
		position: relative;
		padding: 8px 12px 10px 12px;
		border-top: 1px solid var(--border-subtle);
		background: var(--bg-surface);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
	}

	.input-form {
		display: grid;
		grid-template-columns: 1fr;
		grid-template-areas: 'composer';
		align-items: center;
	}

	.chat-composer {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 4px;
		background: var(--bg-input, var(--bg-surface));
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		padding: 2px 4px;
		min-height: 38px;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease,
			background 0.2s ease;
		box-sizing: border-box;
	}
	.chat-composer:focus-within {
		border-color: var(--accent-blue-base);
		box-shadow:
			0 0 0 3px rgba(var(--accent-blue-rgb), 0.12),
			inset 0 1px 2px rgba(0, 0, 0, 0.02);
		background: var(--bg-surface-hover);
	}
	.chat-composer.has-attachment {
		border-color: var(--aero-amber);
		box-shadow: 0 0 0 3px rgba(245, 166, 35, 0.12);
	}

	.composer-icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		flex: 0 0 32px;
		min-width: 32px;
		min-height: 32px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.18s ease;
		box-sizing: border-box;
	}
	.composer-icon-btn .material-icons-round {
		font-size: 18px;
	}
	.composer-icon-btn:hover {
		background: rgba(var(--accent-blue-rgb), 0.1);
		color: var(--accent-blue-base);
	}
	.composer-attach-btn {
		background: rgba(var(--accent-blue-rgb), 0.06);
		color: var(--text-primary);
	}
	.composer-attach-btn:hover {
		background: rgba(var(--accent-blue-rgb), 0.14);
		color: var(--accent-blue-base);
	}
	.composer-emoji-btn:hover {
		background: rgba(245, 166, 35, 0.14);
		color: var(--aero-amber);
	}
	.voice-btn {
		margin-left: 4px;
		background: rgba(var(--accent-blue-rgb), 0.06);
		border: 1px solid var(--border-subtle);
		color: var(--accent-blue-base);
	}
	.voice-btn:hover {
		background: rgba(var(--accent-blue-rgb), 0.14);
		color: var(--accent-blue-base);
		transform: scale(1.05);
	}

	.composer-input {
		flex: 1;
		min-width: 0;
		padding: 6px 4px;
		background: transparent;
		border: none;
		outline: none;
		font-size: 0.85rem;
		line-height: 1.35;
		font-family: var(--font-sans);
		color: var(--text-primary);
	}
	.composer-input::placeholder {
		color: var(--text-muted);
		opacity: 0.6;
	}

	.composer-send-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		flex: 0 0 34px;
		min-width: 34px;
		min-height: 34px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: linear-gradient(135deg, var(--aero-sky), var(--accent-blue-base));
		border: none;
		color: #fff;
		cursor: pointer;
		transition:
			transform var(--t-spring),
			box-shadow 0.2s ease,
			opacity 0.2s ease;
		box-shadow: 0 3px 10px rgba(var(--accent-blue-rgb), 0.35);
		box-sizing: border-box;
	}
	.composer-send-btn .material-icons-round {
		font-size: 1.1rem;
		line-height: 1;
		display: block;
		transition: transform 0.18s ease;
	}
	.composer-send-btn:hover:not(:disabled) {
		transform: translateY(-1px) scale(1.04);
		box-shadow: 0 6px 16px rgba(var(--accent-blue-rgb), 0.5);
	}
	.composer-send-btn:hover:not(:disabled) .material-icons-round {
		transform: translateX(1px);
	}
	.composer-send-btn:active:not(:disabled) {
		transform: scale(0.94);
		box-shadow: 0 2px 6px rgba(var(--accent-blue-rgb), 0.3);
	}
	.composer-send-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
		box-shadow: none;
		background: var(--border-subtle);
		color: var(--text-muted);
	}
	.composer-send-btn .spin {
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
