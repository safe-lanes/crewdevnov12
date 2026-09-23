import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { usePermissions } from '@/contexts/PermissionsContext';
import { NoAccessPage } from '@/components/ProtectedRoute';
import { format, parseISO, isValid } from 'date-fns';
import {
  useCrewPortalSubmissions,
  useApproveCrewPortalSubmission,
  useRejectCrewPortalSubmission,
} from './hooks/useCrewPortalSubmissions';
import type { CrewPortalPendingChange } from './api/crewPortalSubmissionsApi';

const SECTION_LABELS: Record<string, string> = {
  particulars: 'Particulars', personal: 'Personal details', contact: 'Address & contact',
  family: 'Family', 'next-of-kin': 'Next of kin', 'vessel-types': 'Vessel types',
  children: 'Children', documents: 'Documents', visas: 'Visas', education: 'Education',
  licenses: 'Licenses', training: 'Training', 'sea-service': 'Sea service',
};
const ACTION_LABELS: Record<string, string> = { create: 'New entry', update: 'Update', delete: 'Deletion' };

const FIELD_LABELS: Record<string, Record<string, string>> = {
  particulars: {
    firstName: 'First Name', middleName: 'Middle Name', familyName: 'Family Name', gender: 'Gender',
    dob: 'Date of Birth', nationality: 'Nationality', nationalityUuid: 'Nationality', vesselTypeUuid: 'Vessel Type',
  },
  personal: {
    heightCm: 'Height (cm)', weightKg: 'Weight (kg)', bmi: 'BMI', placeOfBirthCity: 'Place of Birth (City)',
    placeOfBirthCountry: 'Place of Birth (Country)', placeOfBirthCountryUuid: 'Place of Birth (Country)',
    nativeLanguageUuid: 'Native Language', foreignLanguages: 'Foreign Languages', englishProficiency: 'English Proficiency',
  },
  contact: {
    countryOfResidence: 'Country of Residence', countryOfResidenceUuid: 'Country of Residence',
    nearestAirport: 'Nearest Airport', addressLine1: 'Address Line 1', addressLine2: 'Address Line 2',
    contactLandline: 'Landline', mobile: 'Mobile', email: 'Email',
  },
  family: {
    maritalStatus: 'Marital Status', numDependentChildren: 'Dependent Children', fatherName: "Father's Name",
    motherName: "Mother's Name", spouseFirstName: 'Spouse First Name', spouseMiddleName: 'Spouse Middle Name',
    spouseFamilyName: 'Spouse Family Name', spouseDob: 'Spouse Date of Birth',
  },
  'next-of-kin': {
    firstName: 'NOK: First Name', middleName: 'NOK: Middle Name', familyName: 'NOK: Family Name',
    telephone: 'NOK: Telephone', email: 'NOK: Email', address: 'NOK: Address', relationship: 'NOK: Relationship',
  },
  children: { firstName: 'First Name', middleName: 'Middle Name', familyName: 'Family Name', dob: 'Date of Birth', gender: 'Gender' },
  documents: {
    documentId: 'Document Type', documentName: 'Document Name', number: 'Document Number', issued: 'Issued On',
    expiry: 'Expiry Date', issuingAuthority: 'Issuing Authority', issuingCountryUuid: 'Issuing Country',
  },
  visas: { country: 'Country', countryUuid: 'Country', serialNo: 'Serial No.', issued: 'Issued On', expiry: 'Expiry Date', visaType: 'Visa Type' },
  education: { dateOfCompletion: 'Date of Completion', institution: 'Institution', subjectsField: 'Subjects/Field', qualifications: 'Qualifications' },
  licenses: {
    licenseId: 'License Type', certificateDocument: 'Certificate Document', abbr: 'Abbreviation', requirement: 'Requirement',
    certificateNo: 'Certificate No.', issuingAuthority: 'Issuing Authority', issuingCountryUuid: 'Issuing Country',
    issued: 'Issued On', expiry: 'Expiry Date',
  },
  training: {
    courseId: 'Course Type', trainingCourse: 'Training Course', abbr: 'Abbreviation', requirement: 'Requirement',
    certificateNo: 'Certificate No.', issuingAuthority: 'Issuing Authority', issuingCountryUuid: 'Issuing Country',
    issued: 'Issued On', expiry: 'Expiry Date',
  },
  'sea-service': {
    vesselName: 'Vessel Name', vesselUuid: 'Vessel', vesselTypeUuid: 'Vessel Type', imoNumber: 'IMO Number',
    yearBuilt: 'Year Built', deadweight: 'Deadweight', engineTypePower: 'Engine Type/Power', ownerOperator: 'Owner/Operator',
    rank: 'Rank', fromDate: 'From Date', toDate: 'To Date', periodMonths: 'Period (months)',
    experienceCategories: 'Experience Categories', signOffReason: 'Sign-off Reason',
  },
};

function humanize(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

function fieldLabel(section: string, key: string): string {
  return FIELD_LABELS[section]?.[key] || humanize(key);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = parseISO(value);
  return isValid(date) ? format(date, 'dd-MMM-yyyy HH:mm') : value;
}

const DATE_ONLY_KEYS = new Set(['dob', 'spouseDob', 'issued', 'expiry', 'dateOfCompletion', 'fromDate', 'toDate']);

function resolveDisplay(value: string, resolvedNames?: Record<string, string>): string {
  return resolvedNames?.[value] || value;
}

function formatValue(key: string, value: unknown, resolvedNames?: Record<string, string>): string {
  if (value === null || value === undefined || value === '') return '(empty)';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map((v) => (typeof v === 'string' ? resolveDisplay(v, resolvedNames) : String(v))).join(', ') : '(empty)';
  if (typeof value === 'string' && DATE_ONLY_KEYS.has(key)) {
    const date = parseISO(value);
    return isValid(date) ? format(date, 'dd-MMM-yyyy') : value;
  }
  if (typeof value === 'string') return resolveDisplay(value, resolvedNames);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function VesselTypesDiff({ row }: { row: CrewPortalPendingChange }): JSX.Element {
  let newUuids: string[] = [];
  try { newUuids = JSON.parse(row.payload || '{}').vesselTypeUuids || []; } catch { /* ignore */ }
  const prev = (row.previousValues as any) || {};
  const prevUuids: string[] = prev.vesselTypeUuids || [];
  const prevNames: string[] = prev.vesselTypeNames || [];
  const nameByUuid = new Map(prevUuids.map((u, i) => [u, prevNames[i] || u]));
  const added = newUuids.filter((u) => !prevUuids.includes(u));
  const removed = prevUuids.filter((u) => !newUuids.includes(u));
  if (!added.length && !removed.length) return <p className="text-sm text-muted-foreground">(no fields)</p>;
  return (
    <div className="space-y-0.5 text-sm">
      {added.map((u) => <div key={`add-${u}`} className="text-green-700">+ {resolveDisplay(u, row.resolvedNames)}</div>)}
      {removed.map((u) => <div key={`rem-${u}`} className="text-red-700">− {nameByUuid.get(u) || resolveDisplay(u, row.resolvedNames)}</div>)}
    </div>
  );
}

function ChangedFields({ row }: { row: CrewPortalPendingChange }): JSX.Element {
  if (row.section === 'vessel-types') {
    return <VesselTypesDiff row={row} />;
  }

  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(row.payload || '{}'); } catch { /* ignore */ }
  const previousValues = (row.previousValues as Record<string, unknown> | null | undefined) ?? null;

  const keys = row.action === 'delete'
    ? Object.keys(previousValues || {})
    : Object.keys(payload).filter((k) => payload[k] !== null && payload[k] !== undefined && payload[k] !== '');

  if (!keys.length) return <p className="text-sm text-muted-foreground">(no fields)</p>;

  const lines = keys.map((key) => {
    const label = fieldLabel(row.section, key);
    const names = row.resolvedNames;
    if (row.action === 'delete') {
      return { key, text: `${label}: ${formatValue(key, previousValues?.[key], names)}`, removing: true };
    }
    const newVal = payload[key];
    const hasPrev = previousValues && Object.prototype.hasOwnProperty.call(previousValues, key);
    const prevVal = hasPrev ? previousValues![key] : undefined;
    if (!hasPrev || prevVal === newVal) {
      return { key, text: `${label}: ${formatValue(key, newVal, names)}`, removing: false };
    }
    return { key, text: `${label}: ${formatValue(key, prevVal, names)} → ${formatValue(key, newVal, names)}`, removing: false };
  });

  return (
    <div className="space-y-0.5 text-sm">
      {lines.map((line) => (
        <div key={line.key} className={line.removing ? 'text-red-700' : undefined}>
          {line.removing ? 'Removing — ' : ''}{line.text}
        </div>
      ))}
    </div>
  );
}

/**
 * Office review queue for requirement 1 (crew-portal entries must be
 * verified before publishing). Approve applies the entry to the canonical
 * crew-pool tables via the same service functions the crew-app itself calls
 * (see server/v2/crew-app/crew-information/pendingChangesService.ts) — this
 * page only decides yes/no.
 */
export default function CrewPortalSubmissionsPage({ highlightPendingUuid }: { highlightPendingUuid?: string | null } = {}): JSX.Element {
  const { canView, canEdit, permissions } = usePermissions();
  const allowed = permissions.length === 0 || canView('Crew Portal Submissions');
  const canReview = permissions.length === 0 || canEdit('Crew Portal Submissions');

  const { data: pending, isLoading, error } = useCrewPortalSubmissions('pending');
  const approveMutation = useApproveCrewPortalSubmission();
  const rejectMutation = useRejectCrewPortalSubmission();
  const [rejecting, setRejecting] = useState<CrewPortalPendingChange | null>(null);
  const [reason, setReason] = useState('');

  if (!allowed) return <NoAccessPage menuName="Crew Portal Submissions" />;

  const submitReject = () => {
    if (!rejecting || !reason.trim()) return;
    rejectMutation.mutate({ pendingUuid: rejecting.pendingUuid, reason: reason.trim() }, {
      onSuccess: () => { setRejecting(null); setReason(''); },
    });
  };

  return (
    <div className="p-6 space-y-4" data-testid="page-crew-portal-submissions">
      <p className="text-sm text-muted-foreground">
        Entries crew members have submitted via the crew portal (mobile app). Nothing here is visible
        elsewhere in Crew Database until you approve it.
      </p>

      {isLoading && <p className="text-sm text-muted-foreground">Loading submissions…</p>}
      {error && <p className="text-sm text-destructive">Unable to load pending submissions.</p>}
      {!isLoading && !error && (pending?.length ?? 0) === 0 && (
        <p className="text-sm text-muted-foreground" data-testid="text-no-submissions">Nothing awaiting review.</p>
      )}

      {pending?.map((row) => (
        <Card
          key={row.pendingUuid}
          data-testid={`card-submission-${row.pendingUuid}`}
          className={row.pendingUuid === highlightPendingUuid ? 'ring-2 ring-primary' : undefined}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                {(row as any).crewName || row.crewUuid}
                {(row as any).empNo && <span className="text-xs text-muted-foreground font-normal">({(row as any).empNo})</span>}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{SECTION_LABELS[row.section] || row.section}</Badge>
                <Badge variant="outline">{ACTION_LABELS[row.action] || row.action}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="break-words"><ChangedFields row={row} /></div>
            <p className="text-xs text-muted-foreground">Submitted {formatDate(row.createdAt)}</p>
            {canReview && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  data-testid={`button-approve-${row.pendingUuid}`}
                  disabled={approveMutation.isPending}
                  onClick={() => approveMutation.mutate(row.pendingUuid)}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  data-testid={`button-reject-${row.pendingUuid}`}
                  disabled={rejectMutation.isPending}
                  onClick={() => { setRejecting(row); setReason(''); }}
                >
                  Reject
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Dialog open={Boolean(rejecting)} onOpenChange={(open) => { if (!open) setRejecting(null); }}>
        <DialogContent data-testid="dialog-reject-submission">
          <DialogHeader>
            <DialogTitle>Reject this submission</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The crew member will see this reason on their app and can submit again.
          </p>
          <Textarea
            data-testid="input-rejection-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejecting this entry"
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button
              data-testid="button-confirm-reject"
              disabled={!reason.trim() || rejectMutation.isPending}
              onClick={submitReject}
            >
              Confirm rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
