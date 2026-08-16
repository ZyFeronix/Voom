<script>
	import { onMount } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { admin as adminApi } from '$lib/api.js';

	let loading = $state(true);
	let verifications = $state([]);
	let stats = $state({ pending: 0, reviewing: 0, approved: 0, rejected: 0, total: 0 });
	let statusFilter = $state('pending'); // 'pending' | 'reviewing' | 'approved' | 'rejected' | 'all'
	let categoryFilter = $state('all');
	let searchQuery = $state('');

	let selectedReq = $state(null);
	let adminNotes = $state('');
	let processingAction = $state(false);
	let feedbackMsg = $state('');
	let feedbackError = $state(false);

	// Checklist for auditor
	let checkHumanAuth = $state(false);
	let checkMinPieces = $state(false);
	let checkCrossLink = $state(false);

	const categoryMap = {
		creator: {
			label: 'Arte & Diseño',
			color: 'var(--aero-mint)',
			icon: 'palette',
			badgeRole: 'verified'
		},
		streamer: {
			label: 'VTuber / Streamer',
			color: 'var(--aero-coral)',
			icon: 'videocam',
			badgeRole: 'verified'
		},
		organization: {
			label: 'Estudio / Agencia',
			color: 'var(--aero-sky)',
			icon: 'business',
			badgeRole: 'verified'
		},
		government: {
			label: 'Gobierno / Estatal',
			color: '#a855f7',
			icon: 'account_balance',
			badgeRole: 'verified'
		},
		public: {
			label: 'Notoriedad Pública',
			color: 'var(--aero-amber)',
			icon: 'public',
			badgeRole: 'verified'
		}
	};

	const rejectPresets = [
		'Portafolio insuficiente o sin piezas originales verificables.',
		'No se pudo comprobar la autoría humana de las obras.',
		'Canal de streaming inactivo o sin transmisiones recientes.',
		'Inconsistencia en la titularidad o sospecha de suplantación.',
		'Falta de mención cruzada hacia la cuenta de V-SOCIAL.'
	];

	onMount(async () => {
		await loadVerifications();
	});

	async function loadVerifications() {
		loading = true;
		try {
			const params = {};
			if (statusFilter !== 'all') params.status = statusFilter;
			if (categoryFilter !== 'all') params.category = categoryFilter;
			if (searchQuery.trim()) params.q = searchQuery.trim();

			const res = await adminApi.verifications.list(params);
			verifications = res.verifications || [];
			if (res.stats) {
				stats = res.stats;
			}
		} catch (e) {
			console.error(e);
			showNotification('Error al consultar las solicitudes de verificación', true);
		} finally {
			loading = false;
		}
	}

	function showNotification(msg, isError = false) {
		feedbackMsg = msg;
		feedbackError = isError;
		setTimeout(() => {
			feedbackMsg = '';
		}, 4500);
	}

	function openModal(req) {
		selectedReq = req;
		adminNotes = req.admin_notes || '';
		checkHumanAuth = req.status === 'approved';
		checkMinPieces = req.status === 'approved';
		checkCrossLink = req.status === 'approved';
	}

	function closeModal() {
		selectedReq = null;
		adminNotes = '';
	}

	function setRejectPreset(preset) {
		adminNotes = preset;
	}

	async function handleReview(resolution) {
		if (!selectedReq) return;
		processingAction = true;
		const reqId = selectedReq.id;
		const prevStatus = selectedReq.status;
		const prevStats = { ...stats };

		// Optimistic local update
		const idx = verifications.findIndex((v) => v.id === reqId);
		if (idx !== -1) {
			verifications[idx].status = resolution;
			verifications[idx].admin_notes = adminNotes;
			verifications = [...verifications];
		}

		// Update local stats counters optimistically
		if (prevStatus !== resolution) {
			if (stats[prevStatus] !== undefined && stats[prevStatus] > 0) {
				stats[prevStatus]--;
			}
			if (stats[resolution] !== undefined) {
				stats[resolution]++;
			}
			stats = { ...stats };
		}

		closeModal();

		try {
			const res = await adminApi.verifications.review(reqId, {
				resolution,
				admin_notes: adminNotes.trim()
			});

			showNotification(res.message || 'Resolución aplicada con éxito');

			// Silent background sync
			const params = {};
			if (statusFilter !== 'all') params.status = statusFilter;
			if (categoryFilter !== 'all') params.category = categoryFilter;
			if (searchQuery.trim()) params.q = searchQuery.trim();
			const syncRes = await adminApi.verifications.list(params);
			verifications = syncRes.verifications || [];
			if (syncRes.stats) stats = syncRes.stats;
		} catch (e) {
			// Revert on failure
			if (idx !== -1) {
				verifications[idx].status = prevStatus;
				verifications = [...verifications];
			}
			stats = prevStats;
			showNotification(e.message || 'Error al procesar la resolución de verificación', true);
		} finally {
			processingAction = false;
		}
	}

	function parseJsonList(str) {
		if (!str) return [];
		try {
			const parsed = typeof str === 'string' ? JSON.parse(str) : str;
			return Array.isArray(parsed) ? parsed : [parsed];
		} catch {
			return [str];
		}
	}

	function parseJsonObject(str) {
		if (!str) return {};
		try {
			return typeof str === 'string' ? JSON.parse(str) : str;
		} catch {
			return {};
		}
	}

	function getDomainBadge(url) {
		const lower = String(url).toLowerCase();
		if (lower.includes('artstation.com'))
			return { label: 'ArtStation', icon: 'palette', color: '#13aff0' };
		if (lower.includes('cara.app')) return { label: 'Cara', icon: 'brush', color: '#ff5c5c' };
		if (lower.includes('pixiv.net'))
			return { label: 'Pixiv', icon: 'photo_library', color: '#0096fa' };
		if (lower.includes('behance.net'))
			return { label: 'Behance', icon: 'auto_awesome', color: '#0057ff' };
		if (lower.includes('twitch.tv')) return { label: 'Twitch', icon: 'videocam', color: '#9146ff' };
		if (lower.includes('youtube.com') || lower.includes('youtu.be'))
			return { label: 'YouTube', icon: 'play_circle', color: '#ff0000' };
		if (lower.includes('kick.com'))
			return { label: 'Kick', icon: 'smart_display', color: '#53fc18' };
		if (lower.includes('twitter.com') || lower.includes('x.com'))
			return { label: 'X (Twitter)', icon: 'tag', color: '#1d9bf0' };
		if (lower.includes('github.com')) return { label: 'GitHub', icon: 'code', color: '#8b949e' };
		return { label: 'Portafolio Web', icon: 'language', color: 'var(--aero-mint)' };
	}

	let filteredVerifications = $derived(
		verifications.filter((v) => {
			if (!searchQuery.trim()) return true;
			const q = searchQuery.toLowerCase();
			return (
				v.folio?.toLowerCase().includes(q) ||
				v.applicant_handle?.toLowerCase().includes(q) ||
				v.username?.toLowerCase().includes(q) ||
				v.legal_name?.toLowerCase().includes(q) ||
				v.contact_email?.toLowerCase().includes(q) ||
				v.specialty?.toLowerCase().includes(q)
			);
		})
	);
</script>

<svelte:head>
	<title>Verificaciones | VSocial Admin</title>
</svelte:head>

<!-- ── Standard Page Header ──────────────────────────────────────── -->
<div class="page-header">
	<div class="header-left">
		<div class="header-badge">
			<span class="material-icons-round badge-icon">verified</span>
			<span>Auditoría de Creadores & Talento Virtual</span>
		</div>
		<h1 class="page-title">Bandeja de Verificaciones</h1>
		<p class="page-subtitle">
			Revisión de autoría para artistas digitales, identidades VTuber 2D/3D, estudios y figuras
			públicas.
		</p>
	</div>
	<div class="header-right">
		<button
			onclick={loadVerifications}
			class="btn-aero-secondary"
			disabled={loading}
			title="Actualizar lista de solicitudes"
		>
			<span class="material-icons-round" class:animate-spin={loading}>refresh</span>
			<span>Actualizar Solicitudes</span>
		</button>
	</div>
</div>

<!-- ── Main Page Content ──────────────────────────────────────────── -->
<div class="page-content">
	<!-- Action Notification Banner -->
	{#if feedbackMsg}
		<div
			class="alert-box"
			class:error={feedbackError}
			class:success={!feedbackError}
			in:fade={{ duration: 180 }}
		>
			<span class="material-icons-round">{feedbackError ? 'error_outline' : 'verified'}</span>
			<span class="alert-text">{feedbackMsg}</span>
		</div>
	{/if}

	<!-- ── Metrics Grid (KPIs) ──────────────────────────────────────── -->
	<div class="metrics-grid">
		<div class="metric-card glass-card">
			<div
				class="metric-icon"
				style="background: rgba(245, 166, 35, 0.12); color: var(--aero-amber); border: 1px solid rgba(245, 166, 35, 0.25);"
			>
				<span class="material-icons-round">hourglass_empty</span>
			</div>
			<div class="metric-data">
				<p class="metric-value">{stats.pending}</p>
				<p class="metric-label" style="color: var(--aero-amber);">Pendientes</p>
			</div>
		</div>

		<div class="metric-card glass-card">
			<div
				class="metric-icon"
				style="background: rgba(46, 180, 255, 0.12); color: var(--aero-sky); border: 1px solid rgba(46, 180, 255, 0.25);"
			>
				<span class="material-icons-round">visibility</span>
			</div>
			<div class="metric-data">
				<p class="metric-value">{stats.reviewing}</p>
				<p class="metric-label" style="color: var(--aero-sky);">En Revisión</p>
			</div>
		</div>

		<div class="metric-card glass-card">
			<div
				class="metric-icon"
				style="background: rgba(0, 212, 170, 0.12); color: var(--aero-mint); border: 1px solid rgba(0, 212, 170, 0.25);"
			>
				<span class="material-icons-round">check_circle</span>
			</div>
			<div class="metric-data">
				<p class="metric-value">{stats.approved}</p>
				<p class="metric-label" style="color: var(--aero-mint);">Aprobadas</p>
			</div>
		</div>

		<div class="metric-card glass-card">
			<div
				class="metric-icon"
				style="background: rgba(232, 74, 114, 0.12); color: var(--aero-rose); border: 1px solid rgba(232, 74, 114, 0.25);"
			>
				<span class="material-icons-round">cancel</span>
			</div>
			<div class="metric-data">
				<p class="metric-value">{stats.rejected}</p>
				<p class="metric-label" style="color: var(--aero-rose);">Rechazadas</p>
			</div>
		</div>
	</div>

	<!-- ── Filter & Search Toolbar ──────────────────────────────────── -->
	<div class="filters-toolbar glass-panel neo-shadow">
		<div class="toolbar-top">
			<!-- Search Box -->
			<div class="search-box">
				<span class="material-icons-round search-icon">search</span>
				<input
					type="text"
					placeholder="Buscar por folio, @usuario, email o titular..."
					bind:value={searchQuery}
					class="aero-input search-input"
				/>
				{#if searchQuery}
					<button
						type="button"
						class="clear-search-btn"
						onclick={() => (searchQuery = '')}
						title="Limpiar búsqueda"
					>
						<span class="material-icons-round">close</span>
					</button>
				{/if}
			</div>

			<!-- Status Filter Tabs -->
			<div class="status-tab-group">
				{#each [{ id: 'pending', label: 'Pendientes', count: stats.pending, icon: 'hourglass_empty' }, { id: 'reviewing', label: 'En Revisión', count: stats.reviewing, icon: 'visibility' }, { id: 'approved', label: 'Aprobadas', count: stats.approved, icon: 'check_circle' }, { id: 'rejected', label: 'Rechazadas', count: stats.rejected, icon: 'cancel' }, { id: 'all', label: 'Todas', count: stats.total, icon: 'view_list' }] as tab}
					<button
						class="tab-btn"
						class:active={statusFilter === tab.id}
						onclick={() => {
							statusFilter = tab.id;
							loadVerifications();
						}}
					>
						<span class="material-icons-round tab-icon">{tab.icon}</span>
						<span class="tab-text">{tab.label}</span>
						<span class="tab-count-pill">{tab.count}</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- Category Chips -->
		<div class="toolbar-bottom">
			<span class="filter-caption">Canal:</span>
			<div class="chips-container">
				{#each [{ id: 'all', label: 'Todos los Canales' }, { id: 'creator', label: 'Arte & Creadores' }, { id: 'streamer', label: 'VTubers & Streamers' }, { id: 'organization', label: 'Estudios & Agencias' }, { id: 'public', label: 'Notoriedad Pública' }, { id: 'government', label: 'Gobierno' }] as chip}
					<button
						class="type-chip"
						class:active={categoryFilter === chip.id}
						onclick={() => {
							categoryFilter = chip.id;
							loadVerifications();
						}}
					>
						{chip.label}
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- ── Requests Dossier Grid ────────────────────────────────────── -->
	{#if loading}
		<div class="verif-grid" in:fade={{ duration: 150 }}>
			{#each Array(6) as _, i}
				<div class="verif-card glass-card skeleton-card" style="animation-delay: {i * 45}ms;">
					<!-- Skeleton Header -->
					<div class="card-header">
						<div class="card-meta">
							<div class="skeleton-shimmer skeleton-cat-icon"></div>
							<div class="skeleton-col">
								<div class="skeleton-shimmer skeleton-bar skeleton-w60"></div>
								<div
									class="skeleton-shimmer skeleton-bar skeleton-w40"
									style="margin-top: 4px;"
								></div>
							</div>
						</div>
						<div class="skeleton-shimmer skeleton-pill"></div>
					</div>

					<!-- Skeleton Profile -->
					<div class="applicant-profile">
						<div class="avatar-wrapper skeleton-avatar-wrap">
							<div class="skeleton-shimmer skeleton-avatar"></div>
						</div>
						<div class="applicant-details">
							<div class="skeleton-shimmer skeleton-bar skeleton-w70"></div>
							<div
								class="skeleton-shimmer skeleton-bar skeleton-w50"
								style="margin-top: 6px;"
							></div>
							<div
								class="skeleton-shimmer skeleton-bar skeleton-w30"
								style="margin-top: 6px;"
							></div>
						</div>
					</div>

					<!-- Skeleton Evidence Box -->
					<div class="evidence-box skeleton-evidence">
						<div class="skeleton-shimmer skeleton-bar skeleton-w80"></div>
						<div class="skeleton-badges-row">
							<div class="skeleton-shimmer skeleton-chip"></div>
							<div class="skeleton-shimmer skeleton-chip"></div>
							<div class="skeleton-shimmer skeleton-chip"></div>
						</div>
						<div class="skeleton-shimmer skeleton-bar skeleton-w40" style="margin-top: 4px;"></div>
					</div>

					<!-- Skeleton Button -->
					<div class="skeleton-shimmer skeleton-btn"></div>
				</div>
			{/each}
		</div>
	{:else if filteredVerifications.length === 0}
		<div class="empty-state glass-card" in:fade={{ duration: 200 }}>
			<div class="empty-icon-wrap">
				<span class="material-icons-round">task_alt</span>
			</div>
			<h3 class="empty-title">Bandeja al Día</h3>
			<p class="empty-subtitle">
				No hay solicitudes de verificación pendientes con los filtros seleccionados.
			</p>
		</div>
	{:else}
		<div class="verif-grid">
			{#each filteredVerifications as req, i (req.id)}
				{@const catMeta = categoryMap[req.category] || categoryMap.creator}
				{@const portfolios = parseJsonList(req.portfolio_links)}
				<div
					class="verif-card glass-card card-entrance"
					style="animation-delay: {Math.min(i * 40, 280)}ms;"
				>
					<!-- Card Header: Folio, Category & Status -->
					<div class="card-header">
						<div class="card-meta">
							<span
								class="cat-icon-wrap"
								style="color: {catMeta.color}; border-color: rgba(255,255,255,0.12);"
							>
								<span class="material-icons-round">{catMeta.icon}</span>
							</span>
							<div>
								<span class="folio-code">{req.folio}</span>
								<span class="cat-label">{catMeta.label}</span>
							</div>
						</div>

						<span class="status-pill status-{req.status}">
							{req.status === 'pending'
								? 'Pendiente'
								: req.status === 'reviewing'
									? 'En Revisión'
									: req.status === 'approved'
										? 'Aprobada'
										: 'Rechazada'}
						</span>
					</div>

					<!-- Applicant Profile Dossier -->
					<div class="applicant-profile">
						<div class="avatar-wrapper">
							{#if req.avatar_url}
								<img src={req.avatar_url} alt={req.applicant_handle} class="applicant-avatar-img" />
							{:else}
								<div class="applicant-avatar-fallback">
									{(req.applicant_handle || req.username || '?')[0].toUpperCase()}
								</div>
							{/if}
						</div>

						<div class="applicant-details">
							<div class="name-row">
								<h4 class="display-name truncate">
									{req.display_name || req.applicant_handle || req.username}
								</h4>
								{#if req.user_is_verified}
									<span
										class="material-icons-round verified-icon"
										title="Ya cuenta con insignia de verificación">verified</span
									>
								{/if}
							</div>
							<p class="user-handle truncate">@{req.applicant_handle || req.username}</p>
							<div class="specialty-tag truncate">
								{req.specialty || catMeta.label}
							</div>
						</div>
					</div>

					<!-- Contact & Portfolios Pill Box -->
					<div class="evidence-box">
						<div class="contact-row">
							<span class="evidence-label">Contacto:</span>
							<span class="contact-email truncate">{req.contact_email}</span>
						</div>

						{#if portfolios.length > 0}
							<div class="portfolios-list">
								{#each portfolios.slice(0, 3) as link}
									{@const badge = getDomainBadge(link)}
									<span class="portfolio-badge">
										<span class="material-icons-round badge-dot" style="color: {badge.color};"
											>{badge.icon}</span
										>
										<span class="badge-title">{badge.label}</span>
									</span>
								{/each}
								{#if portfolios.length > 3}
									<span class="portfolio-more">+{portfolios.length - 3}</span>
								{/if}
							</div>
						{/if}

						<div class="meta-footer">
							<span class="radicado-date"
								>Radicado: {new Date(req.created_at).toLocaleDateString('es-ES', {
									day: '2-digit',
									month: 'short',
									year: 'numeric'
								})}</span
							>
							{#if req.reviewer_name}
								<span class="reviewer-tag">Por: @{req.reviewer_name}</span>
							{/if}
						</div>
					</div>

					<!-- Action Button -->
					<button onclick={() => openModal(req)} class="btn-aero-primary inspect-btn">
						<span class="material-icons-round">assignment</span>
						<span>Inspeccionar Expediente</span>
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- ── Auditor Inspector Modal ────────────────────────────────────── -->
{#if selectedReq}
	{@const catMeta = categoryMap[selectedReq.category] || categoryMap.creator}
	{@const portfolios = parseJsonList(selectedReq.portfolio_links)}
	{@const socials = parseJsonObject(selectedReq.social_links)}

	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="modal-backdrop"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeModal();
		}}
		in:fade={{ duration: 150 }}
	>
		<div
			class="modal-panel glass-panel neo-shadow"
			in:scale={{ duration: 250, start: 0.95, easing: quintOut }}
		>
			<!-- Modal Header -->
			<div class="modal-header">
				<div class="modal-title-group">
					<div
						class="modal-cat-icon"
						style="color: {catMeta.color}; border: 1px solid var(--accent-blue-base); background: rgba(27, 133, 243, 0.15);"
					>
						<span class="material-icons-round">{catMeta.icon}</span>
					</div>
					<div>
						<div class="modal-title-row">
							<h3 class="modal-title">Expediente de Verificación</h3>
							<span class="modal-folio-badge">{selectedReq.folio}</span>
						</div>
						<p class="modal-subtitle">
							Canal de Auditoría: <strong style="color: {catMeta.color};">{catMeta.label}</strong>
						</p>
					</div>
				</div>

				<button type="button" onclick={closeModal} class="modal-close-btn" title="Cerrar ventana">
					<span class="material-icons-round">close</span>
				</button>
			</div>

			<!-- Modal Scrollable Body -->
			<div class="modal-body">
				<!-- 2-Column Identity & Evidences Overview -->
				<div class="dossier-grid">
					<!-- Box 1: Account Dossier -->
					<div class="dossier-box">
						<span class="box-caption">Identidad en V-SOCIAL</span>
						<div class="dossier-user-row">
							<div class="avatar-wrapper sm">
								{#if selectedReq.avatar_url}
									<img
										src={selectedReq.avatar_url}
										alt={selectedReq.username}
										class="applicant-avatar-img"
									/>
								{:else}
									<div class="applicant-avatar-fallback">
										{(selectedReq.applicant_handle || '?')[0].toUpperCase()}
									</div>
								{/if}
							</div>
							<div>
								<h4 class="dossier-username">
									@{selectedReq.applicant_handle || selectedReq.username}
								</h4>
								<span class="dossier-userid">Usuario ID: #{selectedReq.user_id}</span>
							</div>
						</div>

						<div class="dossier-details-list">
							<div class="detail-item">
								<strong>Email Contacto:</strong> <span>{selectedReq.contact_email}</span>
							</div>
							<div class="detail-item">
								<strong>Titular / Razón Social:</strong>
								<span>{selectedReq.legal_name || 'No especificado (Confidencial)'}</span>
							</div>
							<div class="detail-item">
								<strong>Especialidad Declarada:</strong>
								<span>{selectedReq.specialty || 'General'}</span>
							</div>
						</div>

						<a
							href="/u/{selectedReq.applicant_handle || selectedReq.username}"
							target="_blank"
							class="profile-link"
						>
							<span>Abrir perfil público de la cuenta</span>
							<span class="material-icons-round">open_in_new</span>
						</a>
					</div>

					<!-- Box 2: Target Badge Live Preview -->
					<div class="dossier-box flex-between">
						<div>
							<span class="box-caption">Insignia Objetivo a Otorgar</span>
							<div class="badge-preview-card">
								<div class="badge-info-side">
									<span class="material-icons-round badge-preview-icon">verified</span>
									<div>
										<strong class="badge-preview-title">Insignia Verificado Oficial</strong>
										<span class="badge-preview-subtitle">Nivel 4 de Autenticidad</span>
									</div>
								</div>
								<span class="badge-preview-tag">VERIFICADO</span>
							</div>
						</div>

						<!-- Auditor Criteria Checklist -->
						<div class="checklist-wrap">
							<label class="checklist-item">
								<input type="checkbox" bind:checked={checkHumanAuth} class="aero-checkbox" />
								<span>Autoría humana demostrada (sin IA no declarada)</span>
							</label>
							<label class="checklist-item">
								<input type="checkbox" bind:checked={checkMinPieces} class="aero-checkbox" />
								<span>Portafolio activo con al menos 6 piezas públicas</span>
							</label>
							<label class="checklist-item">
								<input type="checkbox" bind:checked={checkCrossLink} class="aero-checkbox" />
								<span>Canal de transmisión / identidad validada</span>
							</label>
						</div>
					</div>
				</div>

				<!-- Portfolios & Proof Links Section -->
				<div class="section-block">
					<h4 class="section-title">
						<span class="material-icons-round">link</span>
						<span>Portafolios y Enlaces de Auditoría</span>
					</h4>

					{#if portfolios.length === 0}
						<p class="empty-field-note">No se adjuntaron enlaces de portafolio.</p>
					{:else}
						<div class="portfolios-grid">
							{#each portfolios as linkGroup}
								{#if linkGroup && typeof linkGroup === 'string'}
									{#each linkGroup
										.split(/[\n,]+/)
										.map((s) => s.trim())
										.filter(Boolean) as singleLink}
										{@const badge = getDomainBadge(singleLink)}
										<a
											href={singleLink.startsWith('http') ? singleLink : `https://${singleLink}`}
											target="_blank"
											rel="noopener noreferrer"
											class="portfolio-link-card"
										>
											<div class="link-meta">
												<span class="link-icon-wrap" style="color: {badge.color};"
													><span class="material-icons-round">{badge.icon}</span></span
												>
												<div class="link-text-block">
													<strong class="link-label truncate">{badge.label}</strong>
													<span class="link-url truncate">{singleLink}</span>
												</div>
											</div>
											<span class="material-icons-round link-external-icon">launch</span>
										</a>
									{/each}
								{/if}
							{/each}
						</div>
					{/if}
				</div>

				<!-- Additional Details / Socials -->
				{#if Object.keys(socials).length > 0}
					<div class="section-block">
						<h4 class="section-title">Datos Técnicos & Redes</h4>
						<div class="socials-grid">
							{#each Object.entries(socials) as [key, val]}
								{#if val}
									<div class="social-item">
										<span class="social-key">{key}:</span>
										<span class="social-val truncate">{val}</span>
									</div>
								{/if}
							{/each}
						</div>
					</div>
				{/if}

				<!-- Reject Presets -->
				<div class="section-block">
					<span class="box-caption">Plantillas Rápidas para Dictamen / Rechazo:</span>
					<div class="presets-wrap">
						{#each rejectPresets as preset}
							<button type="button" class="preset-chip" onclick={() => setRejectPreset(preset)}>
								{preset}
							</button>
						{/each}
					</div>
				</div>

				<!-- Auditor Notes Textarea -->
				<div class="section-block">
					<label for="auditor-notes-field" class="form-label">
						Dictamen del Auditor / Motivo (notificado al solicitante si se rechaza):
					</label>
					<textarea
						id="auditor-notes-field"
						rows="3"
						bind:value={adminNotes}
						class="aero-input textarea-field"
						placeholder="Ej: Portafolio verificado con autoría confirmada / Rechazado por falta de evidencias de autoría humana..."
					></textarea>
				</div>
			</div>

			<!-- Modal Footer: Decisions -->
			<div class="modal-footer">
				<button
					type="button"
					onclick={() => handleReview('reviewing')}
					disabled={processingAction}
					class="btn-aero-secondary"
				>
					<span class="material-icons-round">visibility</span>
					<span>Marcar En Revisión</span>
				</button>

				<div class="footer-action-right">
					<button
						type="button"
						onclick={() => handleReview('rejected')}
						disabled={processingAction}
						class="btn-aero-danger"
					>
						<span class="material-icons-round">cancel</span>
						<span>Rechazar Solicitud</span>
					</button>

					<button
						type="button"
						onclick={() => handleReview('approved')}
						disabled={processingAction}
						class="btn-aero-primary approve-action-btn"
					>
						<span class="material-icons-round">{processingAction ? 'sync' : 'verified'}</span>
						<span>{processingAction ? 'Otorgando Insignia...' : 'Aprobar & Otorgar Insignia'}</span>
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	/* ── Header ────────────────────────────────────────── */
	.page-header {
		padding: 32px;
		background: linear-gradient(180deg, rgba(46, 134, 232, 0.04) 0%, transparent 100%);
		border-bottom: 1px solid var(--border-subtle);
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 20px;
	}
	.header-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--aero-mint);
		margin-bottom: 6px;
	}
	.badge-icon {
		font-size: 14px;
	}
	.page-title {
		font-size: 1.8rem;
		font-family: var(--font-display);
		font-weight: 800;
		color: var(--text-primary);
		margin: 0;
		letter-spacing: -0.02em;
	}
	.page-subtitle {
		font-size: 0.88rem;
		color: var(--text-muted);
		margin: 4px 0 0;
	}

	/* ── Main Page Content ─────────────────────────────── */
	.page-content {
		padding: 32px;
	}

	/* Alerts */
	.alert-box {
		padding: 14px 18px;
		margin-bottom: 24px;
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 0.88rem;
		font-weight: 500;
	}
	.alert-box.success {
		background: rgba(0, 212, 170, 0.12);
		border: 1px solid rgba(0, 212, 170, 0.3);
		color: var(--aero-mint);
	}
	.alert-box.error {
		background: rgba(232, 74, 114, 0.12);
		border: 1px solid rgba(232, 74, 114, 0.3);
		color: var(--aero-rose);
	}
	.alert-text {
		flex: 1;
	}

	/* ── Metrics Grid ──────────────────────────────────── */
	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 16px;
		margin-bottom: 24px;
	}
	.metric-card {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 20px 22px;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
	}
	.metric-icon {
		width: 52px;
		height: 52px;
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.metric-icon .material-icons-round {
		font-size: 26px;
	}
	.metric-data {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.metric-value {
		font-size: 1.8rem;
		font-weight: 800;
		font-family: var(--font-display);
		color: var(--text-primary);
		margin: 0;
		line-height: 1.1;
	}
	.metric-label {
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin: 4px 0 0;
	}

	/* ── Toolbar & Filters ─────────────────────────────── */
	.filters-toolbar {
		padding: 16px 20px;
		border-radius: var(--radius-lg);
		margin-bottom: 24px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		background: var(--glass-bg);
		border: 1px solid var(--glass-border);
	}
	.toolbar-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}

	.search-box {
		position: relative;
		flex: 1;
		min-width: 260px;
		max-width: 420px;
	}
	.search-icon {
		position: absolute;
		left: 12px;
		top: 50%;
		transform: translateY(-50%);
		font-size: 19px;
		color: var(--text-muted);
		pointer-events: none;
	}
	.search-input {
		width: 100%;
		padding-left: 38px;
		padding-right: 34px;
		font-size: 0.85rem;
		height: 38px;
	}
	.clear-search-btn {
		position: absolute;
		right: 10px;
		top: 50%;
		transform: translateY(-50%);
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2px;
	}
	.clear-search-btn:hover {
		color: var(--text-primary);
	}
	.clear-search-btn .material-icons-round {
		font-size: 16px;
	}

	.status-tab-group {
		display: flex;
		align-items: center;
		gap: 6px;
		background: rgba(0, 0, 0, 0.2);
		padding: 4px;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-subtle);
		overflow-x: auto;
	}
	.tab-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border-radius: var(--radius-sm);
		border: none;
		background: transparent;
		color: var(--text-muted);
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
		transition: all var(--t-base) var(--ease-spring);
		white-space: nowrap;
	}
	.tab-btn:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.06);
		transform: translateY(-1px);
	}
	.tab-btn:active {
		transform: scale(0.97);
	}
	.tab-btn.active {
		background: var(--bg-surface);
		color: var(--text-primary);
		box-shadow: var(--shadow-xs);
		font-weight: 700;
	}
	.tab-icon {
		font-size: 15px;
	}
	.tab-count-pill {
		font-size: 0.68rem;
		padding: 1px 6px;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.1);
		font-weight: 700;
	}

	.toolbar-bottom {
		display: flex;
		align-items: center;
		gap: 12px;
		border-top: 1px solid var(--border-subtle);
		padding-top: 12px;
		overflow-x: auto;
	}
	.filter-caption {
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		flex-shrink: 0;
	}
	.chips-container {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.type-chip {
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		color: var(--text-secondary);
		padding: 5px 12px;
		border-radius: var(--radius-full);
		font-size: 0.76rem;
		font-weight: 600;
		cursor: pointer;
		transition: all var(--t-base) var(--ease-spring);
		white-space: nowrap;
	}
	.type-chip:hover {
		background: var(--bg-overlay);
		color: var(--text-primary);
		border-color: var(--glass-border);
		transform: translateY(-1px);
	}
	.type-chip:active {
		transform: scale(0.96);
	}
	.type-chip.active {
		background: var(--accent-blue-base);
		border-color: var(--accent-blue-light);
		color: #fff;
		box-shadow: 0 2px 10px rgba(27, 133, 243, 0.35);
	}

	/* ── Loader & Empty State ───────────────────────────── */
	@keyframes cardEntrance {
		from {
			opacity: 0;
			transform: translateY(12px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@keyframes aeroShimmer {
		0% {
			background-position: -200% 0;
		}
		100% {
			background-position: 200% 0;
		}
	}

	.card-entrance {
		animation: cardEntrance 0.35s var(--ease-spring) backwards;
		will-change: transform, opacity;
		contain: layout style paint;
		transform: translateZ(0);
	}

	.skeleton-shimmer {
		background: linear-gradient(
			90deg,
			rgba(255, 255, 255, 0.04) 0%,
			rgba(255, 255, 255, 0.12) 50%,
			rgba(255, 255, 255, 0.04) 100%
		);
		background-size: 200% 100%;
		animation: aeroShimmer 1.8s ease-in-out infinite;
		border-radius: var(--radius-xs);
	}

	.skeleton-card {
		opacity: 0.85;
		pointer-events: none;
		animation: cardEntrance 0.3s var(--ease-spring) backwards;
	}

	.skeleton-cat-icon {
		width: 34px;
		height: 34px;
		border-radius: var(--radius-sm);
		flex: 0 0 34px;
		min-width: 34px;
		min-height: 34px;
	}

	.skeleton-col {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 80px;
	}

	.skeleton-pill {
		width: 72px;
		height: 22px;
		border-radius: var(--radius-full);
		flex-shrink: 0;
	}

	.skeleton-avatar-wrap {
		border: none;
		box-shadow: none;
		background: transparent;
	}

	.skeleton-avatar {
		width: 100%;
		height: 100%;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
	}

	.skeleton-bar {
		height: 10px;
		border-radius: var(--radius-xs);
	}

	.skeleton-w30 {
		width: 30%;
	}
	.skeleton-w40 {
		width: 40%;
	}
	.skeleton-w50 {
		width: 50%;
	}
	.skeleton-w60 {
		width: 60%;
	}
	.skeleton-w70 {
		width: 70%;
	}
	.skeleton-w80 {
		width: 80%;
	}

	.skeleton-evidence {
		gap: 10px;
	}

	.skeleton-badges-row {
		display: flex;
		gap: 6px;
	}

	.skeleton-chip {
		width: 64px;
		height: 18px;
		border-radius: var(--radius-xs);
	}

	.skeleton-btn {
		width: 100%;
		height: 36px;
		border-radius: var(--radius-md);
	}

	.empty-state {
		padding: 64px 32px;
		text-align: center;
		border-radius: var(--radius-xl);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		margin: 20px 0;
		animation: cardEntrance 0.35s var(--ease-spring);
	}
	.empty-icon-wrap {
		width: 68px;
		height: 68px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: rgba(0, 212, 170, 0.1);
		color: var(--aero-mint);
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 68px;
		min-width: 68px;
		min-height: 68px;
	}
	.empty-icon-wrap .material-icons-round {
		font-size: 36px;
	}
	.empty-title {
		font-size: 1.25rem;
		font-weight: 800;
		color: var(--text-primary);
		margin: 0;
	}
	.empty-subtitle {
		font-size: 0.85rem;
		color: var(--text-muted);
		max-width: 440px;
		margin: 0;
	}

	/* ── Verifications Grid ────────────────────────────── */
	.verif-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
		gap: 20px;
	}
	.verif-card {
		padding: 22px;
		border-radius: var(--radius-xl);
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 16px;
		transition:
			transform var(--t-spring),
			box-shadow var(--t-base),
			border-color var(--t-base);
		will-change: transform, opacity;
		contain: layout style paint;
		transform: translateZ(0);
	}
	.verif-card:hover {
		transform: translateY(-3px);
		box-shadow: var(--shadow-md);
		border-color: rgba(255, 255, 255, 0.2);
	}

	.card-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
		border-bottom: 1px solid var(--border-subtle);
		padding-bottom: 12px;
	}
	.card-meta {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}
	.cat-icon-wrap {
		width: 34px;
		height: 34px;
		border-radius: var(--radius-sm);
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid var(--border-subtle);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.cat-icon-wrap .material-icons-round {
		font-size: 18px;
	}
	.folio-code {
		font-size: 0.8rem;
		font-family: monospace;
		font-weight: 700;
		color: var(--aero-sky);
		display: block;
		line-height: 1.2;
	}
	.cat-label {
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		display: block;
	}

	.status-pill {
		font-size: 0.68rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 3px 10px;
		border-radius: var(--radius-full);
		white-space: nowrap;
	}
	.status-pill.status-pending {
		background: rgba(245, 166, 35, 0.15);
		border: 1px solid rgba(245, 166, 35, 0.35);
		color: var(--aero-amber);
	}
	.status-pill.status-reviewing {
		background: rgba(46, 180, 255, 0.15);
		border: 1px solid rgba(46, 180, 255, 0.35);
		color: var(--aero-sky);
	}
	.status-pill.status-approved {
		background: rgba(0, 212, 170, 0.15);
		border: 1px solid rgba(0, 212, 170, 0.35);
		color: var(--aero-mint);
	}
	.status-pill.status-rejected {
		background: rgba(232, 74, 114, 0.15);
		border: 1px solid rgba(232, 74, 114, 0.35);
		color: var(--aero-rose);
	}

	/* Applicant profile */
	.applicant-profile {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.avatar-wrapper {
		width: 46px;
		height: 46px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		overflow: hidden;
		flex: 0 0 46px;
		min-width: 46px;
		min-height: 46px;
		background: var(--grad-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}
	.avatar-wrapper.sm {
		width: 40px;
		height: 40px;
		flex: 0 0 40px;
		min-width: 40px;
		min-height: 40px;
	}
	.applicant-avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.applicant-avatar-fallback {
		color: #fff;
		font-weight: 800;
		font-size: 1.1rem;
		text-transform: uppercase;
	}
	.applicant-details {
		flex: 1;
		min-width: 0;
	}
	.name-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.display-name {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
	}
	.verified-icon {
		font-size: 15px;
		color: var(--aero-sky);
		flex-shrink: 0;
	}
	.user-handle {
		font-size: 0.78rem;
		color: var(--text-muted);
		margin: 2px 0 0;
	}
	.specialty-tag {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--aero-mint);
		margin-top: 4px;
	}

	/* Evidence Box */
	.evidence-box {
		padding: 12px 14px;
		border-radius: var(--radius-md);
		background: rgba(0, 0, 0, 0.22);
		border: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: 0.78rem;
	}
	.contact-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.evidence-label {
		color: var(--text-muted);
		font-weight: 600;
		font-size: 0.72rem;
	}
	.contact-email {
		color: var(--text-primary);
		font-weight: 600;
	}
	.portfolios-list {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 2px;
	}
	.portfolio-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		border-radius: var(--radius-xs);
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid var(--border-subtle);
		color: var(--text-secondary);
		font-size: 0.68rem;
		font-weight: 600;
	}
	.badge-dot {
		font-size: 12px;
	}
	.portfolio-more {
		font-size: 0.68rem;
		padding: 2px 6px;
		border-radius: var(--radius-xs);
		background: rgba(255, 255, 255, 0.05);
		color: var(--text-muted);
	}
	.meta-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
		padding-top: 6px;
		font-size: 0.68rem;
		color: var(--text-muted);
	}

	.inspect-btn {
		width: 100%;
		padding: 9px 16px;
		font-size: 0.82rem;
		border-radius: var(--radius-md);
	}

	/* ── Modal Dialog ──────────────────────────────────── */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal-backdrop, 500);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		background: rgba(10, 18, 30, 0.65);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
	}
	.modal-panel {
		width: 100%;
		max-width: 760px;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		border-radius: var(--radius-xl);
		background: var(--bg-surface);
		border: 1px solid var(--glass-border);
		overflow: hidden;
		box-shadow: var(--shadow-lg);
	}
	.modal-header {
		padding: 20px 24px;
		border-bottom: 1px solid var(--border-subtle);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}
	.modal-title-group {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.modal-cat-icon {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.modal-cat-icon .material-icons-round {
		font-size: 22px;
	}
	.modal-title-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.modal-title {
		font-size: 1.15rem;
		font-weight: 800;
		font-family: var(--font-display);
		color: var(--text-primary);
		margin: 0;
	}
	.modal-folio-badge {
		font-size: 0.72rem;
		font-family: monospace;
		font-weight: 700;
		padding: 2px 8px;
		border-radius: var(--radius-xs);
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid var(--border-subtle);
		color: var(--aero-sky);
	}
	.modal-subtitle {
		font-size: 0.76rem;
		color: var(--text-muted);
		margin: 2px 0 0;
	}
	.modal-close-btn {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-sm);
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all var(--t-fast);
	}
	.modal-close-btn:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-primary);
	}

	.modal-body {
		padding: 24px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.dossier-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}
	@media (max-width: 680px) {
		.dossier-grid {
			grid-template-columns: 1fr;
		}
	}
	.dossier-box {
		padding: 16px;
		border-radius: var(--radius-lg);
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.dossier-box.flex-between {
		justify-content: space-between;
	}
	.box-caption {
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		display: block;
	}
	.dossier-user-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.dossier-username {
		font-size: 0.92rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
	}
	.dossier-userid {
		font-size: 0.72rem;
		color: var(--text-muted);
	}
	.dossier-details-list {
		border-top: 1px solid rgba(255, 255, 255, 0.05);
		padding-top: 8px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 0.75rem;
		color: var(--text-secondary);
	}
	.detail-item strong {
		color: var(--text-primary);
		margin-right: 4px;
	}
	.profile-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--aero-sky);
		text-decoration: none;
		font-size: 0.76rem;
		font-weight: 600;
		margin-top: 4px;
	}
	.profile-link:hover {
		text-decoration: underline;
	}
	.profile-link .material-icons-round {
		font-size: 14px;
	}

	.badge-preview-card {
		padding: 10px 12px;
		border-radius: var(--radius-md);
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--border-subtle);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-top: 4px;
	}
	.badge-info-side {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.badge-preview-icon {
		font-size: 20px;
		color: var(--accent-blue-base);
	}
	.badge-preview-title {
		font-size: 0.78rem;
		color: #fff;
		display: block;
	}
	.badge-preview-subtitle {
		font-size: 0.66rem;
		color: var(--text-muted);
		display: block;
	}
	.badge-preview-tag {
		font-size: 0.66rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		padding: 3px 8px;
		border-radius: var(--radius-full);
		background: rgba(27, 133, 243, 0.2);
		border: 1px solid var(--accent-blue-base);
		color: #fff;
	}

	.checklist-wrap {
		border-top: 1px solid rgba(255, 255, 255, 0.05);
		padding-top: 8px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.checklist-item {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.72rem;
		color: var(--text-secondary);
		cursor: pointer;
	}
	.aero-checkbox {
		accent-color: var(--accent-blue-base);
		cursor: pointer;
	}

	.section-block {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.section-title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.76rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-secondary);
		margin: 0;
	}
	.section-title .material-icons-round {
		font-size: 16px;
	}

	.portfolios-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 8px;
	}
	.portfolio-link-card {
		padding: 10px 12px;
		border-radius: var(--radius-md);
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--border-subtle);
		display: flex;
		align-items: center;
		justify-content: space-between;
		text-decoration: none;
		color: var(--text-primary);
		transition: all var(--t-fast);
	}
	.portfolio-link-card:hover {
		background: rgba(255, 255, 255, 0.08);
		border-color: rgba(255, 255, 255, 0.2);
	}
	.link-meta {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}
	.link-icon-wrap {
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		background: rgba(255, 255, 255, 0.05);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.link-icon-wrap .material-icons-round {
		font-size: 16px;
	}
	.link-text-block {
		min-width: 0;
	}
	.link-label {
		font-size: 0.76rem;
		display: block;
	}
	.link-url {
		font-size: 0.68rem;
		color: var(--text-muted);
		display: block;
	}
	.link-external-icon {
		font-size: 15px;
		color: var(--text-muted);
	}

	.socials-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 8px;
		padding: 12px;
		border-radius: var(--radius-md);
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid var(--border-subtle);
	}
	.social-item {
		padding: 8px 10px;
		border-radius: var(--radius-sm);
		background: rgba(255, 255, 255, 0.04);
	}
	.social-key {
		font-size: 0.66rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
		display: block;
	}
	.social-val {
		font-size: 0.76rem;
		font-weight: 600;
		color: var(--text-primary);
		display: block;
		margin-top: 2px;
	}

	.presets-wrap {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.preset-chip {
		font-size: 0.72rem;
		padding: 5px 10px;
		border-radius: var(--radius-sm);
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--border-subtle);
		color: var(--text-secondary);
		cursor: pointer;
		transition: all var(--t-fast);
		text-align: left;
	}
	.preset-chip:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-primary);
		border-color: rgba(255, 255, 255, 0.15);
	}

	.form-label {
		font-size: 0.76rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary);
		display: block;
	}
	.textarea-field {
		width: 100%;
		resize: vertical;
		min-height: 72px;
		font-size: 0.82rem;
		line-height: 1.4;
	}

	.modal-footer {
		padding: 16px 24px;
		border-top: 1px solid var(--border-subtle);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	.footer-action-right {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.approve-action-btn {
		background: linear-gradient(135deg, #00d4aa 0%, #1b85f3 100%);
		box-shadow: 0 4px 18px rgba(0, 212, 170, 0.3);
	}

	.empty-field-note {
		font-size: 0.76rem;
		color: var(--text-muted);
		font-style: italic;
		margin: 0;
	}

	/* ── Responsive ────────────────────────────────────── */
	@media (max-width: 768px) {
		.page-header {
			flex-direction: column;
			align-items: flex-start;
			padding: 20px;
		}
		.page-content {
			padding: 20px;
		}
		.modal-footer {
			flex-direction: column;
			align-items: stretch;
		}
		.footer-action-right {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
