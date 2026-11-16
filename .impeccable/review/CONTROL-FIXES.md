# Attached screenshot fixes

- Replaced separately positioned skip numerals with one SVG coordinate system; consistent 44px skip/play targets and mirrored circular arrows.
- Replaced OS-native speed, camera and multi-trip select popups with opaque, theme-controlled combobox menus. A lone trip is a plain folder name instead of a useless dropdown.
- Arrow/Home/End, Enter/Space, type-ahead, Escape cancellation, Tab commitment and outside dismissal are handled. Menu bounds are clamped to the viewport; fullscreen menus stay inside the fullscreen element.
- Tests verify actual speed changes, trip/camera switching, centred numerals, fullscreen presence, no viewport clipping at360px, keyboard/outside dismissal, and the existing playback/import flows.
- 31 unit tests, nine browser flows including the original archive, production build and formatting passed. The extra targeted final capture reconnects footage before the mobile screenshot.

The user moved the project during this work. Current app root is /Users/angshuman.barpujari/works/dashcam_player; footage is in ../horsley ride dashcam/video_full_ride. The stale old-root server was restarted from the new root at the same localhost URL. The user's staged Git index was left untouched.
