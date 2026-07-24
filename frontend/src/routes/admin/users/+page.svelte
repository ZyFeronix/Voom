<script>
	import { onMount } from 'svelte';
	import { admin as adminApi } from '$lib/api.js';
	import CustomSelect from '$lib/components/CustomSelect.svelte';

	let activeMenuId = $state(null);
	let loading = $state(true);
	let users = $state([]);
	let searchQuery = $state('');
	let actionError = $state('');

	// Pagination & Filters
	let page = $state(1);
	let totalPages = $state(1);
	let roleFilter = $state('');
	let statusFilter = $state('');

	// Creation Modal
	let showCreateModal = $state(false);
	let creatingUser = $state(false);
	let newUser = $state({ username: '', email: '', password: '', role: 'user' });
	// Delete Modal
	let userToDelete = $state(null);
	let deletingUser = $state(false);

	onMount(async () => {
		await loadUsers();
	});

	async function loadUsers(p = page) {
		loading = true;
		try {
			const params = { q: searchQuery, page: p, limit: 20 };
			if (roleFilter) params.role = roleFilter;
			if (statusFilter) params.status = statusFilter;

			const res = await adminApi.users.list(params);
			users = res.users || [];
			page = res.page;
			totalPages = Math.ceil(res.total / res.limit) || 1;
		} catch (e) {
			console.error(e);
			actionError = 'Error cargando usuarios';
		} finally {
			loading = false;
		}
	}

	function handleFilterChange() {
		loadUsers(1);
	}

	let searchTimeout;
	function handleSearchInput() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			loadUsers(1);
		}, 500);
	}

	async function toggleBan(user) {
		activeMenuId = null;
		const isBanned = user.is_banned == 1;
		// Optimistic Update
		user.is_banned = isBanned ? 0 : 1;
		user.is_active = isBanned ? 1 : 0;
		users = [...users];

		try {
			if (isBanned) {
				await adminApi.users.unban(user.id);
			} else {
				await adminApi.users.ban(user.id);
			}
		} catch (e) {
			console.error(e);
			// Revert on failure
			user.is_banned = isBanned ? 1 : 0;
			user.is_active = isBanned ? 0 : 1;
			users = [...users];
			actionError = 'Error cambiando estado de usuario';
			setTimeout(() => (actionError = ''), 4000);
		}
	}

	async function changeUserRole(user, newVal) {
		if (user.id === 1) return; // Proteger al admin principal

		if (newVal === 'admin' && !confirm(`¿Hacer a @${user.username} administrador?`)) {
			users = [...users]; // Trigger reactivity to reset select si es necesario
			return;
		}

		const oldRole = user.effective_role;
		user.effective_role = newVal; // Optimistic update
		user.role = newVal;
		users = [...users];

		try {
			await adminApi.users.update(user.id, { role: newVal });
		} catch (e) {
			console.error(e);
			user.effective_role = oldRole;
			user.role = oldRole;
			users = [...users];
			actionError = 'Error al cambiar rol';
			setTimeout(() => (actionError = ''), 4000);
		}
	}

	function toggleMenu(id) {
		if (activeMenuId === id) activeMenuId = null;
		else activeMenuId = id;
	}

	function handleWindowClick(e) {
		if (!e.target.closest('.action-menu-container')) {
			activeMenuId = null;
		}
	}

	function smartPosition(node) {
		requestAnimationFrame(() => {
			const rect = node.getBoundingClientRect();
			const parentRect = node.parentElement.getBoundingClientRect();
			const spaceBelow = window.innerHeight - parentRect.bottom;
			const spaceAbove = parentRect.top;

			const requiredSpace = rect.height || 200;

			if (spaceBelow < requiredSpace && spaceAbove > spaceBelow) {
				node.style.top = 'auto';
				node.style.bottom = 'calc(100% + 8px)';
				node.style.transformOrigin = 'bottom right';
			} else {
				node.style.top = 'calc(100% + 8px)';
				node.style.bottom = 'auto';
				node.style.transformOrigin = 'top right';
			}
		});

		return {
			destroy() {}
		};
	}

	async function verifyUser(user) {
		activeMenuId = null;
		const isVerified = user.is_verified == 1;
		user.is_verified = isVerified ? 0 : 1;
		users = [...users];

		try {
			await adminApi.users.update(user.id, { is_verified: user.is_verified });
		} catch (e) {
			console.error(e);
			user.is_verified = isVerified ? 1 : 0;
			users = [...users];
			actionError = 'Error verificando usuario';
			setTimeout(() => (actionError = ''), 4000);
		}
	}

	function confirmDelete(user) {
		activeMenuId = null;
		userToDelete = user;
	}

	async function executeDelete() {
		if (!userToDelete) return;
		deletingUser = true;
		try {
			await adminApi.users.delete(userToDelete.id);
			users = users.filter((u) => u.id !== userToDelete.id);
			if (users.length === 0 && page > 1) {
				loadUsers(page - 1);
			}
			userToDelete = null;
		} catch (e) {
			console.error(e);
			actionError = e.message || 'Error al eliminar usuario';
			setTimeout(() => (actionError = ''), 4000);
			userToDelete = null;
		} finally {
			deletingUser = false;
		}
	}

	async function toggleDisable(user) {
		activeMenuId = null;
		const isActivating = user.is_active == 0;

		user.is_active = isActivating ? 1 : 0;
		users = [...users];

		try {
			if (isActivating) {
				await adminApi.users.enable(user.id);
			} else {
				await adminApi.users.disable(user.id);
			}
		} catch (e) {
			console.error(e);
			user.is_active = isActivating ? 0 : 1;
			users = [...users];
			actionError = `Error al ${isActivating ? 'habilitar' : 'deshabilitar'} usuario`;
			setTimeout(() => (actionError = ''), 4000);
		}
	}

	async function createUser() {
		if (!newUser.username || !newUser.email || !newUser.password) {
			actionError = 'Por favor, llena todos los campos obligatorios';
			setTimeout(() => (actionError = ''), 4000);
			return;
		}
		creatingUser = true;
		try {
			await adminApi.users.create(newUser);
			showCreateModal = false;
			newUser = { username: '', email: '', password: '', role: 'user' };
			await loadUsers(1); // Recargar primera página
		} catch (e) {
			console.error(e);
			actionError = e.message || 'Error al crear usuario';
			setTimeout(() => (actionError = ''), 4000);
		} finally {
			creatingUser = false;
		}
	}
</script>

<svelte:head>
	<title>Usuarios | VSocial Admin</title>
</svelte:head>

<svelte:window onclick={handleWindowClick} />

<!-- Create User Modal -->
{#if showCreateModal}
	<div class="modal-backdrop">
		<div class="modal-content glass-card neo-shadow">
			<div class="modal-header">
				<h2>Crear Nuevo Usuario</h2>
				<button class="btn-icon shield-btn" onclick={() => (showCreateModal = false)}>
					<span class="material-icons-round">close</span>
				</button>
			</div>
			<div class="modal-body">
				<div class="form-group">
					<label for="c-username">Username <span class="text-error">*</span></label>
					<input
						id="c-username"
						type="text"
						class="aero-input w-full"
						bind:value={newUser.username}
						placeholder="ej. satoshi"
					/>
				</div>
				<div class="form-group">
					<label for="c-email">Correo Electrónico <span class="text-error">*</span></label>
					<input
						id="c-email"
						type="email"
						class="aero-input w-full"
						bind:value={newUser.email}
						placeholder="correo@ejemplo.com"
					/>
				</div>
				<div class="form-group">
					<label for="c-password">Contraseña <span class="text-error">*</span></label>
					<input
						id="c-password"
						type="password"
						class="aero-input w-full"
						bind:value={newUser.password}
						placeholder="Mínimo 8 caracteres"
					/>
				</div>
				<div class="form-group">
					<span class="form-label">Rol Inicial</span>
					<div style="position: relative; z-index: 10;">
						<CustomSelect
							bind:value={newUser.role}
							options={[
								{ value: 'user', label: 'User' },
								{ value: 'team', label: 'Team' },
								{ value: 'moderator', label: 'Moderator' },
								{ value: 'admin', label: 'Admin' }
							]}
						/>
					</div>
				</div>
			</div>
			<div class="modal-footer">
				<button
					class="btn-aero-ghost"
					onclick={() => (showCreateModal = false)}
					disabled={creatingUser}>Cancelar</button
				>
				<button class="btn-aero-primary" onclick={createUser} disabled={creatingUser}>
					{#if creatingUser}
						<span class="loading loading-spinner loading-sm"></span>
					{:else}
						Crear Usuario
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Delete Confirmation Modal -->
{#if userToDelete}
	<div class="modal-backdrop">
		<div class="modal-content glass-card neo-shadow">
			<div class="modal-header">
				<h2 class="text-error flex items-center gap-2">
					<span class="material-icons-round">warning</span>
					Confirmar Eliminación
				</h2>
				<button class="btn-icon shield-btn" onclick={() => (userToDelete = null)}>
					<span class="material-icons-round">close</span>
				</button>
			</div>
			<div class="modal-body">
				<p class="text-primary font-medium">
					¿Estás seguro de que deseas eliminar permanentemente a <strong class="text-error"
						>@{userToDelete.username}</strong
					>?
				</p>
				<p class="text-sm text-muted">
					Esta acción es irreversible y purgará todos sus datos de la base de datos de V-SOCIAL.
				</p>
			</div>
			<div class="modal-footer">
				<button class="btn-aero-ghost" onclick={() => (userToDelete = null)} disabled={deletingUser}
					>Cancelar</button
				>
				<button class="btn-aero-danger" onclick={executeDelete} disabled={deletingUser}>
					{#if deletingUser}
						<span class="loading loading-spinner loading-sm"></span>
					{:else}
						Eliminar
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<div class="page-header">
	<div class="header-left">
		<h1 class="page-title">Usuarios</h1>
		<p class="page-subtitle">Gestiona las cuentas y accesos de la plataforma</p>
	</div>
	<div class="header-right" style="display: flex; gap: 12px;">
		<button
			class="btn-aero-primary flex items-center gap-2"
			onclick={() => (showCreateModal = true)}
		>
			<span class="material-icons-round text-[18px]">person_add</span>
			Nuevo Usuario
		</button>
	</div>
</div>

<div class="page-content">
	{#if actionError}
		<div class="glass-panel p-4 mb-6 flex items-center gap-2 text-sm rounded-lg error-toast">
			<span class="material-icons-round text-[18px]">error_outline</span>
			{actionError}
		</div>
	{/if}

	<!-- Filters Row -->
	<div class="filters-row glass-panel">
		<div class="search-box flex-1 max-w-[300px]">
			<span class="material-icons-round">search</span>
			<input
				type="text"
				placeholder="Buscar por usuario, email..."
				bind:value={searchQuery}
				oninput={handleSearchInput}
				class="aero-input w-full"
			/>
		</div>

		<div class="filter-group">
			<span class="text-xs text-muted font-bold uppercase tracking-wider mb-1 block"
				>Filtrar por Rol</span
			>
			<div style="width: 150px; z-index: 20;">
				<CustomSelect
					bind:value={roleFilter}
					options={[
						{ value: '', label: 'Todos los Roles' },
						{ value: 'user', label: 'User' },
						{ value: 'team', label: 'Team' },
						{ value: 'moderator', label: 'Moderator' },
						{ value: 'admin', label: 'Admin' }
					]}
					onchange={handleFilterChange}
				/>
			</div>
		</div>

		<div class="filter-group">
			<span class="text-xs text-muted font-bold uppercase tracking-wider mb-1 block">Estado</span>
			<div style="width: 150px; z-index: 20;">
				<CustomSelect
					bind:value={statusFilter}
					options={[
						{ value: '', label: 'Todos' },
						{ value: 'active', label: 'Activos' },
						{ value: 'inactive', label: 'Inactivos' },
						{ value: 'banned', label: 'Baneados' }
					]}
					onchange={handleFilterChange}
				/>
			</div>
		</div>
	</div>

	<div class="glass-card table-card">
		{#if loading && users.length === 0}
			<div class="loader-container">
				<span class="loading loading-spinner text-primary"></span>
			</div>
		{:else}
			<div class="table-responsive">
				<table class="aero-table">
					<thead>
						<tr>
							<th>Usuario</th>
							<th>Rol</th>
							<th>Estado</th>
							<th>Fecha de Ingreso</th>
							<th class="text-right">Acciones</th>
						</tr>
					</thead>
					<tbody>
						{#each users as user}
							<tr>
								<td>
									<div class="user-cell">
										<div class="user-avatar-mini shrink-0">
											{#if user.avatar_url}
												<img src={user.avatar_url} alt={user.username} />
											{:else}
												<span>{(user.display_name || user.username)[0].toUpperCase()}</span>
											{/if}
										</div>
										<div class="user-details min-w-0">
											<p class="user-name truncate">
												{user.display_name || user.username}
												{#if user.is_verified == 1}<span class="material-icons-round verified-icon"
														>verified</span
													>{/if}
											</p>
											<p class="user-handle truncate">@{user.username}</p>
										</div>
									</div>
								</td>
								<td>
									{#if user.id === 1}
										<span
											class="badge badge-outline"
											style="color: var(--aero-gold); border-color: rgba(255,191,0,0.3)"
											>Super Admin</span
										>
									{:else}
										<div style="width: 140px;">
											<CustomSelect
												bind:value={user.effective_role}
												options={[
													{ value: 'user', label: 'User' },
													{ value: 'team', label: 'Team' },
													{ value: 'moderator', label: 'Moderator' },
													{ value: 'admin', label: 'Admin' }
												]}
												onchange={(val) => changeUserRole(user, val)}
											/>
										</div>
									{/if}
								</td>
								<td>
									<span
										class="status-badge"
										class:active={user.is_banned == 0 && user.is_active == 1}
									>
										{user.is_banned == 1 ? 'Baneado' : user.is_active == 1 ? 'Activo' : 'Inactivo'}
									</span>
								</td>
								<td
									><span class="text-sm">{new Date(user.created_at).toLocaleDateString()}</span></td
								>
								<td class="text-right">
									{#if user.id !== 1}
										<div
											class="action-menu-container"
											style="position: relative; display: inline-block;"
										>
											<button class="btn-icon shield-btn" onclick={() => toggleMenu(user.id)}>
												<span class="material-icons-round">more_vert</span>
											</button>

											{#if activeMenuId === user.id}
												<div class="glass-menu action-dropdown" use:smartPosition>
													<button class="menu-item" onclick={() => toggleBan(user)}>
														<span class="material-icons-round text-[18px]"
															>{user.is_banned == 1 ? 'how_to_reg' : 'block'}</span
														>
														{user.is_banned == 1 ? 'Desbanear' : 'Banear'}
													</button>
													{#if user.is_banned == 0}
														<button class="menu-item" onclick={() => toggleDisable(user)}>
															<span class="material-icons-round text-[18px]"
																>{user.is_active == 0 ? 'visibility' : 'visibility_off'}</span
															>
															{user.is_active == 0 ? 'Habilitar Perfil' : 'Deshabilitar Perfil'}
														</button>
													{/if}
													<button class="menu-item" onclick={() => verifyUser(user)}>
														<span class="material-icons-round text-[18px] text-blue-500"
															>{user.is_verified == 1 ? 'remove_circle_outline' : 'verified'}</span
														>
														{user.is_verified == 1 ? 'Quitar Verificación' : 'Verificar'}
													</button>
													<div class="menu-divider"></div>
													<button
														class="menu-item text-error hover-danger"
														onclick={() => confirmDelete(user)}
													>
														<span class="material-icons-round text-[18px]">delete_forever</span>
														Eliminar Cuenta
													</button>
												</div>
											{/if}
										</div>
									{:else}
										<span class="badge badge-outline" style="opacity: 0.5">Protegido</span>
									{/if}
								</td>
							</tr>
						{/each}
						{#if users.length === 0}
							<tr>
								<td colspan="5" class="empty-row"
									>No se encontraron usuarios para los filtros seleccionados</td
								>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>

			<!-- Pagination Controls -->
			{#if totalPages > 1}
				<div class="pagination-bar">
					<button
						class="aero-btn ghost icon-only shield-btn"
						disabled={page === 1}
						onclick={() => loadUsers(page - 1)}
					>
						<span class="material-icons-round">chevron_left</span>
					</button>
					<span class="page-info">Página {page} de {totalPages}</span>
					<button
						class="aero-btn ghost icon-only shield-btn"
						disabled={page === totalPages}
						onclick={() => loadUsers(page + 1)}
					>
						<span class="material-icons-round">chevron_right</span>
					</button>
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.page-header {
		padding: 32px;
		background: linear-gradient(180deg, rgba(46, 134, 232, 0.03) 0%, transparent 100%);
		border-bottom: 1px solid var(--border-subtle);
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
	}
	.page-title {
		font-size: 1.8rem;
		font-family: var(--font-display);
		font-weight: 800;
		color: var(--text-primary);
		margin: 0;
	}
	.page-subtitle {
		font-size: 0.9rem;
		color: var(--text-muted);
		margin: 4px 0 0;
	}

	.filters-row {
		padding: 16px;
		margin-bottom: 24px;
		border-radius: var(--radius-lg);
		display: flex;
		gap: 24px;
		align-items: flex-end;
		background: var(--glass-surface);
		border: 1px solid var(--glass-border);
		overflow: visible !important;
		position: relative;
		z-index: 50;
	}

	.search-box {
		position: relative;
	}
	.search-box .material-icons-round {
		position: absolute;
		left: 12px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-muted);
		font-size: 20px;
	}
	.search-box input {
		width: 100%;
		padding-left: 40px;
	}
	.text-muted {
		color: var(--text-muted);
	}
	.text-error {
		color: var(--aero-rose);
	}

	.page-content {
		padding: 32px;
	}

	.table-card {
		border-radius: var(--radius-lg);
		overflow: visible; /* To allow dropdowns to overflow */
		box-shadow: var(--depth-2);
	}
	.table-responsive {
		overflow-x: auto;
		overflow-y: visible;
	}

	.aero-table {
		width: 100%;
		border-collapse: collapse;
	}
	.aero-table th {
		text-align: left;
		padding: 16px 24px;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-bottom: 1px solid var(--border-subtle);
	}
	.aero-table td {
		padding: 16px 24px;
		border-bottom: 1px solid var(--border-subtle);
		vertical-align: middle;
	}
	.aero-table tr:last-child td {
		border-bottom: none;
	}
	.aero-table tr:hover td {
		background: rgba(255, 255, 255, 0.02);
	}

	.text-right {
		text-align: right !important;
	}

	.user-cell {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	/* Escudo Volumétrico de Avatares */
	.user-avatar-mini {
		flex: 0 0 44px;
		min-width: 44px;
		min-height: 44px;
		border-radius: 50%;
		background: var(--grad-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		font-weight: 700;
		overflow: hidden;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}
	.user-avatar-mini img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.user-name {
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.verified-icon {
		font-size: 14px;
		color: var(--aero-sky);
	}
	.user-handle {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin: 0;
	}

	.badge-outline {
		border: 1px solid var(--border-glass);
		padding: 4px 8px;
		border-radius: 6px;
		font-size: 0.7rem;
		text-transform: uppercase;
		font-weight: 700;
	}

	.status-badge {
		padding: 4px 10px;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 600;
		background: rgba(232, 74, 114, 0.1);
		color: var(--aero-rose);
		border: 1px solid rgba(232, 74, 114, 0.2);
	}
	.status-badge.active {
		background: rgba(46, 204, 113, 0.15);
		color: #2ecc71;
		border-color: rgba(46, 204, 113, 0.3);
	}

	/* Escudo Volumétrico Botones de Acción */
	.shield-btn {
		flex: 0 0 44px;
		min-width: 44px;
		min-height: 44px;
	}

	.btn-icon {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s var(--ease-spring);
	}
	.btn-icon:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-primary);
		box-shadow: var(--neon-primary);
	}

	.action-dropdown {
		position: absolute;
		right: 0;
		width: 220px;
		z-index: 100;
		border-radius: var(--radius-lg);
		background: rgba(255, 255, 255, 0.03);
		backdrop-filter: blur(32px) saturate(150%);
		-webkit-backdrop-filter: blur(32px) saturate(150%);
		border: 1px solid rgba(255, 255, 255, 0.12);
		box-shadow:
			0 16px 40px rgba(0, 0, 0, 0.4),
			inset 0 1px 0 rgba(255, 255, 255, 0.15);
		padding: 8px;
		text-align: left;
		animation: fadeInScale 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
	}

	@keyframes fadeInScale {
		0% {
			opacity: 0;
			transform: scale(0.92);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 10px 14px;
		border: none;
		background: transparent;
		color: var(--text-primary);
		font-size: 0.9rem;
		font-weight: 500;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		text-align: left;
	}
	.menu-item:hover {
		background: rgba(255, 255, 255, 0.08);
		transform: translateX(4px);
	}
	.menu-item.text-error {
		color: var(--aero-rose);
	}
	.menu-item.hover-danger:hover {
		background: rgba(232, 74, 114, 0.15);
		box-shadow: inset 0 0 0 1px rgba(232, 74, 114, 0.25);
		color: #ff4d6d;
		transform: translateX(4px);
	}

	.menu-divider {
		height: 1px;
		background: rgba(255, 255, 255, 0.1);
		margin: 4px 0;
	}

	/* Pagination Bar */
	.pagination-bar {
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 16px;
		gap: 16px;
		border-top: 1px solid var(--border-subtle);
		background: rgba(0, 0, 0, 0.2);
	}
	.page-info {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.empty-row {
		text-align: center;
		color: var(--text-muted);
		padding: 64px !important;
	}
	.loader-container {
		padding: 64px;
		text-align: center;
	}

	.error-toast {
		background: rgba(232, 74, 114, 0.1);
		border: 1px solid rgba(232, 74, 114, 0.3);
		color: var(--aero-rose);
		box-shadow: 0 4px 20px rgba(232, 74, 114, 0.15);
	}

	/* Modal */
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(8px);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		animation: fadeIn 0.2s ease;
	}
	.modal-content {
		width: 100%;
		max-width: 450px;
		background: var(--bg-surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--depth-elevated);
		border: 1px solid var(--glass-border);
		animation: slideUp 0.3s var(--ease-spring);
	}
	@keyframes slideUp {
		0% {
			opacity: 0;
			transform: translateY(20px) scale(0.95);
		}
		100% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 24px;
		border-bottom: 1px solid var(--border-subtle);
	}
	.modal-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.modal-body {
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.form-group label {
		display: block;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-muted);
		margin-bottom: 6px;
	}

	.modal-footer {
		padding: 16px 24px;
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		border-top: 1px solid var(--border-subtle);
		background: rgba(0, 0, 0, 0.1);
	}

	.neo-shadow {
		box-shadow:
			var(--depth-3),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}
</style>
