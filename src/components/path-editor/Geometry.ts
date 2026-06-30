import { Guide, Point, Pt, Segment, SnapResult, Subpath } from "./types";

const EPS = 1e-9;

export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Soft-snap an angle (radians) to the nearest 45° increment (0, 45, 90,
 * 135, 180, 225, 270, 315) if within `toleranceDeg` of it, otherwise
 * return the angle unchanged. This is the "draw roughly horizontal and
 * have it snap straight" convenience CAD tools use for corners/chamfers. */
export function snapAngleToCommon(angleRad: number, toleranceDeg = 6): number {
  const STEP = 45;
  const deg = (angleRad * 180) / Math.PI;
  const nearest = Math.round(deg / STEP) * STEP;
  if (Math.abs(deg - nearest) <= toleranceDeg) {
    return (nearest * Math.PI) / 180;
  }
  return angleRad;
}

export function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// ── Guides → infinite line representation ──────────────────────
// Every guide reduces to a point + direction vector so we can do
// generic line-line intersection regardless of guide kind.

interface InfLine {
  p: Pt;
  dx: number;
  dy: number;
}

export function guideToLine(g: Guide): InfLine {
  switch (g.kind) {
    case "h":
      return { p: { x: 0, y: g.y }, dx: 1, dy: 0 };
    case "v":
      return { p: { x: g.x, y: 0 }, dx: 0, dy: 1 };
    case "angled": {
      const rad = (g.angleDeg * Math.PI) / 180;
      return { p: g.through, dx: Math.cos(rad), dy: Math.sin(rad) };
    }
    case "points":
      return { p: g.a, dx: g.b.x - g.a.x, dy: g.b.y - g.a.y };
  }
}

/** Intersection of two infinite lines, or null if parallel. */
export function lineLineIntersect(l1: InfLine, l2: InfLine): Pt | null {
  const denom = l1.dx * l2.dy - l1.dy * l2.dx;
  if (Math.abs(denom) < EPS) return null;
  const dx = l2.p.x - l1.p.x;
  const dy = l2.p.y - l1.p.y;
  const t = (dx * l2.dy - dy * l2.dx) / denom;
  return { x: l1.p.x + l1.dx * t, y: l1.p.y + l1.dy * t };
}

export function allGuideIntersections(guides: Guide[]): Pt[] {
  const lines = guides.map(guideToLine);
  const pts: Pt[] = [];
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const hit = lineLineIntersect(lines[i], lines[j]);
      if (hit) pts.push(hit);
    }
  }
  return pts;
}

/** Closest point on a guide's infinite line to a given point. */
export function closestPointOnGuide(g: Guide, p: Pt): Pt {
  const l = guideToLine(g);
  const len2 = l.dx * l.dx + l.dy * l.dy || 1;
  const t = ((p.x - l.p.x) * l.dx + (p.y - l.p.y) * l.dy) / len2;
  return { x: l.p.x + l.dx * t, y: l.p.y + l.dy * t };
}

// ── Geometry (points/midpoints) to snap to ─────────────────────

export function allGeometryPoints(subpaths: Subpath[]): Point[] {
  return subpaths.flatMap((s) => s.points);
}

export function allSegmentMidpoints(subpaths: Subpath[]): Pt[] {
  const out: Pt[] = [];
  for (const sub of subpaths) {
    for (const seg of sub.segments) {
      const from = sub.points.find((p) => p.id === seg.fromId);
      const to = sub.points.find((p) => p.id === seg.toId);
      if (!from || !to) continue;
      if (seg.type === "line") {
        out.push(lerp(from, to, 0.5));
      } else if (seg.type === "arc") {
        // midpoint along the arc sweep
        const a0 = Math.atan2(from.y - seg.center.y, from.x - seg.center.x);
        const a1 = Math.atan2(to.y - seg.center.y, to.x - seg.center.x);
        const r = dist(seg.center, from);
        const mid = arcMidAngle(a0, a1, seg.cw, seg.largeArc);
        out.push({
          x: seg.center.x + r * Math.cos(mid),
          y: seg.center.y + r * Math.sin(mid),
        });
      }
    }
  }
  return out;
}

function arcMidAngle(
  a0: number,
  a1: number,
  cw: boolean,
  largeArc: boolean,
): number {
  let sweep = cw ? a0 - a1 : a1 - a0;
  sweep = ((sweep % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  if (largeArc && sweep < Math.PI) sweep = Math.PI * 2 - sweep;
  if (!largeArc && sweep > Math.PI) sweep = Math.PI * 2 - sweep;
  const dir = cw ? -1 : 1;
  return a0 + dir * (sweep / 2);
}

// ── Snap resolution ─────────────────────────────────────────────
// Priority: existing geometry point > guide intersection > single guide
// > grid. Pixel-space thresholds passed in (already account for zoom).

export interface SnapInputs {
  cursorMm: Pt;
  subpaths: Subpath[];
  guides: Guide[];
  gridSizeMm: number;
  snapToGrid: boolean;
  snapToGuides: boolean;
  snapToGeometry: boolean;
  /** snap radius in mm (i.e. px-radius / zoom) */
  radiusMm: number;
  excludePointId?: string | null;
}

export function resolveSnap(inp: SnapInputs): SnapResult {
  const {
    cursorMm,
    subpaths,
    guides,
    gridSizeMm,
    snapToGrid,
    snapToGuides,
    snapToGeometry,
    radiusMm,
    excludePointId,
  } = inp;

  // 1. Existing points (highest priority — never want to miss a join)
  if (snapToGeometry) {
    const pts = allGeometryPoints(subpaths).filter(
      (p) => p.id !== excludePointId,
    );
    let best: Point | null = null;
    let bestD = radiusMm;
    for (const p of pts) {
      const d = dist(p, cursorMm);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (best)
      return { x: best.x, y: best.y, source: "point", refIds: [best.id] };

    const mids = allSegmentMidpoints(subpaths);
    let bestMid: Pt | null = null;
    let bestMidD = radiusMm;
    for (const m of mids) {
      const d = dist(m, cursorMm);
      if (d < bestMidD) {
        bestMidD = d;
        bestMid = m;
      }
    }
    if (bestMid) return { ...bestMid, source: "segment-midpoint", refIds: [] };
  }

  // 2. Guide intersections — checked before single-guide snapping. Note
  // these can't be compared by raw distance: the perpendicular foot onto
  // an infinite line is, by definition, always at least as close to the
  // cursor as any specific point on that line (like an intersection), so
  // a naive "closest wins" comparison would let single-guide snapping
  // win almost every time even when the cursor is sitting right on a
  // crossing. Instead: if an intersection is within radius at all, it
  // takes priority outright.
  if (snapToGuides && guides.length >= 2) {
    const lines = guides.map((g) => ({ id: g.id, line: guideToLine(g) }));
    let best: { pt: Pt; d: number; ids: [string, string] } | null = null;
    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        const hit = lineLineIntersect(lines[i].line, lines[j].line);
        if (!hit) continue;
        const d = dist(hit, cursorMm);
        if (d < radiusMm && (!best || d < best.d)) {
          best = { pt: hit, d, ids: [lines[i].id, lines[j].id] };
        }
      }
    }
    if (best) {
      return {
        ...best.pt,
        source: "guide-intersection",
        refIds: [...best.ids],
      };
    }
  }

  // 3. Single guide (snap perpendicular onto the line)
  if (snapToGuides && guides.length >= 1) {
    let best: { pt: Pt; d: number; id: string } | null = null;
    for (const g of guides) {
      const onLine = closestPointOnGuide(g, cursorMm);
      const d = dist(onLine, cursorMm);
      if (d < radiusMm && (!best || d < best.d)) {
        best = { pt: onLine, d, id: g.id };
      }
    }
    if (best) {
      return { ...best.pt, source: "guide", refIds: [best.id] };
    }
  }

  // 4. Grid
  if (snapToGrid) {
    return {
      x: Math.round(cursorMm.x / gridSizeMm) * gridSizeMm,
      y: Math.round(cursorMm.y / gridSizeMm) * gridSizeMm,
      source: "grid",
      refIds: [],
    };
  }

  return { ...cursorMm, source: "none", refIds: [] };
}

// ── Arc construction helpers ────────────────────────────────────

/** Build an arc segment through 3 points (start, end, and a point it
 * should pass through), solving for center/radius. Returns null if
 * the three points are collinear (no finite circle). */
export function arcThrough3Points(
  start: Pt,
  end: Pt,
  through: Pt,
): { center: Pt; radius: number; cw: boolean; largeArc: boolean } | null {
  const ax = start.x,
    ay = start.y;
  const bx = through.x,
    by = through.y;
  const cx = end.x,
    cy = end.y;

  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < EPS) return null;

  const ux =
    ((ax * ax + ay * ay) * (by - cy) +
      (bx * bx + by * by) * (cy - ay) +
      (cx * cx + cy * cy) * (ay - by)) /
    d;
  const uy =
    ((ax * ax + ay * ay) * (cx - bx) +
      (bx * bx + by * by) * (ax - cx) +
      (cx * cx + cy * cy) * (bx - ax)) /
    d;

  const center = { x: ux, y: uy };
  const radius = dist(center, start);

  // Determine sweep direction + large-arc flag from the through-point.
  const a0 = Math.atan2(start.y - center.y, start.x - center.x);
  const a1 = Math.atan2(end.y - center.y, end.x - center.x);
  const aThrough = Math.atan2(through.y - center.y, through.x - center.x);

  const norm = (a: number) =>
    ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const n0 = norm(a0),
    n1 = norm(a1),
    nT = norm(aThrough);

  // sweep CCW from n0: does it pass through nT before reaching n1?
  const ccwSweep = norm(n1 - n0);
  const ccwThroughPos = norm(nT - n0);
  const goesCCW = ccwThroughPos < ccwSweep;

  const cw = !goesCCW;
  const sweep = cw ? norm(n0 - n1) : ccwSweep;
  const largeArc = sweep > Math.PI;

  return { center, radius, cw, largeArc };
}

/** Radius/bulge-based arc: given start, end and a signed bulge (sagitta
 * direction), compute center. Positive bulge = arcs to the left of A→B. */
export function arcFromBulge(
  start: Pt,
  end: Pt,
  bulgeMm: number,
): { center: Pt; radius: number; cw: boolean; largeArc: boolean } {
  const mx = (start.x + end.x) / 2;
  const my = (start.y + end.y) / 2;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const chordLen = Math.hypot(dx, dy) || EPS;
  const nx = -dy / chordLen;
  const ny = dx / chordLen;

  const sagitta = bulgeMm;
  const apex = { x: mx + nx * sagitta, y: my + ny * sagitta };

  const result = arcThrough3Points(start, end, apex);
  if (result) return result;
  // Degenerate (straight) fallback
  return {
    center: { x: mx, y: my },
    radius: chordLen / 2,
    cw: false,
    largeArc: false,
  };
}

export function arcAngles(seg: { center: Pt }, from: Pt, to: Pt) {
  return {
    a0: Math.atan2(from.y - seg.center.y, from.x - seg.center.x),
    a1: Math.atan2(to.y - seg.center.y, to.x - seg.center.x),
  };
}
