-- Read-only production diagnostic: no replay or certification mutations.
WITH trial_summary AS (
 SELECT count(*) AS total_trials,
        count(DISTINCT symbol) AS securities,
        max(evaluated_at) AS latest_evaluation,
        max(dataset_end) AS latest_dataset_end,
        count(*) FILTER (WHERE evaluated_at >= now()-interval '24 hours') AS trials_last_24h
 FROM tradeos_acceleration_trials
)
SELECT total_trials,securities,latest_evaluation,latest_dataset_end,
       trials_last_24h,
       CASE WHEN trials_last_24h=0 THEN 'NO_RECENT_TRIAL_INSERTIONS'
            ELSE 'RECENT_TRIAL_INSERTIONS' END AS diagnostic_status
FROM trial_summary;
