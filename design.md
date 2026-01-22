# Vehicle Tracker - Mobile App Design

## Design Philosophy
This app follows **Apple Human Interface Guidelines (HIG)** for a native iOS feel. The design assumes **mobile portrait orientation (9:16)** and **one-handed usage** patterns.

## Color Scheme
- **Primary**: Blue (#0a7ea4) - for action buttons, map markers, active states
- **Background**: White (light) / Dark gray (#151718) (dark mode)
- **Surface**: Light gray (#f5f5f5) / Darker gray (#1e2022) for cards
- **Success**: Green (#22C55E) - for successful uploads
- **Warning**: Amber (#F59E0B) - for location permission prompts
- **Error**: Red (#EF4444) - for failed uploads or errors

## Screen List

### 1. Map Screen (Home/Main)
**Primary Content:**
- Full-screen interactive map showing vehicle sightings
- Custom markers for each reported vehicle location (color-coded by credibility)
- Cluster markers when multiple vehicles are close together
- Current user location indicator
- Floating action button (FAB) to capture new sighting

**Functionality:**
- Pan and zoom map
- Tap marker to view vehicle details (license plate, photo, timestamp, credibility score)
- Filter by date range, vehicle type, or credibility threshold
- Real-time updates when new sightings are uploaded
- Marker colors: Green (high credibility), Yellow (medium), Red (low/flagged)

**Layout:**
- Map fills entire screen behind safe area
- FAB positioned bottom-right (above tab bar)
- Filter button top-right
- Search bar top (collapsible)

### 2. Camera/Capture Screen
**Primary Content:**
- Live camera viewfinder (full screen)
- Capture button (large, centered bottom)
- GPS status indicator (top)
- Cancel button (top-left)

**Functionality:**
- Take photo of vehicle and license plate
- Automatically capture GPS coordinates
- Attempt to extract GPS from photo EXIF data
- Show GPS accuracy indicator
- Preview captured photo before submission

**Layout:**
- Camera preview fills screen
- Capture button: large circle, bottom center
- GPS indicator: small badge, top-center
- Cancel: "X" button, top-left corner

### 3. Submission Form Screen
**Primary Content:**
- Photo preview (thumbnail)
- License plate text field (auto-extracted via OCR if possible, editable)
- Vehicle type picker (sedan, SUV, truck, van, etc.)
- GPS coordinates display (latitude, longitude, accuracy)
- Location address (reverse geocoded)
- Timestamp (auto-filled)
- Notes field (optional)
- Submit button

**Functionality:**
- Edit license plate text
- Select vehicle type
- Add optional notes
- Confirm GPS location or manually adjust
- Upload photo and data to network

**Layout:**
- Scrollable form
- Photo preview at top (tappable to view full size)
- Form fields stacked vertically
- Submit button fixed at bottom

### 4. Sightings List Screen
**Primary Content:**
- List of all vehicle sightings (sorted by recency or credibility)
- Each item shows: thumbnail, license plate, location, timestamp, credibility badge
- Pull-to-refresh
- Infinite scroll for pagination

**Functionality:**
- View all reported sightings
- Tap to view full details
- Sort by: most recent, highest credibility, most votes
- Filter by credibility threshold
- Quick vote buttons on each list item
- Share individual sighting

**Layout:**
- List items: horizontal card layout
- Thumbnail left, details right
- Timestamp and location below license plate
- Swipe actions for quick share/delete (if user owns it)

### 5. Sighting Detail Screen
**Primary Content:**
- Full-size photo
- License plate (large text)
- Vehicle type
- GPS coordinates
- Location address
- Timestamp
- Credibility score with visual indicator (badge/stars)
- Vote count (upvotes/downvotes)
- Map snippet showing location
- Notes

**Functionality:**
- View full photo (pinch to zoom)
- Copy license plate text
- Upvote/downvote for accuracy (thumbs up/down)
- Flag as inaccurate or spam
- Share sighting
- Navigate to location on map

**Layout:**
- Photo at top (full width)
- Details below in card format
- Map snippet embedded
- Action buttons at bottom

## Key User Flows

### Flow 1: Report New Vehicle Sighting
1. User taps FAB on Map Screen
2. Camera Screen opens with live viewfinder
3. User positions camera to capture vehicle and license plate
4. User taps capture button
5. Photo is taken, GPS coordinates captured
6. App attempts to extract license plate via OCR
7. Submission Form Screen opens with pre-filled data
8. User reviews/edits license plate, selects vehicle type, adds notes
9. User taps Submit button
10. Photo and data upload to network
11. Success confirmation shown
12. User returns to Map Screen, new marker appears

### Flow 2: View Vehicle Sightings on Map
1. User opens app (Map Screen is default)
2. Map loads with all recent sightings as markers
3. User pans/zooms to area of interest
4. User taps marker
5. Callout appears with basic info (license plate, timestamp)
6. User taps callout to view full details
7. Sighting Detail Screen opens

### Flow 3: Browse Sightings List
1. User taps "Sightings" tab in tab bar
2. Sightings List Screen loads
3. User scrolls through list
4. User taps on a sighting
5. Sighting Detail Screen opens
6. User views full details and photo

### Flow 4: Filter Sightings by Date/Location
1. User taps filter button on Map Screen or Sightings List Screen
2. Filter sheet slides up from bottom
3. User selects date range, vehicle type, or location radius
4. User taps Apply
5. Map/List updates to show filtered results
6. User can clear filters to see all sightings again

## Community Verification System

### Credibility Score Calculation
- Base score: 0 (neutral)
- Upvote: +1 point
- Downvote: -1 point
- Flag as spam: -5 points
- Display as percentage: (upvotes / total votes) × 100
- Color coding:
  - Green badge: ≥70% credibility
  - Yellow badge: 40-69% credibility
  - Red badge: <40% credibility

### Vote Management
- Each device can vote once per sighting
- Store device ID hash (anonymous) with vote
- Users can change their vote
- Display total vote count alongside score
- Show "X verified" or "X flagged" labels

### Map Marker Colors
- Green: High credibility (≥70%)
- Yellow: Medium credibility (40-69%)
- Red: Low credibility (<40%)
- Gray: No votes yet (new sighting)

### Filtering Options
- Show all sightings (default)
- Show only verified (≥70%)
- Hide flagged (<40%)
- Minimum vote threshold (e.g., at least 3 votes)

## Technical Considerations

### GPS & Location
- Request location permissions on first launch
- Use `expo-location` to get current coordinates
- Display GPS accuracy (meters)
- Fall back to EXIF data extraction from photo if available
- Show warning if GPS accuracy is poor (>50m)

### Camera & Photos
- Use `expo-camera` or `expo-image-picker` for photo capture
- Request camera permissions
- Compress photos before upload (max 2MB)
- Extract EXIF metadata (GPS, timestamp)
- Optional: OCR for license plate text extraction (can use server-side AI)

### Map Integration
- Use `react-native-maps` for map display
- Custom marker icons for vehicle types
- Cluster markers for performance
- Real-time updates via polling or WebSocket

### Data Storage
- Use backend database (PostgreSQL) for cross-device sync
- Store photos in S3-compatible storage
- Cache recent sightings locally for offline viewing

### Privacy & Security
- No user authentication required (anonymous reporting and voting)
- Use device fingerprinting to prevent vote manipulation (one vote per device per sighting)
- Store votes anonymously (no user tracking)
- Community moderation through voting system
- Auto-hide sightings below credibility threshold
- Allow flagging of false/spam entries
- Review flagged content periodically

## Tab Bar Structure
1. **Map** (house.fill icon) - Main screen, map view
2. **Camera** (camera.fill icon) - Quick access to capture
3. **Sightings** (list.bullet icon) - List view of all sightings

## Interaction Patterns
- **Pull-to-refresh**: Update sightings list and map markers
- **Swipe gestures**: Dismiss sheets, navigate between photos
- **Long press**: On map marker to see quick actions (navigate, share)
- **Haptic feedback**: On capture, submit, marker tap
- **Loading states**: Skeleton screens for list, spinner for map loading
- **Error states**: Toast notifications for failed uploads, permission denials

## Accessibility
- Large tap targets (min 44x44pt)
- High contrast mode support
- VoiceOver labels for all interactive elements
- Dynamic type support for text scaling
