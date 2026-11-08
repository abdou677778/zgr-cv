import { useState, type ReactNode } from "react";
export function TechHistoryDisclosure({
  children,
  summary,
  label,
}: {
  children: () => ReactNode;
  summary?: ReactNode;
  label?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <details
      className="group text-xs text-slate-600"
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary
        aria-label={label}
        className={
          summary
            ? "cursor-pointer list-none rounded-md py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 [&::-webkit-details-marker]:hidden"
            : "cursor-pointer rounded py-1 font-medium text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
        }
      >
        {summary || "Plus d’infos"}
      </summary>
      {expanded && children()}
    </details>
  );
}
