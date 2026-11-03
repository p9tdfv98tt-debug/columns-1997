# COLUMNS 1997

A retro-modern arcade falling-block puzzle game inspired by the 1990s Sega classic, built with HTML5 Canvas, Web Audio API, and modern CSS.

## Features

- **Retro-Modern Canvas Rendering**: Vector-drawn gems, flash combos, and particle effects.
- **Synthesized Audio**: In-browser audio engine generating sound effects, chimes, and synthwave music using the Web Audio API.
- **Responsive Layout**: Designed for both desktop keyboard play and mobile touch devices with virtual D-pad and action buttons.
- **Progressive Web App**: Offline play enabled via Service Worker cache.
- **Combos & High Scores**: Dynamic scoring, combo notifications, and persistent local high score tracking.

## Controls

### Desktop (Keyboard)
- **Move Left / Right**: Left / Right Arrow keys or `A` / `D`
- **Cycle Gems**: Up Arrow, `W`, or `Spacebar`
- **Drop**: Down Arrow, `S`, `Enter`, or `Shift`
- **Pause / Resume**: `P` key

### Mobile (Touch)
- **D-Pad**: Tap `←` and `→` to steer the falling column.
- **Actions**: Tap `CYCLE` to cycle the gems order, tap `DROP` to drop the column.
- **Gestures**: Swipe left/right to move, swipe down to drop, tap playfield to cycle.

## Project Structure

```
.
├── audio.js                         # Web Audio API sound synthesizers & music engine
├── columns_angel_sprite.png        # Title screen artwork
├── columns_title_bg_no_angels.png  # Title screen backdrop
├── game.js                          # Core game loop, mechanics, input & state
├── icon-192.png                     # PWA app icon (192x192)
├── icon-512.png                     # PWA app icon (512x512)
├── index.html                       # Game markup & cabinet structure
├── manifest.json                    # Web App Manifest
├── particles.js                     # Canvas particle explosion effects
├── styles.css                       # Arcade cabinet styling & responsive layouts
└── sw.js                            # Service Worker for offline play
```

## Getting Started

```bash
# Install development dependencies
npm install

# Run development server
npm run dev

# Build production bundle to dist/
npm run build
```

## Privacy & GDPR

- **Zero Tracking**: No analytics services, telemetry, or remote tracking scripts.
- **No Cookies**: No cookies are set or stored.
- **Local Data Only**: High score is stored strictly on the user's device via browser `localStorage` and is never transmitted externally.
