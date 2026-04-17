import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
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

export default function ChangePasswordPage() {
  const [, navigate] = useLocation();
  const [currentPassword, setCurrentPassword] = useState("");
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
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/v2/auth/change-password", { currentPassword, newPassword });
      setDone(true);
      // Refresh tokens were revoked server-side; sign user out shortly.
      setTimeout(() => logout(), 1500);
    } catch (err: any) {
      setError(err?.message || "Failed to change password.");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6" data-testid="page-change-password">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Change password</h1>
      <p className="text-sm text-gray-500 mb-6">After changing, you'll be signed out and must sign in again.</p>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {done ? (
        <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800" data-testid="status-change-success">
          <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>Password updated. Signing you out…</span>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow border border-gray-200">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
            <input
              data-testid="input-current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
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
            <p className="mt-1 text-xs text-gray-600">Strength: {strength.label}</p>
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
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              data-testid="button-cancel-change"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="button-submit-change"
              disabled={submitting}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-[#16569e] px-4 py-2 text-sm font-medium text-white hover:bg-[#11487e] disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Saving…" : "Change password"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
