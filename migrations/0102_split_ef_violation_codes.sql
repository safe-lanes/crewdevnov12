UPDATE rh_daily_records_v2
SET daily_records = (
  SELECT jsonb_agg(
    CASE
      WHEN day_record->'violations' IS NOT NULL AND day_record->'violations' @> '"EF"'::jsonb THEN
        jsonb_set(
          jsonb_set(
            day_record,
            '{violations}',
            (
              SELECT jsonb_agg(elem)
              FROM (
                SELECT elem FROM jsonb_array_elements(day_record->'violations') AS elem WHERE elem != '"EF"'::jsonb
                UNION ALL
                SELECT '"E"'::jsonb
                UNION ALL
                SELECT '"F"'::jsonb
              ) AS combined
            )
          ),
          '{violationDiagnostics}',
          COALESCE(
            (
              SELECT jsonb_agg(diag)
              FROM (
                SELECT diag FROM jsonb_array_elements(COALESCE(day_record->'violationDiagnostics', '[]'::jsonb)) AS diag WHERE diag->>'code' != 'EF'
                UNION ALL
                SELECT jsonb_set(diag, '{code}', '"E"'::jsonb) FROM jsonb_array_elements(COALESCE(day_record->'violationDiagnostics', '[]'::jsonb)) AS diag WHERE diag->>'code' = 'EF'
                UNION ALL
                SELECT jsonb_set(diag, '{code}', '"F"'::jsonb) FROM jsonb_array_elements(COALESCE(day_record->'violationDiagnostics', '[]'::jsonb)) AS diag WHERE diag->>'code' = 'EF'
              ) AS combined_diags
            ),
            '[]'::jsonb
          )
        )
      ELSE
        day_record
    END
  )::text
  FROM jsonb_array_elements(daily_records::jsonb) AS day_record
)
WHERE daily_records LIKE '%"EF"%';
