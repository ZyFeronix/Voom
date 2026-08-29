<script>
	import { perfStore } from '$lib/stores/perf.svelte.js';
	import SettingsMessage from '$lib/components/settings/SettingsMessage.svelte';

	let message = $state({ type: '', text: '' });
	let clearingCache = $state(false);
	let runningBench = $state(false);

	async function handleClearCache() {
		clearingCache = true;
		try {
			const res = await perfStore.clearLocalCache();
			const cachesText = res.cachesCleared > 0 ? ` y ${res.cachesCleared} cachés de red` : '';
			message = {
				type: 'success',
				text: `Se liberaron ${res.keysRemoved} elementos de almacenamiento${cachesText} correctamente.`
			};
		} catch (_e) {
			message = { type: 'error', text: 'Error al limpiar la caché local.' };
		} finally {
			clearingCache = false;
		}
	}

	async function handleRunBenchmark() {
		runningBench = true;
		message = { type: '', text: '' };
		try {
			const result = await perfStore.runBenchmark();
			if (result) {
				const profName =
					result.recommendedProfile === 'lite'
						? 'Rendimiento Máximo (Lite)'
						: result.recommendedProfile === 'high'
							? 'Alta Fidelidad (High)'
							: 'Equilibrado (Balanced)';
				message = {
					type: 'success',
					text: `Benchmark finalizado con éxito: ${result.avgFps} FPS promedio (${result.score}/100 puntos). Perfil sugerido: ${profName}.`
				};
			}
		} catch (_e) {
			message = { type: 'error', text: 'Error al ejecutar el benchmark de rendimiento.' };
		} finally {
			runningBench = false;
		}
	}

	function handleResetDefaults() {
		perfStore.resetDefaults();
		message = {
			type: 'success',
			text: 'Se han restablecido todos los ajustes al perfil Equilibrado de fábrica.'
		};
	}
</script>

<svelte:head>
	<title>Rendimiento — Voom!</title>
</svelte:head>

<div class="glass-card panel-card">
	<SettingsMessage {message} />

	<div class="section-content">
		<div>
			<h3 class="section-title">Rendimiento & Optimización</h3>
			<p class="section-subtitle">
				Personaliza la aceleración gráfica, el uso de memoria, animaciones y consumo de datos para
				obtener 60-120 FPS estables.
			</p>
		</div>

		<!-- Hardware Diagnostic & Telemetry Card -->
		<div class="perf-diag-card glass-panel">
			<div class="perf-diag-header">
				<div class="perf-diag-title-group">
					<span class="material-icons-round perf-diag-icon">memory</span>
					<div>
						<div class="perf-diag-title">Diagnóstico de Hardware & Sistema</div>
						<div class="perf-diag-sub">
							Detección automática de capacidades y telemetría de tu equipo
						</div>
					</div>
				</div>
				<span
					class="perf-status-badge"
					class:badge-low={perfStore.hardwareInfo.isLowEnd}
					class:badge-high={!perfStore.hardwareInfo.isLowEnd}
				>
					<span class="material-icons-round text-xs">
						{perfStore.hardwareInfo.isLowEnd ? 'bolt' : 'speed'}
					</span>
					{perfStore.hardwareInfo.isLowEnd ? 'Hardware Modesto' : 'Hardware de Alto Rendimiento'}
				</span>
			</div>

			<div class="perf-specs-grid">
				<div class="perf-spec-item">
					<span class="material-icons-round spec-icon">developer_board</span>
					<div class="spec-info">
						<div class="spec-label">Núcleos CPU</div>
						<div class="spec-value">{perfStore.hardwareInfo.cores} Cores Lógicos</div>
					</div>
				</div>

				<div class="perf-spec-item">
					<span class="material-icons-round spec-icon">memory</span>
					<div class="spec-info">
						<div class="spec-label">Memoria RAM</div>
						<div class="spec-value">
							{perfStore.hardwareInfo.memoryGB
								? `~${perfStore.hardwareInfo.memoryGB} GB Estimados`
								: 'Estándar'}
						</div>
					</div>
				</div>

				<div class="perf-spec-item">
					<span class="material-icons-round spec-icon">videogame_asset</span>
					<div class="spec-info">
						<div class="spec-label">Renderizador GPU</div>
						<div class="spec-value spec-gpu" title={perfStore.hardwareInfo.gpuRenderer}>
							{perfStore.hardwareInfo.gpuRenderer}
						</div>
					</div>
				</div>

				<div class="perf-spec-item">
					<span class="material-icons-round spec-icon">display_settings</span>
					<div class="spec-info">
						<div class="spec-label">Tasa de Refresco</div>
						<div class="spec-value">
							{perfStore.hardwareInfo.screenRefreshRate} Hz
							<span class="spec-sub"
								>({perfStore.hardwareInfo.screenRefreshRate >= 120
									? 'Alta Tasa / ProMotion'
									: 'Estándar'})</span
							>
						</div>
					</div>
				</div>

				<div class="perf-spec-item">
					<span class="material-icons-round spec-icon">wifi</span>
					<div class="spec-info">
						<div class="spec-label">Conexión de Red</div>
						<div class="spec-value" style="text-transform: uppercase;">
							{perfStore.hardwareInfo.connectionType}
							{#if perfStore.hardwareInfo.rtt}
								<span class="spec-sub">({perfStore.hardwareInfo.rtt}ms Ping)</span>
							{/if}
						</div>
					</div>
				</div>

				{#if perfStore.hardwareInfo.batteryLevel !== null}
					<div class="perf-spec-item">
						<span class="material-icons-round spec-icon">
							{perfStore.hardwareInfo.batteryCharging ? 'battery_charging_full' : 'battery_std'}
						</span>
						<div class="spec-info">
							<div class="spec-label">Nivel de Batería</div>
							<div class="spec-value">
								{perfStore.hardwareInfo.batteryLevel}%
								{perfStore.hardwareInfo.batteryCharging ? '(Cargando)' : '(Batería)'}
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Live Benchmark Section -->
			<div class="perf-benchmark-box">
				<div class="perf-benchmark-header">
					<div>
						<div class="perf-benchmark-title">
							<span class="material-icons-round">speed</span>
							<span>Test de Rendimiento en Tiempo Real (Benchmark 3s)</span>
						</div>
						<div class="perf-benchmark-sub">
							Evalúa la estabilidad de cuadros, caídas de FPS y fluidez en vivo bajo estrés.
						</div>
					</div>
					<button
						type="button"
						class="btn-aero-secondary"
						style="font-size: 0.78rem; padding: 6px 12px;"
						disabled={runningBench}
						onclick={handleRunBenchmark}
					>
						<span class="material-icons-round text-sm">
							{runningBench ? 'sync' : 'play_arrow'}
						</span>
						<span>{runningBench ? 'Ejecutando...' : 'Iniciar Test'}</span>
					</button>
				</div>

				{#if runningBench}
					<div class="perf-progress-bar-wrap">
						<div
							class="perf-progress-bar-fill"
							style="width: {perfStore.benchmarkState.progress}%"
						></div>
					</div>
					<div class="text-xs text-muted" style="text-align: right;">
						Analizando fluidez: {perfStore.benchmarkState.progress}%
					</div>
				{/if}

				{#if perfStore.benchmarkState.score !== null && !runningBench}
					<div class="perf-benchmark-results">
						<div class="benchmark-stat-card">
							<div class="benchmark-stat-label">Puntuación</div>
							<div class="benchmark-stat-val">
								<span
									class="benchmark-score-badge"
									class:score-great={perfStore.benchmarkState.score >= 85}
									class:score-good={perfStore.benchmarkState.score >= 60 &&
										perfStore.benchmarkState.score < 85}
									class:score-low={perfStore.benchmarkState.score < 60}
								>
									{perfStore.benchmarkState.score} / 100
								</span>
							</div>
						</div>
						<div class="benchmark-stat-card">
							<div class="benchmark-stat-label">FPS Promedio</div>
							<div class="benchmark-stat-val text-accent">{perfStore.benchmarkState.avgFps}</div>
						</div>
						<div class="benchmark-stat-card">
							<div class="benchmark-stat-label">Mínimo 1%</div>
							<div class="benchmark-stat-val">{perfStore.benchmarkState.minFps} fps</div>
						</div>
						<div class="benchmark-stat-card">
							<div class="benchmark-stat-label">Tiempo Cuadro</div>
							<div class="benchmark-stat-val">{perfStore.benchmarkState.frameTimeMs} ms</div>
						</div>
						<div class="benchmark-stat-card">
							<div class="benchmark-stat-label">Caídas Cuadro</div>
							<div
								class="benchmark-stat-val"
								class:text-danger={perfStore.benchmarkState.droppedFrames > 5}
							>
								{perfStore.benchmarkState.droppedFrames}
							</div>
						</div>
					</div>
				{/if}
			</div>

			<div class="perf-actions-row">
				<button
					type="button"
					class="btn-aero-primary auto-opt-btn"
					style="flex: 2;"
					onclick={() => {
						const rec = perfStore.applyRecommendedSettings();
						message = {
							type: 'success',
							text: `Configuración aplicada con éxito: Perfil ${rec === 'lite' ? 'Rendimiento Máximo (Lite)' : rec === 'high' ? 'Alta Fidelidad' : 'Equilibrado'}.`
						};
					}}
				>
					<span class="material-icons-round">auto_fix_high</span>
					<span>Aplicar optimización recomendada para mi equipo</span>
				</button>

				<button
					type="button"
					class="btn-aero-secondary"
					style="flex: 1; min-width: 170px;"
					onclick={handleResetDefaults}
				>
					<span class="material-icons-round text-sm">restart_alt</span>
					<span>Restablecer Fábrica</span>
				</button>
			</div>
		</div>

		<!-- Presets de 1-Clic -->
		<div class="perf-section-block">
			<h4 class="perf-block-title">
				<span class="material-icons-round">tune</span>
				<span>Perfiles de Rendimiento Rápidos</span>
			</h4>
			<p class="perf-block-subtitle">
				Elige una configuración predeterminada o ajusta individualmente los parámetros de abajo.
			</p>

			<div class="perf-presets-grid">
				<button
					type="button"
					class="perf-preset-card"
					class:active={perfStore.perfProfile === 'lite'}
					onclick={() => {
						perfStore.applyPreset('lite');
						message = { type: 'success', text: 'Modo Rendimiento Máximo activado.' };
					}}
				>
					<div class="preset-badge-row">
						<span class="material-icons-round preset-icon text-amber">bolt</span>
						<span class="preset-name">Rendimiento Máximo</span>
					</div>
					<p class="preset-desc">
						Luminosidad suave ultra-ligera de 1 pasada, sin desenfoques pesados, sin fondo dinámico
						ni sobrecarga GPU. Máximos FPS en gráficos integrados y móviles.
					</p>
				</button>

				<button
					type="button"
					class="perf-preset-card"
					class:active={perfStore.perfProfile === 'balanced'}
					onclick={() => {
						perfStore.applyPreset('balanced');
						message = { type: 'success', text: 'Modo Equilibrado activado.' };
					}}
				>
					<div class="preset-badge-row">
						<span class="material-icons-round preset-icon text-sky">balance</span>
						<span class="preset-name">Equilibrado</span>
						<span class="preset-pill-rec">Recomendado</span>
					</div>
					<p class="preset-desc">
						Cristal suave optimizado (8px), transiciones rápidas y luminosidad ambiental fluida.
						Estética Neo-Aero con bajo consumo y 60-120 FPS estables.
					</p>
				</button>

				<button
					type="button"
					class="perf-preset-card"
					class:active={perfStore.perfProfile === 'high'}
					onclick={() => {
						perfStore.applyPreset('high');
						message = { type: 'success', text: 'Modo Alta Fidelidad activado.' };
					}}
				>
					<div class="preset-badge-row">
						<span class="material-icons-round preset-icon text-mint">auto_awesome</span>
						<span class="preset-name">Alta Fidelidad</span>
					</div>
					<p class="preset-desc">
						Glassmorphism 2.0 completo (16px), saturación profunda, reflejos especulares de prisma,
						resplandor etéreo multicapa y todas las animaciones activas.
					</p>
				</button>
			</div>
		</div>

		<!-- Grupo 1: Gráficos & GPU -->
		<div class="perf-settings-card glass-card">
			<div class="perf-group-header">
				<span class="material-icons-round perf-group-icon">palette</span>
				<span class="perf-group-title">Gráficos & Renderizado (GPU)</span>
			</div>

			<div class="perf-setting-row">
				<div class="perf-setting-meta">
					<div class="perf-setting-name">Desenfoque de Cristal (Backdrop-Filter)</div>
					<div class="perf-setting-desc">
						Controla la intensidad del desenfoque de cristal y saturación en tarjetas, barra de
						navegación y menús.
					</div>
				</div>
				<div class="perf-segmented-control">
					<button
						type="button"
						class="seg-btn"
						class:active={perfStore.glassBlur === 'none'}
						onclick={() => perfStore.setGlassBlur('none')}
					>
						Desactivado (0px)
					</button>
					<button
						type="button"
						class="seg-btn"
						class:active={perfStore.glassBlur === 'subtle'}
						onclick={() => perfStore.setGlassBlur('subtle')}
					>
						Suave (8px)
					</button>
					<button
						type="button"
						class="seg-btn"
						class:active={perfStore.glassBlur === 'full'}
						onclick={() => perfStore.setGlassBlur('full')}
					>
						Completo (16px)
					</button>
				</div>
			</div>

			<div class="perf-setting-row">
				<div class="perf-setting-meta">
					<div class="perf-setting-name">Aceleración por Capas GPU Forzada</div>
					<div class="perf-setting-desc">
						Promueve paneles y tarjetas a capas independientes en la GPU. Desactivarlo ahorra
						memoria VRAM en dispositivos modestos.
					</div>
				</div>
				<input
					type="checkbox"
					class="aero-toggle-switch"
					checked={perfStore.gpuAcceleration}
					onchange={(e) => perfStore.setGpuAcceleration(e.currentTarget.checked)}
					aria-label="Aceleración GPU por capas"
				/>
			</div>

			<div class="perf-setting-row">
				<div class="perf-setting-meta">
					<div class="perf-setting-name">Fondo Fluido Dinámico (Aurora Blobs & Rayos de Luz)</div>
					<div class="perf-setting-desc">
						Gradientes animados con desenfoque de 100px en el fondo. Desactivarlo reduce
						drásticamente el uso de VRAM y consumo energético.
					</div>
				</div>
				<input
					type="checkbox"
					class="aero-toggle-switch"
					checked={!perfStore.disableLiquidBg}
					onchange={(e) => perfStore.setDisableLiquidBg(!e.currentTarget.checked)}
					aria-label="Fondo Fluido Dinámico"
				/>
			</div>

			<div class="perf-setting-row">
				<div class="perf-setting-meta">
					<div class="perf-setting-name">Textura de Ruido Anti-Banding (Filtro SVG)</div>
					<div class="perf-setting-desc">
						Microtextura de dispersión de luz sobre paneles de cristal. Desactivarla ahorra tiempo
						de cálculo en el rasterizador de la GPU.
					</div>
				</div>
				<input
					type="checkbox"
					class="aero-toggle-switch"
					checked={!perfStore.disableNoise}
					onchange={(e) => perfStore.setDisableNoise(!e.currentTarget.checked)}
					aria-label="Textura de Ruido"
				/>
			</div>

			<div class="perf-setting-row">
				<div class="perf-setting-meta">
					<div class="perf-setting-name">Luminosidad y Resplandor Multicapa</div>
					<div class="perf-setting-desc">
						Optimiza los halos de luminosidad ambiental difusa a un resplandor ligero de 1 sola
						pasada.
					</div>
				</div>
				<input
					type="checkbox"
					class="aero-toggle-switch"
					checked={!perfStore.simplifyShadows}
					onchange={(e) => perfStore.setSimplifyShadows(!e.currentTarget.checked)}
					aria-label="Luminosidad y Resplandor"
				/>
			</div>

			<div class="perf-setting-row">
				<div class="perf-setting-meta">
					<div class="perf-setting-name">Renderizado Diferido de Tarjetas (Content-Visibility)</div>
					<div class="perf-setting-desc">
						Omite el cálculo de diseño de publicaciones y comentarios fuera de pantalla en feeds
						largos (Google Web Standard).
					</div>
				</div>
				<input
					type="checkbox"
					class="aero-toggle-switch"
					checked={perfStore.contentVisibility}
					onchange={(e) => perfStore.setContentVisibility(e.currentTarget.checked)}
					aria-label="Renderizado Diferido"
				/>
			</div>

			<div class="perf-setting-row">
				<div class="perf-setting-meta">
					<div class="perf-setting-name">Efectos de Brillo en Cursor (Hover Glow)</div>
					<div class="perf-setting-desc">
						Suprime los cálculos de iluminación especular al mover el cursor rápidamente sobre
						listas extensas.
					</div>
				</div>
				<input
					type="checkbox"
					class="aero-toggle-switch"
					checked={!perfStore.disableHoverGlow}
					onchange={(e) => perfStore.setDisableHoverGlow(!e.currentTarget.checked)}
					aria-label="Efectos de Brillo en Hover"
				/>
			</div>

			<div class="perf-setting-row">
				<div class="perf-setting-meta">
					<div class="perf-setting-name">Luz Ambiental de Vídeo (Glow Reactivo)</div>
					<div class="perf-setting-desc">
						El reproductor proyecta el color del vídeo hacia los márgenes redibujando un canvas por
						cada fotograma. Desactivarlo elimina ese coste continuo de GPU/CPU en feeds con varios
						vídeos.
					</div>
				</div>
				<input
					type="checkbox"
					class="aero-toggle-switch"
					checked={perfStore.videoAmbientLight}
					onchange={(e) => perfStore.setVideoAmbientLight(e.currentTarget.checked)}
					aria-label="Luz Ambiental de Vídeo"
				/>
			</div>
		</div>

		<!-- Grupo 2: Animaciones & CPU -->
		<div class="perf-settings-card glass-card">
			<div class="perf-group-header">
				<span class="material-icons-round perf-group-icon">motion_photos_on</span>
				<span class="perf-group-title">Animaciones & Movimiento (CPU)</span>
			</div>

			<div class="perf-setting-row">
				<div class="perf-setting-meta">
					<div class="perf-setting-name">Reducir Movimiento & Animaciones</div>
					<div class="perf-setting-desc">
						Desactiva rebotes elásticos overshoot, animaciones continuas flotantes y reduce las
						transiciones visuales.
					</div>
				</div>
				<input
					type="checkbox"
					class="aero-toggle-switch"
					checked={perfStore.reduceMotion}
					onchange={(e) => perfStore.setReduceMotion(e.currentTarget.checked)}
					aria-label="Reducir Movimiento"
				/>
			</div>

			<div class="perf-setting-row">
				<div class="perf-setting-meta">
					<div class="perf-setting-name">Transiciones entre Páginas (View Transitions)</div>
					<div class="perf-setting-desc">
						Velocidad de transición y fundido de pantalla al cambiar de sección o ruta en Voom!.
					</div>
				</div>
				<div class="perf-segmented-control">
					<button
						type="button"
						class="seg-btn"
						class:active={perfStore.viewTransitions === 'disabled'}
						onclick={() => perfStore.setViewTransitions('disabled')}
					>
						Mínima (160ms)
					</button>
					<button
						type="button"
						class="seg-btn"
						class:active={perfStore.viewTransitions === 'fast'}
						onclick={() => perfStore.setViewTransitions('fast')}
					>
						Rápida (260ms)
					</button>
					<button
						type="button"
						class="seg-btn"
						class:active={perfStore.viewTransitions === 'enabled'}
						onclick={() => perfStore.setViewTransitions('enabled')}
					>
						Cinemática (~320ms)
					</button>
				</div>
			</div>

			<div class="perf-setting-row">
				<div class="perf-setting-meta">
					<div class="perf-setting-name">Precarga Inteligente de Rutas (SvelteKit Preload)</div>
					<div class="perf-setting-desc">
						Controla cuándo se descargan anticipadamente los datos de los enlaces antes de hacer
						clic.
					</div>
				</div>
				<div class="perf-segmented-control">
					<button
						type="button"
						class="seg-btn"
						class:active={perfStore.routePreload === 'hover'}
						onclick={() => perfStore.setRoutePreload('hover')}
					>
						Al posar cursor
					</button>
					<button
						type="button"
						class="seg-btn"
						class:active={perfStore.routePreload === 'tap'}
						onclick={() => perfStore.setRoutePreload('tap')}
					>
						Al pulsar
					</button>
					<button
						type="button"
						class="seg-btn"
						class:active={perfStore.routePreload === 'off'}
						onclick={() => perfStore.setRoutePreload('off')}
					>
						Desactivada
					</button>
				</div>
			</div>
		</div>

		<!-- Grupo 3: Multimedia & Red -->
		<div class="perf-settings-card glass-card">
			<div class="perf-group-header">
				<span class="material-icons-round perf-group-icon">play_circle</span>
				<span class="perf-group-title">Multimedia & Consumo de Red</span>
			</div>

			<div class="perf-setting-row">
				<div class="perf-setting-meta">
					<div class="perf-setting-name">Reproducción Automática de Videos (Autoplay)</div>
					<div class="perf-setting-desc">
						Evita la decodificación masiva concurrente de videos en feeds largos para ahorrar
						memoria y datos.
					</div>
				</div>
				<div class="perf-segmented-control">
					<button
						type="button"
						class="seg-btn"
						class:active={perfStore.videoAutoplay === 'never'}
						onclick={() => perfStore.setVideoAutoplay('never')}
					>
						Desactivado
					</button>
					<button
						type="button"
						class="seg-btn"
						class:active={perfStore.videoAutoplay === 'wifi'}
						onclick={() => perfStore.setVideoAutoplay('wifi')}
					>
						Solo Wi-Fi
					</button>
					<button
						type="button"
						class="seg-btn"
						class:active={perfStore.videoAutoplay === 'always'}
						onclick={() => perfStore.setVideoAutoplay('always')}
					>
						Siempre
					</button>
				</div>
			</div>

			<div class="perf-setting-row">
				<div class="perf-setting-meta">
					<div class="perf-setting-name">Modo Ahorro de Datos en Imágenes y Video</div>
					<div class="perf-setting-desc">
						Pospone la descarga de vídeos hasta que pulses reproducir (`preload="none"`), evitando
						la precarga de medios pesados.
					</div>
				</div>
				<input
					type="checkbox"
					class="aero-toggle-switch"
					checked={perfStore.dataSaver}
					onchange={(e) => perfStore.setDataSaver(e.currentTarget.checked)}
					aria-label="Ahorro de Datos"
				/>
			</div>

			<div class="perf-setting-row">
				<div class="perf-setting-meta">
					<div class="perf-setting-name">Ahorro Automático con Batería Baja (≤20%)</div>
					<div class="perf-setting-desc">
						Sin cargador y con batería crítica activa el perfil Lite automáticamente y, al conectar
						corriente o recargar, restaura exactamente tu configuración anterior. Requiere soporte
						de la API de batería del navegador.
					</div>
				</div>
				<input
					type="checkbox"
					class="aero-toggle-switch"
					checked={perfStore.batterySaverAuto}
					onchange={(e) => perfStore.setBatterySaverAuto(e.currentTarget.checked)}
					aria-label="Ahorro Automático con Batería Baja"
				/>
			</div>
		</div>

		<!-- Grupo 4: Mantenimiento & Almacenamiento -->
		<div class="perf-settings-card glass-card">
			<div class="perf-group-header">
				<span class="material-icons-round perf-group-icon">cleaning_services</span>
				<span class="perf-group-title">Almacenamiento Local & Mantenimiento</span>
			</div>

			<div class="perf-storage-box">
				<div class="storage-info-row">
					<div>
						<div class="storage-title">Uso de Almacenamiento Local de la App</div>
						<div class="storage-sub">
							{#if perfStore.hardwareInfo.storageUsedMB !== null}
								Espacio utilizado: <strong>{perfStore.hardwareInfo.storageUsedMB} MB</strong>
								{#if perfStore.hardwareInfo.storageTotalMB}
									de ~{perfStore.hardwareInfo.storageTotalMB} MB disponibles
								{/if}
							{:else}
								Almacenamiento gestionado por el navegador
							{/if}
						</div>
					</div>
					<button
						type="button"
						class="btn-aero-secondary action-btn"
						disabled={clearingCache}
						onclick={handleClearCache}
					>
						<span class="material-icons-round">
							{clearingCache ? 'hourglass_empty' : 'delete_sweep'}
						</span>
						<span>{clearingCache ? 'Limpiando...' : 'Limpiar Caché & Storage'}</span>
					</button>
				</div>
				<p class="text-xs text-muted" style="margin-top: 8px;">
					* La limpieza profunda elimina imágenes en caché, fragments de Service Worker y feeds
					temporales sin cerrar tu sesión ni alterar tus preferencias.
				</p>
			</div>
		</div>

		<!-- Grupo 5: Herramientas para Desarrolladores -->
		<div class="perf-settings-card glass-card">
			<div class="perf-group-header">
				<span class="material-icons-round perf-group-icon">analytics</span>
				<span class="perf-group-title">Herramientas de Diagnóstico en Vivo</span>
			</div>

			<div class="perf-setting-row">
				<div class="perf-setting-meta">
					<div class="perf-setting-name">Monitor de FPS & Telemetría en Pantalla (HUD)</div>
					<div class="perf-setting-desc">
						Muestra un widget flotante en la esquina con contador de FPS en tiempo real, tiempo de
						cuadro (ms), nodos del DOM, latencia de red y memoria Heap JS.
					</div>
				</div>
				<input
					type="checkbox"
					class="aero-toggle-switch"
					checked={perfStore.fpsHud}
					onchange={(e) => perfStore.setFpsHud(e.currentTarget.checked)}
					aria-label="Monitor de FPS"
				/>
			</div>
		</div>
	</div>
</div>
