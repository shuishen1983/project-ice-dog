# project-ice-dog

Project ICE — a browser-based 2D hockey simulator. See `project-ice-spec/` for the full spec.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # headless simulation tests
npm run typecheck
```

Desktop controls: WASD/arrows move, J/Z pass, K/X shoot, L/C poke check, Shift boost, Space switch. Press `?` or Ctrl+H in-game for the overlay.

Touch controls (iPad, or any coarse-pointer device; force with `?touch=1`): left-zone floating joystick to skate, right-thumb buttons for PASS / SHOOT / POKE / BOOST / SWAP, tap a menu entry to start.

## iPad / iOS (Capacitor)

The iOS app is the same Vite build wrapped in a Capacitor shell (`capacitor.config.ts`, webDir `dist`). Generating and building the native project requires macOS with Xcode:

```bash
npm run ios:init   # first time: build web, generate ios/, sync
npm run ios:sync   # after web changes: rebuild + sync into ios/
npm run ios:open   # open in Xcode to run on device/simulator
```

Sign with your Apple team in Xcode for device installs and App Store distribution. The web deploy is unaffected by any of this.
