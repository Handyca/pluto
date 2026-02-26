'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import QRCodeLib from 'qrcode';
import Image from 'next/image';
import Link from 'next/link';

interface SessionCodeDisplayProps {
  code: string;
  joinUrl: string;
}

export function SessionCodeDisplay({ code, joinUrl }: SessionCodeDisplayProps) {
  const [qrCode, setQrCode] = useState<string>('');
  const presenterUrl = joinUrl.replace('/join/', '/presenter/');

  useEffect(() => {
    QRCodeLib.toDataURL(joinUrl, {
      width: 280,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    }).then(setQrCode);
  }, [joinUrl]);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(joinUrl);
    toast.success('URL copied to clipboard');
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Session Code</h3>
        <div className="flex items-center gap-2">
          <code className="text-4xl font-bold tracking-wider">{code}</code>
          <Button variant="ghost" size="icon" onClick={copyCode}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Join URL</h3>
        <div className="flex items-center gap-2">
          <code className="text-sm flex-1 p-2 bg-muted rounded truncate">{joinUrl}</code>
          <Button variant="ghost" size="icon" onClick={copyUrl}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* QR Code — always visible */}
      {qrCode && (
        <div className="flex flex-col items-center gap-2 pt-1">
          <p className="text-xs text-muted-foreground self-start">Scan to join</p>
          <div className="rounded-lg overflow-hidden border bg-white p-2">
            <Image
              src={qrCode}
              alt="QR Code"
              width={220}
              height={220}
              unoptimized
              className="block"
            />
          </div>
          <code className="text-lg font-bold tracking-widest">{code}</code>
        </div>
      )}

      {/* Presenter link */}
      <Button asChild variant="default" className="w-full gap-2">
        <Link href={presenterUrl} target="_blank" rel="noopener noreferrer">
          <Monitor className="h-4 w-4" />
          Open Presenter View
        </Link>
      </Button>
    </Card>
  );
}
