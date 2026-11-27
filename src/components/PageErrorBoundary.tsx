import React from 'react';

interface PageErrorBoundaryProps {
  children: React.ReactNode;
}

interface PageErrorBoundaryState {
  hasError: boolean;
}

/**
 * Keeps the application shell/navigation usable when one page component throws
 * during render. The parent keys this boundary by active tab so choosing another
 * page resets the failed boundary without requiring a full application reload.
 */
export class PageErrorBoundary extends React.Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  state: PageErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): PageErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
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
