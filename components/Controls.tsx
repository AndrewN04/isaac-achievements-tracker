"use client";

import { useId, useRef } from "react";
import type { JSX } from "react";

type StatusFilter = "all" | "completed" | "uncompleted";

export default function Controls(props: {
  search: string;
  onSearchChange: (v: string) => void;
  onClearSearch: () => void; // immediate clear
  statusFilter: StatusFilter;
  onStatusChange: (v: StatusFilter) => void;
  onMarkFiltered: (value: boolean) => void;
  onClearAll: () => void;
  counts: { completed: number; total: number; visible: number };
}): JSX.Element {
  const searchId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const clearSearch = () => {
    props.onClearSearch();
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex-1 max-w-xl relative">
          <label htmlFor={searchId} className="sr-only">
            Search achievements
          </label>
          <input
            ref={inputRef}
            id={searchId}
            aria-label="Search achievements by name or ID"
            className="input pr-10"
            placeholder="Search by name or ID..."
            value={props.search}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") props.onClearSearch();
              else props.onSearchChange(v);
            }}
            autoComplete="off"
          />
          {props.search && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 -mt-[10px] inline-flex h-6 w-6 items-center justify-center rounded-md leading-none text-muted hover:text-text bg-transparent hover:bg-transparent active:bg-transparent focus:outline-none focus:ring-0 select-none"
            >
              ×
            </button>
          )}
          <p className="text-xs text-muted mt-1">
            Name contains; ID matches from the left (prefix). Results update
            as you type.
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