import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { DataMaster, MasterDataEntry, InsertDataMaster, InsertMasterDataEntry } from "@shared/schema";

const V2_BASE = '/api/v2/masters';

export function useDataMasters(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [`${V2_BASE}/data`],
    queryFn: async () => {
      const response = await fetch(`${V2_BASE}/data`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    enabled: options?.enabled ?? true,
  });
}

export function useDataMaster(id: string) {
  return useQuery({
    queryKey: [`${V2_BASE}/data`, id],
    enabled: !!id,
    queryFn: async () => {
      const response = await fetch(`${V2_BASE}/data/${id}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
  });
}

export function useCreateDataMaster() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: InsertDataMaster) => {
      const response = await apiRequest('POST', `${V2_BASE}/data`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${V2_BASE}/data`] });
    },
  });
}

export function useUpdateDataMaster(id: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<InsertDataMaster>) => {
      const response = await apiRequest('PUT', `${V2_BASE}/data/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${V2_BASE}/data`] });
    },
  });
}

export function useDeleteDataMaster() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `${V2_BASE}/data/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${V2_BASE}/data`] });
    },
  });
}

export function useMasterDataEntries(masterId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [`${V2_BASE}/data`, masterId, 'entries'],
    queryFn: async () => {
      const response = await fetch(`${V2_BASE}/data/${masterId}/entries`);
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
    queryKey: [`${V2_BASE}/data-entries`, id],
    queryFn: async () => {
      const response = await fetch(`${V2_BASE}/data-entries/${id}`);
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
      const response = await apiRequest('POST', `${V2_BASE}/data/${masterId}/entries`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${V2_BASE}/data`, masterId, 'entries'] });
    },
  });
}

export function useUpdateMasterDataEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data, masterId }: { id: number; data: Partial<InsertMasterDataEntry>; masterId: string }) => {
      const response = await apiRequest('PUT', `${V2_BASE}/data-entries/${id}`, { ...data, masterId });
      return await response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`${V2_BASE}/data`, variables.masterId, 'entries'] });
      queryClient.invalidateQueries({ queryKey: [`${V2_BASE}/data-entries`, variables.id] });
    },
  });
}

export function useDeleteMasterDataEntry(masterId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `${V2_BASE}/data-entries/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${V2_BASE}/data`, masterId, 'entries'] });
    },
  });
}
