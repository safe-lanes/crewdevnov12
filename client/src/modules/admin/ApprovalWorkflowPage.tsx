import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Search,
  Pencil,
  Maximize2,
  Minimize2,
  Network,
  UserPlus,
  Clock,
  RefreshCw,
  TrendingUp,
  ClipboardList,
  FlaskConical,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface Tier3Node {
  id: string;
  label: string;
}

interface Tier2Node {
  id: string;
  label: string;
  children: Tier3Node[];
}

interface Tier1Node {
  id: string;
  label: string;
  icon: LucideIcon;
  children: Tier2Node[];
}

const APPROVAL_TREE: Tier1Node[] = [
  {
    id: "recruitment",
    label: "Recruitment",
    icon: UserPlus,
    children: [
      {
        id: "recruitment-company-processing",
        label: "Company Processing",
        children: [
          { id: "rec-cp-interviews", label: "Interviews" },
          { id: "rec-cp-final", label: "Final recruitment" },
        ],
      },
      {
        id: "recruitment-screening",
        label: "Screening",
        children: [
          { id: "rec-scr-shortlist", label: "Shortlist Approval" },
          { id: "rec-scr-document", label: "Document Verification" },
          { id: "rec-scr-medical", label: "Medical Clearance" },
        ],
      },
      {
        id: "recruitment-onboarding",
        label: "Onboarding",
        children: [
          { id: "rec-onb-offer", label: "Offer Approval" },
          { id: "rec-onb-contract", label: "Contract Sign-off" },
          { id: "rec-onb-joining", label: "Joining Approval" },
          { id: "rec-onb-induction", label: "Induction Sign-off" },
        ],
      },
    ],
  },
  {
    id: "rotation",
    label: "Rotation",
    icon: RefreshCw,
    children: [
      {
        id: "rotation-approval",
        label: "Rotation Approval",
        children: [
          { id: "rot-app-settings", label: "Approval Settings" },
          { id: "rot-app-plan", label: "Rotation Plan Approval" },
        ],
      },
    ],
  },
  {
    id: "promotion",
    label: "Promotion",
    icon: TrendingUp,
    children: [
      {
        id: "promotion-approval",
        label: "Promotion Approval",
        children: [
          { id: "promo-app-recommendation", label: "Recommendation Review" },
          { id: "promo-app-final", label: "Final Promotion Approval" },
        ],
      },
    ],
  },
  {
    id: "appraisals",
    label: "Appraisals",
    icon: ClipboardList,
    children: [
      {
        id: "appraisals-approval",
        label: "Appraisal Approval",
        children: [
          { id: "appr-app-draft", label: "Draft Review" },
          { id: "appr-app-final", label: "Final Appraisal Sign-off" },
        ],
      },
    ],
  },
  {
    id: "drug-alcohol",
    label: "Drug & Alcohol",
    icon: FlaskConical,
    children: [
      {
        id: "drug-alcohol-approval",
        label: "D&A Approval",
        children: [{ id: "da-app-test-result", label: "Test Result Approval" }],
      },
    ],
  },
  {
    id: "rest-hours",
    label: "Rest Hours",
    icon: Clock,
    children: [
      {
        id: "rest-hours-approval",
        label: "Rest Hours Approval",
        children: [
          { id: "rh-app-violation", label: "Violation Review" },
          { id: "rh-app-monthly", label: "Monthly Sign-off" },
        ],
      },
    ],
  },
  {
    id: "training",
    label: "Training",
    icon: GraduationCap,
    children: [
      {
        id: "training-approval",
        label: "Training Approval",
        children: [{ id: "trn-app-nomination", label: "Nomination Approval" }],
      },
    ],
  },
];

function countTier3(node: Tier1Node): number {
  return node.children.reduce((sum, t2) => sum + t2.children.length, 0);
}

function findTier3Label(id: string): string | null {
  for (const t1 of APPROVAL_TREE) {
    for (const t2 of t1.children) {
      const t3 = t2.children.find((n) => n.id === id);
      if (t3) return t3.label;
    }
  }
  return null;
}

function getAllTier1And2Ids(): Set<string> {
  const ids = new Set<string>();
  APPROVAL_TREE.forEach((t1) => {
    ids.add(t1.id);
    t1.children.forEach((t2) => ids.add(t2.id));
  });
  return ids;
}

function matchesSearch(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

interface FilterResult {
  visibleIds: Set<string>;
  forcedExpandedIds: Set<string>;
}

function computeFilter(query: string): FilterResult | null {
  const q = query.trim();
  if (!q) return null;
  const visible = new Set<string>();
  const expanded = new Set<string>();
  APPROVAL_TREE.forEach((t1) => {
    let t1Match = matchesSearch(t1.label, q);
    let anyChildMatch = false;
    t1.children.forEach((t2) => {
      let t2Match = matchesSearch(t2.label, q);
      let anyT3Match = false;
      t2.children.forEach((t3) => {
        if (matchesSearch(t3.label, q)) {
          visible.add(t3.id);
          anyT3Match = true;
        }
      });
      if (t2Match || anyT3Match) {
        visible.add(t2.id);
        expanded.add(t2.id);
        anyChildMatch = true;
        if (t2Match) {
          // If the sub-module label itself matches, show all its leaves
          t2.children.forEach((t3) => visible.add(t3.id));
        }
      }
    });
    if (t1Match || anyChildMatch) {
      visible.add(t1.id);
      expanded.add(t1.id);
      if (t1Match && !anyChildMatch) {
        // Show and expand all sub-tree if only t1 matches so leaves render
        t1.children.forEach((t2) => {
          visible.add(t2.id);
          expanded.add(t2.id);
          t2.children.forEach((t3) => visible.add(t3.id));
        });
      }
    }
  });
  return { visibleIds: visible, forcedExpandedIds: expanded };
}

export default function ApprovalWorkflowPage(): JSX.Element {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedTier3Id, setSelectedTier3Id] = useState<string | null>(null);

  const filter = useMemo(() => computeFilter(searchQuery), [searchQuery]);

  const isExpanded = (id: string): boolean => {
    if (filter) return filter.forcedExpandedIds.has(id);
    return expandedIds.has(id);
  };

  const isVisible = (id: string): boolean => {
    if (!filter) return true;
    return filter.visibleIds.has(id);
  };

  const toggleExpand = (id: string) => {
    if (filter) return; // expand state is forced by filter
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => {
    setExpandedIds(getAllTier1And2Ids());
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  const selectedLabel = selectedTier3Id ? findTier3Label(selectedTier3Id) : null;

  return (
    <div data-testid="page-approval-workflow">
      {/* Page title */}
      <div className="mb-4">
        <h1
          className="font-bold text-black text-2xl"
          data-testid="text-approval-workflow-title"
        >
          Approval Workflow
        </h1>
      </div>

      {/* Search bar */}
      <div className="mb-3">
        <div className="relative max-w-full">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="pl-9 h-10 bg-white"
            data-testid="input-approval-workflow-search"
          />
        </div>
      </div>

      {/* Two-column area */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 items-start">
        {/* LEFT: Tree panel */}
        <div
          className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden"
          data-testid="panel-approval-workflow-tree"
        >
          {/* Header strip */}
          <div className="bg-[#52baf3] text-white px-3 py-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide">
            <span>Approval Workflow</span>
            <div className="flex items-center gap-3 normal-case font-normal">
              <button
                type="button"
                className="flex items-center gap-1 hover:underline"
                data-testid="button-approval-workflow-edit"
              >
                <Pencil size={12} />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={handleExpandAll}
                className="flex items-center gap-1 hover:underline"
                data-testid="button-approval-workflow-expand"
              >
                <Maximize2 size={12} />
                <span>Expand</span>
              </button>
              <button
                type="button"
                onClick={handleCollapseAll}
                className="flex items-center gap-1 hover:underline"
                data-testid="button-approval-workflow-collapse"
              >
                <Minimize2 size={12} />
                <span>Collapse</span>
              </button>
            </div>
          </div>

          {/* Tree body */}
          <div className="py-1 max-h-[60vh] overflow-y-auto">
            {APPROVAL_TREE.map((t1) => {
              if (!isVisible(t1.id)) return null;
              const t1Expanded = isExpanded(t1.id);
              const Icon = t1.icon;
              const totalT3 = countTier3(t1);
              return (
                <div key={t1.id}>
                  <div
                    onClick={() => toggleExpand(t1.id)}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-blue-50/40 transition-colors"
                    data-testid={`tree-tier1-${t1.id}`}
                  >
                    {t1Expanded ? (
                      <ChevronDown size={16} className="text-gray-500 flex-shrink-0" />
                    ) : (
                      <ChevronRight size={16} className="text-gray-500 flex-shrink-0" />
                    )}
                    <Icon size={16} className="text-[#52baf3] flex-shrink-0" />
                    <span className="text-sm font-semibold text-gray-800 flex-1 truncate">
                      {t1.label}
                    </span>
                    <span
                      className="text-xs text-gray-500 ml-2"
                      data-testid={`tree-tier1-count-${t1.id}`}
                    >
                      {totalT3}
                    </span>
                  </div>

                  {t1Expanded &&
                    t1.children.map((t2) => {
                      if (!isVisible(t2.id)) return null;
                      const t2Expanded = isExpanded(t2.id);
                      return (
                        <div key={t2.id}>
                          <div
                            onClick={() => toggleExpand(t2.id)}
                            className="flex items-center gap-2 pl-8 pr-3 py-2 cursor-pointer hover:bg-blue-50/40 transition-colors"
                            data-testid={`tree-tier2-${t2.id}`}
                          >
                            {t2Expanded ? (
                              <ChevronDown
                                size={14}
                                className="text-gray-500 flex-shrink-0"
                              />
                            ) : (
                              <ChevronRight
                                size={14}
                                className="text-gray-500 flex-shrink-0"
                              />
                            )}
                            <ClipboardList
                              size={14}
                              className="text-[#52baf3] flex-shrink-0"
                            />
                            <span className="text-sm font-medium text-gray-700 flex-1 truncate">
                              {t2.label}
                            </span>
                            <span className="text-xs text-gray-500 ml-2">
                              {t2.children.length}
                            </span>
                          </div>

                          {t2Expanded &&
                            t2.children.map((t3) => {
                              if (!isVisible(t3.id)) return null;
                              const isSelected = selectedTier3Id === t3.id;
                              return (
                                <div
                                  key={t3.id}
                                  onClick={() => setSelectedTier3Id(t3.id)}
                                  className={`flex items-center gap-2 pl-14 pr-3 py-2 cursor-pointer transition-colors ${
                                    isSelected
                                      ? "bg-[#eaf4fb] border-l-2 border-[#52baf3]"
                                      : "hover:bg-blue-50/40"
                                  }`}
                                  data-testid={`tree-tier3-${t3.id}`}
                                >
                                  <Network
                                    size={12}
                                    className={`flex-shrink-0 ${
                                      isSelected ? "text-[#16569e]" : "text-gray-400"
                                    }`}
                                  />
                                  <span
                                    className={`text-sm flex-1 truncate ${
                                      isSelected
                                        ? "text-[#16569e] font-medium"
                                        : "text-gray-700"
                                    }`}
                                  >
                                    {t3.label}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      );
                    })}
                </div>
              );
            })}
            {filter && filter.visibleIds.size === 0 && (
              <div
                className="px-4 py-8 text-center text-sm text-gray-500"
                data-testid="text-approval-workflow-no-results"
              >
                No approval functions match your search.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Detail / empty-state panel */}
        <div
          className="bg-white border border-gray-200 rounded shadow-sm min-h-[60vh] flex items-center justify-center p-6"
          data-testid="panel-approval-workflow-detail"
        >
          {!selectedLabel ? (
            <div
              className="flex flex-col items-center text-center"
              data-testid="empty-approval-workflow"
            >
              <div className="w-14 h-14 rounded-full bg-[#eaf4fb] flex items-center justify-center mb-4">
                <Network size={28} className="text-[#52baf3]" />
              </div>
              <div className="text-base font-semibold text-gray-800">
                Select an Approval Function
              </div>
              <div className="text-sm text-gray-500 mt-1 max-w-xs">
                Select an approval function from the tree on the left.
              </div>
            </div>
          ) : (
            <div
              className="flex flex-col items-center text-center"
              data-testid="detail-approval-workflow-selected"
            >
              <div className="w-14 h-14 rounded-full bg-[#eaf4fb] flex items-center justify-center mb-4">
                <Network size={28} className="text-[#52baf3]" />
              </div>
              <div
                className="text-lg font-semibold text-gray-800"
                data-testid="text-approval-workflow-selected-label"
              >
                Approval Settings — {selectedLabel}
              </div>
              <div className="text-sm text-gray-500 mt-1 max-w-md">
                Configuration UI will be added later.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
