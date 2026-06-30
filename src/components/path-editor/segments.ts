import { arcThrough3Points, arcFromBulge, lerp, dist } from "./Geometry";
import {
  ArcSegment,
  BezierSegment,
  LineSegment,
  Point,
  Pt,
  Segment,
  Subpath,
} from "./types";

export function makeSubpath(): Subpath {
  return { id: crypto.randomUUID(), points: [], segments: [], closed: false };
}

export function findPoint(sub: Subpath, id: string): Point | undefined {
  return sub.points.find((p) => p.id === id);
}

export function segEndpoints(
  sub: Subpath,
  seg: Segment,
): { from: Point; to: Point } | null {
  const from = findPoint(sub, seg.fromId);
  const to = findPoint(sub, seg.toId);
  if (!from || !to) return null;
  return { from, to };
}

/** Ordered walk of a subpath: returns points in path order by following
 * segment chain from whichever point has no incoming segment (open path)
 * or arbitrarily for a closed loop. Falls back to points[] order if the
 * segment graph is inconsistent (shouldn't happen in normal use). */
export function orderedWalk(sub: Subpath): Point[] {
  if (sub.segments.length === 0) return sub.points;

  const incoming = new Map<string, string>(); // toId -> segId
  const outgoing = new Map<string, string>(); // fromId -> segId (last-write-wins)
  for (const s of sub.segments) {
    outgoing.set(s.fromId, s.id); // later segments overwrite earlier ones for same fromId
    incoming.set(s.toId, s.id);
  }

  let startId: string | undefined = sub.points[0]?.id;
  for (const p of sub.points) {
    if (!incoming.has(p.id)) {
      startId = p.id;
      break;
    }
  }
  if (!startId) return sub.points;

  const order: Point[] = [];
  const seen = new Set<string>();
  let curId: string | undefined = startId;
  while (curId && !seen.has(curId)) {
    const p = findPoint(sub, curId);
    if (!p) break;
    order.push(p);
    seen.add(curId);
    const segId = outgoing.get(curId);
    const seg = segId ? sub.segments.find((s) => s.id === segId) : undefined;
    curId = seg?.toId;
  }
  return order;
}

/** Add a new point at `pt`, connected from `fromId` via a line segment.
 * Returns the updated subpath. */
/** Add a new point connected via a bezier curve. cp1 and cp2 are absolute
 * mm coordinates of the two control points. For a smooth curve from the
 * previous segment, set cp1 = from + exit-handle and cp2 = to + enter-handle.
 * For a simple drag-handle bezier, both can be set from the drag vector. */
export function addBezierPoint(
  sub: Subpath,
  fromId: string,
  pt: Pt,
  cp1: Pt,
  cp2: Pt,
): { sub: Subpath; newPointId: string } {
  const newPoint: Point = { id: crypto.randomUUID(), x: pt.x, y: pt.y };
  const seg: BezierSegment = {
    id: crypto.randomUUID(),
    type: "bezier",
    fromId,
    toId: newPoint.id,
    cp1,
    cp2,
  };
  return {
    sub: {
      ...sub,
      points: [...sub.points, newPoint],
      segments: [...sub.segments, seg],
    },
    newPointId: newPoint.id,
  };
}

/** Connect two EXISTING points in the subpath with a bezier segment.
 * Unlike addBezierPoint, this does not create a new point — it's used
 * when the user picks two already-placed points as the curve endpoints
 * and just wants to define the shape between them. Returns the new
 * segment's id so handles can be updated during the drag phase. */
export function addBezierBetweenPoints(
  sub: Subpath,
  fromId: string,
  toId: string,
  cp1: Pt,
  cp2: Pt,
): { sub: Subpath; segmentId: string } {
  const segmentId = crypto.randomUUID();
  const seg: BezierSegment = {
    id: segmentId,
    type: "bezier",
    fromId,
    toId,
    cp1,
    cp2,
  };
  return {
    sub: { ...sub, segments: [...sub.segments, seg] },
    segmentId,
  };
}

/** Update the control points of an existing bezier segment (for handle dragging). */
export function updateBezierHandles(
  sub: Subpath,
  segmentId: string,
  cp1: Pt,
  cp2: Pt,
): Subpath {
  return {
    ...sub,
    segments: sub.segments.map((s) =>
      s.id === segmentId && s.type === "bezier" ? { ...s, cp1, cp2 } : s,
    ),
  };
}

export function addLinePoint(
  sub: Subpath,
  fromId: string | null,
  pt: Pt,
): {
  sub: Subpath;
  newPointId: string;
} {
  const newPoint: Point = { id: crypto.randomUUID(), x: pt.x, y: pt.y };
  const segments = [...sub.segments];
  if (fromId) {
    const seg: LineSegment = {
      id: crypto.randomUUID(),
      type: "line",
      fromId,
      toId: newPoint.id,
    };
    segments.push(seg);
  }
  return {
    sub: { ...sub, points: [...sub.points, newPoint], segments },
    newPointId: newPoint.id,
  };
}

/** Add a new arc segment from an existing point to a new end point,
 * passing through a third "through" point (typically the live cursor
 * position while dragging). This is the real CAD-style 3-point arc:
 * start and end are fixed by the user's clicks, the bow/direction is
 * whatever circle actually passes through all three. Falls back to a
 * straight line if the three points are collinear (no finite circle). */
export function addArcThrough3Points(
  sub: Subpath,
  fromId: string,
  endPt: Pt,
  throughPt: Pt,
): { sub: Subpath; newPointId: string } {
  const from = findPoint(sub, fromId);
  const newPoint: Point = { id: crypto.randomUUID(), x: endPt.x, y: endPt.y };
  if (!from) {
    return {
      sub: { ...sub, points: [...sub.points, newPoint] },
      newPointId: newPoint.id,
    };
  }
  const arc = arcThrough3Points(from, endPt, throughPt);
  let seg: Segment;
  if (arc) {
    seg = {
      id: crypto.randomUUID(),
      type: "arc",
      fromId,
      toId: newPoint.id,
      center: arc.center,
      cw: arc.cw,
      largeArc: arc.largeArc,
    };
  } else {
    // Collinear — no valid circle; degrade gracefully to a straight line
    // rather than producing a nonsensical arc.
    seg = { id: crypto.randomUUID(), type: "line", fromId, toId: newPoint.id };
  }
  return {
    sub: {
      ...sub,
      points: [...sub.points, newPoint],
      segments: [...sub.segments, seg],
    },
    newPointId: newPoint.id,
  };
}

/** Add a new point connected via an arc (bulge-style — simplest UX: drag
 * to set how far the arc bows from the straight line). Used for
 * after-the-fact bulge adjustment (SegmentPanel slider), not for the
 * primary draw-arc tool. */
export function addArcPoint(
  sub: Subpath,
  fromId: string,
  pt: Pt,
  bulgeMm: number,
): { sub: Subpath; newPointId: string } {
  const from = findPoint(sub, fromId);
  const newPoint: Point = { id: crypto.randomUUID(), x: pt.x, y: pt.y };
  if (!from) {
    return {
      sub: { ...sub, points: [...sub.points, newPoint] },
      newPointId: newPoint.id,
    };
  }
  const arc = arcFromBulge(from, pt, bulgeMm);
  const seg: ArcSegment = {
    id: crypto.randomUUID(),
    type: "arc",
    fromId,
    toId: newPoint.id,
    center: arc.center,
    cw: arc.cw,
    largeArc: arc.largeArc,
  };
  return {
    sub: {
      ...sub,
      points: [...sub.points, newPoint],
      segments: [...sub.segments, seg],
    },
    newPointId: newPoint.id,
  };
}

/** Close the path: add a final segment from the last point back to the
 * first, of the given type (line by default). */
export function closeSubpath(
  sub: Subpath,
  type: "line" | "arc" = "line",
  bulgeMm = 0,
): Subpath {
  const ordered = orderedWalk(sub);
  if (ordered.length < 2) return { ...sub, closed: true };
  const first = ordered[0];
  const last = ordered[ordered.length - 1];

  let seg: Segment;
  if (type === "arc") {
    const arc = arcFromBulge(last, first, bulgeMm);
    seg = {
      id: crypto.randomUUID(),
      type: "arc",
      fromId: last.id,
      toId: first.id,
      center: arc.center,
      cw: arc.cw,
      largeArc: arc.largeArc,
    };
  } else {
    seg = {
      id: crypto.randomUUID(),
      type: "line",
      fromId: last.id,
      toId: first.id,
    };
  }
  return { ...sub, segments: [...sub.segments, seg], closed: true };
}

/** Delete a segment. Leaves both endpoint points in place (so the user
 * can re-connect them) unless `pruneOrphans` removes points that end up
 * with zero connections. */
export function deleteSegment(
  sub: Subpath,
  segmentId: string,
  pruneOrphans = true,
): Subpath {
  const segments = sub.segments.filter((s) => s.id !== segmentId);
  if (!pruneOrphans) return { ...sub, segments, closed: false };

  const connected = new Set<string>();
  for (const s of segments) {
    connected.add(s.fromId);
    connected.add(s.toId);
  }
  const points = sub.points.filter((p) => connected.has(p.id));
  return { ...sub, segments, points, closed: false };
}

/** Delete a point: removes the point and any segments touching it,
 * bridging the gap with a new line segment between its former neighbours
 * (CAD-style "delete vertex, keep path connected"). Pass bridge=false to
 * just leave a gap instead. */
export function deletePoint(
  sub: Subpath,
  pointId: string,
  bridge = true,
): Subpath {
  const incomingSeg = sub.segments.find((s) => s.toId === pointId);
  const outgoingSeg = sub.segments.find((s) => s.fromId === pointId);

  let segments = sub.segments.filter(
    (s) => s.fromId !== pointId && s.toId !== pointId,
  );

  if (bridge && incomingSeg && outgoingSeg) {
    const bridgeSeg: LineSegment = {
      id: crypto.randomUUID(),
      type: "line",
      fromId: incomingSeg.fromId,
      toId: outgoingSeg.toId,
    };
    segments = [...segments, bridgeSeg];
  }

  const points = sub.points.filter((p) => p.id !== pointId);
  return { ...sub, points, segments, closed: false };
}

/** Split a segment at parameter t (0–1), inserting a new point and two
 * segments of the same type in place of the original. */
export function splitSegment(
  sub: Subpath,
  segmentId: string,
  t: number,
): Subpath {
  const seg = sub.segments.find((s) => s.id === segmentId);
  if (!seg) return sub;
  const from = findPoint(sub, seg.fromId);
  const to = findPoint(sub, seg.toId);
  if (!from || !to) return sub;

  let midPt: Pt;
  if (seg.type === "line") {
    midPt = lerp(from, to, t);
  } else if (seg.type === "arc") {
    const a0 = Math.atan2(from.y - seg.center.y, from.x - seg.center.x);
    const a1 = Math.atan2(to.y - seg.center.y, to.x - seg.center.x);
    const r = dist(seg.center, from);
    let sweep = seg.cw ? a0 - a1 : a1 - a0;
    sweep = ((sweep % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (seg.largeArc !== sweep > Math.PI) sweep = Math.PI * 2 - sweep;
    const dir = seg.cw ? -1 : 1;
    const a = a0 + dir * sweep * t;
    midPt = {
      x: seg.center.x + r * Math.cos(a),
      y: seg.center.y + r * Math.sin(a),
    };
  } else {
    // bezier — De Casteljau
    midPt = deCasteljau(from, seg.cp1, seg.cp2, to, t).pt;
  }

  const newPoint: Point = { id: crypto.randomUUID(), x: midPt.x, y: midPt.y };
  const segments = sub.segments.filter((s) => s.id !== segmentId);

  if (seg.type === "line") {
    segments.push(
      {
        id: crypto.randomUUID(),
        type: "line",
        fromId: seg.fromId,
        toId: newPoint.id,
      },
      {
        id: crypto.randomUUID(),
        type: "line",
        fromId: newPoint.id,
        toId: seg.toId,
      },
    );
  } else if (seg.type === "arc") {
    segments.push(
      {
        id: crypto.randomUUID(),
        type: "arc",
        fromId: seg.fromId,
        toId: newPoint.id,
        center: seg.center,
        cw: seg.cw,
        largeArc: false,
      },
      {
        id: crypto.randomUUID(),
        type: "arc",
        fromId: newPoint.id,
        toId: seg.toId,
        center: seg.center,
        cw: seg.cw,
        largeArc: false,
      },
    );
  } else {
    const { left, right } = deCasteljauSplit(from, seg.cp1, seg.cp2, to, t);
    segments.push(
      {
        id: crypto.randomUUID(),
        type: "bezier",
        fromId: seg.fromId,
        toId: newPoint.id,
        cp1: left.cp1,
        cp2: left.cp2,
      },
      {
        id: crypto.randomUUID(),
        type: "bezier",
        fromId: newPoint.id,
        toId: seg.toId,
        cp1: right.cp1,
        cp2: right.cp2,
      },
    );
  }

  return { ...sub, points: [...sub.points, newPoint], segments };
}

function deCasteljau(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number) {
  const a = lerp(p0, p1, t);
  const b = lerp(p1, p2, t);
  const c = lerp(p2, p3, t);
  const d = lerp(a, b, t);
  const e = lerp(b, c, t);
  const pt = lerp(d, e, t);
  return { pt, a, b, c, d, e };
}

function deCasteljauSplit(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number) {
  const { a, d, e, pt } = deCasteljau(p0, p1, p2, p3, t);
  return {
    left: { cp1: a, cp2: d },
    right: { cp1: e, cp2: deCasteljau(p0, p1, p2, p3, t).c },
    mid: pt,
  };
}

/** Recompute an arc segment's center/cw/largeArc for a new bulge amount,
 * keeping its endpoints fixed. No-op if the segment isn't an arc. */
export function setArcBulge(
  sub: Subpath,
  segmentId: string,
  bulgeMm: number,
): Subpath {
  const seg = sub.segments.find((s) => s.id === segmentId);
  if (!seg || seg.type !== "arc") return sub;
  const ends = segEndpoints(sub, seg);
  if (!ends) return sub;
  const arc = arcFromBulge(ends.from, ends.to, bulgeMm);
  const newSeg: ArcSegment = {
    ...seg,
    center: arc.center,
    cw: arc.cw,
    largeArc: arc.largeArc,
  };
  return {
    ...sub,
    segments: sub.segments.map((s) => (s.id === segmentId ? newSeg : s)),
  };
}

/** Convert a segment to a different type, preserving endpoints. Arc gets
 * a default gentle bulge; bezier gets straight-line-equivalent handles. */
export function convertSegment(
  sub: Subpath,
  segmentId: string,
  newType: "line" | "arc" | "bezier",
): Subpath {
  const seg = sub.segments.find((s) => s.id === segmentId);
  if (!seg) return sub;
  const ends = segEndpoints(sub, seg);
  if (!ends) return sub;
  const { from, to } = ends;

  let newSeg: Segment;
  if (newType === "line") {
    newSeg = { id: seg.id, type: "line", fromId: seg.fromId, toId: seg.toId };
  } else if (newType === "arc") {
    const chordLen = dist(from, to);
    const arc = arcFromBulge(from, to, chordLen * 0.25);
    newSeg = {
      id: seg.id,
      type: "arc",
      fromId: seg.fromId,
      toId: seg.toId,
      center: arc.center,
      cw: arc.cw,
      largeArc: arc.largeArc,
    };
  } else {
    const third = {
      x: from.x + (to.x - from.x) / 3,
      y: from.y + (to.y - from.y) / 3,
    };
    const twoThird = {
      x: from.x + ((to.x - from.x) * 2) / 3,
      y: from.y + ((to.y - from.y) * 2) / 3,
    };
    newSeg = {
      id: seg.id,
      type: "bezier",
      fromId: seg.fromId,
      toId: seg.toId,
      cp1: third,
      cp2: twoThird,
    };
  }

  return {
    ...sub,
    segments: sub.segments.map((s) => (s.id === segmentId ? newSeg : s)),
  };
}

/** Hit-test: closest segment to a canvas-space point, in mm-space
 * distance terms (caller converts threshold from px). */
export function closestSegment(
  sub: Subpath,
  pt: Pt,
  maxDistMm: number,
): { segment: Segment; t: number; distMm: number; point: Pt } | null {
  let best: { segment: Segment; t: number; distMm: number; point: Pt } | null =
    null;

  for (const seg of sub.segments) {
    const ends = segEndpoints(sub, seg);
    if (!ends) continue;
    const { from, to } = ends;

    if (seg.type === "line") {
      const { t, point } = closestPointOnSegmentLine(from, to, pt);
      const d = dist(point, pt);
      if (d <= maxDistMm && (!best || d < best.distMm)) {
        best = { segment: seg, t, distMm: d, point };
      }
    } else if (seg.type === "arc") {
      const r = dist(seg.center, from);
      const angToPt = Math.atan2(pt.y - seg.center.y, pt.x - seg.center.x);
      const point = {
        x: seg.center.x + r * Math.cos(angToPt),
        y: seg.center.y + r * Math.sin(angToPt),
      };
      const d = dist(point, pt);
      if (d <= maxDistMm && (!best || d < best.distMm)) {
        best = { segment: seg, t: 0.5, distMm: d, point };
      }
    } else {
      // bezier — coarse sample
      let bestT = 0;
      let bestPt: Pt = from;
      let bestD = Infinity;
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const sample = deCasteljau(from, seg.cp1, seg.cp2, to, t).pt;
        const d = dist(sample, pt);
        if (d < bestD) {
          bestD = d;
          bestT = t;
          bestPt = sample;
        }
      }
      if (bestD <= maxDistMm && (!best || bestD < best.distMm)) {
        best = { segment: seg, t: bestT, distMm: bestD, point: bestPt };
      }
    }
  }
  return best;
}

function closestPointOnSegmentLine(a: Pt, b: Pt, p: Pt) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1e-9;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { t, point: { x: a.x + dx * t, y: a.y + dy * t } };
}
