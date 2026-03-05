---
name: Refactor to NextJS and Convex
overview: Refactor the current Expo React Native application into a Next.js web application with a Convex database backend, maintaining anonymous authentication and adding AI features like RAG, anomaly detection, and vehicle image analysis.
supersededBy: nextjs-convex-migration
statusNote: This plan has been superseded by the consolidated `nextjs-convex-migration` plan and is kept for historical reference only.
todos:
  - id: init-nextjs
    content: Initialize Next.js project with Tailwind and shadcn/ui
    status: pending
  - id: init-convex
    content: Initialize Convex and define database schema
    status: pending
  - id: convex-crud
    content: Implement Convex database queries and mutations (sightings, votes)
    status: pending
  - id: convex-storage
    content: Implement Convex file storage for image uploads
    status: pending
  - id: convex-ai-vision
    content: Implement Convex actions for AI Vision (OCR, classification)
    status: pending
  - id: convex-ai-rag
    content: Implement Convex actions for RAG (embeddings, vector search, chat)
    status: pending
  - id: web-auth
    content: Implement Device Fingerprinting for anonymous auth in web
    status: pending
  - id: ui-map
    content: Build Map Screen (React Leaflet)
    status: pending
  - id: ui-camera
    content: Build Camera/Capture Screen (HTML5 APIs)
    status: pending
  - id: ui-submission
    content: Build Submission Form
    status: pending
  - id: ui-sightings
    content: Build Sightings List and Detail Screens
    status: pending
  - id: ui-chat
    content: Build RAG Chat Interface
    status: pending
  - id: cleanup
    content: Cleanup old Expo/React Native/tRPC/Drizzle code
    status: pending
isProject: false
---

# Refactor to Next.js and Convex

## 1. Project Initialization & Structure

- Initialize a new Next.js 15 project (App Router) in a temporary directory.
- Initialize Convex within the new project.
- Set up Tailwind CSS and shadcn/ui.
- Move existing assets (like icons, map markers) to the Next.js `public` directory.
- Replace the current Expo project structure with the new Next.js structure.

## 2. Convex Backend Setup (Replaces Drizzle/MySQL/tRPC)

- Define the `sightings` and `votes` tables in `convex/schema.ts`.
- Implement queries and mutations in Convex:
  - `sightings: list, getById, create, search, nearby`
  - `votes: getUserVote, cast, remove, getCounts`
  - `plates: getByPlate, listAll`
- Implement Convex vector search for RAG features (Natural Language Search, Similar Sightings).

## 3. Storage & AI Integrations

- Migrate from S3/storage proxy to Convex File Storage for image uploads.
- Implement AI Agent features using Convex Actions (allowing external API calls):
  - **License Plate OCR**: Call an LLM/Vision model to extract plates from uploaded images.
  - **Vehicle Classification**: Call a Vision model to determine make, model, color, and agency markings.
  - **RAG & Embeddings**: Generate vector embeddings for new sightings to enable semantic search.
  - **Anomaly Detection**: Create an action to run background anomaly detection (teleporting vehicles, duplicate bursts).
  - **Chat Assistant**: Implement an endpoint for the RAG-powered chat assistant.

## 4. Frontend Implementation (Next.js + shadcn/ui)

- Set up global layout, providers (ConvexProvider), and navigation.
- Implement the **Map Screen** using `react-leaflet` or similar web-friendly map library.
- Implement the **Camera/Capture Screen** using the HTML5 `MediaDevices` API for photo capture and Geolocation API for location.
- Implement the **Submission Form** with file upload to Convex.
- Implement the **Sightings List** and **Sighting Detail** views.
- Implement the **RAG Chat Interface** for natural language querying.

## 5. UI/UX Refinement

- Apply the current color scheme (Blue primary, Green success, Amber warning, Red error).
- Ensure mobile responsiveness for the Next.js app (since the original was a mobile app).
- Implement device fingerprinting (e.g., using `localStorage` or a simple cookie-based UUID) for anonymous voting and submission tracking, replicating the current Expo device ID behavior.

## 6. Cleanup & Migration

- Remove all Expo, React Native, tRPC, Drizzle, and old server dependencies.
- Update `package.json` scripts.
- Ensure `todo.md` and `design.md` reflect the new architecture.

