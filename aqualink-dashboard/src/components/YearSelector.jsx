import { CalendarRange } from "lucide-react";
import { useSelectedYear } from "../context/useSelectedYear";

export default function YearSelector({ metadata }) {
  const { selectedYear, setSelectedYear } = useSelectedYear();
  if (!metadata?.yearRange) return null;
  const years = [];
  for (let year = metadata.yearRange.maximum; year >= metadata.yearRange.minimum; year -= 1) years.push(year);
  const value = selectedYear ?? metadata.latestYear;
  return <label className="year-selector"><CalendarRange aria-hidden="true" /><span>Analysis year</span><select value={value} onChange={(event) => setSelectedYear(Number(event.target.value))}>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>;
}
