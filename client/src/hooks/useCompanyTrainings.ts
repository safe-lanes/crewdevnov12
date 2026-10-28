import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DbTrainingOption } from '@/components/training/DbTrainingCombobox';

interface CompanyTraining {
  id: number;
  ctUuid: string;
  trainingLabel: string;
}

export interface UseCompanyTrainingsResult {
  options: DbTrainingOption[];
  isLoading: boolean;
  isError: boolean;
  getName: (id: string) => string | undefined;
}

export function useCompanyTrainings(): UseCompanyTrainingsResult {
  const { data = [], isLoading, isError } = useQuery<CompanyTraining[]>({
    queryKey: ['/api/v2/admin/company-trainings'],
    retry: false,
  });

  // Option ids are the training's ct_uuid, which is what `corresponding_in_db`
  // stores. The serial `id` differs between office and vessel databases.
  const options = useMemo<DbTrainingOption[]>(
    () => data.map(t => ({ id: t.ctUuid, name: t.trainingLabel })),
    [data]
  );

  const lookup = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of options) m.set(o.id, o.name);
    return m;
  }, [options]);

  const getName = (id: string) => lookup.get(id);

  return { options, isLoading, isError, getName };
}
