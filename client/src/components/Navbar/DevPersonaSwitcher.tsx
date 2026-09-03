import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronRight, UserCog } from "lucide-react";
import {
  DEV_BYPASS,
  applyDevPersona,
  getActiveDevPersona,
  getDevPersonaMasterUserId,
  getLastVesselId,
  type DevVessel,
} from "@/lib/devPersona";

interface RoleRecord {
  ruid: string;
  assignedRole: string;
  roletype: string;
  isActive: boolean;
  isDeleted: boolean;
}

interface VesselRecord {
  vesselUuid: string;
  vessel: string;
  imoNumber: string | null;
}

type PersonaGroup = "office" | "vessel";

// Persona definitions. `roleName` must match `assignedRole` in the
// access-control roles master — ruids are resolved at runtime, never
// hardcoded, and never substituted: if the role name is not found, the
// persona is disabled with a warning (fail-loud).
const PERSONAS: Array<{
  key: string;
  label: string;
  roleName: string;
  ship: boolean;
  group?: PersonaGroup;
}> = [
  { key: "sail-admin", label: "Sail Admin", roleName: "Sail Admin", ship: false },
  { key: "admin", label: "Admin", roleName: "Admin", ship: false },
  { key: "user", label: "User", roleName: "User", ship: false },
  { key: "crewing-executive", label: "Crewing Executive", roleName: "Crewing Executive", ship: false, group: "office" },
  { key: "crewing-manager", label: "Crewing Manager", roleName: "Crewing Manager", ship: false, group: "office" },
  { key: "dpa", label: "DPA", roleName: "DPA", ship: false, group: "office" },
  { key: "marine-superintendent", label: "Marine Superintendent", roleName: "Marine Superintendent", ship: false, group: "office" },
  { key: "technical-superintendent", label: "Technical Superintendent", roleName: "Technical Superintendent", ship: false, group: "office" },
  { key: "vessel-admin", label: "Vessel Admin", roleName: "Vessel Admin", ship: true, group: "vessel" },
  { key: "vessel-user", label: "Vessel User", roleName: "Vessel User", ship: true, group: "vessel" },
];

export default function DevPersonaSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const active = getActiveDevPersona();
  const activeKey = active?.personaKey ?? "sail-admin";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
        setExpandedKey(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: roles } = useQuery<RoleRecord[]>({
    queryKey: ["/api/v2/admin/access-control/roles"],
    enabled: DEV_BYPASS && isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const { data: vessels } = useQuery<VesselRecord[]>({
    queryKey: ["/api/v2/vessel/list"],
    enabled: DEV_BYPASS && isOpen,
    staleTime: 5 * 60 * 1000,
  });

  if (!DEV_BYPASS) return null;

  const findRole = (roleName: string): RoleRecord | undefined =>
    roles?.find(
      (r) => r.assignedRole === roleName && r.isActive && !r.isDeleted,
    );

  const selectPersona = (persona: (typeof PERSONAS)[number], vessel?: DevVessel) => {
    const role = findRole(persona.roleName);
    const masterUserId = getDevPersonaMasterUserId(persona.key);
    if (!role || !masterUserId) return;
    applyDevPersona({
      personaKey: persona.key,
      masterUserId,
      role: role.assignedRole,
      roleId: role.ruid,
      userType: persona.ship ? "Ship" : "Office",
      vessel,
    });
  };

  const lastVesselId = getLastVesselId();
  const sortedVessels = vessels
    ? [...vessels].sort((a, b) =>
        a.vesselUuid === lastVesselId ? -1 : b.vesselUuid === lastVesselId ? 1 : 0,
      )
    : [];

  const triggerLabel = active
    ? `${active.role}${active.vessel ? ` · ${active.vessel.vessel}` : ""}`
    : "Sail Admin";
  const officePersonas = PERSONAS.filter((persona) => persona.group === "office");
  const directPersonas = PERSONAS.filter((persona) => !persona.group);
  const officeExpanded = expandedKey === "office";
  const officeDisabled = officePersonas.every((persona) => {
    const roleMissing = roles && !findRole(persona.roleName);
    return !!roleMissing || !getDevPersonaMasterUserId(persona.key);
  });

  return (
    <div className="relative flex items-center" ref={ref}>
      <button
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none rounded-full hover:bg-gray-200 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        data-testid="button-dev-persona"
        aria-label="Dev persona switcher"
        title={`Logged in as: ${triggerLabel} (dev)`}
      >
        <UserCog size={22} />
        {active && (
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full"
            data-testid="indicator-dev-persona-active"
          />
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-[44px] w-[260px] bg-white rounded-md shadow-lg border border-gray-200 z-[200] py-1"
          data-testid="dropdown-dev-persona"
        >
          <div className="px-3 py-2 text-[11px] font-semibold text-amber-700 border-b border-gray-100 uppercase tracking-wide">
            Dev persona (bypass mode)
          </div>
          {directPersonas.map((persona) => {
            const isActivePersona = activeKey === persona.key;
            const roleMissing = persona.key !== "sail-admin" && roles && !findRole(persona.roleName);
            const userFixtureMissing = !getDevPersonaMasterUserId(persona.key);
            const personaDisabled = !!roleMissing || userFixtureMissing;
            return (
              <button
                key={persona.key}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-800 hover:bg-gray-100 disabled:opacity-50"
                onClick={() => selectPersona(persona)}
                disabled={personaDisabled}
                data-testid={`button-persona-${persona.key}`}
              >
                {isActivePersona ? <Check size={14} className="text-green-600" /> : <span className="w-[14px]" />}
                <span className="flex flex-col items-start">
                  {persona.label}
                  {roleMissing && (
                    <span className="text-[10px] text-red-600" data-testid={`warning-role-missing-${persona.key}`}>
                      role not found in this tenant
                    </span>
                  )}
                  {userFixtureMissing && (
                    <span className="text-[10px] text-red-600">
                      no master user fixture
                    </span>
                  )}
                </span>
              </button>
            );
          })}
          <div>
            <button
              className="flex items-center justify-between w-full px-3 py-2 text-sm text-gray-800 hover:bg-gray-100 disabled:opacity-50"
              onClick={() => setExpandedKey(officeExpanded ? null : "office")}
              disabled={officeDisabled}
              data-testid="button-persona-office"
            >
              <span className="flex items-center gap-2">
                {officePersonas.some((persona) => activeKey === persona.key) ? <Check size={14} className="text-green-600" /> : <span className="w-[14px]" />}
                <span>Office</span>
              </span>
              <ChevronRight size={14} className={`transition-transform ${officeExpanded ? "rotate-90" : ""}`} />
            </button>
            {officeExpanded && (
              <div className="border-l-2 border-amber-200 ml-4" data-testid="list-office-personas">
                {officePersonas.map((persona) => {
                  const isActivePersona = activeKey === persona.key;
                  const roleMissing = roles && !findRole(persona.roleName);
                  const userFixtureMissing = !getDevPersonaMasterUserId(persona.key);
                  const personaDisabled = !!roleMissing || userFixtureMissing;
                  return (
                    <button
                      key={persona.key}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                      onClick={() => selectPersona(persona)}
                      disabled={personaDisabled}
                      data-testid={`button-persona-${persona.key}`}
                    >
                      {isActivePersona ? <Check size={12} className="text-green-600" /> : <span className="w-[12px]" />}
                      {persona.label}
                      {roleMissing && (
                        <span className="text-[10px] text-red-600" data-testid={`warning-role-missing-${persona.key}`}>
                          role not found
                        </span>
                      )}
                      {userFixtureMissing && <span className="text-[10px] text-red-600">no fixture</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {PERSONAS.filter((persona) => persona.group === "vessel").map((persona) => {
            const isActivePersona = activeKey === persona.key;
            const roleMissing = roles && !findRole(persona.roleName);
            const userFixtureMissing = !getDevPersonaMasterUserId(persona.key);
            const personaDisabled = !!roleMissing || userFixtureMissing;
            const isExpanded = expandedKey === persona.key;
            return (
              <div key={persona.key}>
                <button
                  className="flex items-center justify-between w-full px-3 py-2 text-sm text-gray-800 hover:bg-gray-100 disabled:opacity-50"
                  onClick={() => setExpandedKey(isExpanded ? null : persona.key)}
                  disabled={personaDisabled}
                  data-testid={`button-persona-${persona.key}`}
                >
                  <span className="flex items-center gap-2">
                    {isActivePersona ? <Check size={14} className="text-green-600" /> : <span className="w-[14px]" />}
                    <span className="flex flex-col items-start">
                      {persona.label}
                      {roleMissing && (
                        <span className="text-[10px] text-red-600" data-testid={`warning-role-missing-${persona.key}`}>
                          role not found in this tenant
                        </span>
                      )}
                      {userFixtureMissing && (
                        <span className="text-[10px] text-red-600">
                          no master user fixture
                        </span>
                      )}
                    </span>
                    {isActivePersona && active?.vessel && (
                      <span className="text-xs text-gray-500">({active.vessel.vessel})</span>
                    )}
                  </span>
                  <ChevronRight size={14} className={`transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                </button>
                {isExpanded && (
                  <div className="max-h-[220px] overflow-y-auto border-l-2 border-amber-200 ml-4" data-testid={`list-vessels-${persona.key}`}>
                    {sortedVessels.length === 0 && (
                      <div className="px-3 py-2 text-xs text-gray-400">Loading vessels…</div>
                    )}
                    {sortedVessels.map((v) => {
                      const isActiveVessel = isActivePersona && active?.vessel?.vesselId === v.vesselUuid;
                      return (
                        <button
                          key={v.vesselUuid}
                          className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
                          onClick={() =>
                            selectPersona(persona, {
                              vessel: v.vessel,
                              vesselId: v.vesselUuid,
                              imoNumber: v.imoNumber || "",
                            })
                          }
                          data-testid={`button-vessel-${v.vesselUuid}`}
                        >
                          {isActiveVessel ? <Check size={12} className="text-green-600" /> : <span className="w-[12px]" />}
                          {v.vessel}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
