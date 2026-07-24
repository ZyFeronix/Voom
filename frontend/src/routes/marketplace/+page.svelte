<script>
	import { fade, scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { onMount } from 'svelte';
	import { marketplace as marketplaceApi, posts as postsApi } from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { goto } from '$app/navigation';
	import CustomSelect from '$lib/components/CustomSelect.svelte';

	// ── Runes State ──────────────────────────────────────────────────────────
	let listings = $state([]);
	let dbCategories = $state([]);
	let activeCategory = $state('all');
	let searchQuery = $state('');
	let sortOption = $state('recent'); // 'recent', 'price_asc', 'price_desc'
	let loading = $state(true);

	// Sidebar filters (desktop)
	let maxPrice = $state(500);

	// Listing detail modal
	let selectedItem = $state(null);
	let offerAmount = $state('');
	let offerMessage = $state('');
	let offering = $state(false);
	let offerError = $state('');
	let offerSuccess = $state(false);

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
			dbCategories = res.categories || [];
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
			selectedItem = data.listing || item;
			offerAmount = selectedItem.price.toString();

			// Load mock reviews for visual premium feel
			localReviews = [
				{
					id: 1,
					username: 'sakura_art',
					display_name: 'Sakura VT',
					rating: 5,
					comment: 'Excelente modelo, muy limpio el rig y las texturas.'
				},
				{
					id: 2,
					username: 'neon_fan',
					display_name: 'Neon Fan',
					rating: 4,
					comment: 'Buen overlay, fácil de configurar en OBS. Recomiendo.'
				}
			];
		} catch (_err) {
			selectedItem = item;
			offerAmount = item.price.toString();
			localReviews = [];
		} finally {
			loading = false;
			offerSuccess = false;
			offerError = '';
		}
	}

	async function handleSendOffer(e) {
		e.preventDefault();
		if (!authStore.isAuthenticated) {
			goto('/login');
			return;
		}

		offering = true;
		offerError = '';
		offerSuccess = false;

		try {
			await marketplaceApi.offer(selectedItem.id, {
				amount: Number(offerAmount),
				message: offerMessage.trim()
			});
			offerSuccess = true;
			offerMessage = '';
		} catch (err) {
			offerError = err?.message ?? 'Error al enviar la oferta.';
		} finally {
			offering = false;
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
				image_url: newMediaUrl.trim() || null
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

	async function handlePostReview(e) {
		e.preventDefault();
		if (!authStore.isAuthenticated) return;

		submittingReview = true;
		try {
			await marketplaceApi.review(selectedItem.id, {
				rating: reviewRating,
				comment: reviewText.trim()
			});

			// Append locally
			localReviews = [
				{
					id: Date.now(),
					username: authStore.user?.username || 'yo',
					display_name: authStore.user?.display_name || 'Yo',
					rating: reviewRating,
					comment: reviewText.trim()
				},
				...localReviews
			];
			reviewText = '';
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
</script>

<svelte:head>
	<title>Marketplace — VSocial</title>
</svelte:head>

<div class="marketplace-container">
	<!-- Header Banner -->
	<div class="glass-card market-header">
		<div class="bubble-decoration"></div>
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
				class="aero-input"
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
						max="1000"
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
						<div class="glass-card market-item-card">
							<!-- Thumbnail -->
							<div class="item-thumbnail">
								{#if item.media_url || item.image_url}
									<img src={item.media_url || item.image_url} alt={item.title} class="item-img" />
								{:else}
									<div class="item-placeholder">
										<span class="material-icons-round">design_services</span>
									</div>
								{/if}
								<span class="price-tag">
									${item.price} USD
								</span>
							</div>

							<!-- Product Info -->
							<div class="item-details">
								<div>
									<div class="item-header-meta">
										<span class="aero-badge" style="font-size: 0.65rem;"
											>{item.category_name || 'General'}</span
										>
										<span class="rating-badge">
											<span class="material-icons-round">star</span>
											<span>{item.ratings_avg ? item.ratings_avg.toFixed(1) : '5.0'}</span>
										</span>
									</div>
									<h3 class="item-title">{item.title}</h3>
									<p class="item-desc">{item.description}</p>
								</div>

								<div class="item-footer">
									<span class="seller-tag"
										>Por <span style="color: var(--text-main); font-weight: 700;"
											>@{item.seller_username || item.username}</span
										></span
									>
									<button
										onclick={() => openItemDetails(item)}
										class="btn-aero-primary"
										style="padding: 6px 12px; font-size: 0.75rem;"
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
		class="modal-backdrop"
		onclick={(e) => {
			if (e.target === e.currentTarget) selectedItem = null;
		}}
		transition:fade={{ duration: 150 }}
	>
		<div
			class="glass-card detail-modal"
			transition:scale={{ duration: 250, start: 0.95, easing: backOut }}
		>
			<!-- Left: media/visual -->
			<div class="detail-media-pane">
				{#if selectedItem.media_url || selectedItem.image_url}
					<img src={selectedItem.media_url || selectedItem.image_url} alt={selectedItem.title} />
				{:else}
					<div class="detail-media-placeholder">
						<span class="material-icons-round">design_services</span>
					</div>
				{/if}
			</div>

			<!-- Right: details and offer/reviews -->
			<div class="detail-info-pane">
				<!-- Header -->
				<div class="detail-header">
					<div class="detail-title-row">
						<h3 class="detail-title">{selectedItem.title}</h3>
						<button onclick={() => (selectedItem = null)} class="close-btn">
							<span class="material-icons-round">close</span>
						</button>
					</div>
					<p class="detail-price">${selectedItem.price} USD</p>
					<p class="detail-desc-text">{selectedItem.description}</p>
				</div>

				<!-- Buy / Offer Form -->
				<div class="detail-section">
					<h4 class="section-subtitle-mini">Hacer oferta al vendedor</h4>

					{#if offerSuccess}
						<div class="alert-box success">
							¡Oferta enviada con éxito! El vendedor se contactará contigo por DM.
						</div>
					{:else}
						{#if offerError}
							<div class="alert-box error">
								<span class="material-icons-round">error_outline</span>
								<span>{offerError}</span>
							</div>
						{/if}

						<form onsubmit={handleSendOffer} class="offer-form">
							<div class="offer-input-row">
								<div class="price-input-wrapper">
									<span class="currency-symbol">$</span>
									<input
										id="offer-amount"
										name="offer-amount"
										type="number"
										required
										bind:value={offerAmount}
										class="aero-input"
									/>
								</div>
								<button
									type="submit"
									disabled={offering || !offerAmount}
									class="btn-aero-secondary"
									style="padding: 8px 16px;"
								>
									{#if offering}
										<span
											class="loading loading-spinner text-primary loading-xs"
											style="margin-right: 4px;"
										></span>
									{/if}
									Enviar
								</button>
							</div>
							<input
								id="offer-message"
								name="offer-message"
								type="text"
								placeholder="Mensaje opcional para el vendedor..."
								bind:value={offerMessage}
								class="aero-input"
								style="font-size: 0.75rem; padding-top: 6px; padding-bottom: 6px;"
							/>
						</form>
					{/if}
				</div>

				<!-- Reviews List (Simulated) -->
				<div
					class="detail-section"
					style="flex: 1; display: flex; flex-direction: column; min-height: 180px;"
				>
					<h4 class="section-subtitle-mini">Opiniones de clientes</h4>

					<div class="reviews-list-container">
						{#if localReviews.length === 0}
							<p class="empty-reviews-text">No hay calificaciones todavía.</p>
						{:else}
							{#each localReviews as rev}
								<div class="review-item">
									<div class="review-meta">
										<span class="review-author">@{rev.username}</span>
										<span class="review-rating">
											<span class="material-icons-round">star</span>
											<span>{rev.rating}</span>
										</span>
									</div>
									<p class="review-comment">{rev.comment}</p>
								</div>
							{/each}
						{/if}
					</div>

					{#if authStore.isAuthenticated}
						<form onsubmit={handlePostReview} class="review-form">
							<div class="review-input-row" style="align-items: center;">
								<div style="width: 80px;">
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
									placeholder="Escribe tu reseña..."
									bind:value={reviewText}
									class="aero-input"
									style="font-size: 0.75rem; padding-top: 6px; padding-bottom: 6px;"
								/>
								<button
									type="submit"
									disabled={submittingReview}
									class="btn-aero-primary btn-sm"
									style="padding: 6px 12px;"
								>
									Publicar
								</button>
							</div>
						</form>
					{/if}
				</div>

				<!-- Seller Profile Card -->
				<div class="seller-card">
					<div class="seller-avatar">
						<span
							>{(selectedItem.seller_username ||
								selectedItem.username ||
								'?')[0].toUpperCase()}</span
						>
					</div>
					<div>
						<p class="seller-name-title">
							Vendido por @{selectedItem.seller_username || selectedItem.username}
						</p>
						<p class="seller-status-text">Creador verificado</p>
					</div>
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
		border-radius: 20px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
	}

	.bubble-decoration {
		position: absolute;
		top: -48px;
		right: -48px;
		width: 180px;
		height: 180px;
		border-radius: 50%;
		background: rgba(240, 0, 255, 0.12);
		filter: blur(50px);
		pointer-events: none;
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
		padding: 8px 18px;
		border-radius: 20px;
		font-size: 0.8rem;
		font-weight: 600;
		white-space: nowrap;
		background: var(--glass-bg);
		color: var(--text-secondary);
		border: 1px solid var(--glass-border);
		cursor: pointer;
		transition: all var(--t-fast);
	}

	.chip:hover {
		background: var(--bg-overlay);
		color: var(--text-primary);
		transform: translateY(-1px);
	}

	.chip.active {
		background: var(--grad-primary);
		color: var(--text-on-accent);
		font-weight: 700;
		border-color: transparent;
		box-shadow: var(--shadow-sm);
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
		border-radius: 20px;
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
		border-radius: 2px;
		background: var(--border-subtle);
		outline: none;
	}

	.aero-range::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
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
		border-radius: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.skeleton-media {
		aspect-ratio: 16/9;
		background: rgba(0, 229, 255, 0.06);
		border-radius: 12px;
		animation: pulse 1.5s infinite ease-in-out;
	}

	.skeleton-line {
		height: 12px;
		background: rgba(0, 229, 255, 0.06);
		border-radius: 4px;
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
		border-radius: 20px;
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
		border-radius: 20px;
		overflow: hidden;
		transition: all 0.3s ease;
		height: 100%;
	}

	.market-item-card:hover {
		border-color: rgba(240, 0, 255, 0.3);
		box-shadow: 0 0 20px rgba(240, 0, 255, 0.2);
		transform: translateY(-3px);
	}

	.item-thumbnail {
		aspect-ratio: 16/9;
		width: 100%;
		background: rgba(0, 229, 255, 0.03);
		position: relative;
		overflow: hidden;
	}

	.item-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 0.5s;
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
		background: linear-gradient(135deg, rgba(0, 229, 255, 0.08) 0%, rgba(240, 0, 255, 0.08) 100%);
		color: var(--text-muted);
	}

	.price-tag {
		position: absolute;
		top: 12px;
		right: 12px;
		padding: 6px 12px;
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.75);
		font-weight: 700;
		font-size: 0.8rem;
		color: hsl(300, 85%, 65%);
		border: 1px solid rgba(240, 0, 255, 0.2);
		backdrop-filter: blur(4px);
		z-index: 10;
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
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 40;
		box-shadow: 0 4px 20px rgba(240, 0, 255, 0.4);
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 50;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(5px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
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
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
	}

	.close-btn:hover {
		color: var(--text-main);
	}

	.alert-box {
		padding: 8px 12px;
		border-radius: 10px;
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

	.alert-box.success {
		background: rgba(16, 185, 129, 0.15);
		border: 1px solid rgba(16, 185, 129, 0.25);
		color: #34d399;
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
		border-radius: 10px;
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
		border-radius: 50%;
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

	/* Detail modal styling */
	.detail-modal {
		max-width: 760px;
		width: 100%;
		display: flex;
		border-radius: 24px;
		border: 1px solid rgba(0, 119, 255, 0.12);
		overflow: hidden;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
		max-height: 90vh;
	}

	@media (max-width: 768px) {
		.detail-modal {
			flex-direction: column;
			overflow-y: auto;
		}
		.detail-media-pane {
			width: 100% !important;
			aspect-ratio: 16/9;
		}
		.detail-info-pane {
			width: 100% !important;
			max-height: none !important;
		}
	}

	.detail-media-pane {
		width: 50%;
		background: var(--bg-canvas);
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}

	.detail-media-pane img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.detail-media-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgba(0, 119, 255, 0.18);
		font-size: 3rem;
	}

	.detail-info-pane {
		width: 50%;
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 20px;
		background: rgba(11, 15, 25, 0.3);
		overflow-y: auto;
		max-height: 80vh;
	}

	.detail-header {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.detail-title-row {
		display: flex;
		justify-content: justify;
		justify-content: space-between;
		align-items: flex-start;
		gap: 8px;
	}

	.detail-title {
		font-size: 1.15rem;
		font-weight: 800;
		color: var(--text-main);
		margin: 0;
		line-height: 1.3;
	}

	.detail-price {
		font-size: 1.1rem;
		font-weight: 900;
		color: var(--aero-rose);
		margin: 0;
	}

	.detail-desc-text {
		font-size: 0.8rem;
		color: var(--text-muted);
		line-height: 1.45;
		margin: 6px 0 0 0;
	}

	.detail-section {
		border-top: 1px solid rgba(0, 119, 255, 0.1);
		padding-top: 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.section-subtitle-mini {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-main);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin: 0;
	}

	.offer-form {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.offer-input-row {
		display: flex;
		gap: 8px;
	}

	.price-input-wrapper {
		position: relative;
		flex: 1;
	}

	.currency-symbol {
		position: absolute;
		left: 12px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-muted);
		font-size: 0.85rem;
		font-weight: 700;
	}

	.price-input-wrapper input {
		padding-left: 24px;
		width: 100%;
		font-size: 0.85rem;
		padding-top: 8px;
		padding-bottom: 8px;
	}

	.reviews-list-container {
		flex: 1;
		overflow-y: auto;
		max-height: 150px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-right: 4px;
	}

	.empty-reviews-text {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin: 0;
	}

	.review-item {
		padding: 8px;
		border-radius: 10px;
		background: rgba(0, 229, 255, 0.03);
		border: 1px solid rgba(0, 119, 255, 0.06);
	}

	.review-meta {
		display: flex;
		justify-content: justify;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 4px;
	}

	.review-author {
		font-size: 0.7rem;
		font-weight: 700;
		color: rgba(0, 229, 255, 0.8);
	}

	.review-rating {
		display: flex;
		align-items: center;
		gap: 1px;
		font-size: 0.7rem;
		color: #fbbf24;
		font-weight: 700;
	}

	.review-rating .material-icons-round {
		font-size: 0.75rem;
	}

	.review-comment {
		font-size: 0.75rem;
		color: var(--text-main);
		margin: 0;
		line-height: 1.35;
	}

	.review-form {
		margin-top: 8px;
	}

	.review-input-row {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.seller-card {
		border-top: 1px solid rgba(0, 119, 255, 0.1);
		padding-top: 16px;
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.seller-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: linear-gradient(135deg, #f000ff 0%, #7000ff 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		font-weight: 700;
		font-size: 0.85rem;
	}

	.seller-name-title {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-main);
		margin: 0;
	}

	.seller-status-text {
		font-size: 0.65rem;
		color: var(--text-muted);
		margin: 2px 0 0 0;
	}
</style>
