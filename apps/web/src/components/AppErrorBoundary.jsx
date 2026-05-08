import React from 'react';
import {
  clearMobileRuntimeErrors,
  getLatestMobileRuntimeError,
  getMissingMobileCapabilities,
  isMobileLikeRuntime,
  recordMobileRuntimeError,
} from '@/utils/mobileDiagnostics.js';

const RESIZE_OBSERVER_MESSAGES = [
  'ResizeObserver loop completed with undelivered notifications.',
  'ResizeObserver loop limit exceeded',
];

const isIgnorableRuntimeError = (error) =>
  RESIZE_OBSERVER_MESSAGES.some((message) => String(error?.message || error || '').includes(message));

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    if (isIgnorableRuntimeError(error)) {
      return null;
    }
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    if (isIgnorableRuntimeError(error)) {
      console.warn('Ignored ResizeObserver runtime noise:', error);
      return;
    }
    recordMobileRuntimeError(error, {
      source: 'react.error-boundary',
      componentStack: errorInfo?.componentStack,
    });
    console.error('Unhandled application error:', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      const latestMobileError = getLatestMobileRuntimeError();
      const missingCapabilities = getMissingMobileCapabilities();
      const showMobileHints = isMobileLikeRuntime();

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-sm">
            <h1 className="text-xl font-semibold">App failed to render</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              There was a runtime error in the frontend. Refresh the page once. If it still happens, the error details are shown below.
            </p>
            {showMobileHints && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">Mobile app recovery</p>
                <p className="mt-1">
                  Kalau ini terjadi di iOS/Android, buka ulang app setelah refresh agar bundle terbaru dan cache service worker ikut diperbarui.
                </p>
                {missingCapabilities.length > 0 && (
                  <p className="mt-2 text-xs">
                    Missing capabilities: {missingCapabilities.join(', ')}
                  </p>
                )}
              </div>
            )}
            <pre className="mt-4 overflow-auto rounded-lg bg-muted p-4 text-xs text-destructive">
              {String(this.state.error?.message || this.state.error)}
            </pre>
            {latestMobileError && (
              <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-muted p-4 text-xs text-muted-foreground">
                {JSON.stringify(latestMobileError, null, 2)}
              </pre>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
                onClick={() => window.location.reload()}
              >
                Refresh app
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
                onClick={() => {
                  clearMobileRuntimeErrors();
                  window.location.reload();
                }}
              >
                Clear diagnostics
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
