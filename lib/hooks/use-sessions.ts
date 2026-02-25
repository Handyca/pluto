import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Session, SessionWithRelations } from '@/types';
import { toast } from 'sonner';

// Helper function to handle fetch errors
async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  
  if (!res.ok) {
    // Try to parse error as JSON, fall back to status text
    let errorMessage = `HTTP ${res.status}`;
    try {
      const error = await res.json();
      errorMessage = error.error || error.message || errorMessage;
    } catch {
      errorMessage = res.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const data = await res.json();
  return data;
}

// Fetch all sessions
export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const data = await fetchJSON<{ success: boolean; data: SessionWithRelations[] }>('/api/sessions');
      if (!data.success) throw new Error('Failed to fetch sessions');
      return data.data;
    },
  });
}

// Fetch single session
export function useSession(id: string) {
  return useQuery({
    queryKey: ['sessions', id],
    queryFn: async () => {
      const data = await fetchJSON<{ success: boolean; data: SessionWithRelations }>(`/api/sessions/${id}`);
      if (!data.success) throw new Error('Failed to fetch session');
      return data.data;
    },
    enabled: !!id,
  });
}

// Fetch session by code (public)
export function useSessionByCode(code: string) {
  return useQuery({
    queryKey: ['sessions', 'code', code],
    queryFn: async () => {
      const data = await fetchJSON<{ success: boolean; data: Session }>(`/api/sessions/${code}/join`);
      if (!data.success) throw new Error('Failed to fetch session');
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
      const data = await fetchJSON<{ success: boolean; data: Session }>('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!data.success) throw new Error('Failed to create session');
      return data.data;
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
      const data = await fetchJSON<{ success: boolean; data: Session }>(`/api/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!data.success) throw new Error('Failed to update session');
      return data.data;
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
      const data = await fetchJSON<{ success: boolean }>(`/api/sessions/${id}`, {
        method: 'DELETE',
      });
      if (!data.success) throw new Error('Failed to delete session');
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
      const data = await fetchJSON<{ success: boolean; data: { token: string; [key: string]: unknown } }>(`/api/sessions/${values.code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantName: values.participantName,
          anonymousId: values.anonymousId,
        }),
      });
      if (!data.success) throw new Error('Failed to join session');
      return data.data;
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to join session');
    },
  });
}
