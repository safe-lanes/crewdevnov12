/**
 * Reusable date input field component with React Hook Form integration
 */

import React from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Control, FieldPath, FieldValues } from "react-hook-form";
import { cn } from "@/lib/utils";

interface DateFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  description?: string;
  min?: string;
  max?: string;
}

export function DateField<T extends FieldValues>({
  control,
  name,
  label,
  disabled,
  required,
  className,
  description,
  min,
  max,
}: DateFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel className={cn(required && "after:content-['*'] after:text-red-500 after:ml-1")}>
            {label}
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              type="date"
              disabled={disabled}
              min={min}
              max={max}
              className="w-full"
            />
          </FormControl>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}