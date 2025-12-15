import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TrainingMaster, InsertTrainingMaster, UpdateTrainingMaster } from "@shared/schema";

export function useTrainingMasters(options?: { enabled?: boolean }) {
  return useQuery<TrainingMaster[]>({
    queryKey: ['/api/training-master'],
    queryFn: async () => {
      const response = await fetch('/api/training-master');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    enabled: options?.enabled ?? true,
  });
}

export function useTrainingMaster(id: number) {
  return useQuery<TrainingMaster>({
    queryKey: ['/api/training-master', id],
    queryFn: async () => {
      const response = await fetch(`/api/training-master/${id}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    enabled: !!id,
  });
}

export function useCreateTrainingMaster() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: InsertTrainingMaster) => {
      const response = await apiRequest('POST', '/api/training-master', data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/training-master'] });
    },
  });
}

export function useUpdateTrainingMaster() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateTrainingMaster }) => {
      const response = await apiRequest('PATCH', `/api/training-master/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/training-master'] });
    },
  });
}

export function useDeleteTrainingMaster() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/training-master/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/training-master'] });
    },
  });
}

export function useReorderTrainingMasters() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (orders: Array<{ id: number; sortOrder: number }>) => {
      const response = await apiRequest('POST', '/api/training-master/reorder', orders);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/training-master'] });
    },
  });
}

export const TRAINING_CATEGORIES = [
  { code: 'S', label: 'Statutory' },
  { code: 'N', label: 'Industry' },
  { code: 'M', label: 'Others' },
] as const;

export const TRAINING_GROUPS = [
  { code: 'A', label: 'Safety' },
  { code: 'B', label: 'Security' },
  { code: 'C', label: 'Cargo' },
  { code: 'D', label: 'Navigation' },
  { code: 'E', label: 'Engine' },
  { code: 'F', label: 'Environment' },
  { code: 'G', label: 'General' },
] as const;

export function getCategoryLabel(code: string): string {
  return TRAINING_CATEGORIES.find(c => c.code === code)?.label ?? code;
}

export function getGroupLabel(code: string): string {
  return TRAINING_GROUPS.find(g => g.code === code)?.label ?? code;
}

export function generateTrainingId(category: string, group: string, existingIds: string[]): string {
  const prefix = `${category}${group}`;
  const existingNumbers = existingIds
    .filter(id => id.startsWith(prefix))
    .map(id => parseInt(id.substring(2), 10))
    .filter(n => !isNaN(n));
  
  const nextNumber = existingNumbers.length > 0 
    ? Math.max(...existingNumbers) + 1 
    : 1;
  
  return `${prefix}${String(nextNumber).padStart(3, '0')}`;
}
