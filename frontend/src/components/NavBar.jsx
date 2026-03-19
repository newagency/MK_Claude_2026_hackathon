import { BarChart2, ChevronLeft, ChevronRight } from "lucide-react";

const TABS = [
  { id: "dashboard", label: "위험 대시보드" },
  { id: "whatif",    label: "시뮬레이터" },
  { id: "auditor",   label: "뉴스 감사" },
];

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

const clampToToday = (date) => {
  const now = new Date();
  return date > now ? now : date;
};

const DateInput = ({ value, max, onChange }) => (
  <input
    type="text"
    inputMode="numeric"
    value={String(value).padStart(2, "0")}
    onChange={(e) => {
      const raw = e.target.value.replace(/\D/g, "");
      if (raw === "") return;
      const num = Math.min(Math.max(1, parseInt(raw, 10)), max);
      onChange(num);
    }}
    onFocus={(e) => e.target.select()}
    className="w-6 text-center text-xs font-semibold tabular-nums bg-transparent outline-none
               rounded hover:bg-[var(--surface)] focus:bg-[var(--surface)] transition-colors"
    style={{ color: "var(--text-h)" }}
  />
);

const NavBar = ({ page, setPage, selectedDate, setSelectedDate, onPrevDate, onNextDate }) => {
  const mm = selectedDate.getMonth() + 1;
  const dd = selectedDate.getDate();
  const dayName = WEEKDAYS[selectedDate.getDay()];

  const updateMonth = (newMonth) => {
    const y = selectedDate.getFullYear();
    const maxDay = daysInMonth(y, newMonth);
    const d = Math.min(dd, maxDay);
    setSelectedDate(clampToToday(new Date(y, newMonth - 1, d)));
  };

  const updateDay = (newDay) => {
    const y = selectedDate.getFullYear();
    const m = selectedDate.getMonth();
    const maxDay = daysInMonth(y, m + 1);
    const d = Math.min(newDay, maxDay);
    setSelectedDate(clampToToday(new Date(y, m, d)));
  };

  return (
    <nav
      className="sticky top-0 z-50 backdrop-blur-md"
      style={{
        background: "rgba(var(--bg-rgb), 0.88)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="max-w-5xl mx-auto px-6 flex items-center h-13 gap-6">
        {/* Logo */}
        <div className="flex items-center gap-2 select-none shrink-0">
          <BarChart2 size={20} style={{ color: "var(--accent)" }} strokeWidth={2.5} />
          <span className="font-black tracking-tight text-base" style={{ color: "var(--text-h)" }}>
            so<span style={{ color: "var(--accent)" }}>sang</span>
          </span>
        </div>

        {/* Divider */}
        <div className="h-4 w-px shrink-0" style={{ background: "var(--border)" }} />

        {/* Tabs */}
        <div className="flex items-center gap-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPage(tab.id)}
              aria-current={page === tab.id ? "page" : undefined}
              className="text-sm font-semibold transition-all duration-150"
              style={
                page === tab.id
                  ? {
                      color: "var(--accent)",
                      borderBottom: "2px solid var(--accent)",
                      paddingBottom: "calc(0.5rem - 2px)",
                    }
                  : { color: "var(--text)", borderBottom: "2px solid transparent", paddingBottom: "0.5rem" }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Live indicator + Date navigator */}
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: "var(--risk-low)" }}
            />
            <span className="text-xs font-medium" style={{ color: "var(--text)", opacity: 0.6 }}>
              LIVE
            </span>
          </div>

          <div className="h-4 w-px shrink-0" style={{ background: "var(--border)" }} />

          <div className="flex items-center gap-1">
            <button
              onClick={onPrevDate}
              className="p-1 rounded-md transition-colors hover:bg-[var(--surface)]"
              aria-label="이전 날짜"
            >
              <ChevronLeft size={16} style={{ color: "var(--text)", opacity: 0.6 }} />
            </button>

            <div className="flex items-center text-xs font-semibold" style={{ color: "var(--text-h)" }}>
              <DateInput value={mm} max={12} onChange={updateMonth} />
              <span className="select-none" style={{ opacity: 0.4 }}>.</span>
              <DateInput value={dd} max={daysInMonth(selectedDate.getFullYear(), mm)} onChange={updateDay} />
              <span className="ml-0.5 select-none" style={{ opacity: 0.4 }}>({dayName})</span>
            </div>

            <button
              onClick={onNextDate}
              className="p-1 rounded-md transition-colors hover:bg-[var(--surface)] disabled:opacity-20 disabled:cursor-not-allowed"
              aria-label="다음 날짜"
            >
              <ChevronRight size={16} style={{ color: "var(--text)", opacity: 0.6 }} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
