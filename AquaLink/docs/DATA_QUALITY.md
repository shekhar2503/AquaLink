# AquaLink data quality and confidence

AquaLink confidence is an explainable rules-based data-quality classification. It is not a probability, prediction, or machine-learning confidence score.

## Formula

The overall quality score is a weighted sum on a 0–100 scale:

| Dimension | Weight | Rule summary |
| --- | ---: | --- |
| Completeness | 25% | 100% present = 100; at least 90% = 80; at least 75% = 50; otherwise 20 |
| Freshness | 15% | Latest dataset year = 100; one year old = 75; two years old = 50; older = 25 |
| Source reliability | 20% | Verified official = 100; verified partner = 85; unverified report = 60; simulated prototype = 35; unknown = 20 |
| Observation count | 15% | 6+ = 100; 4–5 = 75; 2–3 = 50; 1 = 25; 0 = 0 |
| Spatial accuracy | 15% | Verified coordinate = 100; administrative centroid = 65; only checked against state extent = 40; outside extent = 0; unknown = 20 |
| Observed/simulated status | 10% | Verified observed = 100; unverified observed = 60; simulated = 20 |

`quality_score = Σ(component score × component weight)`

## Confidence thresholds

- **High:** 80–100
- **Medium:** 60–79.9
- **Low:** below 60

Simulated records are capped at Medium even when their weighted score would otherwise be High. Every response includes whether this cap was applied, component reasons, missing fields, stale-data status, and supporting observation count.

An observation becomes stale when it is at least two dataset years behind the latest available year. This measures currency within the dataset; it does not claim that the latest dataset year is current field evidence.

Aggregate `supporting_observation_count` values are calculated before API display limits such as `limit` or `top` are applied. Forecasts separately report annual observations used by the model and the number of underlying location-year records.

## Interpretation

Confidence describes the evidence supporting a score or recommendation, not whether the risk score itself is high or low. A location can therefore have high water stress and low confidence, or low water stress and high confidence.

The current AquaLink prototype records are simulated, use unverified geographic identities, and have coordinates validated only against a broad state reference extent. They therefore do not receive the same treatment as verified field observations.
