import { useMemo } from "react";
import { FileNode } from "../store";
import { format, subWeeks, startOfWeek, addDays, differenceInCalendarDays } from "date-fns";

interface Props {
  nodes: FileNode[];
}

function flattenNotes(nodes: FileNode[]): Array<{ modified_at: number }> {
  const result: Array<{ modified_at: number }> = [];
  for (const node of nodes) {
    if (node.type === "File" && node.file_type === "note") {
      result.push({ modified_at: node.modified_at });
    } else if (node.type === "Folder") {
      result.push(...flattenNotes(node.children));
    }
  }
  return result;
}

export function ActivityHeatmap({ nodes }: Props) {
  const WEEKS = 26; // ~6 months

  const { grid, maxCount } = useMemo(() => {
    const files = flattenNotes(nodes);
    const counts: Record<string, number> = {};
    for (const f of files) {
      const d = format(new Date(f.modified_at * 1000), "yyyy-MM-dd");
      counts[d] = (counts[d] ?? 0) + 1;
    }

    const today = new Date();
    // Start from the beginning of the week, WEEKS weeks ago
    const startDate = startOfWeek(subWeeks(today, WEEKS - 1), { weekStartsOn: 0 });

    const grid: Array<Array<{ date: string; count: number }>> = [];
    for (let w = 0; w < WEEKS; w++) {
      const week: Array<{ date: string; count: number }> = [];
      for (let d = 0; d < 7; d++) {
        const date = addDays(startDate, w * 7 + d);
        if (differenceInCalendarDays(date, today) > 0) {
          week.push({ date: "", count: -1 }); // future
        } else {
          const key = format(date, "yyyy-MM-dd");
          week.push({ date: key, count: counts[key] ?? 0 });
        }
      }
      grid.push(week);
    }

    const maxCount = Math.max(1, ...Object.values(counts));
    return { grid, maxCount };
  }, [nodes]);

  const getOpacity = (count: number): string => {
    if (count <= 0) return "0.06";
    const ratio = count / maxCount;
    if (ratio < 0.25) return "0.25";
    if (ratio < 0.5) return "0.5";
    if (ratio < 0.75) return "0.75";
    return "1";
  };

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <div className="flex gap-[3px]" style={{ width: "fit-content" }}>
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day, di) => (
                <div
                  key={di}
                  title={day.date ? `${day.date}: ${day.count} note${day.count !== 1 ? "s" : ""}` : ""}
                  className="w-[10px] h-[10px] rounded-[2px]"
                  style={{
                    backgroundColor:
                      day.count < 0
                        ? "transparent"
                        : `color-mix(in srgb, var(--app-accent) ${Math.round(parseFloat(getOpacity(day.count)) * 100)}%, transparent)`,
                    outline: day.count === 0 ? "1px solid rgba(128,128,128,0.12)" : "none",
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-xs text-gray-400">Less</span>
        {[0.06, 0.25, 0.5, 0.75, 1].map((op, i) => (
          <div
            key={i}
            className="w-[10px] h-[10px] rounded-[2px]"
            style={{
              backgroundColor: `color-mix(in srgb, var(--app-accent) ${Math.round(op * 100)}%, transparent)`,
              outline: op === 0.06 ? "1px solid rgba(128,128,128,0.12)" : "none",
            }}
          />
        ))}
        <span className="text-xs text-gray-400">More</span>
      </div>
    </div>
  );
}
