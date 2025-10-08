import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, ChevronUp, ChevronDown, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useCompanyRanks } from "@/hooks/useCompanyRanks";
import type { PromotionHierarchy as PromotionHierarchyDB } from "@shared/schema";

// Frontend type with parsed rankPath
interface PromotionHierarchy extends Omit<PromotionHierarchyDB, 'rankPath'> {
  rankPath: string[];
}

interface PromotionHierarchyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PromotionHierarchyDialog({ open, onOpenChange }: PromotionHierarchyDialogProps) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [groupName, setGroupName] = useState("");
  const [selectedRanks, setSelectedRanks] = useState<string[]>([]);
  const [rankToAdd, setRankToAdd] = useState("");

  // Fetch company ranks (only applicable to company)
  const { data: companyRanks = [], isLoading: ranksLoading } = useCompanyRanks();

  // Fetch promotion hierarchies
  const { data: hierarchies = [], isLoading: hierarchiesLoading } = useQuery<PromotionHierarchy[]>({
    queryKey: ['/api/promotion-hierarchies'],
    enabled: open,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: { groupName: string; rankPath: string[] }) => {
      return await apiRequest('POST', '/api/promotion-hierarchies', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/promotion-hierarchies'] });
      toast({
        title: "Success",
        description: "Promotion hierarchy created successfully",
      });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create promotion hierarchy",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { groupName: string; rankPath: string[] } }) => {
      return await apiRequest('PATCH', `/api/promotion-hierarchies/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/promotion-hierarchies'] });
      toast({
        title: "Success",
        description: "Promotion hierarchy updated successfully",
      });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update promotion hierarchy",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/promotion-hierarchies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/promotion-hierarchies'] });
      toast({
        title: "Success",
        description: "Promotion hierarchy deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete promotion hierarchy",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setEditingId(null);
    setGroupName("");
    setSelectedRanks([]);
    setRankToAdd("");
  };

  const handleEdit = (hierarchy: PromotionHierarchy) => {
    setEditingId(hierarchy.id);
    setGroupName(hierarchy.groupName);
    setSelectedRanks(hierarchy.rankPath);
  };

  const handleSave = () => {
    if (!groupName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a group name",
        variant: "destructive",
      });
      return;
    }

    if (selectedRanks.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one rank to the promotion path",
        variant: "destructive",
      });
      return;
    }

    const data = { groupName, rankPath: selectedRanks };

    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleAddRank = () => {
    if (!rankToAdd || selectedRanks.includes(rankToAdd)) {
      return;
    }
    setSelectedRanks([...selectedRanks, rankToAdd]);
    setRankToAdd("");
  };

  const handleRemoveRank = (rank: string) => {
    setSelectedRanks(selectedRanks.filter(r => r !== rank));
  };

  const handleMoveRank = (index: number, direction: 'up' | 'down') => {
    const newRanks = [...selectedRanks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newRanks.length) return;
    
    [newRanks[index], newRanks[targetIndex]] = [newRanks[targetIndex], newRanks[index]];
    setSelectedRanks(newRanks);
  };

  // Available ranks that haven't been added yet
  const availableRanks = useMemo(() => {
    return companyRanks
      .filter(rank => !selectedRanks.includes(rank.rank))
      .map(rank => rank.rank);
  }, [companyRanks, selectedRanks]);

  const isLoading = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Promotion Hierarchy Configuration</DialogTitle>
          <DialogDescription>
            Configure promotion paths for different rank groups. Only ranks marked as "Applicable to Company" can be used.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Form Section */}
          <div className="border rounded-lg p-4 space-y-4 bg-gray-50">
            <h3 className="font-semibold text-sm">
              {editingId !== null ? "Edit Hierarchy Group" : "Create New Hierarchy Group"}
            </h3>
            
            <div className="space-y-2">
              <Label htmlFor="groupName">Group Name</Label>
              <Input
                id="groupName"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g., Deck Officers, Engine Officers, Ratings"
                data-testid="input-hierarchy-group-name"
              />
            </div>

            <div className="space-y-2">
              <Label>Promotion Path (in order from junior to senior)</Label>
              <div className="flex gap-2">
                <Select value={rankToAdd} onValueChange={setRankToAdd}>
                  <SelectTrigger className="flex-1" data-testid="select-rank-to-add">
                    <SelectValue placeholder="Select a rank to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRanks.map((rank) => (
                      <SelectItem key={rank} value={rank}>
                        {rank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleAddRank} 
                  disabled={!rankToAdd}
                  data-testid="button-add-rank"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Rank Path List */}
            {selectedRanks.length > 0 && (
              <div className="space-y-2">
                <Label>Current Path ({selectedRanks.length} ranks)</Label>
                <div className="border rounded-md bg-white divide-y max-h-48 overflow-y-auto">
                  {selectedRanks.map((rank, index) => (
                    <div
                      key={`${rank}-${index}`}
                      className="flex items-center justify-between p-2 hover:bg-gray-50"
                      data-testid={`rank-item-${index}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-6">{index + 1}.</span>
                        <span className="text-sm">{rank}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleMoveRank(index, 'up')}
                          disabled={index === 0}
                          data-testid={`button-move-up-${index}`}
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleMoveRank(index, 'down')}
                          disabled={index === selectedRanks.length - 1}
                          data-testid={`button-move-down-${index}`}
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveRank(rank)}
                          data-testid={`button-remove-${index}`}
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={isLoading}
                className="bg-[#16569e] hover:bg-[#0f4078]"
                data-testid="button-save-hierarchy"
              >
                {editingId !== null ? "Update" : "Create"} Hierarchy
              </Button>
              {editingId !== null && (
                <Button
                  onClick={resetForm}
                  variant="outline"
                  data-testid="button-cancel-edit"
                >
                  Cancel Edit
                </Button>
              )}
            </div>
          </div>

          {/* Existing Hierarchies List */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Existing Promotion Hierarchies</h3>
            {hierarchiesLoading ? (
              <p className="text-sm text-gray-500">Loading hierarchies...</p>
            ) : hierarchies.length === 0 ? (
              <p className="text-sm text-gray-500">No hierarchies configured yet.</p>
            ) : (
              <div className="space-y-2">
                {hierarchies.map((hierarchy) => (
                  <div
                    key={hierarchy.id}
                    className="border rounded-lg p-3 bg-white"
                    data-testid={`hierarchy-${hierarchy.id}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-sm">{hierarchy.groupName}</h4>
                        <p className="text-xs text-gray-500 mt-1">
                          {hierarchy.rankPath.length} ranks in path
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(hierarchy)}
                          data-testid={`button-edit-hierarchy-${hierarchy.id}`}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Delete "${hierarchy.groupName}" hierarchy?`)) {
                              deleteMutation.mutate(hierarchy.id);
                            }
                          }}
                          data-testid={`button-delete-hierarchy-${hierarchy.id}`}
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-600 flex-wrap">
                      {hierarchy.rankPath.map((rank, index) => (
                        <span key={`${rank}-${index}`} className="inline-flex items-center">
                          {rank}
                          {index < hierarchy.rankPath.length - 1 && (
                            <span className="mx-1">→</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
            data-testid="button-close-dialog"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
