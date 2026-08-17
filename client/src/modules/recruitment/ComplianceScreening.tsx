import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { getCrewUserId } from '@/lib/crewUser';

const SCREENING_API = '/api/v2/recruitment';

// ---------- helpers ----------

type AnyScreening = any;

function getChecks(s: AnyScreening): any[] {
    return s?.result?.checks ?? [];
}

function checkOutcome(s: AnyScreening, checkType: string): any | null {
    return getChecks(s).find((c: any) => c?.checkType === checkType) ?? null;
}

// grey = never screened / pending, green = check completed, red = unable to check
function dotColor(s: AnyScreening, checkType: string): string {
    if (!s) return 'bg-gray-400';
    const c = checkOutcome(s, checkType);
    if (!c) {
        if (s.overallStatus === 'UNABLE_TO_CHECK') return 'bg-red-500';
        return 'bg-gray-400';
    }
    if (c.checkStatus === 'COMPLETED') return 'bg-green-500';
    if (c.checkStatus === 'UNABLE_TO_CHECK') return 'bg-red-500';
    return 'bg-gray-400';
}

function fmtDateTime(v: string | null | undefined): string {
    if (!v) return '—';
    try {
        return new Date(v).toLocaleString();
    } catch {
        return String(v);
    }
}

const CHECK_LABELS: Record<string, string> = {
    OFAC: 'OFAC',
    GLOBAL_SANCTIONS: 'Global Sanctions',
};

// ---------- component ----------

export function ComplianceScreeningIndicators({ recCanUuid }: { recCanUuid: string | null | undefined }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [summaryOpen, setSummaryOpen] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [remark, setRemark] = useState('');
    const [remarkDirty, setRemarkDirty] = useState(false);
    // Validation issues are LIVE-ONLY: they come back in the POST /screen
    // response and are never stored. After a page reload a pending screening
    // shows a generic note until Re-screen fetches a fresh list.
    const [liveIssues, setLiveIssues] = useState<any[] | null>(null);

    // ONE screening object per candidate (null = never screened)
    const { data: screening } = useQuery({
        queryKey: ['v2', 'screening', recCanUuid],
        queryFn: async () => {
            const res = await fetch(`${SCREENING_API}/candidates/${recCanUuid}/compliance-screening`);
            if (!res.ok) return null;
            return res.json();
        },
        enabled: !!recCanUuid,
    });

    const rescreenMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`${SCREENING_API}/candidates/${recCanUuid}/compliance-screening/screen`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auditUserUuid: getCrewUserId() }),
            });
            if (!res.ok) throw new Error('Re-screen request failed');
            return res.json(); // { screening, validationIssues }
        },
        onSuccess: (data: any) => {
            setLiveIssues(Array.isArray(data?.validationIssues) ? data.validationIssues : []);
            queryClient.invalidateQueries({ queryKey: ['v2', 'screening', recCanUuid] });
            toast({ title: 'Screening completed', description: 'Compliance screening was re-run for this candidate.' });
        },
        onError: () => {
            toast({ title: 'Error', description: 'Could not start screening. Please try again.', variant: 'destructive' });
        },
    });

    const remarkMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`${SCREENING_API}/candidates/${recCanUuid}/compliance-screening/remark`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ remark: remark.trim(), auditUserUuid: getCrewUserId() }),
            });
            if (!res.ok) throw new Error('Failed to save remark');
            return res.json();
        },
        onSuccess: () => {
            setRemarkDirty(false);
            queryClient.invalidateQueries({ queryKey: ['v2', 'screening', recCanUuid] });
            toast({ title: 'Remark saved' });
        },
        onError: () => {
            toast({ title: 'Error', description: 'Could not save remark.', variant: 'destructive' });
        },
    });

    if (!recCanUuid) return null;

    const anyCompleted = screening ? getChecks(screening).some((c: any) => c?.checkStatus === 'COMPLETED') : false;

    // Textarea shows the stored remark until the user starts editing
    const remarkValue = remarkDirty ? remark : (screening?.remark ?? '');

    return (
        <>
            {/* The two indicators */}
            <div className="flex items-center gap-3">
                {(['OFAC', 'GLOBAL_SANCTIONS'] as const).map((ct) => (
                    <button
                        key={ct}
                        type="button"
                        onClick={() => setSummaryOpen(true)}
                        className="flex items-center gap-1.5 cursor-pointer"
                        title={`${CHECK_LABELS[ct]} screening status`}
                        data-testid={`indicator-${ct.toLowerCase()}`}
                    >
                        <span className={`inline-block h-3 w-3 rounded-full ${dotColor(screening, ct)}`} />
                        <span className="text-xs text-gray-600">{ct === 'OFAC' ? 'OFAC' : 'Sanction'}</span>
                    </button>
                ))}
            </div>

            {/* Summary popup */}
            <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle style={{ color: '#16569e' }}>Compliance Screening</DialogTitle>
                    </DialogHeader>

                    {!screening ? (
                        <div className="text-sm text-gray-500 py-2">No screening has been run yet for this candidate.</div>
                    ) : (
                        <div className="space-y-3">
                            {/* Validation issues (screening pending). Live list when we have it,
                                generic note after a reload. */}
                            {screening.overallStatus === 'PENDING' && (
                                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                                    {liveIssues && liveIssues.length > 0 ? (
                                        <>
                                            <div className="font-medium mb-1">Screening is on hold — missing information:</div>
                                            <ul className="list-disc pl-4 space-y-0.5">
                                                {liveIssues.map((v: any, i: number) => (
                                                    <li key={i}>{v.message} ({v.section})</li>
                                                ))}
                                            </ul>
                                        </>
                                    ) : (
                                        <div className="font-medium">
                                            Screening is on hold — candidate data is incomplete. Click Re-screen to see what is missing.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Per-check rows */}
                            <div className="divide-y border rounded-md">
                                {(['OFAC', 'GLOBAL_SANCTIONS'] as const).map((ct) => {
                                    const c = checkOutcome(screening, ct);
                                    return (
                                        <div key={ct} className="flex items-center justify-between p-2.5 text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotColor(screening, ct)}`} />
                                                <span>{CHECK_LABELS[ct]}</span>
                                            </div>
                                            <span className="text-xs text-gray-600">
                                                {c ? (c.checkStatus === 'COMPLETED' ? `Completed — ${c.result ?? ''}` : String(c.checkStatus ?? 'PENDING').replace(/_/g, ' ')) : 'Pending'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Meta */}
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                                <div><span className="font-medium">Checked On:</span> {fmtDateTime(screening.checkedOn)}</div>
                                <div><span className="font-medium">Ref No.:</span> {getChecks(screening).map((c: any) => c?.referenceNo).filter(Boolean).join(', ') || '—'}</div>
                                <div className="col-span-2"><span className="font-medium">Checked By:</span> {screening.checkedByUuid ? 'User' : 'System (auto)'}</div>
                            </div>

                            {/* Single editable remark */}
                            <div className="space-y-2">
                                <div className="text-xs font-medium text-gray-700">Remark</div>
                                {screening.remarkOn && (
                                    <div className="text-[10px] text-gray-400">
                                        Last updated: {fmtDateTime(screening.remarkOn)} — {screening.remarkByUuid ? 'User' : 'Unknown'}
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <Textarea
                                        value={remarkValue}
                                        onChange={(e) => { setRemark(e.target.value); setRemarkDirty(true); }}
                                        placeholder="Add a remark..."
                                        className="text-xs min-h-[36px]"
                                        data-testid="input-screening-remark"
                                    />
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={!remarkDirty || !remark.trim() || remarkMutation.isPending}
                                        onClick={() => remarkMutation.mutate()}
                                        data-testid="button-save-remark"
                                    >
                                        Save
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between pt-2">
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={rescreenMutation.isPending}
                            onClick={() => rescreenMutation.mutate()}
                            data-testid="button-rescreen"
                        >
                            {rescreenMutation.isPending ? 'Screening...' : 'Re-screen'}
                        </Button>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                disabled={!anyCompleted}
                                onClick={() => { setSummaryOpen(false); setDetailsOpen(true); }}
                                data-testid="button-view-details"
                            >
                                View Details
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setSummaryOpen(false)}>Close</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Compliance Details popup */}
            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle style={{ color: '#16569e' }}>Compliance Details</DialogTitle>
                    </DialogHeader>
                    <Tabs defaultValue="OFAC">
                        <TabsList>
                            <TabsTrigger value="OFAC">OFAC</TabsTrigger>
                            <TabsTrigger value="GLOBAL_SANCTIONS">Global Sanctions</TabsTrigger>
                        </TabsList>
                        {(['OFAC', 'GLOBAL_SANCTIONS'] as const).map((ct) => {
                            const c = screening ? checkOutcome(screening, ct) : null;
                            return (
                                <TabsContent key={ct} value={ct}>
                                    {!c ? (
                                        <div className="text-sm text-gray-500 py-3">No completed {CHECK_LABELS[ct]} check available.</div>
                                    ) : (
                                        <div className="space-y-2 text-sm">
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                                <div><span className="font-medium">Status:</span> {c.checkStatus}</div>
                                                <div><span className="font-medium">Result:</span> {c.result ?? '—'}</div>
                                                <div><span className="font-medium">Ref No.:</span> {c.referenceNo ?? '—'}</div>
                                                <div><span className="font-medium">Checked At:</span> {fmtDateTime(c.checkedOn ?? screening?.checkedOn)}</div>
                                                <div><span className="font-medium">Provider:</span> {screening?.provider ?? '—'}</div>
                                            </div>
                                            <div className="text-xs font-medium text-gray-700 mt-2">Full response</div>
                                            <pre className="text-[11px] bg-gray-50 border rounded p-2 max-h-64 overflow-auto whitespace-pre-wrap">
                                                {JSON.stringify(c, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </TabsContent>
                            );
                        })}
                    </Tabs>
                    <div className="flex justify-end pt-2">
                        <Button size="sm" variant="outline" onClick={() => { setDetailsOpen(false); setSummaryOpen(true); }}>
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}