import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminUsersApiV2,
  type AdminUserDto,
  type CreateUserPayload,
  type UpdateUserPayload,
} from "../api/adminUsersApiV2";

const KEY = "/api/v2/admin/users";

export function useAdminUsersV2(params: { search?: string; type?: "Office" | "Vessel" } = {}) {
  return useQuery<AdminUserDto[]>({
    queryKey: [KEY, params],
    queryFn: () => adminUsersApiV2.list(params),
    staleTime: 30 * 1000,
  });
}

export function useAdminUserV2(uuid: string | null) {
  return useQuery<AdminUserDto>({
    queryKey: [KEY, uuid],
    queryFn: () => adminUsersApiV2.get(uuid as string),
    enabled: !!uuid,
  });
}

export function useCreateAdminUserV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => adminUsersApiV2.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateAdminUserV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, payload }: { uuid: string; payload: UpdateUserPayload }) =>
      adminUsersApiV2.update(uuid, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: [KEY, vars.uuid] });
    },
  });
}

export async function checkUsernameAvailable(
  username: string,
  excludeUuid?: string,
  domain?: string,
) {
  return adminUsersApiV2.usernameAvailable(username, excludeUuid, domain);
}

export async function checkCrewIdAvailable(
  crewId: string,
  excludeUuid?: string,
  domain?: string,
) {
  return adminUsersApiV2.crewIdAvailable(crewId, excludeUuid, domain);
}
