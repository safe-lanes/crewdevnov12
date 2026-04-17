import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

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

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const initialToken = params.get("token") || "";
  const initialDomain = params.get("domain") || "";

  const [token, setToken] = useState(initialToken);
  const [domain, setDomain] = useState(initialDomain);
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const strength = useMemo(() => passwordStrength(newPassword), [newPassword]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/v2/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), domain: domain.trim(), newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Reset failed.");
        setSubmitting(false);
        return;
      }
      setDone(true);
      setTimeout(() => navigate("/login"), 1500);
    } catch (err: any) {
      setError(err?.message || "Network error.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4" data-testid="page-reset-password">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8 border border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Set a new password</h1>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {done ? (
          <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800" data-testid="status-reset-success">
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>Password updated. Redirecting to sign in…</span>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reset token</label>
              <input
                data-testid="input-token"
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#16569e]"
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <input
                data-testid="input-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16569e]"
              />
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
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
              <input
                data-testid="input-confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16569e]"
              />
            </div>
            <button
              type="submit"
              data-testid="button-submit-reset"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[#16569e] px-4 py-2 text-sm font-medium text-white hover:bg-[#11487e] disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Resetting…" : "Reset password"}
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
