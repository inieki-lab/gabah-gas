import { Component, type ErrorInfo, type ReactNode } from 'react';

interface PageErrorBoundaryProps {
  children: ReactNode;
  resetKey: string;
}

interface PageErrorBoundaryState {
  hasError: boolean;
  resetKey?: string;
}

/**
 * Keeps the application shell/navigation usable when one page component throws
 * during render. A changed resetKey clears the previous page's error state.
 */
export class PageErrorBoundary extends Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  declare readonly props: Readonly<PageErrorBoundaryProps>;
  state: PageErrorBoundaryState = { hasError: false, resetKey: this.props.resetKey };

  static getDerivedStateFromProps(
    props: Readonly<PageErrorBoundaryProps>,
    state: PageErrorBoundaryState,
  ): Partial<PageErrorBoundaryState> | null {
    if (props.resetKey !== state.resetKey) {
      return { hasError: false, resetKey: props.resetKey };
    }
    return null;
  }

  static getDerivedStateFromError(): Partial<PageErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('GABAH page render failed:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-900">
          <h2 className="font-bold">Halaman mengalami gangguan</h2>
          <p className="mt-2">Konten halaman ini gagal ditampilkan. Menu navigasi tetap tersedia; pilih menu lain atau muat ulang aplikasi.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-bold hover:bg-red-100">Muat ulang aplikasi</button>
        </section>
      );
    }
    return this.props.children;
  }
}
