CREATE TABLE `body_measurements` (
	`id` varchar(191) NOT NULL DEFAULT (uuid()),
	`client_id` varchar(191) NOT NULL,
	`date` timestamp DEFAULT (now()),
	`weight` decimal(5,2),
	`body_fat` decimal(4,2),
	`muscle_mass` decimal(5,2),
	`measurements` json,
	`notes` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `body_measurements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` varchar(191) NOT NULL DEFAULT (uuid()),
	`user_id` varchar(191) NOT NULL,
	`coach_id` varchar(191) NOT NULL,
	`goals` json,
	`current_weight` decimal(5,2),
	`target_weight` decimal(5,2),
	`height` decimal(5,2),
	`start_date` timestamp DEFAULT (now()),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `group_message_recipients` (
	`id` varchar(191) NOT NULL,
	`message_id` varchar(191) NOT NULL,
	`client_id` varchar(191) NOT NULL,
	`sent_at` timestamp,
	`confirmed_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `group_message_recipients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `group_messages` (
	`id` varchar(191) NOT NULL,
	`coach_id` varchar(191) NOT NULL,
	`title` text,
	`body` text NOT NULL,
	`scheduled_at` timestamp NOT NULL,
	`require_confirmation` boolean DEFAULT false,
	`audience` text NOT NULL,
	`workout_id` varchar(191),
	`status` varchar(50) NOT NULL DEFAULT 'scheduled',
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `group_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` varchar(191) NOT NULL,
	`coach_id` varchar(191) NOT NULL,
	`client_id` varchar(191) NOT NULL,
	`sender_id` varchar(191) NOT NULL,
	`body` text NOT NULL,
	`group_message_id` varchar(191),
	`created_at` timestamp NOT NULL,
	`read_at` timestamp,
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `progress_entries` (
	`id` varchar(191) NOT NULL DEFAULT (uuid()),
	`client_id` varchar(191) NOT NULL,
	`weight` decimal(5,2),
	`body_fat` decimal(4,2),
	`muscle_mass` decimal(5,2),
	`photos` json,
	`measurements` json,
	`notes` text,
	`date` timestamp DEFAULT (now()),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `progress_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `session_logs` (
	`id` varchar(191) NOT NULL DEFAULT (uuid()),
	`client_id` varchar(191) NOT NULL,
	`coach_id` varchar(191) NOT NULL,
	`workout_id` varchar(191),
	`performed` json,
	`date` timestamp DEFAULT (now()),
	`duration` int,
	`average_rpe` decimal(3,1),
	`notes` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `session_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(191) NOT NULL DEFAULT (uuid()),
	`email` text NOT NULL,
	`password` text NOT NULL,
	`role` varchar(20) NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`avatar` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `workout_entries` (
	`id` varchar(191) NOT NULL DEFAULT (uuid()),
	`session_id` varchar(191),
	`user_id` varchar(191) NOT NULL,
	`coach_id` varchar(191),
	`exercise` text NOT NULL,
	`sets` int,
	`reps` int,
	`weight` decimal(6,2),
	`duration` int,
	`raw_text` text NOT NULL,
	`timestamp` timestamp NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `workout_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workout_sessions` (
	`id` varchar(191) NOT NULL DEFAULT (uuid()),
	`user_id` varchar(191) NOT NULL,
	`coach_id` varchar(191),
	`start_time` timestamp NOT NULL,
	`end_time` timestamp,
	`is_active` boolean DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `workout_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` varchar(191) NOT NULL DEFAULT (uuid()),
	`client_id` varchar(191) NOT NULL,
	`coach_id` varchar(191) NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`exercises` json,
	`scheduled_date` timestamp,
	`completed_at` timestamp,
	`duration` int,
	`notes` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `workouts_id` PRIMARY KEY(`id`)
);
