CREATE TABLE `project_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`position` text NOT NULL,
	`civ` text NOT NULL,
	`password_salt` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_accounts_name_key_unique` ON `project_accounts` (`name_key`);