import { useEffect, RefObject } from "react";
import { EditorState, Point, Subpath } from "../components/path-editor/types";

const POINT_RADIUS = 6;
const HOVER_RADIUS = 10;
const HANDLE_RADIUS = 4;

export function canvasToMm(
  clientX: number,
  clientY: number,
  state: EditorState,
  canvas: HTMLCanvasElement,
) {
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

export function snapToGrid(x: number, y: number, gridMm: number) {
  return {
    x: Math.round(x / gridMm) * gridMm,
    y: Math.round(y / gridMm) * gridMm,
  };
}

export function hitTestPoint(
  mx: number,
  my: number,
  subpaths: Subpath[],
  state: EditorState,
  canvas: HTMLCanvasElement,
  selectedPointId: string | null,
): string | null {
  // Test handles of selected point
  if (selectedPointId) {
    for (const sub of subpaths) {
      const sel = sub.points.find((p) => p.id === selectedPointId);
      if (sel) {
        if (sel.handleOut) {
          const { px, py } = mmToCanvas(
            sel.x + sel.handleOut.x,
            sel.y + sel.handleOut.y,
            state,
            canvas,
          );
          if (dist(mx, my, px, py) <= HOVER_RADIUS)
            return `handle:${sel.id}:out`;
        }
        if (sel.handleIn) {
          const { px, py } = mmToCanvas(
            sel.x + sel.handleIn.x,
            sel.y + sel.handleIn.y,
            state,
            canvas,
          );
          if (dist(mx, my, px, py) <= HOVER_RADIUS)
            return `handle:${sel.id}:in`;
        }
      }
    }
  }
  // Test anchors (reverse so topmost wins)
  const allPoints = subpaths.flatMap((s) => s.points);
  for (let i = allPoints.length - 1; i >= 0; i--) {
    const { px, py } = mmToCanvas(
      allPoints[i].x,
      allPoints[i].y,
      state,
      canvas,
    );
    if (dist(mx, my, px, py) <= HOVER_RADIUS) return allPoints[i].id;
  }
  return null;
}

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

function drawSubpath(
  ctx: CanvasRenderingContext2D,
  sub: Subpath,
  state: EditorState,
  canvas: HTMLCanvasElement,
  strokeStyle: string,
) {
  if (sub.points.length < 2) return;
  const toP = (p: Point) => mmToCanvas(p.x, p.y, state, canvas);
  const toH = (p: Point, h: { x: number; y: number }) =>
    mmToCanvas(p.x + h.x, p.y + h.y, state, canvas);
  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const start = toP(sub.points[0]);
  ctx.moveTo(start.px, start.py);
  for (let i = 1; i < sub.points.length; i++) {
    const prev = sub.points[i - 1],
      curr = sub.points[i];
    const p1 = toP(prev),
      p2 = toP(curr);
    const cp1 = prev.handleOut ? toH(prev, prev.handleOut) : p1;
    const cp2 = curr.handleIn ? toH(curr, curr.handleIn) : p2;
    if (prev.handleOut || curr.handleIn)
      ctx.bezierCurveTo(cp1.px, cp1.py, cp2.px, cp2.py, p2.px, p2.py);
    else ctx.lineTo(p2.px, p2.py);
  }
  if (sub.closed) ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

export function useCanvasRender(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  state: EditorState,
  imageRef: RefObject<HTMLImageElement | null>,
  cursorPos: { x: number; y: number } | null,
  lightMode = false,
  numericInput = "",
  angleInput = "",
  inputFocus: "length" | "angle" = "length",
  isLocked = false,
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
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

    // Background image
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

    // Grid
    if (state.showGrid) {
      const gridPx = state.gridSizeMm * state.zoom;
      ctx.save();
      ctx.strokeStyle = lightMode
        ? "rgba(0,0,0,0.07)"
        : "rgba(255,255,255,0.07)";
      ctx.lineWidth = 1;
      const sx = ((originX % gridPx) + gridPx) % gridPx;
      for (let x = sx; x < w; x += gridPx) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      const sy = ((originY % gridPx) + gridPx) % gridPx;
      for (let y = sy; y < h; y += gridPx) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.strokeStyle = lightMode
        ? "rgba(0,0,0,0.18)"
        : "rgba(255,255,255,0.18)";
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

    const { subpaths, activeSubpathId, selectedPointId, hoveredPointId, tool } =
      state;
    const activeSub = subpaths.find((s) => s.id === activeSubpathId);
    const toP = (p: Point) => mmToCanvas(p.x, p.y, state, canvas);
    const toH = (p: Point, h: { x: number; y: number }) =>
      mmToCanvas(p.x + h.x, p.y + h.y, state, canvas);

    // Draw all subpaths — active in bright, others dimmed
    subpaths.forEach((sub) => {
      const isActive = sub.id === activeSubpathId;
      drawSubpath(
        ctx,
        sub,
        state,
        canvas,
        isActive
          ? "#4fc3f7"
          : lightMode
            ? "rgba(0,0,0,0.25)"
            : "rgba(79,195,247,0.3)",
      );
    });

    // Live preview dashed line from last point of active subpath to cursor
    if (
      tool === "draw" &&
      activeSub &&
      activeSub.points.length >= 1 &&
      cursorPos
    ) {
      const last = activeSub.points[activeSub.points.length - 1];
      const { px: lx, py: ly } = toP(last);
      const { px: cx2, py: cy2 } = mmToCanvas(
        cursorPos.x,
        cursorPos.y,
        state,
        canvas,
      );
      ctx.save();
      ctx.strokeStyle = lightMode
        ? "rgba(0,60,120,0.75)"
        : "rgba(79,195,247,0.4)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(cx2, cy2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(cx2, cy2, 3, 0, Math.PI * 2);
      ctx.fillStyle = lightMode
        ? "rgba(0,60,120,0.85)"
        : "rgba(79,195,247,0.7)";
      ctx.fill();
      ctx.restore();

      // Turn angle HUD — show angle from previous segment
      const segDx = cursorPos.x - last.x;
      const segDy = cursorPos.y - last.y;
      const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
      const segAngleRad = Math.atan2(segDy, segDx);

      let angleDisplay = "";
      if (activeSub.points.length >= 2) {
        const prev = activeSub.points[activeSub.points.length - 2];
        const prevDx = last.x - prev.x,
          prevDy = last.y - prev.y;
        const prevAngle = Math.atan2(prevDy, prevDx);
        let turn = (segAngleRad - prevAngle) * (180 / Math.PI);
        // Normalise to 0–180 interior angle
        turn = ((turn % 360) + 360) % 360;
        if (turn > 180) turn = 360 - turn;
        angleDisplay = `${turn.toFixed(1)}°`;
      } else {
        // First segment — show absolute bearing from horizontal
        let abs = segAngleRad * (180 / Math.PI);
        if (abs < 0) abs += 360;
        angleDisplay = `${abs.toFixed(1)}°`;
      }

      // Length of current segment
      const lenDisplay = segLen > 0 ? `${segLen.toFixed(1)} mm` : "";

      // Midpoint — offset perpendicular so HUD doesn't cover the line
      const midX = (lx + cx2) / 2;
      const midY = (ly + cy2) / 2;
      const segPxDx = cx2 - lx,
        segPxDy = cy2 - ly;
      const segPxLen = Math.sqrt(segPxDx * segPxDx + segPxDy * segPxDy) || 1;
      const perpX = -segPxDy / segPxLen;
      const perpY = segPxDx / segPxLen;
      const OFFSET = 28;
      const hudCX = midX + perpX * OFFSET;
      const hudCY = midY + perpY * OFFSET;

      if (lenDisplay || angleDisplay) {
        const hudLine1 = numericInput ? `${numericInput}_ mm` : lenDisplay;
        const hudLine2 = angleDisplay;
        ctx.save();
        ctx.font = "bold 12px monospace";
        const tw = Math.max(
          ctx.measureText(hudLine1).width,
          ctx.measureText(hudLine2).width,
        );
        const bw = tw + 16,
          bh = hudLine2 ? 36 : 20;
        const bx = hudCX - bw / 2,
          by = hudCY - bh / 2;
        ctx.fillStyle = lightMode ? "#1e88e5" : "#0d47a1";
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 6);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.textBaseline = "top";
        ctx.textAlign = "center";
        if (hudLine2) {
          ctx.fillText(hudLine1, hudCX, by + 4);
          ctx.font = "11px monospace";
          ctx.fillStyle = "rgba(255,255,255,0.75)";
          ctx.fillText(hudLine2, hudCX, by + 20);
        } else {
          ctx.fillText(hudLine1, hudCX, by + 4);
        }
        ctx.textAlign = "left";
        ctx.restore();
      }
    }

    // Handle stems for selected point
    if (selectedPointId) {
      for (const sub of subpaths) {
        const sel = sub.points.find((p) => p.id === selectedPointId);
        if (!sel) continue;
        const { px: ax, py: ay } = toP(sel);
        (["handleIn", "handleOut"] as const).forEach((key) => {
          const h = sel[key];
          if (!h) return;
          const { px: hx, py: hy } = toH(sel, h);
          ctx.save();
          ctx.strokeStyle = lightMode
            ? "rgba(0,0,0,0.3)"
            : "rgba(255,255,255,0.3)";
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(hx, hy);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.arc(hx, hy, HANDLE_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = "#fff";
          ctx.strokeStyle = "#4fc3f7";
          ctx.lineWidth = 1.5;
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        });
      }
    }

    // Anchor points for all subpaths
    subpaths.forEach((sub) => {
      sub.points.forEach((p) => {
        const { px, py } = toP(p);
        const isSelected = p.id === selectedPointId;
        const isHovered = p.id === hoveredPointId;
        const hasCurve = !!(p.handleIn || p.handleOut);
        const isFirstOfActive =
          sub.id === activeSubpathId &&
          sub.points[0]?.id === p.id &&
          sub.points.length >= 1 &&
          tool === "draw";

        ctx.save();
        // First point of active subpath = close-path ring
        if (isFirstOfActive && sub.points.length >= 2) {
          ctx.beginPath();
          ctx.arc(px, py, POINT_RADIUS + 5, 0, Math.PI * 2);
          ctx.strokeStyle = lightMode ? "#1565c0" : "#4fc3f7";
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 2]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // Endpoint of a non-active subpath = joinable, show green ring
        const isJoinable =
          tool === "draw" &&
          sub.id !== activeSubpathId &&
          (sub.points[0]?.id === p.id ||
            sub.points[sub.points.length - 1]?.id === p.id) &&
          !!activeSub &&
          activeSub.points.length >= 1;
        if (isJoinable) {
          ctx.beginPath();
          ctx.arc(px, py, POINT_RADIUS + 5, 0, Math.PI * 2);
          ctx.strokeStyle = "#66bb6a";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([]);
          ctx.stroke();
        }
        if (isSelected || isHovered) {
          ctx.beginPath();
          ctx.arc(px, py, POINT_RADIUS + 3, 0, Math.PI * 2);
          ctx.strokeStyle = isSelected
            ? lightMode
              ? "#1565c0"
              : "#fff"
            : "#4fc3f7";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.beginPath();
        if (hasCurve) {
          const r = POINT_RADIUS;
          ctx.moveTo(px, py - r);
          ctx.lineTo(px + r, py);
          ctx.lineTo(px, py + r);
          ctx.lineTo(px - r, py);
          ctx.closePath();
        } else {
          ctx.arc(px, py, POINT_RADIUS, 0, Math.PI * 2);
        }
        ctx.fillStyle = isSelected
          ? lightMode
            ? "#1565c0"
            : "#fff"
          : "#4fc3f7";
        ctx.fill();
        ctx.restore();
      });
    });

    // Coord labels on selected/hovered
    const labelTextCol = lightMode ? "#111" : "#fff";
    const allPts = subpaths.flatMap((s) => s.points);
    const labelledIds = new Set(
      [selectedPointId, hoveredPointId].filter(Boolean),
    );
    allPts.forEach((p) => {
      if (!labelledIds.has(p.id)) return;
      const { px, py } = toP(p);
      const label = `${p.x.toFixed(1)}, ${p.y.toFixed(1)} mm`;
      ctx.save();
      ctx.font = "bold 11px monospace";
      const metrics = ctx.measureText(label);
      const lw = metrics.width + 10,
        lh = 16,
        lx = px + 10,
        ly = py - 20;
      ctx.fillStyle = lightMode ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.75)";
      ctx.beginPath();
      ctx.roundRect(lx - 2, ly - lh + 4, lw, lh, 3);
      ctx.fill();
      ctx.fillStyle = labelTextCol;
      ctx.fillText(label, lx + 2, ly);
      ctx.restore();
    });

    // Numeric HUD (if typing a length)
    if (
      numericInput &&
      cursorPos &&
      tool === "draw" &&
      activeSub &&
      activeSub.points.length >= 1
    ) {
      const last = activeSub.points[activeSub.points.length - 1];
      const { px: cx2, py: cy2 } = mmToCanvas(
        cursorPos.x,
        cursorPos.y,
        state,
        canvas,
      );
      const { px: lx, py: ly } = toP(last);
      // Bright dashed line override when typing
      ctx.save();
      ctx.strokeStyle = lightMode ? "#1e88e5" : "#4fc3f7";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(cx2, cy2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(cx2, cy2, 5, 0, Math.PI * 2);
      ctx.fillStyle = lightMode ? "#1e88e5" : "#4fc3f7";
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }, [
    state,
    cursorPos,
    lightMode,
    numericInput,
    angleInput,
    inputFocus,
    isLocked,
    canvasRef,
    imageRef,
  ]);
}
