<script>
	import { onMount } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { admin as adminApi } from '$lib/api.js';

	let { data } = $props();
	const staff = $derived(data.staff);
	const canReview = $derived(staff.permissions.includes('verifications.review'));

	let loading = $state(true);
	let verifications = $state([]);
	let stats = $state({ pending: 0, reviewing: 0, approved: 0, rejected: 0, total: 0 });
	let statusFilter = $state('pending');
	let categoryFilter = $state('all');
	let searchQuery = $state('');
	let page = $state(1);
	let totalPages = $state(1);
	const LIMIT = 12;

	let selectedReq = $state(null);
	let adminNotes = $state('');
	let processingAction = $state(false);
	let feedbackMsg = $state('');
	let feedbackError = $state(false);

	// Checklist real del auditor: exigido para poder aprobar.
	let checkHumanAuth = $state(false);
	let checkMinPieces = $state(false);
	let checkCrossLink = $state(false);
	const checklistOk = $derived(checkHumanAuth && checkMinPieces && checkCrossLink);

	const categoryMap = {
		creator: { label: 'Arte & Diseño', color: 'var(--aero-mint)', icon: 'palette' },
		streamer: { label: 'VTuber / Streamer', color: 'var(--aero-coral)', icon: 'videocam' },
		organization: { label: 'Estudio / Agencia', color: 'var(--aero-sky)', icon: 'business' },
		government: { label: 'Gobierno / Estatal', color: '#a855f7', icon: 'account_balance' },
		public: { label: 'Notoriedad Pública', color: 'var(--aero-amber)', icon: 'public' }
	};

	const STATUS_TABS = [
		{ key: 'pending', label: 'Pendientes', countKey: 'pending' },
		{ key: 'reviewing', label: 'En revisión', countKey: 'reviewing' },
		{ key: 'approved', label: 'Aprobadas', countKey: 'approved' },
		{ key: 'rejected', label: 'Rechazadas', countKey: 'rejected' },
		{ key: 'all', label: 'Todas', countKey: 'total' }
	];

	const CATEGORY_CHIPS = [
		{ key: 'all', label: 'Todas las categorías' },
		{ key: 'creator', label: 'Arte & Diseño' },
		{ key: 'streamer', label: 'VTuber / Streamer' },
		{ key: 'organization', label: 'Estudio / Agencia' },
		{ key: 'public', label: 'Notoriedad' },
		{ key: 'government', label: 'Gobierno' }
	];

	const rejectPresets = [
		'Portafolio insuficiente o sin piezas originales verificables.',
		'No se pudo comprobar la autoría humana de las obras.',
		'Canal de streaming inactivo o sin transmisiones recientes.',
		'Inconsistencia en la titularidad o sospecha de suplantación.',
		'Falta de mención cruzada hacia la cuenta de Voom!.'
	];

	const CHECKLIST = [
		{
			key: 'human',
			bind: () => checkHumanAuth,
			set: (v) => (checkHumanAuth = v),
			label: 'Autoría humana comprobada (proceso o WIP visible)'
		},
		{
			key: 'pieces',
			bind: () => checkMinPieces,
			set: (v) => (checkMinPieces = v),
			label: 'Portafolio con mínimo de piezas originales'
		},
		{
			key: 'cross',
			bind: () => checkCrossLink,
			set: (v) => (checkCrossLink = v),
			label: 'Mención cruzada verificada en redes/portafolio'
		}
	];

	function buildParams(p = page) {
		const params = { page: p, limit: LIMIT };
		if (statusFilter !== 'all') params.status = statusFilter;
		if (categoryFilter !== 'all') params.category = categoryFilter;
		if (searchQuery.trim()) params.q = searchQuery.trim();
		return params;
	}

	async function loadVerifications(p = 1, { silent = false } = {}) {
		if (!silent) loading = true;
		try {
			const res = await adminApi.verifications.list(buildParams(p));
			verifications = res.verifications || [];
			page = res.page || p;
			totalPages = Math.ceil(res.total / (res.limit || LIMIT)) || 1;
			if (res.stats) stats = res.stats;
		} catch (e) {
			showNotification(e?.message || 'Error al consultar las solicitudes de verificación.', true);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadVerifications(1);
	});

	let searchTimeout;
	function onSearchInput() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => loadVerifications(1), 400);
	}

	function showNotification(msg, isError = false) {
		feedbackMsg = msg;
		feedbackError = isError;
		setTimeout(() => (feedbackMsg = ''), 4500);
	}

	function openModal(req) {
		selectedReq = req;
		adminNotes = req.admin_notes || '';
		checkHumanAuth = false;
		checkMinPieces = false;
		checkCrossLink = false;
	}

	function closeModal() {
		selectedReq = null;
		adminNotes = '';
	}

	async function handleReview(resolution) {
		if (!selectedReq) return;
		if (resolution === 'approved' && !checklistOk) {
			showNotification('Completa la lista de verificación del auditor antes de aprobar.', true);
			return;
		}
		processingAction = true;
		const reqId = selectedReq.id;
		const prevStatus = selectedReq.status;
		const prevStats = { ...stats };
		const idx = verifications.findIndex((v) => v.id === reqId);

		if (idx !== -1) {
			verifications[idx].status = resolution;
			verifications[idx].admin_notes = adminNotes;
			verifications = [...verifications];
		}
		if (prevStatus !== resolution) {
			if (stats[prevStatus] !== undefined && stats[prevStatus] > 0) stats[prevStatus]--;
			if (stats[resolution] !== undefined) stats[resolution]++;
			stats = { ...stats };
		}

		closeModal();

		try {
			const res = await adminApi.verifications.review(reqId, {
				resolution,
				admin_notes: adminNotes.trim()
			});
			showNotification(res.message || 'Resolución aplicada con éxito.');
			loadVerifications(page, { silent: true });
		} catch (e) {
			if (idx !== -1) {
				verifications[idx].status = prevStatus;
				verifications = [...verifications];
			}
			stats = prevStats;
			showNotification(e?.message || 'Error al procesar la resolución.', true);
		} finally {
			processingAction = false;
		}
	}

	function parseJsonList(str) {
		if (!str) return [];
		try {
			const parsed = typeof str === 'string' ? JSON.parse(str) : str;
			if (Array.isArray(parsed))
				return parsed
					.filter(Boolean)
					.map((p) => (typeof p === 'string' ? p : p.url || p.link || ''))
					.filter(Boolean);
			if (typeof parsed === 'string') return [parsed];
			if (typeof parsed === 'object' && parsed)
				return Object.values(parsed)
					.map((v) => (typeof v === 'string' ? v : v?.url || ''))
					.filter(Boolean);
			return [];
		} catch {
			return [String(str)];
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

	function fmtDate(raw) {
		if (!raw) return '';
		const s = String(raw).trim();
		const iso = (s.includes('T') ? s : s.replace(' ', 'T')).replace(/Z?$/, 'Z');
		const d = new Date(iso);
		return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('es-ES');
	}

	function statusMeta(status) {
		if (status === 'pending') return { cls: 'is-pending', label: 'Pendiente' };
		if (status === 'reviewing') return { cls: 'is-reviewing', label: 'En revisión' };
		if (status === 'approved') return { cls: 'is-approved', label: 'Aprobada' };
		if (status === 'rejected') return { cls: 'is-rejected', label: 'Rechazada' };
		return { cls: 'is-inactive', label: status };
	}
</script>

<svelte:head>
	<title>Verificaciones | Voom! Staff</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title"><span class="material-icons-round">verified</span> Verificaciones</h1>
	<p class="page-subtitle">
		Expedientes de autoría: revisa evidencias y otorga (o deniega) la insignia.
	</p>
</div>

<div class="page-content">
	{#if feedbackMsg}
		<div class="alert-box {feedbackError ? 'error' : 'success'}" role="status">
			<span class="material-icons-round">{feedbackError ? 'error' : 'check_circle'}</span>
			{feedbackMsg}
		</div>
	{/if}

	<!-- KPIs -->
	<div class="metric-grid">
		<div class="glass-card metric-card">
			<div class="metric-icon is-amber">
				<span class="material-icons-round">pending_actions</span>
			</div>
			<div>
				<div class="metric-value">{stats.pending}</div>
				<div class="metric-label">Pendientes</div>
			</div>
		</div>
		<div class="glass-card metric-card">
			<div class="metric-icon"><span class="material-icons-round">manage_search</span></div>
			<div>
				<div class="metric-value">{stats.reviewing}</div>
				<div class="metric-label">En revisión</div>
			</div>
		</div>
		<div class="glass-card metric-card">
			<div class="metric-icon is-mint"><span class="material-icons-round">verified</span></div>
			<div>
				<div class="metric-value">{stats.approved}</div>
				<div class="metric-label">Aprobadas</div>
			</div>
		</div>
		<div class="glass-card metric-card">
			<div class="metric-icon is-rose"><span class="material-icons-round">cancel</span></div>
			<div>
				<div class="metric-value">{stats.rejected}</div>
				<div class="metric-label">Rechazadas</div>
			</div>
		</div>
	</div>

	<!-- Toolbar -->
	<div class="glass-panel admin-toolbar neo-shadow">
		<div class="filter-chips">
			{#each STATUS_TABS as tab (tab.key)}
				<button
					class="filter-chip"
					class:active={statusFilter === tab.key}
					onclick={() => {
						statusFilter = tab.key;
						loadVerifications(1);
					}}
				>
					{tab.label}
					<span class="chip-count">{stats[tab.countKey] ?? 0}</span>
				</button>
			{/each}
		</div>
		<div class="filter-chips">
			{#each CATEGORY_CHIPS as cat (cat.key)}
				<button
					class="filter-chip"
					class:active={categoryFilter === cat.key}
					onclick={() => {
						categoryFilter = cat.key;
						loadVerifications(1);
					}}>{cat.label}</button
				>
			{/each}
		</div>
		<label class="search-box" style="margin-left:auto">
			<span class="material-icons-round">search</span>
			<input
				type="search"
				placeholder="Folio, handle, email…"
				bind:value={searchQuery}
				oninput={onSearchInput}
			/>
		</label>
	</div>

	<!-- Grid de expedientes -->
	{#if loading}
		<div class="verif-grid">
			{#each Array(6) as _, i (i)}
				<div class="skeleton-shimmer skeleton-card"></div>
			{/each}
		</div>
	{:else if verifications.length === 0}
		<div class="glass-card">
			<div class="empty-state">
				<span class="material-icons-round">inbox</span>
				<p>No hay solicitudes en esta vista</p>
			</div>
		</div>
	{:else}
		<div class="verif-grid">
			{#each verifications as req (req.id)}
				{@const cat = categoryMap[req.category] || {
					label: req.category,
					icon: 'help',
					color: 'var(--aero-sky)'
				}}
				{@const sm = statusMeta(req.status)}
				<article class="glass-card verif-card">
					<header class="verif-head">
						<span class="folio">{req.folio}</span>
						<span class="status-badge {sm.cls}"><span class="dot"></span>{sm.label}</span>
					</header>
					<div class="verif-cat" style="color:{cat.color}">
						<span class="material-icons-round">{cat.icon}</span>
						{cat.label}
					</div>
					<div class="verif-applicant">
						<strong class="verif-handle">@{req.applicant_handle || req.username}</strong>
						<span class="muted-note">{req.legal_name || 'Nombre legal no aportado'}</span>
						<span class="muted-note">{req.user_email || req.contact_email}</span>
					</div>
					{#if parseJsonList(req.portfolio_links).length}
						<div class="verif-portfolio">
							{#each parseJsonList(req.portfolio_links).slice(0, 3) as link (link)}
								{@const badge = getDomainBadge(link)}
								<span class="portfolio-badge" title={link}>
									<span class="material-icons-round" style="font-size:13px">{badge.icon}</span>
									{badge.label}
								</span>
							{/each}
						</div>
					{/if}
					{#if canReview}
						<button class="btn-aero-secondary btn-sm" onclick={() => openModal(req)}>
							Inspeccionar expediente
						</button>
					{:else}
						<span class="muted-note">Solo personal de soporte/admin puede revisar.</span>
					{/if}
				</article>
			{/each}
		</div>

		<div class="pagination-bar">
			<button
				class="page-btn"
				disabled={page <= 1}
				onclick={() => loadVerifications(page - 1)}
				aria-label="Página anterior"
			>
				<span class="material-icons-round">chevron_left</span>
			</button>
			<span class="pagination-info">Página {page} de {totalPages}</span>
			<button
				class="page-btn"
				disabled={page >= totalPages}
				onclick={() => loadVerifications(page + 1)}
				aria-label="Página siguiente"
			>
				<span class="material-icons-round">chevron_right</span>
			</button>
		</div>
	{/if}
</div>

<!-- ══ Modal: inspector de expediente ══ -->
{#if selectedReq}
	<div
		class="modal-backdrop"
		transition:fade={{ duration: 150 }}
		onclick={(e) => e.target === e.currentTarget && closeModal()}
		role="presentation"
	>
		<div class="modal-panel wide" in:scale={{ duration: 200, start: 0.94, easing: backOut }}>
			<div class="modal-header">
				<h3>
					<span class="material-icons-round"
						>{(categoryMap[selectedReq.category] || { icon: 'help' }).icon}</span
					>
					{selectedReq.folio}
				</h3>
				<button class="modal-close" onclick={closeModal} aria-label="Cerrar">
					<span class="material-icons-round">close</span>
				</button>
			</div>
			<div class="modal-body" style="overflow-y: auto; max-height: 65vh;">
				<!-- Identidad -->
				<div class="insp-identity">
					<div>
						<strong>Solicitante:</strong> @{selectedReq.applicant_handle || selectedReq.username}
					</div>
					<div><strong>Nombre legal:</strong> {selectedReq.legal_name || '—'}</div>
					<div><strong>Especialidad:</strong> {selectedReq.specialty || '—'}</div>
					<div>
						<strong>Email:</strong>
						{selectedReq.user_email || selectedReq.contact_email || '—'}
					</div>
					<div><strong>ID de cuenta:</strong> #{selectedReq.user_id}</div>
					<div><strong>Radicada:</strong> {fmtDate(selectedReq.created_at)}</div>
				</div>

				<!-- Checklist obligatorio para aprobar -->
				<div class="insp-checklist" class:checklist-complete={checklistOk}>
					<h4>Lista del auditor {checklistOk ? '— completa' : '— requerida para aprobar'}</h4>
					{#each CHECKLIST as item (item.key)}
						<label class="check-item">
							<input
								type="checkbox"
								checked={item.bind()}
								onchange={(e) => item.set(e.currentTarget.checked)}
							/>
							<span>{item.label}</span>
						</label>
					{/each}
				</div>

				<!-- Portafolio -->
				{#if parseJsonList(selectedReq.portfolio_links).length}
					<div>
						<h4 class="insp-subtitle">Portafolio</h4>
						<div class="insp-links">
							{#each parseJsonList(selectedReq.portfolio_links) as link (link)}
								<a class="portfolio-badge" href={link} target="_blank" rel="noopener noreferrer">
									<span class="material-icons-round" style="font-size:13px"
										>{getDomainBadge(link).icon}</span
									>
									{getDomainBadge(link).label}
								</a>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Redes -->
				{#if Object.keys(parseJsonObject(selectedReq.social_links)).length}
					<div>
						<h4 class="insp-subtitle">Redes sociales</h4>
						<div class="insp-links">
							{#each Object.entries(parseJsonObject(selectedReq.social_links)) as [k, v] (k)}
								<a class="portfolio-badge" href={v} target="_blank" rel="noopener noreferrer">
									<span class="material-icons-round" style="font-size:13px"
										>{getDomainBadge(v).icon}</span
									>
									{k}
								</a>
							{/each}
						</div>
					</div>
				{/if}

				{#if selectedReq.id_document_url}
					<a
						class="portfolio-badge"
						href={selectedReq.id_document_url}
						target="_blank"
						rel="noopener noreferrer"
					>
						<span class="material-icons-round" style="font-size:13px">badge</span>
						Documento de identidad
					</a>
				{/if}

				<!-- Notas + presets de rechazo -->
				<div class="form-group">
					<label class="form-label" for="admin-notes">Notas de revisión</label>
					<textarea
						id="admin-notes"
						class="aero-input"
						rows="3"
						bind:value={adminNotes}
						placeholder="Notas visibles solo para el staff…"
					></textarea>
				</div>
				<div class="filter-chips">
					{#each rejectPresets as preset (preset)}
						<button class="filter-chip" type="button" onclick={() => (adminNotes = preset)}
							>{preset}</button
						>
					{/each}
				</div>
			</div>
			<div class="modal-footer">
				<button
					class="btn-aero-secondary"
					onclick={() => handleReview('reviewing')}
					disabled={processingAction}
				>
					{#if processingAction}<span class="material-icons-round spin" style="font-size:16px"
							>sync</span
						>{/if}
					En revisión
				</button>
				<button
					class="btn-aero-ghost"
					onclick={() => handleReview('rejected')}
					disabled={processingAction}
				>
					Rechazar
				</button>
				<button
					class="btn-aero-primary"
					onclick={() => handleReview('approved')}
					disabled={processingAction || !checklistOk}
					title={checklistOk ? '' : 'Completa la lista del auditor para aprobar'}
				>
					Aprobar &amp; otorgar insignia
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.neo-shadow {
		box-shadow: var(--shadow-md);
	}
	.verif-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 14px;
	}
	.verif-card {
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.verif-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.folio {
		font-family: var(--font-mono, monospace);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: var(--text-muted);
	}
	.verif-cat {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.82rem;
		font-weight: 700;
	}
	.verif-cat .material-icons-round {
		font-size: 17px;
	}
	.verif-applicant {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.verif-handle {
		font-size: 0.95rem;
		color: var(--text-primary);
	}
	.verif-portfolio,
	.insp-links {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.portfolio-badge {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 10px;
		border-radius: var(--radius-full);
		border: 1px solid var(--glass-border);
		background: var(--bg-overlay);
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--text-secondary);
		text-decoration: none;
		transition: all var(--t-base);
	}
	a.portfolio-badge:hover {
		border-color: var(--aero-sky);
		color: var(--aero-sky);
	}

	.insp-identity {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 6px 16px;
		font-size: 0.82rem;
		color: var(--text-secondary);
		padding: 12px;
		background: var(--bg-overlay);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
	}
	.insp-checklist {
		padding: 12px 14px;
		border-radius: var(--radius-md);
		border: 1px solid rgba(245, 166, 35, 0.4);
		background: rgba(245, 166, 35, 0.05);
	}
	.insp-checklist.checklist-complete {
		border-color: rgba(0, 212, 170, 0.45);
		background: rgba(0, 212, 170, 0.05);
	}
	.insp-checklist h4 {
		margin: 0 0 8px;
		font-size: 0.78rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
	}
	.check-item {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 5px 0;
		font-size: 0.84rem;
		color: var(--text-secondary);
		cursor: pointer;
	}
	.check-item input {
		accent-color: var(--aero-mint);
		width: 16px;
		height: 16px;
		margin-top: 2px;
	}
	.insp-subtitle {
		margin: 0 0 8px;
		font-size: 0.78rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
	}
</style>
