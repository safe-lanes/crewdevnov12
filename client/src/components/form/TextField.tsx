/**
 * Reusable text input field component with React Hook Form integration
 */

import React, { forwardRef } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Control, FieldPath, FieldValues } from "react-hook-form";
import { cn } from "@/lib/utils";

interface TextFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  type?: "text" | "email" | "password" | "number" | "tel" | "url";
  className?: string;
  description?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps<any>>(
  ({ control, name, label, placeholder, disabled, required, type = "text", className, description }, ref) => {
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
                ref={ref}
                type={type}
                placeholder={placeholder}
                disabled={disabled}
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
);

TextField.displayName = "TextField";