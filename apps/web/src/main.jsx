import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

const RESIZE_OBSERVER_MESSAGES = [
  'ResizeObserver loop completed with undelivered notifications.',
  'ResizeObserver loop limit exceeded',
];

const isResizeObserverNoise = (value) =>
  RESIZE_OBSERVER_MESSAGES.some((message) => String(value || '').includes(message));

window.addEventListener('error', (event) => {
  if (isResizeObserverNoise(event.message)) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
}, true);

window.addEventListener('unhandledrejection', (event) => {
  if (isResizeObserverNoise(event.reason?.message || event.reason)) {
    event.preventDefault();
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
	<App />
);
