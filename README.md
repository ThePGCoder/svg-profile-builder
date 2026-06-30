# CAD Profile Builder

A browser-based 2D profile editor for drawing construction cross-sections and exporting them as native Three.js path data.

---

## What it does

Traditional CAD-to-3D workflows require modelling a profile in external software, exporting to OBJ or GLTF, then importing and parsing that file at runtime — which means mesh overhead, file dependencies, and more work for the renderer.

CAD Profile Builder takes a different approach. You draw the cross-section shape directly in the browser, and it exports as lightweight `THREE.Shape` JavaScript path instructions. Three.js reads these natively to extrude the geometry on the fly — no mesh files, no import pipeline, no polygon bloat. Just a precise mathematical description of the profile that the renderer builds exactly once.

Designed for weatherboards, sill details, architrave profiles, custom timber sections, and any other construction cross-section that needs to be represented accurately in 3D.

---

## Features

**Drawing tools**
- Line tool with numeric length/angle input and 45° soft-snapping
- Arc tool — 3-point circle arc, or hold Shift for an eccentric bezier curve
- Select tool for moving points and editing segments

**Snapping**
- Snap to grid (configurable grid size)
- Snap to existing geometry points
- Snap to construction guides
- Horizontal, vertical, angled, and two-point construction guides
- Guide intersection snapping

**Path operations**
- Close path (line or arc close)
- Delete and replace segments
- Split segments at midpoint
- Convert between line, arc, and bezier segment types
- Flip arc direction
- Undo/redo

**Preview and export**
- Live 3D preview with extrudable depth control
- Material options: Standard (PBR), Phong, Lambert, Toon, Basic
- Color picker with construction-relevant presets
- Export as `THREE.Shape` JavaScript path code
- Save and load named profiles (localStorage)

**Reference image**
- Upload a manufacturer drawing or sketch as a reference underlay
- Adjustable opacity

---

## Export format

Profiles export as a JavaScript snippet using the Three.js `Shape` API:

```js
const shape = new THREE.Shape();
shape.moveTo(0, 0);
shape.lineTo(90, 0);
shape.absarc(45, 0, 45, 0, Math.PI, false);
shape.lineTo(0, 0);

const geometry = new THREE.ExtrudeGeometry(shape, {
  depth: 0.1,
  bevelEnabled: false,
});
```

Units are in metres (mm ÷ 1000) to match standard Three.js scene scale.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack) |
| UI | MUI v6, Iconify |
| Canvas | HTML5 Canvas 2D (custom renderer) |
| 3D Preview | React Three Fiber, Three.js, @react-three/drei |
| State | React `useState` / `useRef` / `useCallback` |
| Storage | `localStorage` (profiles), in-memory (session) |
| Language | TypeScript |

---

## Project structure

```
lib/
  types.ts          # Data model — EditorState, Subpath, Segment, Guide
  geometry.ts       # Snap resolution, arc math, guide intersection
  segments.ts       # Segment operations — add, delete, split, convert
  canvasRender.ts   # Canvas 2D renderer and hit testing
  storage.ts        # Profile persistence and THREE.Shape export

components/
  PathEditor.tsx    # Main orchestration — state, input handling, layout
  Toolbar.tsx       # Left sidebar — tools, snapping, view, image
  GuidesPanel.tsx   # Right sidebar — construction guides
  SegmentPanel.tsx  # Right sidebar — selected segment properties
  ProfilesPanel.tsx # Right sidebar — save/load profiles
  ExportPanel.tsx   # Right sidebar — code export
  ProfilePreview3D.tsx  # 3D preview modal
  ThemeProvider.tsx # MUI theme (light/dark, dynamic)
```

---

## License

MIT — free to use, modify, and build on.
