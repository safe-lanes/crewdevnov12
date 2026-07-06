/**
 * Accounts module — temporarily under construction.
 *
 * The Accounts domain schema is being rebuilt around an append-only crew wage
 * ledger. The previous wage-accounts UI was coupled to the old (dropped) schema
 * and has been removed. The route and its RBAC wiring are intentionally kept so
 * the new UI can be reintroduced without re-wiring navigation.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench } from "lucide-react";

export function AccountsModule() {
  return (
    <div
      className="flex items-center justify-center w-full min-h-[calc(100vh-67px)] bg-[#f8fafc] px-6 py-10"
      data-testid="accounts-under-construction"
    >
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#16569e]/10">
            <Wrench className="h-6 w-6 text-[#16569e]" />
          </div>
          <CardTitle data-testid="text-accounts-title">
            Accounts — under construction
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className="text-sm text-muted-foreground"
            data-testid="text-accounts-message"
          >
            The Accounts module is being rebuilt around a new crew wage ledger.
            This section will return shortly.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
