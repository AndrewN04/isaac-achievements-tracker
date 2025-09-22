"use client";

import { memo } from "react";
import type { JSX } from "react";

type Achievement = {
  id: number;
  name: string;
  unlockHtml: string;
  url?: string;
};

export default function AchievementsTable(props: {
  achievements: Achievement[];
  completed: Record<number, boolean>;
  onToggle: (id: number) => void;
  sortMode?: "initial" | "asc" | "desc";
  onToggleIdSort?: () => void;
}): JSX.Element {
  const sortLabel =
    props.sortMode === "asc"
      ? "ascending"
      : props.sortMode === "desc"
      ? "descending"
      : "none";

  const sortIcon =
    props.sortMode === "asc" ? "↑" : props.sortMode === "desc" ? "↓" : "↕";

  const WIKI_BASE = "https://bindingofisaacrebirth.wiki.gg/wiki/";
  const fallbackHref = (name: string) =>
    WIKI_BASE + encodeURIComponent(name.replace(/\s+/g, "_"));

  return (
    <div className="overflow-x-auto rounded-xl">
      <table className="table">
        <thead>
          <tr>
            <th className="th w-[100px]">Completed?</th>
            <th className="th">Achievement</th>
            <th
              className="th w-[100px]"
              aria-sort={sortLabel as "none" | "ascending" | "descending"}
            >
              <button
                type="button"
                className="inline-flex items-center gap-1 text-left hover:text-text"
                onClick={props.onToggleIdSort}
                aria-label={`Sort by ID (${sortLabel})`}
              >
                ID <span aria-hidden="true">{sortIcon}</span>
              </button>
            </th>
            <th className="th min-w-[320px]">Unlock method</th>
          </tr>
        </thead>
        <tbody>
          {props.achievements.map((a, i) => (
            <AchievementRow
              key={a.id}
              id={a.id}
              name={a.name}
              url={a.url || fallbackHref(a.name)}
              unlockHtml={a.unlockHtml}
              checked={!!props.completed[a.id]}
              onToggle={props.onToggle}
              zebra={i % 2 === 0 ? "even" : "odd"}
            />
          ))}
        </tbody>
      </table>
      {props.achievements.length === 0 && (
        <div className="p-6 text-muted text-sm">
          No results. Try adjusting your search or filters.
        </div>
      )}
    </div>
  );
}

const AchievementRow = memo(function Row(props: {
  id: number;
  name: string;
  url: string;
  unlockHtml: string;
  checked: boolean;
  onToggle: (id: number) => void;
  zebra: "even" | "odd";
}) {
  return (
    <tr
      className={
        (props.zebra === "even" ? "bg-card" : "bg-bgSoft") +
        " hover:bg-bgSoft/70 transition-colors"
      }
    >
      <td className="td">
        <input
          type="checkbox"
          className="checkbox"
          checked={props.checked}
          onChange={() => props.onToggle(props.id)}
          aria-label={`Toggle completion for ${props.name} (ID ${props.id})`}
        />
      </td>

      <td className="td">
        <div className="font-medium">
          <a
            href={props.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {props.name}
          </a>
        </div>
      </td>

      <td className="td">
        <span className="text-muted">{props.id}</span>
      </td>

      <td className="td">
        <div
          className="unlock"
          dangerouslySetInnerHTML={{ __html: props.unlockHtml }}
        />
      </td>
    </tr>
  );
},
(prev, next) =>
  prev.checked === next.checked &&
  prev.name === next.name &&
  prev.url === next.url &&
  prev.unlockHtml === next.unlockHtml &&
  prev.id === next.id &&
  prev.zebra === next.zebra);