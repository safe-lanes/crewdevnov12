import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function passwordStrength(p: string): { score: number; label: string } {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  const label = ["Very weak", "Weak", "Fair", "Good", "Strong", "Very strong"][s] || "Very weak";
  return { score: s, label };
}

const resetSchema = z
  .object({
    token: z.string().trim().min(1, "Reset token is required"),
    domain: z.string().trim().min(1, "Domain is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });
type ResetValues = z.infer<typeof resetSchema>;

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const [done, setDone] = useState(false);

  const form = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      token: params.get("token") || "",
      domain: params.get("domain") || "",
      newPassword: "",
      confirm: "",
    },
  });
  const newPassword = form.watch("newPassword");
  const strength = useMemo(() => passwordStrength(newPassword), [newPassword]);

  const onSubmit = async (values: ResetValues) => {
    try {
      const res = await fetch("/api/v2/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: values.token,
          domain: values.domain,
          newPassword: values.newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        form.setError("root", { message: data?.message || "Reset failed." });
        return;
      }
      setDone(true);
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      form.setError("root", { message: (err instanceof Error ? err.message : null) || "Network error." });
    }
  };

  const submitting = form.formState.isSubmitting;
  const rootError = form.formState.errors.root?.message;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4" data-testid="page-reset-password">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8 border border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Set a new password</h1>

        {rootError && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{rootError}</span>
          </div>
        )}

        {done ? (
          <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800" data-testid="status-reset-success">
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>Password updated. Redirecting to sign in…</span>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="token"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reset token</FormLabel>
                    <FormControl>
                      <Input {...field} className="font-mono" disabled={submitting} data-testid="input-token" />
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
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" disabled={submitting} data-testid="input-new-password" />
                    </FormControl>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-gray-200">
                      <div
                        className={`h-full transition-all ${
                          strength.score >= 4 ? "bg-green-500" : strength.score >= 3 ? "bg-yellow-500" : "bg-red-500"
                        }`}
                        style={{ width: `${(strength.score / 5) * 100}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-600" data-testid="text-password-strength">
                      Strength: {strength.label}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm new password</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" disabled={submitting} data-testid="input-confirm-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#16569e] hover:bg-[#11487e] text-white"
                data-testid="button-submit-reset"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {submitting ? "Resetting…" : "Reset password"}
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
