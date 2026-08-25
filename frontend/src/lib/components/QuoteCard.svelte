<script>
	import { goto } from '$app/navigation';
	import { formatHashtags } from '$lib/utils/textFormatting.js';
	import { getProxiedMediaUrl } from '$lib/utils/mediaProxy.js';
	import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';

	/**
	 * Tarjeta de post citado (estilo X / Bluesky).
	 * Recibe el snapshot del post original: `{ id, body, username, display_name,
	 * avatar_url, is_verified, role, created_at, is_anonymous, media_url }`.
	 */
	let { quote } = $props();

	function formatTimestamp(dateStr) {
		if (!dateStr) return '';
		const d = new Date(dateStr);
		return d.toLocaleDateString('es-ES', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function openQuote(e) {
		e.stopPropagation();
		e.preventDefault();
		if (!quote?.id) return;
		goto(`/posts/${quote.id}`);
	}
</script>

{#if quote}
	<a
		class="quote-card"
		href={`/posts/${quote.id}`}
		onclick={openQuote}
		aria-label="Ver la publicación citada de @{quote.username || quote.display_name}"
	>
		<div class="quote-card-header">
			{#if quote.is_anonymous}
				<div class="quote-avatar anon-avatar">
					<span class="material-icons-round">visibility_off</span>
				</div>
			{:else if quote.avatar_url}
				<img class="quote-avatar" src={quote.avatar_url} alt="" loading="lazy" />
			{:else}
				<div class="quote-avatar letter-avatar">
					{(quote.display_name || quote.username || '?').charAt(0).toUpperCase()}
				</div>
			{/if}
			<span class="quote-name">{quote.display_name || quote.username}</span>
			{#if quote.is_verified == 1}
				<VerifiedBadge role={quote.role} isVerified={true} size="14px" />
			{/if}
			<span class="quote-handle">
				@{quote.username}
				{#if quote.created_at}
					<span class="quote-sep">·</span>
					<time datetime={quote.created_at}>{formatTimestamp(quote.created_at)}</time>
				{/if}
			</span>
		</div>

		{#if quote.body || quote.content}
			<p class="quote-text">{@html formatHashtags(quote.body || quote.content)}</p>
		{/if}

		{#if quote.media_url || quote.media?.[0]?.media_url}
			<div class="quote-media">
				<img
					src={getProxiedMediaUrl(quote.media_url || quote.media[0].media_url)}
					alt="Multimedia de @{quote.username}"
					loading="lazy"
					decoding="async"
				/>
			</div>
		{/if}
	</a>
{/if}

<style>
	.quote-card {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 10px 0 2px;
		text-decoration: none;
		color: inherit;
		padding: 12px 14px;
		border-radius: var(--radius-lg, 14px);
		border: 1px solid var(--glass-border, var(--border-subtle));
		background: var(--bg-surface-hover, rgba(255, 255, 255, 0.04));
		cursor: pointer;
		transition:
			border-color 0.18s ease,
			background-color 0.18s ease,
			box-shadow 0.18s ease;
		user-select: none;
		min-width: 0;
	}

	.quote-card:hover {
		border-color: rgba(var(--accent-blue-rgb, 46, 134, 232), 0.45);
		background: var(--bg-surface, rgba(255, 255, 255, 0.06));
		box-shadow: var(--shadow-sm), var(--shadow-glow);
	}

	:global([data-theme='light']) .quote-card {
		background: #f1f5f9;
		border-color: rgba(14, 165, 233, 0.25);
	}

	:global([data-theme='light']) .quote-card:hover {
		background: #e0f2fe;
		border-color: rgba(14, 165, 233, 0.5);
	}

	.quote-card-header {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		min-width: 0;
		font-size: 0.78rem;
	}

	.quote-avatar {
		flex: 0 0 26px;
		width: 26px;
		height: 26px;
		border-radius: var(--radius-squircle, 8px);
		overflow: hidden;
		object-fit: cover;
		background: var(--grad-primary, linear-gradient(135deg, #2e86e8, #1b85f3));
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
	}

	.quote-avatar .material-icons-round {
		font-size: 14px;
	}

	.letter-avatar {
		font-size: 0.78rem;
		font-weight: 800;
	}

	.quote-name {
		font-weight: 800;
		color: var(--text-primary, #e2e8f0);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.quote-handle {
		color: var(--text-muted, #94a3b8);
		font-weight: 500;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.quote-sep {
		margin: 0 3px;
	}

	.quote-text {
		margin: 0;
		font-size: 0.82rem;
		line-height: 1.4;
		color: var(--text-secondary, #cbd5e1);
		word-break: break-word;
		display: -webkit-box;
		-webkit-line-clamp: 6;
		-webkit-box-orient: vertical;
		overflow: hidden;
		user-select: text;
	}

	.quote-media {
		position: relative;
		border-radius: var(--radius-md, 10px);
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface-hover, rgba(255, 255, 255, 0.05));
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.quote-media img {
		width: 100%;
		height: auto;
		max-height: 340px;
		object-fit: contain;
		display: block;
	}
</style>
