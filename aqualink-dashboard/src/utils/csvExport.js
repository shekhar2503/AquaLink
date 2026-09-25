const exportFields = ["geography_id", "year", "area_group_display_name", "location_display_name", "groundwater_stress_score", "water_supply_gap_score", "water_stress_score", "risk_category", "recommended_action", "coordinate_status"];

function escapeCsv(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function recordsToCsv(records) {
  return [exportFields.join(","), ...records.map((record) => exportFields.map((field) => escapeCsv(record[field])).join(","))].join("\n");
}

export function downloadRecordsCsv(records, filename) {
  const url = URL.createObjectURL(new Blob([recordsToCsv(records)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}
