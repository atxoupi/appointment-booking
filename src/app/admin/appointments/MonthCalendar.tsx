"use client";

import { useState } from "react";

interface MonthCalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

const DAYS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function toLocalDateString(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function MonthCalendar({ selectedDate, onDateSelect }: MonthCalendarProps) {
  const [viewYear, setViewYear] = useState(selectedDate.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getUTCMonth());

  const todayStr = toLocalDateString(new Date());
  const selectedStr = toLocalDateString(selectedDate);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  }

  // Día de la semana del día 1 del mes (0=lunes…6=domingo)
  const firstDayOfMonth = new Date(Date.UTC(viewYear, viewMonth, 1));
  // getUTCDay: 0=domingo, 1=lunes…6=sábado → convertir a 0=lunes
  const startOffset = (firstDayOfMonth.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Rellenar hasta múltiplo de 7
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="w-64 shrink-0 rounded-lg border border-slate-200 p-4">
      {/* Cabecera de navegación */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="rounded p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Mes anterior"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-slate-800">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="rounded p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Mes siguiente"
        >
          ›
        </button>
      </div>

      {/* Cabecera días de la semana */}
      <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium text-slate-400">
        {DAYS.map((d) => <div key={d}>{d}</div>)}
      </div>

      {/* Cuadrícula de días */}
      <div className="grid grid-cols-7 gap-y-1 text-center text-sm">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedStr;

          return (
            <button
              key={dateStr}
              onClick={() => onDateSelect(new Date(`${dateStr}T00:00:00.000Z`))}
              className={[
                "rounded-full py-1 text-sm leading-none transition-colors",
                isSelected
                  ? "bg-slate-900 text-white"
                  : isToday
                  ? "border border-slate-900 text-slate-900 hover:bg-slate-100"
                  : "text-slate-700 hover:bg-slate-100",
              ].join(" ")}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
