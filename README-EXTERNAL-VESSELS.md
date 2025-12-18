# External Master Data API Integration

> **Last Updated:** December 18, 2025  
> **Status:** ✅ Active  
> **API Provider:** SAIL ERP System

---

## Overview

This integration fetches master data from an external SAIL ERP API instead of the local database. This allows the crew management system to display real-time data from the central ERP system.

**Masters using external API:**
- **001** - Nationality Master
- **004** - Vessel Type Master  
- **014** - Vessel Master

## Hooks

### `useExternalNationalities`

Fetches nationality master data (ID: 001) from the external API.

**Location:** `client/src/hooks/useExternalNationalities.tsx`

**Usage:**
```typescript
import { useExternalNationalities } from "@/hooks/useExternalNationalities";

const { data, isLoading, error } = useExternalNationalities();

// Access nationalities array
const nationalities = data?.nationalities || [];
```

**API Endpoint:**
```
GET https://dev.sl-sail.com/b/api/v1/crewmasterdata/getallmasterdata/nationalities?domain={domain}
```

### `useExternalVessels`

Fetches vessel master data (ID: 014) from the external API.

**Location:** `client/src/hooks/useExternalVessels.tsx`

**Usage:**
```typescript
import { useExternalVessels } from "@/hooks/useExternalVessels";

const { data, isLoading, error } = useExternalVessels();

// Access vessels array
const vessels = data?.vessels || [];
```

**API Endpoint:**
```
GET https://dev.sl-sail.com/b/api/v1/crewmasterdata/getallmasterdata/vessels?domain={domain}
```

### `useExternalVesselTypes`

Fetches vessel type master data (ID: 004) from the external API.

**Location:** `client/src/hooks/useExternalVesselTypes.tsx`

**Usage:**
```typescript
import { useExternalVesselTypes } from "@/hooks/useExternalVesselTypes";

const { data, isLoading, error } = useExternalVesselTypes();

// Access vessel types array
const vesselTypes = data?.vesseltypes || [];
```

**API Endpoint:**
```
GET https://dev.sl-sail.com/b/api/v1/crewmasterdata/getallmasterdata/vesseltypes?domain={domain}
```

## Configuration

### Domain Parameter

Both hooks read the `domain` value from localStorage with a fallback to `'rsms'`:

```typescript
const domain = localStorage.getItem('domain') || 'rsms';
```

To change the domain, set it in localStorage:
```javascript
localStorage.setItem('domain', 'your-domain-code');
```

### Caching

Both hooks use React Query with the following settings:
- **staleTime:** 5 minutes (300,000 ms) - Data is considered fresh for 5 minutes
- **retry:** 2 attempts on failure

## Response Structure

### Vessels Response
```json
{
  "vessels": [
    {
      "vuid": "V001",
      "vessel": "MV Atlantic Pioneer",
      "imoNumber": "9876543",
      "vesselType": "Container Ship",
      "vesselTypeId": "VT001"
    }
  ]
}
```

### Vessel Types Response
```json
{
  "vesseltypes": [
    {
      "vtuid": "VT001",
      "vesselType": "Container Ship",
      "tanker": 0,
      "oilTanker": 0,
      "gasTanker": 0,
      "chemicalTanker": 0,
      "dry": 0,
      "container": 1
    }
  ]
}
```

## Integration in AdminModule

The external API data is used in the **Data Masters** section of the Admin module:

1. **Vessel Type Master (004)** - Displays vessel types from external API
2. **Vessel Master (014)** - Displays vessels from external API

Both are **read-only** in the UI (marked with "External" label in Actions column).

## Testing

### Manual Testing Checklist

- [ ] Navigate to Admin → Data Masters
- [ ] Select "Vessel Type" (004) - should load external vessel types
- [ ] Select "Vessel" (014) - should load external vessels
- [ ] Check browser Network tab for API calls to `dev.sl-sail.com`
- [ ] Verify correct domain parameter is sent
- [ ] Check console for debug logs: `🔧 [External Vessel Types]` and `🚢 [External Vessels]`
- [ ] Verify 5-minute cache works (no refetch on navigation)
- [ ] Test error states by disconnecting network

### Verification Commands

Check browser console for debug output:
```
🔧 [External Vessel Types] Processed Data: [...]
🚢 [External Vessels] Processed Data: [...]
```

## Troubleshooting

### No Data Displayed

1. Check browser console for errors
2. Verify the domain in localStorage: `localStorage.getItem('domain')`
3. Check Network tab for API response
4. Verify API endpoint is accessible

### CORS Errors

The external API should be configured to allow cross-origin requests. If you encounter CORS issues:
1. Contact the API provider (SAIL ERP team)
2. Verify the requesting domain is whitelisted

### Data Not Refreshing

Data is cached for 5 minutes. To force refresh:
```typescript
// In component or DevTools console
import { queryClient } from "@/lib/queryClient";
queryClient.invalidateQueries({ queryKey: ['/api/external/vessels'] });
queryClient.invalidateQueries({ queryKey: ['/api/external/vessel-types'] });
```

## Files Modified

| File | Changes |
|------|---------|
| `client/src/hooks/useExternalVessels.tsx` | Created - Fetches vessel data |
| `client/src/hooks/useExternalVesselTypes.tsx` | Created - Fetches vessel type data |
| `client/src/modules/admin/AdminModule.tsx` | Updated - Integrated external hooks for masters 004 and 014 |

## Rollback

To revert to local database data:

1. In `AdminModule.tsx`, uncomment the original `useMasterDataEntries` calls
2. Comment out or remove the external hook imports and usage
3. Remove the special rendering logic for selectedMaster === "004" and "014"

---

**Document Version:** 1.0  
**Author:** Development Team
