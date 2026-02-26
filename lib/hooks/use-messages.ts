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

// Upload file
export function useUploadFile() {
  return useMutation({
    mutationFn: async ({ file, type }: { file: File; type: 'image' | 'video' | 'sticker' }) => {
      // Ensure file is fully loaded before creating FormData
      await new Promise((resolve) => setTimeout(resolve, 0));
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      // Use a longer timeout for large files and ensure proper headers
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
          // Let the browser set Content-Type with boundary automatically
        });
        
        clearTimeout(timeoutId);
        
        if (!res.ok) {
          const errorText = await res.text();
          let errorMessage = 'Failed to upload file';
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorMessage;
          } catch {
            errorMessage = errorText || errorMessage;
          }
          throw new Error(errorMessage);
        }
        
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return data.data;
      } catch (error: unknown) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Upload timeout - file may be too large');
        }
        throw error;
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload file');
    },
  });
}

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
