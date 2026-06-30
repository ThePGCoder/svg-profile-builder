import { useEffect, RefObject } from "react";
import {
  EditorState,
  Guide,
  Point,
  Pt,
  Segment,
  SnapSourceKind,
  Subpath,
} from "./types";
import { closestSegment, findPoint, segEndpoints } from "./segments";
import {
  arcThrough3Points,
  closestPointOnGuide,
  dist,
  snapAngleToCommon,
} from "./Geometry";

const POINT_RADIUS = 5;
const HOVER_RADIUS_PX = 10;
const SEGMENT_HIT_PX = 8;

export function canvasToMm(
  clientX: number,
  clientY: number,
  state: EditorState,
  canvas: HTMLCanvasElement,
): Pt {
  const rect = canvas.getBoundingClientRect();
  const w = canvas.clientWidth,
    h = canvas.clientHeight;
  const originX = w / 2 + state.panX,
    originY = h / 2 + state.panY;
  return {
    x: (clientX - rect.left - originX) / state.zoom,
    y: (clientY - rect.top - originY) / state.zoom,
  };
}

export function mmToCanvas(
  x: number,
  y: number,
  state: EditorState,
  canvas: HTMLCanvasElement,
) {
  const w = canvas.clientWidth,
    h = canvas.clientHeight;
  const originX = w / 2 + state.panX,
    originY = h / 2 + state.panY;
  return { px: originX + x * state.zoom, py: originY + y * state.zoom };
}

// ── Hit testing ───────────────────────────────────────────────

export function hitTestPoint(
  mx: number,
  my: number,
  subpaths: Subpath[],
  state: EditorState,
  canvas: HTMLCanvasElement,
): string | null {
  const allPoints = subpaths.flatMap((s) => s.points);
  let bestId: string | null = null;
  let bestD = HOVER_RADIUS_PX;
  for (const p of allPoints) {
    const { px, py } = mmToCanvas(p.x, p.y, state, canvas);
    const d = Math.hypot(mx - px, my - py);
    if (d < bestD) {
      bestD = d;
      bestId = p.id;
    }
  }
  return bestId;
}

export function hitTestSegment(
  mx: number,
  my: number,
  sub: Subpath,
  state: EditorState,
  canvas: HTMLCanvasElement,
): string | null {
  const mm = canvasToMm(mx, my, state, canvas);
  const maxDistMm = SEGMENT_HIT_PX / state.zoom;
  const hit = closestSegment(sub, mm, maxDistMm);
  return hit ? hit.segment.id : null;
}

export function hitTestGuide(
  mx: number,
  my: number,
  guides: Guide[],
  state: EditorState,
  canvas: HTMLCanvasElement,
): string | null {
  const mm = canvasToMm(mx, my, state, canvas);
  const maxDistMm = SEGMENT_HIT_PX / state.zoom;
  let bestId: string | null = null;
  let bestD = maxDistMm;
  for (const g of guides) {
    const onLine = closestPointOnGuide(g, mm);
    const d = dist(onLine, mm);
    if (d < bestD) {
      bestD = d;
      bestId = g.id;
    }
  }
  return bestId;
}

// ── Drawing helpers ──────────────────────────────────────────

function drawGuide(
  ctx: CanvasRenderingContext2D,
  g: Guide,
  state: EditorState,
  canvas: HTMLCanvasElement,
  color: string,
  highlighted: boolean,
) {
  const w = canvas.clientWidth,
    h = canvas.clientHeight;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = highlighted ? 1.5 : 1;
  ctx.setLineDash(highlighted ? [] : [5, 4]);

  if (g.kind === "h") {
    const { py } = mmToCanvas(0, g.y, state, canvas);
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(w, py);
    ctx.stroke();
  } else if (g.kind === "v") {
    const { px } = mmToCanvas(g.x, 0, state, canvas);
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, h);
    ctx.stroke();
  } else if (g.kind === "angled") {
    const rad = (g.angleDeg * Math.PI) / 180;
    const dx = Math.cos(rad),
      dy = Math.sin(rad);
    const far = 5000; // mm, plenty to cross the viewport
    const p1 = mmToCanvas(
      g.through.x - dx * far,
      g.through.y - dy * far,
      state,
      canvas,
    );
    const p2 = mmToCanvas(
      g.through.x + dx * far,
      g.through.y + dy * far,
      state,
      canvas,
    );
    ctx.beginPath();
    ctx.moveTo(p1.px, p1.py);
    ctx.lineTo(p2.px, p2.py);
    ctx.stroke();
  } else {
    const dx = g.b.x - g.a.x,
      dy = g.b.y - g.a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len,
      uy = dy / len;
    const far = 5000;
    const p1 = mmToCanvas(g.a.x - ux * far, g.a.y - uy * far, state, canvas);
    const p2 = mmToCanvas(g.b.x + ux * far, g.b.y + uy * far, state, canvas);
    ctx.beginPath();
    ctx.moveTo(p1.px, p1.py);
    ctx.lineTo(p2.px, p2.py);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function drawSegmentPath(
  ctx: CanvasRenderingContext2D,
  sub: Subpath,
  state: EditorState,
  canvas: HTMLCanvasElement,
  color: string,
  selectedSegId: string | null,
  hoveredSegId: string | null,
  selColor: string,
) {
  for (const seg of sub.segments) {
    const ends = segEndpoints(sub, seg);
    if (!ends) continue;
    const { from, to } = ends;
    const isSel = seg.id === selectedSegId;
    const isHover = seg.id === hoveredSegId;

    ctx.save();
    ctx.strokeStyle = isSel ? selColor : color;
    ctx.lineWidth = isSel ? 3 : isHover ? 2.5 : 1.5;
    ctx.beginPath();

    const p0 = mmToCanvas(from.x, from.y, state, canvas);
    if (seg.type === "line") {
      const p1 = mmToCanvas(to.x, to.y, state, canvas);
      ctx.moveTo(p0.px, p0.py);
      ctx.lineTo(p1.px, p1.py);
    } else if (seg.type === "arc") {
      const center = mmToCanvas(seg.center.x, seg.center.y, state, canvas);
      const r = Math.hypot(p0.px - center.px, p0.py - center.py);
      const a0 = Math.atan2(p0.py - center.py, p0.px - center.px);
      const p1 = mmToCanvas(to.x, to.y, state, canvas);
      const a1 = Math.atan2(p1.py - center.py, p1.px - center.px);
      // mmToCanvas is a pure scale+translate (no axis mirroring — verified:
      // py = originY + y*zoom, same sign as mm-space y), so the rotational
      // sense is preserved exactly. seg.cw was already solved in this same
      // non-mirrored space by arcThrough3Points, so it's used directly —
      // inverting it here was the actual bug (it produced the long way
      // round instead of the short way through the clicked bow point).
      ctx.arc(center.px, center.py, r, a0, a1, seg.cw);
    } else {
      const c1 = mmToCanvas(seg.cp1.x, seg.cp1.y, state, canvas);
      const c2 = mmToCanvas(seg.cp2.x, seg.cp2.y, state, canvas);
      const p1 = mmToCanvas(to.x, to.y, state, canvas);
      ctx.moveTo(p0.px, p0.py);
      ctx.bezierCurveTo(c1.px, c1.py, c2.px, c2.py, p1.px, p1.py);
    }
    ctx.stroke();
    ctx.restore();
  }
}

// ── Main render hook ─────────────────────────────────────────

export function useCanvasRender(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  state: EditorState,
  imageRef: RefObject<HTMLImageElement | null>,
  cursorMm: Pt | null,
  lightMode: boolean,
  numericInput: string,
  angleInput: string,
  snapRefIds: string[],
  drawFromPointId: string | null,
  arcEndPt: Pt | null,
  shiftHeld: boolean,
  snapSource: SnapSourceKind,
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn("[PathEditor] canvasRef.current is null on render effect");
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.warn("[PathEditor] getContext('2d') returned null");
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth,
      h = canvas.clientHeight;

    if (w === 0 || h === 0) {
      console.warn(
        `[PathEditor] canvas has zero size at paint time (clientWidth=${w}, clientHeight=${h}). ` +
          `Parent layout likely hasn't given it space yet.`,
      );
    }
    if (
      canvas.width !== Math.round(w * dpr) ||
      canvas.height !== Math.round(h * dpr)
    ) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = lightMode ? "#f8f9fa" : "#0f0f23";
    ctx.fillRect(0, 0, w, h);

    const originX = w / 2 + state.panX,
      originY = h / 2 + state.panY;

    // Reference image
    if (imageRef.current && state.imageUrl) {
      ctx.save();
      ctx.globalAlpha = state.imageOpacity;
      const img = imageRef.current;
      const iw = img.naturalWidth * state.imageScale * state.zoom;
      const ih = img.naturalHeight * state.imageScale * state.zoom;
      ctx.drawImage(
        img,
        originX + state.imageOffsetX * state.zoom - iw / 2,
        originY + state.imageOffsetY * state.zoom - ih / 2,
        iw,
        ih,
      );
      ctx.restore();
    }

    // Grid — minor lines every gridSizeMm, major (bolder) lines every 5th
    // step, so the grid reads clearly instead of a uniform faint wash.
    if (state.showGrid) {
      const gridPx = state.gridSizeMm * state.zoom;
      const MAJOR_EVERY = 5;
      ctx.save();
      ctx.lineWidth = 1;

      const minorCol = lightMode
        ? "rgba(0,0,0,0.06)"
        : "rgba(255,255,255,0.06)";
      const majorCol = lightMode
        ? "rgba(0,0,0,0.16)"
        : "rgba(255,255,255,0.16)";

      // Index of the first visible line relative to the origin, so we can
      // tell which lines land on a major step.
      const firstXIdx = Math.ceil(-originX / gridPx);
      for (let i = firstXIdx; originX + i * gridPx < w; i++) {
        const x = originX + i * gridPx;
        if (x < 0) continue;
        ctx.strokeStyle = i % MAJOR_EVERY === 0 ? majorCol : minorCol;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      const firstYIdx = Math.ceil(-originY / gridPx);
      for (let i = firstYIdx; originY + i * gridPx < h; i++) {
        const y = originY + i * gridPx;
        if (y < 0) continue;
        ctx.strokeStyle = i % MAJOR_EVERY === 0 ? majorCol : minorCol;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Origin axes — bolder than even the major lines.
      ctx.strokeStyle = lightMode ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(originX, 0);
      ctx.lineTo(originX, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, originY);
      ctx.lineTo(w, originY);
      ctx.stroke();
      ctx.restore();
    }

    // Guides
    const guideColor = lightMode
      ? "rgba(255,111,0,0.65)"
      : "rgba(255,171,64,0.55)";
    const guideHighlight = lightMode ? "#e65100" : "#ffab40";
    for (const g of state.guides) {
      const isHighlighted =
        g.id === state.hoveredGuideId || snapRefIds.includes(g.id);
      drawGuide(
        ctx,
        g,
        state,
        canvas,
        isHighlighted ? guideHighlight : guideColor,
        isHighlighted,
      );
    }
    // Guide intersection markers (small + crosses) when 2+ guides exist
    if (state.guides.length >= 2 && state.snapToGuides) {
      ctx.save();
      ctx.strokeStyle = guideColor;
      ctx.lineWidth = 1;
      const lines = state.guides;
      for (let i = 0; i < lines.length; i++) {
        for (let j = i + 1; j < lines.length; j++) {
          // recompute via closestPointOnGuide trick: project a's through
          // point isn't generic enough — reuse geometry module instead
        }
      }
      ctx.restore();
    }

    const subpaths = state.subpaths;
    const activeSub = subpaths.find((s) => s.id === state.activeSubpathId);
    const selColor = "#ff5252";
    const activeColor = "#4fc3f7";
    const dimColor = lightMode ? "rgba(0,0,0,0.25)" : "rgba(79,195,247,0.3)";

    // Segments
    subpaths.forEach((sub) => {
      const isActive = sub.id === state.activeSubpathId;
      drawSegmentPath(
        ctx,
        sub,
        state,
        canvas,
        isActive ? activeColor : dimColor,
        isActive ? state.selectedSegmentId : null,
        isActive ? state.hoveredSegmentId : null,
        selColor,
      );
    });

    // Bezier handle visualization — show cp1/cp2 as draggable diamonds
    // with stem lines when a bezier segment is selected.
    if (state.selectedSegmentId && activeSub) {
      const seg = activeSub.segments.find(
        (s) => s.id === state.selectedSegmentId,
      );
      if (seg && seg.type === "bezier") {
        const from = findPoint(activeSub, seg.fromId);
        const to = findPoint(activeSub, seg.toId);
        if (from && to) {
          const pFrom = mmToCanvas(from.x, from.y, state, canvas);
          const pTo = mmToCanvas(to.x, to.y, state, canvas);
          const pCp1 = mmToCanvas(seg.cp1.x, seg.cp1.y, state, canvas);
          const pCp2 = mmToCanvas(seg.cp2.x, seg.cp2.y, state, canvas);
          const handleColor = "#e040fb";
          ctx.save();
          ctx.strokeStyle = lightMode
            ? "rgba(0,0,0,0.3)"
            : "rgba(255,255,255,0.3)";
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(pFrom.px, pFrom.py);
          ctx.lineTo(pCp1.px, pCp1.py);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(pTo.px, pTo.py);
          ctx.lineTo(pCp2.px, pCp2.py);
          ctx.stroke();
          ctx.setLineDash([]);
          for (const { px, py } of [pCp1, pCp2]) {
            const R = 5;
            ctx.beginPath();
            ctx.moveTo(px, py - R);
            ctx.lineTo(px + R, py);
            ctx.lineTo(px, py + R);
            ctx.lineTo(px - R, py);
            ctx.closePath();
            ctx.fillStyle = "#fff";
            ctx.fill();
            ctx.strokeStyle = handleColor;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    }

    // Live preview from drawFromPointId to cursor (arc tool)
    if (drawFromPointId && cursorMm && activeSub && state.tool === "draw-arc") {
      const from = findPoint(activeSub, drawFromPointId);
      if (from) {
        ctx.save();
        ctx.strokeStyle = lightMode
          ? "rgba(0,60,120,0.75)"
          : "rgba(79,195,247,0.4)";
        ctx.lineWidth = 1.5;

        if (!arcEndPt) {
          // Stage 1: haven't fixed the end point yet — show a plain
          // dashed guide line to the cursor (prospective end point).
          const p0 = mmToCanvas(from.x, from.y, state, canvas);
          const p1 = mmToCanvas(cursorMm.x, cursorMm.y, state, canvas);
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(p0.px, p0.py);
          ctx.lineTo(p1.px, p1.py);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.arc(p1.px, p1.py, 3, 0, Math.PI * 2);
          ctx.fillStyle = lightMode
            ? "rgba(0,60,120,0.85)"
            : "rgba(79,195,247,0.7)";
          ctx.fill();
        } else {
          // Stage 2: end point is fixed — the cursor is now the
          // through-point. Solve and draw the real circle through all
          // three points so the preview matches exactly what commits.
          // When Shift is held, preview a bezier instead (matches commit).
          const p0 = mmToCanvas(from.x, from.y, state, canvas);
          const pEnd = mmToCanvas(arcEndPt.x, arcEndPt.y, state, canvas);

          ctx.setLineDash([6, 4]);
          ctx.beginPath();

          if (shiftHeld) {
            // Bezier preview — same cp1/cp2 derivation as the commit path.
            const midX = (from.x + arcEndPt.x) / 2;
            const midY = (from.y + arcEndPt.y) / 2;
            const ox = cursorMm.x - midX;
            const oy = cursorMm.y - midY;
            const chordX = arcEndPt.x - from.x;
            const chordY = arcEndPt.y - from.y;
            const cp1 = mmToCanvas(
              from.x + chordX / 3 + ox,
              from.y + chordY / 3 + oy,
              state,
              canvas,
            );
            const cp2 = mmToCanvas(
              from.x + (chordX * 2) / 3 + ox,
              from.y + (chordY * 2) / 3 + oy,
              state,
              canvas,
            );
            ctx.moveTo(p0.px, p0.py);
            ctx.bezierCurveTo(cp1.px, cp1.py, cp2.px, cp2.py, pEnd.px, pEnd.py);
          } else {
            const arc = arcThrough3Points(from, arcEndPt, cursorMm);
            if (arc) {
              const center = mmToCanvas(
                arc.center.x,
                arc.center.y,
                state,
                canvas,
              );
              const r = Math.hypot(p0.px - center.px, p0.py - center.py);
              const a0 = Math.atan2(p0.py - center.py, p0.px - center.px);
              const a1 = Math.atan2(pEnd.py - center.py, pEnd.px - center.px);
              ctx.arc(center.px, center.py, r, a0, a1, arc.cw);
            } else {
              // Collinear fallback
              ctx.moveTo(p0.px, p0.py);
              ctx.lineTo(pEnd.px, pEnd.py);
            }
          }

          ctx.stroke();
          ctx.setLineDash([]);

          // End point marker (fixed) + through-point marker (follows cursor)
          ctx.beginPath();
          ctx.arc(pEnd.px, pEnd.py, 4, 0, Math.PI * 2);
          ctx.fillStyle = "#ff5252";
          ctx.fill();
          const pCursor = mmToCanvas(cursorMm.x, cursorMm.y, state, canvas);
          ctx.beginPath();
          ctx.arc(pCursor.px, pCursor.py, 3, 0, Math.PI * 2);
          ctx.fillStyle = lightMode
            ? "rgba(0,60,120,0.85)"
            : "rgba(79,195,247,0.7)";
          ctx.fill();
        }
        ctx.restore();

        // Small status label so the two-click flow is legible.
        const hudPos = mmToCanvas(cursorMm.x, cursorMm.y, state, canvas);
        ctx.save();
        ctx.font = "bold 11px monospace";
        const label = arcEndPt
          ? shiftHeld
            ? "Shift+click = eccentric curve"
            : "click = circle arc · Shift = curve"
          : "click to set arc end point";
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = lightMode ? "#1e88e5" : "#0d47a1";
        ctx.beginPath();
        ctx.roundRect(hudPos.px + 12, hudPos.py - 10, tw + 12, 20, 4);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.textBaseline = "middle";
        ctx.fillText(label, hudPos.px + 18, hudPos.py);
        ctx.restore();
      }
    }

    // Live preview from drawFromPointId to cursor (line tool)
    if (
      drawFromPointId &&
      cursorMm &&
      activeSub &&
      state.tool === "draw-line"
    ) {
      const from = findPoint(activeSub, drawFromPointId);
      if (from) {
        // Raw cursor angle (used as fallback when angle hasn't been typed),
        // soft-snapped to 45° increments unless Shift bypasses it — this
        // must match the commit logic in PathEditor.tsx exactly, or the
        // preview will show one angle and place a different one on click.
        const rawCursorAngle = Math.atan2(
          cursorMm.y - from.y,
          cursorMm.x - from.x,
        );
        const cursorAngle = shiftHeld
          ? rawCursorAngle
          : snapAngleToCommon(rawCursorAngle);

        const typedLen = parseFloat(numericInput);
        const typedAngDeg = parseFloat(angleInput);
        const hasTypedLen =
          numericInput !== "" && !isNaN(typedLen) && typedLen > 0;
        const hasTypedAng = angleInput !== "" && !isNaN(typedAngDeg);

        const previewAngle = hasTypedAng
          ? (typedAngDeg * Math.PI) / 180
          : cursorAngle;
        const previewLen = hasTypedLen
          ? typedLen
          : Math.hypot(cursorMm.x - from.x, cursorMm.y - from.y);

        // The point actually being previewed — driven by typed values when
        // present, otherwise falls back to the live cursor position.
        const previewMm = {
          x: from.x + previewLen * Math.cos(previewAngle),
          y: from.y + previewLen * Math.sin(previewAngle),
        };

        const p0 = mmToCanvas(from.x, from.y, state, canvas);
        const p1 = mmToCanvas(previewMm.x, previewMm.y, state, canvas);
        ctx.save();
        ctx.strokeStyle = lightMode
          ? "rgba(0,60,120,0.75)"
          : "rgba(79,195,247,0.4)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(p0.px, p0.py);
        ctx.lineTo(p1.px, p1.py);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(p1.px, p1.py, 3, 0, Math.PI * 2);
        ctx.fillStyle = lightMode
          ? "rgba(0,60,120,0.85)"
          : "rgba(79,195,247,0.7)";
        ctx.fill();
        ctx.restore();

        // length/angle HUD — mirrors the same previewLen/previewAngle so
        // the label always matches what's actually drawn.
        const lenMm = previewLen;
        let angDeg = (previewAngle * 180) / Math.PI;
        if (angDeg < 0) angDeg += 360;
        const midX = (p0.px + p1.px) / 2,
          midY = (p0.py + p1.py) / 2;
        const segDx = p1.px - p0.px,
          segDy = p1.py - p0.py;
        const segLen = Math.hypot(segDx, segDy) || 1;
        const perpX = -segDy / segLen,
          perpY = segDx / segLen;
        const OFFSET = 26;
        const hx = midX + perpX * OFFSET,
          hy = midY + perpY * OFFSET;

        const line1 = numericInput
          ? `${numericInput}_ mm`
          : `${lenMm.toFixed(1)} mm`;
        const line2 = angleInput ? `${angleInput}_°` : `${angDeg.toFixed(1)}°`;
        ctx.save();
        ctx.font = "bold 12px monospace";
        const tw = Math.max(
          ctx.measureText(line1).width,
          ctx.measureText(line2).width,
        );
        const bw = tw + 16,
          bh = 36;
        ctx.fillStyle = lightMode ? "#1e88e5" : "#0d47a1";
        ctx.beginPath();
        ctx.roundRect(hx - bw / 2, hy - bh / 2, bw, bh, 6);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(line1, hx, hy - bh / 2 + 4);
        ctx.font = "11px monospace";
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.fillText(line2, hx, hy - bh / 2 + 20);
        ctx.textAlign = "left";
        ctx.restore();
      }
    }

    // Points
    subpaths.forEach((sub) => {
      sub.points.forEach((p) => {
        const { px, py } = mmToCanvas(p.x, p.y, state, canvas);
        const isSelected = p.id === state.selectedPointId;
        const isHovered = p.id === state.hoveredPointId;
        const isSnapRef = snapRefIds.includes(p.id);

        ctx.save();
        if (isSelected || isHovered || isSnapRef) {
          ctx.beginPath();
          ctx.arc(px, py, POINT_RADIUS + 3, 0, Math.PI * 2);
          ctx.strokeStyle = isSelected
            ? selColor
            : isSnapRef
              ? "#66bb6a"
              : activeColor;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(px, py, POINT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = isSelected
          ? selColor
          : lightMode
            ? "#1565c0"
            : "#4fc3f7";
        ctx.fill();
        ctx.restore();
      });
    });

    // Snapped cursor marker — distinct styling per source so it's obvious
    // *what* you're snapped to, not just that you're snapped to something.
    // This is what makes grid-snapping legible: previously a grid snap
    // (source === "grid") drew nothing at all, which read as "not
    // snapping" even though the position was correct.
    if (cursorMm && snapSource !== "none") {
      const { px, py } = mmToCanvas(cursorMm.x, cursorMm.y, state, canvas);
      ctx.save();

      if (snapSource === "point" || snapSource === "segment-midpoint") {
        // Strong green ring — matches the joinable-endpoint convention
        // used elsewhere (existing geometry, highest snap priority).
        ctx.beginPath();
        ctx.arc(px, py, 7, 0, Math.PI * 2);
        ctx.strokeStyle = "#66bb6a";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (snapSource === "guide-intersection") {
        // Orange ring (matches guide color) with a small cross through
        // it, since this is the highest-value snap point on a guide.
        ctx.strokeStyle = "#ffab40";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px - 10, py);
        ctx.lineTo(px + 10, py);
        ctx.moveTo(px, py - 10);
        ctx.lineTo(px, py + 10);
        ctx.stroke();
      } else if (snapSource === "guide") {
        // Plain orange ring — landed on a guide line but not a crossing.
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.strokeStyle = "#ffab40";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (snapSource === "grid") {
        // Small filled square marker only — the full-canvas crosshair
        // was too noisy since it fires on every grid snap, i.e. nearly
        // every mouse move.
        const SZ = 5;
        ctx.fillStyle = lightMode ? "#1e88e5" : "#4fc3f7";
        ctx.strokeStyle = lightMode ? "#fff" : "#0f0f23";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.rect(px - SZ, py - SZ, SZ * 2, SZ * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }

    ctx.restore();
  }, [
    state,
    cursorMm,
    lightMode,
    numericInput,
    angleInput,
    snapRefIds,
    drawFromPointId,
    arcEndPt,
    shiftHeld,
    snapSource,
    canvasRef,
    imageRef,
  ]);
}
