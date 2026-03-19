import { BarChart2, ChevronLeft, ChevronRight } from "lucide-react";

const TABS = [
  { id: "dashboard", label: "위험 대시보드" },
  { id: "whatif",    label: "시뮬레이터" },
  { id: "auditor",   label: "뉴스 감사" },
];

const isToday = (date) => {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};

const formatDate = (date) => {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${mm}.${dd} (${weekdays[date.getDay()]})`;
};

const NavBar = ({ page, setPage, selectedDate, onPrevDate, onNextDate }) => {
  const today = isToday(selectedDate);

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

          <span
            className="text-xs font-semibold tabular-nums min-w-[5.5rem] text-center select-none"
            style={{ color: today ? "var(--accent)" : "var(--text-h)" }}
          >
            {today ? "오늘" : formatDate(selectedDate)}
          </span>

          <button
            onClick={onNextDate}
            disabled={today}
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
