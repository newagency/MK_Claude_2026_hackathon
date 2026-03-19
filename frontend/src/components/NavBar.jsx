import { BarChart2 } from "lucide-react";

const TABS = [
  { id: "dashboard", label: "위험 대시보드" },
  { id: "whatif",    label: "시뮬레이터" },
  { id: "auditor",   label: "뉴스 감사" },
];

const NavBar = ({ page, setPage }) => (
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
                    paddingBottom: "calc(0.5rem - 2px)", // 8px (py-2) - 2px
                  }
                : { color: "var(--text)", borderBottom: "2px solid transparent", paddingBottom: "0.5rem" }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Live indicator */}
      <div className="ml-auto flex items-center gap-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: "var(--risk-low)" }}
        />
        <span className="text-xs font-medium" style={{ color: "var(--text)", opacity: 0.6 }}>
          LIVE
        </span>
      </div>
    </div>
  </nav>
);

export default NavBar;
