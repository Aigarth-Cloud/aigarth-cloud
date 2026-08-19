ALTER TABLE "mkt_purchases" DROP CONSTRAINT "mkt_purchases_listing_id_mkt_listings_id_fk";
--> statement-breakpoint
ALTER TABLE "mkt_purchases" ALTER COLUMN "listing_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "mkt_purchases" ADD CONSTRAINT "mkt_purchases_listing_id_mkt_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."mkt_listings"("id") ON DELETE set null ON UPDATE no action;