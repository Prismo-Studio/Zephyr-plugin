#!/usr/bin/env node
// Minimal local preview server. Serves the repo over HTTP and pushes a
// change event over SSE so the launcher preview can hot-reload when the
// dev edits theme.css, manifest.json or features/<id>/ui/*.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import { extname, join, normalize, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT ?? 5174);

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.webp': 'image/webp'
};

// Active SSE clients. Each is a `res` object kept open so we can push events.
const sseClients = new Set();

function broadcast(event) {
	const payload = `data: ${JSON.stringify(event)}\n\n`;
	for (const res of sseClients) {
		try {
			res.write(payload);
		} catch {
			sseClients.delete(res);
		}
	}
}

// Coalesce filesystem events: editors often write a temp file then rename,
// triggering 2-3 events for one save. We debounce per-file path.
const pending = new Map();
function emitChange(filePath) {
	const rel = relative(ROOT, filePath).split('\\').join('/');
	if (rel.startsWith('node_modules/') || rel.startsWith('.git/')) return;
	const prev = pending.get(rel);
	if (prev) clearTimeout(prev);
	pending.set(
		rel,
		setTimeout(() => {
			pending.delete(rel);
			broadcast({ type: 'change', path: rel });
		}, 80)
	);
}

// Watch themes/, features/, preview/. Recursive watch is supported on
// Windows and macOS; on Linux we fall back to per-directory watches.
function startWatcher() {
	const targets = ['themes', 'features', 'preview'];
	const isLinux = process.platform === 'linux';
	for (const t of targets) {
		const root = join(ROOT, t);
		try {
			if (isLinux) {
				watchDirRecursive(root);
			} else {
				watch(root, { recursive: true }, (_, filename) => {
					if (!filename) return;
					emitChange(join(root, filename));
				});
			}
		} catch (err) {
			console.warn(`watch ${t} failed: ${err.message}`);
		}
	}
}

function watchDirRecursive(dir) {
	try {
		watch(dir, (_, filename) => {
			if (!filename) return;
			emitChange(join(dir, filename));
		});
	} catch {}
}

const server = createServer(async (req, res) => {
	let urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);

	// SSE: long-lived connection for change notifications.
	if (urlPath === '/preview/_events') {
		res.writeHead(200, {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-store',
			Connection: 'keep-alive'
		});
		res.write('retry: 1000\n\n');
		sseClients.add(res);
		req.on('close', () => sseClients.delete(res));
		return;
	}

	if (urlPath === '/' || urlPath === '') urlPath = '/preview/index.html';

	const filePath = join(ROOT, normalize(urlPath));
	if (!filePath.startsWith(ROOT)) {
		res.writeHead(403);
		res.end('forbidden');
		return;
	}

	try {
		const s = await stat(filePath);
		if (s.isDirectory()) {
			res.writeHead(404);
			res.end('not found');
			return;
		}
		const body = await readFile(filePath);
		res.writeHead(200, {
			'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
			'Cache-Control': 'no-store'
		});
		res.end(body);
	} catch {
		res.writeHead(404);
		res.end('not found');
	}
});

server.listen(PORT, () => {
	const url = `http://localhost:${PORT}/`;
	console.log(`zephyr plugin preview → ${url}`);
	console.log(`tip: edit themes/<slug>/theme.css and the page hot-reloads.`);
	startWatcher();
});
