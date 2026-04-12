"use client";

import { useState, useMemo } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DatePickerProps {
    value: string | null; // ISO string or null
    onChange: (date: string | null) => void;
    placeholder?: string;
    className?: string;
    isError?: boolean;
}

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function DatePicker({ value, onChange, placeholder = "Pick a date", className, isError }: DatePickerProps) {
    const [open, setOpen] = useState(false);

    const selectedDate = useMemo(() => {
        if (!value) return null;
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }, [value]);

    const [viewMonth, setViewMonth] = useState(() => {
        if (selectedDate) return selectedDate.getMonth();
        return new Date().getMonth();
    });
    const [viewYear, setViewYear] = useState(() => {
        if (selectedDate) return selectedDate.getFullYear();
        return new Date().getFullYear();
    });

    const daysInMonth = useMemo(() => {
        return new Date(viewYear, viewMonth + 1, 0).getDate();
    }, [viewYear, viewMonth]);

    const firstDayOfWeek = useMemo(() => {
        return new Date(viewYear, viewMonth, 1).getDay();
    }, [viewYear, viewMonth]);

    const prevMonth = () => {
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear(viewYear - 1);
        } else {
            setViewMonth(viewMonth - 1);
        }
    };

    const nextMonth = () => {
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear(viewYear + 1);
        } else {
            setViewMonth(viewMonth + 1);
        }
    };

    const selectDay = (day: number) => {
        const d = new Date(viewYear, viewMonth, day, 12, 0, 0);
        onChange(d.toISOString());
        setOpen(false);
    };

    const clear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null);
    };

    const goToday = () => {
        const now = new Date();
        setViewMonth(now.getMonth());
        setViewYear(now.getFullYear());
        selectDay(now.getDate());
    };

    const isToday = (day: number) => {
        const now = new Date();
        return day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
    };

    const isSelected = (day: number) => {
        if (!selectedDate) return false;
        return day === selectedDate.getDate() && viewMonth === selectedDate.getMonth() && viewYear === selectedDate.getFullYear();
    };

    const formatDisplay = () => {
        if (!selectedDate) return null;
        return selectedDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    };

    // Build grid: leading blanks + days
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    className={cn(
                        "h-7 text-[11px] rounded-md border bg-card px-2 text-left flex items-center justify-between gap-1 w-full transition-colors",
                        isError ? "border-red-500/50" : "border-border",
                        value ? "text-foreground" : "text-muted-foreground/40",
                        className
                    )}
                >
                    <span className="truncate">{formatDisplay() || placeholder}</span>
                    {value && (
                        <X className="w-3 h-3 text-muted-foreground/40 hover:text-foreground shrink-0" onClick={clear} />
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[260px] p-3 bg-card border-border rounded-lg shadow-xl"
                align="start"
                sideOffset={4}
            >
                {/* Header: month/year navigation */}
                <div className="flex items-center justify-between mb-3">
                    <button
                        onClick={prevMonth}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[12px] font-semibold text-foreground">
                        {MONTH_NAMES[viewMonth]} {viewYear}
                    </span>
                    <button
                        onClick={nextMonth}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                    >
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Day labels */}
                <div className="grid grid-cols-7 gap-0 mb-1">
                    {DAY_LABELS.map((d) => (
                        <div key={d} className="text-[9px] text-muted-foreground/40 text-center font-semibold py-1">
                            {d}
                        </div>
                    ))}
                </div>

                {/* Day grid */}
                <div className="grid grid-cols-7 gap-0">
                    {cells.map((day, i) => (
                        <div key={i} className="flex items-center justify-center">
                            {day ? (
                                <button
                                    onClick={() => selectDay(day)}
                                    className={cn(
                                        "w-7 h-7 rounded-md text-[11px] font-medium transition-colors flex items-center justify-center",
                                        isSelected(day)
                                            ? "bg-accent-base text-white"
                                            : isToday(day)
                                                ? "bg-accent-base/15 text-accent-base"
                                                : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
                                    )}
                                >
                                    {day}
                                </button>
                            ) : (
                                <div className="w-7 h-7" />
                            )}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/20">
                    <button
                        onClick={() => { onChange(null); setOpen(false); }}
                        className="text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors"
                    >
                        Clear
                    </button>
                    <button
                        onClick={goToday}
                        className="text-[10px] text-accent-base hover:text-accent-base/80 transition-colors font-medium"
                    >
                        Today
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
