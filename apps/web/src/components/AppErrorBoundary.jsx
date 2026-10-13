import React from 'react';
import { translate } from '@/i18n/messages.js';
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
    this.resetBoundary = this.resetBoundary.bind(this);
    this.clearDiagnostics = this.clearDiagnostics.bind(this);
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

  resetBoundary() {
    this.setState({ error: null });
  }

  clearDiagnostics() {
    clearMobileRuntimeErrors();
    this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      const latestMobileError = getLatestMobileRuntimeError();
      const missingCapabilities = getMissingMobileCapabilities();
      const showMobileHints = isMobileLikeRuntime();

      // The language comes off <html lang>, which useStorefrontRegion keeps in step with the shop on
      // every change. Not from the hook or the context: this boundary wraps AuthProvider, so the thing
      // that crashed may BE the provider tree, and a screen that needs a working provider to say "this
      // failed" is the one screen that cannot afford one.
      const region = typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'id';
      const say = (key) => translate(region, key);

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-sm">
            <h1 className="text-xl font-semibold">{say('crash.title')}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{say('crash.body')}</p>
            {showMobileHints && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="mt-1">{say('crash.reopen')}</p>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
                onClick={this.resetBoundary}
              >
                {say('crash.retry')}
              </button>
            </div>
            {/* Everything below the fold is for whoever is debugging it, which is why it is collapsed and
                why it stays in developer English: a stack trace, a capability list and a diagnostics
                buffer are not copy, and a buyer who opens this is not reading it for the wording. The
                guard in storefrontMessages holds the half ABOVE this line to the message file. */}
            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">{say('crash.details')}</summary>
              {missingCapabilities.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Missing capabilities: {missingCapabilities.join(', ')}
                </p>
              )}
              <pre className="mt-2 overflow-auto rounded-lg bg-muted p-4 text-xs text-destructive">
                {String(this.state.error?.message || this.state.error)}
              </pre>
              {latestMobileError && (
                <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-muted p-4 text-xs text-muted-foreground">
                  {JSON.stringify(latestMobileError, null, 2)}
                </pre>
              )}
              <button
                type="button"
                className="mt-3 inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
                onClick={this.clearDiagnostics}
              >
                Clear diagnostics
              </button>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
