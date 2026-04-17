import { useState } from "react";
import { Link } from "wouter";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const forgotSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  domain: z.string().trim().min(1, "Domain is required"),
});
type ForgotValues = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const [done, setDone] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "", domain: "" },
  });

  const onSubmit = async (values: ForgotValues) => {
    try {
      const res = await fetch("/api/v2/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        form.setError("root", { message: data?.message || "Request failed." });
        return;
      }
      setDone(true);
      if (data?.devResetToken) setDevToken(data.devResetToken);
    } catch (err: any) {
      form.setError("root", { message: err?.message || "Network error." });
    }
  };

  const submitting = form.formState.isSubmitting;
  const rootError = form.formState.errors.root?.message;
  const domain = form.getValues("domain");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4" data-testid="page-forgot-password">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8 border border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Forgot password</h1>
        <p className="text-sm text-gray-500 mb-6">
          Enter your email and domain. If a matching account exists, we'll send you a reset link.
        </p>

        {rootError && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{rootError}</span>
          </div>
        )}

        {done ? (
          <div className="space-y-4" data-testid="status-forgot-success">
            <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>If an account exists, a reset link has been sent.</span>
            </div>
            {devToken && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" data-testid="text-dev-reset-token">
                <div className="font-semibold">Dev reset token:</div>
                <code className="break-all">{devToken}</code>
                <div className="mt-2">
                  <Link
                    href={`/reset-password?token=${encodeURIComponent(devToken)}&domain=${encodeURIComponent(domain)}`}
                    className="text-[#16569e] hover:underline"
                  >
                    Continue to reset →
                  </Link>
                </div>
              </div>
            )}
            <Link href="/login" className="block text-center text-sm text-[#16569e] hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" disabled={submitting} data-testid="input-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="domain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Domain</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={submitting} data-testid="input-domain" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#16569e] hover:bg-[#11487e] text-white"
                data-testid="button-submit-forgot"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {submitting ? "Sending…" : "Send reset link"}
              </Button>
              <div className="text-center text-sm">
                <Link href="/login" className="text-[#16569e] hover:underline">Back to sign in</Link>
              </div>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}
