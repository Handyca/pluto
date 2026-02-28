import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Message } from '@/types';
import { toast } from 'sonner';
import { fetchJSON } from '@/lib/api';

// Fetch messages for a session
export function useMessages(sessionId: string, token?: string) {
  return useQuery({
    queryKey: ['messages', sessionId],
    queryFn: async () => {
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const data = await fetchJSON<{ success: boolean; data: Message[] }>(`/api/messages?sessionId=${sessionId}`, { headers });
      if (!data.success) throw new Error('Failed to fetch messages');
      return data.data;
    },
    enabled: !!sessionId,
  });
}

// Update message (admin only)
export function useUpdateMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, sessionId, updates }: { messageId: string; sessionId: string; updates: { isVisible?: boolean; isPinned?: boolean } }) => {
      const data = await fetchJSON<{ success: boolean; data: Message }>(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!data.success) throw new Error('Failed to update message');
      return { ...data.data, sessionId } as Message & { sessionId: string };
    },
    onSuccess: (data) => {
      // Update the specific message in the cache
      queryClient.setQueryData(['messages', data.sessionId], (old: Message[] | undefined) => {
        if (!old) return [data];
        return old.map((msg) => (msg.id === data.id ? data : msg));
      });
      toast.success('Message updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update message');
    },
  });
}

// Delete message (admin only)
export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, sessionId }: { messageId: string; sessionId: string }) => {
      const data = await fetchJSON<{ success: boolean }>(`/api/messages/${messageId}`, {
        method: 'DELETE',
      });
      if (!data.success) throw new Error('Failed to delete message');
      return { messageId, sessionId };
    },
    onSuccess: ({ messageId, sessionId }) => {
      // Remove the message from the cache
      queryClient.setQueryData(['messages', sessionId], (old: Message[] | undefined) => {
        if (!old) return [];
        return old.filter((msg) => msg.id !== messageId);
      });
      toast.success('Message deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete message');
    },
  });
}

/**
 * Two-step upload that bypasses Vercel's 4.5 MB function body limit:
 *   1. POST /api/upload/sign  — get a Supabase signed upload URL (tiny JSON)
 *   2. PUT  <signedUrl>       — upload file bytes directly to Supabase Storage
 *   3. POST /api/upload/confirm — save the DB record (tiny JSON)
 */
async function uploadFileDirect(
  file: File,
  type: 'image' | 'video' | 'sticker',
  participantToken?: string,
): Promise<{ id: string; url: string; filename: string; size: number; mimeType: string }> {
  // Step 1 — get signed URL
  const signRes = await fetch('/api/upload/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      ...(participantToken && { participantToken }),
    }),
  });

  if (!signRes.ok) {
    const err = await signRes.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || 'Failed to get upload URL');
  }

  const signData = await signRes.json() as {
    success: boolean;
    data: { signedUrl: string; path: string; filename: string; publicUrl: string };
  };
  const { signedUrl, path, filename, publicUrl } = signData.data;

  // Step 2 — upload directly to Supabase (bypasses Vercel)
  const putRes = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });

  if (!putRes.ok) {
    throw new Error(`Storage upload failed (${putRes.status})`);
  }

  // Step 3 — save DB record
  const confirmRes = await fetch('/api/upload/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path,
      publicUrl,
      filename,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      type,
      ...(participantToken && { participantToken }),
    }),
  });

  if (!confirmRes.ok) {
    const err = await confirmRes.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || 'Failed to save upload record');
  }

  const confirmData = await confirmRes.json() as { success: boolean; data: { id: string; url: string; filename: string; size: number; mimeType: string } };
  if (!confirmData.success) throw new Error('Failed to confirm upload');
  return confirmData.data;
}

// Upload file
export function useUploadFile() {
  return useMutation({
    mutationFn: async ({ file, type }: { file: File; type: 'image' | 'video' | 'sticker' }) => {
      return uploadFileDirect(file, type);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload file');
    },
  });
}

export { uploadFileDirect };

// Fetch media assets
export function useMediaAssets(type?: 'IMAGE' | 'VIDEO' | 'STICKER') {
  return useQuery({
    queryKey: ['media', type],
    queryFn: async () => {
      const url = type ? `/api/upload?type=${type}` : '/api/upload';
      const data = await fetchJSON<{ success: boolean; data: Record<string, unknown>[] }>(url);
      if (!data.success) throw new Error('Failed to fetch media assets');
      return data.data;
    },
  });
}

export function useDeleteAllMessages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId }: { sessionId: string }) => {
      const data = await fetchJSON<{ success: boolean }>(`/api/messages?sessionId=${sessionId}`, { method: 'DELETE' });
      if (!data.success) throw new Error('Failed to delete messages');
      return { sessionId };
    },
    onSuccess: ({ sessionId }) => {
      queryClient.setQueryData(['messages', sessionId], []);
      toast.success('All messages deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete messages');
    },
  });
}
