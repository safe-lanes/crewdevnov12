import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown } from 'lucide-react';

interface NewPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CrewMember {
  id: string;
  name: string;
  rank: string;
  experience: {
    company: number;
    rank: number;
    tankers: number;
    oow: number;
    endorsements: string;
  };
}

// Crew Column Component - displays available crew for a specific rank
function CrewColumn({ rank }: { rank: string }) {
  const { data: crewMembers = [], isLoading } = useQuery<CrewMember[]>({
    queryKey: [`/api/crew-members/by-rank/${rank}`],
  });

  if (isLoading) {
    return (
      <div className="w-64">
        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-t font-semibold flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-gray-400 rounded" />
          <span>{rank}</span>
        </div>
        <div className="p-4 text-center text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-64 flex-shrink-0">
      <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-t font-semibold flex items-center gap-2">
        <Checkbox data-testid={`checkbox-select-all-${rank}`} />
        <span>{rank}</span>
      </div>
      <div className="border-t">
        {crewMembers.map((crew) => (
          <div
            key={crew.id}
            className="p-3 border-b hover:bg-gray-50 dark:hover:bg-gray-800 flex items-start gap-2"
          >
            <Checkbox data-testid={`checkbox-crew-${crew.id}`} />
            <div className="flex-1">
              <div className="font-medium text-sm">{crew.name.split(' ')[0]} {crew.name.split(' ').slice(-1)[0].charAt(0)}</div>
              <div className="text-xs text-gray-500 mt-1">
                {crew.experience.company} / {crew.experience.rank} / {crew.experience.tankers} / {crew.experience.oow} / {crew.experience.endorsements}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NewPlanDialog({ open, onOpenChange }: NewPlanDialogProps) {
  const [selectedVessels, setSelectedVessels] = useState<string[]>([]);
  const [selectedRanks, setSelectedRanks] = useState<string[]>([]);

  // Fetch vessels from master data
  const { data: vessels = [], isLoading: vesselsLoading } = useQuery<any[]>({
    queryKey: ['/api/masters/014/data'],
  });

  // Fetch company ranks
  const { data: companyRanks = [], isLoading: ranksLoading } = useQuery<any[]>({
    queryKey: ['/api/company-ranks'],
  });

  const toggleVessel = (vesselName: string) => {
    setSelectedVessels(prev =>
      prev.includes(vesselName)
        ? prev.filter(v => v !== vesselName)
        : [...prev, vesselName]
    );
  };

  const toggleRank = (rank: string) => {
    setSelectedRanks(prev =>
      prev.includes(rank)
        ? prev.filter(r => r !== rank)
        : [...prev, rank]
    );
  };

  const handleBack = () => {
    onOpenChange(false);
  };

  const handleSave = () => {
    // TODO: Implement save as draft
    console.log('Save as draft');
  };

  const handlePropose = () => {
    // TODO: Implement propose (pending approval)
    console.log('Propose for approval');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">New Rotation Plan</DialogTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleBack}
                className="border-gray-300"
                data-testid="button-back"
              >
                &lt; Back
              </Button>
              <Button
                onClick={handleSave}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-save"
              >
                Save
              </Button>
              <Button
                onClick={handlePropose}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-propose"
              >
                Propose
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Filter dropdowns */}
        <div className="px-6 pb-4 flex gap-4">
          {/* Vessels multi-select */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-48 justify-between"
                disabled={vesselsLoading}
                data-testid="select-vessels"
              >
                <span className="truncate">
                  {selectedVessels.length > 0
                    ? `${selectedVessels.length} vessel${selectedVessels.length > 1 ? 's' : ''} selected`
                    : vesselsLoading ? "Loading..." : "Vessels"
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
                      checked={selectedVessels.includes(vessel.name)}
                      onCheckedChange={() => toggleVessel(vessel.name)}
                      data-testid={`checkbox-vessel-${vessel.id}`}
                    />
                    <label
                      className="text-sm cursor-pointer flex-1"
                      onClick={() => toggleVessel(vessel.name)}
                    >
                      {vessel.name}
                    </label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Ranks multi-select */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-48 justify-between"
                disabled={ranksLoading}
                data-testid="select-ranks"
              >
                <span className="truncate">
                  {selectedRanks.length > 0
                    ? `${selectedRanks.length} rank${selectedRanks.length > 1 ? 's' : ''} selected`
                    : ranksLoading ? "Loading..." : "Ranks"
                  }
                </span>
                <ChevronDown className="h-4 w-4 opacity-50 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-2" align="start">
              <div className="max-h-60 overflow-y-auto">
                {companyRanks.map((rank: any) => (
                  <div
                    key={rank.id}
                    className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                  >
                    <Checkbox
                      checked={selectedRanks.includes(rank.rank)}
                      onCheckedChange={() => toggleRank(rank.rank)}
                      data-testid={`checkbox-rank-${rank.id}`}
                    />
                    <label
                      className="text-sm cursor-pointer flex-1"
                      onClick={() => toggleRank(rank.rank)}
                    >
                      {rank.rank}
                    </label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Main content area - split into left (crew) and right (vessels/timeline) sections */}
        <div className="flex-1 px-6 pb-6 overflow-hidden flex gap-4">
          {/* Left Section - Available Crew */}
          <div className="w-1/3 border rounded-lg bg-white dark:bg-gray-900 overflow-auto">
            {selectedRanks.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>Select ranks to view available crew</p>
              </div>
            ) : (
              <div className="flex gap-4 p-4" style={{ minWidth: `${selectedRanks.length * 280}px` }}>
                {selectedRanks.map(rank => (
                  <CrewColumn key={rank} rank={rank} />
                ))}
              </div>
            )}
          </div>

          {/* Right Section - Vessel Timeline */}
          <div className="flex-1 border rounded-lg bg-white dark:bg-gray-900 overflow-auto">
            {selectedVessels.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>Select vessels to begin planning</p>
              </div>
            ) : (
              <div className="p-4 text-gray-500">
                <p>Vessel timeline will appear here</p>
                <p className="text-sm mt-2">Selected vessels: {selectedVessels.join(', ')}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
