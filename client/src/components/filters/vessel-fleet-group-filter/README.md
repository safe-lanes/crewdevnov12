# VesselFleetGroupFilter Component

A reusable, responsive filter component for selecting vessels, fleet groups, or additional groups using radio buttons with associated dropdowns.

## Features

- **Radio button group** for switching between Vessel, Fleet, and Add Group modes
- **Multi-select popover** for vessels with checkboxes
- **Single-select dropdowns** for Fleet and Add Group
- **Responsive layouts** for desktop, tablet, and phone
- **Filter toggle** button to show/hide filters
- **Clear button** to reset all selections
- **Additional filters slot** for injecting custom filters
- **Dark mode support** via theme tokens
- **Customizable placeholders** and test IDs

## Usage

```tsx
import { useState } from 'react';
import { 
  VesselFleetGroupFilter,
  FilterMode,
  createInitialState 
} from '@/components/filters/vessel-fleet-group-filter';

function MyComponent() {
  const [filterState, setFilterState] = useState(createInitialState());

  // Your data - typically from API hooks
  const vessels = [
    { id: 1, vesselId: 'VSL-001', name: 'MT Pacific Star' },
    { id: 2, vesselId: 'VSL-002', name: 'MT Atlantic Queen' },
  ];

  const fleets = [
    { id: 1, value: 'fleet1', label: 'Fleet Group 1' },
    { id: 2, value: 'fleet2', label: 'Fleet Group 2' },
  ];

  const groups = [
    { id: 1, value: 'group1', label: 'Additional Group 1' },
    { id: 2, value: 'group2', label: 'Additional Group 2' },
  ];

  const handleModeChange = (mode: FilterMode) => {
    setFilterState(prev => ({ ...prev, mode }));
  };

  const handleToggleVessel = (vesselId: string) => {
    setFilterState(prev => ({
      ...prev,
      selectedVessels: prev.selectedVessels.includes(vesselId)
        ? prev.selectedVessels.filter(id => id !== vesselId)
        : [...prev.selectedVessels, vesselId]
    }));
  };

  const handleClear = () => {
    setFilterState(createInitialState());
  };

  return (
    <VesselFleetGroupFilter
      mode={filterState.mode}
      onModeChange={handleModeChange}
      vessels={vessels}
      selectedVessels={filterState.selectedVessels}
      onToggleVessel={handleToggleVessel}
      fleets={fleets}
      selectedFleet={filterState.selectedFleet}
      onFleetChange={(value) => setFilterState(prev => ({ ...prev, selectedFleet: value }))}
      groups={groups}
      selectedGroup={filterState.selectedGroup}
      onGroupChange={(value) => setFilterState(prev => ({ ...prev, selectedGroup: value }))}
      showFilters={filterState.showFilters}
      onToggleFilters={() => setFilterState(prev => ({ ...prev, showFilters: !prev.showFilters }))}
      onClear={handleClear}
    />
  );
}
```

## Props API

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `mode` | `FilterMode` | Yes | - | Current filter mode: 'vessel', 'fleet', or 'addGroup' |
| `onModeChange` | `(mode: FilterMode) => void` | Yes | - | Callback when mode changes |
| `vessels` | `VesselOption[]` | Yes | - | Array of vessel options |
| `selectedVessels` | `string[]` | Yes | - | Array of selected vessel IDs |
| `onToggleVessel` | `(vesselId: string) => void` | Yes | - | Callback to toggle vessel selection |
| `vesselsLoading` | `boolean` | No | `false` | Show loading state for vessels |
| `vesselPlaceholder` | `string` | No | `'Vessel'` | Placeholder text for vessel select |
| `fleets` | `FleetOption[]` | Yes | - | Array of fleet options |
| `selectedFleet` | `string` | Yes | - | Selected fleet value |
| `onFleetChange` | `(value: string) => void` | Yes | - | Callback when fleet changes |
| `fleetPlaceholder` | `string` | No | `'Fleet'` | Placeholder text for fleet select |
| `groups` | `GroupOption[]` | Yes | - | Array of group options |
| `selectedGroup` | `string` | Yes | - | Selected group value |
| `onGroupChange` | `(value: string) => void` | Yes | - | Callback when group changes |
| `groupPlaceholder` | `string` | No | `'Add Group'` | Placeholder text for group select |
| `showFilters` | `boolean` | Yes | - | Whether filters are visible |
| `onToggleFilters` | `() => void` | Yes | - | Callback to toggle filter visibility |
| `onClear` | `() => void` | Yes | - | Callback to clear all filters |
| `showFilterToggle` | `boolean` | No | `true` | Show/hide the filter toggle button |
| `showClearButton` | `boolean` | No | `true` | Show/hide the clear button |
| `className` | `string` | No | `''` | Additional CSS classes |
| `testIdPrefix` | `string` | No | `''` | Prefix for data-testid attributes |
| `additionalFilters` | `ReactNode` | No | - | Slot for injecting additional filter controls |

## Type Definitions

```typescript
type FilterMode = 'vessel' | 'fleet' | 'addGroup';

interface VesselOption {
  id: string | number;
  vesselId: string;
  name: string;
}

interface FleetOption {
  id: string | number;
  value: string;
  label: string;
}

interface GroupOption {
  id: string | number;
  value: string;
  label: string;
}
```

## Transfer Checklist

When moving this component to another application, ensure the following:

### Required Dependencies

1. **UI Components** (shadcn/ui or equivalent):
   - `Button` from `@/components/ui/button`
   - `RadioGroup`, `RadioGroupItem` from `@/components/ui/radio-group`
   - `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` from `@/components/ui/select`
   - `Popover`, `PopoverContent`, `PopoverTrigger` from `@/components/ui/popover`
   - `Checkbox` from `@/components/ui/checkbox`

2. **Icons** (lucide-react):
   - `Filter`
   - `ChevronDown`

3. **Hooks**:
   - `useViewport` hook for responsive behavior (see below)

### useViewport Hook

Copy this hook to your project at `@/hooks/useViewport.ts`:

```typescript
import { useState, useEffect } from 'react';

export type ViewportSize = 'desktop' | 'laptop' | 'tablet' | 'phone';

export const useViewport = (): ViewportSize => {
  const [viewport, setViewport] = useState<ViewportSize>('desktop');

  useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth;
      if (width >= 1440) setViewport('desktop');
      else if (width >= 1280) setViewport('laptop');
      else if (width >= 768) setViewport('tablet');
      else setViewport('phone');
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  return viewport;
};
```

### Tailwind CSS Configuration

Ensure your Tailwind config includes these color tokens or adjust the component's classes:
- `border-input` - Input border color
- `bg-transparent` - Transparent background
- Dark mode variants (`dark:bg-neutral-900`, `dark:text-neutral-200`)

### Path Aliases

Verify your bundler (Vite/Webpack) has the `@/` path alias configured to your `src` directory.

### Installation Steps

1. Copy the entire `vessel-fleet-group-filter` folder to your components directory
2. Copy the `useViewport` hook if not present
3. Verify all shadcn/ui components are installed
4. Update import paths if your directory structure differs
5. Test on all viewport sizes (desktop, tablet, phone)

## Adding Custom Filters

Use the `additionalFilters` prop to inject custom filter controls:

```tsx
<VesselFleetGroupFilter
  {...props}
  additionalFilters={
    <>
      <Select value={dueIn} onValueChange={setDueIn}>
        <SelectTrigger className="h-8 w-[120px]">
          <SelectValue placeholder="Due in" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="3m">Due in 3M</SelectItem>
          <SelectItem value="2m">Due in 2M</SelectItem>
        </SelectContent>
      </Select>
      
      <Select value={rank} onValueChange={setRank}>
        <SelectTrigger className="h-8 w-[120px]">
          <SelectValue placeholder="Rank" />
        </SelectTrigger>
        <SelectContent>
          {ranks.map(r => (
            <SelectItem key={r.id} value={r.value}>{r.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  }
/>
```

## Accessibility

- Radio buttons have associated IDs for accessibility
- Checkbox labels are clickable
- All interactive elements have `data-testid` attributes for testing
- Consider adding `aria-label` attributes for screen readers if needed
