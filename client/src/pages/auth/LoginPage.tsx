import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Loader2, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { setAuthSession, getAuthToken } from "@/lib/authToken";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  domain: z.string().trim().min(1, "Domain is required"),
});
type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, navigate] = useLocation();
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "", domain: "" },
  });

  useEffect(() => {
    if (getAuthToken()) navigate("/");
  }, [navigate]);

  const onSubmit = async (values: LoginValues) => {
    try {
      const res = await fetch("/api/v2/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        form.setError("root", { message: data?.message || "Sign in failed." });
        return;
      }
      setAuthSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tenantId: data.tenantId ?? null,
        domain: data.user.domain || values.domain,
        user: data.user,
      });
      const params = new URLSearchParams(window.location.search);
      const rawNext = params.get("next") || "/";
      const safeNext = /^\/(?!\/)/.test(rawNext) ? rawNext : "/";
      window.location.href = safeNext;
    } catch (err: any) {
      form.setError("root", { message: err?.message || "Network error." });
    }
  };

  const submitting = form.formState.isSubmitting;
  const rootError = form.formState.errors.root?.message;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4" data-testid="page-login">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8 border border-gray-200">
        <div className="flex flex-col items-center mb-6">
          <img src="/figmaAssets/group-2.png" alt="Logo" className="w-14 h-10 mb-2" />
          <h1 className="text-xl font-semibold text-gray-900">Sign in to Crewing</h1>
          <p className="text-sm text-gray-500 mt-1">Enter your credentials to continue</p>
        </div>

        {rootError && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" data-testid="text-login-error">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{rootError}</span>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username or Crew ID</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="username" disabled={submitting} data-testid="input-username" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" autoComplete="current-password" disabled={submitting} data-testid="input-password" />
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
                    <Input {...field} autoComplete="organization" disabled={submitting} data-testid="input-domain" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#16569e] hover:bg-[#11487e] text-white"
              data-testid="button-submit-login"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Form>

        <div className="mt-4 text-center text-sm">
          <Link href="/forgot-password" className="text-[#16569e] hover:underline" data-testid="link-forgot-password">
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  );
}
