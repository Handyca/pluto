'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function PresenterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Presenter error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-zinc-950 text-white">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Presenter view error</h1>
        <p className="mt-2 text-zinc-400">
          {process.env.NODE_ENV === 'development'
            ? error.message
            : 'An error occurred in the presenter view.'}
        </p>
      </div>
      <Button variant="secondary" onClick={reset}>Try again</Button>
    </div>
  );
}
