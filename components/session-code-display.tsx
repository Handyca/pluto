"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Copy,
  Monitor,
  RefreshCw,
  Pencil,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import QRCodeLib from "qrcode";
import Image from "next/image";
import Link from "next/link";

interface SessionCodeDisplayProps {
  code: string;
  joinUrl: string;
  onSave?: (code: string) => Promise<void>;
}

export function SessionCodeDisplay({
  code,
  joinUrl,
  onSave,
}: SessionCodeDisplayProps) {
  const [qrCode, setQrCode] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [draftCode, setDraftCode] = useState(code);
  const [saving, setSaving] = useState(false);

  // Sync draft when code changes from parent (after successful save)
  useEffect(() => {
    setDraftCode(code);
    setEditing(false);
  }, [code]);
  const presenterUrl = joinUrl.replace("/join/", "/presenter/");

  useEffect(() => {
    QRCodeLib.toDataURL(joinUrl, {
      width: 280,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    }).then(setQrCode);
  }, [joinUrl]);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied to clipboard");
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(joinUrl);
    toast.success("URL copied to clipboard");
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          Session Code
        </h3>
        {editing ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={draftCode}
                onChange={(e) =>
                  setDraftCode(
                    e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""),
                  )
                }
                className="font-mono uppercase text-xl font-bold tracking-wider h-10"
                maxLength={20}
                autoFocus
              />
              <Button
                variant="outline"
                size="icon"
                title="Auto-generate code"
                onClick={() =>
                  setDraftCode(
                    Math.random().toString(36).slice(2, 8).toUpperCase(),
                  )
                }
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              3–20 characters, letters, numbers, hyphens
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!draftCode || draftCode === code || saving}
                onClick={async () => {
                  if (!onSave) return;
                  setSaving(true);
                  try {
                    await onSave(draftCode);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                <span className="ml-1">Save</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraftCode(code);
                  setEditing(false);
                }}
              >
                <X className="h-3.5 w-3.5" />
                <span className="ml-1">Cancel</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-2 group"
              onClick={() => onSave && setEditing(true)}
              title={onSave ? "Click to edit session code" : undefined}
            >
              <code
                className={`text-4xl font-bold tracking-wider${onSave ? " group-hover:text-primary transition-colors cursor-pointer" : ""}`}
              >
                {code}
              </code>
              {onSave && (
                <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
            <Button variant="ghost" size="icon" onClick={copyCode}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Join URL</h3>
        <div className="flex items-center gap-2">
          <code className="text-sm flex-1 p-2 bg-muted rounded truncate">
            {joinUrl}
          </code>
          <Button variant="ghost" size="icon" onClick={copyUrl}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* QR Code — always visible */}
      {qrCode && (
        <div className="flex flex-col items-center gap-2 pt-1">
          <p className="text-xs text-muted-foreground self-start">
            Scan to join
          </p>
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
