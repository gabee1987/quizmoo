CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_codes" (
	"email" text PRIMARY KEY NOT NULL,
	"purpose" text NOT NULL,
	"code_hash" text NOT NULL,
	"user_id" text,
	"signup" jsonb,
	"tries" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "must_add_email" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "budget" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "games_month" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "games_month_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "email_codes" ADD CONSTRAINT "email_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");--> statement-breakpoint
-- Accounts from before e-mail login (editors and waiting sign-ups) add an address at their next login.
UPDATE "users" SET "must_add_email" = true WHERE "role" = 'editor';--> statement-breakpoint
-- The monthly game budget counts this month's games so far.
UPDATE "users" SET "games_month" = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM'), "games_month_count" = (SELECT count(*) FROM "games" g WHERE g."host_id" = "users"."id" AND g."created_at" >= date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC');
