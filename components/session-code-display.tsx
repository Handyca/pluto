'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import QRCodeLib from 'qrcode';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface SessionCodeDisplayProps {
  code: string;
  joinUrl: string;
}

export function SessionCodeDisplay({ code, joinUrl }: SessionCodeDisplayProps) {
  const [qrCode, setQrCode] = useState<string>('');

  useEffect(() => {
    QRCodeLib.toDataURL(joinUrl, {
      width: 300,
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

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <QrCode className="h-4 w-4 mr-2" />
            Show QR Code
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code</DialogTitle>
            <DialogDescription>
              Participants can scan this code to join the session
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center p-4">
            {qrCode && (
              <img src={qrCode} alt="QR Code" className="w-full max-w-xs" />
            )}
          </div>
          <div className="text-center">
            <code className="text-2xl font-bold">{code}</code>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
