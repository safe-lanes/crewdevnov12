/**
 * Application header component
 */

import React from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Settings, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const [location] = useLocation();

  const navigation = [
    {
      name: "Crew Management",
      href: "/",
      icon: Users,
      current: location === "/" || location.startsWith("/crew"),
    },
    {
      name: "Administration",
      href: "/admin",
      icon: Settings,
      current: location.startsWith("/admin"),
    },
  ];

  return (
    <header className={cn("border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60", className)}>
      <div className="container mx-auto px-4">
        <Card className="border-0 shadow-none">
          <CardContent className="flex items-center justify-between py-4 px-0">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Home className="h-4 w-4" />
                </div>
                <span className="font-bold text-xl">Seafarer Performance</span>
              </Link>
            </div>

            <nav className="flex items-center space-x-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.name}
                    asChild
                    variant={item.current ? "default" : "ghost"}
                  >
                    <Link href={item.href}>
                      <Icon className="h-4 w-4 mr-2" />
                      {item.name}
                    </Link>
                  </Button>
                );
              })}
            </nav>
          </CardContent>
        </Card>
      </div>
    </header>
  );
}