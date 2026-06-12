'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  sessionErrorMessage?: string;
  genericErrorMessage?: string;
  retryLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PokerErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[PokerErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error ? this.state.error.message : null;
      const isRedirectError = errorMessage === 'NEXT_REDIRECT';
      const {
        fallback,
        genericErrorMessage = 'An error occurred loading the game.',
        retryLabel = 'Retry',
        sessionErrorMessage = 'Unable to continue with the current session.',
      } = this.props;

      if (fallback) {
        return fallback;
      }

      return (
        <div className="p-6 text-center">
          <p className="text-sm text-destructive">
            {isRedirectError ? sessionErrorMessage : genericErrorMessage}
          </p>
          <button
            type="button"
            className="mt-4 text-sm underline"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
          >
            {retryLabel}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
