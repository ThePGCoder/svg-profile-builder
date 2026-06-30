<<<<<<< HEAD
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
=======
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
>>>>>>> 99814148e953915233a5770163360fab95de26c4
