import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { logout } from "@/lib/authToken";

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

const changeSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: "New passwords do not match",
    path: ["confirm"],
  });
type ChangeValues = z.infer<typeof changeSchema>;

export default function ChangePasswordPage() {
  const [, navigate] = useLocation();
  const [done, setDone] = useState(false);
  const form = useForm<ChangeValues>({
    resolver: zodResolver(changeSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });
  const newPassword = form.watch("newPassword");
  const strength = useMemo(() => passwordStrength(newPassword), [newPassword]);

  const onSubmit = async (values: ChangeValues) => {
    try {
      await apiRequest("POST", "/api/v2/auth/change-password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      setDone(true);
      setTimeout(() => logout(), 1500);
    } catch (err) {
      form.setError("root", { message: (err instanceof Error ? err.message : null) || "Failed to change password." });
    }
  };

  const submitting = form.formState.isSubmitting;
  const rootError = form.formState.errors.root?.message;

  return (
    <div className="max-w-md mx-auto p-6" data-testid="page-change-password">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Change password</h1>
      <p className="text-sm text-gray-500 mb-6">After changing, you'll be signed out and must sign in again.</p>

      {rootError && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{rootError}</span>
        </div>
      )}

      {done ? (
        <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800" data-testid="status-change-success">
          <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>Password updated. Signing you out…</span>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 bg-white p-6 rounded-lg shadow border border-gray-200">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current password</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" disabled={submitting} data-testid="input-current-password" />
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
                  <p className="mt-1 text-xs text-gray-600">Strength: {strength.label}</p>
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
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/")}
                className="flex-1"
                data-testid="button-cancel-change"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-[#16569e] hover:bg-[#11487e] text-white"
                data-testid="button-submit-change"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {submitting ? "Saving…" : "Change password"}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}
