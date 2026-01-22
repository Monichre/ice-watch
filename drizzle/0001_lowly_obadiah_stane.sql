CREATE TABLE `sightings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`licensePlate` varchar(20) NOT NULL,
	`vehicleType` varchar(50),
	`photoUrl` text NOT NULL,
	`latitude` decimal(10,7) NOT NULL,
	`longitude` decimal(10,7) NOT NULL,
	`locationAccuracy` decimal(8,2),
	`locationAddress` text,
	`notes` text,
	`photoMetadata` text,
	`deviceId` varchar(64),
	`upvotes` int NOT NULL DEFAULT 0,
	`downvotes` int NOT NULL DEFAULT 0,
	`flagCount` int NOT NULL DEFAULT 0,
	`credibilityScore` decimal(5,2) NOT NULL DEFAULT '0',
	`isHidden` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sightings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `votes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sightingId` int NOT NULL,
	`deviceId` varchar(64) NOT NULL,
	`voteType` enum('upvote','downvote','flag') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `votes_id` PRIMARY KEY(`id`),
	CONSTRAINT `device_sighting_idx` UNIQUE(`deviceId`,`sightingId`)
);
--> statement-breakpoint
CREATE INDEX `licensePlate_idx` ON `sightings` (`licensePlate`);--> statement-breakpoint
CREATE INDEX `location_idx` ON `sightings` (`latitude`,`longitude`);--> statement-breakpoint
CREATE INDEX `credibility_idx` ON `sightings` (`credibilityScore`);--> statement-breakpoint
CREATE INDEX `createdAt_idx` ON `sightings` (`createdAt`);--> statement-breakpoint
CREATE INDEX `sighting_idx` ON `votes` (`sightingId`);