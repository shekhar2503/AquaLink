import { useContext } from "react";
import { YearContext } from "./yearContext";

export function useSelectedYear() {
  const context = useContext(YearContext);
  if (!context) throw new Error("useSelectedYear must be used inside YearProvider");
  return context;
}
