"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface FormPopupProps {
  children: React.ReactNode
  className?: string
  onClose?: () => void
  title?: string
  isOpen?: boolean
}

/**
 * StandardFormPopup - A reusable component for consistent form popup spacing
 * 
 * Features:
 * - Equal spacing on all sides (1rem padding)
 * - Consistent modal height calculation
 * - Responsive design
 * - Standard close button behavior
 * 
 * Usage:
 * <StandardFormPopup title="Form Title" onClose={handleClose}>
 *   <FormContent />
 * </StandardFormPopup>
 */
export const StandardFormPopup = React.forwardRef<
  HTMLDivElement,
  FormPopupProps
>(({ className, children, onClose, title, isOpen = true, ...props }, ref) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
      <div
        ref={ref}
        className={cn(
          "bg-white rounded-lg shadow-lg w-full h-[calc(100vh-2rem)] flex flex-col overflow-hidden",
          className
        )}
        {...props}
      >
        {title && (
          <div className="sticky top-0 bg-white border-b p-3 sm:p-4 flex items-center justify-between">
            <h1 className="text-lg sm:text-xl font-bold">{title}</h1>
            {onClose && (
              <button
                onClick={onClose}
                className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  )
})
StandardFormPopup.displayName = "StandardFormPopup"

/**
 * FormPopupOverlay - A standalone overlay component for custom implementations
 */
const FormPopupOverlay = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4",
      className
    )}
    {...props}
  />
))
FormPopupOverlay.displayName = "FormPopupOverlay"

/**
 * FormPopupContent - A content wrapper with consistent spacing
 */
const FormPopupContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "bg-white rounded-lg shadow-lg w-full h-[calc(100vh-2rem)] flex flex-col overflow-hidden",
      className
    )}
    {...props}
  />
))
FormPopupContent.displayName = "FormPopupContent"

export {
  StandardFormPopup as FormPopup,
  FormPopupOverlay,
  FormPopupContent,
}