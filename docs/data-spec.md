# Data Specification

## Source Dataset

- Path: `Dataset/jan to may police violation_anonymized791b166.csv`
- Size: large single CSV
- Approx rows profiled: **298,450**

## Source Columns

- `id`
- `latitude`
- `longitude`
- `location`
- `vehicle_number`
- `vehicle_type`
- `description`
- `violation_type`
- `offence_code`
- `created_datetime`
- `closed_datetime`
- `modified_datetime`
- `device_id`
- `created_by_id`
- `center_code`
- `police_station`
- `data_sent_to_scita`
- `junction_name`
- `action_taken_timestamp`
- `data_sent_to_scita_timestamp`
- `updated_vehicle_number`
- `updated_vehicle_type`
- `validation_status`
- `validation_timestamp`

## In-Scope Parking Labels

Use only parking-related violations for LaneGuard:

- `WRONG PARKING`
- `NO PARKING`
- `PARKING IN A MAIN ROAD`
- `PARKING ON FOOTPATH`
- `DOUBLE PARKING`
- `PARKING NEAR ROAD CROSSING`
- `PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC`
- `PARKING NEAR TRAFFIC LIGHT OR ZEBRA CROSS`
- `PARKING OPPOSITE TO ANOTHER PARKED VEHICLE`

## Out-of-Scope Labels

Ignore non-parking offences for the MVP, such as:

- `DEFECTIVE NUMBER PLATE`
- `REFUSE TO GO FOR HIRE`
- unrelated vehicle compliance offences

## Derived Fields

- `event_ts`
- `event_date`
- `event_hour`
- `weekday`
- `is_peak_hour`
- `parking_labels[]`
- `station_name_normalized`
- `junction_risk_flag`
- `main_road_flag`
- `crossing_flag`
- `footpath_flag`
- `cluster_id`
- `priority_score`

## Cleaning Rules

1. Convert string `NULL` to actual null
2. Parse `violation_type` as array
3. Explode records with multiple parking offences
4. Normalize station names
5. Parse UTC timestamps into one consistent timezone for presentation
6. Drop rows with invalid coordinates if any appear later

## Aggregation Strategy

### Row-level

- Keep a compact row set for record explorer

### Cluster-level

- Aggregate to hotspot units for the main map

### Station-level

- Aggregate counts and scores by police station

### Temporal

- Aggregate by hour, weekday, and recent period

## Known Data Gaps

- No direct travel-time congestion measure
- No road-width field
- No camera image or evidence media
- No strong closure outcome coverage

## Data Story We Can Honestly Tell

We are not claiming exact congestion measurement. We are claiming:

- repeated parking violations form spatial patterns
- some parking patterns are more likely to create traffic disruption than others
- these patterns can be prioritized operationally

We can also credibly claim:

- those patterns can be mapped to explainable enforcement and policy suggestions

We should not claim:

- exact proof that a new parking facility must be built at a precise location using this dataset alone
