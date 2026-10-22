CREATE TABLE "nickname_lists" (
	"language" text PRIMARY KEY NOT NULL,
	"names" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
