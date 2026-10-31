CREATE TABLE "season_windows" (
	"season" text PRIMARY KEY NOT NULL,
	"before" integer NOT NULL,
	"after" integer NOT NULL,
	"off" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
