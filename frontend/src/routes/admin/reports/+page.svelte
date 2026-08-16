<script>
	import { onMount } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { admin as adminApi } from '$lib/api.js';

	let loading = $state(true);
	let reports = $state([]);
	let stats = $state({ pending: 0, resolved: 0, dismissed: 0, total: 0 });
	let statusFilter = $state('pending');
	let typeFilter = $state('all');
	let searchQuery = $state('');

	let actionError = $state('');
	let actionSuccess = $state('');

	// Disciplinary Strike Modal State
	let selectedReport = $state(null);
	let strikeLevel = $state(2); // default timeout 24h
	let strikeReason = $state('');
	let deleteContent = $state(true);
	let isSubmitting = $state(false);

	const entityIcons = {
		post: { icon: 'article', label: 'Publicación', color: 'var(--accent-blue-base)' },
		comment: { icon: 'chat_bubble', label: 'Comentario', color: 'var(--aero-sky)' },
		reel: { icon: 'movie', label: 'Reel / Video', color: 'var(--aero-coral)' },
		user: { icon: 'person', label: 'Perfil de Usuario', color: 'var(--aero-indigo)' }
	};

	const presetReasons = [
		'Spam reiterado y enlaces no autorizados',
		'Acoso, hostigamiento o insultos directos',
		'Contenido NSFW / Explícito sin etiquetar',
		'Infracción de derechos de autor / Suplantación',
		'Comportamiento perjudicial para la comunidad'
	];

	onMount(async () => {
		await loadReports();
	});

	async function loadReports() {
		loading = true;
		try {
			const params = {};
			if (statusFilter !== 'all') params.status = statusFilter;
			if (typeFilter !== 'all') params.type = typeFilter;
			if (searchQuery.trim()) params.q = searchQuery.trim();

			const res = await adminApi.reports.list(params);
			reports = res.reports || [];
			if (res.stats) {
				stats = res.stats;
			}
		} catch (e) {
			console.error(e);
			showError('Error al cargar la cola de moderación');
		} finally {
			loading = false;
		}
	}

	function showError(msg) {
		actionError = msg;
		setTimeout(() => (actionError = ''), 4500);
	}

	function showSuccess(msg) {
		actionSuccess = msg;
		setTimeout(() => (actionSuccess = ''), 4500);
	}

	async function handleQuickResolve(
		reportId,
		resolution,
		deleteMedia = false,
		entityType = null,
		entityId = null
	) {
		// Optimistic update: mark local report status and adjust stats
		const idx = reports.findIndex((r) => r.id === reportId);
		const prevReport = idx !== -1 ? { ...reports[idx] } : null;
		const prevStats = { ...stats };

		if (idx !== -1) {
			reports[idx].status = resolution;
			reports = [...reports];
		}
		if (statusFilter === 'pending' && stats.pending > 0) {
			stats.pending--;
			if (resolution === 'resolved') stats.resolved++;
			if (resolution === 'dismissed') stats.dismissed++;
			stats = { ...stats };
		}

		try {
			await adminApi.reports.resolve(reportId, {
				resolution,
				delete_content: deleteMedia,
				entity_type: entityType,
				entity_id: entityId
			});
			showSuccess(`Reporte marcado como ${resolution === 'resolved' ? 'resuelto' : 'descartado'}`);
			// Silent background refresh
			const params = {};
			if (statusFilter !== 'all') params.status = statusFilter;
			if (typeFilter !== 'all') params.type = typeFilter;
			if (searchQuery.trim()) params.q = searchQuery.trim();
			const res = await adminApi.reports.list(params);
			reports = res.reports || [];
			if (res.stats) stats = res.stats;
		} catch (e) {
			// Revert on error
			if (idx !== -1 && prevReport) {
				reports[idx] = prevReport;
				reports = [...reports];
			}
			stats = prevStats;
			showError(e.message || 'Error al procesar reporte');
		}
	}

	function openStrikeModal(report) {
		selectedReport = report;
		strikeLevel = 2;
		strikeReason = `Infracción en reporte #${report.id}: ${report.reason}`;
		deleteContent = true;
	}

	function closeStrikeModal() {
		selectedReport = null;
		strikeReason = '';
	}

	function setPresetReason(text) {
		strikeReason = text;
	}

	async function submitStrike() {
		if (!selectedReport) return;
		if (!selectedReport.target_author_id) {
			showError('No se pudo identificar al autor del contenido');
			return;
		}
		if (!strikeReason.trim()) {
			showError('Debe especificar un motivo para la sanción');
			return;
		}

		isSubmitting = true;
		const reportId = selectedReport.id;
		const targetAuthor = selectedReport.target_author_username;
		const entityType = selectedReport.entity_type;
		const entityId = selectedReport.entity_id;
		const shouldDelete = deleteContent;

		// Optimistic update
		const idx = reports.findIndex((r) => r.id === reportId);
		const prevReport = idx !== -1 ? { ...reports[idx] } : null;
		const prevStats = { ...stats };

		if (idx !== -1) {
			reports[idx].status = 'resolved';
			reports = [...reports];
		}
		if (statusFilter === 'pending' && stats.pending > 0) {
			stats.pending--;
			stats.resolved++;
			stats = { ...stats };
		}

		closeStrikeModal();

		try {
			// 1. Issue formal disciplinary strike
			await adminApi.strikes.issue({
				user_id: selectedReport.target_author_id,
				strike_level: strikeLevel,
				reason: strikeReason.trim(),
				report_id: reportId
			});

			// 2. Delete content if selected
			if (shouldDelete && entityType && entityId) {
				await adminApi.reports.resolve(reportId, {
					resolution: 'resolved',
					delete_content: true,
					entity_type: entityType,
					entity_id: entityId
				});
			}

			showSuccess(`Sanción aplicada con éxito al usuario @${targetAuthor}`);

			// Background sync
			const params = {};
			if (statusFilter !== 'all') params.status = statusFilter;
			if (typeFilter !== 'all') params.type = typeFilter;
			if (searchQuery.trim()) params.q = searchQuery.trim();
			const res = await adminApi.reports.list(params);
			reports = res.reports || [];
			if (res.stats) stats = res.stats;
		} catch (e) {
			if (idx !== -1 && prevReport) {
				reports[idx] = prevReport;
				reports = [...reports];
			}
			stats = prevStats;
			showError(e.message || 'Error al aplicar sanción disciplinaria');
		} finally {
			isSubmitting = false;
		}
	}

	let filteredReports = $derived(
		reports.filter((r) => {
			if (!searchQuery.trim()) return true;
			const q = searchQuery.toLowerCase();
			return (
				r.reason?.toLowerCase().includes(q) ||
				r.reporter_name?.toLowerCase().includes(q) ||
				r.target_author_username?.toLowerCase().includes(q) ||
				r.content_preview?.toLowerCase().includes(q)
			);
		})
	);
</script>

<svelte:head>
	<title>Reportes | VSocial Admin</title>
</svelte:head>

<!-- ── Standard Page Header ──────────────────────────────────────── -->
<div class="page-header">
	<div class="header-left">
		<div class="header-badge">
			<span class="material-icons-round badge-icon">security</span>
			<span>Centro de Confianza & Seguridad</span>
		</div>
		<h1 class="page-title">Cola de Moderación</h1>
		<p class="page-subtitle">
			Revisión de contenido reportado, sanciones disciplinarias y cumplimiento de normas
			comunitarias.
		</p>
	</div>
	<div class="header-right">
		<button
			onclick={loadReports}
			class="btn-aero-secondary"
			disabled={loading}
			title="Actualizar cola de moderación"
		>
			<span class="material-icons-round" class:animate-spin={loading}>refresh</span>
			<span>Actualizar Cola</span>
		</button>
	</div>
</div>

<!-- ── Main Page Content ──────────────────────────────────────────── -->
<div class="page-content">
	<!-- Action Alerts -->
	{#if actionError}
		<div class="alert-box error" in:fade={{ duration: 180 }}>
			<span class="material-icons-round">error_outline</span>
			<span class="alert-text">{actionError}</span>
		</div>
	{/if}

	{#if actionSuccess}
		<div class="alert-box success" in:fade={{ duration: 180 }}>
			<span class="material-icons-round">check_circle</span>
			<span class="alert-text">{actionSuccess}</span>
		</div>
	{/if}

	<!-- ── Metrics Grid (KPIs) ──────────────────────────────────────── -->
	<div class="metrics-grid">
		<div class="metric-card glass-card">
			<div
				class="metric-icon"
				style="background: rgba(232, 74, 114, 0.12); color: var(--aero-rose); border: 1px solid rgba(232, 74, 114, 0.25);"
			>
				<span class="material-icons-round">pending_actions</span>
			</div>
			<div class="metric-data">
				<p class="metric-value">{stats.pending}</p>
				<p class="metric-label" style="color: var(--aero-rose);">Pendientes</p>
			</div>
		</div>

		<div class="metric-card glass-card">
			<div
				class="metric-icon"
				style="background: rgba(0, 212, 170, 0.12); color: var(--aero-mint); border: 1px solid rgba(0, 212, 170, 0.25);"
			>
				<span class="material-icons-round">task_alt</span>
			</div>
			<div class="metric-data">
				<p class="metric-value">{stats.resolved}</p>
				<p class="metric-label" style="color: var(--aero-mint);">Resueltos</p>
			</div>
		</div>

		<div class="metric-card glass-card">
			<div
				class="metric-icon"
				style="background: rgba(255, 255, 255, 0.05); color: var(--text-muted); border: 1px solid var(--border-subtle);"
			>
				<span class="material-icons-round">do_not_disturb_on</span>
			</div>
			<div class="metric-data">
				<p class="metric-value">{stats.dismissed}</p>
				<p class="metric-label" style="color: var(--text-muted);">Descartados</p>
			</div>
		</div>

		<div class="metric-card glass-card">
			<div
				class="metric-icon"
				style="background: rgba(27, 133, 243, 0.12); color: var(--aero-sky); border: 1px solid rgba(27, 133, 243, 0.25);"
			>
				<span class="material-icons-round">query_stats</span>
			</div>
			<div class="metric-data">
				<p class="metric-value">{stats.total}</p>
				<p class="metric-label" style="color: var(--aero-sky);">Total Casos</p>
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
					placeholder="Filtrar por motivo, autor o denunciante..."
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
				{#each [{ id: 'pending', label: 'Pendientes', count: stats.pending, icon: 'pending_actions' }, { id: 'resolved', label: 'Resueltos', count: stats.resolved, icon: 'task_alt' }, { id: 'dismissed', label: 'Descartados', count: stats.dismissed, icon: 'block' }, { id: 'all', label: 'Todos', count: stats.total, icon: 'view_list' }] as tab}
					<button
						class="tab-btn"
						class:active={statusFilter === tab.id}
						onclick={() => {
							statusFilter = tab.id;
							loadReports();
						}}
					>
						<span class="material-icons-round tab-icon">{tab.icon}</span>
						<span class="tab-text">{tab.label}</span>
						<span class="tab-count-pill">{tab.count}</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- Entity Type Chips -->
		<div class="toolbar-bottom">
			<span class="filter-caption">Tipo:</span>
			<div class="chips-container">
				{#each [{ id: 'all', label: 'Todos los Tipos' }, { id: 'post', label: 'Publicaciones' }, { id: 'comment', label: 'Comentarios' }, { id: 'reel', label: 'Reels' }, { id: 'user', label: 'Usuarios' }] as chip}
					<button
						class="type-chip"
						class:active={typeFilter === chip.id}
						onclick={() => {
							typeFilter = chip.id;
							loadReports();
						}}
					>
						{chip.label}
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- ── Reports Feed List ────────────────────────────────────────── -->
	{#if loading}
		<div class="reports-list" in:fade={{ duration: 150 }}>
			{#each Array(4) as _, i}
				<div
					class="report-card glass-card skeleton-report-card"
					style="animation-delay: {i * 50}ms;"
				>
					<div class="report-main-info">
						<div class="report-top-bar">
							<div class="report-meta-badges">
								<div class="skeleton-shimmer skeleton-case-badge"></div>
								<div class="skeleton-shimmer skeleton-entity-pill"></div>
							</div>
							<div class="skeleton-shimmer skeleton-bar skeleton-w30"></div>
						</div>

						<div class="reason-box skeleton-reason-box">
							<div class="skeleton-shimmer skeleton-icon-box"></div>
							<div class="skeleton-content-col">
								<div class="skeleton-shimmer skeleton-bar skeleton-w40"></div>
								<div
									class="skeleton-shimmer skeleton-bar skeleton-w80"
									style="margin-top: 6px;"
								></div>
							</div>
						</div>

						<div class="infractor-card skeleton-infractor-card">
							<div class="infractor-header">
								<div class="author-dossier">
									<div class="avatar-wrapper sm skeleton-avatar-wrap">
										<div class="skeleton-shimmer skeleton-avatar"></div>
									</div>
									<div class="skeleton-content-col">
										<div class="skeleton-shimmer skeleton-bar skeleton-w60"></div>
										<div
											class="skeleton-shimmer skeleton-bar skeleton-w30"
											style="margin-top: 4px;"
										></div>
									</div>
								</div>
								<div class="skeleton-shimmer skeleton-link-placeholder"></div>
							</div>
							<div
								class="skeleton-shimmer skeleton-bar skeleton-w90"
								style="margin-top: 8px; height: 28px; border-radius: var(--radius-sm);"
							></div>
						</div>
					</div>

					<div class="report-actions-panel">
						<div class="skeleton-shimmer skeleton-action-btn primary"></div>
						<div class="skeleton-shimmer skeleton-action-btn"></div>
						<div class="skeleton-shimmer skeleton-action-btn ghost"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else if filteredReports.length === 0}
		<div class="empty-state glass-card" in:fade={{ duration: 200 }}>
			<div class="empty-icon-wrap">
				<span class="material-icons-round">verified_user</span>
			</div>
			<h3 class="empty-title">Bandeja de Moderación Despejada</h3>
			<p class="empty-subtitle">
				No hay reportes que requieran atención con los filtros seleccionados.
			</p>
		</div>
	{:else}
		<div class="reports-list">
			{#each filteredReports as report, i (report.id)}
				{@const entityMeta = entityIcons[report.entity_type] || entityIcons.post}
				<div
					class="report-card glass-card report-entrance"
					style="animation-delay: {Math.min(i * 40, 280)}ms;"
				>
					<!-- Main Information Dossier -->
					<div class="report-main-info">
						<!-- Top Badges Row -->
						<div class="report-top-bar">
							<div class="report-meta-badges">
								<span class="case-code">CASO #{report.id}</span>
								<span
									class="entity-pill"
									style="background: rgba(27, 133, 243, 0.12); color: {entityMeta.color}; border: 1px solid rgba(27, 133, 243, 0.25);"
								>
									<span class="material-icons-round entity-icon">{entityMeta.icon}</span>
									<span>{entityMeta.label} #{report.entity_id}</span>
								</span>
							</div>

							<div class="report-date-meta">
								<span class="status-pill status-{report.status}">
									{report.status === 'pending'
										? 'Pendiente'
										: report.status === 'resolved'
											? 'Resuelto'
											: 'Descartado'}
								</span>
								<span class="timestamp-text">
									{new Date(report.created_at).toLocaleString('es-ES', {
										day: '2-digit',
										month: 'short',
										hour: '2-digit',
										minute: '2-digit'
									})}
								</span>
							</div>
						</div>

						<!-- Report Reason Box -->
						<div class="reason-box">
							<span class="material-icons-round reason-alert-icon">report_problem</span>
							<div class="reason-content">
								<div class="reason-header">
									<strong class="reason-caption">Motivo Denunciado:</strong>
									<span class="reporter-tag"
										>Por: <strong>@{report.reporter_name || 'Anónimo'}</strong></span
									>
								</div>
								<p class="reason-text">{report.reason}</p>
							</div>
						</div>

						<!-- Target Author & Content Preview -->
						<div class="infractor-card">
							<div class="infractor-header">
								<div class="author-dossier">
									<div class="avatar-wrapper sm">
										{#if report.target_author_avatar}
											<img
												src={report.target_author_avatar}
												alt={report.target_author_username}
												class="infractor-avatar-img"
											/>
										{:else}
											<div class="infractor-avatar-fallback">
												{(report.target_author_username || '?')[0].toUpperCase()}
											</div>
										{/if}
									</div>

									<div>
										<div class="author-name-row">
											<span class="author-username"
												>@{report.target_author_username || 'Usuario Desconocido'}</span
											>
											{#if report.target_author_strikes > 0}
												<span class="strikes-count-pill">
													{report.target_author_strikes}
													{report.target_author_strikes === 1 ? 'Strike' : 'Strikes'}
												</span>
											{/if}
										</div>
										<span class="author-role-sub">Autor del contenido denunciado</span>
									</div>
								</div>

								{#if report.target_author_username}
									<a href="/u/{report.target_author_username}" target="_blank" class="profile-link">
										<span>Inspeccionar Perfil</span>
										<span class="material-icons-round">open_in_new</span>
									</a>
								{/if}
							</div>

							<!-- Content Preview Text -->
							{#if report.content_preview}
								<div class="content-preview-quote">
									"{report.content_preview}"
								</div>
							{:else}
								<p class="no-content-note">Sin texto disponible o contenido ya eliminado.</p>
							{/if}
						</div>
					</div>

					<!-- Moderation Action Panel -->
					<div class="report-actions-panel">
						{#if report.status === 'pending'}
							<button
								type="button"
								onclick={() => openStrikeModal(report)}
								class="btn-aero-primary strike-btn"
							>
								<span class="material-icons-round">gavel</span>
								<span>Sancionar & Resolver</span>
							</button>

							<button
								type="button"
								onclick={() =>
									handleQuickResolve(
										report.id,
										'resolved',
										true,
										report.entity_type,
										report.entity_id
									)}
								class="btn-aero-secondary quick-delete-btn"
							>
								<span class="material-icons-round">delete_outline</span>
								<span>Borrar sin Sanción</span>
							</button>

							<button
								type="button"
								onclick={() => handleQuickResolve(report.id, 'dismissed')}
								class="btn-aero-ghost dismiss-btn"
							>
								<span class="material-icons-round">do_not_disturb</span>
								<span>Descartar Reporte</span>
							</button>
						{:else}
							<div class="closed-case-pill">
								<span class="material-icons-round">check_circle</span>
								<p>Caso cerrado como <strong>{report.status}</strong></p>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- ── Disciplinary Strike Modal ──────────────────────────────────── -->
{#if selectedReport}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="modal-backdrop"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeStrikeModal();
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
						style="color: var(--aero-rose); border: 1px solid var(--aero-rose); background: rgba(232, 74, 114, 0.15);"
					>
						<span class="material-icons-round">gavel</span>
					</div>
					<div>
						<h3 class="modal-title">Dictamen Disciplinario</h3>
						<p class="modal-subtitle">
							Resolución formal para el Caso #{selectedReport.id}
						</p>
					</div>
				</div>

				<button
					type="button"
					onclick={closeStrikeModal}
					class="modal-close-btn"
					title="Cerrar ventana"
				>
					<span class="material-icons-round">close</span>
				</button>
			</div>

			<!-- Modal Scrollable Body -->
			<div class="modal-body">
				<!-- Target Infractor Box -->
				<div class="infractor-modal-card">
					<div class="infractor-user-side">
						<div class="avatar-wrapper sm">
							{#if selectedReport.target_author_avatar}
								<img
									src={selectedReport.target_author_avatar}
									alt={selectedReport.target_author_username}
									class="infractor-avatar-img"
								/>
							{:else}
								<div class="infractor-avatar-fallback">
									{(selectedReport.target_author_username || '?')[0].toUpperCase()}
								</div>
							{/if}
						</div>
						<div>
							<span class="box-caption">Infractor Identificado</span>
							<h4 class="dossier-username">
								@{selectedReport.target_author_username}
							</h4>
						</div>
					</div>

					<div class="history-side">
						<span class="box-caption">Historial</span>
						<span class="strike-history-count"
							>{selectedReport.target_author_strikes || 0} strikes previos</span
						>
					</div>
				</div>

				<!-- Strike Level Selection Grid -->
				<div class="section-block">
					<span class="form-label">Seleccionar Grado de Penalización:</span>
					<div class="strike-levels-grid">
						{#each [{ level: 1, title: 'Nivel 1: Advertencia', desc: 'Notificación oficial de amonestación sin restricciones.', icon: 'info' }, { level: 2, title: 'Nivel 2: Mute (24 Horas)', desc: 'Silencio total en posts, comentarios y mensajería por 1 día.', icon: 'timer' }, { level: 3, title: 'Nivel 3: Suspensión (7 Días)', desc: 'Bloqueo y cierre forzoso de sesiones durante 1 semana.', icon: 'gavel' }, { level: 4, title: 'Nivel 4: Baneo Permanente', desc: 'Expulsión definitiva y revocación de acceso a la plataforma.', icon: 'cancel' }] as opt}
							<button
								type="button"
								class="strike-option-card"
								class:active={strikeLevel === opt.level}
								onclick={() => (strikeLevel = opt.level)}
							>
								<div class="option-header">
									<span class="material-icons-round option-icon">{opt.icon}</span>
									<strong class="option-title">{opt.title}</strong>
								</div>
								<p class="option-desc">{opt.desc}</p>
							</button>
						{/each}
					</div>
				</div>

				<!-- Delete Content Checkbox -->
				<label class="delete-checkbox-card">
					<input type="checkbox" bind:checked={deleteContent} class="aero-checkbox-danger" />
					<div class="checkbox-text-block">
						<strong class="checkbox-title"
							>Eliminar inmediatamente el contenido denunciado ({selectedReport.entity_type})</strong
						>
						<span class="checkbox-sub"
							>El post/comentario desaparecerá de los feeds públicos de la plataforma.</span
						>
					</div>
				</label>

				<!-- Quick Preset Buttons -->
				<div class="section-block">
					<span class="box-caption">Plantillas de Motivo Rápido:</span>
					<div class="presets-wrap">
						{#each presetReasons as preset}
							<button type="button" class="preset-chip" onclick={() => setPresetReason(preset)}>
								{preset}
							</button>
						{/each}
					</div>
				</div>

				<!-- Strike Reason Textarea -->
				<div class="section-block">
					<label for="strike-reason-textarea-field" class="form-label">
						Motivo / Dictamen Oficial (Visible en la notificación al usuario):
					</label>
					<textarea
						id="strike-reason-textarea-field"
						rows="3"
						bind:value={strikeReason}
						class="aero-input textarea-field"
						placeholder="Describe con precisión la infracción a las normas de convivencia..."
					></textarea>
				</div>
			</div>

			<!-- Modal Footer: Actions -->
			<div class="modal-footer">
				<button type="button" onclick={closeStrikeModal} class="btn-aero-secondary">
					Cancelar
				</button>
				<button
					type="button"
					onclick={submitStrike}
					disabled={isSubmitting}
					class="btn-aero-danger submit-strike-btn"
				>
					<span class="material-icons-round">{isSubmitting ? 'sync' : 'gavel'}</span>
					<span>{isSubmitting ? 'Aplicando Sanción...' : 'Ejecutar Sanción Disciplinaria'}</span>
				</button>
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
		color: var(--aero-rose);
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
	@keyframes reportEntrance {
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

	.report-entrance {
		animation: reportEntrance 0.35s var(--ease-spring) backwards;
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

	.skeleton-report-card {
		opacity: 0.85;
		pointer-events: none;
		animation: reportEntrance 0.3s var(--ease-spring) backwards;
	}

	.skeleton-case-badge {
		width: 76px;
		height: 22px;
		border-radius: var(--radius-xs);
	}

	.skeleton-entity-pill {
		width: 110px;
		height: 22px;
		border-radius: var(--radius-full);
	}

	.skeleton-reason-box {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid var(--border-subtle);
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 12px 16px;
		border-radius: var(--radius-md);
	}

	.skeleton-icon-box {
		width: 20px;
		height: 20px;
		border-radius: var(--radius-xs);
		flex: 0 0 20px;
		min-width: 20px;
		min-height: 20px;
	}

	.skeleton-content-col {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.skeleton-infractor-card {
		padding: 14px 16px;
		border-radius: var(--radius-md);
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid var(--border-subtle);
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

	.skeleton-link-placeholder {
		width: 100px;
		height: 14px;
		border-radius: var(--radius-xs);
	}

	.skeleton-action-btn {
		width: 100%;
		height: 38px;
		border-radius: var(--radius-md);
	}

	.skeleton-action-btn.primary {
		height: 42px;
	}

	.skeleton-action-btn.ghost {
		height: 34px;
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
	.skeleton-w90 {
		width: 90%;
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
		animation: reportEntrance 0.35s var(--ease-spring);
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

	/* ── Reports List ──────────────────────────────────── */
	.reports-list {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.report-card {
		padding: 24px;
		border-radius: var(--radius-xl);
		display: flex;
		align-items: stretch;
		justify-content: space-between;
		gap: 24px;
		transition:
			transform var(--t-spring),
			box-shadow var(--t-base),
			border-color var(--t-base);
		will-change: transform, opacity;
		contain: layout style paint;
		transform: translateZ(0);
	}
	.report-card:hover {
		border-color: rgba(255, 255, 255, 0.2);
		box-shadow: var(--shadow-md);
	}

	.report-main-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 14px;
		min-width: 0;
	}

	.report-top-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		border-bottom: 1px solid var(--border-subtle);
		padding-bottom: 12px;
		flex-wrap: wrap;
	}
	.report-meta-badges {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.case-code {
		font-size: 0.76rem;
		font-family: monospace;
		font-weight: 700;
		padding: 2px 8px;
		border-radius: var(--radius-xs);
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid var(--border-subtle);
		color: var(--text-muted);
	}
	.entity-pill {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 2px 10px;
		border-radius: var(--radius-full);
		font-size: 0.74rem;
		font-weight: 700;
	}
	.entity-icon {
		font-size: 14px;
	}

	.report-date-meta {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.timestamp-text {
		font-size: 0.72rem;
		color: var(--text-muted);
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
		background: rgba(232, 74, 114, 0.15);
		border: 1px solid rgba(232, 74, 114, 0.35);
		color: var(--aero-rose);
	}
	.status-pill.status-resolved {
		background: rgba(0, 212, 170, 0.15);
		border: 1px solid rgba(0, 212, 170, 0.35);
		color: var(--aero-mint);
	}
	.status-pill.status-dismissed {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid var(--border-subtle);
		color: var(--text-muted);
	}

	/* Reason Box */
	.reason-box {
		padding: 12px 16px;
		border-radius: var(--radius-md);
		background: rgba(232, 74, 114, 0.08);
		border: 1px solid rgba(232, 74, 114, 0.22);
		display: flex;
		align-items: flex-start;
		gap: 12px;
		font-size: 0.82rem;
	}
	.reason-alert-icon {
		font-size: 20px;
		color: var(--aero-rose);
		margin-top: 1px;
		flex-shrink: 0;
	}
	.reason-content {
		flex: 1;
		min-width: 0;
	}
	.reason-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 2px;
	}
	.reason-caption {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--aero-rose);
	}
	.reporter-tag {
		font-size: 0.72rem;
		color: var(--text-muted);
	}
	.reporter-tag strong {
		color: var(--text-primary);
	}
	.reason-text {
		color: var(--text-primary);
		font-weight: 500;
		line-height: 1.4;
		margin: 0;
	}

	/* Infractor and content preview card */
	.infractor-card {
		padding: 14px 16px;
		border-radius: var(--radius-md);
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.infractor-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.author-dossier {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.avatar-wrapper {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		overflow: hidden;
		flex: 0 0 44px;
		min-width: 44px;
		min-height: 44px;
		background: var(--grad-primary);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.avatar-wrapper.sm {
		width: 36px;
		height: 36px;
		flex: 0 0 36px;
		min-width: 36px;
		min-height: 36px;
	}
	.infractor-avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.infractor-avatar-fallback {
		color: #fff;
		font-weight: 800;
		font-size: 0.95rem;
	}
	.author-name-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.author-username {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--text-primary);
	}
	.strikes-count-pill {
		font-size: 0.66rem;
		font-weight: 800;
		padding: 2px 7px;
		border-radius: var(--radius-full);
		background: rgba(245, 166, 35, 0.18);
		border: 1px solid rgba(245, 166, 35, 0.35);
		color: var(--aero-amber);
	}
	.author-role-sub {
		font-size: 0.68rem;
		color: var(--text-muted);
		display: block;
	}

	.profile-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--aero-sky);
		text-decoration: none;
		font-size: 0.74rem;
		font-weight: 600;
	}
	.profile-link:hover {
		text-decoration: underline;
	}
	.profile-link .material-icons-round {
		font-size: 14px;
	}

	.content-preview-quote {
		padding: 10px 12px;
		border-radius: var(--radius-sm);
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--border-subtle);
		font-size: 0.8rem;
		color: var(--text-secondary);
		font-style: italic;
		line-height: 1.45;
	}
	.no-content-note {
		font-size: 0.74rem;
		color: var(--text-muted);
		font-style: italic;
		margin: 0;
	}

	/* Right Action Panel */
	.report-actions-panel {
		width: 230px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 10px;
		border-left: 1px solid var(--border-subtle);
		padding-left: 20px;
	}
	.strike-btn {
		width: 100%;
		padding: 10px 16px;
		font-size: 0.82rem;
		background: linear-gradient(135deg, #e84a72 0%, #1b85f3 100%);
		box-shadow: 0 4px 18px rgba(232, 74, 114, 0.3);
	}
	.quick-delete-btn {
		width: 100%;
		padding: 8px 14px;
		font-size: 0.8rem;
		border-radius: var(--radius-md);
	}
	.quick-delete-btn:hover {
		color: var(--aero-rose);
		border-color: rgba(232, 74, 114, 0.4);
	}
	.dismiss-btn {
		width: 100%;
		padding: 8px 14px;
		font-size: 0.8rem;
		border-radius: var(--radius-md);
	}

	.closed-case-pill {
		padding: 16px;
		border-radius: var(--radius-md);
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--border-subtle);
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		color: var(--text-muted);
		font-size: 0.78rem;
	}
	.closed-case-pill .material-icons-round {
		font-size: 24px;
		color: var(--aero-mint);
	}
	.closed-case-pill strong {
		color: var(--text-primary);
		text-transform: capitalize;
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
		max-width: 620px;
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
	.modal-title {
		font-size: 1.15rem;
		font-weight: 800;
		font-family: var(--font-display);
		color: var(--text-primary);
		margin: 0;
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
		gap: 18px;
	}

	.infractor-modal-card {
		padding: 14px 18px;
		border-radius: var(--radius-lg);
		background: rgba(0, 0, 0, 0.22);
		border: 1px solid var(--border-subtle);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.infractor-user-side {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.box-caption {
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		display: block;
	}
	.dossier-username {
		font-size: 0.92rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 2px 0 0;
	}
	.history-side {
		text-align: right;
	}
	.strike-history-count {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--aero-amber);
		display: block;
		margin-top: 2px;
	}

	.section-block {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.form-label {
		font-size: 0.76rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary);
		display: block;
	}

	/* Strike level cards */
	.strike-levels-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	@media (max-width: 580px) {
		.strike-levels-grid {
			grid-template-columns: 1fr;
		}
	}
	.strike-option-card {
		padding: 12px 14px;
		border-radius: var(--radius-md);
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid var(--border-subtle);
		text-align: left;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 4px;
		transition: all var(--t-fast);
	}
	.strike-option-card:hover {
		background: rgba(255, 255, 255, 0.06);
		border-color: rgba(255, 255, 255, 0.18);
	}
	.strike-option-card.active {
		background: rgba(27, 133, 243, 0.15);
		border-color: var(--accent-blue-base);
		box-shadow: 0 0 12px rgba(27, 133, 243, 0.25);
	}
	.option-header {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.option-icon {
		font-size: 16px;
		color: var(--text-muted);
	}
	.strike-option-card.active .option-icon {
		color: var(--aero-sky);
	}
	.option-title {
		font-size: 0.78rem;
		color: var(--text-primary);
	}
	.option-desc {
		font-size: 0.7rem;
		color: var(--text-muted);
		line-height: 1.35;
		margin: 0;
	}

	/* Delete Content Checkbox */
	.delete-checkbox-card {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 12px 16px;
		border-radius: var(--radius-md);
		background: rgba(232, 74, 114, 0.06);
		border: 1px solid rgba(232, 74, 114, 0.2);
		cursor: pointer;
		transition: background var(--t-fast);
	}
	.delete-checkbox-card:hover {
		background: rgba(232, 74, 114, 0.1);
	}
	.aero-checkbox-danger {
		accent-color: var(--aero-rose);
		margin-top: 2px;
		cursor: pointer;
	}
	.checkbox-text-block {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.checkbox-title {
		font-size: 0.78rem;
		color: var(--text-primary);
	}
	.checkbox-sub {
		font-size: 0.7rem;
		color: var(--text-muted);
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
		justify-content: flex-end;
		gap: 12px;
	}
	.submit-strike-btn {
		padding: 9px 20px;
		font-size: 0.82rem;
		background: linear-gradient(135deg, #e84a72 0%, #1b85f3 100%);
		box-shadow: 0 4px 18px rgba(232, 74, 114, 0.3);
	}

	/* ── Responsive ────────────────────────────────────── */
	@media (max-width: 860px) {
		.report-card {
			flex-direction: column;
		}
		.report-actions-panel {
			width: 100%;
			border-left: none;
			border-top: 1px solid var(--border-subtle);
			padding-left: 0;
			padding-top: 16px;
			flex-direction: row;
			flex-wrap: wrap;
		}
		.strike-btn,
		.quick-delete-btn,
		.dismiss-btn {
			flex: 1;
			min-width: 160px;
		}
	}

	@media (max-width: 768px) {
		.page-header {
			flex-direction: column;
			align-items: flex-start;
			padding: 20px;
		}
		.page-content {
			padding: 20px;
		}
		.report-actions-panel {
			flex-direction: column;
		}
		.strike-btn,
		.quick-delete-btn,
		.dismiss-btn {
			width: 100%;
		}
	}
</style>
