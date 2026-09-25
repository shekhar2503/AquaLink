import { useState } from "react";
import { YearContext } from "./yearContext";

export default function YearProvider({ children }) {
  const [selectedYear, setSelectedYear] = useState(null);
  return <YearContext.Provider value={{ selectedYear, setSelectedYear }}>{children}</YearContext.Provider>;
}
