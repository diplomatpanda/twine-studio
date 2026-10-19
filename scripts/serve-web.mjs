import {createReadStream} from 'node:fs';
import {realpath, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = await realpath(
	process.env.TWINE_STUDIO_WEB_ROOT ?? path.join(appRoot, 'dist', 'web')
);
const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 37892);
const contentTypes = {
	'.css': 'text/css; charset=utf-8',
	'.html': 'text/html; charset=utf-8',
	'.ico': 'image/x-icon',
	'.js': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.webmanifest': 'application/manifest+json',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2'
};

if (!Number.isInteger(port) || port < 1 || port > 65535) {
	throw new Error('PORT must be an integer between 1 and 65535.');
}
if (host !== '127.0.0.1' && host !== '::1') {
	throw new Error('HOST must be a loopback address.');
}

function respond(res, statusCode, body, contentType = 'text/plain; charset=utf-8') {
	res.writeHead(statusCode, {
		'Content-Length': Buffer.byteLength(body),
		'Content-Type': contentType,
		'X-Content-Type-Options': 'nosniff'
	});
	res.end(body);
}

const server = createServer(async (req, res) => {
	if (req.method !== 'GET' && req.method !== 'HEAD') {
		res.setHeader('Allow', 'GET, HEAD');
		respond(res, 405, 'Method not allowed');
		return;
	}

	let pathname;
	try {
		pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
	} catch {
		respond(res, 400, 'Bad request');
		return;
	}

	if (pathname === '/healthz') {
		respond(res, 200, JSON.stringify({status: 'ok'}), 'application/json; charset=utf-8');
		return;
	}

	const candidate = path.resolve(
		webRoot,
		pathname === '/' ? 'index.html' : `.${pathname}`
	);
	if (candidate !== webRoot && !candidate.startsWith(`${webRoot}${path.sep}`)) {
		respond(res, 404, 'Not found');
		return;
	}

	try {
		const resolvedPath = await realpath(candidate);
		if (resolvedPath !== webRoot && !resolvedPath.startsWith(`${webRoot}${path.sep}`)) {
			respond(res, 404, 'Not found');
			return;
		}

		const fileStat = await stat(resolvedPath);
		if (!fileStat.isFile()) {
			respond(res, 404, 'Not found');
			return;
		}

		const relativePath = path.relative(webRoot, resolvedPath).replaceAll('\\', '/');
		const immutableAsset = /^assets\/.+-[A-Za-z0-9_-]{8,}\.[^/]+$/.test(
			relativePath
		);
		res.writeHead(200, {
			'Cache-Control': immutableAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
			'Content-Length': fileStat.size,
			'Content-Type': contentTypes[path.extname(resolvedPath)] ?? 'application/octet-stream',
			'X-Content-Type-Options': 'nosniff'
		});
		if (req.method === 'HEAD') {
			res.end();
		} else {
			createReadStream(resolvedPath).pipe(res);
		}
	} catch {
		respond(res, 404, 'Not found');
	}
});

server.listen(port, host, () => {
	process.stdout.write(`Twine Studio web server listening on ${host}:${port}\n`);
});
