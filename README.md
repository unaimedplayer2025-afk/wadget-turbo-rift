# WADGET: TURBO RIFT

Play it here: https://unaimedplayer2025-afk.github.io/wadget-turbo-rift/

An off-road F-Zero-style browser racer. **Wadget**, a small black alien with glowing pink eyes, rides a turbo chained walrus fitted with rocket boosters, hover thrusters, and a chrome harness. Race three era tracks, grab Inspector Gadget-style pickups, and knock rivals off the line.

Open `index.html` from any static web server (ES modules need http, not `file://`).

## Controls
| | Desktop | Phone / tablet |
|---|---|---|
| Accelerate | W or ↑ | ACCEL |
| Brake | S or ↓ | BRAKE |
| Steer | A D or ← → | left-thumb stick |
| Use gadget | Space | GADGET |
| Boost | Shift | BOOST |
| Mute | M or the speaker button | speaker button |
| Pick track (title) | ← → | — |

Title screen: first input turns audio on and starts the intro theme, second input starts the countdown. The theme fades out and the gameplay track fades in.

On the title screen, ← → cycles **Storm Isle**, **Iron Prairie**, **The Source Grid**, and **Rift Cup**. Rift Cup is a 3-race championship (one race on each track). Places award 10 / 7 / 5 / 3 / 2 / 1 points; the racer with the most points after all three races wins the cup.

URL flags: `?demo` autopilot, `?capture` (autopilot trailer reel + externally stepped frames), `?track=isle|prairie|grid`, `?cup` (select Rift Cup on the title), `?lowfx`, `?hifx`, `?fps`, `?seed=` (reproducible runs).

## Tracks
- **PRE / Storm Isle** — volcanic dirt circuit, lava jump, muddy gully, banked hairpin.
- **1885 / Iron Prairie** — canyon run, trestle jump, a looping robot train, packed-dirt sweepers.
- **2199 / The Source Grid** — neon void circuit, banked corners, a mid-air gap (heli-blades help).

Each race is **3 laps** against **5 AI rivals**: Blazejaw, Iron Mare, Moo-Cycle, Grid Squid, and Bolt Bison.

## Gadgets
Pick up one at a time, then press Space:
- **Rocket** — a burst of raw speed
- **Spring** — a high jump, good for ramps and shortcuts
- **Grapple** — a hook that yanks you through a tight corner
- **Heli** — blades pop out and you glide over gaps
- **Glove** — a giant boxing glove that punches a rival aside

Boost pads refill the boost meter. Hold Shift to burn it.

## Music
- **Title / intro:** `audio/title-theme.ogg` with an `audio/title-theme.mp3` fallback for Safari/iOS. Swap these two files to change the splash song. The game picks the format with `canPlayType`.
- **Gameplay:** `audio/gameplay.{ogg,mp3}` loops during a race and crossfades with the title theme. A track may override this with `TRACKS[id].music = 'audio/my-track'` (base path; the same ogg/mp3 picker applies).

## Code
- `src/main.js` — game loop, input, physics, AI, gadgets, HUD, title, demo/capture director, music fade.
- `src/tracks.js` — spline tracks, ribbon meshes, scenery, projection, sky.
- `src/models.js` — Wadget on the turbo walrus, rivals, gadget pickups.
- `src/audio.js` — WebAudio SFX + engine + title theme (`audio/title-theme.{ogg,mp3}`).
- `src/util.js` — math, materials, canvas textures.
- `vendor/three` — Three.js r170 (MIT), vendored.

All characters and designs are original.
