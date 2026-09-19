import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Page } from "../api/pagination";

interface PaginatedListResult<T> {
  items: T[];
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
  loading: boolean;
  loadingMore: boolean;
  error: string;
  retry: () => void;
  loadMore: () => void;
  hasMore: boolean;
}

/**
 * Loads page 1 on every focus (same as useAsyncOnFocus), and exposes
 * loadMore() for a FlatList's onEndReached to fetch subsequent pages and
 * append them. `fetchPage` is called with (limit, offset) each time.
 */
export function usePaginatedList<T>(
  fetchPage: (limit: number, offset: number) => Promise<Page<T>>,
  deps: React.DependencyList,
  pageSize = 20,
): PaginatedListResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const itemsRef = useRef<T[]>([]);
  itemsRef.current = items;
  const fetchingMore = useRef(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const page = await fetchPage(pageSize, 0);
      setItems(page.items);
      setHasMore(page.hasMore);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, deps);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const loadMore = useCallback(() => {
    if (fetchingMore.current || loading || !hasMore) return;
    fetchingMore.current = true;
    setLoadingMore(true);
    fetchPage(pageSize, itemsRef.current.length)
      .then((page) => {
        setItems((prev) => [...prev, ...page.items]);
        setHasMore(page.hasMore);
      })
      .catch(() => {
        // best-effort — existing items stay visible, pull-to-refresh retries from page 1
      })
      .finally(() => {
        setLoadingMore(false);
        fetchingMore.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPage, hasMore, loading, pageSize]);

  return { items, setItems, loading, loadingMore, error, retry: load, loadMore, hasMore };
}
