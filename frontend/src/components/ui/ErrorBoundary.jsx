import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * Reusable dark ErrorBoundary component wrapping routed page content.
 * Ensures a crash in any page displays a dark recovery card with a Retry button
 * and never blanks the whole app or sidebar.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('Page ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="ui-card p-6 border-[#EF4444]/40 bg-[#111114] max-w-2xl mx-auto my-8">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-[#F4F4F5]">
                This view encountered an unexpected rendering error
              </h2>
              <p className="text-xs text-[#A1A1AA] mt-1 leading-relaxed">
                The navigation sidebar and project state remain intact. Click Retry to reload this view or select another page from the sidebar.
              </p>
              {this.state.error?.message && (
                <div className="mt-3 p-2.5 rounded-lg bg-[#0E0E11] border border-[#1F1F25] font-mono text-[11px] text-[#EF4444] break-all">
                  {this.state.error.message}
                </div>
              )}
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={this.handleRetry}
                  className="ui-btn-primary px-3.5 py-1.5 inline-flex items-center gap-1.5 text-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retry View
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

