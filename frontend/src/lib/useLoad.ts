import { useCallback, useEffect, useState } from "react";

/** Loads data with `load` (wrap it in useCallback) and reloads on demand. */
export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setError("");
    try {
      setData(await load());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося завантажити дані");
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  return { data, setData, loading, error, reload };
}
