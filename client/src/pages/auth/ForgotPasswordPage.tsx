import { useState } from "react";
import { Link } from "wouter";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [domain, setDomain] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/v2/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), domain: domain.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Request failed.");
        setSubmitting(false);
        return;
      }
      setDone(true);
      if (data?.devResetToken) setDevToken(data.devResetToken);
    } catch (err: any) {
      setError(err?.message || "Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4" data-testid="page-forgot-password">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8 border border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Forgot password</h1>
        <p className="text-sm text-gray-500 mb-6">
          Enter your email and domain. If a matching account exists, we'll send you a reset link.
        </p>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
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
                    href={`/reset-password?token=${encodeURIComponent(devToken)}&domain=${encodeURIComponent(domain.trim())}`}
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
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                data-testid="input-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16569e]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
              <input
                data-testid="input-domain"
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16569e]"
              />
            </div>
            <button
              type="submit"
              data-testid="button-submit-forgot"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[#16569e] px-4 py-2 text-sm font-medium text-white hover:bg-[#11487e] disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Sending…" : "Send reset link"}
            </button>
            <div className="text-center text-sm">
              <Link href="/login" className="text-[#16569e] hover:underline">Back to sign in</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
