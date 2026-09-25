import { useLayoutEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppFooter from "./components/AppFooter";
import Sidebar from "./components/Sidebar";
import Analytics from "./pages/Analytics";
import Dashboard from "./pages/Dashboard";
import Forecast from "./pages/Forecast";
import MapPage from "./pages/MapPage";
import Recommendations from "./pages/Recommendations";
import YearProvider from "./context/YearProvider";

function App() {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem("aqualink-theme");
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
    return "light";
  });

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("aqualink-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  };

  return (
    <YearProvider><BrowserRouter>
      <div className="app-shell">
        <Sidebar theme={theme} onToggleTheme={toggleTheme} />
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/forecast" element={<Forecast />} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
        <AppFooter />
      </div>
    </BrowserRouter></YearProvider>
  );
}

export default App;
