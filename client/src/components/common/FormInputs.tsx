import * as React from "react";
import { CalendarIcon, Check, ChevronDown, Search, X, Upload } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Base UI Components
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// ============================================================================
// BASE INPUT TYPES AND INTERFACES
// ============================================================================

export interface BaseInputProps {
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface RadioOption {
  value: string;
  label: string;
  disabled?: boolean;
}

// ============================================================================
// TEXT INPUT COMPONENT
// ============================================================================

export interface TextInputProps extends BaseInputProps {
  type?: "text" | "email" | "password" | "url" | "tel" | "number";
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  autoComplete?: string;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  readOnly?: boolean;
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ 
    label, 
    description, 
    error, 
    required, 
    disabled, 
    className, 
    id,
    type = "text",
    value,
    defaultValue,
    placeholder,
    onChange,
    onBlur,
    onFocus,
    autoComplete,
    maxLength,
    minLength,
    pattern,
    readOnly,
    ...props 
  }, ref) => {
    const inputId = id || React.useId();

    return (
      <div className={cn("space-y-2", className)}>
        {label && (
          <Label htmlFor={inputId} className={cn(error && "text-destructive")}>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <Input
          ref={ref}
          id={inputId}
          type={type}
          value={value}
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          autoComplete={autoComplete}
          maxLength={maxLength}
          minLength={minLength}
          pattern={pattern}
          className={cn(error && "border-destructive focus-visible:ring-destructive")}
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={onBlur}
          onFocus={onFocus}
          {...props}
        />
        {description && !error && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

TextInput.displayName = "TextInput";

// ============================================================================
// TEXTAREA COMPONENT
// ============================================================================

export interface TextareaInputProps extends BaseInputProps {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  rows?: number;
  maxLength?: number;
  minLength?: number;
  readOnly?: boolean;
  resize?: "none" | "vertical" | "horizontal" | "both";
}

export const TextareaInput = React.forwardRef<HTMLTextAreaElement, TextareaInputProps>(
  ({ 
    label, 
    description, 
    error, 
    required, 
    disabled, 
    className, 
    id,
    value,
    defaultValue,
    placeholder,
    onChange,
    onBlur,
    onFocus,
    rows = 4,
    maxLength,
    minLength,
    readOnly,
    resize = "vertical",
    ...props 
  }, ref) => {
    const inputId = id || React.useId();

    return (
      <div className={cn("space-y-2", className)}>
        {label && (
          <Label htmlFor={inputId} className={cn(error && "text-destructive")}>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <Textarea
          ref={ref}
          id={inputId}
          value={value}
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          rows={rows}
          maxLength={maxLength}
          minLength={minLength}
          className={cn(
            error && "border-destructive focus-visible:ring-destructive",
            resize === "none" && "resize-none",
            resize === "vertical" && "resize-y",
            resize === "horizontal" && "resize-x",
            resize === "both" && "resize"
          )}
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={onBlur}
          onFocus={onFocus}
          {...props}
        />
        {description && !error && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

TextareaInput.displayName = "TextareaInput";

// ============================================================================
// SELECT DROPDOWN COMPONENT
// ============================================================================

export interface SelectInputProps extends BaseInputProps {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  searchable?: boolean;
  clearable?: boolean;
  onClear?: () => void;
}

export const SelectInput = React.forwardRef<HTMLButtonElement, SelectInputProps>(
  ({ 
    label, 
    description, 
    error, 
    required, 
    disabled, 
    className, 
    id,
    value,
    defaultValue,
    placeholder = "Select an option...",
    onChange,
    options,
    searchable = false,
    clearable = false,
    onClear,
    ...props 
  }, ref) => {
    const inputId = id || React.useId();
    const [open, setOpen] = React.useState(false);
    const [searchValue, setSearchValue] = React.useState("");

    const filteredOptions = React.useMemo(() => {
      if (!searchable || !searchValue) return options;
      return options.filter(option =>
        option.label.toLowerCase().includes(searchValue.toLowerCase())
      );
    }, [options, searchValue, searchable]);

    const selectedOption = options.find(option => option.value === value);

    if (searchable) {
      return (
        <div className={cn("space-y-2", className)}>
          {label && (
            <Label htmlFor={inputId} className={cn(error && "text-destructive")}>
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </Label>
          )}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                ref={ref}
                id={inputId}
                variant="outline"
                role="combobox"
                aria-expanded={open}
                disabled={disabled}
                className={cn(
                  "w-full justify-between",
                  !selectedOption && "text-muted-foreground",
                  error && "border-destructive"
                )}
                {...props}
              >
                {selectedOption ? selectedOption.label : placeholder}
                <div className="flex items-center gap-1">
                  {clearable && selectedOption && (
                    <X 
                      className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onClear?.();
                        onChange?.("");
                      }}
                    />
                  )}
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput 
                  placeholder={`Search ${label?.toLowerCase() || 'options'}...`}
                  value={searchValue}
                  onValueChange={setSearchValue}
                />
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup>
                  <CommandList>
                    {filteredOptions.map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        disabled={option.disabled}
                        onSelect={() => {
                          onChange?.(option.value);
                          setOpen(false);
                          setSearchValue("");
                        }}
                        className="flex items-center gap-2"
                      >
                        <Check 
                          className={cn(
                            "h-4 w-4",
                            value === option.value ? "opacity-100" : "opacity-0"
                          )} 
                        />
                        {option.label}
                      </CommandItem>
                    ))}
                  </CommandList>
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
          {description && !error && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
      );
    }

    return (
      <div className={cn("space-y-2", className)}>
        {label && (
          <Label htmlFor={inputId} className={cn(error && "text-destructive")}>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <Select 
          value={value} 
          defaultValue={defaultValue}
          onValueChange={onChange}
          disabled={disabled}
        >
          <SelectTrigger 
            ref={ref}
            id={inputId}
            className={cn(
              error && "border-destructive",
              clearable && selectedOption && "pr-8"
            )}
            {...props}
          >
            <SelectValue placeholder={placeholder} />
            {clearable && selectedOption && (
              <X 
                className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100 absolute right-8" 
                onClick={(e) => {
                  e.stopPropagation();
                  onClear?.();
                  onChange?.("");
                }}
              />
            )}
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem 
                key={option.value} 
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {description && !error && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

SelectInput.displayName = "SelectInput";

// ============================================================================
// DATE PICKER COMPONENT
// ============================================================================

export interface DateInputProps extends BaseInputProps {
  value?: Date;
  defaultValue?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  disabledDays?: (date: Date) => boolean;
  format?: string;
}

export const DateInput = React.forwardRef<HTMLButtonElement, DateInputProps>(
  ({ 
    label, 
    description, 
    error, 
    required, 
    disabled, 
    className, 
    id,
    value,
    defaultValue,
    onChange,
    placeholder = "Pick a date",
    minDate,
    maxDate,
    disabledDays,
    format: dateFormat = "PPP",
    ...props 
  }, ref) => {
    const inputId = id || React.useId();
    const [open, setOpen] = React.useState(false);

    return (
      <div className={cn("space-y-2", className)}>
        {label && (
          <Label htmlFor={inputId} className={cn(error && "text-destructive")}>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              ref={ref}
              id={inputId}
              variant="outline"
              disabled={disabled}
              className={cn(
                "w-full justify-start text-left font-normal",
                !value && "text-muted-foreground",
                error && "border-destructive"
              )}
              {...props}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {value ? format(value, dateFormat) : placeholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value}
              onSelect={(date) => {
                onChange?.(date);
                setOpen(false);
              }}
              defaultMonth={value || defaultValue}
              disabled={(date) => {
                if (disabled) return true;
                if (minDate && date < minDate) return true;
                if (maxDate && date > maxDate) return true;
                if (disabledDays) return disabledDays(date);
                return false;
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {description && !error && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

DateInput.displayName = "DateInput";

// ============================================================================
// CHECKBOX COMPONENT
// ============================================================================

export interface CheckboxInputProps extends BaseInputProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  indeterminate?: boolean;
}

export const CheckboxInput = React.forwardRef<
  React.ElementRef<typeof Checkbox>,
  CheckboxInputProps
>(({ 
  label, 
  description, 
  error, 
  required, 
  disabled, 
  className, 
  id,
  checked,
  defaultChecked,
  onChange,
  indeterminate,
  ...props 
}, ref) => {
  const inputId = id || React.useId();

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center space-x-2">
        <Checkbox
          ref={ref}
          id={inputId}
          checked={indeterminate ? "indeterminate" : checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          onCheckedChange={(checked) => {
            if (typeof checked === "boolean") {
              onChange?.(checked);
            }
          }}
          className={cn(error && "border-destructive")}
          {...props}
        />
        {label && (
          <Label 
            htmlFor={inputId} 
            className={cn(
              "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
              error && "text-destructive"
            )}
          >
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
      </div>
      {description && !error && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
});

CheckboxInput.displayName = "CheckboxInput";

// ============================================================================
// RADIO GROUP COMPONENT
// ============================================================================

export interface RadioInputProps extends BaseInputProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: RadioOption[];
  orientation?: "horizontal" | "vertical";
}

export const RadioInput = React.forwardRef<
  React.ElementRef<typeof RadioGroup>,
  RadioInputProps
>(({ 
  label, 
  description, 
  error, 
  required, 
  disabled, 
  className, 
  id,
  value,
  defaultValue,
  onChange,
  options,
  orientation = "vertical",
  ...props 
}, ref) => {
  const inputId = id || React.useId();

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className={cn(error && "text-destructive")}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <RadioGroup
        ref={ref}
        value={value}
        defaultValue={defaultValue}
        onValueChange={onChange}
        disabled={disabled}
        className={cn(
          orientation === "horizontal" ? "flex flex-row space-x-4" : "grid gap-2"
        )}
        {...props}
      >
        {options.map((option) => (
          <div key={option.value} className="flex items-center space-x-2">
            <RadioGroupItem 
              value={option.value} 
              id={`${inputId}-${option.value}`}
              disabled={option.disabled || disabled}
            />
            <Label 
              htmlFor={`${inputId}-${option.value}`}
              className={cn(
                "text-sm font-normal",
                (option.disabled || disabled) && "opacity-50 cursor-not-allowed"
              )}
            >
              {option.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
      {description && !error && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
});

RadioInput.displayName = "RadioInput";

// ============================================================================
// SWITCH COMPONENT
// ============================================================================

export interface SwitchInputProps extends BaseInputProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
}

export const SwitchInput = React.forwardRef<
  React.ElementRef<typeof Switch>,
  SwitchInputProps
>(({ 
  label, 
  description, 
  error, 
  required, 
  disabled, 
  className, 
  id,
  checked,
  defaultChecked,
  onChange,
  ...props 
}, ref) => {
  const inputId = id || React.useId();

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        {label && (
          <Label 
            htmlFor={inputId} 
            className={cn(
              "text-sm font-medium",
              error && "text-destructive"
            )}
          >
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <Switch
          ref={ref}
          id={inputId}
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          onCheckedChange={onChange}
          {...props}
        />
      </div>
      {description && !error && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
});

SwitchInput.displayName = "SwitchInput";

// ============================================================================
// FILE INPUT COMPONENT
// ============================================================================

export interface FileInputProps extends BaseInputProps {
  accept?: string;
  multiple?: boolean;
  onChange?: (files: FileList | null) => void;
  maxSize?: number; // in bytes
  allowedTypes?: string[];
  placeholder?: string;
  showPreview?: boolean;
}

export const FileInput = React.forwardRef<HTMLInputElement, FileInputProps>(
  ({ 
    label, 
    description, 
    error, 
    required, 
    disabled, 
    className, 
    id,
    accept,
    multiple = false,
    onChange,
    maxSize,
    allowedTypes,
    placeholder = "Choose files or drag and drop",
    showPreview = false,
    ...props 
  }, ref) => {
    const inputId = id || React.useId();
    const [isDragOver, setIsDragOver] = React.useState(false);
    const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
    const [fileError, setFileError] = React.useState<string>("");

    const validateFiles = (files: FileList) => {
      const fileArray = Array.from(files);
      
      for (const file of fileArray) {
        // Check file size
        if (maxSize && file.size > maxSize) {
          return `File "${file.name}" is too large. Maximum size is ${(maxSize / 1024 / 1024).toFixed(1)}MB`;
        }
        
        // Check file type
        if (allowedTypes && !allowedTypes.includes(file.type)) {
          return `File "${file.name}" has an unsupported format. Allowed types: ${allowedTypes.join(", ")}`;
        }
      }
      
      return null;
    };

    const handleFileChange = (files: FileList | null) => {
      setFileError("");
      
      if (!files) {
        setSelectedFiles([]);
        onChange?.(null);
        return;
      }

      const validationError = validateFiles(files);
      if (validationError) {
        setFileError(validationError);
        return;
      }

      setSelectedFiles(Array.from(files));
      onChange?.(files);
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      
      const files = e.dataTransfer.files;
      handleFileChange(files);
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
    };

    const removeFile = (index: number) => {
      const newFiles = selectedFiles.filter((_, i) => i !== index);
      setSelectedFiles(newFiles);
      
      // Create a new FileList-like object
      const dt = new DataTransfer();
      newFiles.forEach(file => dt.items.add(file));
      onChange?.(dt.files);
    };

    return (
      <div className={cn("space-y-2", className)}>
        {label && (
          <Label htmlFor={inputId} className={cn((error || fileError) && "text-destructive")}>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        
        <div
          className={cn(
            "relative border-2 border-dashed rounded-lg p-6 transition-colors",
            isDragOver ? "border-primary bg-primary/5" : "border-border",
            (error || fileError) && "border-destructive",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            ref={ref}
            id={inputId}
            type="file"
            accept={accept}
            multiple={multiple}
            disabled={disabled}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            onChange={(e) => handleFileChange(e.target.files)}
            {...props}
          />
          
          <div className="text-center">
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-1">{placeholder}</p>
            <p className="text-xs text-muted-foreground">
              {accept && `Accepted formats: ${accept}`}
              {maxSize && ` • Max size: ${(maxSize / 1024 / 1024).toFixed(1)}MB`}
            </p>
          </div>
        </div>

        {/* File Preview */}
        {showPreview && selectedFiles.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Selected Files:</Label>
            <div className="space-y-1">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                  <div className="flex items-center space-x-2">
                    <div className="text-sm">
                      <p className="font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {description && !error && !fileError && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        {(error || fileError) && (
          <p className="text-sm text-destructive">{error || fileError}</p>
        )}
      </div>
    );
  }
);

FileInput.displayName = "FileInput";

// ============================================================================
// SEARCH INPUT COMPONENT
// ============================================================================

export interface SearchInputProps extends BaseInputProps {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  onClear?: () => void;
  showSearchIcon?: boolean;
  showClearButton?: boolean;
  debounceMs?: number;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ 
    label, 
    description, 
    error, 
    required, 
    disabled, 
    className, 
    id,
    value,
    defaultValue,
    placeholder = "Search...",
    onChange,
    onSearch,
    onClear,
    showSearchIcon = true,
    showClearButton = true,
    debounceMs = 300,
    ...props 
  }, ref) => {
    const inputId = id || React.useId();
    const [internalValue, setInternalValue] = React.useState(value || defaultValue || "");
    const debounceTimeoutRef = React.useRef<NodeJS.Timeout>();

    const debouncedSearch = React.useCallback((searchValue: string) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      debounceTimeoutRef.current = setTimeout(() => {
        onSearch?.(searchValue);
      }, debounceMs);
    }, [onSearch, debounceMs]);

    const handleChange = (newValue: string) => {
      setInternalValue(newValue);
      onChange?.(newValue);
      debouncedSearch(newValue);
    };

    const handleClear = () => {
      setInternalValue("");
      onChange?.("");
      onClear?.();
      onSearch?.("");
    };

    React.useEffect(() => {
      if (value !== undefined) {
        setInternalValue(value);
      }
    }, [value]);

    React.useEffect(() => {
      return () => {
        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current);
        }
      };
    }, []);

    return (
      <div className={cn("space-y-2", className)}>
        {label && (
          <Label htmlFor={inputId} className={cn(error && "text-destructive")}>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        
        <div className="relative">
          {showSearchIcon && (
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          )}
          
          <Input
            ref={ref}
            id={inputId}
            type="text"
            value={internalValue}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              showSearchIcon && "pl-9",
              showClearButton && internalValue && "pr-9",
              error && "border-destructive focus-visible:ring-destructive"
            )}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSearch?.(internalValue);
              }
            }}
            {...props}
          />
          
          {showClearButton && internalValue && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
              onClick={handleClear}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {description && !error && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";

// All components and types are already exported above