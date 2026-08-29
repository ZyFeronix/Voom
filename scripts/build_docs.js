const fs = require('fs');
const path = require('path');

const readmePath = path.join(__dirname, '../README.md');
const docsPath = path.join(__dirname, '../DOCS.md');
const architecturePath = path.join(__dirname, '../ARCHITECTURE.md');
const contributingPath = path.join(__dirname, '../CONTRIBUTING.md');
const changelogPath = path.join(__dirname, '../CHANGELOG.md');
const licensePath = path.join(__dirname, '../LICENSE');

const outDir = path.join(__dirname, '../frontend/static/docs');
const outPath = path.join(outDir, 'index.html');

if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

const readme = fs.readFileSync(readmePath, 'utf-8');
const docs = fs.readFileSync(docsPath, 'utf-8');
const architecture = fs.readFileSync(architecturePath, 'utf-8');
const contributing = fs.readFileSync(contributingPath, 'utf-8');
const changelog = fs.readFileSync(changelogPath, 'utf-8');
const licenseText = fs.readFileSync(licensePath, 'utf-8');

const readmeClean = readme;
const docsClean = docs;
const architectureClean = architecture;
const contributingClean = contributing;
const changelogClean = changelog;

// Rebranding note: explain the VSocial → Voom! transition
const rebrandingNote = `# Rebranding: VSocial → Voom!

**Voom!** es el nuevo nombre de la plataforma anteriormente conocida como **VSocial** (o **V-SOCIAL**). El rebranding se completó en agosto de 2026.

## Qué cambió

- **Nombre de marca**: "VSocial" / "V-SOCIAL" → **"Voom!"** en toda la interfaz de usuario, documentación, emails y metadatos.
- **Dominio**: \`vsocial.app\` → \`voom.social\` (emails: \`noreply@voom.social\`).
- **Assets**: Nuevo logo.svg con tipografía Outfit y efecto glassmorphism Neo-Aero; favicon actualizado.
- **Configuración**: \`package.json\` nombra ahora \`voom\`; contenedores y volúmenes Docker pasan a llamarse \`voom_app\` / \`voom_data\`.
- **Docs**: Todos los archivos .md, el manual de marca (DOCS_BRAND_ZYFERONYX.md) y el portal de documentación reflejan el nuevo nombre.

## Qué se preservó (para compatibilidad)

- **Claves de localStorage**: Las ~50 claves con prefijo \`vsocial_*\` (incluyendo \`vsocial_token\` para auth) **no se migraron**. Se conservaron para mantener la compatibilidad con usuarios existentes — renombrarlas requeriría una migración en el cliente que rompería sesiones activas.
- **Clases CSS**: Los selectores \`.vsocial\`, \`.vs-brand__logo\`, \`.vsocial-col\` etc. permanecen sin cambios para no romper el sistema de estilos existente.
- **Migraciones históricas**: Los archivos en \`migrations/*.sql\` conservan las menciones originales a VSocial como registro histórico.
- **Cache del service worker**: El nombre de caché \`vsocial-cache-{version}\` se preserva para evitar crear caches obsoletas en navegadores de usuarios existentes.
- **Cookie de consentimiento**: \`vsocial_cookie_consent\` mantiene su nombre técnico por cumplimiento RGPD.

> **ZyFeronyx DevStudio** sigue siendo el estudio creador. La identidad visual pasa de verde cian eléctrico a un esquema de neón azul-eléctrico con acentos de menta, manteniendo la estética **Glassmorphism 2.0 + Neo-Aero**.
`;

const html = `<!DOCTYPE html>
<html lang="es" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Voom! - Documentación Oficial</title>
    
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
    
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/dompurify/dist/purify.min.js"></script>
    
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    
    <style>
        :root {
            --bg-base: #040d17; /* Voom! Midnight Cyberspace */
            --primary: #00d4aa; /* Voom! Aero Teal */
            --primary-glow: #1b85f3; /* Voom! Electric Azure */
            --success: #10b981; /* Green esmeralda */
            
            /* Glassmorphism 2.0 Tokens */
            --glass-surface: rgba(8, 27, 46, 0.65);
            --glass-border: rgba(0, 212, 170, 0.3);
            --glass-highlight: rgba(255, 255, 255, 0.45);
            --neon-primary: 0 0 20px rgba(0, 212, 170, 0.4), 0 0 40px rgba(27, 133, 243, 0.2);
            --neon-success: 0 0 15px rgba(16, 185, 129, 0.25);
            
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            
            --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
            --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg-base);
            color: var(--text-main);
            line-height: 1.6;
            min-height: 100vh;
            overflow-x: hidden;
            position: relative;
        }

        body::before {
            content: '';
            position: fixed;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: 
                radial-gradient(circle at 50% 50%, rgba(0, 212, 170, 0.12) 0%, transparent 40%),
                radial-gradient(circle at 80% 20%, rgba(16, 185, 129, 0.08) 0%, transparent 30%);
            z-index: -1;
            animation: liquid-rotate 30s linear infinite;
            pointer-events: none;
        }

        @keyframes liquid-rotate {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
            position: relative;
            z-index: 1;
        }

        .docs-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            padding: 12px 24px;
            width: 100%;
            box-sizing: border-box;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            margin-bottom: 2rem;
        }

        /* 1. MARCA */
        .docs-brand {
            display: flex;
            flex-direction: column;
            gap: 2px;
            flex-shrink: 0; /* 👈 Impide que se comprima */
        }

        .docs-brand-row {
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }

        .docs-brand .logo {
            font-size: 1.35rem;
            font-weight: 900;
            color: #00d2ff;
            letter-spacing: -0.02em;
            line-height: 1;
        }

        .docs-brand .version-badge {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 2px 7px;
            background: rgba(0, 210, 255, 0.08);
            border: 1px solid rgba(0, 210, 255, 0.25);
            border-radius: 999px;
            font-size: 0.68rem;
            font-family: var(--font-mono, monospace);
            color: #7dd3fc;
            white-space: nowrap;
        }

        .docs-brand .version-badge .dot {
            width: 5px;
            height: 5px;
            border-radius: 50%;
            background: #10b981;
            box-shadow: 0 0 5px #10b981;
            flex-shrink: 0;
        }

        .docs-brand .docs-subtitle {
            font-size: 0.72rem;
            color: rgba(255, 255, 255, 0.45);
        }

        /* 2. CÁPSULA UNIFICADA DE PESTAÑAS */
        .docs-nav-bar {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 3px 5px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 999px; /* Cápsula contenedora */
            backdrop-filter: blur(8px);
            flex-shrink: 0; /* 👈 CRUCIAL: impide que caiga a segunda fila */
            white-space: nowrap;
        }

        /* Pestaña individual */
        .nav-tab {
            background: transparent;
            border: none;
            padding: 5px 12px;
            border-radius: 999px;
            font-size: 0.78rem;
            font-weight: 500;
            color: rgba(255, 255, 255, 0.6);
            cursor: pointer;
            transition: all 0.15s ease;
            white-space: nowrap;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
        }

        .nav-tab:hover {
            color: #ffffff;
            background: rgba(255, 255, 255, 0.06);
        }

        /* Pestaña activa con Aqua Glow */
        .nav-tab.active {
            background: rgba(255, 255, 255, 0.12);
            color: #ffffff !important;
            font-weight: 600;
            border: 1px solid rgba(0, 210, 255, 0.4);
            box-shadow: 0 0 10px rgba(0, 210, 255, 0.3);
        }

        .content-panel {
            background: var(--glass-surface);
            border: 1px solid var(--glass-border);
            border-radius: 24px;
            padding: 3rem;
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 var(--glass-highlight);
            min-height: 60vh;
            display: none;
            animation: fade-in-up 0.5s var(--ease-spring) forwards;
        }

        .content-panel.active {
            display: block;
        }

        @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .markdown-body {
            color: var(--text-main);
            font-size: 1.05rem;
        }

        .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
            margin-top: 2.5rem;
            margin-bottom: 1rem;
            font-weight: 600;
            line-height: 1.25;
            color: #fff;
            scroll-margin-top: 2rem;
        }

        .markdown-body h1 {
            font-size: 2.5rem;
            border-bottom: 1px solid var(--glass-border);
            padding-bottom: 0.5rem;
            margin-top: 0;
            background: linear-gradient(to right, #fff, var(--primary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .markdown-body h2 {
            font-size: 1.8rem;
            border-bottom: 1px dashed var(--glass-border);
            padding-bottom: 0.3rem;
            color: var(--primary);
        }

        .markdown-body h3 { font-size: 1.4rem; color: var(--success); }

        .markdown-body p { margin-bottom: 1.2rem; color: #cbd5e1; }
        
        .markdown-body a {
            color: var(--primary);
            text-decoration: none;
            transition: all 0.2s;
            border-bottom: 1px solid transparent;
            cursor: pointer;
        }
        
        .markdown-body a:hover {
            border-bottom-color: var(--primary);
            text-shadow: var(--neon-primary);
        }

        .markdown-body ul, .markdown-body ol {
            margin-bottom: 1.2rem;
            padding-left: 1.5rem;
            color: #cbd5e1;
        }

        .markdown-body li { margin-bottom: 0.4rem; }

        .markdown-body blockquote {
            border-left: 4px solid var(--primary);
            padding: 1rem 1.5rem;
            margin: 1.5rem 0;
            background: rgba(0, 242, 254, 0.05);
            border-radius: 0 12px 12px 0;
            color: var(--text-muted);
            font-style: italic;
        }

        .markdown-body table {
            width: 100%;
            border-collapse: collapse;
            margin: 2rem 0;
            background: rgba(0,0,0,0.2);
            border-radius: 12px;
            overflow: hidden;
            border: 1px solid var(--glass-border);
        }

        .markdown-body th, .markdown-body td {
            padding: 1rem;
            text-align: left;
            border-bottom: 1px solid var(--glass-border);
        }

        .markdown-body th {
            background: rgba(255,255,255,0.05);
            font-weight: 600;
            color: var(--primary);
        }
        
        .markdown-body tr:last-child td { border-bottom: none; }
        .markdown-body tr:hover td { background: rgba(255,255,255,0.02); }

        .markdown-body pre {
            background: #0d1117 !important;
            border: 1px solid var(--glass-border);
            border-radius: 12px;
            padding: 1.5rem;
            overflow-x: auto;
            margin: 1.5rem 0;
            box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);
        }

        .markdown-body pre code {
            font-family: 'Fira Code', monospace;
            font-size: 0.9rem;
            background: transparent !important;
            padding: 0;
        }

        .markdown-body code {
            font-family: 'Fira Code', monospace;
            background: rgba(255,255,255,0.1);
            padding: 0.2rem 0.4rem;
            border-radius: 6px;
            font-size: 0.85em;
            color: #e2e8f0;
        }

        .markdown-body hr {
            border: none;
            height: 1px;
            background: linear-gradient(to right, transparent, var(--glass-border), transparent);
            margin: 3rem 0;
        }

        /* Perfectly Centered License Code Box */
        .license-pre-container {
            display: flex;
            justify-content: center;
            width: 100%;
            margin: 2rem 0;
        }

        .license-pre {
            background: #0d1117 !important;
            border: 1px solid var(--glass-border);
            border-radius: 16px;
            padding: 2.5rem;
            margin: 0 auto;
            width: fit-content;
            max-width: 100%;
            box-shadow: inset 0 2px 20px rgba(0,0,0,0.6), 0 10px 30px rgba(0,0,0,0.3);
            text-align: left;
            overflow-x: auto;
        }

        .license-pre code {
            font-family: 'Fira Code', monospace;
            font-size: 0.9em;
            color: #a8b2d1;
            line-height: 1.6;
            white-space: pre;
            display: block;
        }

        @keyframes pulse-dot {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.2); }
            100% { opacity: 1; transform: scale(1); }
        }

        @media (max-width: 768px) {
            .docs-header { flex-direction: column; gap: 1rem; align-items: flex-start; }
            .docs-nav-bar { flex-wrap: wrap; gap: 4px; }
            .nav-tab { flex: 1; text-align: center; font-size: 0.72rem; padding: 4px 8px; }
            .content-panel { padding: 1.5rem; }
            .license-pre { padding: 1.5rem; width: 100%; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="docs-header">
            <!-- MARCA IZQUIERDA -->
            <div class="docs-brand">
                <div class="docs-brand-row">
                    <span class="logo">Voom!</span>
                    <span class="version-badge">
                        <span class="dot"></span>
                        <span>v0.6.0-beta.2</span>
                    </span>
                </div>
                <span class="docs-subtitle">Documentación Oficial &amp; Guías</span>
            </div>

            <!-- BARRA DE PESTAÑAS EN CÁPSULA (Derecha) -->
            <nav class="docs-nav-bar">
                <a href="#readme" class="nav-tab active">README</a>
                <a href="#doc" class="nav-tab">Documentación</a>
                <a href="#arch" class="nav-tab">Arquitectura</a>
                <a href="#contrib" class="nav-tab">Contributing</a>
                <a href="#changelog" class="nav-tab">Changelog</a>
                <a href="#rebrand" class="nav-tab">Rebranding</a>
                <a href="#licencia" class="nav-tab">Licencia</a>
            </nav>
        </header>

            <main>
            <div id="readme" class="content-panel active markdown-body"></div>
            <div id="docs" class="content-panel markdown-body"></div>
            <div id="architecture" class="content-panel markdown-body"></div>
            <div id="contributing" class="content-panel markdown-body"></div>
            <div id="changelog" class="content-panel markdown-body"></div>
            <div id="rebranding" class="content-panel markdown-body"></div>
            <div id="license" class="content-panel markdown-body">
                <h1>Licencia y Protección Legal</h1>
                <p>Acuerdo de usuario, términos de uso de Voom! y protecciones de propiedad intelectual.</p>

                <h2>Licencia AGPLv3</h2>
                <p>Voom! es software libre bajo la Licencia Pública General Affero de GNU (AGPLv3). Esto garantiza libertades esenciales, pero impone obligaciones estrictamente respetadas:</p>
                <ul>
                    <li><strong>Código Abierto:</strong> Si distribuyes o modificas esta plataforma, debes compartir el código fuente resultante bajo la misma licencia.</li>
                    <li><strong>Uso en Red (cláusula §13):</strong> A diferencia de la GPLv3, la AGPLv3 exige que quien ponga una versión modificada de Voom! a disposición de usuarios a través de una red ofrezca también el código fuente a esos usuarios.</li>
                    <li><strong>Sin Garantía:</strong> El software se proporciona "tal cual", sin ninguna garantía implícita o explícita.</li>
                    <li><strong>Reconocimiento:</strong> Se debe mantener la atribución a los autores originales en todas las copias y derivados.</li>
                </ul>

                <p style="margin-top: 2rem;"><strong>Texto oficial completo de la licencia GNU AGPLv3:</strong></p>
                <div class="license-pre-container">
                    <pre class="license-pre"><code id="raw-license-text"></code></pre>
                </div>

                <h2>Protección Anti-Clonación (IP)</h2>
                <p>Más allá de la lógica de negocio cubierta por AGPLv3, la <strong>identidad visual, la marca y el sistema de diseño (Glassmorphism 2.0 / Neo-Aero)</strong> son propiedad intelectual exclusiva de Voom!.</p>
                <ul>
                    <li><strong>Identidad de Marca:</strong> No se permite el uso del nombre "Voom!", los logotipos, la tipografía distintiva ni el esquema de colores para engañar a usuarios o hacerse pasar por la plataforma oficial.</li>
                    <li><strong>Protección de Interfaz (Look & Feel):</strong> El clonado exacto de la interfaz de usuario con fines comerciales competidores está estrictamente prohibido sin autorización.</li>
                    <li><strong>Rate Limiting & Anti-Scraping:</strong> La infraestructura incluye protecciones activas. El scraping automatizado o la ingeniería inversa de los algoritmos de feeds privados se considerará un abuso de los términos de servicio.</li>
                </ul>

                <h2>Términos de Servicio (SLA)</h2>
                <p>Al utilizar o alojar una instancia de Voom!, te comprometes a seguir los estándares de ingeniería y respeto al usuario (<em>Anti-Caja Negra</em>).</p>
                <ul>
                    <li><strong>Privacidad del Usuario:</strong> Los feeds de Radar y Descubrimiento no deben ser manipulados con algoritmos ocultos.</li>
                    <li><strong>Uso Responsable:</strong> Queda prohibido el uso de la plataforma para distribuir malware, contenido ilícito o esquemas de fraude.</li>
                </ul>
                <blockquote>
                    Los <a href="/terms" target="_blank" rel="noopener noreferrer">Términos de Servicio completos</a> y la
                    <a href="/privacy" target="_blank" rel="noopener noreferrer">Política de Privacidad</a> (incluido el cumplimiento RGPD de la UE)
                    están disponibles en sus páginas dedicadas. Esta sección es un resumen de los
                    principios de ingeniería; en caso de conflicto, prevalecen las páginas legales oficiales.
                </blockquote>
            </div>
        </main>
    </div>

    <!-- Raw Markdown Content (Escaped for JS Injection) -->
    <script type="text/markdown" id="md-readme">\n${readmeClean.replace(/</g, '&lt;').replace(/>/g, '&gt;')}\n</script>
    <script type="text/markdown" id="md-docs">\n${docsClean.replace(/</g, '&lt;').replace(/>/g, '&gt;')}\n</script>
    <script type="text/markdown" id="md-architecture">\n${architectureClean.replace(/</g, '&lt;').replace(/>/g, '&gt;')}\n</script>
    <script type="text/markdown" id="md-contributing">\n${contributingClean.replace(/</g, '&lt;').replace(/>/g, '&gt;')}\n</script>
    <script type="text/markdown" id="md-changelog">\n${changelogClean.replace(/</g, '&lt;').replace(/>/g, '&gt;')}\n</script>
    <script type="text/markdown" id="md-rebranding">\n${rebrandingNote.replace(/</g, '&lt;').replace(/>/g, '&gt;')}\n</script>
    <script type="text/plain" id="raw-license-content">\n${licenseText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}\n</script>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            try {
                marked.setOptions({
                    highlight: function(code, lang) {
                        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                        return hljs.highlight(code, { language }).value;
                    },
                    langPrefix: 'hljs language-',
                    gfm: true,
                    breaks: true
                });

                // Slugify function robust to markdown formatting, code ticks, and links
                const slugify = (text) =>
                    String(text)
                        .replace(/\`([^\`]+)\`/g, '$1')
                        .replace(/\\[([^\\]]+)\\]\\([^)]+\\)/g, '$1')
                        .toLowerCase()
                        .replace(/<[^>]+>/g, '')
                        .replace(/&[a-z]+;/g, '')
                        .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
                        .replace(/[^\\w\\s-]/g, '')
                        .trim()
                        .replace(/\\s+/g, '-');

                const renderer = new marked.Renderer();
                renderer.heading = function (arg1, arg2, arg3) {
                    let text = typeof arg1 === 'object' ? arg1.text : arg1;
                    let depth = typeof arg1 === 'object' ? arg1.depth : arg2;
                    let tokens = typeof arg1 === 'object' ? arg1.tokens : null;

                    const slug = slugify(text || '');
                    let inner = text || '';
                    if (tokens && this.parser) {
                        inner = this.parser.parseInline(tokens);
                    } else if (typeof marked.parseInline === 'function') {
                        inner = marked.parseInline(text || '');
                    }
                    return \`<h\${depth} id="\${slug}">\${inner}</h\${depth}>\`;
                };
                marked.use({ renderer });

                function decodeHtml(html) {
                    var txt = document.createElement("textarea");
                    txt.innerHTML = html;
                    return txt.value;
                }

                const renderMd = (id) => {
                    const el = document.getElementById(\`md-\${id}\`);
                    if (!el) return;
                    const raw = el.innerHTML;
                    const decoded = decodeHtml(raw);
                    const parsedHtml = marked.parse(decoded);
                    const cleanHtml = DOMPurify.sanitize(parsedHtml, { ADD_ATTR: ['target', 'id'] });
                    const targetEl = document.getElementById(id);
                    if (targetEl) targetEl.innerHTML = cleanHtml;
                };

                renderMd('readme');
                renderMd('docs');
                renderMd('architecture');
                renderMd('contributing');
                renderMd('changelog');
                renderMd('rebranding');

                // Populate raw license code block
                const rawLic = document.getElementById('raw-license-content');
                if (rawLic) {
                    const codeEl = document.getElementById('raw-license-text');
                    if (codeEl) codeEl.textContent = decodeHtml(rawLic.innerHTML).trim();
                }

                // Map hrefs abreviados → IDs de content-panel
                const tabMap = {
                    'readme': 'readme',
                    'doc': 'docs',
                    'arch': 'architecture',
                    'contrib': 'contributing',
                    'changelog': 'changelog',
                    'rebrand': 'rebranding',
                    'licencia': 'license'
                };

                const switchTab = (tabId, anchorId = '') => {
                    const panelId = tabMap[tabId] || tabId;
                    const navTab = document.querySelector(\`.nav-tab[href="#\${tabId}"]\`);
                    if (!navTab) return;

                    document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
                    navTab.classList.add('active');

                    document.querySelectorAll('.content-panel').forEach(p => {
                        p.classList.remove('active');
                        if (p.id === panelId) {
                            p.style.animation = 'none';
                            p.offsetHeight;
                            p.style.animation = null;
                            p.classList.add('active');
                        }
                    });

                    const targetHash = anchorId ? \`#\${anchorId}\` : \`#\${tabId}\`;
                    if (window.location.hash !== targetHash) {
                        history.pushState(null, '', targetHash);
                    }

                    if (anchorId) {
                        setTimeout(() => {
                            const elem = document.getElementById(anchorId);
                            if (elem) {
                                elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                        }, 50);
                    } else {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                };

                const setupLinks = () => {
                    document.querySelectorAll('.markdown-body a').forEach(link => {
                        const href = link.getAttribute('href');
                        if (!href) return;

                        const isMdDoc = /^\\.?\\/?(README|DOCS|ARCHITECTURE|CONTRIBUTING)\\.md(#.*)?$/i.test(href);
                        const isLicenseLink = /^(\\.\\/)?LICENSE$/i.test(href) || 
                                              href.includes('license.html') || 
                                              href.includes('/docs/license');
                        const isHashLink = href.startsWith('#');

                        if (isMdDoc || isLicenseLink || isHashLink) {
                            link.addEventListener('click', (e) => {
                                e.preventDefault();
                                let targetTab = 'readme';
                                let anchorId = '';

                                if (isLicenseLink) {
                                    targetTab = 'licencia';
                                } else if (isHashLink) {
                                    anchorId = href.substring(1);
                                    const targetElem = document.getElementById(anchorId);
                                    if (targetElem) {
                                        const parentPanel = targetElem.closest('.content-panel');
                                        if (parentPanel) targetTab = parentPanel.id;
                                    } else {
                                        targetTab = document.querySelector('.content-panel.active')?.id || 'readme';
                                    }
                                } else {
                                    const match = href.match(/^\\.?\\/?(README|DOCS|ARCHITECTURE|CONTRIBUTING|CHANGELOG)\\.md(#.*)?$/i);
                                    if (match) {
                                        const name = match[1].toLowerCase();
                                        // Map panel IDs to nav-tab hrefs
                                        const panelToHref = {
                                            'readme': 'readme',
                                            'docs': 'doc',
                                            'architecture': 'arch',
                                            'contributing': 'contrib',
                                            'changelog': 'changelog'
                                        };
                                        targetTab = panelToHref[name] || name;
                                        if (match[2]) anchorId = match[2].substring(1);
                                    }
                                }

                                switchTab(targetTab, anchorId);
                            });
                        } else {
                            link.setAttribute('target', '_blank');
                            link.setAttribute('rel', 'noopener noreferrer');
                        }
                    });
                };

                setupLinks();

                document.querySelectorAll('.nav-tab').forEach(tab => {
                    tab.addEventListener('click', (e) => {
                        e.preventDefault();
                        const href = tab.getAttribute('href').substring(1);
                        switchTab(href);
                    });
                });

                const handleInitialNavigation = () => {
                    const hash = window.location.hash.substring(1);
                    if (!hash) return;

                    // Check if hash matches a nav-tab href (abreviado) or panel ID
                    const validTabs = ['readme', 'doc', 'docs', 'arch', 'architecture', 'contrib', 'contributing', 'changelog', 'rebrand', 'rebranding', 'licencia', 'license'];
                    if (validTabs.includes(hash)) {
                        // Convert panel ID to nav-tab href
                        const panelToHref = {
                            'readme': 'readme',
                            'docs': 'doc',
                            'architecture': 'arch',
                            'contributing': 'contrib',
                            'changelog': 'changelog',
                            'rebranding': 'rebrand',
                            'license': 'licencia'
                        };
                        switchTab(panelToHref[hash] || hash);
                        return;
                    }

                    const targetElem = document.getElementById(hash);
                    if (targetElem) {
                        const parentPanel = targetElem.closest('.content-panel');
                        if (parentPanel) {
                            switchTab(parentPanel.id, hash);
                        }
                    }
                };

                window.addEventListener('hashchange', handleInitialNavigation);
                handleInitialNavigation();
            } catch (err) {
                console.error('Error initializing docs portal JS:', err);
            }
        });
    </script>
</body>
</html>`;

fs.writeFileSync(outPath, html, 'utf-8');
console.log('Documentation portal built at ' + outPath);

// Copy referenced files into static/docs/
const repoRoot = path.join(__dirname, '..');
const linkedFiles = [
    'README.md',
    'DOCS.md',
    'ARCHITECTURE.md',
    'CHANGELOG.md',
    'CONTRIBUTING.md',
    'PACKAGING.md',
    'DOCS_BRAND_ZYFERONYX.md',
    'schema_sqlite.sql',
    '.env.example',
    'LICENSE'
];

let copied = 0;
for (const file of linkedFiles) {
    const src = path.join(repoRoot, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(outDir, file));
        copied++;
    } else {
        console.warn(`[build_docs] referenced file not found, skipped: ${file}`);
    }
}

console.log(`[build_docs] copied ${copied} linked source file(s) into static/docs/`);
