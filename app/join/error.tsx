'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function JoinError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Join error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background text-foreground">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Unable to join session</h1>
        <p className="mt-2 text-muted-foreground">
          {process.env.NODE_ENV === 'development'
            ? error.message
            : 'An error occurred while trying to join the session.'}
        </p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
