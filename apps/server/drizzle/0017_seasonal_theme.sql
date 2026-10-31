-- Phase 50: Classic was the default theme and is rarely picked on purpose, so quizzes and hosts'
-- game defaults on Classic move to the new default, Seasonal. Other themes and games stay as they are.
UPDATE "quizzes" SET "settings" = jsonb_set("settings", '{theme}', '"seasonal"') WHERE "settings"->>'theme' = 'classic';
--> statement-breakpoint
UPDATE "host_settings" SET "settings" = jsonb_set("settings", '{gameDefaults,theme}', '"seasonal"')
WHERE jsonb_typeof("settings"->'gameDefaults') = 'object' AND "settings"->'gameDefaults'->>'theme' = 'classic';
