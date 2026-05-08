import '@/utils/polyfills.js';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
import '@/styles/mobile.css';
import { applyStandaloneClass, registerServiceWorker } from '@/utils/pwa.js';
import { recordMobileRuntimeError } from '@/utils/mobileDiagnostics.js';

const RESIZE_OBSERVER_MESSAGES = [
  'ResizeObserver loop completed with undelivered notifications.',
  'ResizeObserver loop limit exceeded',
];

const isResizeObserverNoise = (value) =>
  RESIZE_OBSERVER_MESSAGES.some((message) => String(value || '').includes(message));

const EXTENSION_ERROR_MESSAGES = [
  'Attempting to use a disconnected port object',
];

const isExtensionNoise = ({ message, filename, reason }) => {
  const messageText = String(message || reason?.message || reason || '');
  const filenameText = String(filename || '');
  const stackText = String(reason?.stack || '');

  return (
    filenameText.includes('chrome-extension://')
    || stackText.includes('chrome-extension://')
    || EXTENSION_ERROR_MESSAGES.some((entry) => messageText.includes(entry))
  );
};

window.addEventListener('error', (event) => {
  if (isResizeObserverNoise(event.message) || isExtensionNoise(event)) {
    event.stopImmediatePropagation();
    event.preventDefault();
    return;
  }

  recordMobileRuntimeError(event.error || event.message, {
    source: 'window.error',
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
}, true);

window.addEventListener('unhandledrejection', (event) => {
  if (
    isResizeObserverNoise(event.reason?.message || event.reason)
    || isExtensionNoise({ reason: event.reason })
  ) {
    event.preventDefault();
    return;
  }

  recordMobileRuntimeError(event.reason, {
    source: 'window.unhandledrejection',
  });
});

ReactDOM.createRoot(document.getElementById('root')).render(
	<App />
);

applyStandaloneClass();
window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', applyStandaloneClass);
registerServiceWorker();
