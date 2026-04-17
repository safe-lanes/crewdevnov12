import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Loader2, AlertCircle } from "lucide-react";
import { setAuthSession, getAuthToken } from "@/lib/authToken";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [domain, setDomain] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getAuthToken()) {
      navigate("/");
    }
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password || !domain.trim()) {
      setError("All fields are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/v2/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password, domain: domain.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Sign in failed.");
        setSubmitting(false);
        return;
      }
      setAuthSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tenantId: data.tenantId ?? null,
        domain: data.user.domain || domain.trim(),
        user: data.user,
      });
      const params = new URLSearchParams(window.location.search);
      const rawNext = params.get("next") || "/";
      // Only allow same-origin relative paths; reject absolute / protocol-relative URLs
      const safeNext = /^\/(?!\/)/.test(rawNext) ? rawNext : "/";
      window.location.href = safeNext;
    } catch (err: any) {
      setError(err?.message || "Network error.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4" data-testid="page-login">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8 border border-gray-200">
        <div className="flex flex-col items-center mb-6">
          <img src="/figmaAssets/group-2.png" alt="Logo" className="w-14 h-10 mb-2" />
          <h1 className="text-xl font-semibold text-gray-900">Sign in to Crewing</h1>
          <p className="text-sm text-gray-500 mt-1">Enter your credentials to continue</p>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" data-testid="text-login-error">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="login-username">
              Username or Crew ID
            </label>
            <input
              id="login-username"
              data-testid="input-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16569e]"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              data-testid="input-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16569e]"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="login-domain">
              Domain
            </label>
            <input
              id="login-domain"
              data-testid="input-domain"
              type="text"
              autoComplete="organization"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16569e]"
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            data-testid="button-submit-login"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[#16569e] px-4 py-2 text-sm font-medium text-white hover:bg-[#11487e] disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          <Link href="/forgot-password" className="text-[#16569e] hover:underline" data-testid="link-forgot-password">
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  );
}
