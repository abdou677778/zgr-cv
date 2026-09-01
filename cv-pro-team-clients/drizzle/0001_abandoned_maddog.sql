CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`order_id` text,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_invitations_token_hash` ON `invitations` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_invitations_expires_at` ON `invitations` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_invitations_order_id` ON `invitations` (`order_id`);