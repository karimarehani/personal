CREATE TABLE `otp_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `phone_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
