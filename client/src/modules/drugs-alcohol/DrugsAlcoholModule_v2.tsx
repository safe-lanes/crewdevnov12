import { useState, useEffect, useMemo } from 'react';
import { usePermissions } from '@/contexts/PermissionsContext';
import { NoAccessPage } from '@/components/ProtectedRoute';
import { useMutation } from '@tanstack/react-query';
import MainLayout from '@/components/main/MainLayout';
import DrugsAlcoholSideBar from './DrugsAlcoholSideBar_v2';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter, ChevronDown, Plus } from 'lucide-react';
import { AnnualTestTable_v2 } from './AnnualTestTable_v2';
import { PeriodicTestTable_v2 } from './PeriodicTestTable_v2';
import { MonthlyTestTable_v2 } from './MonthlyTestTable_v2';
import { PostIncidentTestTable_v2 } from './PostIncidentTestTable_v2';
import { OtherTestsTable_v2 } from './OtherTestsTable_v2';
import { SummaryTable_v2 } from './SummaryTable_v2';
import { HistoryTable_v2 } from './HistoryTable_v2';
import { DrugAlcoholTestForm_v2 } from './DrugAlcoholTestForm_v2';
import { drugsAlcoholApiV2 } from './api/drugsAlcoholApiV2';
import { useViewport } from '@/hooks/useViewport';
import { useVesselsV2 } from '@/hooks/v2/useMasterDataV2';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useDrugsAlcoholFiltersStore } from '@/stores/drugsAlcoholFiltersStore';
import { useV2FleetGroups, useV2AdditionalGroups, parseGroupVesselNames } from '@/modules/rest-hours/hooks/useRestHoursV2Data';

export function DrugsAlcoholModule_v2() {
    const [selectedDrugsAlcoholPage, setSelectedDrugsAlcoholPage] = useState<string>("annual");
    const { canView, canCreate, canEdit, canDelete, permissions, userType, myVessels } = usePermissions();
    const isShipUser = userType === 'Ship';
    const allowedPages = useMemo(() => {
        const all = ["annual", "periodic", "monthly", "post-incident", "others", "summary", "history"];
        if (permissions.length === 0) return all;
        const pageToMenu: Record<string, string> = { "annual": "Annual", "periodic": "Periodic", "monthly": "Monthly", "post-incident": "Post Incident", "others": "Others", "summary": "Summary", "history": "History" };
        return all.filter(p => canView(pageToMenu[p] || p));
    }, [permissions, canView]);

    useEffect(() => {
        if (allowedPages.length > 0 && !allowedPages.includes(selectedDrugsAlcoholPage)) {
            setSelectedDrugsAlcoholPage(allowedPages[0]);
        }
    }, [allowedPages]);

    // Deep-link consumption: when the URL carries `recordUuid` and `page`
    // (e.g. from the Management Dashboard D&A Analysis drill-down), open the
    // matching test record in the form on mount and strip the params so a
    // manual refresh shows the user the normal page, and so wouter's cached
    // location is in sync with the visible URL (which lets the browser Back
    // button restore the previous dashboard URL — including the drill-down
    // popup state encoded there).
    //
    // Implementation mirrors the Crew Retention deep-link pattern: capture
    // params once on mount via `useMemo`, then strip them in a synchronous
    // `useEffect` (NOT inside an async fetch's `finally`, which would race
    // with wouter's location cache and break the back button).
    const initialDeepLink = useMemo(() => {
        if (typeof window === 'undefined') return null;
        const sp = new URLSearchParams(window.location.search);
        const recordUuid = sp.get('recordUuid');
        const page = sp.get('page');
        if (!recordUuid) return null;
        return { recordUuid, page, from: sp.get('from') };
    }, []);

    const [fromDashboard] = useState(() => initialDeepLink?.from === 'dashboard');

    // Strip deep-link params from the URL synchronously on mount, before any
    // async work has a chance to run. This keeps wouter's cached location
    // aligned with the visible URL.
    useEffect(() => {
        if (!initialDeepLink || typeof window === 'undefined') return;
        const sp = new URLSearchParams(window.location.search);
        let changed = false;
        for (const key of ['recordUuid', 'page', 'from']) {
            if (sp.has(key)) { sp.delete(key); changed = true; }
        }
        if (changed) {
            const qs = sp.toString();
            const newUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
            window.history.replaceState({}, '', newUrl);
        }
    }, [initialDeepLink]);

    // Fetch the deep-linked record and open it in the form. This runs once
    // per mount; `allowedPages` is read but intentionally not in deps so a
    // permissions re-render does not re-trigger the fetch.
    useEffect(() => {
        if (!initialDeepLink) return;
        const { recordUuid, page } = initialDeepLink;

        let cancelled = false;
        type DATestType = 'annual' | 'periodic' | 'monthly' | 'post-incident' | 'others';
        const allTestTypes: readonly DATestType[] = [
            'annual', 'periodic', 'monthly', 'post-incident', 'others',
        ] as const;
        const isDATestType = (v: unknown): v is DATestType =>
            typeof v === 'string' && (allTestTypes as readonly string[]).includes(v);

        (async () => {
            try {
                const record = await drugsAlcoholApiV2.testRecords.getByUuid(recordUuid);
                if (cancelled || !record) return;
                if (!isDATestType(record.testType)) {
                    console.warn(
                        `Deep-linked D&A record ${recordUuid} has unsupported testType "${record.testType}"; ignoring.`,
                    );
                    return;
                }
                const testType: DATestType = record.testType;
                // Authoritative sub-page comes from the record itself; the URL
                // `page` hint is only used to switch the page early when it
                // matches what we will end up opening.
                const recordPage = testType;
                // Submodule access gate: do not open a deep-linked record whose
                // test type the user is not permitted to view. The form modal
                // renders outside renderContent(), so without this check a denied
                // user could still see restricted record details via deep link.
                if (permissions.length > 0 && !allowedPages.includes(recordPage)) {
                    return;
                }
                if (allowedPages.includes(recordPage)) {
                    setSelectedDrugsAlcoholPage(recordPage);
                } else if (page && allowedPages.includes(page) && page === recordPage) {
                    setSelectedDrugsAlcoholPage(page);
                }
                handleOpenForm(testType, record.vesselId ?? undefined, recordUuid);
            } catch (err) {
                console.error('Failed to open deep-linked D&A record', err);
            }
        })();

        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialDeepLink]);
    const daPageToMenu: Record<string, string> = { "annual": "Annual", "periodic": "Periodic", "monthly": "Monthly", "post-incident": "Post Incident", "others": "Others", "summary": "Summary", "history": "History" };
    const currentDAMenu = daPageToMenu[selectedDrugsAlcoholPage] || "Annual";
    const { toast } = useToast();

    const viewport = useViewport();
    const isPhone = viewport === 'phone';
    const isTablet = viewport === 'tablet';
    const isSmallScreen = isPhone || isTablet;

    const {
        filterType, selectedVessels, fleetValue, addGroupValue, summaryVessel,
        draftFilterType, draftSelectedVessels, draftFleetValue, draftAddGroupValue, draftSummaryVessel,
        toggleDraftVessel, setDraftSelectedVessels, selectDraftFleet, selectDraftAddGroup,
        setDraftFilterType, setDraftSummaryVessel, clearDraftFilters,
        applyFilters, applySummary, syncDraftFromApplied,
    } = useDrugsAlcoholFiltersStore();
    const [showFilters, setShowFilters] = useState(true);
    
    const [showForm, setShowForm] = useState(false);
    const [formTestType, setFormTestType] = useState<'annual' | 'periodic' | 'monthly' | 'post-incident' | 'others'>();
    const [formVesselId, setFormVesselId] = useState<string>();
    const [editingRecordUuid, setEditingRecordUuid] = useState<string | undefined>();

    const { data: externalVessels = [], isLoading: vesselsLoading } = useVesselsV2();
    
    const vessels = useMemo(() => {
        return externalVessels.map((v: any, index: number) => ({
            id: index + 1,
            vesselId: v.vesselUuid || v.vuid || v.entryId || `VSL-${String(index + 1).padStart(3, '0')}`,
            name: v.vessel || v.name || 'Unknown Vessel',
        }));
    }, [externalVessels]);
    
    const shipUserVesselName = useMemo(() => {
        if (!isShipUser || myVessels.length === 0) return null;
        return myVessels[0].vessel;
    }, [isShipUser, myVessels]);

    const { fleetGroups, isLoading: fleetGroupsLoading } = useV2FleetGroups();
    const { additionalGroups, isLoading: additionalGroupsLoading } = useV2AdditionalGroups();

    useEffect(() => {
        syncDraftFromApplied();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const resolvedVesselNames = useMemo<string[]>(() => {
        let names: string[] = [];
        if (filterType === 'vessel') {
            names = selectedVessels;
        } else if (filterType === 'fleet') {
            names = parseGroupVesselNames(fleetGroups.find(g => String(g.id) === fleetValue)?.vessels);
        } else if (filterType === 'addGroup') {
            names = parseGroupVesselNames(additionalGroups.find(g => String(g.id) === addGroupValue)?.vessels);
        }
        const valid = new Set(vessels.map((v: any) => v.name));
        return names.filter(n => valid.has(n));
    }, [filterType, selectedVessels, fleetValue, addGroupValue, fleetGroups, additionalGroups, vessels]);

    useEffect(() => {
        if (isShipUser && myVessels.length > 0 && vessels.length > 0) {
            const myVesselName = myVessels[0].vessel;
            const matchedVessel = vessels.find((v: any) => v.name === myVesselName);
            if (matchedVessel) {
                setDraftSelectedVessels([matchedVessel.name]);
                applyFilters();
                setDraftSummaryVessel(matchedVessel.vesselId);
                applySummary();
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isShipUser, myVessels, vessels]);

    useEffect(() => {
        if (!isShipUser && vessels.length > 0 && !summaryVessel) {
            setDraftSummaryVessel(vessels[0].vesselId);
            applySummary();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isShipUser, vessels, summaryVessel]);

    const handleClearFilters = () => {
        clearDraftFilters();
        applyFilters();
    };

    const handleApplyFilters = () => {
        applyFilters();
    };

    const handleOpenForm = (testType: 'annual' | 'periodic' | 'monthly' | 'post-incident' | 'others', vesselId?: string, recordUuid?: string) => {
        setFormTestType(testType);
        setFormVesselId(vesselId);
        setEditingRecordUuid(recordUuid);
        setShowForm(true);
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setFormTestType(undefined);
        setFormVesselId(undefined);
        setEditingRecordUuid(undefined);
        if (fromDashboard && typeof window !== 'undefined') {
            window.history.back();
        }
    };

    const transformFormDataForAPI = (data: any, status: 'draft' | 'submitted') => {
        const getFrequencyMonths = () => {
            if (data.frequencyMonths !== undefined && data.frequencyMonths !== null) {
                return data.frequencyMonths;
            }
            const frequencyMap: Record<string, number> = {
                'annual': 12,
                'periodic': 3,
                'monthly': 1,
                'post-incident': 0,
                'others': 0
            };
            return frequencyMap[data.testType] ?? 12;
        };

        const toJsonString = (value: any): string | null => {
            if (value === undefined || value === null) return null;
            if (typeof value === 'string') return value;
            return JSON.stringify(value);
        };

        return {
            vesselId: data.vesselId,
            testType: data.testType,
            alcoholDrugType: toJsonString(data.alcoholDrugType),
            placeLocation: data.placeLocation || null,
            dateTimeTestCompleted: data.dateTimeTestCompleted || null,
            externalTestResultsDate: data.externalTestResultsDate || null,
            incidentId: data.incidentId || null,
            testingEquipment: toJsonString(data.testingEquipment),
            equipmentNotApplicable: data.equipmentNotApplicable || false,
            frequencyMonths: getFrequencyMonths(),
            incidentTitle: data.incidentTitle || null,
            incidentDateTime: data.incidentDateTime || null,
            alcoholTestDateTime: data.alcoholTestDateTime || null,
            drugTestDateTime: data.drugTestDateTime || null,
            reasonForTesting: data.reasonForTesting || null,
            description: data.description || null,
            initiatedBy: data.initiatedBy || null,
            personnelTested: toJsonString(data.personnelTested),
            comments: data.comments || null,
            masterDeputySignature: toJsonString(data.masterDeputySignature),
            attachmentFile: data.attachments ? toJsonString(data.attachments) : (data.attachmentFile || null),
            status: status,
        };
    };

    const saveMutation = useMutation({
        mutationFn: async ({ data, status }: { data: any; status: 'draft' | 'submitted' }) => {
            const payload = transformFormDataForAPI(data, status);
            
            if (editingRecordUuid) {
                return drugsAlcoholApiV2.testRecords.update(editingRecordUuid, payload);
            } else {
                return drugsAlcoholApiV2.testRecords.create(payload);
            }
        },
        onSuccess: (record: any, variables) => {
            queryClient.invalidateQueries({ queryKey: ['v2', 'drugs-alcohol'] });
            queryClient.invalidateQueries({ queryKey: ['/api/v2/drugs-alcohol/test-records'] });
            toast({
                title: variables.status === 'submitted' ? "Form Submitted" : "Draft Saved",
                description: variables.status === 'submitted' 
                    ? "The Drug & Alcohol test record has been submitted successfully."
                    : "Your draft has been saved. You can continue editing later.",
            });
            if (variables.status === 'submitted') {
                handleCloseForm();
            } else if (record?.daUuid && !editingRecordUuid) {
                setEditingRecordUuid(record.daUuid);
            }
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "Failed to save the record. Please try again.",
                variant: "destructive",
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (uuid: string) => {
            return drugsAlcoholApiV2.testRecords.delete(uuid);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['v2', 'drugs-alcohol'] });
            queryClient.invalidateQueries({ queryKey: ['/api/v2/drugs-alcohol/test-records'] });
            toast({
                title: "Record Deleted",
                description: "The Drug & Alcohol test record has been deleted.",
            });
            handleCloseForm();
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "Failed to delete the record. Please try again.",
                variant: "destructive",
            });
        },
    });

    const handleSaveForm = (data: any) => {
        if (!data.vesselId || !data.testType) {
            toast({
                title: "Missing Required Fields",
                description: "Please select a Vessel before saving.",
                variant: "destructive",
            });
            return;
        }
        if (!data.alcoholDrugType || data.alcoholDrugType.length === 0) {
            toast({
                title: "Missing Required Fields",
                description: "Please select Alcohol / Drug before saving.",
                variant: "destructive",
            });
            return;
        }
        saveMutation.mutate({ data, status: 'draft' });
    };

    const handleSubmitForm = (data: any) => {
        if (!data.vesselId || !data.testType) {
            toast({
                title: "Missing Required Fields",
                description: "Please select a Vessel before submitting.",
                variant: "destructive",
            });
            return;
        }
        if (!data.alcoholDrugType || data.alcoholDrugType.length === 0) {
            toast({
                title: "Missing Required Fields",
                description: "Please select Alcohol / Drug before submitting.",
                variant: "destructive",
            });
            return;
        }
        saveMutation.mutate({ data, status: 'submitted' });
    };

    const handleDeleteForm = () => {
        if (editingRecordUuid) {
            deleteMutation.mutate(editingRecordUuid);
        } else {
            handleCloseForm();
        }
    };

    const renderVesselSelect = () => {
        if (isShipUser) {
            return (
                <span className="h-8 flex items-center text-xs font-medium text-[#0f172a] dark:text-white px-3 bg-gray-50 dark:bg-neutral-800 border border-input rounded-md min-w-[120px]" data-testid="text-vessel-locked">
                    {shipUserVesselName || "No vessel assigned"}
                </span>
            );
        }
        return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={`h-8 text-xs text-[#0f172a] dark:text-white justify-between bg-transparent dark:bg-neutral-900 border-input ${isPhone ? 'w-full' : 'w-40'}`}
                    disabled={vesselsLoading}
                    data-testid="select-vessel-multi"
                >
                    <span className="truncate">
                        {draftSelectedVessels.length > 0 
                            ? `${draftSelectedVessels.length} selected` 
                            : vesselsLoading ? "Loading..." : "Vessel"
                        }
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50 ml-2" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-2" align="start">
                <div className="max-h-60 overflow-y-auto">
                    {vessels.map((vessel: any) => (
                        <div 
                            key={vessel.id} 
                            className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                        >
                            <Checkbox 
                                checked={draftSelectedVessels.includes(vessel.name)}
                                onCheckedChange={() => toggleDraftVessel(vessel.name)}
                                data-testid={`checkbox-vessel-${vessel.id}`}
                            />
                            <label 
                                className="text-sm cursor-pointer flex-1"
                                onClick={() => toggleDraftVessel(vessel.name)}
                            >
                                {vessel.name}
                            </label>
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
    };

    const renderFleetSelect = () => (
        <Select value={draftFleetValue} onValueChange={selectDraftFleet}>
            <SelectTrigger 
                className={`h-8 text-xs text-[#0f172a] dark:text-white placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900 ${isPhone ? 'w-full' : 'w-40'}`}
                data-testid="select-fleet-value"
            >
                <SelectValue placeholder={fleetGroupsLoading ? "Loading..." : "Select Fleet"} />
            </SelectTrigger>
            <SelectContent>
                {fleetGroups.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    );

    const renderAddGroupSelect = () => (
        <Select value={draftAddGroupValue} onValueChange={selectDraftAddGroup}>
            <SelectTrigger 
                className={`h-8 text-xs text-[#0f172a] dark:text-white placeholder:text-[#8899ae] bg-transparent dark:bg-neutral-900 ${isPhone ? 'w-full' : 'w-40'}`}
                data-testid="select-addGroup-value"
            >
                <SelectValue placeholder={additionalGroupsLoading ? "Loading..." : "Select Group"} />
            </SelectTrigger>
            <SelectContent>
                {additionalGroups.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    );

    const renderFullFilterBar = () => {
        if (!showFilters) return null;

        if (isPhone) {
            return (
                <div className="flex flex-col gap-3 mb-4 p-3 bg-transparent rounded-lg" data-testid="filter-container">
                    <RadioGroup 
                        value={draftFilterType} 
                        onValueChange={(value: "vessel" | "fleet" | "addGroup") => setDraftFilterType(value)}
                        className="flex flex-col gap-3"
                    >
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <RadioGroupItem 
                                    value="vessel" 
                                    id="filter-vessel"
                                    className="h-4 w-4"
                                    data-testid="radio-vessel"
                                />
                            </div>
                            {draftFilterType === 'vessel' && renderVesselSelect()}
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <RadioGroupItem 
                                    value="fleet" 
                                    id="filter-fleet"
                                    className="h-4 w-4"
                                    data-testid="radio-fleet"
                                />
                            </div>
                            {draftFilterType === 'fleet' && renderFleetSelect()}
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <RadioGroupItem 
                                    value="addGroup" 
                                    id="filter-addGroup"
                                    className="h-4 w-4"
                                    data-testid="radio-addGroup"
                                />
                            </div>
                            {draftFilterType === 'addGroup' && renderAddGroupSelect()}
                        </div>
                    </RadioGroup>
                    <Button
                        variant="default"
                        onClick={handleApplyFilters}
                        className="h-8 w-full text-[11px] bg-[#16569e] hover:bg-[#0d4a8f] text-white"
                        data-testid="button-apply-filters"
                    >
                        Apply
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleClearFilters}
                        className="h-8 w-full text-[#8798ad] text-[11px] border-[#e1e8ed]"
                        data-testid="button-clear-filters"
                    >
                        Clear
                    </Button>
                </div>
            );
        }

        if (isTablet) {
            return (
                <div className="flex flex-col gap-3 mb-4 p-4 pl-0 bg-transparent rounded-lg" data-testid="filter-container">
                    <RadioGroup 
                        value={draftFilterType} 
                        onValueChange={(value: "vessel" | "fleet" | "addGroup") => setDraftFilterType(value)}
                        className="grid grid-cols-3 gap-4"
                    >
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <RadioGroupItem 
                                    value="vessel" 
                                    id="filter-vessel"
                                    className="h-4 w-4"
                                    data-testid="radio-vessel"
                                />
                            </div>
                            {renderVesselSelect()}
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <RadioGroupItem 
                                    value="fleet" 
                                    id="filter-fleet"
                                    className="h-4 w-4"
                                    data-testid="radio-fleet"
                                />
                            </div>
                            {renderFleetSelect()}
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <RadioGroupItem 
                                    value="addGroup" 
                                    id="filter-addGroup"
                                    className="h-4 w-4"
                                    data-testid="radio-addGroup"
                                />
                            </div>
                            {renderAddGroupSelect()}
                        </div>
                    </RadioGroup>
                    <Button
                        variant="default"
                        onClick={handleApplyFilters}
                        className="h-8 w-16 text-[11px] bg-[#16569e] hover:bg-[#0d4a8f] text-white"
                        data-testid="button-apply-filters"
                    >
                        Apply
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleClearFilters}
                        className="h-8 w-16 text-[#8798ad] text-[11px] border-[#e1e8ed]"
                        data-testid="button-clear-filters"
                    >
                        Clear
                    </Button>
                </div>
            );
        }

        return (
            <div className="flex flex-wrap gap-4 mb-4 p-4 pl-0 bg-transparent rounded-lg" data-testid="filter-container">
                <RadioGroup 
                    value={draftFilterType} 
                    onValueChange={(value: "vessel" | "fleet" | "addGroup") => setDraftFilterType(value)}
                    className="flex items-center gap-6"
                >
                    <div className="flex items-center gap-2">
                        <RadioGroupItem 
                            value="vessel" 
                            id="filter-vessel"
                            className="h-4 w-4"
                            data-testid="radio-vessel"
                        />
                        {renderVesselSelect()}
                    </div>
                    <div className="flex items-center gap-2">
                        <RadioGroupItem 
                            value="fleet" 
                            id="filter-fleet"
                            className="h-4 w-4"
                            data-testid="radio-fleet"
                        />
                        {renderFleetSelect()}
                    </div>
                    <div className="flex items-center gap-2">
                        <RadioGroupItem 
                            value="addGroup" 
                            id="filter-addGroup"
                            className="h-4 w-4"
                            data-testid="radio-addGroup"
                        />
                        {renderAddGroupSelect()}
                    </div>
                </RadioGroup>
                <Button
                    variant="default"
                    onClick={handleApplyFilters}
                    className="h-8 w-16 text-[11px] bg-[#16569e] hover:bg-[#0d4a8f] text-white"
                    data-testid="button-apply-filters"
                >
                    Apply
                </Button>
                <Button
                    variant="outline"
                    onClick={handleClearFilters}
                    className="h-8 w-16 text-[#8798ad] text-[11px] border-[#e1e8ed]"
                    data-testid="button-clear-filters"
                >
                    Clear
                </Button>
            </div>
        );
    };

    const renderVesselOnlyFilterBar = () => {
        if (!showFilters) return null;

        return (
            <div className={`flex mb-4 bg-transparent rounded-lg ${isPhone ? 'flex-col gap-3 p-3' : 'flex-wrap gap-4 p-4 pl-0'}`} data-testid="filter-container">
                <div className={`flex gap-2 ${isPhone ? 'flex-col' : 'items-center'}`}>
                    <Label className="text-xs font-normal text-[#4f5863] dark:text-neutral-300">
                        Vessel
                    </Label>
                    {isShipUser ? (
                        <span className="h-8 flex items-center text-xs font-medium text-[#0f172a] dark:text-white px-3 bg-gray-50 dark:bg-neutral-800 border border-input rounded-md min-w-[120px]" data-testid="text-vessel-summary-locked">
                            {shipUserVesselName || "No vessel assigned"}
                        </span>
                    ) : (
                        <Select 
                            value={draftSummaryVessel} 
                            onValueChange={setDraftSummaryVessel}
                            disabled={vesselsLoading}
                        >
                            <SelectTrigger 
                                className={`h-8 text-xs bg-white dark:bg-neutral-900 border-input ${isPhone ? 'w-full' : 'w-48'}`}
                                data-testid="select-vessel-summary"
                            >
                                <SelectValue placeholder={vesselsLoading ? "Loading..." : "Select Vessel"} />
                            </SelectTrigger>
                            <SelectContent>
                                {vessels.map((vessel: any) => (
                                    <SelectItem 
                                        key={vessel.id} 
                                        value={vessel.vesselId}
                                        data-testid={`option-vessel-${vessel.id}`}
                                    >
                                        {vessel.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                {!isShipUser && (
                    <>
                        <Button
                            variant="default"
                            onClick={() => applySummary()}
                            className={`h-8 text-[11px] ${isPhone ? 'w-full' : 'w-16'} bg-[#16569e] hover:bg-[#0d4a8f] text-white`}
                            data-testid="button-apply-summary"
                        >
                            Apply
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (vessels.length > 0) {
                                    setDraftSummaryVessel(vessels[0].vesselId);
                                    applySummary();
                                }
                            }}
                            className={`h-8 text-[#8798ad] text-[11px] border-[#e1e8ed] ${isPhone ? 'w-full' : 'w-16'}`}
                            data-testid="button-clear-filters"
                        >
                            Clear
                        </Button>
                    </>
                )}
            </div>
        );
    };

    const renderContent = () => {
        // Submodule-level access gate: when the parent module is permitted but
        // the selected submodule is not (including the case where NO submodule
        // is permitted, so allowedPages is empty), show the Access Restricted
        // screen instead of falling through to the default "annual" page.
        if (permissions.length > 0 && !allowedPages.includes(selectedDrugsAlcoholPage)) {
            return <NoAccessPage menuName="Drugs & Alcohol" />;
        }

        switch (selectedDrugsAlcoholPage) {
            case "annual":
                return (
                    <div className="flex flex-col h-full">
                        <SectionTitleComponents title="Annual D& A Test">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowFilters(!showFilters)}
                                className="h-8 gap-2 bg-white dark:bg-gray-800 text-[#0f172a] dark:text-white border-gray-300 dark:border-gray-600"
                                data-testid="button-toggle-filters"
                            >
                                <Filter className="h-4 w-4" />
                                Filters
                            </Button>
                        </SectionTitleComponents>
                        {renderFullFilterBar()}
                        <AnnualTestTable_v2
                            filterVesselNames={resolvedVesselNames}
                            onAdd={(permissions.length === 0 || canCreate("Annual")) ? (vesselId) => handleOpenForm('annual', vesselId) : undefined}
                            onEdit={(permissions.length === 0 || canEdit("Annual")) ? (recordId) => handleOpenForm('annual', undefined, String(recordId)) : undefined}
                        />
                    </div>
                );
            case "periodic":
                return (
                    <div className="flex flex-col h-full">
                        <SectionTitleComponents title="Periodic Alcohol Test">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowFilters(!showFilters)}
                                className="h-8 gap-2 bg-white dark:bg-gray-800 text-[#0f172a] dark:text-white border-gray-300 dark:border-gray-600"
                                data-testid="button-toggle-filters"
                            >
                                <Filter className="h-4 w-4" />
                                Filters
                            </Button>
                        </SectionTitleComponents>
                        {renderFullFilterBar()}
                        <PeriodicTestTable_v2
                            filterVesselNames={resolvedVesselNames}
                            onAdd={(permissions.length === 0 || canCreate("Periodic")) ? (vesselId) => handleOpenForm('periodic', vesselId) : undefined}
                            onEdit={(permissions.length === 0 || canEdit("Periodic")) ? (recordId) => handleOpenForm('periodic', undefined, String(recordId)) : undefined}
                        />
                    </div>
                );
            case "monthly":
                return (
                    <div className="flex flex-col h-full">
                        <SectionTitleComponents title="Monthly Alcohol test">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowFilters(!showFilters)}
                                className="h-8 gap-2 bg-white dark:bg-gray-800 text-[#0f172a] dark:text-white border-gray-300 dark:border-gray-600"
                                data-testid="button-toggle-filters"
                            >
                                <Filter className="h-4 w-4" />
                                Filters
                            </Button>
                        </SectionTitleComponents>
                        {renderFullFilterBar()}
                        <MonthlyTestTable_v2
                            filterVesselNames={resolvedVesselNames}
                            onAdd={(permissions.length === 0 || canCreate("Monthly")) ? (vesselId) => handleOpenForm('monthly', vesselId) : undefined}
                            onEdit={(permissions.length === 0 || canEdit("Monthly")) ? (recordId) => handleOpenForm('monthly', undefined, String(recordId)) : undefined}
                        />
                    </div>
                );
            case "post-incident":
                return (
                    <div className="flex flex-col h-full">
                        <SectionTitleComponents title="Post Incident Test">
                            <div className="flex gap-2 items-center">
                                {(permissions.length === 0 || canCreate("Post Incident")) && (
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleOpenForm('post-incident')}
                                    className="h-8 gap-2"
                                    data-testid="button-add-new-post-incident"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add New
                                </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowFilters(!showFilters)}
                                    className="h-8 gap-2 bg-white dark:bg-gray-800 text-[#0f172a] dark:text-white border-gray-300 dark:border-gray-600"
                                    data-testid="button-toggle-filters"
                                >
                                    <Filter className="h-4 w-4" />
                                    Filters
                                </Button>
                            </div>
                        </SectionTitleComponents>
                        {renderFullFilterBar()}
                        <PostIncidentTestTable_v2
                            filterVesselNames={resolvedVesselNames}
                            onEdit={(permissions.length === 0 || canEdit("Post Incident")) ? (recordId) => handleOpenForm('post-incident', undefined, String(recordId)) : undefined}
                        />
                    </div>
                );
            case "others":
                return (
                    <div className="flex flex-col h-full">
                        <SectionTitleComponents title="Other Tests">
                            <div className="flex gap-2 items-center">
                                {(permissions.length === 0 || canCreate("Others")) && (
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleOpenForm('others')}
                                    className="h-8 gap-2"
                                    data-testid="button-add-new-others"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add New
                                </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowFilters(!showFilters)}
                                    className="h-8 gap-2 bg-white dark:bg-gray-800 text-[#0f172a] dark:text-white border-gray-300 dark:border-gray-600"
                                    data-testid="button-toggle-filters"
                                >
                                    <Filter className="h-4 w-4" />
                                    Filters
                                </Button>
                            </div>
                        </SectionTitleComponents>
                        {renderFullFilterBar()}
                        <OtherTestsTable_v2
                            filterVesselNames={resolvedVesselNames}
                            onEdit={(permissions.length === 0 || canEdit("Others")) ? (recordId) => handleOpenForm('others', undefined, String(recordId)) : undefined}
                        />
                    </div>
                );
            case "summary":
                return (
                    <div className="flex flex-col h-full">
                        <SectionTitleComponents title="Summary">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowFilters(!showFilters)}
                                className="h-8 gap-2 bg-white dark:bg-gray-800 text-[#0f172a] dark:text-white border-gray-300 dark:border-gray-600"
                                data-testid="button-toggle-filters"
                            >
                                <Filter className="h-4 w-4" />
                                Filters
                            </Button>
                        </SectionTitleComponents>
                        {renderVesselOnlyFilterBar()}
                        {summaryVessel && (
                            <SummaryTable_v2 
                                selectedVessel={summaryVessel}
                                onAdd={(permissions.length === 0 || canCreate("Summary")) ? (testType) => handleOpenForm(testType, summaryVessel) : undefined}
                                onEdit={(permissions.length === 0 || canEdit("Summary")) ? (testType, recordId) => handleOpenForm(testType, summaryVessel, String(recordId)) : undefined}
                            />
                        )}
                    </div>
                );
            case "history":
                return (
                    <div className="flex flex-col h-full">
                        <HistoryTable_v2 onOpenRecord={handleOpenForm} />
                    </div>
                );
            default:
                return (
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-2xl font-semibold mb-4" style={{ color: '#16569e' }}>
                            Drugs & Alcohol Testing
                        </h2>
                        <p className="text-gray-600">
                            Select a test type from the left sidebar.
                        </p>
                    </div>
                );
        }
    };

    return (
        <div data-testid="drugs-alcohol-v2-container">
            <DrugsAlcoholSideBar
                selectedDrugsAlcoholPage={selectedDrugsAlcoholPage}
                setSelectedDrugsAlcoholPage={setSelectedDrugsAlcoholPage}
                allowedPages={allowedPages}
            />
            <MainLayout hasSidebar={true}>
                {renderContent()}
            </MainLayout>
            
            {showForm && (
                <DrugAlcoholTestForm_v2
                    testType={formTestType}
                    vesselId={formVesselId}
                    recordUuid={editingRecordUuid}
                    onClose={handleCloseForm}
                    onSave={handleSaveForm}
                    onSubmit={handleSubmitForm}
                    onDelete={handleDeleteForm}
                />
            )}
        </div>
    );
}
