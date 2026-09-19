import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

interface AsyncOnFocusResult {
  loading: boolean;
  error: string;
  retry: () => void;
}

/**
 * Runs `task` every time the screen gains focus, tracking loading/error
 * state around it. `task` owns whatever setState calls it needs for the
 * data it fetches (a screen may load more than one thing into more than one
 * state variable) — this hook only centralizes the loading/error/retry/
 * useFocusEffect wiring that was previously hand-copied, with small
 * variations (some screens silently swallowed errors, some didn't), into
 * every screen.
 */
export function useAsyncOnFocus(task: () => Promise<void>, deps: React.DependencyList): AsyncOnFocusResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await task();
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, deps);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return { loading, error, retry: load };
}
