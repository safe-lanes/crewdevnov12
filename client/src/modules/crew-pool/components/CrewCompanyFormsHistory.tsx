import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CompanySubmissionRenderer } from "@/components/configured-form/companySubmissionContract";
import { CrewCompanyFormsHome } from "./CrewCompanyFormsHome";

type Props = Omit<Parameters<typeof CrewCompanyFormsHome>[0], "onOpenSubmission">;

/** The profile is a home for saved declarations, never a creation entry point. */
export function CrewCompanyFormsHistory(props: Props) {
  const [active, setActive] = useState<string | null>(null);
  const client = useQueryClient();
  const close = () => {
    setActive(null);
    void client.invalidateQueries({ queryKey: ["crew-company-forms-home", props.crewUuid] });
  };
  return <>
    <CrewCompanyFormsHome {...props} onOpenSubmission={setActive} />
    <Dialog open={active !== null} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" data-testid="crew-company-form-viewer">
        <DialogHeader>
          <DialogTitle>Company Form history</DialogTitle>
          <DialogDescription>Saved declaration, pinned version and recorded signing information.</DialogDescription>
        </DialogHeader>
        {active && <CompanySubmissionRenderer key={active} submissionUuid={active} onBack={close} showSubmissionMetadata />}
        <Button type="button" variant="outline" onClick={close} data-testid="button-close-crew-company-form">
          Back to Company Forms
        </Button>
      </DialogContent>
    </Dialog>
  </>;
}