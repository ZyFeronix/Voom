<script>
	import { fade, scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { onMount } from 'svelte';
	import { marketplace as marketplaceApi, posts as postsApi } from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { goto } from '$app/navigation';
	import CustomSelect from '$lib/components/CustomSelect.svelte';
	import LiquidBackground from '$lib/components/LiquidBackground.svelte';

	// ── Runes State ──────────────────────────────────────────────────────────
	let listings = $state([]);
	let dbCategories = $state([]);
	let activeCategory = $state('all');
	let searchQuery = $state('');
	let sortOption = $state('recent'); // 'recent', 'price_asc', 'price_desc'
	let loading = $state(true);

	// Sidebar filters (desktop) — 5000 por defecto para no ocultar listados reales
	let maxPrice = $state(5000);

	// Listing detail modal
	let selectedItem = $state(null);

	// Review state inside modal
	let reviewRating = $state(5);
	let reviewText = $state('');
	let submittingReview = $state(false);
	let localReviews = $state([]);

	// Create Listing FAB Modal
	let showCreateModal = $state(false);
	let newTitle = $state('');
	let newDescription = $state('');
	let newPrice = $state('');
	let newCategoryId = $state('1');
	let newMediaUrl = $state('');
	let creating = $state(false);
	let createError = $state('');

	// Image Upload inside Modal
	let createFileInput = $state(null);
	let uploadingCreateFile = $state(false);

	// ── Derived ──────────────────────────────────────────────────────────────
	let filteredListings = $derived(
		listings
			.filter((item) => {
				// Category filter
				if (activeCategory !== 'all' && item.category_id !== Number(activeCategory)) return false;
				// Price filter
				if (item.price > maxPrice) return false;
				// Search query filter
				if (
					searchQuery.trim() &&
					!item.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
					!item.description.toLowerCase().includes(searchQuery.toLowerCase())
				)
					return false;
				return true;
			})
			.sort((a, b) => {
				if (sortOption === 'price_asc') return a.price - b.price;
				if (sortOption === 'price_desc') return b.price - a.price;
				return new Date(b.created_at || 0) - new Date(a.created_at || 0); // default recent
			})
	);

	// ── Lifecycle ────────────────────────────────────────────────────────────
	onMount(async () => {
		await loadCategories();
		await loadMarketplaceListings();
	});

	// ── Functions ────────────────────────────────────────────────────────────
	async function loadCategories() {
		try {
			const res = await marketplaceApi.categories();
			dbCategories = res.categories || res || [];
		} catch (err) {
			console.error('Failed to load categories:', err);
			dbCategories = [
				{ id: 1, name: 'Arte Digital' },
				{ id: 2, name: 'Modelos Live2D' },
				{ id: 3, name: 'Rigging Live2D' },
				{ id: 4, name: 'Efectos Stream' },
				{ id: 5, name: 'Música & SFX' }
			];
		}
	}

	async function loadMarketplaceListings() {
		loading = true;
		try {
			const data = await marketplaceApi.list();
			listings = data.data || [];
		} catch (err) {
			console.error('Failed to load listings:', err);
			// Fallback mockup listings
			listings = [
				{
					id: 1,
					title: 'Modelo Live2D - Neko Maid',
					description:
						'Modelo completo listo para VTube Studio con 4 expresiones y física en cabello.',
					price: 120,
					seller_username: 'neko_rigs',
					seller_display_name: 'Neko Rigs',
					category_id: 2,
					category_name: 'Modelos Live2D',
					media_url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600',
					ratings_avg: 4.8,
					created_at: new Date().toISOString()
				},
				{
					id: 2,
					title: 'Pack de Overlays Cyberpunk',
					description:
						'Overlays animados para OBS con transiciones, alertas y escenas de inicio/fin.',
					price: 25,
					seller_username: 'cyber_draws',
					seller_display_name: 'Cyber Designs',
					category_id: 4,
					category_name: 'Efectos Stream',
					media_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600',
					ratings_avg: 4.5,
					created_at: new Date().toISOString()
				},
				{
					id: 3,
					title: 'Rigging Avanzado Custom',
					description: 'Servicio completo de rigging de busto o cuerpo entero. Plazo 2 semanas.',
					price: 350,
					seller_username: 'sora_chan',
					seller_display_name: 'Sora VTuber',
					category_id: 3,
					category_name: 'Rigging Live2D',
					media_url: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=600',
					ratings_avg: 5.0,
					created_at: new Date().toISOString()
				}
			];
		} finally {
			loading = false;
		}
	}

	async function openItemDetails(item) {
		loading = true;
		try {
			const data = await marketplaceApi.get(item.id);
			selectedItem = data.listing || data || item;
			loadReviews(selectedItem.id);
		} catch (_err) {
			selectedItem = item;
			localReviews = [];
		} finally {
			loading = false;
		}
	}

	async function handleCreateListing(e) {
		e.preventDefault();
		if (!authStore.isAuthenticated) {
			goto('/login');
			return;
		}

		creating = true;
		createError = '';
		try {
			const payload = {
				title: newTitle.trim(),
				description: newDescription.trim(),
				price: Number(newPrice),
				category_id: Number(newCategoryId),
				image_url: newMediaUrl.trim() || null,
				media_urls: newMediaUrl.trim() ? [newMediaUrl.trim()] : []
			};

			await marketplaceApi.create(payload);
			await loadMarketplaceListings();
			showCreateModal = false;

			// Clear inputs
			newTitle = '';
			newDescription = '';
			newPrice = '';
			newMediaUrl = '';
		} catch (err) {
			createError = err?.message ?? 'Error al crear la publicación.';
		} finally {
			creating = false;
		}
	}

	async function loadReviews(listingId) {
		try {
			const rev = await fetch(`/api/marketplace/${listingId}/reviews`);
			if (rev.ok) {
				const data = await rev.json();
				localReviews = data.reviews || [];
			} else {
				localReviews = [];
			}
		} catch (err) {
			console.error('Failed to load reviews:', err);
			localReviews = [];
		}
	}

	async function handlePostReview(e) {
		e.preventDefault();
		if (!authStore.isAuthenticated) return;

		submittingReview = true;
		try {
			await marketplaceApi.review(selectedItem.id, {
				rating: reviewRating,
				comment: reviewText.trim()
			});
			reviewText = '';
			await loadReviews(selectedItem.id);
		} catch (err) {
			console.error('Failed to post review:', err);
		} finally {
			submittingReview = false;
		}
	}

	function handleSelectCreateFile() {
		if (createFileInput) createFileInput.click();
	}

	async function handleCreateFileSelected(e) {
		const file = e.target.files[0];
		if (!file) return;

		uploadingCreateFile = true;
		try {
			const fd = new FormData();
			fd.append('media', file);
			const res = await postsApi.uploadMedia(fd);
			if (res.success && res.media && res.media.length > 0) {
				newMediaUrl = res.media[0].url;
			}
		} catch (err) {
			console.error(err);
			alert('Error al subir imagen');
		} finally {
			uploadingCreateFile = false;
		}
	}

	function portal(node) {
		const target = document.body;
		target.appendChild(node);
		return {
			destroy() {
				if (node.parentNode) {
					node.parentNode.removeChild(node);
				}
			}
		};
	}
</script>

<svelte:head>
	<title>Marketplace — Voom!</title>
</svelte:head>

<div class="marketplace-container">
	<!-- Header Banner -->
	<div class="aero-glass market-header">
		<div
			style="position: absolute; inset: 0; z-index: 0; border-radius: inherit; overflow: hidden; opacity: 0.85;"
		>
			<LiquidBackground />
		</div>
		<div class="glass-inset-highlight"></div>

		<div class="header-content">
			<h1 class="header-title">Marketplace Creativo</h1>
			<p class="header-subtitle">
				Encuentra modelos Live2D, servicios de rigging, música y overlays exclusivos.
			</p>
		</div>

		<!-- Quick Search bar -->
		<div class="search-bar-wrapper">
			<span class="material-icons-round">search</span>
			<input
				id="market-search"
				name="market-search"
				type="text"
				placeholder="Buscar en la tienda..."
				bind:value={searchQuery}
				class="aero-input glass-input"
			/>
		</div>
	</div>

	<!-- Category chips selector -->
	<div class="category-chips">
		<button
			onclick={() => (activeCategory = 'all')}
			class="chip"
			class:active={activeCategory === 'all'}
		>
			Todo
		</button>
		{#each dbCategories as cat}
			<button
				onclick={() => (activeCategory = cat.id)}
				class="chip"
				class:active={activeCategory === cat.id}
			>
				{cat.name}
			</button>
		{/each}
	</div>

	<!-- Content Grid with Filters -->
	<div class="market-layout">
		<!-- Sidebar Filters (desktop only) -->
		<div class="filter-sidebar">
			<div class="glass-card filter-card">
				<h3 class="filter-title">Filtros Avanzados</h3>

				<!-- Max Price -->
				<div class="filter-group">
					<div class="filter-label-row">
						<span>Precio máximo:</span>
						<span class="filter-value">${maxPrice} USD</span>
					</div>
					<input
						type="range"
						min="10"
						max="5000"
						step="10"
						bind:value={maxPrice}
						class="aero-range"
					/>
				</div>

				<!-- Sort Option -->
				<div class="filter-group">
					<span class="filter-label">Ordenar por</span>
					<CustomSelect
						bind:value={sortOption}
						options={[
							{ value: 'recent', label: 'Mas recientes' },
							{ value: 'price_asc', label: 'Menor precio' },
							{ value: 'price_desc', label: 'Mayor precio' }
						]}
					/>
				</div>
			</div>
		</div>

		<!-- Main listings Grid -->
		<div class="listings-section">
			{#if loading && listings.length === 0}
				<div class="listings-grid">
					{#each Array(3) as _}
						<div class="glass-card loading-skeleton">
							<div class="skeleton-media"></div>
							<div class="skeleton-line short"></div>
							<div class="skeleton-line long"></div>
						</div>
					{/each}
				</div>
			{:else if filteredListings.length === 0}
				<div class="glass-card empty-state">
					<span class="material-icons-round">shopping_bag</span>
					<h3>No hay productos en esta selección</h3>
					<p>Prueba a cambiar tus filtros de precio o a buscar otros términos.</p>
				</div>
			{:else}
				<div class="listings-grid">
					{#each filteredListings as item}
						<div class="aero-glass market-item-card">
							<!-- Thumbnail -->
							<div class="item-thumbnail">
								{#if item.thumbnail_url || item.media_url || item.image_url}
									<img
										src={item.thumbnail_url || item.media_url || item.image_url}
										alt={item.title}
										class="item-img"
										loading="lazy"
										decoding="async"
									/>
								{:else}
									<div class="item-placeholder">
										<span class="material-icons-round">design_services</span>
									</div>
								{/if}
								<span class="price-tag aero-glass">
									${item.price} <span class="usd">USD</span>
								</span>
							</div>

							<!-- Product Info -->
							<div class="item-details">
								<div>
									<div class="item-header-meta">
										<span class="aero-badge category-badge">
											{item.category_name || 'General'}
										</span>
										<span class="rating-badge">
											<span class="material-icons-round">star</span>
											<span>{item.ratings_avg ? item.ratings_avg.toFixed(1) : '5.0'}</span>
										</span>
									</div>
									<h3 class="item-title">{item.title}</h3>
									<p class="item-desc">{item.description}</p>
								</div>

								<div class="item-footer">
									<div class="seller-info">
										<div
											class="seller-mini-avatar"
											style="flex: 0 0 24px; min-width: 24px; min-height: 24px;"
										>
											{(item.seller_username || item.username || '?')[0].toUpperCase()}
										</div>
										<span class="seller-tag">
											@{item.seller_username || item.username}
										</span>
									</div>
									<button
										onclick={() => openItemDetails(item)}
										class="btn-aero-primary btn-sm details-btn"
									>
										Ver detalles
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Floating Action Button (FAB) for Creating Listings -->
{#if authStore.isAuthenticated}
	<button
		onclick={() => (showCreateModal = true)}
		class="fab-btn btn-aero-primary"
		aria-label="Publicar Listado"
	>
		<span class="material-icons-round" style="color: #000; font-size: 1.8rem;">add</span>
	</button>
{/if}

<!-- Create Listing Modal -->
{#if showCreateModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		use:portal
		class="modal-backdrop"
		onclick={(e) => {
			if (e.target === e.currentTarget) {
				showCreateModal = false;
				createError = '';
			}
		}}
		transition:fade={{ duration: 150 }}
	>
		<div
			class="glass-card aero-modal"
			style="max-width: 440px; width: 100%; padding: 24px;"
			transition:scale={{ duration: 250, start: 0.95, easing: backOut }}
		>
			<div class="modal-header">
				<h3 class="modal-title">Publicar producto digital</h3>
				<button
					onclick={() => {
						showCreateModal = false;
						createError = '';
					}}
					class="close-btn"
				>
					<span class="material-icons-round">close</span>
				</button>
			</div>

			{#if createError}
				<div class="alert-box error">
					<span class="material-icons-round">error_outline</span>
					<span>{createError}</span>
				</div>
			{/if}

			<form onsubmit={handleCreateListing} class="modal-form">
				<div class="form-group">
					<label for="newTitle" class="form-label">Título</label>
					<input
						id="newTitle"
						type="text"
						required
						placeholder="Ej: Modelo VTuber Maid"
						bind:value={newTitle}
						class="aero-input"
					/>
				</div>

				<div class="form-group">
					<label for="newDesc" class="form-label">Descripción</label>
					<textarea
						id="newDesc"
						rows="3"
						required
						placeholder="Especificaciones, formatos incluidos, licencias..."
						bind:value={newDescription}
						class="aero-textarea"
					></textarea>
				</div>

				<div class="form-row">
					<div class="form-group">
						<label for="newPrice" class="form-label">Precio (USD)</label>
						<input
							id="newPrice"
							type="number"
							required
							placeholder="100"
							bind:value={newPrice}
							class="aero-input"
						/>
					</div>
					<div class="form-group">
						<span class="form-label">Categoria</span>
						<CustomSelect
							bind:value={newCategoryId}
							options={dbCategories.map((cat) => ({ value: cat.id.toString(), label: cat.name }))}
						/>
					</div>
				</div>

				<div class="form-group">
					<span class="form-label">Imagen de portada</span>
					<input
						id="marketplace_cover_input"
						name="marketplace_cover_input"
						type="file"
						accept="image/*"
						bind:this={createFileInput}
						onchange={handleCreateFileSelected}
						style="display: none;"
					/>
					<div class="file-uploader-row">
						<button
							type="button"
							class="btn-aero-secondary btn-sm"
							onclick={handleSelectCreateFile}
						>
							<span class="material-icons-round">image</span>
							{newMediaUrl ? 'Cambiar Imagen' : 'Subir Imagen'}
						</button>
						{#if uploadingCreateFile}
							<span class="loading loading-spinner text-primary loading-xs"></span>
						{/if}
					</div>
					{#if newMediaUrl}
						<div class="preview-box">
							<img src={newMediaUrl} alt="Preview" class="preview-img" />
							<button type="button" class="remove-preview-btn" onclick={() => (newMediaUrl = '')}>
								<span class="material-icons-round">close</span>
							</button>
						</div>
					{/if}
				</div>

				<button type="submit" disabled={creating} class="btn-aero-primary submit-btn">
					{#if creating}
						<span class="loading loading-spinner text-primary loading-xs" style="margin-right: 8px;"
						></span>
					{/if}
					Publicar listado
				</button>
			</form>
		</div>
	</div>
{/if}

<!-- Product Detail Modal Overlay -->
{#if selectedItem}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		use:portal
		class="modal-backdrop"
		onclick={(e) => {
			if (e.target === e.currentTarget) selectedItem = null;
		}}
		transition:fade={{ duration: 180 }}
	>
		<div
			class="glass-panel detail-modal"
			transition:scale={{ duration: 300, start: 0.94, easing: backOut }}
		>
			<!-- Left: Product Showcase Gallery -->
			<div class="detail-media-pane">
				<div class="detail-img-frame">
					{#if selectedItem.media_url || selectedItem.image_url}
						<img
							src={selectedItem.media_url || selectedItem.image_url}
							alt={selectedItem.title}
							class="showcase-img"
						/>
					{:else}
						<div class="detail-media-placeholder">
							<span class="material-icons-round">design_services</span>
						</div>
					{/if}
				</div>

				<div class="media-footer-meta">
					<span class="aero-badge category-badge">
						<span class="material-icons-round" style="font-size: 0.85rem; margin-right: 4px;"
							>category</span
						>
						{selectedItem.category_name || 'General'}
					</span>
					<span class="asset-id-badge">#{selectedItem.id.toString().padStart(4, '0')}</span>
				</div>
			</div>

			<!-- Right: Product Details, Seller & Interaction -->
			<div class="detail-info-pane">
				<!-- Header Row: Price & Close Button -->
				<div class="detail-top-row">
					<div class="price-showcase">
						<span class="price-currency">$</span>
						<span class="price-number">{selectedItem.price}</span>
						<span class="price-unit">USD</span>
					</div>

					<button
						type="button"
						onclick={() => (selectedItem = null)}
						class="close-btn modal-close-btn"
						aria-label="Cerrar ventana"
					>
						<span class="material-icons-round">close</span>
					</button>
				</div>

				<!-- Product Title -->
				<h2 class="detail-title">{selectedItem.title}</h2>

				<!-- Seller Showcase Card -->
				<div class="seller-showcase-card">
					<div class="seller-left-meta">
						<div
							class="seller-avatar-shield"
							style="flex: 0 0 40px; min-width: 40px; min-height: 40px;"
						>
							<span
								>{(selectedItem.seller_username ||
									selectedItem.username ||
									'?')[0].toUpperCase()}</span
							>
						</div>
						<div class="seller-text-info">
							<span class="seller-display-name">
								{selectedItem.seller_display_name ||
									selectedItem.seller_username ||
									selectedItem.username}
							</span>
							<span class="seller-handle"
								>@{selectedItem.seller_username || selectedItem.username}</span
							>
						</div>
					</div>
					<div class="seller-verified-tag">
						<span class="material-icons-round">verified</span>
						<span>Vendedor</span>
					</div>
				</div>

				<!-- Description Box -->
				<div class="detail-desc-box">
					<p class="detail-desc-text">{selectedItem.description}</p>
				</div>

				<!-- P2P Guarantee & Action Buttons -->
				<div class="detail-action-container">
					<div class="p2p-trust-pill">
						<span class="material-icons-round trust-icon">security</span>
						<span>Economía P2P directa · Cero comisiones · Pago 100% al creador</span>
					</div>

					<div
						class="action-btn-wrapper"
						class:has-two-buttons={Boolean(selectedItem.payment_link)}
					>
						{#if selectedItem.payment_link}
							<a
								href={selectedItem.payment_link}
								target="_blank"
								rel="noopener noreferrer nofollow"
								class="btn-aero-primary buy-action-btn"
							>
								<span class="material-icons-round">payments</span>
								<span>Pagar / Comprar</span>
							</a>
						{/if}
						<a
							href={`/messages?peer=${encodeURIComponent(selectedItem.seller_username || selectedItem.username)}&product=${selectedItem.id}`}
							class={selectedItem.payment_link
								? 'btn-aero-secondary contact-action-btn'
								: 'btn-aero-primary contact-action-btn full-width'}
						>
							<span class="material-icons-round">chat</span>
							<span>Mensaje al Vendedor</span>
						</a>
					</div>
				</div>

				<!-- Reviews / Ratings Section -->
				<div class="detail-reviews-wrapper">
					<div class="reviews-header-row">
						<h4 class="reviews-section-title">
							<span class="material-icons-round" style="font-size: 1rem; color: var(--aero-amber);"
								>star</span
							>
							Opiniones de la Comunidad
						</h4>
						{#if localReviews.length > 0}
							<span class="reviews-count-badge">
								{localReviews.length}
								{localReviews.length === 1 ? 'reseña' : 'reseñas'}
							</span>
						{/if}
					</div>

					<div class="reviews-scroll-list">
						{#if localReviews.length === 0}
							<div class="empty-reviews-card">
								<span class="material-icons-round">rate_review</span>
								<p>Aún no hay calificaciones para este producto.</p>
							</div>
						{:else}
							{#each localReviews as rev}
								<div class="review-bubble">
									<div class="review-bubble-header">
										<span class="review-author-name">@{rev.username}</span>
										<div class="review-stars-row">
											{#each Array(Number(rev.rating || 5)) as _}
												<span class="material-icons-round star-filled">star</span>
											{/each}
										</div>
									</div>
									<p class="review-bubble-comment">{rev.comment}</p>
								</div>
							{/each}
						{/if}
					</div>

					{#if authStore.isAuthenticated}
						<form onsubmit={handlePostReview} class="review-composer-form">
							<div class="review-composer-row">
								<div class="review-rating-select">
									<CustomSelect
										bind:value={reviewRating}
										options={[
											{ value: 5, label: '5 ⭐' },
											{ value: 4, label: '4 ⭐' },
											{ value: 3, label: '3 ⭐' },
											{ value: 2, label: '2 ⭐' },
											{ value: 1, label: '1 ⭐' }
										]}
									/>
								</div>
								<input
									type="text"
									required
									placeholder="Escribe una opinión sobre el creador..."
									bind:value={reviewText}
									class="aero-input glass-input review-input-field"
								/>
								<button
									type="submit"
									disabled={submittingReview}
									class="btn-aero-primary review-submit-btn"
									title="Publicar reseña"
								>
									<span class="material-icons-round">send</span>
								</button>
							</div>
						</form>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.marketplace-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 24px 16px;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.market-header {
		position: relative;
		overflow: hidden;
		padding: 32px 24px;
		border-radius: var(--radius-lg);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		box-shadow:
			var(--shadow-lg),
			inset 0 1px 2px rgba(255, 255, 255, 0.2);
	}

	.header-content {
		position: relative;
		z-index: 10;
	}

	.header-title {
		font-size: 2rem;
		font-weight: 900;
		color: var(--text-main);
		margin: 0;
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
	}

	.header-subtitle {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin: 6px 0 0 0;
	}

	.search-bar-wrapper {
		position: relative;
		width: 300px;
		z-index: 10;
	}

	.search-bar-wrapper .material-icons-round {
		position: absolute;
		left: 12px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-muted);
		font-size: 1.1rem;
	}

	.search-bar-wrapper input {
		padding-left: 38px;
		width: 100%;
	}

	.category-chips {
		display: flex;
		gap: 10px;
		overflow-x: auto;
		padding-bottom: 4px;
		scrollbar-width: none;
	}

	.category-chips::-webkit-scrollbar {
		display: none;
	}

	.chip {
		padding: 8px 20px;
		border-radius: var(--radius-full);
		font-size: 0.8rem;
		font-weight: 600;
		white-space: nowrap;
		background: var(--glass-bg);
		color: var(--text-secondary);
		border: 1px solid var(--glass-border);
		cursor: pointer;
		transition:
			transform var(--t-spring),
			background var(--t-fast),
			box-shadow var(--t-fast);
		backdrop-filter: var(--glass-blur);
	}

	.chip:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-primary);
		transform: translateY(-2px);
	}

	.chip.active {
		background: var(--accent-blue-base);
		color: #fff;
		font-weight: 700;
		border-color: rgba(255, 255, 255, 0.3);
		box-shadow:
			var(--shadow-glow),
			0 4px 12px rgba(27, 133, 243, 0.4);
		transform: translateY(-2px);
	}

	.market-layout {
		display: grid;
		grid-template-columns: 280px 1fr;
		gap: 24px;
		align-items: start;
	}

	@media (max-width: 992px) {
		.market-layout {
			grid-template-columns: 1fr;
		}
		.filter-sidebar {
			display: none;
		}
	}

	.filter-card {
		padding: 20px;
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.filter-title {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--text-main);
		text-transform: uppercase;
		letter-spacing: 1px;
		margin: 0;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.filter-label-row {
		display: flex;
		justify-content: justify;
		justify-content: space-between;
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.filter-value {
		color: var(--aero-rose);
		font-weight: 700;
	}

	.aero-range {
		-webkit-appearance: none;
		width: 100%;
		height: 4px;
		border-radius: var(--radius-xs);
		background: var(--border-subtle);
		outline: none;
	}

	.aero-range::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 14px;
		height: 14px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: var(--aero-rose);
		cursor: pointer;
		box-shadow: 0 0 8px rgba(232, 74, 114, 0.4);
		transition: transform var(--t-fast);
	}

	.aero-range::-webkit-slider-thumb:hover {
		transform: scale(1.25);
	}

	.filter-label {
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.listings-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 20px;
	}

	.loading-skeleton {
		padding: 16px;
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.skeleton-media {
		aspect-ratio: 16/9;
		background: rgba(0, 229, 255, 0.06);
		border-radius: var(--radius-sm);
		animation: pulse 1.5s infinite ease-in-out;
	}

	.skeleton-line {
		height: 12px;
		background: rgba(0, 229, 255, 0.06);
		border-radius: var(--radius-xs);
		animation: pulse 1.5s infinite ease-in-out;
	}

	.skeleton-line.short {
		width: 50%;
	}

	.skeleton-line.long {
		width: 80%;
	}

	@keyframes pulse {
		0% {
			opacity: 0.6;
		}
		50% {
			opacity: 0.3;
		}
		100% {
			opacity: 0.6;
		}
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 64px 24px;
		text-align: center;
		border-radius: var(--radius-md);
	}

	.empty-state .material-icons-round {
		font-size: 4rem;
		color: rgba(0, 119, 255, 0.12);
		margin-bottom: 16px;
	}

	.empty-state h3 {
		font-size: 1.2rem;
		color: var(--text-main);
		margin: 0 0 8px 0;
	}

	.empty-state p {
		font-size: 0.8rem;
		color: var(--text-muted);
		max-width: 360px;
		margin: 0;
	}

	.market-item-card {
		display: flex;
		flex-direction: column;
		border-radius: var(--radius-md);
		overflow: hidden;
		transition:
			transform var(--t-spring),
			box-shadow var(--t-fast);
		height: 100%;
		background: var(--glass-bg);
		border: 1px solid var(--glass-border);
		backdrop-filter: var(--glass-blur);
		will-change: transform;
	}

	.market-item-card:hover {
		border-color: var(--accent-blue-light);
		box-shadow:
			var(--shadow-glow),
			0 8px 30px rgba(27, 133, 243, 0.25);
		transform: translateY(-6px) scale(1.01);
	}

	.item-thumbnail {
		aspect-ratio: 16/9;
		width: 100%;
		background: rgba(0, 229, 255, 0.03);
		position: relative;
		overflow: hidden;
		border-bottom: 1px solid var(--glass-border);
		contain: strict;
	}

	.item-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 0.6s var(--ease-spring);
	}

	.market-item-card:hover .item-img {
		transform: scale(1.05);
	}

	.item-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, rgba(0, 229, 255, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%);
		color: var(--text-muted);
	}

	.price-tag {
		position: absolute;
		top: 12px;
		right: 12px;
		padding: 6px 12px;
		border-radius: var(--radius-sm);
		background: rgba(0, 0, 0, 0.6);
		font-weight: 900;
		font-size: 0.85rem;
		color: var(--text-on-accent);
		border: 1px solid rgba(255, 255, 255, 0.2);
		backdrop-filter: blur(8px) saturate(1.2);
		z-index: 10;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	}
	.price-tag .usd {
		font-size: 0.65rem;
		opacity: 0.8;
		font-weight: 700;
	}

	.item-details {
		padding: 16px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		flex: 1;
		gap: 16px;
	}

	.item-header-meta {
		display: flex;
		justify-content: justify;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 6px;
	}

	.rating-badge {
		display: flex;
		align-items: center;
		gap: 2px;
		font-size: 0.75rem;
		color: #fbbf24;
		font-weight: 700;
	}

	.rating-badge .material-icons-round {
		font-size: 0.85rem;
	}

	.item-title {
		font-weight: 700;
		color: var(--text-main);
		font-size: 0.95rem;
		margin: 0;
		display: -webkit-box;
		-webkit-line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.item-desc {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin: 4px 0 0 0;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		line-height: 1.4;
	}

	.item-footer {
		display: flex;
		align-items: center;
		justify-content: justify;
		justify-content: space-between;
		border-top: 1px solid rgba(0, 119, 255, 0.1);
		padding-top: 12px;
	}

	.seller-tag {
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	.fab-btn {
		position: fixed;
		bottom: 24px;
		right: 24px;
		width: 56px;
		height: 56px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 40;
		box-shadow: 0 4px 20px rgba(46, 180, 255, 0.4);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.modal-title {
		font-size: 1rem;
		font-weight: 700;
		color: var(--text-main);
		margin: 0;
	}

	.close-btn {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-full);
		color: var(--text-muted);
		cursor: pointer;
		padding: 6px;
		display: flex;
		align-items: center;
		transition: all var(--t-fast);
	}

	.close-btn:hover {
		background: rgba(255, 255, 255, 0.15);
		color: var(--text-main);
		transform: scale(1.1);
	}

	.alert-box {
		padding: 8px 12px;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.alert-box.error {
		background: rgba(239, 68, 68, 0.15);
		border: 1px solid rgba(239, 68, 68, 0.25);
		color: #f87171;
	}

	.modal-form {
		display: flex;
		flex-direction: column;
		gap: 16px;
		margin-top: 16px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.form-label {
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	.file-uploader-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.preview-box {
		position: relative;
		width: 80px;
		height: 80px;
		border-radius: var(--radius-sm);
		overflow: hidden;
		margin-top: 8px;
		border: 1px solid rgba(0, 119, 255, 0.15);
	}

	.preview-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.remove-preview-btn {
		position: absolute;
		top: 4px;
		right: 4px;
		background: rgba(0, 0, 0, 0.7);
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
	}

	.remove-preview-btn .material-icons-round {
		font-size: 0.7rem;
		color: var(--text-main);
	}

	.submit-btn {
		margin-top: 12px;
		width: 100%;
		padding: 10px;
	}

	/* ══════════════════════════════════════════════════════════════════════
	   💎 DETAIL MODAL (Compact, Proportional & Centered across all screens)
	   ══════════════════════════════════════════════════════════════════════ */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal-backdrop, 1000);
		background: rgba(4, 12, 24, 0.82);
		backdrop-filter: blur(16px) saturate(1.3);
		-webkit-backdrop-filter: blur(16px) saturate(1.3);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		overflow-y: auto;
		box-sizing: border-box;
	}

	.detail-modal {
		position: relative;
		z-index: var(--z-modal-content, 1010);
		max-width: 760px;
		width: 100%;
		max-height: min(520px, 86vh);
		display: flex;
		flex-direction: row;
		align-items: stretch;
		border-radius: var(--radius-xl, 24px);
		background: var(--bg-surface, #0d1527);
		border: 1px solid var(--glass-border-t, rgba(255, 255, 255, 0.22));
		box-shadow:
			0 24px 70px rgba(0, 0, 0, 0.65),
			0 0 50px rgba(var(--accent-blue-rgb), 0.22),
			inset 0 1px 2px rgba(255, 255, 255, 0.25);
		overflow: hidden;
		margin: auto;
		flex-shrink: 0;
	}

	/* Ambient Background Glow */
	.detail-modal::before {
		content: '';
		position: absolute;
		top: -30%;
		right: -20%;
		width: 420px;
		height: 420px;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			rgba(var(--accent-blue-rgb), 0.2) 0%,
			rgba(0, 212, 170, 0.05) 45%,
			transparent 70%
		);
		pointer-events: none;
		z-index: 0;
	}

	/* ── Left Column: Media Showcase ──────────────── */
	.detail-media-pane {
		flex: 0 0 280px;
		width: 280px;
		min-width: 280px;
		max-width: 280px;
		background: linear-gradient(
			180deg,
			rgba(var(--accent-blue-rgb), 0.08) 0%,
			rgba(0, 0, 0, 0.25) 100%
		);
		padding: 20px 18px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		border-right: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
		position: relative;
		z-index: 1;
		box-sizing: border-box;
	}

	.detail-img-frame {
		position: relative;
		width: 100%;
		aspect-ratio: 1 / 1;
		border-radius: var(--radius-lg, 18px);
		overflow: hidden;
		background: rgba(0, 0, 0, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.12);
		box-shadow:
			0 12px 28px rgba(0, 0, 0, 0.45),
			inset 0 1px 2px rgba(255, 255, 255, 0.18);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.showcase-img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		transition: transform 0.4s var(--ease-spring);
	}

	.showcase-img:hover {
		transform: scale(1.04);
	}

	.detail-media-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgba(var(--accent-blue-rgb), 0.3);
		font-size: 3.5rem;
	}

	.media-footer-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0 2px;
	}

	.asset-id-badge {
		font-family: var(--font-mono, monospace);
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--text-muted);
		background: rgba(255, 255, 255, 0.05);
		padding: 2px 6px;
		border-radius: var(--radius-xs);
		border: 1px solid var(--glass-border);
	}

	/* ── Right Column: Details & Interactions ──────── */
	.detail-info-pane {
		flex: 1 1 auto;
		min-width: 0;
		padding: 20px 22px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		background: transparent;
		overflow-y: auto;
		max-height: min(520px, 86vh);
		position: relative;
		z-index: 1;
		box-sizing: border-box;
		scrollbar-width: thin;
		scrollbar-color: var(--scrollbar-thumb) transparent;
	}

	.detail-top-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
	}

	.price-showcase {
		display: flex;
		align-items: baseline;
		gap: 2px;
		font-family: var(--font-display);
	}

	.price-currency {
		font-size: 1.1rem;
		font-weight: 800;
		color: var(--accent-blue-light);
	}

	.price-number {
		font-size: 1.55rem;
		font-weight: 900;
		letter-spacing: -0.02em;
		background: linear-gradient(135deg, #ffffff 0%, var(--accent-blue-light) 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		filter: drop-shadow(0 2px 8px rgba(var(--accent-blue-rgb), 0.4));
	}

	.price-unit {
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--text-muted);
		margin-left: 3px;
		letter-spacing: 0.05em;
	}

	.modal-close-btn {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid var(--glass-border);
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all var(--t-fast);
		backdrop-filter: blur(8px);
		flex-shrink: 0;
	}

	.modal-close-btn:hover {
		background: rgba(239, 68, 68, 0.18);
		border-color: rgba(239, 68, 68, 0.4);
		color: #ef4444;
		transform: rotate(90deg) scale(1.08);
	}

	.detail-title {
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 900;
		color: var(--text-main);
		margin: 0;
		line-height: 1.2;
		letter-spacing: -0.01em;
	}

	/* ── Seller Card ──────────────────────────────── */
	.seller-showcase-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 7px 12px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.05);
	}

	.seller-left-meta {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.seller-avatar-shield {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: linear-gradient(135deg, var(--accent-blue-base) 0%, var(--aero-mint) 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 800;
		color: #ffffff;
		font-size: 0.85rem;
		box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25);
		flex-shrink: 0;
	}

	.seller-text-info {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.seller-display-name {
		font-size: 0.82rem;
		font-weight: 800;
		color: var(--text-main);
		line-height: 1.2;
	}

	.seller-handle {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--accent-blue-light);
		line-height: 1.2;
	}

	.seller-verified-tag {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: 0.68rem;
		font-weight: 800;
		color: var(--aero-mint);
		background: rgba(0, 212, 170, 0.12);
		border: 1px solid rgba(0, 212, 170, 0.25);
		padding: 3px 8px;
		border-radius: var(--radius-full);
	}

	.seller-verified-tag .material-icons-round {
		font-size: 0.82rem;
	}

	/* ── Description Box ──────────────────────────── */
	.detail-desc-box {
		background: rgba(255, 255, 255, 0.025);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		padding: 10px 12px;
		max-height: 65px;
		overflow-y: auto;
		scrollbar-width: thin;
	}

	.detail-desc-text {
		font-size: 0.82rem;
		color: var(--text-secondary);
		line-height: 1.45;
		margin: 0;
	}

	/* ── Actions Container ────────────────────────── */
	.detail-action-container {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.p2p-trust-pill {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--text-muted);
		background: rgba(var(--accent-blue-rgb), 0.06);
		padding: 6px 10px;
		border-radius: var(--radius-sm);
		border: 1px solid rgba(var(--accent-blue-rgb), 0.12);
	}

	.trust-icon {
		font-size: 0.9rem;
		color: var(--accent-blue-light);
	}

	.action-btn-wrapper {
		display: flex;
		width: 100%;
		gap: 10px;
	}

	.action-btn-wrapper.has-two-buttons {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}

	.action-btn-wrapper a {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		text-decoration: none;
		padding: 10px 14px;
		font-size: 0.85rem;
		font-weight: 800;
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-sm);
		transition:
			transform var(--t-spring),
			box-shadow var(--t-fast);
	}

	.action-btn-wrapper a.full-width {
		width: 100%;
	}

	.action-btn-wrapper a:hover {
		transform: translateY(-2px);
	}

	/* ── Reviews / Ratings ────────────────────────── */
	.detail-reviews-wrapper {
		border-top: 1px solid var(--glass-border);
		padding-top: 10px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.reviews-header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.reviews-section-title {
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-main);
		margin: 0;
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.reviews-count-badge {
		font-size: 0.68rem;
		font-weight: 700;
		color: var(--accent-blue-light);
		background: rgba(var(--accent-blue-rgb), 0.1);
		padding: 2px 6px;
		border-radius: var(--radius-full);
	}

	.reviews-scroll-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-height: 80px;
		overflow-y: auto;
		padding-right: 4px;
		scrollbar-width: thin;
	}

	.empty-reviews-card {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 10px;
		border-radius: var(--radius-sm);
		background: rgba(255, 255, 255, 0.02);
		border: 1px dashed var(--glass-border);
		color: var(--text-muted);
		font-size: 0.75rem;
	}

	.empty-reviews-card .material-icons-round {
		font-size: 1.1rem;
		opacity: 0.6;
	}

	.review-bubble {
		padding: 8px 12px;
		border-radius: var(--radius-md);
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid var(--glass-border);
	}

	.review-bubble-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 2px;
	}

	.review-author-name {
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--accent-blue-light);
	}

	.review-stars-row {
		display: flex;
		align-items: center;
		gap: 1px;
	}

	.star-filled {
		font-size: 0.78rem;
		color: #f59e0b;
	}

	.review-bubble-comment {
		font-size: 0.75rem;
		color: var(--text-main);
		line-height: 1.35;
		margin: 0;
	}

	/* Review Composer Form */
	.review-composer-form {
		margin-top: 2px;
	}

	.review-composer-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.review-rating-select {
		width: 76px;
		flex-shrink: 0;
	}

	.review-input-field {
		flex: 1;
		font-size: 0.75rem !important;
		padding: 6px 10px !important;
	}

	.review-submit-btn {
		width: 32px;
		height: 32px;
		padding: 0 !important;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		flex-shrink: 0;
	}

	.review-submit-btn .material-icons-round {
		font-size: 0.95rem;
	}

	/* ── Responsive Adaptations ───────────────────── */
	@media (max-width: 768px) {
		.detail-modal {
			flex-direction: column;
			max-height: 90vh;
			max-width: 440px;
			overflow-y: auto;
		}

		.detail-media-pane {
			flex: 0 0 auto;
			width: 100%;
			min-width: 100%;
			max-width: 100%;
			border-right: none;
			border-bottom: 1px solid var(--glass-border);
			padding: 16px;
		}

		.detail-img-frame {
			max-width: 220px;
			margin: 0 auto;
		}

		.detail-info-pane {
			padding: 16px;
			max-height: none;
		}
	}
</style>
