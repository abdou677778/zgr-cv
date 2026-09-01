CREATE TABLE `json_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`storage_key` text NOT NULL,
	`original_name` text NOT NULL,
	`sha256` text NOT NULL,
	`prompt_version` text NOT NULL,
	`validation_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_json_versions_order_version` ON `json_versions` (`order_id`,`version_number`);--> statement-breakpoint
CREATE INDEX `idx_json_versions_order_id` ON `json_versions` (`order_id`);--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` text NOT NULL,
	`type` text NOT NULL,
	`details_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_order_events_order_created` ON `order_events` (`order_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `order_files` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`category` text NOT NULL,
	`original_name` text NOT NULL,
	`storage_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_order_files_storage_key` ON `order_files` (`storage_key`);--> statement-breakpoint
CREATE INDEX `idx_order_files_order_id` ON `order_files` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`upload_token_hash` text NOT NULL,
	`client_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`language` text DEFAULT 'fr' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`services_json` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text,
	`current_json_version` integer,
	`drive_folder_id` text,
	`drive_status` text DEFAULT 'PENDING' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_orders_created_at` ON `orders` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_orders_status_created_at` ON `orders` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_orders_email_created_at` ON `orders` (`email`,`created_at`);