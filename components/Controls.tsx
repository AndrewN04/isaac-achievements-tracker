"use client";

import { useId } from "react";
import type { JSX } from "react";


type StatusFilter = "all" | "completed" | "uncompleted";

export default function Controls(props: {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: StatusFilter;
  onStatusChange: (v: StatusFilter) => void;
  onMarkFiltered: (value: boolean) => void;
  onClearAll: () => void;
  counts: { completed: number; total: number; visible: number };
}): JSX.Element {
  const searchId = useId();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex-1 max-w-xl">
          <label htmlFor={searchId} className="sr-only">
            Search achievements
          </label>
          <input
            id={searchId}
            aria-label="Search achievements by name or ID"
            className="input"
            placeholder="Search by name or ID..."
            value={props.search}
            onChange={(e) => props.onSearchChange(e.target.value)}
            autoComplete="off"
          />
          <p className="text-xs text-muted mt-1">
            Partial match across name or ID. Results update as you type.
          </p>
        </div>

        <div className="flex-shrink-0">
          <div
            role="tablist"
            aria-label="Status filter"
            className="segmented"
          >
            {(
              [
                ["all", "All"],
                ["completed", "Completed"],
                ["uncompleted", "Uncompleted"]
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={props.statusFilter === key}
                className="segmented-btn"
                onClick={() =>
                  props.onStatusChange(key as StatusFilter)
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="btn btn-primary"
            onClick={() => props.onMarkFiltered(true)}
            aria-label="Mark all currently filtered results as completed"
          >
            Mark filtered as completed
          </button>
          <button
            className="btn"
            onClick={() => props.onMarkFiltered(false)}
            aria-label="Unmark completion for all currently filtered results"
          >
            Unmark filtered
          </button>
          <button
            className="btn btn-danger"
            onClick={props.onClearAll}
            aria-label="Clear all saved completion state"
          >
            Clear all
          </button>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted">
            Completed{" "}
            <span className="text-text font-semibold">
              {props.counts.completed}
            </span>{" "}
            of{" "}
            <span className="text-text font-semibold">
              {props.counts.total}
            </span>
          </span>
          <span className="text-muted">
            Visible:{" "}
            <span className="text-text font-semibold">
              {props.counts.visible}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}