#!/usr/bin/env node
// Minimal local preview server. Serves the repo over HTTP so the theme
// preview HTML can fetch theme.css files (which file:// blocks via CORS).
// `node scripts/preview.mjs` then open the printed URL.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
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

const server = createServer(async (req, res) => {
	let urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
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
	console.log(`tip: append ?path=examples/theme-example to load that theme on open`);
});
