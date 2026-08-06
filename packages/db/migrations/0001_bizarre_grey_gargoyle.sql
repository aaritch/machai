CREATE TYPE "public"."affiliate_status" AS ENUM('pending', 'active', 'suspended', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."affiliate_payout_status" AS ENUM('pending', 'processing', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."referral_status" AS ENUM('pending', 'qualified', 'payable', 'paid', 'reversed');--> statement-breakpoint
CREATE TABLE "affiliate_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"referral_count" integer DEFAULT 0 NOT NULL,
	"status" "affiliate_payout_status" DEFAULT 'pending' NOT NULL,
	"reference" text,
	"issued_by_user_id" uuid,
	"paid_at" timestamp with time zone,
	"failure_reason" text
);
--> statement-breakpoint
CREATE TABLE "affiliate_referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"referred_user_id" uuid NOT NULL,
	"code_used" text NOT NULL,
	"status" "referral_status" DEFAULT 'pending' NOT NULL,
	"commission_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"signed_up_at" timestamp with time zone DEFAULT now() NOT NULL,
	"qualified_at" timestamp with time zone,
	"payable_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"reversed_at" timestamp with time zone,
	"reversal_reason" text,
	"payout_id" uuid,
	"flagged_for_review" boolean DEFAULT false NOT NULL,
	"flag_reason" text
);
--> statement-breakpoint
CREATE TABLE "affiliates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"status" "affiliate_status" DEFAULT 'pending' NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by_user_id" uuid,
	"suspended_reason" text,
	"payout_email" text,
	"application_note" text
);
--> statement-breakpoint
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_issued_by_user_id_users_id_fk" FOREIGN KEY ("issued_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "affiliate_payouts_affiliate_idx" ON "affiliate_payouts" USING btree ("affiliate_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_referrals_referred_user_key" ON "affiliate_referrals" USING btree ("referred_user_id");--> statement-breakpoint
CREATE INDEX "affiliate_referrals_affiliate_idx" ON "affiliate_referrals" USING btree ("affiliate_id","status");--> statement-breakpoint
CREATE INDEX "affiliate_referrals_status_idx" ON "affiliate_referrals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "affiliate_referrals_payable_idx" ON "affiliate_referrals" USING btree ("payable_at");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliates_user_key" ON "affiliates" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliates_code_key" ON "affiliates" USING btree ("code");--> statement-breakpoint
CREATE INDEX "affiliates_status_idx" ON "affiliates" USING btree ("status");