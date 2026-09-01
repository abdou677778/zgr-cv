CREATE TABLE `deliverables` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`service` text DEFAULT 'AUTRE' NOT NULL,
	`original_name` text NOT NULL,
	`storage_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_deliverables_storage_key` ON `deliverables` (`storage_key`);--> statement-breakpoint
CREATE INDEX `idx_deliverables_order_created` ON `deliverables` (`order_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`drive_folder_id` text NOT NULL,
	`share_url` text NOT NULL,
	`file_ids_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_deliveries_order_version` ON `deliveries` (`order_id`,`version_number`);--> statement-breakpoint
CREATE INDEX `idx_deliveries_order_created` ON `deliveries` (`order_id`,`created_at`);
