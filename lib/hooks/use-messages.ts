import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Message, MessageType } from '@/types';
import { toast } from 'sonner';

// Fetch messages for a session
export function useMessages(sessionId: string, token?: string) {
  return useQuery({
    queryKey: ['messages', sessionId],
    queryFn: async () => {
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/messages?sessionId=${sessionId}`, { headers });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as Message[];
    },
    enabled: !!sessionId,
  });
}

// Update message (admin only)
export function useUpdateMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, sessionId, updates }: { messageId: string; sessionId: string; updates: { isVisible?: boolean; isPinned?: boolean } }) => {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
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
      const res = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
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
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
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
      const res = await fetch(url);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });
}
