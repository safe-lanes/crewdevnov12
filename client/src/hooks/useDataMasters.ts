import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { DataMaster, MasterDataEntry, InsertDataMaster, InsertMasterDataEntry } from "@shared/schema";

// Master Categories API hooks
export function useDataMasters(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['/api/masters'],
    queryFn: async () => {
      const response = await fetch('/api/masters');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    enabled: options?.enabled ?? true, // Allow conditional fetching
  });
}

export function useDataMaster(id: string) {
  return useQuery({
    queryKey: [`/api/masters/${id}`],
    enabled: !!id,
  });
}

export function useCreateDataMaster() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: InsertDataMaster) => {
      const response = await apiRequest('POST', '/api/masters', data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/masters'] });
    },
  });
}

export function useUpdateDataMaster(id: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<InsertDataMaster>) => {
      const response = await apiRequest('PUT', `/api/masters/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/masters'] });
      queryClient.invalidateQueries({ queryKey: [`/api/masters/${id}`] });
    },
  });
}

export function useDeleteDataMaster() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/masters/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/masters'] });
    },
  });
}

// Master Data Entries API hooks
export function useMasterDataEntries(masterId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [`/api/masters/${masterId}/data`],
    queryFn: async () => {
      const response = await fetch(`/api/masters/${masterId}/data`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    enabled: options?.enabled !== undefined ? (!!masterId && options.enabled) : !!masterId,
  });
}

export function useMasterDataEntry(id: number) {
  return useQuery({
    queryKey: [`/api/master-data/${id}`],
    queryFn: async () => {
      const response = await fetch(`/api/master-data/${id}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    enabled: !!id,
  });
}

export function useCreateMasterDataEntry(masterId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Omit<InsertMasterDataEntry, 'masterId'>) => {
      const response = await apiRequest('POST', `/api/masters/${masterId}/data`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/masters/${masterId}/data`] });
    },
  });
}

export function useUpdateMasterDataEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data, masterId }: { id: number; data: Partial<InsertMasterDataEntry>; masterId: string }) => {
      const response = await apiRequest('PUT', `/api/master-data/${id}`, { ...data, masterId });
      return await response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/masters/${variables.masterId}/data`] });
      queryClient.invalidateQueries({ queryKey: [`/api/master-data/${variables.id}`] });
    },
  });
}

export function useDeleteMasterDataEntry(masterId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/master-data/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/masters/${masterId}/data`] });
    },
  });
}