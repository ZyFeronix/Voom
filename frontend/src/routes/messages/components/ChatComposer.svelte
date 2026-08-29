<script>
	import { fade, slide, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { onDestroy } from 'svelte';
	import { clickOutside } from '$lib/actions/clickOutside.js';
	import TwemojiPicker from '$lib/components/TwemojiPicker.svelte';
	import MsnEmoticonPicker from '$lib/components/MsnEmoticonPicker.svelte';
	import VoiceRecorder from '$lib/components/VoiceRecorder.svelte';
	import { EMOTICON_LIST } from '$lib/data/msnEmoticons.js';
	import { playMessageSent } from '$lib/utils/sound.js';
	import { ZUMBIDO_TEXT } from '$lib/utils/zumbido.js';

	let { sending, onSend, chatStore, onTyping, pendingProduct = $bindable(null) } = $props();

	let messageText = $state('');
	let showEmojiPicker = $state(false);
	let emojiTab = $state('msn'); // 'msn' | 'emoji'
	let showVoiceRecorder = $state(false);
	let isDragOver = $state(false);
	let textInput = $state(null);

	// Barra rápida: un subconjunto representativo del set MSN.
	const QUICK_CODES = [
		'(H)',
		':D',
		':)',
		';)',
		':P',
		'(A)',
		'(6)',
		'(L)',
		'(Y)',
		'(B)',
		'(K)',
		':@',
		':-#',
		':-*',
		'(U)',
		'(F)',
		'(W)',
		'(S)',
		'(*)',
		'(8)'
	];
	const quickEmoticons = QUICK_CODES.map((c) => EMOTICON_LIST.find((e) => e.code === c)).filter(
		Boolean
	);

	function insertEmoticon(code) {
		messageText += (messageText ? ' ' : '') + code + ' ';
		textInput?.focus();
	}

	// El selector MSN inserta el código; el de emoji inserta el carácter Unicode.
	function handleEmojiSelected(value) {
		messageText += value;
		textInput?.focus();
	}

	let showQuickEmotes = $state(true); // Toggle for the touchbar

	function handleWheel(e) {
		if (e.deltaY !== 0) {
			e.preventDefault();
			e.currentTarget.scrollLeft += e.deltaY;
		}
	}

	let fileInput = $state(null);
	let attachedFile = $state(null);
	let attachedFileUrl = $state(null);
	let attachedFileType = $state(null);

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

	function removePendingProduct() {
		pendingProduct = null;
	}

	// Revocar cualquier blob URL pendiente al desmontar (evita fuga de memoria).
	onDestroy(() => {
		if (attachedFileUrl) URL.revokeObjectURL(attachedFileUrl);
	});

	function handlePaste(e) {
		const items = e.clipboardData?.items;
		if (!items) return;
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (item.type.startsWith('image/')) {
				const file = item.getAsFile();
				if (file) {
					e.preventDefault();
					if (attachedFileUrl) URL.revokeObjectURL(attachedFileUrl);
					attachedFile = file;
					attachedFileType = 'image';
					attachedFileUrl = URL.createObjectURL(file);
					break;
				}
			}
		}
	}

	function handleDragOver(e) {
		e.preventDefault();
		isDragOver = true;
	}

	function handleDragLeave(e) {
		if (!e.currentTarget.contains(e.relatedTarget)) {
			isDragOver = false;
		}
	}

	function handleDrop(e) {
		e.preventDefault();
		isDragOver = false;
		const file = e.dataTransfer?.files?.[0];
		if (!file) return;
		if (
			file.type.startsWith('image') ||
			file.type.startsWith('video') ||
			file.type.startsWith('audio')
		) {
			if (attachedFileUrl) URL.revokeObjectURL(attachedFileUrl);
			attachedFile = file;
			attachedFileType = file.type.startsWith('video')
				? 'video'
				: file.type.startsWith('audio')
					? 'audio'
					: 'image';
			attachedFileUrl = URL.createObjectURL(file);
		}
	}

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
		autoGrow();
		if (!chatStore?.editingMessage) {
			// Emitir "escribiendo" mientras hay texto; emitir "detenido" al vaciar.
			onTyping?.(messageText.trim().length > 0);
		}
	}

	function handleBlur() {
		// Al perder el foco, dejar de mostrar "escribiendo…" al peer.
		if (!chatStore?.editingMessage) onTyping?.(false);
	}

	// Auto-crecimiento del textarea hasta ~5 líneas; luego scrollea.
	function autoGrow() {
		if (!textInput) return;
		textInput.style.height = 'auto';
		textInput.style.height = Math.min(textInput.scrollHeight, 110) + 'px';
	}

	// Resetear altura cuando se vacía el campo (envío / cancelación).
	$effect(() => {
		if (messageText === '') autoGrow();
	});

	function submitMessage() {
		if (sending) return;
		const isEditing = !!chatStore?.editingMessage;
		const trimmed = messageText.trim();
		if (!trimmed && !attachedFile && !isEditing) return;

		onTyping?.(false);

		let finalText = trimmed;
		if (trimmed.toLowerCase() === '/zumbido' || trimmed.toLowerCase() === '/nudge') {
			finalText = ZUMBIDO_TEXT;
		}

		// Producto vinculado desde Marketplace: se incrusta en el mensaje como
		// texto + enlace (el chat no tiene tipo de mensaje estructurado).
		if (pendingProduct) {
			const productLine = `🛍️ ${pendingProduct.title} — ${pendingProduct.price} USD`;
			finalText = finalText
				? `${finalText}\n\n${productLine}\n${pendingProduct.url}`
				: `${productLine}\n${pendingProduct.url}`;
		}

		onSend({
			text: finalText,
			file: attachedFile,
			voiceBlob: undefined
		});
		playMessageSent();

		// Reset composer
		messageText = '';
		removeAttachment();
		pendingProduct = null;
	}

	function handleVoiceRecorded(blob) {
		onSend({
			text: '',
			file: undefined,
			voiceBlob: blob
		});
		playMessageSent();
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
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="input-pane"
		class:drag-over={isDragOver}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
	>
		<div class="composer-inner">
			{#if isDragOver}
				<div class="drag-drop-overlay" transition:fade={{ duration: 120 }}>
					<span class="material-icons-round drag-drop-icon">cloud_upload</span>
					<span class="drag-drop-text">Suelta el archivo para adjuntarlo</span>
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

			<!-- Producto de Marketplace vinculado -->
			{#if pendingProduct}
				<div class="attachment-preview-bar" transition:slide={{ duration: 300, easing: cubicOut }}>
					<div class="product-preview-card">
						{#if pendingProduct.image}
							<img src={pendingProduct.image} alt={pendingProduct.title} loading="lazy" />
						{:else}
							<span class="material-icons-round">storefront</span>
						{/if}
						<div class="product-preview-info">
							<span class="product-preview-label">Producto de Marketplace</span>
							<span class="product-preview-title">{pendingProduct.title}</span>
							<span class="product-preview-price">{pendingProduct.price} USD</span>
						</div>
						<button
							type="button"
							class="remove-attachment-btn product-remove"
							onclick={removePendingProduct}
							aria-label="Quitar producto"
						>
							<span class="material-icons-round">close</span>
						</button>
					</div>
				</div>
			{/if}

			<!-- Attachment Preview Bar -->
			{#if attachedFileUrl}
				<div class="attachment-preview-bar" transition:slide={{ duration: 300, easing: cubicOut }}>
					<div class="attachment-preview-card">
						{#if attachedFileType === 'video'}
							<span class="material-icons-round preview-video-icon">videocam</span>
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
					<div class="attachment-file-meta">
						<span class="attachment-file-label">
							{attachedFileType === 'video' ? 'Video adjunto' : 'Imagen adjunta'}
						</span>
						<button type="button" class="attachment-remove-link" onclick={removeAttachment}>
							Quitar
						</button>
					</div>
				</div>
			{/if}

			<!-- Barra rápida de emoticonos MSN (TouchBar Style) -->
			{#if showQuickEmotes && !chatStore?.editingMessage}
				<div
					class="quick-emoticons-bar"
					onwheel={handleWheel}
					transition:slide={{ duration: 200, axis: 'y' }}
				>
					<div class="quick-emoticons-track">
						{#each quickEmoticons as e (e.code)}
							<button
								type="button"
								class="quick-emote-chip"
								title="{e.label} ({e.code})"
								aria-label="Insertar {e.label}"
								onclick={() => insertEmoticon(e.code)}
							>
								<img src="/emoticons/{e.file}" alt={e.label} loading="lazy" decoding="async" />
							</button>
						{/each}
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
					<!-- Solo transición de ENTRADA: el composer sale al instante,
					     así nunca se ven las dos barras apiladas durante el swap. -->
					<div class="voice-recorder-wrapper" in:fly={{ y: 8, duration: 200, easing: cubicOut }}>
						<VoiceRecorder
							variant="compact"
							onrecorded={handleVoiceRecorded}
							oncancel={() => (showVoiceRecorder = false)}
						/>
					</div>
				{:else}
					<div class="composer-group" in:fade={{ duration: 120 }}>
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

							<textarea
								bind:this={textInput}
								bind:value={messageText}
								onkeydown={handleKeydown}
								oninput={handleInput}
								onblur={handleBlur}
								onpaste={handlePaste}
								placeholder="Escribe tu mensaje..."
								rows="1"
								class="composer-input"
								autocomplete="off"
							></textarea>

							<button
								type="button"
								class="composer-icon-btn"
								class:toggled={showQuickEmotes}
								aria-label="Alternar barra rápida de emoticonos"
								title="Barra rápida de emoticonos"
								onclick={() => (showQuickEmotes = !showQuickEmotes)}
							>
								<span class="material-icons-round">interests</span>
							</button>
							<div class="emoji-picker-wrapper" use:clickOutside={() => (showEmojiPicker = false)}>
								<button
									type="button"
									class="composer-icon-btn composer-emoji-btn"
									class:toggled={showEmojiPicker}
									aria-label="Emojis y Emoticonos MSN"
									aria-expanded={showEmojiPicker}
									title="Emojis y Emoticonos MSN"
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
								title="Grabar nota de voz"
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
</div>

<style>
	/* ═══════════════════════════════════════════════════════════
	   Voom! Messenger — Compositor "Retro-Aero limpio"
	   Dock con hairline superior, cápsula de entrada sólida y
	   barra rápida de emoticonos MSN.
	   ═══════════════════════════════════════════════════════════ */

	.composer-container {
		display: flex;
		flex-direction: column;
		width: 100%;
		position: relative;
		z-index: 10;
	}

	.composer-inner {
		width: 100%;
		display: flex;
		flex-direction: column;
	}

	/* ── Dock ───────────────────────────────────────────────── */
	.input-pane {
		position: relative;
		padding: 10px 16px 12px;
		border-top: 1px solid var(--border-subtle);
		background: rgba(247, 251, 254, 0.85);
	}
	:global([data-theme='dark']) .input-pane {
		background: rgba(9, 20, 38, 0.45);
	}
	:global([data-theme='midnight']) .input-pane {
		background: rgba(3, 8, 18, 0.5);
	}
	.input-pane.drag-over {
		background: rgba(var(--accent-blue-rgb), 0.08);
	}

	.drag-drop-overlay {
		position: absolute;
		inset: 8px;
		z-index: 60;
		background: var(--bg-surface-solid, var(--bg-surface));
		border: 2px dashed var(--accent-blue-base);
		border-radius: 14px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		color: var(--accent-blue-base);
		pointer-events: none;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
	}
	.drag-drop-icon {
		font-size: 34px !important;
	}
	.drag-drop-text {
		font-size: 0.85rem;
		font-weight: 800;
		letter-spacing: -0.01em;
	}

	.input-form {
		display: grid;
		grid-template-columns: 1fr;
		align-items: center;
		padding-top: 10px;
	}

	.composer-group {
		display: flex;
		gap: 8px;
		align-items: flex-end;
		width: 100%;
	}

	.voice-recorder-wrapper {
		/* Cápsula idéntica a .chat-composer: la grabadora (variant compact,
		   sin cromo propio) vive dentro y se integra al dock. */
		display: flex;
		align-items: center;
		width: 100%;
		min-height: 48px;
		background: var(--bg-surface-solid, var(--bg-surface));
		border: 1px solid var(--border-subtle);
		border-radius: 16px;
		padding: 3px 4px;
		box-sizing: border-box;
	}

	/* ── Barra rápida de emoticonos MSN ─────────────────────── */
	.quick-emoticons-bar {
		display: flex;
		align-items: center;
		padding: 2px 2px 0;
		overflow-x: auto;
		scrollbar-width: none;
		width: 100%;
	}
	.quick-emoticons-bar::-webkit-scrollbar {
		display: none;
	}
	.quick-emoticons-track {
		display: flex;
		gap: 2px;
		padding: 2px;
	}
	.quick-emote-chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		flex: 0 0 32px;
		background: transparent;
		border: none;
		border-radius: 9px;
		cursor: pointer;
		transition:
			background 0.14s ease,
			transform 0.14s var(--ease-spring);
	}
	.quick-emote-chip:hover {
		background: rgba(var(--accent-blue-rgb), 0.1);
		transform: translateY(-2px);
	}
	.quick-emote-chip:active {
		transform: scale(0.92);
	}
	.quick-emote-chip:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: 1px;
	}
	.quick-emote-chip img {
		width: 20px;
		height: 20px;
		object-fit: contain;
		pointer-events: none;
	}

	/* ── Barras de contexto (respuesta/edición/adjunto/producto) ── */
	.quote-bar,
	.attachment-preview-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 10px;
		margin: 0 2px 8px;
		border: 1px solid var(--border-subtle);
		border-radius: 12px;
		background: rgba(var(--accent-blue-rgb), 0.05);
	}
	.quote-icon {
		font-size: 16px !important;
		color: var(--accent-blue-base);
		flex-shrink: 0;
	}
	.quote-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.quote-title {
		font-size: 0.72rem;
		font-weight: 800;
		color: var(--accent-blue-base);
	}
	.quote-preview {
		font-size: 0.72rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.quote-close-btn,
	.remove-attachment-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 2px;
		width: 24px;
		height: 24px;
		min-width: 24px;
		min-height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-full);
		flex-shrink: 0;
		transition:
			color 0.14s ease,
			background 0.14s ease;
	}
	.quote-close-btn:hover,
	.remove-attachment-btn:hover {
		color: var(--text-primary);
		background: rgba(var(--accent-blue-rgb), 0.1);
	}
	.quote-close-btn:focus-visible,
	.remove-attachment-btn:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: 1px;
	}
	.quote-close-btn .material-icons-round,
	.remove-attachment-btn .material-icons-round {
		font-size: 14px;
	}

	.attachment-preview-card {
		position: relative;
		width: 52px;
		height: 52px;
		flex-shrink: 0;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-surface-solid, var(--bg-surface));
	}
	.attachment-preview-card img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.attachment-preview-card .remove-attachment-btn {
		position: absolute;
		top: 2px;
		right: 2px;
		width: 18px;
		height: 18px;
		min-width: 18px;
		min-height: 18px;
		background: rgba(0, 0, 0, 0.55);
		color: #ffffff;
		border-radius: var(--radius-full);
	}
	.attachment-preview-card .remove-attachment-btn:hover {
		background: rgba(0, 0, 0, 0.75);
		color: #ffffff;
	}
	.attachment-preview-card .remove-attachment-btn .material-icons-round {
		font-size: 11px;
	}
	.preview-video-icon {
		font-size: 22px !important;
		color: var(--accent-blue-base);
	}
	.attachment-file-meta {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.attachment-file-label {
		font-size: 0.74rem;
		font-weight: 700;
		color: var(--text-secondary);
	}
	.attachment-remove-link {
		background: transparent;
		border: none;
		font-family: inherit;
		font-size: 0.72rem;
		font-weight: 700;
		color: #e5484d;
		cursor: pointer;
		padding: 2px 4px;
		border-radius: 6px;
	}
	.attachment-remove-link:hover {
		text-decoration: underline;
	}

	/* Producto de Marketplace */
	.product-preview-card {
		display: flex;
		align-items: center;
		gap: 10px;
		flex: 1;
		min-width: 0;
	}
	.product-preview-card img {
		width: 44px;
		height: 44px;
		border-radius: 10px;
		object-fit: cover;
		border: 1px solid var(--border-subtle);
		flex-shrink: 0;
	}
	.product-preview-card > .material-icons-round {
		font-size: 26px !important;
		color: var(--accent-blue-base);
		flex-shrink: 0;
	}
	.product-preview-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.product-preview-label {
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.product-preview-title {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.product-preview-price {
		font-size: 0.74rem;
		font-weight: 800;
		color: var(--accent-blue-base);
	}

	/* ── Cápsula de entrada ─────────────────────────────────── */
	.chat-composer {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: flex-end;
		gap: 2px;
		background: var(--bg-surface-solid, var(--bg-surface));
		border: 1px solid var(--border-subtle);
		border-radius: 16px;
		padding: 3px 4px 3px 2px;
		box-sizing: border-box;
		transition:
			border-color 0.16s ease,
			box-shadow 0.16s ease;
	}
	.chat-composer:focus-within {
		border-color: var(--accent-blue-base);
		box-shadow: 0 0 0 3px rgba(var(--accent-blue-rgb), 0.12);
	}

	.composer-icon-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0;
		width: 34px;
		height: 34px;
		min-width: 34px;
		min-height: 34px;
		flex: 0 0 34px;
		border-radius: 11px;
		display: flex;
		align-items: center;
		justify-content: center;
		align-self: flex-end;
		margin-bottom: 2px;
		box-sizing: border-box;
		transition:
			background 0.15s ease,
			color 0.15s ease,
			transform 0.14s var(--ease-spring);
	}
	.composer-icon-btn:hover {
		background: rgba(var(--accent-blue-rgb), 0.1);
		color: var(--accent-blue-base);
	}
	.composer-icon-btn:active {
		transform: scale(0.92);
	}
	.composer-icon-btn:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: 1px;
	}
	.composer-icon-btn.toggled {
		background: rgba(var(--accent-blue-rgb), 0.12);
		color: var(--accent-blue-base);
	}
	.composer-icon-btn .material-icons-round {
		font-size: 19px;
	}

	.composer-input {
		flex: 1;
		min-width: 0;
		border: none;
		background: transparent;
		outline: none;
		resize: none;
		padding: 8px 4px;
		font-family: inherit;
		font-size: 0.88rem;
		line-height: 1.4;
		color: var(--text-primary);
		max-height: 110px;
		box-sizing: border-box;
	}
	.composer-input::placeholder {
		color: var(--text-muted);
		opacity: 0.7;
	}

	/* Botón enviar: círculo del acento (mismo ancho que el micrófono) */
	.composer-send-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		align-self: flex-end;
		width: 40px;
		height: 40px;
		flex: 0 0 40px;
		min-width: 40px;
		min-height: 40px;
		margin: 1px;
		border: none;
		border-radius: var(--radius-full);
		background: linear-gradient(160deg, var(--aero-sky, #2ea8ff), var(--accent-blue-base));
		color: #ffffff;
		cursor: pointer;
		box-shadow: 0 4px 12px rgba(var(--accent-blue-rgb), 0.4);
		transition:
			transform 0.15s var(--ease-spring),
			filter 0.15s ease;
	}
	.composer-send-btn:hover:not(:disabled) {
		transform: translateY(-1px);
		filter: brightness(1.07);
	}
	.composer-send-btn:active:not(:disabled) {
		transform: scale(0.94);
	}
	.composer-send-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.composer-send-btn:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: 2px;
	}
	.composer-send-btn .material-icons-round {
		font-size: 19px;
	}
	.composer-send-btn .spin {
		animation: send-spin 0.9s linear infinite;
	}
	@keyframes send-spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Micrófono: mismo tamaño que enviar, tinte suave */
	.composer-icon-btn.voice-btn {
		width: 40px;
		height: 40px;
		min-width: 40px;
		min-height: 40px;
		flex: 0 0 40px;
		border-radius: var(--radius-full);
		background: rgba(var(--accent-blue-rgb), 0.1);
		color: var(--accent-blue-base);
		margin: 1px;
	}
	.composer-icon-btn.voice-btn:hover {
		background: rgba(var(--accent-blue-rgb), 0.18);
	}

	/* ── Panel de emojis ────────────────────────────────────── */
	.emoji-picker-wrapper {
		position: relative;
		display: flex;
	}
	.emoji-panel {
		position: absolute;
		bottom: calc(100% + 10px);
		right: 0;
		z-index: 40;
		width: 340px;
		max-width: min(90vw, 360px);
		background: var(--bg-surface-solid, var(--bg-surface));
		border: 1px solid var(--border-subtle);
		border-radius: 14px;
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.28);
		overflow: hidden;
	}
	.emoji-panel-tabs {
		display: flex;
		gap: 2px;
		padding: 6px 8px 0;
		border-bottom: 1px solid var(--border-subtle);
	}
	.emoji-panel-tab {
		padding: 7px 14px;
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		border-radius: 8px 8px 0 0;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.76rem;
		font-weight: 700;
		color: var(--text-muted);
		transition:
			color 0.14s ease,
			border-color 0.14s ease;
	}
	.emoji-panel-tab:hover {
		color: var(--text-secondary);
	}
	.emoji-panel-tab:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: -2px;
	}
	.emoji-panel-tab.active {
		color: var(--accent-blue-base);
		border-bottom-color: var(--accent-blue-base);
	}

	@media (max-width: 768px) {
		.input-pane {
			padding: 8px 8px 10px;
		}
	}
</style>
