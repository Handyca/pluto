import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Session,SessionWithRelations } from '@/types';
import { toast } from 'sonner';

// Fetch all sessions
export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as SessionWithRelations[];
    },
  });
}

// Fetch single session by ID
export function useSession(id: string) {
  return useQuery({
    queryKey: ['sessions', id],
    queryFn: async () => {
      const res = await fetch(`/api/sessions/${id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as SessionWithRelations;
    },
    enabled: !!id,
  });
}

// Fetch session by code (public)
export function useSessionByCode(code: string) {
  return useQuery({
    queryKey: ['sessions', 'code', code],
    queryFn: async () => {
      const res = await fetch(`/api/sessions/${code}/join`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    enabled: !!code,
  });
}

// Create session
export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: { title: string; backgroundType?: string; backgroundUrl?: string }) => {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as Session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create session');
    },
  });
}

// Update session
export function useUpdateSession(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: Partial<Session>) => {
      const res = await fetch(`/api/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as Session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', id] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update session');
    },
  });
}

// Delete session
export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sessions/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete session');
    },
  });
}

// Join session
export function useJoinSession() {
  return useMutation({
    mutationFn: async (values: { code: string; participantName: string; anonymousId?: string }) => {
      const res = await fetch(`/api/sessions/${values.code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantName: values.participantName,
          anonymousId: values.anonymousId,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to join session');
    },
  });
}
