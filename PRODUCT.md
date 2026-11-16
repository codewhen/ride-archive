# Ride Archive

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
React, TypeScript, Vite; confirmed by user. Dexie/IndexedDB for local state, browser File System Access API, native video, Web Worker for metadata parsing. No backend.

## Users
A rider reviewing their own camera footage on a desktop computer, primarily Chrome/Edge.

## Product Purpose
Turn a folder of short camera recordings into a navigable day-by-day trip and one continuously playable recording queue.

## Positioning
Read footage directly from the user's disk, match camera-independent video/thumbnail files, and preserve gaps, dates, channels, and timestamp provenance without uploading or altering originals.

## Operating Context
Reference: video_full_ride, 1,133 videos, roughly 61 GB, nine filename dates, 20 incomplete groups. MP4 samples are H.264/AAC. TXT files are ignored. Recording timestamps come from recognized filename shapes, embedded MP4/MOV creation time, or an explicitly labelled file-date fallback.

## Capabilities and Constraints
Strict video validation followed by explicit recovery; absent thumbnails and estimated timestamps are warnings. Any clip duration, nested folders, common camera filename shapes, separate front/rear/interior stream queues, and supplied-thumbnail seek previews. Multiple local trips. Day and session timeline, continuous playback, cumulative seeking, filmstrip, date corrections, bookmarks, favourites, notes, search, health report, JSON annotation backup. Bounded preloading and virtualized lists. No cloud upload, accounts, GPS map, transcoding, merged export, or AI highlights. Reopening folders may require permission/reselection. Filename wall-clock dates authoritative until corrected.

## Product Principles
- Footage leads; navigation stays compact.
- Originals remain untouched.
- Errors describe the affected files and recovery choices.
- Recorded time and elapsed time are distinct.
- Expose timestamp provenance and codec limits; never claim universal decoding or frame-perfect transitions.

## Accessibility & Inclusion
Responsive web interface, semantic controls, visible focus, keyboard playback control, reduced motion, clear permission/loading/error/empty states.

## Confirmed Workflow
Player-and-day-rail layout confirmed. Impeccable mockups before code, with visual approval before implementation, confirmed by user. Product implementation requested November 10, 2026.

## Brand Commitments
User selected codewhen.com as the visual authority, superseding earlier palette explorations. Use its graphite-green dark surfaces, mineral-white text, ember/coral actions, lime status/focus, Geist and Geist Mono typography, compact corners and subtle dividers. The local sibling source ../webpages/code-when-landing-page/DESIGN.md and globals.css match the live site inspected November 10, 2026. Keep the already-confirmed player/day rail/filmstrip composition.
