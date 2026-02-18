export function calculateVesselReviewStatus(
  monthValue: string,
  vesselReviewSubmittedDate?: Date | string | null
): string {
  if (vesselReviewSubmittedDate) {
    return 'Completed';
  }

  if (!monthValue || !monthValue.includes('-')) {
    return '';
  }

  const [year, month] = monthValue.split('-').map(Number);

  const nextMonth = new Date(year, month, 1);
  const overdueDate = new Date(year, month, 7);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (now < nextMonth) {
    return '';
  }

  if (now >= overdueDate) {
    return 'Overdue';
  }

  return 'Due';
}

export function calculateOfficeReviewStatus(
  monthValue: string,
  vesselReviewSubmittedDate?: Date | string | null,
  officeReviewSubmittedDate?: Date | string | null
): string {
  if (officeReviewSubmittedDate) {
    return 'Completed';
  }

  if (!vesselReviewSubmittedDate) {
    return '';
  }

  if (!monthValue || !monthValue.includes('-')) {
    return '';
  }

  const [year, month] = monthValue.split('-').map(Number);

  const nextMonth = new Date(year, month, 1);
  const overdueDate = new Date(year, month, 10);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (now < nextMonth) {
    return '';
  }

  if (now >= overdueDate) {
    return 'Overdue';
  }

  return 'Due';
}

export function enrichRecordWithReviewStatuses<T extends {
  monthValue?: string | null;
  vesselReviewSubmittedDate?: Date | string | null;
  officeReviewSubmittedDate?: Date | string | null;
}>(record: T): T & { vesselReviewStatus: string; officeReviewStatus: string } {
  const monthValue = record.monthValue || '';
  return {
    ...record,
    vesselReviewStatus: calculateVesselReviewStatus(
      monthValue,
      record.vesselReviewSubmittedDate
    ),
    officeReviewStatus: calculateOfficeReviewStatus(
      monthValue,
      record.vesselReviewSubmittedDate,
      record.officeReviewSubmittedDate
    ),
  };
}
