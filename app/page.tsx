"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Controls from "@/components/Controls";
import AchievementsTable from "@/components/AchievementsTable";
import type { JSX } from "react";

type Achievement = {
  id: number;
  name: string;
  unlockHtml: string;
  url?: string;
};

type ApiResponse = {
  achievements: Achievement[];
  count: number;
  source: string;
  lastFetched: string;
};

type StatusFilter = "all" | "completed" | "uncompleted";
type SortMode = "initial" | "asc" | "desc";

const STORAGE_KEY = "isaac_achievements_completed_v1";

export default function Page(): JSX.Element {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");
  const [idSort, setIdSort] = useState<SortMode>("initial");

  // completed map: only true entries are kept for tidiness
  const [completed, setCompleted] = useState<
    Record<number, boolean>
  >({});

  // Load completion state from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<number, boolean>;
        setCompleted(parsed || {});
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // Persist completion state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
    } catch {
      // ignore quota errors
    }
  }, [completed]);

  // Fetch achievements from API
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/achievements", {
          headers: { Accept: "application/json" }
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(
            `Failed to load achievements (${res.status}): ${txt}`
          );
        }
        const data = (await res.json()) as ApiResponse;
        if (!cancelled) {
          setAchievements(data.achievements);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error
              ? err.message
              : typeof err === "string"
              ? err
              : "Failed to load achievements.";
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Derived counts
  const totalCount = achievements.length;
  const completedCount = useMemo(
    () =>
      achievements.reduce(
        (acc, a) => acc + (completed[a.id] ? 1 : 0),
        0
      ),
    [achievements, completed]
  );

  // Prepare list with original order index and apply search/filter/sort
  const filtered = useMemo(() => {
    const withOrder = achievements.map((a, i) => ({
      ...a,
      __order: i
    }));

    const q = search.trim().toLowerCase();
    const isDigitsOnly = /^\d+$/.test(q);

    let list = withOrder;
    if (q) {
      list = list.filter((a) => {
        const nameMatch = a.name.toLowerCase().includes(q);
        // For ID search, match only as a prefix (left-most digits)
        const idMatch = isDigitsOnly
          ? a.id.toString().startsWith(q)
          : false;
        return nameMatch || idMatch;
      });
    }

    if (statusFilter === "completed") {
      list = list.filter((a) => !!completed[a.id]);
    } else if (statusFilter === "uncompleted") {
      list = list.filter((a) => !completed[a.id]);
    }

    const sorted = list.slice();
    if (idSort === "asc") {
      sorted.sort((a, b) => a.id - b.id);
    } else if (idSort === "desc") {
      sorted.sort((a, b) => b.id - a.id);
    } else {
      sorted.sort((a, b) => a.__order - b.__order);
    }

    return sorted as Achievement[];
  }, [achievements, completed, search, statusFilter, idSort]);

  const toggleIdSort = () => {
    setIdSort((prev) =>
      prev === "initial" ? "asc" : prev === "asc" ? "desc" : "initial"
    );
  };

  // Stable, minimal handler to avoid any checkbox lag
  const toggleCompleted = useCallback((id: number) => {
    setCompleted((prev) => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = true;
      }
      return next;
    });
  }, []);

  const markFiltered = (value: boolean) => {
    setCompleted((prev) => {
      const next = { ...prev };
      for (const a of filtered) {
        if (value) {
          next[a.id] = true;
        } else {
          delete next[a.id];
        }
      }
      return next;
    });
  };

  const clearAll = () => {
    if (
      window.confirm(
        "Clear all completion data from this browser? This cannot be undone."
      )
    ) {
      setCompleted({});
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  };

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold">
          Isaac Achievements Tracker
        </h1>
        <p className="text-muted mt-2">
          A fast, offline-friendly checklist for The Binding of Isaac
          achievements. Data is loaded from the official wiki and your
          progress is saved locally in your browser.
        </p>
      </header>

      <section className="mb-4">
        <Controls
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          onMarkFiltered={markFiltered}
          onClearAll={clearAll}
          counts={{
            completed: completedCount,
            total: totalCount,
            visible: filtered.length
          }}
        />
      </section>

      <section className="card">
        {loading ? (
          <div className="p-6 text-muted">Loading achievements…</div>
        ) : error ? (
          <div className="p-6 text-red-300">
            {error}
            <div className="text-muted mt-2 text-sm">
              Try reloading the page. If the issue persists, the wiki
              layout may have changed.
            </div>
          </div>
        ) : (
          <div role="region" aria-label="Achievements table" className="p-2">
            <AchievementsTable
              achievements={filtered}
              completed={completed}
              onToggle={toggleCompleted}
              sortMode={idSort}
              onToggleIdSort={toggleIdSort}
            />
          </div>
        )}
      </section>

      <footer className="mt-8 text-center text-xs text-muted">
        Completed {completedCount} of {totalCount}. Currently showing{" "}
        {filtered.length} result{filtered.length === 1 ? "" : "s"}.
      </footer>
    </main>
  );
}