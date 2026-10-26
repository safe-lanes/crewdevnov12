import { AlertCircle } from "lucide-react";

export function CompanyFormProblems({ message, testId }: { message: string; testId?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="mx-6 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-start gap-2" data-testid={testId}>
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-medium">Please review the following:</p>
        <ul className="list-disc pl-5 space-y-1">
          {message.split("\n").filter(Boolean).map((problem, index) => <li key={index} className="break-words">{problem}</li>)}
        </ul>
      </div>
    </div>
  );
}
