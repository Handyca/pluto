'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface Admin {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

// Helper function to handle fetch errors
async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  
  if (!res.ok) {
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

export function useAdmins() {
  return useQuery({
    queryKey: ['admins'],
    queryFn: async () => {
      const data = await fetchJSON<{ success: boolean; data: Admin[] }>('/api/admin/users');
      if (!data.success) throw new Error('Failed to fetch admins');
      return data.data;
    },
  });
}

export function useCreateAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { email: string; password: string }) => {
      const data = await fetchJSON<{ success: boolean; data: Admin }>('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!data.success) throw new Error('Failed to create admin');
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      toast.success('Admin user created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create admin');
    },
  });
}

export function useDeleteAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (adminId: string) => {
      const data = await fetchJSON<{ success: boolean }>(`/api/admin/users/${adminId}`, {
        method: 'DELETE',
      });
      if (!data.success) throw new Error('Failed to delete admin');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      toast.success('Admin user deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete admin');
    },
  });
}
