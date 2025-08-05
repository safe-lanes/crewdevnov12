/**
 * Reusable textarea field component with React Hook Form integration
 */

import React, { forwardRef } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Control, FieldPath, FieldValues } from "react-hook-form";
import { cn } from "@/lib/utils";

interface TextAreaFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  description?: string;
  rows?: number;
  maxLength?: number;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps<any>>(
  ({ 
    control, 
    name, 
    label, 
    placeholder, 
    disabled, 
    required, 
    className, 
    description, 
    rows = 3,
    maxLength 
  }, ref) => {
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
              <Textarea
                {...field}
                ref={ref}
                placeholder={placeholder}
                disabled={disabled}
                rows={rows}
                maxLength={maxLength}
                className="w-full resize-none"
              />
            </FormControl>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
            {maxLength && (
              <p className="text-xs text-muted-foreground text-right">
                {field.value?.length || 0}/{maxLength}
              </p>
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }
);

TextAreaField.displayName = "TextAreaField";