import { useState } from "react";
import NavBar from "./components/NavBar";
import RiskDashboard from "./pages/RiskDashboard";
import WhatIfEngine from "./pages/WhatIfEngine";
import LinkAuditor from "./pages/LinkAuditor";

const App = () => {
  const [page, setPage] = useState("dashboard");
  const [selectedDate, setSelectedDate] = useState(new Date(2025, 2, 15));

  const shiftDate = (days) =>
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + days);
      return next > new Date() ? prev : next;
    });

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <NavBar
        page={page}
        setPage={setPage}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        onPrevDate={() => shiftDate(-1)}
        onNextDate={() => shiftDate(1)}
      />
      {page === "dashboard" && <RiskDashboard selectedDate={selectedDate} />}
      {page === "whatif"    && <WhatIfEngine selectedDate={selectedDate} />}
      {page === "auditor"   && <LinkAuditor selectedDate={selectedDate} />}
    </div>
  );
};

export default App;
