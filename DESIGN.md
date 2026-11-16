---
name: Ride Archive / CodeWhen
description: Local ride footage framed by the user-pinned CodeWhen visual language.
colors:
  background: "#101211"
  surface: "#171a18"
  elevated: "#1c201d"
  hover: "#272c27"
  text: "#f2efe5"
  secondary: "#d0d2c8"
  muted: "#aaafa4"
  border: "#39413b"
  primary: "#ff7954"
  focus: "#c4f16c"
  error: "#ff9a83"
typography:
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 540
    lineHeight: 1.2
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 540
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
  empty-headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(32px, 4vw, 48px)"
    fontWeight: 550
    lineHeight: 1.12
    letterSpacing: "-0.04em"
  empty-headline-mobile:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 550
    lineHeight: 1.12
    letterSpacing: "-0.04em"
  copy:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "12px"
  measurement-prominent:
    fontFamily: "Geist Mono, monospace"
    fontSize: "11px"
  measurement:
    fontFamily: "Geist Mono, monospace"
    fontSize: "10px"
rounded:
  control: "3px"
  media: "6px"
  dialog: "8px"
spacing:
  compact: "8px"
  small: "12px"
  medium: "16px"
  large: "24px"
  main: "28px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#17130f"
    rounded: "{rounded.control}"
    padding: "9px 13px"
  button-secondary:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "9px 13px"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "8px 11px"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.dialog}"
    padding: "24px"
---
# Design System: Ride Archive / CodeWhen

## Overview

**Creative North Star: "Expedition instrument console"**

The user-selected CodeWhen visual language is the authority: graphite-green surfaces, mineral-white text, coral actions and lime focus/status. The approved adaptation is `.impeccable/mocks/codewhen-player.png`; its generated labels are illustrative.

The established expedition instrument console stays compact and footage-led. Locally hosted Geist and Geist Mono supply clear headings and precise recorded-time labels. Full-color local video and local thumbnail images carry the imagery.

**Key Characteristics:**
- Graphite-green tonal layers and subtle dividers.
- Coral actions and selection; lime playback, status and focus.
- Compact controls around dominant source footage.

## Colors

### Primary
Coral identifies import, playback actions and active navigation. Hover lightens primary buttons. It is the action accent, not a footage tint.

### Secondary
Lime identifies live playback, the seek control and keyboard focus. The error tone distinguishes failure feedback.

### Neutral
Graphite-green background, surface, elevated and hover tokens establish layers. Mineral-white text, secondary text and muted metadata provide hierarchy; borders separate adjoining regions. Frontmatter values are normative and match `src/styles.css`.

## Typography

Geist serves display and body text; Geist Mono serves actual timestamps, counts, keyboard hints and measurements. Both variable fonts are locally hosted under `/fonts/`, with system sans and monospace fallbacks. Main headings use the headline token; mobile headings reduce to (29px). Body copy uses comfortable paragraph leading (1.65). Measurements use the measurement tokens: seek time is (11px) on desktop and (10px) on phones; filmstrip timestamps stay (11px), with (10px) durations and session metadata. Supporting captions, help and detail copy use the copy token. The compact empty-state heading uses the empty-headline tokens. Geist familiarity is intentional: the user-pinned CodeWhen authority takes precedence over generic font-familiarity detector advisories. This is a scoped simplification of the existing implementation, not a redesign.

## Layout

The archive/player surface retains the approved player/day rail/filmstrip composition. Desktop has a solid header (76px), a left day/session rail (236px) and a flexible main area with side padding (28px). Video uses a (16:9) stage, followed by cumulative seek, persistent controls and a horizontally scrollable virtual filmstrip. At desktop widths from (981px), stage height is capped at `max(240px, calc(100dvh - 580px))` to keep transport and the full filmstrip visible together, including when details are open. Contained video preserves source aspect ratio with gutters where needed; the minimum stage height (240px) permits page scrolling on short viewports. Mobile sizing is unchanged. An optional details panel accompanies the player. Wider and narrower desktop layouts adjust rail and drawer widths rather than fixing the video width.

Above (720px), the rail is sticky and viewport-bounded; its day navigation scrolls independently, expanded sessions are bounded to (320px), and library actions remain reachable. The intermediate header is (68px). At (720px) and below, the header wraps, the rail becomes a scrollable overlay with an explicit close control, and main padding becomes (16px). The transport occupies the first player-toolbar row; speed, volume, visible **Save moment**, and fullscreen occupy the second. The supported minimum viewport width is (360px).

At widths up to (980px), details become a full-height native modal drawer, with width up to (380px) bounded by the viewport. The day rail becomes a native modal drawer (280px wide) at widths up to (720px). Both panels also become modal during fullscreen; otherwise they remain docked asides. Import and health remain dialogs. Empty, reconnect, loading and error states retain the same spatial and color vocabulary. The empty library presents one Import folder action and a compact introduction in a centered desktop column (maximum 540px), with no disabled search, rail, perk rows or filename examples. On phones the introduction starts near the top with a full-width action.

## Elevation & Depth

Ordinary controls use tonal layering and borders without shadows. Dialogs use a broad dark shadow; responsive navigation and details overlays use directional shadows with a dimmed backdrop where implemented. Depth conveys temporary overlay scope rather than decoration.

## Shapes

Controls have compact corners; media is slightly softer, and dialogs use the dialog radius. Mobile media corners tighten to (4px). The coral brand mark is a clipped slanted quadrilateral. Thin dividers organize dense lists and controls.

## Components

### Buttons
Compact and direct: raised secondary controls, coral primary actions, transparent icon controls. Standard controls have minimum height (40px); compact utilities may be smaller. Hover changes background and border over (160ms ease-out). Focus uses a lime outline (2px) with offset (3px). Disabled controls reduce opacity and indicate unavailability.

### Inputs / Fields
Dark fields use fine borders and control corners. Text and caret remain legible; search has a lime focus-within outline. Selects and textareas inherit the same typography and surfaces.

### Navigation
Day rows pair sans labels with mono counts. Active days have a coral edge; the current session has a lime dot. Sessions expose recording gaps as text. Desktop navigation scrolls within the sticky rail; mobile navigation opens as a drawer.

### Player and filmstrip
The video preserves source framing with contained media. A continuous recorded-time cursor connects seek, active thumbnail and active day; wall-clock gaps stay visible in session navigation. Actual local thumbnails and dynamic labels replace illustrative mockup content. The selected thumbnail reads **Selected**, independent of playback state. Filmstrip arrow controls appear only when recordings overflow the visible width. A text **Details** button is the single details entry; duplicate details, shortcut, privacy and local-status rows are removed. Save moment stays visible in the mobile toolbar's second row.

### Dialogs and detail drawer
Import and health use bordered surface dialogs, bounded to viewport height with scrollable content. Import introduces folder selection concisely; compatibility folder access is inside the **Folder access options** disclosure when available. The detail panel uses the same surface and separators. Responsive modal panels loop Tab/Shift+Tab, dismiss on Escape or backdrop activation, and restore focus to the previous connected control when closed. Notes remain usable during fullscreen. Dialog actions wrap on phones with the primary action taking a full row.

Motion stays functional: brief control feedback and a loading spinner. Reduced-motion preferences suppress transitions and repeated animation.

## Do's and Don'ts

### Do:
- Do preserve the user-pinned CodeWhen palette and locally hosted typography.
- Do compute footage labels, counts, durations and health from actual local data.
- Do keep Save moment visibly available on phones and preserve keyboard focus.

### Don't:
- Don't treat generated comp labels or counts as application data.
- Don't hide essential player actions behind hover.
- Don't add ornamental telemetry or claim unknown sensor semantics.

Fullscreen is a separate viewport mode: the player fills 100vw × 100dvh with no outer padding. The video stage removes the normal desktop maximum height and fills all space above the seek bar and controls, using contained source proportions. Exiting fullscreen restores the normal viewport cap. The fullscreen control changes label and icon to **Exit fullscreen** while active; fullscreen failures use a status notification.


## Camera-independent import and seek previews
The import surface accepts video segments of any actual duration and optional paired JPG/JPEG, PNG or WebP images. TXT data is ignored; no sensor pane remains. Import warnings identify estimated dates/missing thumbnails without blocking playable footage. Recording details exposes filename/embedded/file-date provenance. A compact camera-view select separates front/rear/interior queues.

The cumulative range control opens a representative recording-thumbnail tooltip above the track on pointer hover/drag and keyboard focus/change. It includes cumulative and camera timestamps and clearly labels the image as a recording thumbnail, not a frame-accurate still. Preview width192px desktop /170px mobile, offset12px above track, 5px corners, raised surface and thin border; lime identifies the cumulative preview time. Tooltip position is clamped within the track/viewport. Missing images show a placeholder.


## Consistent selectors and transport icons
Trip, camera-view and playback-speed choices share a select-only combobox with a single chevron and an opaque raised-surface listbox. Arrow/Home/End navigation, Enter/Space selection, Escape cancellation, type-ahead, Tab commitment and outside dismissal are supported. Menus are viewport-positioned and rendered inside the fullscreen element when active. A single imported trip is shown as a plain truncated folder name; its dropdown appears only with multiple trips.

Rewind/forward ten-second icons are single SVGs: the numeral and mirrored circular arrow share the same viewBox. Skip and play hit targets are 44px, skip icon artwork is 26px, and the play triangle receives a 1px optical centering correction. No platform-native dropdown popup or separately positioned skip numeral is used.
