CREATE TABLE "share_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"content" jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"uses" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "share_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "share_codes" ADD CONSTRAINT "share_codes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "share_codes_owner_idx" ON "share_codes" USING btree ("owner_id","created_at" DESC NULLS LAST);