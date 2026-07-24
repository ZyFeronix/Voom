const fs = require('fs');
const path = require('path');

const readmePath = path.join(__dirname, '../README.md');
const docsPath = path.join(__dirname, '../DOCS.md');
const contributingPath = path.join(__dirname, '../CONTRIBUTING.md');
const licensePath = path.join(__dirname, '../LICENSE');

const outDir = path.join(__dirname, '../frontend/static/docs');
const outPath = path.join(outDir, 'index.html');

if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

const readme = fs.readFileSync(readmePath, 'utf-8');
const docs = fs.readFileSync(docsPath, 'utf-8');
const contributing = fs.readFileSync(contributingPath, 'utf-8');
const licenseText = fs.readFileSync(licensePath, 'utf-8');

// "Personality & SOUL.md" has spaces + an ampersand that break static serving.
// It is served under a URL-safe name (Personality-and-SOUL.md).
const SOUL_SAFE_NAME = 'Personality-and-SOUL.md';

const fixSoulLinks = (str) =>
    str.replace(/Personality\s*&\s*SOUL\.md/g, SOUL_SAFE_NAME)
       .replace(/Personality%20&%20SOUL\.md/g, SOUL_SAFE_NAME);

const readmeClean = fixSoulLinks(readme);
const docsClean = fixSoulLinks(docs);
const contributingClean = fixSoulLinks(contributing);

const html = `<!DOCTYPE html>
<html lang="es" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VSocial - Documentación Oficial</title>
    
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
    
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/dompurify/dist/purify.min.js"></script>
    
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    
    <style>
        :root {
            --bg-base: #0f172a;
            --primary: #00f2fe; /* Celeste aero */
            --primary-glow: #1b85f3;
            --success: #10b981; /* Green esmeralda */
            
            /* Glassmorphism 2.0 Tokens */
            --glass-surface: rgba(255, 255, 255, 0.08);
            --glass-border: rgba(255, 255, 255, 0.12);
            --glass-highlight: rgba(255, 255, 255, 0.25);
            --neon-primary: 0 0 15px rgba(27, 133, 243, 0.25);
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
                radial-gradient(circle at 50% 50%, rgba(0, 242, 254, 0.08) 0%, transparent 40%),
                radial-gradient(circle at 80% 20%, rgba(16, 185, 129, 0.05) 0%, transparent 30%);
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

        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 3rem;
            padding-bottom: 1.5rem;
            border-bottom: 1px solid var(--glass-border);
        }

        .logo {
            font-size: 2rem;
            font-weight: 700;
            background: linear-gradient(135deg, var(--text-main), var(--primary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-shadow: var(--neon-primary);
            letter-spacing: -0.05em;
        }

        .tabs {
            display: flex;
            gap: 1rem;
            background: var(--glass-surface);
            padding: 0.5rem;
            border-radius: 100px;
            border: 1px solid var(--glass-border);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
        }

        .tab-btn {
            background: transparent;
            border: none;
            color: var(--text-muted);
            padding: 0.75rem 1.5rem;
            border-radius: 100px;
            font-family: inherit;
            font-weight: 600;
            font-size: 0.95rem;
            cursor: pointer;
            transition: all 0.3s var(--ease-spring);
            position: relative;
            overflow: hidden;
        }

        .tab-btn:hover {
            color: var(--text-main);
        }

        .tab-btn.active {
            color: var(--text-main);
            background: rgba(255, 255, 255, 0.12);
            box-shadow: var(--neon-primary), inset 0 1px 0 var(--glass-highlight);
            text-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
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

        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            background: rgba(16, 185, 129, 0.1);
            color: var(--success);
            padding: 0.5rem 1rem;
            border-radius: 100px;
            font-weight: 500;
            font-size: 0.85rem;
            border: 1px solid rgba(16, 185, 129, 0.2);
            box-shadow: var(--neon-success);
        }

        .status-dot {
            width: 8px;
            height: 8px;
            background: var(--success);
            border-radius: 50%;
            box-shadow: 0 0 10px var(--success);
            animation: pulse-dot 2s infinite;
        }

        @keyframes pulse-dot {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.2); }
            100% { opacity: 1; transform: scale(1); }
        }

        @media (max-width: 768px) {
            header { flex-direction: column; gap: 1.5rem; align-items: flex-start; }
            .tabs { flex-wrap: wrap; width: 100%; justify-content: center; }
            .tab-btn { flex: 1; text-align: center; }
            .content-panel { padding: 1.5rem; }
            .license-pre { padding: 1.5rem; width: 100%; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div>
                <div class="logo">VSocial Docs</div>
                <div style="margin-top: 0.5rem;">
                    <div class="status-badge">
                        <div class="status-dot"></div>
                        Alpha v0.5 - Glassmorphism 2.0
                    </div>
                </div>
            </div>
            
            <div class="tabs">
                <button class="tab-btn active" data-target="readme">README</button>
                <button class="tab-btn" data-target="docs">Arquitectura (DOCS)</button>
                <button class="tab-btn" data-target="contributing">Contributing</button>
                <button class="tab-btn" data-target="license">Licencia</button>
            </div>
        </header>

        <main>
            <div id="readme" class="content-panel active markdown-body"></div>
            <div id="docs" class="content-panel markdown-body"></div>
            <div id="contributing" class="content-panel markdown-body"></div>
            <div id="license" class="content-panel markdown-body">
                <h1>Licencia y Protección Legal</h1>
                <p>Acuerdo de usuario, términos de uso de V-SOCIAL y protecciones de propiedad intelectual.</p>

                <h2>Licencia AGPLv3</h2>
                <p>V-SOCIAL es software libre bajo la Licencia Pública General Affero de GNU (AGPLv3). Esto garantiza libertades esenciales, pero impone obligaciones estrictamente respetadas:</p>
                <ul>
                    <li><strong>Código Abierto:</strong> Si distribuyes o modificas esta plataforma, debes compartir el código fuente resultante bajo la misma licencia.</li>
                    <li><strong>Uso en Red (cláusula §13):</strong> A diferencia de la GPLv3, la AGPLv3 exige que quien ponga una versión modificada de V-SOCIAL a disposición de usuarios a través de una red ofrezca también el código fuente a esos usuarios.</li>
                    <li><strong>Sin Garantía:</strong> El software se proporciona "tal cual", sin ninguna garantía implícita o explícita.</li>
                    <li><strong>Reconocimiento:</strong> Se debe mantener la atribución a los autores originales en todas las copias y derivados.</li>
                </ul>

                <p style="margin-top: 2rem;"><strong>Texto oficial completo de la licencia GNU AGPLv3:</strong></p>
                <div class="license-pre-container">
                    <pre class="license-pre"><code id="raw-license-text"></code></pre>
                </div>

                <h2>Protección Anti-Clonación (IP)</h2>
                <p>Más allá de la lógica de negocio cubierta por AGPLv3, la <strong>identidad visual, la marca y el sistema de diseño (Glassmorphism 2.0 / Neo-Aero)</strong> son propiedad intelectual exclusiva de V-SOCIAL.</p>
                <ul>
                    <li><strong>Identidad de Marca:</strong> No se permite el uso del nombre "V-SOCIAL", los logotipos, la tipografía distintiva ni el esquema de colores para engañar a usuarios o hacerse pasar por la plataforma oficial.</li>
                    <li><strong>Protección de Interfaz (Look & Feel):</strong> El clonado exacto de la interfaz de usuario con fines comerciales competidores está estrictamente prohibido sin autorización.</li>
                    <li><strong>Rate Limiting & Anti-Scraping:</strong> La infraestructura incluye protecciones activas. El scraping automatizado o la ingeniería inversa de los algoritmos de feeds privados se considerará un abuso de los términos de servicio.</li>
                </ul>

                <h2>Términos de Servicio (SLA)</h2>
                <p>Al utilizar o alojar una instancia de V-SOCIAL, te comprometes a seguir los estándares de ingeniería y respeto al usuario (<em>Anti-Caja Negra</em>).</p>
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
    <script type="text/markdown" id="md-contributing">\n${contributingClean.replace(/</g, '&lt;').replace(/>/g, '&gt;')}\n</script>
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
                renderMd('contributing');

                // Populate raw license code block
                const rawLic = document.getElementById('raw-license-content');
                if (rawLic) {
                    const codeEl = document.getElementById('raw-license-text');
                    if (codeEl) codeEl.textContent = decodeHtml(rawLic.innerHTML).trim();
                }

                const switchTab = (tabId, anchorId = '') => {
                    const tabBtn = document.querySelector(\`.tab-btn[data-target="\${tabId}"]\`);
                    if (!tabBtn) return;

                    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    tabBtn.classList.add('active');

                    document.querySelectorAll('.content-panel').forEach(p => {
                        p.classList.remove('active');
                        if (p.id === tabId) {
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

                        const isMdDoc = /^\\.?\\/?(README|DOCS|CONTRIBUTING)\\.md(#.*)?$/i.test(href);
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
                                    targetTab = 'license';
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
                                    const match = href.match(/^\\.?\\/?(README|DOCS|CONTRIBUTING)\\.md(#.*)?$/i);
                                    if (match) {
                                        const name = match[1].toLowerCase();
                                        targetTab = name === 'readme' ? 'readme' : name === 'docs' ? 'docs' : 'contributing';
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

                document.querySelectorAll('.tab-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const target = btn.getAttribute('data-target');
                        switchTab(target);
                    });
                });

                const handleInitialNavigation = () => {
                    const hash = window.location.hash.substring(1);
                    if (!hash) return;

                    if (['readme', 'docs', 'contributing', 'license'].includes(hash)) {
                        switchTab(hash);
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

const soulSrc = path.join(repoRoot, 'Personality & SOUL.md');
if (fs.existsSync(soulSrc)) {
    fs.copyFileSync(soulSrc, path.join(outDir, SOUL_SAFE_NAME));
    copied++;
} else {
    console.warn('[build_docs] referenced file not found, skipped: Personality & SOUL.md');
}

console.log(`[build_docs] copied ${copied} linked source file(s) into static/docs/`);
