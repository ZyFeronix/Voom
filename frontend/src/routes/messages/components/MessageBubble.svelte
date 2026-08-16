<script>
	import { fade } from 'svelte/transition';
	import TwemojiPicker from '$lib/components/TwemojiPicker.svelte';
	import MediaPlayer from '$lib/components/MediaPlayer.svelte';
	import { EMOTICON_CODES, parseMsnEmotes } from '$lib/data/msnEmoticons.js';
	import { getProxiedMediaUrl } from '$lib/utils/mediaProxy.js';
	import { formatTime } from '$lib/utils/datetime.js';

	let {
		msg,
		isMe,
		activeConv,
		animated = false,
		staggerDelay = 0,
		deletingMessageId,
		activeReactionMsgId,
		reactionPickerDirection,
		isCurrentMatch = false,
		onBubbleClick,
		onDeleteClick,
		onConfirmDelete,
		onCancelDelete,
		onReactionMenuClick,
		onReact,
		onCloseReactionPicker,
		onReply,
		onEdit,
		onQuoteClick,
		onRetry,
		onDiscard
	} = $props();

	function getInitials(name) {
		if (!name) return '?';
		return name.substring(0, 2).toUpperCase();
	}

	// Códigos MSN ordenados por longitud desc (para retirar primero los largos).
	const msnEmoticonsKeys = [...EMOTICON_CODES].sort((a, b) => b.length - a.length);

	// Heurística simple para saber si el mensaje es solo emojis o emoticonos MSN
	function isEmojiOnly(str) {
		if (!str) return false;
		let noSpaces = str.replace(/\s+/g, '');

		// Remover todos los códigos MSN para ver si queda algo más
		for (const code of msnEmoticonsKeys) {
			noSpaces = noSpaces.split(code).join('');
		}

		if (noSpaces === '') return true; // Era solo códigos MSN

		// RegEx para match de emojis estándar (rango aproximado)
		const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)+$/u;
		return emojiRegex.test(noSpaces) && Array.from(noSpaces).length <= 5;
	}

	// Extracto legible del mensaje citado
	function quoteText(r) {
		if (!r) return '';
		if (r.is_deleted) return 'Mensaje eliminado';
		if (r.body) return r.body;
		if (r.media_type === 'video') return '🎬 Video';
		if (r.media_type === 'audio') return '🎤 Nota de voz';
		return '🖼️ Imagen';
	}

	const isZumbido = $derived(
		!msg.is_deleted &&
			((msg.body || '').trim() === '⚡ ¡ZUMBIDO!' ||
				(msg.content || '').trim() === '⚡ ¡ZUMBIDO!' ||
				(msg.body || '').trim().toLowerCase() === '/zumbido' ||
				(msg.content || '').trim().toLowerCase() === '/zumbido')
	);
</script>

<div
	class="message-group {isMe ? 'me' : 'peer'}"
	class:zumbido-group={isZumbido}
	class:no-anim={!animated}
	class:search-match={isCurrentMatch}
	data-msg-id={msg.id}
	style="--stagger-delay: {staggerDelay}ms"
>
	<div class="message-bubble-row">
		{#if !isMe && !isZumbido}
			<div class="peer-mini-avatar">
				{#if activeConv?.peer_avatar}
					<img
						src={activeConv.peer_avatar}
						alt={activeConv.peer_display_name}
						width="24"
						height="24"
						loading="lazy"
						decoding="async"
					/>
				{:else}
					<span>{getInitials(activeConv?.peer_display_name || activeConv?.peer_username)}</span>
				{/if}
			</div>
		{/if}

		<div class="bubble-wrapper">
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="message-bubble"
				class:emoji-only-bubble={!msg.is_deleted &&
					isEmojiOnly(msg.body || msg.content) &&
					!msg.media_url}
				class:zumbido-bubble={isZumbido}
				class:deleted-bubble={msg.is_deleted}
				onclick={(e) => onBubbleClick(e, msg.id)}
			>
				{#if msg.is_deleted}
					<p class="deleted-text-p">
						<span
							class="material-icons-round"
							style="font-size: 15px; margin-right: 4px; vertical-align: middle;">block</span
						>Este mensaje fue eliminado
					</p>
				{:else}
					<!-- Mensaje citado (responder) -->
					{#if msg.reply_to}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="reply-quote"
							onclick={(e) => {
								e.stopPropagation();
								onQuoteClick?.(msg.reply_to.id);
							}}
							title="Ir al mensaje original"
						>
							<span class="reply-quote-author">
								{msg.reply_to.sender_name || msg.reply_to.sender_username || 'Mensaje'}
							</span>
							<span class="reply-quote-text">{quoteText(msg.reply_to)}</span>
						</div>
					{/if}

					{#if msg.media_url}
						<div class="message-media-container">
							{#if msg.uploading || msg.media_url === 'uploading...'}
								<div class="media-uploading" aria-label="Subiendo adjunto">
									<span class="upload-spinner"></span>
									<span class="upload-label">Subiendo…</span>
								</div>
							{:else if msg.media_type === 'video'}
								<MediaPlayer
									src={getProxiedMediaUrl(msg.media_url)}
									type="video"
									class="message-media-video"
								/>
							{:else if msg.media_type === 'audio'}
								<MediaPlayer src={getProxiedMediaUrl(msg.media_url)} type="audio" />
							{:else}
								<img
									src={getProxiedMediaUrl(msg.media_url)}
									alt="Attached media"
									class="message-media-img"
									loading="lazy"
									decoding="async"
									crossorigin="anonymous"
									referrerpolicy="no-referrer"
								/>
							{/if}
						</div>
					{/if}

					<!-- Message Actions (Responder, Editar, Eliminar & Reaccionar) -->
					<div class="message-actions-wrapper {isMe ? 'actions-right' : 'actions-left'}">
						<button
							class="action-btn-mini reply-btn"
							onclick={(e) => {
								e.stopPropagation();
								onReply?.(msg);
							}}
							aria-label="Responder"
							title="Responder"
						>
							<span class="material-icons-round">reply</span>
						</button>

						{#if isMe && (msg.body || msg.content) && !isZumbido}
							<button
								class="action-btn-mini edit-btn"
								onclick={(e) => {
									e.stopPropagation();
									onEdit?.(msg);
								}}
								aria-label="Editar"
								title="Editar mensaje"
							>
								<span class="material-icons-round">edit</span>
							</button>
						{/if}

						{#if isMe}
							<button
								class="action-btn-mini delete-btn"
								onclick={() => onDeleteClick(msg.id)}
								aria-label="Eliminar"
								title="Eliminar mensaje"
							>
								<span class="material-icons-round">delete</span>
							</button>
						{/if}

						<div style="position: relative;">
							<button
								class="action-btn-mini react-btn"
								onclick={(e) => onReactionMenuClick(e, msg.id)}
								aria-label="Reaccionar"
							>
								<span class="material-icons-round">add_reaction</span>
							</button>

							{#if activeReactionMsgId === msg.id}
								<div
									class="floating-picker-wrapper {isMe
										? 'picker-right'
										: 'picker-left'} picker-{reactionPickerDirection}"
								>
									<TwemojiPicker
										variant="inline"
										onSelect={(emoji) => onReact(msg.id, emoji)}
										onClose={() => onCloseReactionPicker()}
									/>
								</div>
							{/if}
						</div>
					</div>

					{#if msg.body || msg.content}
						{#if isZumbido}
							<div class="zumbido-content">
								<span class="material-icons-round zumbido-icon">bolt</span>
								<div class="zumbido-text">
									<div class="zumbido-title">ZUMBIDO MSN</div>
									<div class="zumbido-desc">
										{isMe ? 'Has enviado un Zumbido' : 'Te han enviado un Zumbido'}
									</div>
								</div>
							</div>
						{:else}
							<p class="message-text-p">
								{#each parseMsnEmotes(msg.body || msg.content) as part}
									{#if part.type === 'emote'}
										<img
											class="msn-emoji-render"
											src={part.url}
											alt={part.code}
											title={part.code}
											loading="lazy"
											decoding="async"
										/>
									{:else}
										{part.content}
									{/if}
								{/each}
							</p>
						{/if}
					{/if}
				{/if}
			</div>

			{#if deletingMessageId === msg.id}
				<div class="delete-confirm-inline" in:fade={{ duration: 150 }}>
					<span style="font-weight: 600; opacity: 0.9;">¿Eliminar mensaje?</span>
					<div class="flex gap-2">
						<button class="btn-confirm-del" onclick={() => onConfirmDelete(msg.id)}
							>Sí, borrar</button
						>
						<button class="btn-cancel-del" onclick={() => onCancelDelete()}>Cancelar</button>
					</div>
				</div>
			{/if}

			<!-- Reactions show below bubble -->
			{#if msg.reactions && Object.keys(msg.reactions).length > 0}
				<div class="reactions-list">
					{#each Object.entries(msg.reactions) as [emoji, data]}
						<button
							class="reaction-tag {data.reacted ? 'user-reacted' : ''}"
							onclick={() => onReact(msg.id, emoji)}
							aria-label="{data.reacted ? 'Quitar reacción' : 'Reaccionar con'} {emoji}"
						>
							<span>{emoji}</span>
							<span style="opacity: 0.7;">{data.count}</span>
						</button>
					{/each}
				</div>
			{/if}

			<span class="msg-time">
				{formatTime(msg.created_at)}
				{#if msg.edited_at}
					<span class="edited-tag" title="Editado">(editado)</span>
				{/if}
				{#if isMe && msg.error}
					<span class="read-indicator failed" title="No se pudo enviar">
						<span class="material-icons-round">error_outline</span>
					</span>
				{:else if isMe && msg.pending}
					<span class="read-indicator pending" title="Enviando…">
						<span class="material-icons-round">schedule</span>
					</span>
				{:else if isMe && msg.read_at}
					<span class="read-indicator" title="Visto {formatTime(msg.read_at)}">
						<span class="material-icons-round">done_all</span>
					</span>
				{:else if isMe}
					<span class="read-indicator sent" title="Enviado">
						<span class="material-icons-round">done</span>
					</span>
				{/if}
			</span>

			{#if isMe && msg.error}
				<div class="send-failed" in:fade={{ duration: 150 }}>
					<span class="send-failed-text">No se pudo enviar.</span>
					<button class="send-failed-btn retry" onclick={() => onRetry?.(msg.id)}>Reintentar</button
					>
					<button class="send-failed-btn discard" onclick={() => onDiscard?.(msg.id)}
						>Descartar</button
					>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	@keyframes bubble-in-me {
		from {
			opacity: 0;
			transform: translateY(12px) scale(0.94);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@keyframes bubble-in-peer {
		from {
			opacity: 0;
			transform: translateY(12px) scale(0.94);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.message-group {
		display: flex;
		flex-direction: column;
		max-width: 72%;
		animation-fill-mode: both;
		animation-duration: 350ms;
		animation-timing-function: var(--ease-spring);
		animation-delay: var(--stagger-delay, 0ms);
	}

	.message-group.no-anim {
		animation: none !important;
		opacity: 1;
	}

	.message-group.me {
		align-self: flex-end;
		align-items: flex-end;
		animation-name: bubble-in-me;
	}

	.message-group.peer {
		align-self: flex-start;
		align-items: flex-start;
		animation-name: bubble-in-peer;
	}

	.message-bubble-row {
		display: flex;
		align-items: flex-end;
		gap: 6px;
	}

	.peer-mini-avatar {
		width: 24px;
		height: 24px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: var(--grad-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		font-weight: 700;
		font-size: 0.7rem;
		overflow: hidden;
		flex-shrink: 0;
		margin-bottom: 2px;
	}

	.peer-mini-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.bubble-wrapper {
		position: relative;
		display: flex;
		flex-direction: column;
	}

	.message-group.me .bubble-wrapper {
		align-items: flex-end;
	}
	.message-group.peer .bubble-wrapper {
		align-items: flex-start;
	}

	.message-bubble {
		position: relative;
		padding: 7px 12px;
		border-radius: var(--radius-md);
		font-size: 0.82rem;
		line-height: 1.4;
		word-break: break-word;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
	}

	.message-group.me .message-bubble {
		background: linear-gradient(135deg, var(--accent-blue-base) 0%, var(--accent-blue-dark) 100%);
		color: #ffffff;
		border-bottom-right-radius: 2px;
		box-shadow:
			0 2px 8px rgba(var(--accent-blue-rgb), 0.25),
			inset 0 1px 1px rgba(255, 255, 255, 0.35);
	}

	.message-group.peer .message-bubble {
		background: var(--bg-surface-solid, #ffffff);
		color: var(--text-primary);
		border-bottom-left-radius: 2px;
		border: 1px solid var(--border-subtle);
		border-top: 1px solid var(--glass-border-t);
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
	}

	/* Zumbido: se muestra centrado como aviso de sistema, sin alinear a un lado */
	.message-group.zumbido-group {
		align-self: center;
		align-items: center;
		max-width: 100%;
	}
	.message-group.zumbido-group .bubble-wrapper {
		align-items: center;
	}
	.message-group.zumbido-group .msg-time {
		justify-content: center;
	}

	.emoji-only-bubble {
		background: transparent !important;
		border: none !important;
		box-shadow: none !important;
		padding: 0 !important;
		backdrop-filter: none !important;
	}
	.emoji-only-bubble .message-text-p {
		font-size: 2.2rem !important;
		line-height: 1.15;
		margin: 0;
	}
	:global(.emoji-only-bubble .msn-emoji-render) {
		width: 34px !important;
		height: 34px !important;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2)) !important;
	}

	.zumbido-bubble {
		background: linear-gradient(
			135deg,
			rgba(245, 166, 35, 0.15) 0%,
			rgba(var(--accent-blue-rgb), 0.15) 100%
		) !important;
		border: 1px solid rgba(245, 166, 35, 0.4) !important;
		box-shadow:
			0 0 12px rgba(245, 166, 35, 0.2),
			inset 0 1px 2px rgba(255, 255, 255, 0.3) !important;
		border-radius: var(--radius-lg) !important;
		padding: 8px 18px !important;
		animation: zumbido-shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
		transform-origin: center center;
		min-width: 220px;
		text-align: center;
	}

	:global(.bubble-wrapper .zumbido-bubble::before) {
		display: none !important;
	}

	@keyframes zumbido-shake {
		10%,
		90% {
			transform: translate3d(-1px, 0, 0);
		}
		20%,
		80% {
			transform: translate3d(2px, 0, 0);
		}
		30%,
		50%,
		70% {
			transform: translate3d(-4px, 0, 0);
		}
		40%,
		60% {
			transform: translate3d(4px, 0, 0);
		}
	}

	.zumbido-content {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
	}

	.zumbido-icon {
		color: var(--aero-amber);
		font-size: 22px !important;
		filter: drop-shadow(0 0 6px var(--aero-amber));
	}

	.zumbido-text {
		display: flex;
		flex-direction: column;
	}

	.zumbido-title {
		font-size: 0.68rem;
		font-weight: 800;
		color: var(--accent-blue-dark);
		letter-spacing: 0.05em;
		text-transform: uppercase;
		margin-bottom: 1px;
	}

	.zumbido-desc {
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.message-media-container {
		max-width: 260px;
		border-radius: var(--radius-sm);
		overflow: hidden;
		margin-bottom: 4px;
	}

	.message-media-img,
	.message-media-video {
		width: 100%;
		max-height: 180px;
		object-fit: cover;
		border-radius: var(--radius-sm);
		display: block;
	}

	.message-text-p {
		margin: 0;
		line-height: 1.4;
	}

	.msn-emoji-render {
		width: 1.25em;
		height: 1.25em;
		vertical-align: -0.2em;
		margin: 0 1px;
		image-rendering: pixelated;
	}

	.msg-time {
		font-size: 0.65rem;
		color: var(--text-muted);
		margin-top: 3px;
		display: flex;
		align-items: center;
		gap: 3px;
	}

	.read-indicator {
		display: inline-flex;
		align-items: center;
		color: var(--accent-blue-base);
		opacity: 0.85;
	}

	.read-indicator.sent {
		color: var(--text-muted);
		opacity: 0.6;
	}

	.read-indicator.pending {
		color: var(--text-muted);
		opacity: 0.6;
	}

	.read-indicator.failed {
		color: #e04b4b;
		opacity: 0.95;
	}

	.send-failed {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 3px;
		font-size: 0.7rem;
	}

	.send-failed-text {
		color: #e04b4b;
	}

	.send-failed-btn {
		background: transparent;
		border: none;
		padding: 1px 4px;
		font-size: 0.7rem;
		font-weight: 600;
		cursor: pointer;
		border-radius: var(--radius-xs, 4px);
	}

	.send-failed-btn.retry {
		color: var(--accent-blue-base);
	}

	.send-failed-btn.discard {
		color: var(--text-muted);
	}

	.send-failed-btn:hover {
		text-decoration: underline;
	}

	.media-uploading {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		min-width: 130px;
		color: var(--text-muted);
		font-size: 0.78rem;
	}

	.upload-spinner {
		width: 14px;
		height: 14px;
		border: 2px solid var(--border-subtle);
		border-top-color: var(--accent-blue-base);
		border-radius: 50%;
		animation: upload-spin 0.7s linear infinite;
	}

	@keyframes upload-spin {
		to {
			transform: rotate(360deg);
		}
	}

	.read-indicator .material-icons-round {
		font-size: 0.8rem;
	}

	.edited-tag {
		font-size: 0.62rem;
		color: var(--text-muted);
		opacity: 0.7;
		font-style: italic;
	}

	/* Cita de respuesta dentro de la burbuja */
	.reply-quote {
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 3px 6px;
		margin-bottom: 4px;
		border-left: 3px solid var(--accent-blue-base);
		border-radius: var(--radius-xs);
		background: rgba(var(--accent-blue-rgb), 0.08);
		cursor: pointer;
		max-width: 100%;
	}
	.message-group.me .reply-quote {
		background: rgba(255, 255, 255, 0.2);
		border-left-color: #ffffff;
	}
	.message-group.me .reply-quote .reply-quote-author {
		color: #ffffff;
	}
	.message-group.me .reply-quote .reply-quote-text {
		color: rgba(255, 255, 255, 0.85);
	}
	.reply-quote-author {
		font-size: 0.65rem;
		font-weight: 700;
		color: var(--accent-blue-dark);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.reply-quote-text {
		font-size: 0.7rem;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 220px;
	}

	/* Resaltado del resultado de búsqueda actual */
	.message-group.search-match .message-bubble {
		outline: 2px solid var(--aero-amber);
		outline-offset: 2px;
		transition: outline 0.2s ease;
	}

	.reactions-list {
		display: flex;
		gap: 3px;
		margin-top: 3px;
	}

	.reaction-tag {
		padding: 1px 5px;
		border-radius: var(--radius-sm);
		background: var(--bg-surface-solid, #ffffff);
		border: 1px solid var(--border-subtle);
		font-size: 0.68rem;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 2px;
		cursor: pointer;
		transition: all var(--t-fast);
	}

	.reaction-tag:hover {
		background: rgba(var(--accent-blue-rgb), 0.1);
		border-color: var(--accent-blue-base);
	}

	.reaction-tag.user-reacted {
		background: rgba(var(--accent-blue-rgb), 0.15);
		border-color: var(--accent-blue-base);
		color: var(--accent-blue-base);
	}

	.message-actions-wrapper {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		gap: 2px;
		opacity: 0;
		transition: opacity 0.18s ease;
		z-index: 20;
		user-select: none;
		-webkit-user-select: none;
	}
	.bubble-wrapper:hover .message-actions-wrapper {
		opacity: 1;
	}
	.actions-right {
		right: 100%;
		margin-right: 6px;
		flex-direction: row;
	}
	.actions-left {
		left: 100%;
		margin-left: 6px;
		flex-direction: row-reverse;
	}

	.action-btn-mini {
		background: var(--bg-surface-solid, #ffffff);
		border: 1px solid var(--border-subtle);
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
		color: var(--text-muted);
		cursor: pointer;
		padding: 3px;
		width: 24px;
		height: 24px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			background 0.18s,
			color 0.18s;
	}
	.action-btn-mini .material-icons-round {
		font-size: 14px;
	}
	.action-btn-mini.react-btn:hover {
		background: rgba(var(--accent-blue-rgb), 0.12);
		color: var(--accent-blue-base);
	}
	.action-btn-mini.reply-btn:hover {
		background: rgba(var(--accent-blue-rgb), 0.12);
		color: var(--accent-blue-base);
	}
	.action-btn-mini.edit-btn:hover {
		background: rgba(245, 166, 35, 0.14);
		color: var(--aero-amber);
	}
	.action-btn-mini.delete-btn:hover {
		background: rgba(244, 63, 94, 0.12);
		color: var(--rose-500, #f43f5e);
	}

	.floating-picker-wrapper {
		position: absolute;
		z-index: 50;
	}
	.floating-picker-wrapper.picker-up {
		bottom: 100%;
		margin-bottom: 6px;
	}
	.floating-picker-wrapper.picker-down {
		top: 100%;
		margin-top: 6px;
	}
	.floating-picker-wrapper.picker-right {
		right: 0;
	}
	.floating-picker-wrapper.picker-left {
		left: 0;
	}

	.deleted-text-p {
		font-style: italic;
		opacity: 0.6;
		display: flex;
		align-items: center;
		margin: 0;
	}
	.message-bubble.deleted-bubble {
		background: rgba(0, 0, 0, 0.03) !important;
		border: 1px dashed var(--border-subtle) !important;
		color: var(--text-muted) !important;
		box-shadow: none !important;
		backdrop-filter: none !important;
	}

	.delete-confirm-inline {
		background: var(--bg-surface-solid, #ffffff);
		border: 1px solid var(--rose-500, #f43f5e);
		border-radius: var(--radius-sm);
		padding: 8px 10px;
		margin-top: 4px;
		font-size: 0.78rem;
		color: var(--text-primary);
		display: flex;
		flex-direction: column;
		gap: 6px;
		z-index: 10;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
	}
	.btn-confirm-del {
		background: rgba(244, 63, 94, 0.15);
		color: var(--rose-500, #f43f5e);
		border: 1px solid rgba(244, 63, 94, 0.3);
		padding: 4px 8px;
		font-size: 0.75rem;
		border-radius: var(--radius-xs);
		cursor: pointer;
		transition: background 0.18s;
		flex: 1;
		font-weight: 600;
	}
	.btn-confirm-del:hover {
		background: rgba(244, 63, 94, 0.3);
	}
	.btn-cancel-del {
		background: rgba(0, 0, 0, 0.05);
		color: var(--text-secondary);
		border: 1px solid var(--border-subtle);
		padding: 4px 8px;
		font-size: 0.75rem;
		border-radius: var(--radius-xs);
		cursor: pointer;
		transition: background 0.18s;
		flex: 1;
	}
	.btn-cancel-del:hover {
		background: rgba(0, 0, 0, 0.1);
	}
</style>
