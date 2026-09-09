import {
  BrowserRouter,
  Routes,
  Route,
  Navigate
} from "react-router-dom";

import Sidebar from "./components/Sidebar";

import Dashboard from "./pages/Dashboard";
import MapPage from "./pages/MapPage";
import Analytics from "./pages/Analytics";
import Forecast from "./pages/Forecast";
import Recommendations from "./pages/Recommendations";

function App() {
  return (
    <BrowserRouter>

      <div className="app-layout">

        <Sidebar />

        <main className="main-content">

          <Routes>

            <Route
              path="/"
              element={
                <Navigate to="/dashboard" />
              }
            />

            <Route
              path="/dashboard"
              element={<Dashboard />}
            />

            <Route
              path="/map"
              element={<MapPage />}
            />

            <Route
              path="/analytics"
              element={<Analytics />}
            />

            <Route
              path="/forecast"
              element={<Forecast />}
            />

            <Route
              path="/recommendations"
              element={<Recommendations />}
            />

          </Routes>

        </main>

      </div>

    </BrowserRouter>
  );
}

export default App;