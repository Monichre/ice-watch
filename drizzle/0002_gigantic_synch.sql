ALTER TABLE `sightings` ADD `agencyType` varchar(20);--> statement-breakpoint
ALTER TABLE `sightings` ADD `agencyMarkings` text;--> statement-breakpoint
ALTER TABLE `sightings` ADD `vehicleMake` varchar(50);--> statement-breakpoint
ALTER TABLE `sightings` ADD `vehicleModel` varchar(50);--> statement-breakpoint
ALTER TABLE `sightings` ADD `vehicleColor` varchar(30);--> statement-breakpoint
ALTER TABLE `sightings` ADD `badgeNumber` varchar(30);--> statement-breakpoint
ALTER TABLE `sightings` ADD `uniformDescription` text;--> statement-breakpoint
ALTER TABLE `sightings` ADD `aiConfidence` decimal(4,3);