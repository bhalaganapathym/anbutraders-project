import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LayoutDashboard } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackView?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 min-h-[50vh] text-center">
          <div className="glass-panel max-w-md w-full p-8 rounded-3xl border border-rose-500/20 bg-rose-50/20 dark:bg-rose-950/20 shadow-xl space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={28} />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Something went wrong loading this view
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono bg-white/60 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 break-words text-left">
              {this.state.error?.message || 'Unknown error occurred'}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  if (this.props.onReset) this.props.onReset();
                }}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                <RefreshCw size={14} /> Try Again
              </button>
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.hash = '#dashboard';
                  window.location.reload();
                }}
                className="btn-secondary text-xs flex items-center gap-1.5"
              >
                <LayoutDashboard size={14} /> Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
