import { useMemo, useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { vesselApiV2 } from '../api/vesselApiV2';

interface GroupSignOnDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    planningRows: any[];
    vesselUuid: string;
}

interface GroupMember {
    planUuid: string;
    relieverCrewUuid: string;
    relieverCrewName: string;
    rank: string;
    relieverContractPeriodMonths?: number;
    relieverContractEndRangeStartMonths?: number;
    relieverContractEndRangeEndMonths?: number;
}

interface SignOnGroup {
    key: string;
    date: string;
    portUuid: string;
    portName: string;
    members: GroupMember[];
}

function formatGroupDate(date: string): string {
    try {
        return format(parseISO(date), 'dd-MMM-yyyy');
    } catch {
        return date;
    }
}

export function GroupSignOnDialog_v2({ open, onOpenChange, planningRows, vesselUuid }: GroupSignOnDialogProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Group computation: only Confirmed / In Transit relievers with a date + port,
    // grouped by exact date + port combo, keeping only groups of 2+ members.
    const groups = useMemo<SignOnGroup[]>(() => {
        const eligible = (planningRows || []).filter((r: any) =>
            r.relieverCrewUuid &&
            (r.joiningStatus === 'Confirmed' || r.joiningStatus === 'In Transit') &&
            r.relieverSignOnDate && r.joiningPort
        );

        const byKey = new Map<string, SignOnGroup>();
        for (const r of eligible) {
            const key = `${r.relieverSignOnDate}__${r.joiningPort}`;
            if (!byKey.has(key)) {
                byKey.set(key, {
                    key,
                    date: r.relieverSignOnDate,
                    portUuid: r.joiningPort,
                    portName: r.joiningPortName || '',
                    members: [],
                });
            }
            byKey.get(key)!.members.push({
                planUuid: r.planUuid || r.id,
                relieverCrewUuid: r.relieverCrewUuid,
                relieverCrewName: r.relieverCrewName || '',
                rank: r.rank || '',
                relieverContractPeriodMonths: r.relieverContractPeriodMonths,
                relieverContractEndRangeStartMonths: r.relieverContractEndRangeStartMonths,
                relieverContractEndRangeEndMonths: r.relieverContractEndRangeEndMonths,
            });
        }

        return Array.from(byKey.values())
            .filter(g => g.members.length >= 2)
            .sort((a, b) => {
                // earliest date first; same date -> port name alphabetical
                if (a.date !== b.date) return a.date < b.date ? -1 : 1;
                return a.portName.localeCompare(b.portName);
            });
    }, [planningRows]);

    const [selectedGroupKey, setSelectedGroupKey] = useState<string>('');
    const [selectedCrewUuids, setSelectedCrewUuids] = useState<Set<string>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);

    const selectedGroup = groups.find(g => g.key === selectedGroupKey) || null;

    // Default to the first group ONLY when the dialog transitions closed -> open,
    // or if the currently selected group no longer exists after a background data refresh.
    // This keeps the user's group choice and checkbox selections stable while the dialog is open.
    const wasOpenRef = useRef(false);
    useEffect(() => {
        if (!open) {
            wasOpenRef.current = false;
            return;
        }
        const justOpened = !wasOpenRef.current;
        wasOpenRef.current = true;
        const selectionStillValid = groups.some(g => g.key === selectedGroupKey);
        if (justOpened || !selectionStillValid) {
            const defaultGroup = groups[0] || null;
            setSelectedGroupKey(defaultGroup ? defaultGroup.key : '');
            setSelectedCrewUuids(new Set(defaultGroup ? defaultGroup.members.map(m => m.relieverCrewUuid) : []));
        }
    }, [open, groups, selectedGroupKey]);

    // When the group changes, all members reset to checked
    const handleGroupChange = (key: string) => {
        setSelectedGroupKey(key);
        const group = groups.find(g => g.key === key);
        setSelectedCrewUuids(new Set(group ? group.members.map(m => m.relieverCrewUuid) : []));
    };

    // Linked pickers: picking a date selects the first matching group (already sorted alphabetically by port);
    // picking a port selects its group (earliest date first thanks to sorting).
    const handleDatePick = (date: string) => {
        const group = groups.find(g => g.date === date);
        if (group) handleGroupChange(group.key);
    };
    const handlePortPick = (portUuid: string) => {
        const group = groups.find(g => g.portUuid === portUuid);
        if (group) handleGroupChange(group.key);
    };

    const uniqueDates = useMemo(() => Array.from(new Set(groups.map(g => g.date))), [groups]);
    const uniquePorts = useMemo(() => {
        const seen = new Map<string, string>();
        for (const g of groups) {
            if (!seen.has(g.portUuid)) seen.set(g.portUuid, g.portName);
        }
        return Array.from(seen.entries()).map(([portUuid, portName]) => ({ portUuid, portName }));
    }, [groups]);

    const allSelected = !!selectedGroup && selectedGroup.members.every(m => selectedCrewUuids.has(m.relieverCrewUuid));
    const toggleAll = (checked: boolean) => {
        if (!selectedGroup) return;
        setSelectedCrewUuids(checked ? new Set(selectedGroup.members.map(m => m.relieverCrewUuid)) : new Set());
    };
    const toggleOne = (crewUuid: string, checked: boolean) => {
        setSelectedCrewUuids(prev => {
            const next = new Set(prev);
            if (checked) next.add(crewUuid); else next.delete(crewUuid);
            return next;
        });
    };

    const selectedCrew = selectedGroup ? selectedGroup.members.filter(m => selectedCrewUuids.has(m.relieverCrewUuid)) : [];

    const handleSubmit = async () => {
        if (!selectedGroup || selectedCrew.length === 0) return;
        setIsSubmitting(true);
        const succeeded: string[] = [];
        const failed: { name: string; reason: string }[] = [];

        for (const crew of selectedCrew) {
            try {
                await vesselApiV2.signOnReliever(crew.planUuid, {
                    signOnDate: selectedGroup.date,
                    signOnPort: selectedGroup.portUuid,
                    contractPeriodMonths: crew.relieverContractPeriodMonths,
                    contractEndRangeStartMonths: crew.relieverContractEndRangeStartMonths,
                    contractEndRangeEndMonths: crew.relieverContractEndRangeEndMonths,
                });
                succeeded.push(crew.relieverCrewName);
            } catch (err: any) {
                failed.push({ name: crew.relieverCrewName, reason: err?.message || 'Unknown error' });
            }
        }

        queryClient.invalidateQueries({ queryKey: ['/api/v2/vessel', vesselUuid, 'planning'] });
        queryClient.invalidateQueries({ queryKey: ['/api/v2/vessel/crew-counts'] });

        if (succeeded.length > 0) {
            toast({
                title: 'Success',
                description: `Signed on: ${succeeded.join(', ')}`,
            });
        }
        if (failed.length > 0) {
            toast({
                title: 'Some crew could not be signed on',
                description: failed.map(f => `${f.name} — ${f.reason}`).join('; '),
                variant: 'destructive',
            });
        }

        setIsSubmitting(false);
        if (failed.length === 0) {
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg" data-testid="dialog-group-sign-on">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-[#16569e]">
                        <Users className="h-5 w-5" />
                        Group Sign On
                    </DialogTitle>
                </DialogHeader>

                {groups.length === 0 ? (
                    <div className="py-8 text-center text-sm text-gray-500" data-testid="text-no-groups">
                        No groups available
                    </div>
                ) : (
                    <>
                        <div className="rounded-md border border-[#e1e8ed] bg-[#f0f7ff] px-3 py-2 text-xs text-[#16569e]">
                            Select the crew members you want to sign on together. Enter common sign on details below.
                        </div>

                        <div className="rounded-md border border-[#e1e8ed]">
                            <div className="flex items-center gap-3 border-b border-[#e1e8ed] bg-gray-50 px-3 py-2">
                                <Checkbox
                                    checked={allSelected}
                                    onCheckedChange={(checked) => toggleAll(checked === true)}
                                    data-testid="checkbox-group-sign-on-all"
                                />
                                <span className="flex-1 text-xs font-medium text-gray-700">Name</span>
                                <span className="flex-1 text-xs font-medium text-gray-700">Rank</span>
                            </div>
                            <div className="max-h-60 overflow-y-auto">
                                {selectedGroup?.members.map((m) => (
                                    <div key={m.relieverCrewUuid} className="flex items-center gap-3 border-b border-[#e1e8ed] px-3 py-2 last:border-b-0">
                                        <Checkbox
                                            checked={selectedCrewUuids.has(m.relieverCrewUuid)}
                                            onCheckedChange={(checked) => toggleOne(m.relieverCrewUuid, checked === true)}
                                            data-testid={`checkbox-group-sign-on-${m.relieverCrewUuid}`}
                                        />
                                        <span className="flex-1 text-xs text-gray-900">{m.relieverCrewName}</span>
                                        <span className="flex-1 text-xs text-gray-900">{m.rank}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="mb-2 text-sm font-medium text-gray-900">Common Sign On Details</div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs text-gray-700">
                                        Sign On Date <span className="text-red-500">*</span>
                                    </Label>
                                    <Select value={selectedGroup?.date || ''} onValueChange={handleDatePick}>
                                        <SelectTrigger className="mt-1 h-9 text-xs" data-testid="select-group-sign-on-date">
                                            <SelectValue placeholder="Select date" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {uniqueDates.map(date => (
                                                <SelectItem key={date} value={date} className="text-xs">
                                                    {formatGroupDate(date)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs text-gray-700">
                                        Sign On Port <span className="text-red-500">*</span>
                                    </Label>
                                    <Select value={selectedGroup?.portUuid || ''} onValueChange={handlePortPick}>
                                        <SelectTrigger className="mt-1 h-9 text-xs" data-testid="select-group-sign-on-port">
                                            <SelectValue placeholder="Select port" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {uniquePorts.map(port => (
                                                <SelectItem key={port.portUuid} value={port.portUuid} className="text-xs">
                                                    {port.portName}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                <div className="flex justify-end gap-2 pt-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                        className="h-8 text-xs"
                        data-testid="button-group-sign-on-cancel"
                    >
                        Cancel
                    </Button>
                    {groups.length > 0 && (
                        <Button
                            onClick={handleSubmit}
                            disabled={selectedCrew.length === 0 || isSubmitting}
                            className="h-8 bg-[#16569e] text-xs text-white hover:bg-[#16569e]/90"
                            data-testid="button-group-sign-on-submit"
                        >
                            {isSubmitting ? 'Signing On...' : 'Submit'}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
