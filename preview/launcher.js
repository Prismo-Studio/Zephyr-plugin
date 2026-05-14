/* Launcher preview controller.
 * Two modes via query string:
 *   ?theme=<slug>    → fetches /themes/<slug>/theme.css, applies to <body>,
 *                      lands on the Settings page so the dev sees the theme everywhere.
 *   ?feature=<slug>  → fetches /features/<slug>/manifest.json, injects an extra
 *                      sidebar item (using manifest.sidebarLabel), lands on it,
 *                      content area shows /features/<slug>/ui/index.html.
 * No query → defaults to theme mode (Settings page, no plugin loaded).
 */

const SIDEBAR_LABEL_MAX = 18;
const STYLE_ID = 'zp-active-theme';

const params = new URLSearchParams(location.search);
const themeSlug = params.get('theme') || params.get('slug');
const featureSlug = params.get('feature');
const mode = featureSlug ? 'feature' : 'theme';

const navEl = document.getElementById('z-nav');
const contentEl = document.getElementById('z-content');

let activeTarget = mode === 'feature' ? 'plugin' : 'settings';
let featureManifest = null;

function truncate(text, max) {
	if (!text) return '';
	if (text.length <= max) return text;
	return text.slice(0, max - 1) + '…';
}

function applyThemeCss(css, slug) {
	let style = document.getElementById(STYLE_ID);
	if (!style) {
		style = document.createElement('style');
		style.id = STYLE_ID;
		document.head.appendChild(style);
	}
	style.textContent = css;
	document.body.dataset.theme = slug;
}

async function loadTheme(slug) {
	try {
		const res = await fetch(`/themes/${slug}/theme.css`);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const css = await res.text();
		const idMatch = css.match(/\[data-theme=['"]([^'"]+)['"]\]/);
		applyThemeCss(css, idMatch ? idMatch[1] : slug);
	} catch (err) {
		console.warn(`could not load theme ${slug}: ${err.message}`);
	}
}

async function loadFeatureManifest(slug) {
	try {
		const res = await fetch(`/features/${slug}/manifest.json`);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		featureManifest = await res.json();
	} catch (err) {
		console.warn(`could not load feature ${slug}: ${err.message}`);
		featureManifest = null;
	}
}

function injectFeatureNavItem() {
	if (!featureManifest) return;
	const label = truncate(
		featureManifest.sidebarLabel || featureManifest.name,
		SIDEBAR_LABEL_MAX
	);

	// Insert before the Settings item so it sits among the regular nav.
	const settingsBtn = navEl.querySelector('[data-target="settings"]');
	const btn = document.createElement('button');
	btn.className = 'z-nav-item is-plugin';
	btn.dataset.target = 'plugin';
	btn.title = featureManifest.name;
	btn.innerHTML = `
		<iconify-icon class="z-nav-icon" icon="mdi:puzzle-outline"></iconify-icon>
		<span class="z-nav-label">${label}</span>
	`;
	navEl.insertBefore(btn, settingsBtn);
}

function setActive(target) {
	activeTarget = target;
	for (const btn of navEl.querySelectorAll('.z-nav-item')) {
		btn.classList.toggle('active', btn.dataset.target === target);
		const existing = btn.querySelector('.z-nav-indicator');
		if (existing) existing.remove();
		if (btn.dataset.target === target) {
			const ind = document.createElement('span');
			ind.className = 'z-nav-indicator';
			btn.appendChild(ind);
		}
	}
	render();
}

function render() {
	if (activeTarget === 'plugin' && featureManifest) {
		renderFeatureStage();
	} else if (activeTarget === 'settings') {
		renderSettings();
	} else {
		renderStub(activeTarget);
	}
}

function renderFeatureStage() {
	contentEl.innerHTML = `
		<div class="z-feature-stage">
			<div class="z-feature-stage-header">
				<h1>${escapeHtml(featureManifest.name)}</h1>
				<p>${escapeHtml(featureManifest.description ?? '')}</p>
			</div>
			<div class="z-feature-stage-shell" id="z-feature-shell"></div>
		</div>
	`;
	const shell = document.getElementById('z-feature-shell');
	const iframe = document.createElement('iframe');
	iframe.src = `/features/${featureManifest.id}/ui/index.html`;
	iframe.onerror = () => {
		shell.innerHTML =
			'<div class="z-feature-stage-empty">no ui/index.html — create one to mount your component</div>';
	};
	shell.appendChild(iframe);
}

function renderSettings() {
	const themeCards = [
		{ id: 'dark', name: 'Dark (default)', a: '#080e1a', b: '#1afffa', c: '#eaf0f6' },
		{ id: 'light', name: 'Light', a: '#f4f7fa', b: '#00b3ae', c: '#1a2438' },
		{ id: 'pinky', name: 'Pinky', a: '#1a0d1f', b: '#ff5cae', c: '#fce8f3' },
		{ id: 'hot-dog', name: 'Hot Dog Stand', a: '#ff0000', b: '#ffff00', c: '#000000' }
	];

	if (themeSlug && featureManifest === null) {
		const slug = themeSlug;
		themeCards.unshift({
			id: slug,
			name: 'Your theme',
			a: 'var(--bg-base)',
			b: 'var(--accent-400)',
			c: 'var(--text-primary)',
			active: true
		});
	}

	const cards = themeCards
		.map(
			(t, i) => `
		<button class="z-theme-option ${t.active || (i === 0 && !themeSlug) ? 'active' : ''}" data-theme="${t.id}">
			<div class="z-theme-preview" ${t.id !== 'your-theme' ? `style="background:${t.a}"` : ''}>
				<span style="background:${t.b}"></span>
				<span style="background:${t.c}"></span>
				<span style="background:${t.a}"></span>
			</div>
			<span class="z-theme-option-name">${t.name}</span>
		</button>
	`
		)
		.join('');

	contentEl.innerHTML = `
		<div class="z-settings-page">
			<div class="z-settings-content">
				<h1>Settings</h1>

				<section class="z-settings-section">
					<h3 class="z-settings-heading">
						<iconify-icon icon="mdi:palette"></iconify-icon>
						Appearance
					</h3>
					<div class="z-theme-carousel-wrap">
						<button class="z-carousel-nav" data-dir="-1"><iconify-icon icon="mdi:chevron-left"></iconify-icon></button>
						<div class="z-theme-carousel" id="z-theme-carousel">${cards}</div>
						<button class="z-carousel-nav" data-dir="1"><iconify-icon icon="mdi:chevron-right"></iconify-icon></button>
					</div>
				</section>

				<section class="z-settings-section">
					<h3 class="z-settings-heading">
						<iconify-icon icon="mdi:translate"></iconify-icon>
						Language
					</h3>
					<div class="z-pref-row">
						<div class="z-pref-row-text">
							<p class="z-pref-row-title">Interface language</p>
							<p class="z-pref-row-desc">Restart required for some elements to update.</p>
						</div>
						<select class="z-select">
							<option>English</option>
							<option>Français</option>
							<option>Español</option>
							<option>日本語</option>
						</select>
					</div>
				</section>

				<section class="z-settings-section">
					<h3 class="z-settings-heading">
						<iconify-icon icon="mdi:store-search"></iconify-icon>
						Sources
					</h3>
					<div class="z-pref-row">
						<div class="z-pref-row-text">
							<p class="z-pref-row-title">Zephyr Mods</p>
							<p class="z-pref-row-desc">Curated community mods from the Zephyr Mods registry.</p>
						</div>
						<button class="z-toggle on" aria-pressed="true"></button>
					</div>
					<div class="z-pref-row">
						<div class="z-pref-row-text">
							<p class="z-pref-row-title">CurseForge</p>
							<p class="z-pref-row-desc">Include CurseForge results when browsing mods.</p>
						</div>
						<button class="z-toggle" aria-pressed="false"></button>
					</div>
				</section>

				<section class="z-settings-section">
					<h3 class="z-settings-heading">
						<iconify-icon icon="mdi:cog"></iconify-icon>
						Behavior
					</h3>
					<div class="z-pref-row">
						<div class="z-pref-row-text">
							<p class="z-pref-row-title">Fetch mods automatically</p>
							<p class="z-pref-row-desc">Refresh the catalog every 15 minutes.</p>
						</div>
						<button class="z-toggle on" aria-pressed="true"></button>
					</div>
					<div class="z-pref-row">
						<div class="z-pref-row-text">
							<p class="z-pref-row-title">Pull before launch</p>
							<p class="z-pref-row-desc">Sync remote profile changes before each game launch.</p>
						</div>
						<button class="z-toggle" aria-pressed="false"></button>
					</div>
				</section>

				${
					mode === 'theme'
						? `
				<div class="z-loader-card">
					<h4>Theme dev tools</h4>
					<p>Editing <code>themes/${themeSlug || '&lt;slug&gt;'}/theme.css</code>. Refresh this page to apply changes.</p>
				</div>
				`
						: ''
				}
			</div>
		</div>
	`;

	// Wire toggles
	for (const t of contentEl.querySelectorAll('.z-toggle')) {
		t.addEventListener('click', () => t.classList.toggle('on'));
	}
	// Wire carousel nav
	for (const btn of contentEl.querySelectorAll('.z-carousel-nav')) {
		btn.addEventListener('click', () => {
			const track = document.getElementById('z-theme-carousel');
			track?.scrollBy({ left: 200 * Number(btn.dataset.dir), behavior: 'smooth' });
		});
	}
}

function renderStub(target) {
	const titles = {
		dashboard: 'Home',
		mods: 'Mods',
		browse: 'Browse',
		profiles: 'Profiles',
		config: 'Config',
		plugins: 'Plugins'
	};
	contentEl.innerHTML = `
		<div class="z-feature-stub">
			This is the ${escapeHtml(titles[target] ?? target)} page in the real Zephyr launcher. Click the
			${
				mode === 'feature'
					? 'highlighted plugin item'
					: 'Settings item'
			} in the sidebar to go back to your preview.
		</div>
	`;
}

function escapeHtml(s) {
	if (s == null) return '';
	return String(s)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

navEl.addEventListener('click', (e) => {
	const btn = e.target.closest('.z-nav-item');
	if (!btn) return;
	setActive(btn.dataset.target);
});

async function bootstrap() {
	if (mode === 'feature' && featureSlug) {
		await loadFeatureManifest(featureSlug);
		injectFeatureNavItem();
		setActive('plugin');
	} else {
		if (themeSlug) await loadTheme(themeSlug);
		setActive('settings');
	}
	connectHotReload();
}

// Subscribe to filesystem change events from preview.mjs and react granularly:
//  - theme.css of the active theme  → swap the <style> tag (no flash)
//  - feature ui/ files              → reload only the iframe
//  - manifest changes               → full page reload (sidebar label etc.)
//  - anything in /preview/          → full page reload (preview source updated)
function connectHotReload() {
	const src = new EventSource('/preview/_events');
	src.addEventListener('message', async (e) => {
		let evt;
		try {
			evt = JSON.parse(e.data);
		} catch {
			return;
		}
		const path = evt.path || '';

		if (themeSlug && path === `themes/${themeSlug}/theme.css`) {
			await loadTheme(themeSlug);
			return;
		}

		if (featureSlug && path.startsWith(`features/${featureSlug}/ui/`)) {
			const iframe = document.querySelector('#z-feature-shell iframe');
			if (iframe) {
				iframe.src = iframe.src.split('?')[0] + `?t=${Date.now()}`;
			}
			return;
		}

		if (
			(featureSlug && path === `features/${featureSlug}/manifest.json`) ||
			path.startsWith('preview/')
		) {
			location.reload();
		}
	});
	src.addEventListener('error', () => {
		// Connection dropped (server killed). EventSource auto-retries, no action needed.
	});
}

bootstrap();
