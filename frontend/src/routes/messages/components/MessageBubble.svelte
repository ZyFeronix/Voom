<script module>
	const listingCache = new Map();
</script>

<script>
	import { fade } from 'svelte/transition';
	import MediaPlayer from '$lib/components/MediaPlayer.svelte';
	import { EMOTICON_CODES, parseMsnEmotes, emoteFor } from '$lib/data/msnEmoticons.js';
	import { getProxiedMediaUrl } from '$lib/utils/mediaProxy.js';
	import { formatTime } from '$lib/utils/datetime.js';
	import { isZumbidoMessage } from '$lib/utils/zumbido.js';
	import { mediaViewer } from '$lib/stores/mediaViewer.svelte.js';
	import { marketplace as marketplaceApi } from '$lib/api.js';

	let marketplaceItem = $state(null);
	let parsedMessage = $derived.by(() => {
		const body = msg.body || msg.content || '';
		const matchRegex = new RegExp(
			'(?:🛍️|🧾)\\s*(.+) — (.+) USD\\n(?:https?://[^/]+)?/marketplace\\?(?:item|product)=(\\d+)'
		);
		const match = body.match(matchRegex);
		if (match) {
			const itemId = match[3];
			const fullMatch = match[0];
			const textBody = body.replace(fullMatch, '').trim();
			return {
				isMarketplace: true,
				itemId,
				title: match[1].trim(),
				price: match[2].trim(),
				textBody
			};
		}
		// Fallback si envían solo un enlace suelto
		const linkRegex = new RegExp('(?:https?://[^/]+)?/marketplace\\?(?:item|product)=(\\d+)');
		const linkMatch = body.match(linkRegex);
		if (linkMatch) {
			return {
				isMarketplace: true,
				itemId: linkMatch[1],
				title: null,
				price: null,
				textBody: body
			};
		}
		return { isMarketplace: false, textBody: body };
	});

	$effect(() => {
		if (parsedMessage.isMarketplace && parsedMessage.itemId) {
			const cached = listingCache.get(parsedMessage.itemId);
			if (cached) {
				marketplaceItem = cached;
			} else if (!marketplaceItem) {
				marketplaceApi
					.get(parsedMessage.itemId)
					.then((res) => {
						if (res && res.listing) {
							listingCache.set(parsedMessage.itemId, res.listing);
							marketplaceItem = res.listing;
						}
					})
					.catch(() => {});
			}
		}
	});
	let {
		msg,
		isMe,
		activeConv,
		animated = false,
		staggerDelay = 0,
		isGroupStart = true,
		isGroupEnd = true,
		deletingMessageId,
		isCurrentMatch = false,
		onBubbleClick,
		onDeleteClick,
		onConfirmDelete,
		onCancelDelete,
		onReactionMenuClick,
		onReact,
		onReply,
		onEdit,
		onQuoteClick,
		onRetry,
		onDiscard
	} = $props();

	let copiedRecently = $state(false);

	function copyMessageText(text) {
		if (!text || typeof navigator === 'undefined') return;
		navigator.clipboard
			.writeText(text)
			.then(() => {
				copiedRecently = true;
				setTimeout(() => {
					copiedRecently = false;
				}, 2000);
			})
			.catch(() => {});
	}

	function handleImageClick(e, url) {
		e.stopPropagation();
		mediaViewer.open({
			mediaList: [url],
			type: 'standalone',
			mediaTitle: 'Imagen adjunta'
		});
	}

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

	const isZumbido = $derived(isZumbidoMessage(msg));

	const reactionsList = $derived(Object.entries(msg.reactions || {}));

	// Nombre legible del remitente para lectores de pantalla (aria-label).
	// Para los propios usamos "Tú"; para el peer usamos su display_name/username real.
	const peerLabel = $derived(
		isMe
			? 'Tú'
			: activeConv?.peer_display_name ||
					activeConv?.peer_username ||
					msg.sender_display_name ||
					msg.sender_username ||
					'Contacto'
	);

	// Descripción accesible del contenido del mensaje (evita leer códigos MSN crudos).
	const msgBodyLabel = $derived.by(() => {
		if (isZumbido) return 'Envió un zumbido';
		if (msg.is_deleted) return 'Mensaje eliminado';
		if (msg.media_type === 'video') return 'Envió un video';
		if (msg.media_type === 'audio') return 'Envió una nota de voz';
		if (msg.media_url) return 'Envió una imagen';
		return msg.body || msg.content || 'Mensaje';
	});

	const msgAriaLabel = $derived(`${peerLabel}: ${msgBodyLabel}`);
</script>

<div
	class="message-group {isMe ? 'me' : 'peer'}"
	class:zumbido-group={isZumbido}
	class:continued={!isGroupStart && !isZumbido}
	class:no-anim={!animated}
	class:search-match={isCurrentMatch}
	data-msg-id={msg.id}
	style="--stagger-delay: {staggerDelay}ms"
>
	<div class="message-bubble-row">
		{#if !isMe && !isZumbido}
			<!-- Avatar solo en el último mensaje de una racha del peer (flag derivado en ChatPane) -->
			{#if isGroupEnd}
				<div class="peer-mini-avatar" style="flex: 0 0 28px; min-width: 28px; min-height: 28px;">
					{#if activeConv?.peer_avatar}
						<img
							src={activeConv.peer_avatar}
							alt={activeConv.peer_display_name}
							width="28"
							height="28"
							loading="lazy"
							decoding="async"
						/>
					{:else}
						<span>{getInitials(activeConv?.peer_display_name || activeConv?.peer_username)}</span>
					{/if}
				</div>
			{:else}
				<div
					class="peer-mini-avatar ghost"
					style="flex: 0 0 28px; min-width: 28px; min-height: 28px;"
					aria-hidden="true"
				></div>
			{/if}
		{/if}

		<div class="bubble-wrapper">
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div
				class="message-bubble"
				class:emoji-only-bubble={!msg.is_deleted &&
					isEmojiOnly(msg.body || msg.content) &&
					!msg.media_url}
				class:zumbido-bubble={isZumbido}
				class:deleted-bubble={msg.is_deleted}
				tabindex={isZumbido ? -1 : 0}
				role={isZumbido ? 'presentation' : 'article'}
				aria-label={msgAriaLabel}
				onclick={(e) => {
					if (!isZumbido) onBubbleClick(e, msg.id);
				}}
				onkeydown={(e) => {
					if (isZumbido) return;
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						onBubbleClick(e, msg.id);
					}
				}}
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
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
								<img
									src={getProxiedMediaUrl(msg.media_url)}
									alt="Attached media"
									class="message-media-img clickable"
									onclick={(e) => handleImageClick(e, msg.media_url)}
									loading="lazy"
									decoding="async"
									crossorigin="anonymous"
									referrerpolicy="no-referrer"
									title="Clic para ampliar imagen"
								/>
							{/if}
						</div>
					{/if}

					{#if parsedMessage.textBody}
						{#if isZumbido}
							<div class="zumbido-content">
								<span class="zumbido-bolt" aria-hidden="true">
									<span class="material-icons-round">bolt</span>
								</span>
								<span class="zumbido-label">
									{isMe ? 'Has enviado un Zumbido' : 'Te han enviado un Zumbido'}
								</span>
							</div>
						{:else}
							<p class="message-text-p">
								{#each parseMsnEmotes(parsedMessage.textBody) as part}
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

					{#if parsedMessage.isMarketplace}
						<div class="message-marketplace-card">
							<a
								href="/marketplace?item={parsedMessage.itemId}"
								class="marketplace-card-link"
								onclick={(e) => e.stopPropagation()}
								title="Ver publicación en Marketplace"
							>
								<div
									class="marketplace-media-box"
									style="flex: 0 0 52px; min-width: 52px; min-height: 52px;"
								>
									{#if marketplaceItem?.image_url}
										<img
											src={getProxiedMediaUrl(marketplaceItem.image_url)}
											alt={marketplaceItem.title || parsedMessage.title || 'Producto'}
											loading="lazy"
											decoding="async"
										/>
									{:else}
										<div class="marketplace-placeholder">
											<span class="material-icons-round" aria-hidden="true">storefront</span>
										</div>
									{/if}
								</div>
								<div class="marketplace-card-info">
									<div class="marketplace-card-header">
										<span class="marketplace-card-label">Producto de Marketplace</span>
										<span class="material-icons-round marketplace-open-icon" aria-hidden="true"
											>open_in_new</span
										>
									</div>
									<span class="marketplace-card-title">
										{marketplaceItem?.title || parsedMessage.title || 'Cargando producto...'}
									</span>
									<div class="marketplace-card-footer">
										<span class="marketplace-card-price">
											{marketplaceItem ? marketplaceItem.price : parsedMessage.price || '...'} USD
										</span>
										{#if marketplaceItem?.category_name}
											<span class="marketplace-card-category">{marketplaceItem.category_name}</span>
										{/if}
									</div>
								</div>
							</a>
						</div>
					{/if}
				{/if}
			</div>

			<!-- Reacciones EN FLUJO bajo la burbuja: cero solapes con el mensaje siguiente -->
			{#if reactionsList.length > 0 && !isZumbido}
				<div class="reactions-list">
					{#each reactionsList as [emoji, data] (emoji)}
						<button
							class="reaction-tag"
							class:user-reacted={data.reacted}
							onclick={() => onReact(msg.id, emoji)}
							aria-label="{data.reacted ? 'Quitar reacción' : 'Reaccionar con'} {emoji}"
						>
							{#if emoteFor(emoji)}
								<img
									class="msn-emoji-render"
									src={emoteFor(emoji).url}
									alt={emoji}
									title={emoteFor(emoji).name}
									loading="lazy"
									decoding="async"
								/>
							{:else}
								<span>{emoji}</span>
							{/if}
							{#if data.count > 1}<span class="reaction-count">{data.count}</span>{/if}
						</button>
					{/each}
				</div>
			{/if}

			<!-- Meta en flujo: hora + estado + acciones (aparecen al hover/foco) -->
			<div class="meta-row">
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
						<span class="read-indicator read" title="Visto {formatTime(msg.read_at)}">
							<span class="material-icons-round">done_all</span>
						</span>
					{:else if isMe}
						<span class="read-indicator sent" title="Enviado">
							<span class="material-icons-round">done</span>
						</span>
					{/if}
				</span>

				{#if !isZumbido && !msg.is_deleted}
					<div class="msg-actions">
						<button
							class="action-btn-mini react-btn"
							onclick={(e) => onReactionMenuClick(e, msg.id)}
							aria-label="Reaccionar"
							title="Reaccionar"
						>
							<span class="material-icons-round">add_reaction</span>
						</button>
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

						{#if msg.body || msg.content}
							<button
								class="action-btn-mini copy-btn"
								class:copied={copiedRecently}
								onclick={(e) => {
									e.stopPropagation();
									copyMessageText(msg.body || msg.content);
								}}
								aria-label="Copiar texto"
								title={copiedRecently ? '¡Copiado!' : 'Copiar texto'}
							>
								<span class="material-icons-round">{copiedRecently ? 'check' : 'content_copy'}</span
								>
							</button>
						{/if}

						{#if isMe && (msg.body || msg.content)}
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
								onclick={(e) => {
									e.stopPropagation();
									onDeleteClick(msg.id);
								}}
								aria-label="Eliminar"
								title="Eliminar mensaje"
							>
								<span class="material-icons-round">delete</span>
							</button>
						{/if}
					</div>
				{/if}
			</div>

			{#if deletingMessageId === msg.id && !isZumbido}
				<div class="delete-confirm-inline" in:fade={{ duration: 150 }}>
					<div class="delc-question">
						<span class="delc-icon" aria-hidden="true">
							<span class="material-icons-round">delete_forever</span>
						</span>
						<span class="delc-text">¿Eliminar mensaje?</span>
					</div>
					<div class="delc-actions">
						<button
							class="btn-confirm-del"
							onclick={() => onConfirmDelete(msg.id)}
							aria-label="Confirmar eliminación del mensaje"
						>
							<span class="material-icons-round" aria-hidden="true">delete</span>Sí, borrar
						</button>
						<button class="btn-cancel-del" onclick={() => onCancelDelete()}>
							<span class="material-icons-round" aria-hidden="true">undo</span>Cancelar
						</button>
					</div>
				</div>
			{/if}

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
	/* ═══════════════════════════════════════════════════════════
	   Voom! Messenger — Burbujas "Retro-Aero limpio"
	   Sin blur por burbuja, sin posicionamiento absoluto: las
	   reacciones y acciones viven EN FLUJO bajo la burbuja.
	   ═══════════════════════════════════════════════════════════ */

	@keyframes bubble-in {
		from {
			opacity: 0;
			transform: translateY(8px) scale(0.97);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.message-group {
		display: flex;
		flex-direction: column;
		max-width: min(72%, 560px);
		position: relative;
		animation: bubble-in 0.28s var(--ease-spring) both;
		animation-delay: var(--stagger-delay, 0ms);
	}
	.message-group.no-anim {
		animation: none !important;
		opacity: 1;
	}
	.message-group.me {
		align-self: flex-end;
		align-items: flex-end;
	}
	.message-group.peer {
		align-self: flex-start;
		align-items: flex-start;
	}
	/* Rachas continuadas: compacidad Messenger */
	.message-group.continued {
		margin-top: -2px;
	}

	.message-bubble-row {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		width: 100%;
	}
	.message-group.me .message-bubble-row {
		justify-content: flex-end;
	}

	.peer-mini-avatar {
		width: 28px;
		height: 28px;
		min-width: 28px;
		min-height: 28px;
		flex: 0 0 28px;
		border-radius: 10px;
		corner-shape: squircle;
		background: linear-gradient(140deg, var(--aero-sky), var(--accent-blue-base));
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		font-weight: 800;
		font-size: 0.7rem;
		overflow: hidden;
		flex-shrink: 0;
		/* 24px = margen superior (4) + altura fija de la meta-row (20):
		   el avatar cierra EXACTO con el borde inferior de la burbuja. */
		margin-bottom: 24px;
	}
	.peer-mini-avatar img {
		width: 100%;
		height: 100%;
		border-radius: 10px;
		corner-shape: squircle;
		object-fit: cover;
	}
	.peer-mini-avatar.ghost {
		background: none;
	}

	.bubble-wrapper {
		position: relative;
		display: flex;
		flex-direction: column;
		min-width: 0;
		max-width: 100%;
	}
	.message-group.me .bubble-wrapper {
		align-items: flex-end;
	}
	.message-group.peer .bubble-wrapper {
		align-items: flex-start;
	}

	/* ── Burbuja base ───────────────────────────────────────── */
	.message-bubble {
		position: relative;
		min-width: 64px;
		padding: 9px 14px;
		border-radius: 16px;
		font-size: 0.88rem;
		line-height: 1.5;
		word-break: break-word;
		box-sizing: border-box;
	}

	/* Propia: gradiente del acento, texto blanco */
	.message-group.me .message-bubble {
		background: linear-gradient(160deg, #2ea8ff 0%, var(--accent-blue-base) 100%);
		color: #ffffff;
		border-radius: 16px 16px 4px 16px;
		box-shadow: 0 2px 10px rgba(var(--accent-blue-rgb), 0.28);
	}
	:global([data-theme='midnight']) .message-group.me .message-bubble {
		background: linear-gradient(160deg, #1e9bf0 0%, #1266c4 100%);
	}

	/* Del peer: tarjeta neutra sólida por tema (sin blur) */
	.message-group.peer .message-bubble {
		background: #ffffff;
		color: var(--text-primary, #0f172a);
		border: 1px solid rgba(15, 40, 80, 0.1);
		border-radius: 16px 16px 16px 4px;
		transition: border-color 0.16s ease;
	}
	.message-group.peer:hover .message-bubble {
		border-color: rgba(15, 40, 80, 0.2);
	}
	:global([data-theme='dark']) .message-group.peer .message-bubble {
		background: rgba(255, 255, 255, 0.09);
		color: #ffffff;
		border-color: rgba(255, 255, 255, 0.09);
	}
	:global([data-theme='midnight']) .message-group.peer .message-bubble {
		background: rgba(148, 184, 230, 0.1);
		color: #ffffff;
		border-color: rgba(160, 210, 255, 0.14);
	}

	/* Zumbido: aviso centrado nostálgico (ámbar = único uso del color) */
	.message-group.zumbido-group {
		align-self: center;
		align-items: center;
		max-width: 100%;
		margin: 4px 0;
		user-select: none !important;
		-webkit-user-select: none !important;
	}
	.message-group.zumbido-group .bubble-wrapper {
		align-items: center;
	}
	.message-group.zumbido-group .msg-time {
		justify-content: center;
	}
	.message-group.zumbido-group .meta-row {
		justify-content: center;
	}

	.zumbido-bubble {
		display: inline-flex;
		background: rgba(var(--aero-amber-rgb, 245, 166, 35), 0.12) !important;
		border: 1px solid rgba(var(--aero-amber-rgb, 245, 166, 35), 0.35) !important;
		border-radius: var(--radius-full) !important;
		padding: 6px 16px !important;
		min-width: 0 !important;
		width: auto !important;
		max-width: fit-content !important;
		animation: zumbido-shake 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
		transform-origin: center center;
		cursor: default !important;
	}
	:global([data-theme='dark']) .zumbido-bubble,
	:global([data-theme='midnight']) .zumbido-bubble {
		background: rgba(var(--aero-amber-rgb, 245, 166, 35), 0.14) !important;
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
			transform: translate3d(-3px, 0, 0);
		}
		40%,
		60% {
			transform: translate3d(3px, 0, 0);
		}
	}

	.zumbido-content {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		pointer-events: none;
	}
	.zumbido-bolt {
		display: inline-flex;
		color: var(--aero-amber, #f5a623);
	}
	.zumbido-bolt .material-icons-round {
		font-size: 17px;
	}
	.zumbido-label {
		font-size: 0.82rem;
		font-weight: 800;
		color: var(--aero-amber, #b45309);
		letter-spacing: -0.01em;
	}
	:global([data-theme='dark']) .zumbido-label,
	:global([data-theme='midnight']) .zumbido-label {
		color: var(--aero-amber, #fbbf24);
	}

	/* Emoji-only: sin caja */
	.emoji-only-bubble {
		background: transparent !important;
		border: none !important;
		box-shadow: none !important;
		padding: 0 !important;
	}
	.emoji-only-bubble .message-text-p {
		font-size: 2.5rem !important;
		line-height: 1.15;
		margin: 0;
	}
	:global(.emoji-only-bubble .msn-emoji-render) {
		width: 40px !important;
		height: 40px !important;
	}

	/* Eliminado */
	.deleted-text-p {
		font-style: italic;
		opacity: 0.65;
		display: flex;
		align-items: center;
		margin: 0;
		font-size: 0.82rem;
	}
	.message-bubble.deleted-bubble {
		background: transparent !important;
		border: 1px dashed var(--border-subtle) !important;
		color: var(--text-muted) !important;
		box-shadow: none !important;
	}

	/* ── Contenido ──────────────────────────────────────────── */
	.message-text-p {
		margin: 0;
		line-height: 1.48;
		white-space: pre-wrap;
	}
	.message-text-p .msn-emoji-render {
		image-rendering: pixelated;
	}

	.message-media-container {
		max-width: 290px;
		min-height: 60px;
		border-radius: 10px;
		overflow: hidden;
		margin-bottom: 6px;
	}
	.message-media-img {
		width: 100%;
		max-height: 230px;
		object-fit: cover;
		border-radius: 10px;
		display: block;
	}
	/* El vídeo vive dentro de MediaPlayer: se estiliza por contexto */
	.message-media-container :global(video) {
		width: 100%;
		max-height: 230px;
		object-fit: cover;
		border-radius: 10px;
		display: block;
	}
	.message-media-img.clickable {
		cursor: zoom-in;
		transition: transform 0.2s var(--ease-spring);
	}
	.message-media-img.clickable:hover {
		transform: scale(1.02);
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
		width: 15px;
		height: 15px;
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

	/* Cita de respuesta */
	.reply-quote {
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 5px 9px;
		margin-bottom: 6px;
		border-left: 3px solid var(--aero-sky, var(--accent-blue-base));
		border-radius: 6px;
		background: rgba(var(--accent-blue-rgb), 0.08);
		cursor: pointer;
		max-width: 100%;
		transition: background 0.15s ease;
	}
	.reply-quote:hover {
		background: rgba(var(--accent-blue-rgb), 0.14);
	}
	.message-group.me .reply-quote {
		background: rgba(255, 255, 255, 0.18);
		border-left-color: #ffffff;
	}
	.message-group.me .reply-quote:hover {
		background: rgba(255, 255, 255, 0.28);
	}
	.message-group.peer .reply-quote-author {
		color: var(--accent-blue-base);
		font-weight: 800;
		font-size: 0.74rem;
	}
	.message-group.me .reply-quote-author {
		color: #ffffff;
		font-weight: 800;
		font-size: 0.74rem;
	}
	.reply-quote-text {
		font-size: 0.72rem;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 240px;
	}
	.message-group.me .reply-quote-text {
		color: rgba(255, 255, 255, 0.9);
	}

	/* Resaltado del resultado de búsqueda actual */
	.message-group.search-match .message-bubble {
		outline: 2px solid var(--aero-amber, #f5a623);
		outline-offset: 2px;
	}

	/* ── Reacciones EN FLUJO ────────────────────────────────── */
	.reactions-list {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 3px;
	}
	.reaction-tag {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 1px 7px;
		min-height: 22px;
		border-radius: var(--radius-full);
		background: var(--bg-surface-solid, var(--bg-surface));
		border: 1px solid var(--border-subtle);
		font-size: 0.74rem;
		line-height: 1.3;
		cursor: pointer;
		transition:
			transform 0.14s var(--ease-spring),
			border-color 0.15s ease,
			background 0.15s ease;
	}
	:global([data-theme='dark']) .reaction-tag,
	:global([data-theme='midnight']) .reaction-tag {
		background: rgba(255, 255, 255, 0.1);
	}
	.reaction-tag:hover {
		transform: translateY(-1px) scale(1.06);
		border-color: var(--accent-blue-base);
	}
	.reaction-tag:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: 2px;
	}
	.reaction-tag.user-reacted {
		background: rgba(var(--accent-blue-rgb), 0.14);
		border-color: var(--accent-blue-base);
	}
	.reaction-count {
		font-size: 0.64rem;
		font-weight: 800;
		color: var(--text-secondary);
	}

	/* ── Meta row: hora + acciones EN FLUJO ─────────────────── */
	.meta-row {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 4px;
		/* Altura fija: garantiza la alineación del avatar (margin-bottom 24px) */
		height: 20px;
		max-width: 100%;
	}
	.message-group.peer .meta-row {
		flex-direction: row;
	}
	.message-group.me .meta-row {
		flex-direction: row-reverse;
	}

	.msg-time {
		font-size: 0.66rem;
		line-height: 1;
		color: var(--text-muted);
		display: inline-flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
		white-space: nowrap;
	}
	.read-indicator {
		display: inline-flex;
		align-items: center;
		color: var(--text-muted);
		opacity: 0.6;
	}
	.read-indicator .material-icons-round {
		font-size: 0.84rem;
	}
	.read-indicator.read {
		color: var(--aero-mint, #00d4aa);
		opacity: 1;
	}
	.read-indicator.failed {
		color: #e5484d;
		opacity: 0.95;
	}
	.edited-tag {
		font-size: 0.62rem;
		color: var(--text-muted);
		opacity: 0.7;
		font-style: italic;
	}

	/* Acciones: reveladas al hover o foco de teclado, en flujo */
	.msg-actions {
		display: flex;
		gap: 2px;
		opacity: 0;
		transition: opacity 0.15s ease;
	}
	.bubble-wrapper:hover .msg-actions,
	.bubble-wrapper:focus-within .msg-actions {
		opacity: 1;
	}
	@media (hover: none) {
		.msg-actions {
			opacity: 1;
		}
	}

	.action-btn-mini {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0;
		width: 26px;
		height: 26px;
		min-width: 26px;
		min-height: 26px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			background 0.15s ease,
			color 0.15s ease,
			transform 0.14s var(--ease-spring);
	}
	.action-btn-mini:hover {
		background: rgba(var(--accent-blue-rgb), 0.1);
		color: var(--accent-blue-base);
	}
	.action-btn-mini:active {
		transform: scale(0.92);
	}
	.action-btn-mini:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: 2px;
	}
	.action-btn-mini.edit-btn:hover {
		background: rgba(var(--aero-amber-rgb, 245, 166, 35), 0.12);
		color: var(--aero-amber, #b45309);
	}
	.action-btn-mini.delete-btn:hover {
		background: rgba(229, 72, 77, 0.12);
		color: #e5484d;
	}
	.action-btn-mini.copy-btn.copied {
		color: var(--aero-mint, #00d4aa);
	}
	.action-btn-mini .material-icons-round {
		font-size: 15px;
	}

	/* ── Envío fallido ──────────────────────────────────────── */
	.send-failed {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 4px;
		font-size: 0.72rem;
	}
	.send-failed-text {
		color: #e5484d;
		font-weight: 700;
	}
	.send-failed-btn {
		background: transparent;
		border: none;
		padding: 1px 4px;
		font-size: 0.72rem;
		font-weight: 700;
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

	/* ── Confirmación de borrado (en flujo, tinte danger) ───── */
	.delete-confirm-inline {
		--delc-rgb: 229, 72, 77;
		background: var(--bg-surface-solid, var(--bg-surface));
		border: 1px solid rgba(var(--delc-rgb), 0.4);
		border-radius: 12px;
		padding: 8px 10px;
		margin-top: 6px;
		font-size: 0.78rem;
		color: var(--text-primary);
		display: flex;
		flex-direction: column;
		gap: 8px;
		box-shadow: 0 6px 20px rgba(var(--delc-rgb), 0.12);
	}
	:global([data-theme='dark']) .delete-confirm-inline,
	:global([data-theme='midnight']) .delete-confirm-inline {
		background: rgba(229, 72, 77, 0.08);
	}
	.delc-question {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}
	.delc-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		flex-shrink: 0;
		border-radius: var(--radius-full);
		background: rgba(var(--delc-rgb), 0.14);
		color: #e5484d;
	}
	.delc-icon .material-icons-round {
		font-size: 13px;
	}
	.delc-text {
		font-weight: 700;
		letter-spacing: -0.01em;
		color: var(--text-primary);
		line-height: 1.3;
	}
	.delc-actions {
		display: flex;
		gap: 6px;
	}
	.btn-confirm-del {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		background: #e5484d;
		color: #ffffff;
		border: none;
		padding: 6px 12px;
		font-size: 0.74rem;
		font-weight: 700;
		font-family: inherit;
		border-radius: var(--radius-full);
		cursor: pointer;
		flex: 1;
		transition:
			filter var(--t-base),
			transform 0.14s var(--ease-spring);
	}
	.btn-confirm-del:hover {
		filter: brightness(1.08);
	}
	.btn-confirm-del:active {
		transform: scale(0.97);
	}
	.btn-confirm-del:focus-visible,
	.btn-cancel-del:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: 2px;
	}
	.btn-confirm-del .material-icons-round,
	.btn-cancel-del .material-icons-round {
		font-size: 13px;
	}
	.btn-cancel-del {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		background: transparent;
		color: var(--text-muted);
		border: 1px solid var(--border-subtle);
		padding: 6px 12px;
		font-size: 0.74rem;
		font-weight: 600;
		font-family: inherit;
		border-radius: var(--radius-full);
		cursor: pointer;
		flex: 1;
		transition:
			background var(--t-fast),
			color var(--t-fast),
			transform 0.14s var(--ease-spring);
	}
	.btn-cancel-del:hover {
		background: rgba(0, 0, 0, 0.05);
		color: var(--text-secondary);
	}
	:global([data-theme='dark']) .btn-cancel-del:hover,
	:global([data-theme='midnight']) .btn-cancel-del:hover {
		background: rgba(255, 255, 255, 0.06);
	}
	.btn-cancel-del:active {
		transform: scale(0.97);
	}

	@media (max-width: 768px) {
		.message-group {
			max-width: 86%;
		}
		/* En táctil las acciones quedan siempre visibles y discretas */
		.msg-actions {
			opacity: 0.85;
		}
	}

	/* ── Tarjeta de Producto de Marketplace en Mensajes ─────── */
	.message-marketplace-card {
		display: block;
		margin-top: 8px;
		width: 100%;
		max-width: 320px;
	}

	.marketplace-card-link {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border-radius: var(--radius-md, 14px);
		text-decoration: none;
		position: relative;
		overflow: hidden;
		transition:
			transform 0.22s var(--ease-spring),
			background 0.2s ease,
			border-color 0.2s ease,
			box-shadow 0.22s ease;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.marketplace-card-link:active {
		transform: scale(0.97) !important;
	}

	.marketplace-media-box {
		width: 52px;
		height: 52px;
		flex: 0 0 52px;
		min-width: 52px;
		min-height: 52px;
		border-radius: 12px;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}

	.marketplace-media-box img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		border-radius: 12px;
		transition: transform 0.3s var(--ease-out);
	}

	.marketplace-card-link:hover .marketplace-media-box img {
		transform: scale(1.06);
	}

	.marketplace-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 12px;
	}

	.marketplace-placeholder .material-icons-round {
		font-size: 26px !important;
	}

	.marketplace-card-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}

	.marketplace-card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
	}

	.marketplace-card-label {
		font-size: 0.62rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		line-height: 1.2;
	}

	.marketplace-open-icon {
		font-size: 14px !important;
		opacity: 0.75;
		transition:
			transform 0.2s ease,
			opacity 0.2s ease;
	}

	.marketplace-card-link:hover .marketplace-open-icon {
		opacity: 1;
		transform: translate(1px, -1px);
	}

	.marketplace-card-title {
		font-size: 0.88rem;
		font-weight: 700;
		line-height: 1.25;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.marketplace-card-footer {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 3px;
	}

	.marketplace-card-price {
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: -0.01em;
		padding: 2px 8px;
		border-radius: var(--radius-full, 9999px);
		line-height: 1.3;
		display: inline-block;
	}

	.marketplace-card-category {
		font-size: 0.68rem;
		font-weight: 600;
		opacity: 0.8;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* ── Variación para "Me" (Burbuja azul propia) ─────────── */
	.message-group.me .marketplace-card-link {
		background: rgba(0, 0, 0, 0.18);
		border: 1px solid rgba(255, 255, 255, 0.32);
		box-shadow:
			0 2px 8px rgba(0, 0, 0, 0.15),
			inset 0 1px 1px rgba(255, 255, 255, 0.35);
		color: #ffffff;
	}

	.message-group.me .marketplace-card-link:hover {
		background: rgba(0, 0, 0, 0.28);
		border-color: rgba(255, 255, 255, 0.6);
		transform: translateY(-2px) scale(1.01);
		box-shadow:
			0 6px 20px rgba(0, 0, 0, 0.25),
			inset 0 1px 2px rgba(255, 255, 255, 0.5);
	}

	.message-group.me .marketplace-media-box {
		border: 1px solid rgba(255, 255, 255, 0.35);
		background: rgba(0, 0, 0, 0.25);
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
	}

	.message-group.me .marketplace-placeholder {
		background: rgba(255, 255, 255, 0.18);
		color: #ffffff;
	}

	.message-group.me .marketplace-card-label {
		color: rgba(255, 255, 255, 0.88);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
	}

	.message-group.me .marketplace-open-icon {
		color: rgba(255, 255, 255, 0.9);
	}

	.message-group.me .marketplace-card-title {
		color: #ffffff;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
	}

	.message-group.me .marketplace-card-price {
		background: rgba(255, 255, 255, 0.26);
		color: #ffffff;
		border: 1px solid rgba(255, 255, 255, 0.45);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}

	.message-group.me .marketplace-card-category {
		color: rgba(255, 255, 255, 0.85);
	}

	/* ── Variación para "Peer" (Contacto) — Tema LIGHT ──────── */
	.message-group.peer .marketplace-card-link {
		background: rgba(27, 133, 243, 0.04);
		border: 1px solid rgba(27, 133, 243, 0.2);
		box-shadow:
			0 2px 8px rgba(27, 133, 243, 0.06),
			inset 0 1px 0 rgba(255, 255, 255, 0.8);
		color: #0f172a;
	}

	.message-group.peer .marketplace-card-link:hover {
		background: rgba(27, 133, 243, 0.08);
		border-color: var(--accent-blue-base, #1b85f3);
		transform: translateY(-2px) scale(1.01);
		box-shadow:
			0 6px 18px rgba(27, 133, 243, 0.15),
			0 0 10px rgba(27, 133, 243, 0.1);
	}

	.message-group.peer .marketplace-media-box {
		border: 1px solid rgba(15, 40, 80, 0.12);
		background: #f1f5f9;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
	}

	.message-group.peer .marketplace-placeholder {
		background: rgba(27, 133, 243, 0.08);
		color: var(--accent-blue-base, #1b85f3);
	}

	.message-group.peer .marketplace-card-label {
		color: var(--text-tertiary, #475569);
	}

	.message-group.peer .marketplace-open-icon {
		color: var(--accent-blue-base, #1b85f3);
	}

	.message-group.peer .marketplace-card-title {
		color: var(--text-primary, #0f172a);
	}

	.message-group.peer .marketplace-card-price {
		background: rgba(27, 133, 243, 0.12);
		color: #0369a1;
		border: 1px solid rgba(27, 133, 243, 0.28);
	}

	.message-group.peer .marketplace-card-category {
		color: var(--text-tertiary, #475569);
	}

	/* ── Variación para "Peer" (Contacto) — Tema DARK ───────── */
	:global([data-theme='dark']) .message-group.peer .marketplace-card-link {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.14);
		box-shadow:
			0 2px 8px rgba(0, 0, 0, 0.25),
			inset 0 1px 0 rgba(255, 255, 255, 0.15);
		color: #ffffff;
	}

	:global([data-theme='dark']) .message-group.peer .marketplace-card-link:hover {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(56, 189, 248, 0.55);
		transform: translateY(-2px) scale(1.01);
		box-shadow:
			0 6px 20px rgba(0, 0, 0, 0.35),
			0 0 14px rgba(56, 189, 248, 0.25);
	}

	:global([data-theme='dark']) .message-group.peer .marketplace-media-box {
		border: 1px solid rgba(255, 255, 255, 0.18);
		background: rgba(0, 0, 0, 0.35);
	}

	:global([data-theme='dark']) .message-group.peer .marketplace-placeholder {
		background: rgba(56, 189, 248, 0.12);
		color: #38bdf8;
	}

	:global([data-theme='dark']) .message-group.peer .marketplace-card-label {
		color: rgba(255, 255, 255, 0.65);
	}

	:global([data-theme='dark']) .message-group.peer .marketplace-open-icon {
		color: #38bdf8;
	}

	:global([data-theme='dark']) .message-group.peer .marketplace-card-title {
		color: #ffffff;
	}

	:global([data-theme='dark']) .message-group.peer .marketplace-card-price {
		background: rgba(56, 189, 248, 0.18);
		color: #38bdf8;
		border: 1px solid rgba(56, 189, 248, 0.4);
	}

	:global([data-theme='dark']) .message-group.peer .marketplace-card-category {
		color: rgba(255, 255, 255, 0.7);
	}

	/* ── Variación para "Peer" (Contacto) — Tema MIDNIGHT ───── */
	:global([data-theme='midnight']) .message-group.peer .marketplace-card-link {
		background: rgba(8, 18, 38, 0.75);
		border: 1px solid rgba(160, 210, 255, 0.22);
		box-shadow:
			0 2px 10px rgba(0, 0, 0, 0.4),
			inset 0 1px 0 rgba(160, 210, 255, 0.2);
		color: #ffffff;
	}

	:global([data-theme='midnight']) .message-group.peer .marketplace-card-link:hover {
		background: rgba(14, 30, 60, 0.9);
		border-color: #38bdf8;
		transform: translateY(-2px) scale(1.01);
		box-shadow:
			0 6px 22px rgba(0, 0, 0, 0.5),
			0 0 16px rgba(56, 189, 248, 0.35);
	}

	:global([data-theme='midnight']) .message-group.peer .marketplace-media-box {
		border: 1px solid rgba(160, 210, 255, 0.25);
		background: rgba(3, 8, 20, 0.7);
	}

	:global([data-theme='midnight']) .message-group.peer .marketplace-placeholder {
		background: rgba(56, 189, 248, 0.15);
		color: #60a5fa;
	}

	:global([data-theme='midnight']) .message-group.peer .marketplace-card-label {
		color: #93c5fd;
	}

	:global([data-theme='midnight']) .message-group.peer .marketplace-open-icon {
		color: #60a5fa;
	}

	:global([data-theme='midnight']) .message-group.peer .marketplace-card-title {
		color: #f0f9ff;
	}

	:global([data-theme='midnight']) .message-group.peer .marketplace-card-price {
		background: rgba(6, 182, 212, 0.22);
		color: #67e8f9;
		border: 1px solid rgba(6, 182, 212, 0.45);
	}

	:global([data-theme='midnight']) .message-group.peer .marketplace-card-category {
		color: #93c5fd;
	}
</style>
