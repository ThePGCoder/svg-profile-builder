// ── Core geometry ──────────────────────────────────────────────

export interface Pt {
  x: number;
  y: number;
}

export interface Point extends Pt {
  id: string;
}

export type SegmentType = "line" | "arc" | "bezier";

export interface LineSegment {
  id: string;
  type: "line";
  fromId: string;
  toId: string;
}

export interface ArcSegment {
  id: string;
  type: "arc";
  fromId: string;
  toId: string;
  center: Pt;
  /** true = clockwise sweep from `from` to `to` */
  cw: boolean;
  /** large-arc flag, SVG-style: take the long way round */
  largeArc: boolean;
}

export interface BezierSegment {
  id: string;
  type: "bezier";
  fromId: string;
  toId: string;
  /** control point 1, absolute mm coords */
  cp1: Pt;
  /** control point 2, absolute mm coords */
  cp2: Pt;
}

export type Segment = LineSegment | ArcSegment | BezierSegment;

export interface Subpath {
  id: string;
  points: Point[];
  segments: Segment[];
  closed: boolean;
}

export interface Profile {
  id: string;
  name: string;
  subpaths: Subpath[];
  createdAt: number;
  updatedAt: number;
}

// ── Guides ──────────────────────────────────────────────────────

export type Guide =
  | { id: string; kind: "h"; y: number; label?: string }
  | { id: string; kind: "v"; x: number; label?: string }
  | {
      id: string;
      kind: "angled";
      through: Pt;
      angleDeg: number; // 0 = pointing along +x
      label?: string;
    }
  | {
      id: string;
      kind: "points";
      a: Pt;
      b: Pt;
      label?: string;
    };

// ── Tools ───────────────────────────────────────────────────────

export type ToolMode =
  | "draw-line"
  | "draw-arc"
  | "select"
  | "guide-h"
  | "guide-v"
  | "guide-angled"
  | "guide-points";

export interface EditorState {
  subpaths: Subpath[];
  activeSubpathId: string;
  guides: Guide[];

  selectedPointId: string | null;
  selectedSegmentId: string | null;
  hoveredPointId: string | null;
  hoveredSegmentId: string | null;
  hoveredGuideId: string | null;

  tool: ToolMode;

  zoom: number;
  panX: number;
  panY: number;

  snapToGrid: boolean;
  gridSizeMm: number;
  showGrid: boolean;
  snapToGuides: boolean;
  snapToGeometry: boolean; // existing points/segment endpoints/midpoints

  imageUrl: string | null;
  imageOpacity: number;
  imageScale: number;
  imageOffsetX: number;
  imageOffsetY: number;
}

// ── Snap result ─────────────────────────────────────────────────

export type SnapSourceKind =
  | "grid"
  | "guide"
  | "guide-intersection"
  | "point"
  | "segment-midpoint"
  | "none";

export interface SnapResult extends Pt {
  source: SnapSourceKind;
  /** ids of guides/points involved, for highlighting */
  refIds: string[];
}
