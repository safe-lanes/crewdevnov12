import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, X, RefreshCw, Ship, AlertTriangle, Clock } from 'lucide-react';

// ============================================================================
// IMO Check-Digit Validation (client-side, fail fast)
// ============================================================================

function isValidImo(imo: string): boolean {
  const cleaned = imo.replace(/^IMO\s*/i, '').trim();
  if (!/^\d{7}$/.test(cleaned)) return false;

  const digits = cleaned.split('').map(Number);
  const weights = [7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 6; i++) {
    sum += digits[i] * weights[i];
  }
  return (sum % 10) === digits[6];
}

// ============================================================================
// Types
// ============================================================================

export interface VesselSearchResult {
  id: number;
  imo: string | null;
  mmsi: string | null;
  callSign: string | null;
  name: string;
  nameAis: string | null;
  vesselType: string | null;
  country: string | null;
  countryCode: string | null;
  yearBuilt: string | null;
  operatingStatus: string | null;
  grossTonnage: string | null;
  deadweightTonnage: string | null;
  ownerName: string | null;
  managerName: string | null;
  engineTypePower: string | null;
  apiVerifiedAt: string | null;
}

interface VesselSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectVessel: (vessel: VesselSearchResult) => void;
}

type SearchErrorType = 'not_found' | 'rate_limited' | 'provider_error' | 'invalid_imo' | 'network' | null;

// ============================================================================
// Component
// ============================================================================

export function VesselSearchDialog({ open, onOpenChange, onSelectVessel }: VesselSearchDialogProps) {
  const [searchBy, setSearchBy] = useState<'name' | 'imo'>('name');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<VesselSearchResult[]>([]);
  const [selectedVessel, setSelectedVessel] = useState<VesselSearchResult | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorType, setErrorType] = useState<SearchErrorType>(null);
  const [imoValidationError, setImoValidationError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setResults([]);
    setSelectedVessel(null);
    setVerificationStatus(null);
    setWarning(null);
    setErrorType(null);
    setImoValidationError(null);
  }, []);

  const handleSearch = useCallback(async (forceRefresh = false) => {
    const query = searchQuery.trim();
    if (!query) return;

    // Client-side IMO validation
    if (searchBy === 'imo') {
      if (!isValidImo(query)) {
        setImoValidationError('Invalid IMO number. Must be 7 digits with a valid check digit.');
        return;
      }
    }
    setImoValidationError(null);

    setLoading(true);
    setErrorType(null);
    setWarning(null);

    try {
      const params = new URLSearchParams({
        query,
        searchBy,
        ...(forceRefresh ? { forceRefresh: 'true' } : {}),
      });

      const response = await fetch(`/api/v2/recruitment/vessel-search?${params}`);
      const data = await response.json();

      if (!response.ok) {
        setResults([]);
        setSelectedVessel(null);
        setVerificationStatus(null);
        setErrorType(data.errorType || 'network');
        return;
      }

      setResults(data.vessels || []);
      setVerificationStatus(data.verificationStatus || null);
      setWarning(data.warning || null);
      setErrorType(null);

      // Auto-select single result on IMO search
      if (searchBy === 'imo' && data.vessels?.length === 1) {
        setSelectedVessel(data.vessels[0]);
      } else {
        setSelectedVessel(null);
      }
    } catch (err) {
      console.error('Vessel search error:', err);
      setErrorType('network');
      setResults([]);
      setSelectedVessel(null);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, searchBy]);

  const handleReVerify = useCallback(() => {
    handleSearch(true);
  }, [handleSearch]);

  const handleUseVessel = useCallback(() => {
    if (selectedVessel) {
      onSelectVessel(selectedVessel);
      onOpenChange(false);
      // Reset state after closing
      setTimeout(() => {
        setSearchQuery('');
        resetState();
      }, 300);
    }
  }, [selectedVessel, onSelectVessel, onOpenChange, resetState]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault();
      handleSearch();
    }
  }, [handleSearch, searchQuery]);

  // ============================================================================
  // Render helpers
  // ============================================================================

  const renderVerificationBadge = () => {
    if (!verificationStatus) return null;

    switch (verificationStatus) {
      case 'api_verified':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200 gap-1">
            <Ship className="h-3 w-3" />
            API Verified
          </Badge>
        );
      case 'database_cached':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 gap-1">
            <Clock className="h-3 w-3" />
            Database Cached
          </Badge>
        );
      case 'database_cached_refreshing':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 gap-1">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Database Cached — refreshing
          </Badge>
        );
      default:
        return null;
    }
  };

  const renderEmptyState = () => {
    if (loading || results.length > 0) return null;

    switch (errorType) {
      case 'not_found':
        return (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-600">No vessel found</p>
            <p className="text-xs text-gray-400 mt-1">
              No vessel matches your {searchBy === 'imo' ? 'IMO number' : 'search term'}. 
              Please check for typos and try again.
            </p>
          </div>
        );
      case 'rate_limited':
        return (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-400 mb-3" />
            <p className="text-sm font-medium text-amber-700">Rate limit reached</p>
            <p className="text-xs text-gray-400 mt-1">
              The external vessel API rate limit has been reached. Please wait a few minutes and try again.
            </p>
          </div>
        );
      case 'provider_error':
        return (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-red-400 mb-3" />
            <p className="text-sm font-medium text-red-700">Provider unavailable</p>
            <p className="text-xs text-gray-400 mt-1">
              The external vessel data provider is temporarily unavailable. Please try again later.
            </p>
          </div>
        );
      case 'invalid_imo':
        return (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-red-400 mb-3" />
            <p className="text-sm font-medium text-red-700">Invalid IMO Number</p>
            <p className="text-xs text-gray-400 mt-1">
              The IMO number provided is not valid. IMO numbers must be 7 digits with a valid check digit.
            </p>
          </div>
        );
      case 'network':
        return (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-red-400 mb-3" />
            <p className="text-sm font-medium text-red-700">Connection error</p>
            <p className="text-xs text-gray-400 mt-1">
              Unable to connect to the vessel search service. Please check your connection and try again.
            </p>
          </div>
        );
      default:
        if (!searchQuery.trim()) {
          return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Ship className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-600">Search for a vessel</p>
              <p className="text-xs text-gray-400 mt-1">
                Enter a vessel name or IMO number to search the database.
              </p>
            </div>
          );
        }
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) {
        setTimeout(() => {
          setSearchQuery('');
          resetState();
        }, 300);
      }
    }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="vessel-search-dialog">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold" style={{ color: '#16569e' }}>
            <div className="flex items-center gap-2">
              <Ship className="h-5 w-5" />
              Search Vessel Database
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Search Controls */}
        <div className="space-y-4 py-2">
          {/* Radio toggle */}
          <div className="flex items-center gap-4">
            <Label className="text-sm font-medium text-gray-600">Search by:</Label>
            <RadioGroup
              value={searchBy}
              onValueChange={(v) => {
                setSearchBy(v as 'name' | 'imo');
                resetState();
                setSearchQuery('');
              }}
              className="flex gap-4"
            >
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="name" id="search-name" />
                <Label htmlFor="search-name" className="text-sm cursor-pointer">Vessel Name</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="imo" id="search-imo" />
                <Label htmlFor="search-imo" className="text-sm cursor-pointer">IMO Number <span className="text-xs text-gray-500 font-normal">(Recommended)</span></Label>
              </div>
            </RadioGroup>
          </div>

          {/* Search input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setImoValidationError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder={searchBy === 'imo' ? 'Enter 7-digit IMO number...' : 'Enter vessel name...'}
                className="pl-9 pr-8"
                data-testid="vessel-search-input"
                maxLength={searchBy === 'imo' ? 10 : 100}
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); resetState(); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button
              onClick={() => handleSearch()}
              disabled={loading || !searchQuery.trim()}
              className="bg-[#16569e] hover:bg-[#124a87]"
              data-testid="vessel-search-button"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="ml-2">Search</span>
            </Button>
          </div>

          {/* IMO validation error */}
          {imoValidationError && (
            <p className="text-xs text-red-500">{imoValidationError}</p>
          )}
        </div>

        {/* Verification Status & Actions */}
        {(verificationStatus || warning) && (
          <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md">
            <div className="flex items-center gap-3">
              {renderVerificationBadge()}
              {selectedVessel?.apiVerifiedAt && (
                <span className="text-xs text-gray-500">
                  Last Verified: {new Date(selectedVessel.apiVerifiedAt).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              )}
            </div>
            {verificationStatus && verificationStatus !== 'api_verified' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReVerify}
                disabled={loading}
                className="text-xs gap-1"
                data-testid="vessel-reverify-button"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                Re-verify from Live API
              </Button>
            )}
          </div>
        )}

        {/* Warning banner */}
        {warning && (
          <div className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-md border border-amber-200">
            ⚠️ {warning}
          </div>
        )}

        {/* Results Table */}
        <div className="flex-1 overflow-auto min-h-0" style={{ maxHeight: '400px' }}>
          {results.length > 0 ? (
            <Table className="w-full">
              <TableHeader>
                <TableRow className="bg-gray-100">
                  <TableHead className="text-[#4f5863] text-[12px] font-medium p-2 w-40">Vessel Name</TableHead>
                  <TableHead className="text-[#4f5863] text-[12px] font-medium p-2 w-20">IMO Number</TableHead>
                  <TableHead className="text-[#4f5863] text-[12px] font-medium p-2 w-24">Vessel Type</TableHead>
                  <TableHead className="text-[#4f5863] text-[12px] font-medium p-2 w-16">Flag</TableHead>
                  <TableHead className="text-[#4f5863] text-[12px] font-medium p-2 w-16">Year Built</TableHead>
                  <TableHead className="text-[#4f5863] text-[12px] font-medium p-2 w-16">GT</TableHead>
                  <TableHead className="text-[#4f5863] text-[12px] font-medium p-2 w-16">DWT</TableHead>
                  <TableHead className="text-[#4f5863] text-[12px] font-medium p-2 w-20">MMSI</TableHead>
                  <TableHead className="text-[#4f5863] text-[12px] font-medium p-2 w-20">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((vessel) => (
                  <TableRow
                    key={vessel.id}
                    className={`cursor-pointer transition-colors ${
                      selectedVessel?.id === vessel.id
                        ? 'bg-blue-50 border-blue-200'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedVessel(vessel)}
                    data-testid={`vessel-row-${vessel.id}`}
                  >
                    <TableCell className="p-2 text-[12px] font-medium">{vessel.name || '—'}</TableCell>
                    <TableCell className="p-2 text-[12px]">{vessel.imo || '—'}</TableCell>
                    <TableCell className="p-2 text-[12px]">{vessel.vesselType || '—'}</TableCell>
                    <TableCell className="p-2 text-[12px]">{vessel.country || '—'}</TableCell>
                    <TableCell className="p-2 text-[12px]">{vessel.yearBuilt || '—'}</TableCell>
                    <TableCell className="p-2 text-[12px]">{vessel.grossTonnage || '—'}</TableCell>
                    <TableCell className="p-2 text-[12px]">{vessel.deadweightTonnage || '—'}</TableCell>
                    <TableCell className="p-2 text-[12px]">{vessel.mmsi || '—'}</TableCell>
                    <TableCell className="p-2 text-[12px]">
                      {vessel.operatingStatus ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {vessel.operatingStatus}
                        </Badge>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            renderEmptyState()
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUseVessel}
            disabled={!selectedVessel}
            className="bg-[#16569e] hover:bg-[#124a87]"
            data-testid="vessel-use-button"
          >
            <Ship className="h-4 w-4 mr-2" />
            Use This Vessel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
