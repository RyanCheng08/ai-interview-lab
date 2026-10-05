CREATE TABLE `study_progress` (
	`user_id` text NOT NULL,
	`question_id` text NOT NULL,
	`favorite` integer DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'unseen' NOT NULL,
	`review_count` integer DEFAULT 0 NOT NULL,
	`last_reviewed_at` text,
	`next_review_at` text,
	`updated_at` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`last_mutation_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `question_id`)
);
