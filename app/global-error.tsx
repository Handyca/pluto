'use client';

import { useEffect } from 'react';

// global-error.tsx must include <html> and <body> tags (replaces the root layout)
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error caught:', error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#09090b', color: '#fafafa' }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>Something went wrong</h1>
            <p style={{ color: '#a1a1aa', marginBottom: '1.5rem' }}>
              {process.env.NODE_ENV === 'development'
                ? error.message
                : 'An unexpected error occurred. Please try again.'}
            </p>
            <button
              onClick={() => reset()}
              style={{ padding: '0.5rem 1.25rem', background: '#3b82f6', color: '#fff', borderRadius: '0.375rem', border: 'none', cursor: 'pointer' }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
