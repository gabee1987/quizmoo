CREATE TABLE "bank_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"question" jsonb NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"search_text" text GENERATED ALWAYS AS (translate(lower(("question"->>'text') || ' ' || jsonb_path_query_array("question", '$.options[*].text')::text || ' ' || jsonb_path_query_array("question", '$.acceptedAnswers[*]')::text), 'áàâäãåāăąçćčďéèêëēęěíìîïłńňñóòôöõøōőřśšşťúùûüūůűýÿźżž', 'aaaaaaaaacccdeeeeeeeiiiilnnnoooooooorssstuuuuuuuyyzzz')) STORED NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_questions_owner_idx" ON "bank_questions" USING btree ("owner_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);