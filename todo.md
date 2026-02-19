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

## License Plate Recognition (ALPR)

- [x] Create backend API endpoint for OCR/vision analysis
- [x] Integrate AI vision to extract text from photos
- [x] Parse and validate license plate format
- [x] Auto-fill license plate field in submission form
- [x] Add manual override option for incorrect detections
- [x] Show confidence score for extracted plate
- [ ] Handle multiple plates in single photo
- [ ] Test with various plate formats and angles

## Real-Time Plate Tracking

- [x] Normalize plate numbers for canonical tracking
- [x] Create API endpoint to get all sightings by plate
- [x] Build plate detail view showing timeline of sightings
- [x] Add map view showing all locations for a plate
- [x] Display movement history with timestamps
- [x] Show total sightings count per plate
- [x] Add ability to click plate on map to see its history
- [ ] Implement search by plate number
- [ ] Show most recently tracked plates

## Real-Time Updates

- [x] Center map on user's geolocation by default
- [x] Load all sightings on initial map load
- [x] Implement automatic polling for new sightings
- [x] Update map markers in real-time without full refresh
- [x] Optimize performance for large numbers of markers
- [x] Show notification indicator when new sightings appear
- [x] Add pull-to-refresh gesture for manual updates
- [ ] Implement efficient delta updates (only new data)
- [ ] Cache sightings to reduce API calls
- [ ] Handle offline/online transitions gracefully
