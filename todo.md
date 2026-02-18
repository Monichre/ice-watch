# Vehicle Tracker - TODO

## Core Features

- [x] Map screen with vehicle sighting markers
- [x] Camera capture screen with GPS tracking
- [x] Photo submission form with license plate input
- [x] Sightings list screen with all reports
- [x] Sighting detail screen with full information
- [x] Real-time map updates when new sightings are added
- [x] GPS coordinate capture from device location
- [x] EXIF metadata extraction from photos
- [x] Photo upload to cloud storage
- [x] Backend API for storing and retrieving sightings
- [x] Database schema for vehicle sightings
- [x] Filter sightings by date range
- [x] Filter sightings by vehicle type
- [ ] Search functionality for license plates
- [x] Custom map markers for different vehicle types
- [ ] Marker clustering for performance
- [x] Pull-to-refresh on sightings list
- [x] Image compression before upload
- [x] Location permissions handling
- [x] Camera permissions handling
- [x] Error handling for failed uploads
- [x] Success notifications for submissions
- [ ] Offline caching of recent sightings
- [x] Custom app icon and branding

## Community Verification Features

- [x] Upvote/downvote system for sighting accuracy
- [x] Credibility score display on each sighting
- [x] Flag/report system for false or spam reports
- [x] Visual indicators for verified vs unverified sightings
- [x] Sort sightings by credibility score
- [x] Threshold system to hide low-credibility reports
- [x] Anonymous voting (no user accounts required)
- [x] Prevent duplicate votes from same device
- [x] Show vote count on map markers
- [x] Show vote count on sighting detail screen
- [x] Highlight highly-verified sightings on map

## Web App Conversion

- [x] Replace expo-camera with browser MediaDevices API
- [x] Replace expo-location with browser Geolocation API
- [x] Replace react-native-maps with Leaflet or Google Maps JS
- [x] Convert all native components to web-compatible alternatives
- [x] Remove tab navigation, use single-page layout with navigation
- [x] Make layout responsive for desktop and mobile browsers
- [x] Replace file upload with browser File API
- [x] Test camera capture in browser
- [x] Test GPS location in browser
- [x] Test map display and markers
- [x] Test voting and credibility system
- [x] Ensure all features work without native dependencies
