import test from "node:test";
import assert from "node:assert/strict";
import { recordsToCsv } from "./csvExport.js";

test("CSV export includes only approved non-sensitive fields and escapes text", () => {
  const csv = recordsToCsv([{ geography_id: "syn-1", year: 2025, location_display_name: 'Prototype "one"', latitude: 18.5 }]);
  assert.match(csv, /geography_id,year/);
  assert.match(csv, /"Prototype ""one"""/);
  assert.doesNotMatch(csv, /latitude/);
});
