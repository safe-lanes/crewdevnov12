import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, X, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface DbTrainingOption {
  id: string;
  name: string;
}

interface DbTrainingComboboxProps {
  value: string;
  options: DbTrainingOption[];
  onChange: (value: string) => void;
  isLoading?: boolean;
  isError?: boolean;
  disabled?: boolean;
  testId?: string;
  triggerClassName?: string;
}

export function DbTrainingCombobox({
  value,
  options,
  onChange,
  isLoading = false,
  isError = false,
  disabled = false,
  testId,
  triggerClassName,
}: DbTrainingComboboxProps) {
  const [open, setOpen] = useState(false);

  const matched = useMemo(
    () => options.find(o => o.id === value),
    [options, value]
  );
  const isUnknown = !!value && !matched && !isLoading;

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const triggerLabel = isLoading
    ? 'Loading...'
    : isError
    ? 'Failed to load'
    : matched
    ? matched.name
    : isUnknown
    ? value
    : 'Select DB training...';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={isLoading || disabled}
          className={cn(
            'h-8 w-full justify-between text-xs font-normal px-2',
            !matched && !isUnknown && 'text-muted-foreground',
            isError && 'text-destructive',
            triggerClassName,
          )}
          data-testid={testId}
        >
          <span className="truncate flex items-center gap-1">
            {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            <span className="truncate">{triggerLabel}</span>
            {isUnknown && (
              <span className="ml-1 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                Unknown
              </span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search trainings..." className="h-9" />
          <CommandList>
            <CommandEmpty>No training found.</CommandEmpty>
            {value && (
              <CommandGroup>
                <CommandItem
                  value="__clear__"
                  onSelect={() => handleSelect('')}
                  data-testid={testId ? `${testId}-clear` : undefined}
                >
                  <X className="mr-2 h-4 w-4" />
                  Clear selection
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {options.map(option => (
                <CommandItem
                  key={option.id}
                  value={`${option.name} ${option.id}`}
                  onSelect={() => handleSelect(option.id)}
                  data-testid={testId ? `${testId}-option-${option.id}` : undefined}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === option.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="truncate">{option.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
