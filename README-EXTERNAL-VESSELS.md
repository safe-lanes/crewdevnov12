# External Vessels Hook Documentation

## Overview

The `useExternalVessels` hook provides a React Query-based interface for fetching vessel master data from the external SAIL ERP API. This enables the application to populate vessel type dropdowns and selectors with data from the central ERP system.

---

## Installation

The hook uses dependencies that are already installed in the project:
- `@tanstack/react-query` - For data fetching and caching

No additional installation required.

---

## API Endpoint

| Property | Value |
|----------|-------|
| **Base URL** | `https://dev.sl-sail.com/b/api/v1/crewmasterdata/getallmasterdata/vessels` |
| **Method** | GET |
| **Headers** | `accept: */*` |
| **Query Parameters** | `domain` (authentication/tenant identifier) |

### Domain Parameter

The domain parameter is retrieved in the following order:
1. Custom domain passed to the hook
2. `localStorage.getItem('domain')`
3. Default: `'rsms'`

---

## Usage

### Basic Usage

```typescript
import { useExternalVessels } from '@/hooks/useExternalVessels';

function VesselSelector() {
  const { data: vessels, isLoading, error } = useExternalVessels();

  if (isLoading) return <div>Loading vessels...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <select>
      {vessels?.map((vessel) => (
        <option key={vessel.id} value={vessel.id}>
          {vessel.name}
        </option>
      ))}
    </select>
  );
}
```

### With Custom Domain

```typescript
const { data: vessels } = useExternalVessels({ 
  domain: 'custom-domain' 
});
```

### Conditional Fetching

```typescript
const [isReady, setIsReady] = useState(false);

const { data: vessels } = useExternalVessels({ 
  enabled: isReady 
});
```

### Manual Refetch

```typescript
const { data: vessels, refetch } = useExternalVessels();

// Trigger manual refetch
const handleRefresh = () => {
  refetch();
};
```

---

## TypeScript Types

### ExternalVessel Interface

```typescript
export interface ExternalVessel {
  id: string | number;
  name: string;
  vesselType?: string;
  imoNumber?: string;
  flag?: string;
  grossTonnage?: number;
  deadWeight?: number;
  yearBuilt?: number;
  status?: string;
  [key: string]: unknown;  // Additional fields from API
}
```

### Hook Options

```typescript
export interface UseExternalVesselsOptions {
  enabled?: boolean;   // Auto-fetch on mount (default: true)
  domain?: string;     // Override domain parameter
}
```

### Return Type

The hook returns a standard React Query `UseQueryResult`:

```typescript
{
  data: ExternalVessel[] | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<QueryObserverResult>;
  // ...other React Query properties
}
```

---

## Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| **staleTime** | 5 minutes | Data considered fresh for 5 minutes |
| **retry** | 2 | Retry failed requests up to 2 times |
| **enabled** | true | Auto-fetch on component mount |

---

## Helper Functions

### getExternalVesselsDomain()

Returns the current domain being used for API calls.

```typescript
import { getExternalVesselsDomain } from '@/hooks/useExternalVessels';

const domain = getExternalVesselsDomain();
console.log(domain); // 'rsms' or value from localStorage
```

---

## Testing

### Test Component

A test component is available at `client/src/components/TestExternalVessels.tsx` for manual verification.

To use the test component:

1. Import and render it in a route:
```typescript
import { TestExternalVessels } from '@/components/TestExternalVessels';

// Add to your routes or render directly
<TestExternalVessels />
```

2. The test component displays:
   - Current domain being used
   - Loading/fetching/success/error states
   - List of vessels when loaded
   - Refetch button for testing cache behavior
   - API configuration details

### Manual Testing Checklist

- [ ] Verify API call appears in browser Network tab
- [ ] Check correct domain parameter is sent
- [ ] Verify data structure matches TypeScript types
- [ ] Test with different domain values in localStorage
- [ ] Verify 5-minute cache works (no refetch on remount within 5 min)
- [ ] Test error states (disconnect network, wrong domain)
- [ ] Test refetch button functionality

### Setting Domain in localStorage

```javascript
// In browser console
localStorage.setItem('domain', 'your-domain');

// Clear domain (will fallback to 'rsms')
localStorage.removeItem('domain');
```

---

## Error Handling

The hook handles errors through React Query's standard error handling:

```typescript
const { data, error, isError } = useExternalVessels();

if (isError) {
  console.error('Failed to fetch vessels:', error.message);
  // Show error UI
}
```

Common error scenarios:
- **Network failure**: Check internet connection
- **Invalid domain**: Verify domain parameter is correct
- **API down**: External SAIL ERP service unavailable
- **404/500 responses**: Server-side issues

---

## Caching Behavior

- **staleTime (5 minutes)**: Data is considered fresh for 5 minutes
- **cacheTime**: Uses React Query default (5 minutes)
- **Background refetch**: Stale data refetches on window focus
- **Manual refetch**: Call `refetch()` to force update

### Cache Key

The query uses a composite key:
```typescript
queryKey: ['external-vessels', domain]
```

Different domains will have separate cache entries.

---

## Troubleshooting

### Issue: No data returned

1. Check browser Network tab for API response
2. Verify domain parameter is correct
3. Check if API endpoint is accessible
4. Look for CORS errors in console

### Issue: CORS errors

The external API must allow cross-origin requests. If CORS issues persist:
- Check if running from allowed origin
- Contact API administrator for CORS configuration

### Issue: Data not refreshing

1. Check if within 5-minute staleTime
2. Use `refetch()` for manual refresh
3. Clear React Query cache: `queryClient.invalidateQueries(['external-vessels'])`

### Issue: Loading state stuck

1. Check Network tab for pending request
2. Verify API isn't returning slowly
3. Check for retry attempts (max 2)

---

## Integration with Existing System

The hook can be used alongside the existing `useVesselLookup` hook:

- `useVesselLookup`: Fetches vessels from local master data (API 014)
- `useExternalVessels`: Fetches vessels from external SAIL ERP

Choose based on your data source requirements.

---

## File Locations

| File | Purpose |
|------|---------|
| `client/src/hooks/useExternalVessels.ts` | Hook implementation |
| `client/src/components/TestExternalVessels.tsx` | Manual test component |
| `README-EXTERNAL-VESSELS.md` | This documentation |

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| Dec 18, 2025 | 1.0.0 | Initial implementation |

---

## Contact

For issues related to the external SAIL ERP API, contact the API administrator.
For issues with the hook implementation, refer to the codebase or development team.
