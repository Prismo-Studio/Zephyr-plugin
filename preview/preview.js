// Theme preview controller. Pulls a theme.css from one of three sources
// (URL ?path=, drag-and-drop, file picker, or paste box), figures out the
// data-theme id by parsing the CSS, and applies it to the page.

const STYLE_ID = 'zp-active-theme';
const TOKEN_NAMES = [
	'--bg-base',
	'--bg-surface',
	'--bg-elevated',
	'--bg-overlay',
	'--bg-hover',
	'--bg-active',
	'--border-subtle',
	'--border-default',
	'--border-strong',
	'--border-accent',
	'--text-primary',
	'--text-secondary',
	'--text-muted',
	'--text-accent',
	'--text-inverse',
	'--accent-300',
	'--accent-400',
	'--accent-500',
	'--accent-600',
	'--accent-700',
	'--success',
	'--warning',
	'--error',
	'--info',
	'--glass-bg',
	'--glass-border'
];

const status = document.getElementById('zp-active');
const overlay = document.getElementById('zp-drop-overlay');
const tokensEl = document.getElementById('zp-tokens');

function parseThemeId(css) {
	// Pull the first [data-theme='X'] selector from the CSS so the page can
	// activate the theme without the user telling us its id.
	const match = css.match(/\[data-theme=['"]([^'"]+)['"]\]/);
	return match ? match[1] : null;
}

function applyTheme(css) {
	let style = document.getElementById(STYLE_ID);
	if (!style) {
		style = document.createElement('style');
		style.id = STYLE_ID;
		document.head.appendChild(style);
	}
	style.textContent = css;

	const id = parseThemeId(css);
	if (id) {
		document.body.dataset.theme = id;
		status.textContent = id;
	} else {
		status.textContent = '(no [data-theme=…] selector found)';
	}
	renderTokens();
}

function resetTheme() {
	document.getElementById(STYLE_ID)?.remove();
	document.body.dataset.theme = 'dark';
	status.textContent = 'dark';
	renderTokens();
}

function renderTokens() {
	const computed = getComputedStyle(document.documentElement);
	tokensEl.innerHTML = '';
	for (const name of TOKEN_NAMES) {
		const value = computed.getPropertyValue(name).trim();
		const row = document.createElement('div');
		row.className = 'zp-token';
		const swatch = document.createElement('div');
		swatch.className = 'zp-token-swatch';
		swatch.style.background = value || 'transparent';
		const meta = document.createElement('div');
		meta.className = 'zp-token-meta';
		meta.innerHTML = `<span class="zp-token-name">${name}</span><span class="zp-token-value">${value || '—'}</span>`;
		row.appendChild(swatch);
		row.appendChild(meta);
		tokensEl.appendChild(row);
	}
}

// File picker
document.getElementById('zp-file').addEventListener('change', (e) => {
	const file = e.target.files?.[0];
	if (!file) return;
	file.text().then(applyTheme);
});

// Paste box
document.getElementById('zp-apply-paste').addEventListener('click', () => {
	const css = document.getElementById('zp-paste').value;
	if (css.trim()) applyTheme(css);
});

// Reset
document.getElementById('zp-reset').addEventListener('click', resetTheme);

// Drag and drop
let dragCounter = 0;
window.addEventListener('dragenter', (e) => {
	e.preventDefault();
	dragCounter++;
	overlay.classList.add('active');
});
window.addEventListener('dragleave', () => {
	dragCounter--;
	if (dragCounter <= 0) {
		dragCounter = 0;
		overlay.classList.remove('active');
	}
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
	e.preventDefault();
	dragCounter = 0;
	overlay.classList.remove('active');
	const file = e.dataTransfer?.files?.[0];
	if (!file) return;
	file.text().then(applyTheme);
});

// URL ?path=examples/<id> autoload
async function loadFromQuery() {
	const params = new URLSearchParams(location.search);
	const path = params.get('path');
	if (!path) return;
	const candidates = [`/${path}/theme.css`, `/${path}.css`];
	for (const url of candidates) {
		try {
			const r = await fetch(url);
			if (r.ok) {
				applyTheme(await r.text());
				return;
			}
		} catch {
			// try next candidate
		}
	}
	status.textContent = `(could not load ${path})`;
}

renderTokens();
loadFromQuery();
