ALTER TABLE "host_settings" ADD COLUMN "welcomed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "host_settings" ADD COLUMN "checklist_dismissed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "permissions" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
-- Hosts from before this release are not new: no first-login confetti for them.
INSERT INTO "host_settings" ("user_id", "welcomed_at") SELECT "id", now() FROM "users" ON CONFLICT ("user_id") DO UPDATE SET "welcomed_at" = now();
