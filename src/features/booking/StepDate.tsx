import { useMemo, useState } from "react";
import { useCompanyConfig } from "../../api/agenda";
import { Button, Card } from "../../components/ui";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const WEEKDAYS = ["D", "L", "M", "X", "J", "V", "S"];

function todayLocal(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());
}

export function StepDate({ onSelect }: { onSelect: (date: string) => void }) {
  const today = todayLocal();
  const [viewYear, setViewYear] = useState(Number(today.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(Number(today.slice(5, 7)) - 1);
  const config = useCompanyConfig();

  const closedDays = useMemo(() => {
    const set = new Set<number>();
    for (const oh of config.data?.openHours ?? []) {
      if (oh.dayOfWeek != null && oh.isOpen === false) set.add(oh.dayOfWeek);
    }
    return set;
  }, [config.data]);

  const cells = useMemo(() => {
    const firstDow = new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    const result: ({ date: string; day: number; dow: number } | null)[] = [];
    for (let i = 0; i < firstDow; i++) result.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      result.push({ date, day, dow: (firstDow + day - 1) % 7 });
    }
    return result;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  return (
    <Card className="mx-auto max-w-md">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" onClick={prevMonth}>←</Button>
        <h3 className="text-xl font-semibold">
          {MONTHS[viewMonth]} {viewYear}
        </h3>
        <Button variant="ghost" onClick={nextMonth}>→</Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1 text-xs font-medium text-ink-soft">
            {d}
          </span>
        ))}
        {cells.map((cell, i) =>
          cell === null ? (
            <span key={`empty-${i}`} />
          ) : (
            <button
              key={cell.date}
              disabled={cell.date < today || closedDays.has(cell.dow)}
              onClick={() => onSelect(cell.date)}
              className={`rounded-full py-1.5 text-sm transition-colors ${
                cell.date < today || closedDays.has(cell.dow)
                  ? "cursor-not-allowed text-surface-highest"
                  : "hover:bg-primary hover:text-white"
              } ${cell.date === today ? "font-bold text-primary" : ""}`}
            >
              {cell.day}
            </button>
          ),
        )}
      </div>
    </Card>
  );
}
