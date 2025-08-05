/**
 * Standard page layout component
 */

import React from "react";
import { Header } from "./Header";
import { cn } from "@/lib/utils";

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
  showHeader?: boolean;
}

export function PageLayout({ children, className, showHeader = true }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {showHeader && <Header />}
      <main className={cn("flex-1", className)}>
        {children}
      </main>
    </div>
  );
}