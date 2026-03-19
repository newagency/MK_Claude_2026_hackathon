import { useState } from "react";
import NavBar from "./components/NavBar";
import RiskDashboard from "./pages/RiskDashboard";
import WhatIfEngine from "./pages/WhatIfEngine";
import LinkAuditor from "./pages/LinkAuditor";

const App = () => {
  const [page, setPage] = useState("dashboard");

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <NavBar page={page} setPage={setPage} />
      {page === "dashboard" && <RiskDashboard />}
      {page === "whatif"    && <WhatIfEngine />}
      {page === "auditor"   && <LinkAuditor />}
    </div>
  );
};

export default App;
