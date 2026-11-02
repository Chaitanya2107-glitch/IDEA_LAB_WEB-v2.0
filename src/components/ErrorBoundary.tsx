import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </div>
            
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">Well, this is awkward.</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Something went wrong while rendering this page. Our team has been notified.
            </p>

            <div className="mt-6 space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> Reload Page
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                <Home className="h-4 w-4" aria-hidden="true" /> Go to Homepage
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <div className="mt-6 border-t border-slate-200 pt-6 text-left">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Error Details</p>
                <code className="mt-2 block break-all font-mono text-xs text-red-600">{this.state.error?.toString()}</code>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
