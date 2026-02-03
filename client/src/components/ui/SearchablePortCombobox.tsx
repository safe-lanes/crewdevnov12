import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Port {
  portUuid: string;
  name: string;
  country: string | null;
  portCode: string | null;
}

interface SearchablePortComboboxProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  'data-testid'?: string;
}

export function SearchablePortCombobox({
  value,
  onValueChange,
  placeholder = "Search port...",
  disabled = false,
  className,
  'data-testid': testId,
}: SearchablePortComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedPort, setSelectedPort] = useState<Port | null>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const prevValueRef = useRef<string | undefined>(value);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchTerm]);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      if (!value) {
        setSelectedPort(null);
      } else if (selectedPort?.portUuid !== value) {
        setSelectedPort(null);
      }
    }
  }, [value, selectedPort?.portUuid]);

  const { data: ports = [], isLoading } = useQuery<Port[]>({
    queryKey: ['/api/v2/ports/search', debouncedSearch],
    queryFn: async () => {
      if (debouncedSearch.length < 2) return [];
      const response = await fetch(`/api/v2/ports/search?q=${encodeURIComponent(debouncedSearch)}`);
      if (!response.ok) throw new Error('Failed to search ports');
      return response.json();
    },
    enabled: debouncedSearch.length >= 2,
    staleTime: 60000,
  });

  const { data: currentPort } = useQuery<Port>({
    queryKey: ['/api/v2/ports', value],
    queryFn: async () => {
      if (!value) return null;
      const response = await fetch(`/api/v2/ports/${value}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!value && (!selectedPort || selectedPort.portUuid !== value),
    staleTime: 300000,
  });

  useEffect(() => {
    if (currentPort && currentPort.portUuid === value) {
      setSelectedPort(currentPort);
    }
  }, [currentPort, value]);

  const handleSelect = useCallback((port: Port) => {
    setSelectedPort(port);
    onValueChange(port.portUuid);
    setOpen(false);
    setSearchTerm('');
  }, [onValueChange]);

  const displayValue = selectedPort 
    ? `${selectedPort.name}${selectedPort.country ? ` (${selectedPort.country})` : ''}`
    : value 
      ? 'Loading...' 
      : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !selectedPort && !value && "text-muted-foreground",
            disabled && "bg-gray-100 cursor-not-allowed",
            className
          )}
          data-testid={testId}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type to search ports..."
            value={searchTerm}
            onValueChange={setSearchTerm}
            data-testid={testId ? `${testId}-input` : undefined}
          />
          <CommandList>
            {isLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
              </div>
            )}
            {!isLoading && debouncedSearch.length < 2 && (
              <CommandEmpty>Type at least 2 characters to search</CommandEmpty>
            )}
            {!isLoading && debouncedSearch.length >= 2 && ports.length === 0 && (
              <CommandEmpty>No ports found</CommandEmpty>
            )}
            {!isLoading && ports.length > 0 && (
              <CommandGroup>
                {ports.map((port) => (
                  <CommandItem
                    key={port.portUuid}
                    value={port.portUuid}
                    onSelect={() => handleSelect(port)}
                    data-testid={testId ? `${testId}-option-${port.portUuid}` : undefined}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === port.portUuid ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">
                      {port.name}{port.country ? ` (${port.country})` : ''}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
