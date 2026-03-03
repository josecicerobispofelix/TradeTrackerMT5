import { Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import History from "./pages/History";
import TopNav from "./components/TopNav";

export default function App() {
  return (
    <div className="app-shell">
      <TopNav />
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </main>
    </div>
  );
}
