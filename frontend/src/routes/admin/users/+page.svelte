<script>
	import { onMount } from 'svelte';
	import { admin as adminApi } from '$lib/api.js';
	import { uiStore } from '$lib/stores/ui.svelte.js';
	import CustomSelect from '$lib/components/CustomSelect.svelte';
	import AeroAvatar from '$lib/components/AeroAvatar.svelte';
	import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';
	import { fade, scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';

	let { data } = $props();
	const staff = $derived(data.staff);
	// Solo admin (permiso users.manage) gestiona cuentas; soporte/moderador consultan.
	const canManage = $derived(staff.permissions.includes('users.manage'));

	// Jerarquía espejo de lib/server/roles.js para pintar solo opciones válidas.
	const ROLE_LEVELS = {
		user: 0,
		team: 10,
		staff: 10,
		support: 20,
		moderator: 30,
		admin: 40,
		super_admin: 50
	};
	const ROLE_LABELS = {
		user: 'Usuario',
		team: 'Equipo Voom!',
		staff: 'Staff',
		support: 'Soporte',
		moderator: 'Moderador',
		admin: 'Administrador',
		super_admin: 'Super Admin'
	};
	function canGrant(to) {
		const level = ROLE_LEVELS[staff.role] ?? 0;
		if (level < 40) return false;
		if (to === 'super_admin') return staff.role === 'super_admin';
		if (to === 'admin') return staff.role === 'super_admin';
		return (ROLE_LEVELS[to] ?? 0) < level;
	}
	const assignableRoles = ['user', 'team', 'support', 'moderator', 'admin', 'super_admin'];
	const grantableRoleOptions = $derived(
		assignableRoles.filter(canGrant).map((r) => ({ value: r, label: ROLE_LABELS[r] }))
	);

	// ── Listado ──
	let loading = $state(true);
	let listError = $state('');
	let users = $state([]);
	let searchQuery = $state('');
	let page = $state(1);
	let totalPages = $state(1);
	let roleFilter = $state('');
	let statusFilter = $state('');

	const roleFilterOptions = [
		{ value: '', label: 'Todos los roles' },
		{ value: 'user', label: 'Usuarios' },
		{ value: 'team', label: 'Equipo Voom!' },
		{ value: 'support', label: 'Soporte' },
		{ value: 'moderator', label: 'Moderadores' },
		{ value: 'admin', label: 'Administradores' },
		{ value: 'super_admin', label: 'Super Admins' }
	];
	const statusFilterOptions = [
		{ value: '', label: 'Todos los estados' },
		{ value: 'active', label: 'Activos' },
		{ value: 'inactive', label: 'Desactivados' },
		{ value: 'banned', label: 'Baneados' }
	];

	async function loadUsers(p = page) {
		loading = true;
		listError = '';
		try {
			const params = { q: searchQuery, page: p, limit: 20 };
			if (roleFilter) params.role = roleFilter;
			if (statusFilter) params.status = statusFilter;
			const res = await adminApi.users.list(params);
			users = res.users || [];
			page = res.page;
			totalPages = Math.ceil(res.total / res.limit) || 1;
		} catch (e) {
			listError = e?.message || 'Error cargando usuarios.';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadUsers(1);
	});

	let searchTimeout;
	function onSearchInput() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => loadUsers(1), 400);
	}

	function actionError(msg) {
		listError = msg;
		setTimeout(() => (listError = ''), 4000);
	}

	// ── Acciones por fila ──
	async function toggleBan(user) {
		if (user.is_banned == 1) {
			await runAction(
				user,
				(u) => adminApi.users.unban(u.id),
				() => {
					user.is_banned = 0;
					user.is_active = 1;
				}
			);
		} else {
			const ok = await uiStore.requestConfirm({
				title: 'Banear usuario',
				message: `@${user.username} perderá el acceso a la plataforma de inmediato. ¿Confirmar?`,
				danger: true,
				confirmText: 'Banear'
			});
			if (!ok) return;
			await runAction(
				user,
				(u) => adminApi.users.ban(u.id),
				() => {
					user.is_banned = 1;
					user.is_active = 0;
				}
			);
		}
	}

	async function toggleDisable(user) {
		const deactivating = user.is_active == 1;
		if (deactivating) {
			await runAction(
				user,
				(u) => adminApi.users.disable(u.id),
				() => (user.is_active = 0)
			);
		} else {
			await runAction(
				user,
				(u) => adminApi.users.enable(u.id),
				() => (user.is_active = 1)
			);
		}
	}

	async function runAction(user, call, apply) {
		const snapshot = { is_banned: user.is_banned, is_active: user.is_active };
		apply(user);
		users = [...users];
		try {
			await call(user);
		} catch (e) {
			user.is_banned = snapshot.is_banned;
			user.is_active = snapshot.is_active;
			users = [...users];
			actionError(e?.message || 'No se pudo aplicar la acción.');
		}
	}

	async function changeUserRole(user, newRole) {
		if (user.id === 1 || user.id === staff.id) return;
		// El select sigue mostrando el rol actual hasta confirmar; si se
		// cancela, incrementamos _rv para re-montarlo con el valor real.
		if (newRole === user.effective_role) {
			user._rv = (user._rv ?? 0) + 1;
			users = [...users];
			return;
		}
		const ok = await uiStore.requestConfirm({
			title: 'Cambiar rol',
			message: `@${user.username} pasará de ${ROLE_LABELS[user.effective_role] || user.effective_role} a ${ROLE_LABELS[newRole] || newRole}.`,
			confirmText: 'Cambiar'
		});
		if (!ok) {
			user._rv = (user._rv ?? 0) + 1;
			users = [...users];
			return;
		}
		const oldRole = user.effective_role;
		user.effective_role = newRole;
		user.role = newRole;
		users = [...users];
		try {
			await adminApi.users.update(user.id, { role: newRole });
		} catch (e) {
			user.effective_role = oldRole;
			user.role = oldRole;
			user._rv = (user._rv ?? 0) + 1;
			users = [...users];
			actionError(e?.message || 'Error al cambiar rol.');
		}
	}

	async function toggleVerify(user) {
		const snapshot = user.is_verified;
		user.is_verified = snapshot == 1 ? 0 : 1;
		users = [...users];
		try {
			await adminApi.users.update(user.id, { is_verified: user.is_verified });
		} catch (e) {
			user.is_verified = snapshot;
			users = [...users];
			actionError(e?.message || 'Error al cambiar verificación.');
		}
	}

	async function removeUser(user) {
		const ok = await uiStore.requestConfirm({
			title: 'Eliminar usuario',
			message: `Se eliminará definitivamente a @${user.username} y todo su contenido. Esta acción no se puede deshacer.`,
			danger: true,
			confirmText: 'Eliminar'
		});
		if (!ok) return;
		try {
			await adminApi.users.delete(user.id);
			users = users.filter((u) => u.id !== user.id);
			if (users.length === 0 && page > 1) loadUsers(page - 1);
		} catch (e) {
			actionError(e?.message || 'Error al eliminar usuario.');
		}
	}

	// ── Sanciones ──
	const STRIKE_LEVELS = [
		{
			level: 1,
			icon: 'warning',
			title: 'Advertencia',
			desc: 'Aviso oficial registrado en su historial.'
		},
		{
			level: 2,
			icon: 'voice_over_off',
			title: 'Silencio 24h',
			desc: 'No podrá publicar ni comentar por 24 horas.'
		},
		{
			level: 3,
			icon: 'block',
			title: 'Suspensión 7 días',
			desc: 'Cuenta desactivada temporalmente.'
		},
		{ level: 4, icon: 'gavel', title: 'Ban permanente', desc: 'Pérdida definitiva del acceso.' }
	];
	let userToStrike = $state(null);
	let strikeLevel = $state(2);
	let strikeReason = $state('');
	let issuingStrike = $state(false);

	function openStrikeModal(user) {
		userToStrike = user;
		strikeLevel = 2;
		strikeReason = '';
	}

	async function executeStrike() {
		if (!strikeReason.trim()) {
			actionError('Debe especificar un motivo para la sanción.');
			return;
		}
		issuingStrike = true;
		try {
			await adminApi.strikes.issue({
				user_id: userToStrike.id,
				strike_level: strikeLevel,
				reason: strikeReason.trim()
			});
			userToStrike = null;
			loadUsers();
		} catch (e) {
			actionError(e?.message || 'Error al aplicar sanción.');
		} finally {
			issuingStrike = false;
		}
	}

	// ── Ficha de usuario ──
	let showDetail = $state(false);
	let detailLoading = $state(false);
	let detail = $state(null);

	async function openDetail(user) {
		showDetail = true;
		detailLoading = true;
		detail = null;
		try {
			detail = await adminApi.users.get(user.id);
		} catch (e) {
			actionError(e?.message || 'No se pudo cargar la ficha.');
			showDetail = false;
		} finally {
			detailLoading = false;
		}
	}

	// ── Crear usuario ──
	let showCreate = $state(false);
	let creatingUser = $state(false);
	let newUser = $state({ username: '', email: '', password: '', role: 'user' });

	async function createUser() {
		creatingUser = true;
		try {
			await adminApi.users.create(newUser);
			showCreate = false;
			newUser = { username: '', email: '', password: '', role: 'user' };
			await loadUsers(1);
		} catch (e) {
			actionError(e?.message || 'Error al crear usuario.');
		} finally {
			creatingUser = false;
		}
	}

	function fmtDate(raw) {
		if (!raw) return '—';
		const s = String(raw).trim();
		const iso = (s.includes('T') ? s : s.replace(' ', 'T')).replace(/Z?$/, 'Z');
		const d = new Date(iso);
		return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('es-ES');
	}

	function statusOf(u) {
		if (u.is_banned == 1) return { key: 'is-banned', label: 'Baneado' };
		if (u.is_active == 0) return { key: 'is-inactive', label: 'Desactivado' };
		return { key: 'is-active', label: 'Activo' };
	}

	function rowRoleOptions(user) {
		// Opciones del selector inline: incluye el rol actual + los que puede otorgar.
		const options = grantableRoleOptions.map((o) => o.value);
		if (!options.includes(user.effective_role)) {
			return [
				{
					value: user.effective_role,
					label: ROLE_LABELS[user.effective_role] || user.effective_role
				}
			];
		}
		return grantableRoleOptions;
	}
</script>

<svelte:head>
	<title>Usuarios | Voom! Staff</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title"><span class="material-icons-round">people</span> Usuarios</h1>
	<p class="page-subtitle">
		{canManage
			? 'Gestiona cuentas, roles y estado de los miembros de la plataforma.'
			: 'Consulta perfiles, historial de sanciones y reportes de cualquier cuenta.'}
	</p>
</div>

<div class="page-content">
	{#if listError}
		<div class="alert-box error" role="alert">
			<span class="material-icons-round">error</span>
			<span style="flex:1">{listError}</span>
			<button class="btn-aero-secondary btn-sm" onclick={() => loadUsers(page)}>Reintentar</button>
		</div>
	{/if}

	<div class="glass-panel admin-toolbar neo-shadow">
		<label class="search-box">
			<span class="material-icons-round">search</span>
			<input
				type="search"
				placeholder="Buscar por nombre, usuario o email…"
				bind:value={searchQuery}
				oninput={onSearchInput}
			/>
		</label>
		<CustomSelect
			options={roleFilterOptions}
			bind:value={roleFilter}
			onchange={() => loadUsers(1)}
			fullWidth={false}
		/>
		<CustomSelect
			options={statusFilterOptions}
			bind:value={statusFilter}
			onchange={() => loadUsers(1)}
			fullWidth={false}
		/>
		{#if canManage}
			<button
				class="btn-aero-primary btn-sm"
				onclick={() => (showCreate = true)}
				style="margin-left:auto"
			>
				<span class="material-icons-round" style="font-size:16px">person_add</span>
				Crear cuenta
			</button>
		{/if}
	</div>

	<div class="glass-card table-card">
		{#if loading}
			<div style="padding:20px">
				{#each Array(6) as _, i (i)}
					<div class="skeleton-shimmer skeleton-row"></div>
				{/each}
			</div>
		{:else if users.length === 0}
			<div class="empty-state">
				<span class="material-icons-round">person_search</span>
				<p>Sin resultados</p>
				<p class="empty-hint">Prueba con otro término de búsqueda o cambia los filtros.</p>
			</div>
		{:else}
			<div class="table-responsive">
				<table class="aero-table">
					<thead>
						<tr>
							<th>Usuario</th>
							<th>Rol</th>
							<th>Estado</th>
							<th>Sanciones</th>
							<th>Registro</th>
							<th style="text-align:right">Acciones</th>
						</tr>
					</thead>
					<tbody>
						{#each users as user (user.id)}
							{@const isPrincipal = user.id === 1}
							{@const isSelf = user.id === staff.id}
							{@const st = statusOf(user)}
							<tr>
								<td>
									<div class="cell-user">
										<div style="flex: 0 0 44px; min-width: 44px; min-height: 44px">
											<AeroAvatar
												src={user.avatar_url}
												alt={user.username}
												size="sm"
												showPresence={false}
											/>
										</div>
										<div class="cell-user-main">
											<div class="cell-user-name">
												{user.display_name || user.username}
												<VerifiedBadge
													role={user.effective_role}
													isVerified={user.is_verified == 1}
													size="13px"
												/>
											</div>
											<div class="cell-user-sub">
												@{user.username}{isPrincipal
													? ' · cuenta principal'
													: isSelf
														? ' · tú'
														: ''}
											</div>
										</div>
									</div>
								</td>
								<td>
									{#if canManage && !isPrincipal && !isSelf && grantableRoleOptions.length}
										{#key `${user.id}:${user.effective_role}:${user._rv ?? 0}`}
											<CustomSelect
												options={rowRoleOptions(user)}
												value={user.effective_role}
												onchange={(v) => changeUserRole(user, v)}
												size="sm"
												fullWidth={false}
											/>
										{/key}
									{:else}
										<span class="role-chip" data-role={user.effective_role}
											>{ROLE_LABELS[user.effective_role] || user.effective_role}</span
										>
									{/if}
								</td>
								<td
									><span class="status-badge {st.key}"><span class="dot"></span>{st.label}</span
									></td
								>
								<td>
									{#if user.strike_count > 0}
										<span class="status-badge is-banned"
											><span class="dot"></span>{user.strike_count}</span
										>
									{:else}
										<span class="muted-note">—</span>
									{/if}
								</td>
								<td>{fmtDate(user.created_at)}</td>
								<td>
									<div class="row-actions">
										<button class="icon-btn" title="Ver ficha" onclick={() => openDetail(user)}>
											<span class="material-icons-round">plagiarism</span>
										</button>
										{#if canManage && !isPrincipal && !isSelf}
											<button
												class="icon-btn"
												title={user.is_verified == 1 ? 'Quitar insignia' : 'Otorgar insignia'}
												onclick={() => toggleVerify(user)}
											>
												<span class="material-icons-round"
													>{user.is_verified == 1 ? 'verified_off' : 'verified'}</span
												>
											</button>
											<button
												class="icon-btn"
												title="Sancionar"
												onclick={() => openStrikeModal(user)}
											>
												<span class="material-icons-round">gavel</span>
											</button>
											<button
												class="icon-btn"
												title={user.is_active == 1 ? 'Desactivar' : 'Reactivar'}
												onclick={() => toggleDisable(user)}
											>
												<span class="material-icons-round"
													>{user.is_active == 1 ? 'person_off' : 'person_check'}</span
												>
											</button>
											<button
												class="icon-btn"
												title={user.is_banned == 1 ? 'Levantar ban' : 'Banear'}
												onclick={() => toggleBan(user)}
											>
												<span class="material-icons-round"
													>{user.is_banned == 1 ? 'lock_open' : 'block'}</span
												>
											</button>
											<button
												class="icon-btn danger"
												title="Eliminar cuenta"
												onclick={() => removeUser(user)}
											>
												<span class="material-icons-round">delete</span>
											</button>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="pagination-bar">
				<button
					class="page-btn"
					disabled={page <= 1}
					onclick={() => loadUsers(page - 1)}
					aria-label="Página anterior"
				>
					<span class="material-icons-round">chevron_left</span>
				</button>
				<span class="pagination-info">Página {page} de {totalPages}</span>
				<button
					class="page-btn"
					disabled={page >= totalPages}
					onclick={() => loadUsers(page + 1)}
					aria-label="Página siguiente"
				>
					<span class="material-icons-round">chevron_right</span>
				</button>
			</div>
		{/if}
	</div>
</div>

<!-- ══ Modal: crear cuenta ══ -->
{#if showCreate}
	<div
		class="modal-backdrop"
		transition:fade={{ duration: 150 }}
		onclick={(e) => e.target === e.currentTarget && (showCreate = false)}
		role="presentation"
		aria-label="Crear cuenta"
	>
		<div class="modal-panel" in:scale={{ duration: 200, start: 0.94, easing: backOut }}>
			<div class="modal-header">
				<h3><span class="material-icons-round">person_add</span> Crear cuenta</h3>
				<button class="modal-close" onclick={() => (showCreate = false)} aria-label="Cerrar">
					<span class="material-icons-round">close</span>
				</button>
			</div>
			<div class="modal-body">
				<div class="form-group">
					<label class="form-label" for="nu-username">Usuario</label>
					<input
						id="nu-username"
						class="aero-input"
						bind:value={newUser.username}
						placeholder="nombre_usuario"
					/>
				</div>
				<div class="form-group">
					<label class="form-label" for="nu-email">Email</label>
					<input
						id="nu-email"
						class="aero-input"
						type="email"
						bind:value={newUser.email}
						placeholder="correo@ejemplo.com"
					/>
				</div>
				<div class="form-group">
					<label class="form-label" for="nu-pass">Contraseña</label>
					<input
						id="nu-pass"
						class="aero-input"
						type="password"
						bind:value={newUser.password}
						placeholder="Mínimo 8 caracteres"
					/>
				</div>
				{#if grantableRoleOptions.length > 1}
					<div class="form-group">
						<span class="form-label">Rol inicial</span>
						<CustomSelect options={grantableRoleOptions} bind:value={newUser.role} />
					</div>
				{/if}
			</div>
			<div class="modal-footer">
				<button class="btn-aero-ghost" onclick={() => (showCreate = false)}>Cancelar</button>
				<button class="btn-aero-primary" onclick={createUser} disabled={creatingUser}>
					{#if creatingUser}<span class="material-icons-round spin" style="font-size:16px"
							>sync</span
						>{/if}
					Crear
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- ══ Modal: sanción disciplinaria ══ -->
{#if userToStrike}
	<div
		class="modal-backdrop"
		transition:fade={{ duration: 150 }}
		onclick={(e) => e.target === e.currentTarget && (userToStrike = null)}
		role="presentation"
		aria-label="Aplicar sanción"
	>
		<div class="modal-panel" in:scale={{ duration: 200, start: 0.94, easing: backOut }}>
			<div class="modal-header">
				<h3>
					<span class="material-icons-round">gavel</span> Sancionar a @{userToStrike.username}
				</h3>
				<button class="modal-close" onclick={() => (userToStrike = null)} aria-label="Cerrar">
					<span class="material-icons-round">close</span>
				</button>
			</div>
			<div class="modal-body">
				<div class="strike-grid">
					{#each STRIKE_LEVELS as sl (sl.level)}
						<button
							class="strike-card"
							class:selected={strikeLevel === sl.level}
							onclick={() => (strikeLevel = sl.level)}
							type="button"
						>
							<span class="material-icons-round">{sl.icon}</span>
							<strong>{sl.title}</strong>
							<small>{sl.desc}</small>
						</button>
					{/each}
				</div>
				<div class="form-group">
					<label class="form-label" for="strike-reason">Motivo (obligatorio)</label>
					<textarea
						id="strike-reason"
						class="aero-input strike-reason-input"
						rows="3"
						bind:value={strikeReason}
						placeholder="Describe la infracción…"
					></textarea>
				</div>
			</div>
			<div class="modal-footer">
				<button class="btn-aero-ghost" onclick={() => (userToStrike = null)}>Cancelar</button>
				<button
					class="btn-aero-danger"
					onclick={executeStrike}
					disabled={issuingStrike || !strikeReason.trim()}
				>
					{#if issuingStrike}<span class="material-icons-round spin" style="font-size:16px"
							>sync</span
						>{/if}
					Aplicar sanción
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- ══ Modal: ficha de usuario ══ -->
{#if showDetail}
	<div
		class="modal-backdrop"
		transition:fade={{ duration: 150 }}
		onclick={(e) => e.target === e.currentTarget && (showDetail = false)}
		role="presentation"
		aria-label="Ficha de usuario"
	>
		<div class="modal-panel wide" in:scale={{ duration: 200, start: 0.94, easing: backOut }}>
			<div class="modal-header">
				<h3><span class="material-icons-round">plagiarism</span> Ficha de usuario</h3>
				<button class="modal-close" onclick={() => (showDetail = false)} aria-label="Cerrar">
					<span class="material-icons-round">close</span>
				</button>
			</div>
			<div class="modal-body" style="overflow-y: auto; max-height: 65vh;">
				{#if detailLoading}
					<div class="skeleton-shimmer" style="height:220px"></div>
				{:else if detail?.user}
					{@const u = detail.user}
					<div class="detail-head">
						<div style="flex: 0 0 48px; min-width: 48px; min-height: 48px">
							<AeroAvatar src={u.avatar_url} alt={u.username} size="lg" showPresence={false} />
						</div>
						<div>
							<div class="cell-user-name" style="font-size:1.05rem">
								{u.display_name || u.username}
								<VerifiedBadge
									role={u.effective_role}
									isVerified={u.is_verified == 1}
									size="15px"
								/>
							</div>
							<div class="cell-user-sub">@{u.username} · id {u.id}</div>
							<div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap">
								<span class="role-chip" data-role={u.effective_role}
									>{ROLE_LABELS[u.effective_role] || u.effective_role}</span
								>
								<span class="status-badge {statusOf(u).key}"
									><span class="dot"></span>{statusOf(u).label}</span
								>
								<span class="status-badge is-inactive">{u.follower_count ?? 0} seguidores</span>
								<span class="status-badge is-inactive">{u.post_count ?? 0} posts</span>
								<span class="status-badge is-inactive">{u.active_sessions ?? 0} sesiones</span>
							</div>
						</div>
					</div>

					<div class="detail-meta">
						<span><strong>Email:</strong> {u.email || '—'}</span>
						<span><strong>Registro:</strong> {fmtDate(u.created_at)}</span>
						<span><strong>Sanciones acumuladas:</strong> {u.strike_count ?? 0}</span>
						{#if u.muted_until}
							<span><strong>Silenciado hasta:</strong> {fmtDate(u.muted_until)}</span>
						{/if}
					</div>

					<h4 class="detail-section-title">Historial de sanciones</h4>
					{#if detail.strikes?.length}
						{#each detail.strikes as s (s.id)}
							<div class="detail-row">
								<span class="status-badge is-banned"
									><span class="dot"></span>Nv.{s.strike_level}</span
								>
								<span class="detail-row-main">{s.reason}</span>
								<span class="muted-note">{s.issuer_name || 'Staff'} · {fmtDate(s.created_at)}</span>
							</div>
						{/each}
					{:else}
						<p class="muted-note">Sin sanciones registradas.</p>
					{/if}

					<h4 class="detail-section-title">Reportes recibidos (perfil)</h4>
					{#if detail.reports_against?.length}
						{#each detail.reports_against as r (r.id)}
							<div class="detail-row">
								<span class="status-badge is-pending"><span class="dot"></span>{r.status}</span>
								<span class="detail-row-main">{r.reason}</span>
								<span class="muted-note"
									>por {r.reporter_name || 'anónimo'} · {fmtDate(r.created_at)}</span
								>
							</div>
						{/each}
					{:else}
						<p class="muted-note">Sin reportes contra este perfil.</p>
					{/if}
				{/if}
			</div>
			<div class="modal-footer">
				<button class="btn-aero-secondary" onclick={() => (showDetail = false)}>Cerrar</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.neo-shadow {
		box-shadow: var(--shadow-md);
	}
	.row-actions {
		display: flex;
		gap: 6px;
		justify-content: flex-end;
	}

	/* Tarjetas de nivel de sanción */
	.strike-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 10px;
	}
	.strike-card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		padding: 12px;
		border-radius: var(--radius-md);
		border: 1px solid var(--glass-border);
		background: var(--bg-overlay);
		color: var(--text-secondary);
		cursor: pointer;
		text-align: left;
		transition: all var(--t-base);
	}
	.strike-card:hover {
		border-color: var(--aero-sky);
	}
	.strike-card.selected {
		border-color: var(--aero-rose);
		background: rgba(236, 72, 153, 0.08);
		box-shadow: 0 0 0 3px rgba(236, 72, 153, 0.12);
	}
	.strike-card .material-icons-round {
		font-size: 20px;
		color: var(--aero-rose);
	}
	.strike-card strong {
		font-size: 0.8rem;
		color: var(--text-primary);
	}
	.strike-card small {
		font-size: 0.7rem;
		color: var(--text-muted);
		line-height: 1.35;
	}
	.strike-reason-input {
		resize: vertical;
		min-height: 70px;
	}

	/* Ficha de usuario */
	.detail-head {
		display: flex;
		gap: 14px;
		align-items: flex-start;
	}
	.detail-meta {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 6px 16px;
		font-size: 0.8rem;
		color: var(--text-secondary);
		padding: 10px 12px;
		background: var(--bg-overlay);
		border-radius: var(--radius-md);
		border: 1px solid var(--border-subtle);
	}
	.detail-section-title {
		margin: 6px 0 0;
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
	}
	.detail-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 0;
		border-bottom: 1px solid var(--border-subtle);
		font-size: 0.82rem;
	}
	.detail-row:last-child {
		border-bottom: none;
	}
	.detail-row-main {
		flex: 1;
		min-width: 0;
		color: var(--text-secondary);
	}
</style>
