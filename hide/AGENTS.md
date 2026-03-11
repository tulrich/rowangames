# Hide

A stealth horror game built with Three.js and Vite.

## Development

- `npm run dev` - Start local development server (HMR enabled)
- `npm run build` - Build the project into a single static `dist/index.html` file
- `npm run watch` - Automatically monitor files and rebuild `dist/index.html` upon any changes

## Level Building

Levels are built using an ASCII-based map parser.

1. **Map Files**: Edit `.txt` files in `src/maps/`. Each character represents a grid cell in the game world (Z-axis is scaled by 2x to account for text character aspect ratios).
   - `+`, `-`, `|` = Walls (automatically sized and stretched to connect seamlessly with neighbors)
   - `"` = Window (contextually oriented on the X or Z axis based on adjacent walls)
   - `#` = Door (contextually oriented)
   - `*` = Loot
   - `X` = NPC (e.g., Conspiracist)
   - `C` = Security Camera
   - `S` = Player Start Position
2. **Compilation**: Run `npm run build:maps` to compile `.txt` maps into JSON-like ES modules in `src/obj/`. This runs automatically during `npm run dev` and `npm run build`.
3. **Engine Integration**: The generated data is imported into `src/main.js` and iterated over to cleanly instantiate 3D geometry and entities using the exact dimensions and orientations calculated by the parsing pipeline.
