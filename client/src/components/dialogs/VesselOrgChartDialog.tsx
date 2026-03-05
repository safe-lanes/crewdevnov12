import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronUp, ChevronDown, Plus, X, Edit2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface OrgChartNode {
  rank: string;
  rankId: string;
  parentRankId: string | null;
  sortOrder: number;
}

interface TreeNode extends OrgChartNode {
  children: TreeNode[];
}

interface CompanyRankInfo {
  rank: string;
  rankId: string;
}

interface VesselOrgChartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyRanks: CompanyRankInfo[];
  canEdit?: boolean;
}

function buildTree(nodes: OrgChartNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  nodes.forEach(node => {
    map.set(node.rankId, { ...node, children: [] });
  });

  nodes.forEach(node => {
    const treeNode = map.get(node.rankId)!;
    if (node.parentRankId && map.has(node.parentRankId)) {
      map.get(node.parentRankId)!.children.push(treeNode);
    } else {
      roots.push(treeNode);
    }
  });

  const sortChildren = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    nodes.forEach(n => sortChildren(n.children));
  };
  sortChildren(roots);

  return roots;
}

function flattenTree(roots: TreeNode[]): OrgChartNode[] {
  const result: OrgChartNode[] = [];
  const walk = (nodes: TreeNode[]) => {
    nodes.forEach((node, idx) => {
      result.push({
        rank: node.rank,
        rankId: node.rankId,
        parentRankId: node.parentRankId,
        sortOrder: idx,
      });
      walk(node.children);
    });
  };
  walk(roots);
  return result;
}

function getNodeColor(node: OrgChartNode, allNodes: OrgChartNode[]): string {
  if (!node.parentRankId) return "bg-gray-700 text-white";

  const findRoot = (rankId: string): string => {
    const n = allNodes.find(x => x.rankId === rankId);
    if (!n || !n.parentRankId) return rankId;
    return findRoot(n.parentRankId);
  };

  const root = findRoot(node.rankId);
  const rootNode = allNodes.find(x => x.rankId === root);
  if (!rootNode) return "bg-[#3b82f6] text-white";

  const rootChildren = allNodes.filter(x => x.parentRankId === root);
  const childIndex = rootChildren.findIndex(x => x.rankId === node.rankId);

  const isUnderBranch = (nodeRankId: string, branchRankId: string): boolean => {
    if (nodeRankId === branchRankId) return true;
    const n = allNodes.find(x => x.rankId === nodeRankId);
    if (!n || !n.parentRankId) return false;
    return isUnderBranch(n.parentRankId, branchRankId);
  };

  if (rootChildren.length >= 1) {
    for (let i = 0; i < rootChildren.length; i++) {
      if (isUnderBranch(node.rankId, rootChildren[i].rankId)) {
        const colors = [
          "bg-[#3b82f6] text-white",
          "bg-[#22c55e] text-white",
          "bg-[#06b6d4] text-white",
          "bg-[#f59e0b] text-white",
          "bg-[#8b5cf6] text-white",
        ];
        return colors[i % colors.length];
      }
    }
  }

  return "bg-[#3b82f6] text-white";
}

function OrgChartTreeView({ roots, allNodes }: { roots: TreeNode[]; allNodes: OrgChartNode[] }) {
  const renderNode = (node: TreeNode, isLast: boolean, depth: number) => {
    const colorClass = getNodeColor(node, allNodes);
    return (
      <div key={node.rankId} className="flex flex-col items-center" data-testid={`org-node-${node.rankId}`}>
        <div className={`px-4 py-2 rounded-md text-sm font-medium shadow-sm min-w-[120px] text-center ${colorClass}`}>
          {node.rank}
        </div>
        {node.children.length > 0 && (
          <>
            <div className="w-px h-4 bg-gray-300" />
            <div className="flex relative">
              {node.children.length > 1 && (
                <div
                  className="absolute top-0 bg-gray-300"
                  style={{
                    height: "1px",
                    left: "50%",
                    right: "50%",
                    transform: "none",
                  }}
                  ref={(el) => {
                    if (el && node.children.length > 1) {
                      const parent = el.parentElement;
                      if (parent) {
                        const children = Array.from(parent.children).filter(c => c !== el && c.classList.contains("flex-col"));
                        if (children.length >= 2) {
                          const first = children[0] as HTMLElement;
                          const last = children[children.length - 1] as HTMLElement;
                          const parentRect = parent.getBoundingClientRect();
                          const firstRect = first.getBoundingClientRect();
                          const lastRect = last.getBoundingClientRect();
                          const leftPos = firstRect.left + firstRect.width / 2 - parentRect.left;
                          const rightPos = parentRect.right - (lastRect.left + lastRect.width / 2);
                          el.style.left = `${leftPos}px`;
                          el.style.right = `${rightPos}px`;
                        }
                      }
                    }
                  }}
                />
              )}
              {node.children.map((child, idx) => (
                <div key={child.rankId} className="flex flex-col items-center mx-3">
                  <div className="w-px h-4 bg-gray-300" />
                  {renderNode(child, idx === node.children.length - 1, depth + 1)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  if (roots.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500 text-sm" data-testid="org-chart-empty">
        No org chart configured yet. Switch to Edit mode to build the hierarchy.
      </div>
    );
  }

  return (
    <div className="flex justify-center p-6 min-w-max">
      <div className="flex flex-col items-center gap-0">
        {roots.map((root, idx) => (
          <div key={root.rankId} className="mb-4">
            {renderNode(root, idx === roots.length - 1, 0)}
          </div>
        ))}
      </div>
    </div>
  );
}

function OrgChartEditView({
  nodes,
  setNodes,
  availableRanks,
}: {
  nodes: OrgChartNode[];
  setNodes: (nodes: OrgChartNode[]) => void;
  availableRanks: CompanyRankInfo[];
}) {
  const assignedRankIds = new Set(nodes.map(n => n.rankId));
  const unassignedRanks = availableRanks.filter(r => !assignedRankIds.has(r.rankId));

  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const [addingParent, setAddingParent] = useState<string | null>(null);

  const wouldCreateCycle = useCallback((rankId: string, newParentRankId: string | null): boolean => {
    if (!newParentRankId || newParentRankId === rankId) return newParentRankId === rankId;
    const parentMap = new Map(nodes.map(n => [n.rankId, n.parentRankId]));
    parentMap.set(rankId, newParentRankId);
    let current: string | null = newParentRankId;
    const visited = new Set<string>();
    while (current) {
      if (visited.has(current)) return true;
      visited.add(current);
      current = parentMap.get(current) ?? null;
    }
    return false;
  }, [nodes]);

  const handleChangeParent = useCallback((rankId: string, newParentRankId: string | null) => {
    if (wouldCreateCycle(rankId, newParentRankId)) return;
    setNodes(nodes.map(n =>
      n.rankId === rankId ? { ...n, parentRankId: newParentRankId } : n
    ));
  }, [nodes, setNodes, wouldCreateCycle]);

  const handleMoveSibling = useCallback((rankId: string, direction: "up" | "down") => {
    const node = nodes.find(n => n.rankId === rankId);
    if (!node) return;

    const siblings = nodes
      .filter(n => n.parentRankId === node.parentRankId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = siblings.findIndex(s => s.rankId === rankId);
    if ((direction === "up" && idx <= 0) || (direction === "down" && idx >= siblings.length - 1)) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const swapNode = siblings[swapIdx];

    setNodes(nodes.map(n => {
      if (n.rankId === rankId) return { ...n, sortOrder: swapNode.sortOrder };
      if (n.rankId === swapNode.rankId) return { ...n, sortOrder: node.sortOrder };
      return n;
    }));
  }, [nodes, setNodes]);

  const handleAddRank = useCallback((rankInfo: CompanyRankInfo, parentRankId: string | null) => {
    const maxSort = Math.max(0, ...nodes.filter(n => n.parentRankId === parentRankId).map(n => n.sortOrder));
    setNodes([...nodes, {
      rank: rankInfo.rank,
      rankId: rankInfo.rankId,
      parentRankId: parentRankId,
      sortOrder: maxSort + 1,
    }]);
    setAddingParent(null);
  }, [nodes, setNodes]);

  const handleRemoveRank = useCallback((rankId: string) => {
    const node = nodes.find(n => n.rankId === rankId);
    if (!node) return;
    setNodes(
      nodes
        .filter(n => n.rankId !== rankId)
        .map(n => n.parentRankId === rankId ? { ...n, parentRankId: node.parentRankId } : n)
    );
  }, [nodes, setNodes]);

  const renderEditNode = (node: TreeNode, depth: number) => {
    const siblings = nodes
      .filter(n => n.parentRankId === node.parentRankId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const sibIdx = siblings.findIndex(s => s.rankId === node.rankId);
    const canMoveUp = sibIdx > 0;
    const canMoveDown = sibIdx < siblings.length - 1;
    const colorClass = getNodeColor(node, nodes);

    return (
      <div key={node.rankId} className="mb-2" data-testid={`org-edit-node-${node.rankId}`}>
        <div className="flex items-center gap-2 py-1" style={{ paddingLeft: `${depth * 32}px` }}>
          <div className="flex flex-col">
            <button
              onClick={() => handleMoveSibling(node.rankId, "up")}
              disabled={!canMoveUp}
              className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"
              data-testid={`button-move-up-${node.rankId}`}
            >
              <ChevronUp className="h-3 w-3" />
            </button>
            <button
              onClick={() => handleMoveSibling(node.rankId, "down")}
              disabled={!canMoveDown}
              className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"
              data-testid={`button-move-down-${node.rankId}`}
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
          <div className={`px-3 py-1.5 rounded text-sm font-medium min-w-[120px] ${colorClass}`}>
            {node.rank}
          </div>
          <Select
            value={node.parentRankId || "__root__"}
            onValueChange={(val) => handleChangeParent(node.rankId, val === "__root__" ? null : val)}
          >
            <SelectTrigger className="w-[160px] h-7 text-xs" data-testid={`select-parent-${node.rankId}`}>
              <SelectValue placeholder="Parent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__root__">Root (No Parent)</SelectItem>
              {nodes.filter(n => n.rankId !== node.rankId && !wouldCreateCycle(node.rankId, n.rankId)).map(n => (
                <SelectItem key={n.rankId} value={n.rankId}>{n.rank}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={() => handleRemoveRank(node.rankId)}
            className="p-1 hover:bg-red-50 rounded text-red-500"
            data-testid={`button-remove-${node.rankId}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {node.children.map(child => renderEditNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-0">
        {tree.map(root => renderEditNode(root, 0))}
      </div>

      {unassignedRanks.length > 0 && (
        <div className="border-t pt-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-600">Unassigned Ranks ({unassignedRanks.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {unassignedRanks.map(r => (
              <div key={r.rankId} className="flex items-center gap-1 bg-gray-100 rounded px-2 py-1 text-xs" data-testid={`unassigned-rank-${r.rankId}`}>
                <span>{r.rank}</span>
                <button
                  onClick={() => handleAddRank(r, null)}
                  className="p-0.5 hover:bg-gray-200 rounded text-[#16569e]"
                  title="Add as root"
                  data-testid={`button-add-root-${r.rankId}`}
                >
                  <Plus className="h-3 w-3" />
                </button>
                {nodes.length > 0 && (
                  <Select
                    value=""
                    onValueChange={(parentId) => handleAddRank(r, parentId)}
                  >
                    <SelectTrigger className="w-[130px] h-6 text-xs border-dashed" data-testid={`select-add-under-${r.rankId}`}>
                      <SelectValue placeholder="Add under..." />
                    </SelectTrigger>
                    <SelectContent>
                      {nodes.map(n => (
                        <SelectItem key={n.rankId} value={n.rankId}>{n.rank}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function VesselOrgChartDialog({ open, onOpenChange, companyRanks, canEdit = true }: VesselOrgChartDialogProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editNodes, setEditNodes] = useState<OrgChartNode[]>([]);

  const { data: orgChartData = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/v2/admin/vessel-org-chart"],
    enabled: open,
  });

  const currentNodes: OrgChartNode[] = useMemo(() => {
    return orgChartData.map((item: any) => ({
      rank: item.rank,
      rankId: item.rankId,
      parentRankId: item.parentRankId,
      sortOrder: item.sortOrder,
    }));
  }, [orgChartData]);

  const tree = useMemo(() => buildTree(isEditing ? editNodes : currentNodes), [isEditing, editNodes, currentNodes]);

  const saveMutation = useMutation({
    mutationFn: async (entries: OrgChartNode[]) => {
      return await apiRequest("POST", "/api/v2/admin/vessel-org-chart", entries);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/vessel-org-chart"] });
      toast({ title: "Success", description: "Vessel org chart saved successfully" });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to save vessel org chart",
        variant: "destructive",
      });
    },
  });

  const handleEdit = () => {
    setEditNodes([...currentNodes]);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditNodes([]);
    setIsEditing(false);
  };

  const handleSave = () => {
    const normalized = flattenTree(buildTree(editNodes));
    saveMutation.mutate(normalized);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (isEditing && !val) {
        handleCancel();
      }
      onOpenChange(val);
    }}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-hidden flex flex-col" data-testid="vessel-org-chart-dialog">
        <DialogHeader className="flex flex-row items-center justify-between pr-8">
          <DialogTitle className="text-lg font-semibold">Vessel Org Chart</DialogTitle>
          <div className="flex gap-2">
            {!isEditing && canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleEdit}
                className="h-7 text-xs border-[#e1e8ed] text-[#16569e]"
                data-testid="button-edit-org-chart"
              >
                <Edit2 className="h-3.5 w-3.5 mr-1" />
                Edit
              </Button>
            )}
            {isEditing && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  className="h-7 text-xs"
                  data-testid="button-cancel-org-chart"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="h-7 text-xs bg-[#16569e] hover:bg-[#0f4078] text-white"
                  data-testid="button-save-org-chart"
                >
                  <Save className="h-3.5 w-3.5 mr-1" />
                  {saveMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
              Loading org chart...
            </div>
          ) : isEditing ? (
            <div className="p-4">
              <OrgChartEditView
                nodes={editNodes}
                setNodes={setEditNodes}
                availableRanks={companyRanks}
              />
            </div>
          ) : (
            <OrgChartTreeView roots={tree} allNodes={currentNodes} />
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
