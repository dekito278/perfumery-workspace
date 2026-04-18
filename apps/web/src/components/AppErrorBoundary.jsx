import React from 'react';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled application error:', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-sm">
            <h1 className="text-xl font-semibold">App failed to render</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              There was a runtime error in the frontend. Refresh the page once. If it still happens, the error details are shown below.
            </p>
            <pre className="mt-4 overflow-auto rounded-lg bg-muted p-4 text-xs text-destructive">
              {String(this.state.error?.message || this.state.error)}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
