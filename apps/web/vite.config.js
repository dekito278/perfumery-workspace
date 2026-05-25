import path from 'node:path';
import react from '@vitejs/plugin-react';
import { createLogger, defineConfig } from 'vite';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import inlineEditPlugin from './plugins/visual-editor/vite-plugin-react-inline-editor.js';
import editModeDevPlugin from './plugins/visual-editor/vite-plugin-edit-mode.js';
import selectionModePlugin from './plugins/selection-mode/vite-plugin-selection-mode.js';
import iframeRouteRestorationPlugin from './plugins/vite-plugin-iframe-route-restoration.js';
import pocketbaseAuthPlugin from './plugins/vite-plugin-pocketbase-auth.js';
import scentreeImportDevPlugin from './plugins/scentree-import-dev-plugin.js';

import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const allDeps = Object.keys(pkg.dependencies || {});

const isDev = process.env.NODE_ENV !== 'production';
const appBuildId = process.env.VERCEL_GIT_COMMIT_SHA
	|| process.env.CF_PAGES_COMMIT_SHA
	|| process.env.GITHUB_SHA
	|| new Date().toISOString().replace(/[-:.TZ]/g, '');

const configHorizonsViteErrorHandler = `
const observer = new MutationObserver((mutations) => {
	for (const mutation of mutations) {
		for (const addedNode of mutation.addedNodes) {
			if (
				addedNode.nodeType === Node.ELEMENT_NODE &&
				(
					addedNode.tagName?.toLowerCase() === 'vite-error-overlay' ||
					addedNode.classList?.contains('backdrop')
				)
			) {
				handleViteOverlay(addedNode);
			}
		}
	}
});

observer.observe(document.documentElement, {
	childList: true,
	subtree: true
});

function handleViteOverlay(node) {
	if (!node.shadowRoot) {
		return;
	}

	const backdrop = node.shadowRoot.querySelector('.backdrop');

	if (backdrop) {
		const overlayHtml = backdrop.outerHTML;
		const parser = new DOMParser();
		const doc = parser.parseFromString(overlayHtml, 'text/html');
		const messageBodyElement = doc.querySelector('.message-body');
		const fileElement = doc.querySelector('.file');
		const messageText = messageBodyElement ? messageBodyElement.textContent.trim() : '';
		const fileText = fileElement ? fileElement.textContent.trim() : '';
		const error = messageText + (fileText ? ' File:' + fileText : '');

		window.parent.postMessage({
			type: 'horizons-vite-error',
			error,
		}, '*');
	}
}
`;

const configHorizonsRuntimeErrorHandler = `
window.onerror = (message, source, lineno, colno, errorObj) => {
	const errorDetails = errorObj ? JSON.stringify({
		name: errorObj.name,
		message: errorObj.message,
		stack: errorObj.stack,
		source,
		lineno,
		colno,
	}) : null;

	window.parent.postMessage({
		type: 'horizons-runtime-error',
		message,
		error: errorDetails
	}, '*');
};
`;

const configHorizonsConsoleErrorHandler = `
const originalConsoleError = console.error;
const MATCH_LINE_COL_REGEX = /:(\\d+):(\\d+)\\)?\\s*$/; // regex to match the :lineNum:colNum
const MATCH_AT_REGEX = /^\\s*at\\s+(?:async\\s+)?(?:.*?\\s+)?\\(?/; // regex to remove the 'at' keyword and any 'async' or function name
const MATCH_PATH_REGEX = /^\\//; // regex to remove the leading slash

function parseStackFrameLine(line) {
	const lineColMatch = line.match(MATCH_LINE_COL_REGEX);
	if (!lineColMatch) return null;
	const [, lineNum, colNum] = lineColMatch;
	const suffix = \`:\${lineNum}:\${colNum}\`;
	const idx = line.lastIndexOf(suffix);
	if (idx === -1) return null;
	const before = line.substring(0, idx);
	const path = before.replace(MATCH_AT_REGEX, '').trim();
	
	if (!path) return null;

	try {
		const pathname = new URL(path).pathname;
		const filePath = pathname.replace(MATCH_PATH_REGEX, '') || pathname;
		return \`\${filePath}:\${lineNum}:\${colNum}\`;
	} catch (e) {
		const filePath = path.replace(MATCH_PATH_REGEX, '') || path;
		return \`\${filePath}:\${lineNum}:\${colNum}\`;
	}
}

function getFilePathFromStack(stack, skipFrames = 0) {
	if (!stack || typeof stack !== 'string') return null;
	const lines = stack.split('\\n').slice(1);

	const frames = lines.map(line => parseStackFrameLine(line.replace(/\\r$/, ''))).filter(Boolean);

	return frames[skipFrames] ?? null;
}

console.error = function(...args) {
	originalConsoleError.apply(console, args);

	let errorString = '';
	let filePath = null;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg instanceof Error) {
			filePath = getFilePathFromStack(arg.stack, 0);
			errorString = \`\${arg.name}: \${arg.message}\`;
			if (filePath) {
				errorString = \`\${errorString} at \${filePath}\`;
			}
			break;
		}
	}

	if (!errorString) {
		errorString = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
		const stack = new Error().stack;
		filePath = getFilePathFromStack(stack, 1);
		if (filePath) {
			errorString = \`\${errorString} at \${filePath}\`;
		}
	}

	window.parent.postMessage({
		type: 'horizons-console-error',
		error: errorString
	}, '*');
};
`;

const configWindowFetchMonkeyPatch = `
const originalFetch = window.fetch;

function isIgnorableSupabaseReadFailure(url, options, error) {
	const method = String(options?.method || 'GET').toUpperCase();
	const message = String(error?.message || error || '');
	return method === 'GET'
		&& String(url || '').includes('supabase.co')
		&& message.includes('Failed to fetch');
}

function isIgnorableHandledConflict(url, responseText) {
	return String(url || '').includes('supabase.co')
		&& String(responseText || '').includes('"code":"23505"');
}

window.fetch = function(...args) {
	const url = args[0] instanceof Request ? args[0].url : args[0];
	const requestOptions = args[0] instanceof Request ? {
		method: args[0].method,
	} : (args[1] || {});

	// Skip WebSocket URLs
	if (url.startsWith('ws:') || url.startsWith('wss:')) {
		return originalFetch.apply(this, args);
	}

	return originalFetch.apply(this, args)
		.then(async response => {
			const contentType = response.headers.get('Content-Type') || '';

			// Exclude HTML document responses
			const isDocumentResponse =
				contentType.includes('text/html') ||
				contentType.includes('application/xhtml+xml');

			if (!response.ok && !isDocumentResponse) {
					const responseClone = response.clone();
					const errorFromRes = await responseClone.text();
					const requestUrl = response.url;
					if (!isIgnorableHandledConflict(requestUrl, errorFromRes)) {
						console.error(\`Fetch error from \${requestUrl}: \${errorFromRes}\`);
					}
			}

			return response;
		})
		.catch(error => {
			if (!url.match(/\.html?$/i) && !isIgnorableSupabaseReadFailure(url, requestOptions, error)) {
				console.error(error);
			}

			throw error;
		});
};
`;

const configNavigationHandler = `
if (window.navigation && window.self !== window.top) {
	window.navigation.addEventListener('navigate', (event) => {
		const url = event.destination.url;

		try {
			const destinationUrl = new URL(url);
			const destinationOrigin = destinationUrl.origin;
			const currentOrigin = window.location.origin;

			if (destinationOrigin === currentOrigin) {
				return;
			}
		} catch (error) {
			return;
		}

		window.parent.postMessage({
			type: 'horizons-navigation-error',
			url,
		}, '*');
	});
}
`;

const addTransformIndexHtml = {
	name: 'add-transform-index-html',
	transformIndexHtml(html) {
		const tags = isDev ? [
			{
				tag: 'script',
				attrs: { type: 'module' },
				children: configHorizonsRuntimeErrorHandler,
				injectTo: 'head',
			},
			{
				tag: 'script',
				attrs: { type: 'module' },
				children: configHorizonsViteErrorHandler,
				injectTo: 'head',
			},
			{
				tag: 'script',
				attrs: { type: 'module' },
				children: configHorizonsConsoleErrorHandler,
				injectTo: 'head',
			},
			{
				tag: 'script',
				attrs: { type: 'module' },
				children: configWindowFetchMonkeyPatch,
				injectTo: 'head',
			},
			{
				tag: 'script',
				attrs: { type: 'module' },
				children: configNavigationHandler,
				injectTo: 'head',
			},
		] : [];

		if (!isDev && process.env.TEMPLATE_BANNER_SCRIPT_URL && process.env.TEMPLATE_REDIRECT_URL) {
			tags.push(
				{
					tag: 'script',
					attrs: {
						src: process.env.TEMPLATE_BANNER_SCRIPT_URL,
						'template-redirect-url': process.env.TEMPLATE_REDIRECT_URL,
					},
					injectTo: 'head',
				}
			);
		}

		return {
			html,
			tags,
		};
	},
};

const localApiDevPlugin = () => ({
	name: 'local-api-dev',
	configureServer(server) {
		loadLocalApiEnv();
		server.middlewares.use('/api', async (request, response, next) => {
			try {
				const requestUrl = new URL(request.url || '/', 'http://localhost');
				const apiPath = requestUrl.pathname.replace(/^\/+/, '');
				const apiFile = path.resolve(__dirname, 'api', `${apiPath}.js`);

				if (!apiPath || !existsSync(apiFile)) {
					next();
					return;
				}

				const moduleUrl = `${pathToFileURL(apiFile).href}?t=${Date.now()}`;
				const module = await import(moduleUrl);
				if (typeof module.default !== 'function') {
					next();
					return;
				}

				request.url = requestUrl.toString();
				await module.default(request, response);
			} catch (error) {
				response.statusCode = 500;
				response.setHeader('Content-Type', 'application/json');
				response.end(JSON.stringify({ message: error.message || 'Local API error' }));
			}
		});
	},
});

const logger = createLogger()
const loggerError = logger.error

logger.error = (msg, options) => {
	if (options?.error?.toString().includes('CssSyntaxError: [postcss]')) {
		return;
	}

	loggerError(msg, options);
}

const loadLocalApiEnv = () => {
	for (const envFileName of ['.env.local', '.env']) {
		const envFile = path.resolve(__dirname, envFileName);
		if (!existsSync(envFile)) continue;

		const lines = readFileSync(envFile, 'utf-8').split(/\r?\n/);
		for (const line of lines) {
			const trimmedLine = line.trim();
			if (!trimmedLine || trimmedLine.startsWith('#')) continue;

			const separatorIndex = trimmedLine.indexOf('=');
			if (separatorIndex === -1) continue;

			const key = trimmedLine.slice(0, separatorIndex).trim();
			let value = trimmedLine.slice(separatorIndex + 1).trim();
			if (!key || process.env[key] !== undefined) continue;

			if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
				value = value.slice(1, -1);
			}

			process.env[key] = value;
		}
	}
};

const manualChunkGroups = [
	['react-vendor', ['/node_modules/react/', '/node_modules/react-dom/', '/node_modules/scheduler/']],
	['router-vendor', ['/node_modules/react-router/', '/node_modules/react-router-dom/']],
	['supabase-vendor', ['/node_modules/@supabase/']],
	['motion-vendor', ['/node_modules/framer-motion/']],
	['pdf-parse-vendor', ['/node_modules/pdfjs-dist/']],
	['pdf-export-vendor', ['/node_modules/jspdf/', '/node_modules/html2canvas/']],
	['chart-vendor', ['/node_modules/recharts/', '/node_modules/d3-', '/node_modules/victory-vendor/']],
	['form-vendor', ['/node_modules/react-hook-form/', '/node_modules/@hookform/', '/node_modules/zod/']],
	['qr-vendor', ['/node_modules/qrcode/']],
	['ui-vendor', ['/node_modules/lucide-react/', '/node_modules/sonner/', '/node_modules/date-fns/', '/node_modules/react-helmet/']],
];

const getManualChunk = (id) => {
	const normalizedId = id.replace(/\\/g, '/');
	if (!normalizedId.includes('/node_modules/')) {
		return undefined;
	}

	const matchingGroup = manualChunkGroups.find(([, patterns]) => patterns.some((pattern) => normalizedId.includes(pattern)));
	return matchingGroup?.[0] || 'vendor';
};

const deferredPreloadChunks = [
	'pdf-export-vendor',
	'pdf-parse-vendor',
];

const shouldPreloadDependency = (dependency) =>
	!deferredPreloadChunks.some((chunkName) => dependency.includes(chunkName));

export default defineConfig({
	define: {
		'import.meta.env.VITE_APP_BUILD_ID': JSON.stringify(appBuildId),
	},
	optimizeDeps: {
		include: allDeps,
	},
	customLogger: logger,
	plugins: [
		...(isDev ? [localApiDevPlugin(), inlineEditPlugin(), editModeDevPlugin(), selectionModePlugin(), iframeRouteRestorationPlugin(), pocketbaseAuthPlugin(), scentreeImportDevPlugin()] : []),
		react(),
		addTransformIndexHtml
	],
	server: {
		port: 3000,
		cors: {
			origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
		},
		headers: {
			'Cross-Origin-Embedder-Policy': 'credentialless',
		},
		allowedHosts: true,
	},
	resolve: {
		extensions: ['.jsx', '.js', '.tsx', '.ts', '.json',],
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	build: {
		outDir: 'dist',
		chunkSizeWarningLimit: 600,
		modulePreload: {
			resolveDependencies: (_filename, dependencies) => dependencies.filter(shouldPreloadDependency),
		},
		sourcemap: false,
		minify: 'terser',
		terserOptions: {
			compress: {
				drop_console: true,
				drop_debugger: true,
			},
			format: {
				comments: false,
			},
		},
		rollupOptions: {
			external: [
				'@babel/parser',
				'@babel/traverse',
				'@babel/generator',
				'@babel/types'
			],
			output: {
				manualChunks: getManualChunk,
			}
		}
	}
});
