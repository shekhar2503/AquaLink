import Papa from "papaparse";

/*
  Load individual Pune locations
  Used by Risk Map and Dashboard
*/
export async function loadPuneData() {

  const response = await fetch("/aqualinkData.csv");

  const csvText = await response.text();

  const result = Papa.parse(csvText, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true
  });

  // Keep only Pune records
  const puneData = result.data.filter(
    (row) =>
      row.District &&
      String(row.District).trim().toLowerCase() === "pune"
  );

  // Find latest year
  const validYears = puneData
    .map((row) => Number(row.Year))
    .filter((year) => !isNaN(year));

  if (!validYears.length) {
    console.error("No valid years found in Pune data");
    return [];
  }

  const latestYear = Math.max(...validYears);

  // Keep latest year
  const latestPuneData = puneData.filter(
    (row) => Number(row.Year) === latestYear
  );

  // Keep individual locations
  const locationData = latestPuneData
    .filter(
      (row) =>
        !isNaN(Number(row.Latitude)) &&
        !isNaN(Number(row.Longitude))
    )
    .map((row) => ({
      ...row,

      Latitude: Number(row.Latitude),

      Longitude: Number(row.Longitude),

      Water_Stress_Score:
        Number(row.Water_Stress_Score || 0)
    }));

  console.log(
    "Pune total records:",
    puneData.length
  );

  console.log(
    "Latest year:",
    latestYear
  );

  console.log(
    "Pune locations displayed:",
    locationData.length
  );

  return locationData;
}


/*
  Load historical Pune data
  Used by Forecast and historical charts
*/
export async function loadPuneHistoricalData() {

  const response = await fetch("/aqualinkData.csv");

  const csvText = await response.text();

  const result = Papa.parse(csvText, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true
  });

  // Keep only Pune records
  const puneData = result.data.filter(
    (row) =>
      row.District &&
      String(row.District).trim().toLowerCase() === "pune"
  );

  // Group scores by year
  const yearMap = new Map();

  puneData.forEach((row) => {

    const year = Number(row.Year);

    const score =
      Number(row.Water_Stress_Score);

    if (
      isNaN(year) ||
      isNaN(score)
    ) {
      return;
    }

    if (!yearMap.has(year)) {
      yearMap.set(year, []);
    }

    yearMap
      .get(year)
      .push(score);

  });

  // Calculate yearly average
  const historicalData = Array.from(
    yearMap.entries()
  )
    .map(([year, scores]) => {

      const average =
        scores.reduce(
          (sum, score) =>
            sum + score,
          0
        ) / scores.length;

      return {
        Year: year,

        Water_Stress_Score:
          Number(average.toFixed(1)),

        Record_Count:
          scores.length
      };

    })
    .sort(
      (a, b) =>
        a.Year - b.Year
    );

  console.log(
    "Pune historical data:",
    historicalData
  );

  return historicalData;
}