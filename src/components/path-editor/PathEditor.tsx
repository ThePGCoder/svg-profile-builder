"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Snackbar,
  Alert,
  IconButton,
  Tooltip,
  Drawer,
  useMediaQuery,
} from "@mui/material";
import { Icon } from "@iconify/react";

import Toolbar from "./Toolbar";
import GuidesPanel from "./GuidesPanel";
import SegmentPanel from "./SegmentPanel";
import ProfilesPanel from "./ProfilesPanel";
import ExportPanel from "./ExportPanel";
import HelpModal from "./HelpModal";
import ProfilePreview3D from "./ProfilePreview3D";
import { useColorMode } from "./ThemeProvider";
import {
  canvasToMm,
  hitTestPoint,
  hitTestSegment,
  hitTestGuide,
  useCanvasRender,
} from "./CanvasRender";
import { resolveSnap, snapAngleToCommon } from "./Geometry";
import {
  makeSubpath,
  addLinePoint,
  deleteSegment,
  closeSubpath,
  findPoint,
  addArcThrough3Points,
  setArcBulge,
  splitSegment,
  convertSegment,
} from "./segments";
import { loadProfiles, saveProfile, deleteProfile } from "./storage";
import {
  EditorState,
  Subpath,
  Guide,
  Pt,
  Profile,
  Segment,
  ToolMode,
} from "./types";

function makeDefaultState(): EditorState {
  const sub = makeSubpath();
  return {
    subpaths: [sub],
    activeSubpathId: sub.id,
    guides: [],
    selectedPointId: null,
    selectedSegmentId: null,
    hoveredPointId: null,
    hoveredSegmentId: null,
    hoveredGuideId: null,
    tool: "draw-line",
    zoom: 4,
    panX: 0,
    panY: 0,
    snapToGrid: true,
    gridSizeMm: 5,
    showGrid: true,
    snapToGuides: true,
    snapToGeometry: true,
    imageUrl: null,
    imageOpacity: 0.4,
    imageScale: 1,
    imageOffsetX: 0,
    imageOffsetY: 0,
  };
}

function updateActiveSub(
  state: EditorState,
  fn: (sub: Subpath) => Subpath,
): EditorState {
  return {
    ...state,
    subpaths: state.subpaths.map((s) =>
      s.id === state.activeSubpathId ? fn(s) : s,
    ),
  };
}
function getActiveSub(state: EditorState): Subpath | undefined {
  return state.subpaths.find((s) => s.id === state.activeSubpathId);
}
function lastPointOf(
  sub: Subpath | undefined,
): { id: string; x: number; y: number } | null {
  if (!sub || sub.points.length === 0) return null;
  // Use orderedWalk-equivalent: last added point (points[] append order is fine
  // for our linear draw flow since we always push to the end).
  return sub.points[sub.points.length - 1];
}

type HistoryEntry = {
  subpaths: Subpath[];
  activeSubpathId: string;
  guides: Guide[];
};
const MAX_HISTORY = 50;

function MobileNavBtn({
  icon,
  label,
  onClick,
  lightMode,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  lightMode: boolean;
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0.25,
        px: 1.5,
        py: 0.75,
        borderRadius: 2,
        cursor: "pointer",
        color: lightMode ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.6)",
        "&:hover": {
          bgcolor: lightMode ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)",
          color: lightMode ? "#000" : "#fff",
        },
        transition: "all 0.15s",
      }}
    >
      <Icon icon={icon} width={22} color="inherit" />
      <Typography
        variant="caption"
        sx={{ fontSize: 9, color: "inherit", fontWeight: 600 }}
      >
        {label}
      </Typography>
    </Box>
  );
}

export default function PathEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [state, setState] = useState<EditorState>(makeDefaultState);
  const [history, setHistory] = useState<HistoryEntry[]>([
    {
      subpaths: state.subpaths,
      activeSubpathId: state.activeSubpathId,
      guides: state.guides,
    },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [cursorMm, setCursorMm] = useState<Pt | null>(null);
  const [shiftHeld, setShiftHeld] = useState(false);
  const { mode: colorMode, toggle: toggleColorMode } = useColorMode();
  const lightMode = colorMode === "light";
  const [numericInput, setNumericInput] = useState("");
  const [angleInput, setAngleInput] = useState("");
  const [inputFocus, setInputFocus] = useState<"length" | "angle">("length");
  const inputFocusRef = useRef<"length" | "angle">("length"); // avoids stale closure in keydown
  const [bulgeMm, setBulgeMm] = useState(20);
  const [showHelp, setShowHelp] = useState(false);
  const [show3DPreview, setShow3DPreview] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [snack, setSnack] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [toolDrawer, setToolDrawer] = useState(false);
  const [profileDrawer, setProfileDrawer] = useState(false);
  const [exportDrawer, setExportDrawer] = useState(false);

  // Guide-picking workflow state
  const [pickingPointsFor, setPickingPointsFor] = useState<
    "points" | "angled" | null
  >(null);
  const pickBufferRef = useRef<Pt[]>([]);

  // Drag state for select tool (move a point)
  const dragPointRef = useRef<string | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  // Arc tool is a two-click workflow: click 1 sets the END point (start is
  // the existing last point of the subpath, same as line drawing), then
  // mouse-move previews the arc bowing toward the cursor, click 2 commits
  // using the cursor as the through-point. null = waiting for click 1.
  const [arcEndPt, setArcEndPt] = useState<Pt | null>(null);

  // Bezier draw state — both stored as refs so handleMouseMove always
  // reads the current value without stale closure issues (same pattern

  const isMobile = useMediaQuery("(max-width:768px)");

  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    setProfiles(loadProfiles());
  }, []);

  useEffect(() => {
    if (!state.imageUrl) {
      imageRef.current = null;
      return;
    }
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setState((s) => ({ ...s }));
    };
    img.src = state.imageUrl;
  }, [state.imageUrl]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    //e.preventDefault();

    setState((s) => ({
      ...s,
      zoom: Math.min(Math.max(s.zoom * (e.deltaY < 0 ? 1.1 : 0.9), 0.5), 40),
    }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => setState((s) => ({ ...s })));
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  const pushHistory = useCallback(
    (s: EditorState) => {
      const entry: HistoryEntry = {
        subpaths: s.subpaths,
        activeSubpathId: s.activeSubpathId,
        guides: s.guides,
      };
      setHistory((h) => {
        const t = h.slice(0, historyIndex + 1);
        const n = [...t, entry].slice(-MAX_HISTORY);
        setHistoryIndex(n.length - 1);
        return n;
      });
    },
    [historyIndex],
  );

  const jumpHistory = useCallback(
    (n: number) => {
      const entry = history[n];
      if (!entry) return;
      setState((s) => ({
        ...s,
        subpaths: entry.subpaths,
        activeSubpathId: entry.activeSubpathId,
        guides: entry.guides,
        selectedPointId: null,
        selectedSegmentId: null,
      }));
      setHistoryIndex(n);
    },
    [history],
  );

  // ── Snapping ──────────────────────────────────────────────────
  const computeSnap = useCallback(
    (clientX: number, clientY: number, excludePointId?: string | null) => {
      const canvas = canvasRef.current;
      const s = stateRef.current;
      if (!canvas) return { x: 0, y: 0, source: "none" as const, refIds: [] };
      const raw = canvasToMm(clientX, clientY, s, canvas);
      return resolveSnap({
        cursorMm: raw,
        subpaths: s.subpaths,
        guides: s.guides,
        gridSizeMm: s.gridSizeMm,
        snapToGrid: s.snapToGrid && !shiftHeld,
        snapToGuides: s.snapToGuides,
        snapToGeometry: s.snapToGeometry,
        radiusMm: 10 / s.zoom,
        excludePointId,
      });
    },
    [shiftHeld],
  );

  // ── Keyboard ──────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(true);
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        jumpHistory(Math.max(0, historyIndex - 1));
        return;
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        jumpHistory(Math.min(history.length - 1, historyIndex + 1));
        return;
      }

      const s = stateRef.current;
      const activeSub = getActiveSub(s);
      const last = lastPointOf(activeSub);
      const hasInput = numericInput || angleInput;
      const isDrawing =
        (s.tool === "draw-line" || s.tool === "draw-arc") && last;

      if (isDrawing) {
        // Tab or comma switches focus between length and angle fields
        if (
          e.key === "Tab" ||
          (e.key === "," && inputFocusRef.current === "length")
        ) {
          e.preventDefault();
          inputFocusRef.current =
            inputFocusRef.current === "length" ? "angle" : "length";
          setInputFocus(inputFocusRef.current);
          return;
        }
        // @ jumps straight to the angle field
        if (e.key === "@") {
          e.preventDefault();
          inputFocusRef.current = "angle";
          setInputFocus("angle");
          return;
        }
        if (/^[0-9.]$/.test(e.key) && !(e.metaKey || e.ctrlKey)) {
          const target = inputFocusRef.current;
          const activeVal = target === "length" ? numericInput : angleInput;
          if (e.key === "." && activeVal.includes(".")) return;
          if (target === "length") setNumericInput((v) => v + e.key);
          else setAngleInput((v) => v + e.key);
          e.preventDefault();
          return;
        }
        if (e.key === "Backspace" && hasInput) {
          e.preventDefault();
          const target = inputFocusRef.current;
          if (target === "length" && numericInput)
            setNumericInput((v) => v.slice(0, -1));
          else if (target === "angle" && angleInput)
            setAngleInput((v) => v.slice(0, -1));
          else if (target === "angle") {
            inputFocusRef.current = "length";
            setInputFocus("length");
          }
          return;
        }
        if (e.key === "Enter" && hasInput && last && s.tool === "draw-line") {
          e.preventDefault();
          const len = parseFloat(numericInput);
          const angDeg = parseFloat(angleInput);
          let angle = cursorMm
            ? Math.atan2(cursorMm.y - last.y, cursorMm.x - last.x)
            : 0;
          if (!isNaN(angDeg)) {
            angle = (angDeg * Math.PI) / 180;
          } else if (!shiftHeld) {
            // No explicit angle typed — soft-snap the cursor-derived angle
            // to 45° increments unless Shift is held to bypass it.
            angle = snapAngleToCommon(angle);
          }
          if (!isNaN(len) && len > 0) {
            const nx = last.x + len * Math.cos(angle);
            const ny = last.y + len * Math.sin(angle);
            setState((cur) => {
              const sub = getActiveSub(cur)!;
              const result = addLinePoint(sub, last.id, { x: nx, y: ny });
              const ns = updateActiveSub(cur, () => result.sub);
              pushHistory(ns);
              return { ...ns, selectedPointId: result.newPointId };
            });
          }
          setNumericInput("");
          setAngleInput("");
          inputFocusRef.current = "length";
          setInputFocus("length");
          return;
        }
        if (e.key === "Escape" && hasInput) {
          setNumericInput("");
          setAngleInput("");
          inputFocusRef.current = "length";
          setInputFocus("length");
          return;
        }
      }

      if (e.key === "?" || e.key === "/") {
        setShowHelp((v) => !v);
        return;
      }

      switch (e.key) {
        case "l":
        case "L":
          setState((st) => ({ ...st, tool: "draw-line" }));
          setNumericInput("");
          setAngleInput("");
          inputFocusRef.current = "length";
          setInputFocus("length");
          setArcEndPt(null);
          break;
        case "a":
        case "A":
          setState((st) => ({ ...st, tool: "draw-arc" }));
          setNumericInput("");
          setAngleInput("");
          inputFocusRef.current = "length";
          setInputFocus("length");
          setArcEndPt(null);
          break;
          setNumericInput("");
          setAngleInput("");
          inputFocusRef.current = "length";
          setInputFocus("length");
          setArcEndPt(null);
          break;
        case "s":
        case "S":
          if (!e.metaKey && !e.ctrlKey) {
            setState((st) => ({ ...st, tool: "select" }));
            setNumericInput("");
            setAngleInput("");
            inputFocusRef.current = "length";
            setInputFocus("length");
            setArcEndPt(null);
          }
          break;
        // "M" (new subpath) intentionally removed — multiple subpaths were
        // producing broken/garbled 3D extrusion (ambiguous outer-vs-hole
        // semantics), and construction guides now cover the same use case
        // for most profiles. May revisit with proper multi-region support
        // later.
        case "r":
        case "R":
          setState((st) => ({ ...st, zoom: 4, panX: 0, panY: 0 }));
          break;
        case "+":
        case "=":
          setState((st) => ({ ...st, zoom: Math.min(st.zoom * 1.2, 40) }));
          break;
        case "-":
        case "_":
          setState((st) => ({ ...st, zoom: Math.max(st.zoom / 1.2, 0.5) }));
          break;
        case "Delete":
        case "Backspace":
          setState((st) => {
            if (st.selectedSegmentId) {
              const ns = updateActiveSub(st, (sub) =>
                deleteSegment(sub, st.selectedSegmentId!),
              );
              pushHistory(ns);
              return { ...ns, selectedSegmentId: null };
            }
            return st;
          });
          break;
        case "Escape":
          setState((st) => ({
            ...st,
            selectedPointId: null,
            selectedSegmentId: null,
          }));
          setNumericInput("");
          setAngleInput("");
          inputFocusRef.current = "length";
          setInputFocus("length");
          setArcEndPt(null);
          setPickingPointsFor(null);
          pickBufferRef.current = [];
          break;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [
    history,
    historyIndex,
    pushHistory,
    jumpHistory,
    numericInput,
    angleInput,
    cursorMm,
    bulgeMm,
  ]);

  // ── Mouse handlers ────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)) {
        const startPanX = state.panX,
          startPanY = state.panY;
        const startX = e.clientX,
          startY = e.clientY;
        const onMove = (ev: MouseEvent) => {
          setState((s) => ({
            ...s,
            panX: startPanX + (ev.clientX - startX),
            panY: startPanY + (ev.clientY - startY),
          }));
        };
        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return;
      }
      if (e.button !== 0) return;

      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left,
        my = e.clientY - rect.top;

      // Guide-picking mode takes priority
      if (pickingPointsFor) {
        const snap = computeSnap(e.clientX, e.clientY);
        pickBufferRef.current.push({ x: snap.x, y: snap.y });
        if (
          pickingPointsFor === "angled" &&
          pickBufferRef.current.length === 1
        ) {
          const through = pickBufferRef.current[0];
          const angleDeg = parseFloat(
            prompt("Guide angle (degrees from horizontal):", "45") || "",
          );
          if (!isNaN(angleDeg)) {
            const g: Guide = {
              id: crypto.randomUUID(),
              kind: "angled",
              through,
              angleDeg,
            };
            setState((s) => {
              const ns = { ...s, guides: [...s.guides, g] };
              pushHistory(ns);
              return ns;
            });
          }
          pickBufferRef.current = [];
          setPickingPointsFor(null);
          return;
        }
        if (
          pickingPointsFor === "points" &&
          pickBufferRef.current.length === 2
        ) {
          const [a, b] = pickBufferRef.current;
          const g: Guide = { id: crypto.randomUUID(), kind: "points", a, b };
          setState((s) => {
            const ns = { ...s, guides: [...s.guides, g] };
            pushHistory(ns);
            return ns;
          });
          pickBufferRef.current = [];
          setPickingPointsFor(null);
        }
        return;
      }

      if (state.tool === "select") {
        const hitPt = hitTestPoint(mx, my, state.subpaths, state, canvas);
        if (hitPt) {
          const ownerSub = state.subpaths.find((s) =>
            s.points.some((p) => p.id === hitPt),
          );
          if (ownerSub)
            setState((s) => ({
              ...s,
              activeSubpathId: ownerSub.id,
              selectedPointId: hitPt,
              selectedSegmentId: null,
            }));
          dragPointRef.current = hitPt;
          return;
        }
        const activeSub = getActiveSub(state);
        if (activeSub) {
          const segId = hitTestSegment(mx, my, activeSub, state, canvas);
          if (segId) {
            setState((s) => ({
              ...s,
              selectedSegmentId: segId,
              selectedPointId: null,
            }));
            return;
          }
        }
        setState((s) => ({
          ...s,
          selectedPointId: null,
          selectedSegmentId: null,
        }));
        return;
      }

      // draw-line / draw-arc
      const activeSub = getActiveSub(stateRef.current);
      const last = lastPointOf(activeSub);
      const snap = computeSnap(e.clientX, e.clientY, last?.id);

      // Clicking the first point of an open subpath closes it — but only
      // for line/arc tools. Bezier handles its own two-point click logic below.
      if (
        activeSub &&
        activeSub.points.length >= 2 &&
        !arcEndPt &&
        (state.tool === "draw-line" || state.tool === "draw-arc")
      ) {
        const first = activeSub.points[0];
        const { px, py } = (() => {
          const c = canvasRef.current!;
          const w = c.clientWidth,
            h = c.clientHeight;
          const originX = w / 2 + state.panX,
            originY = h / 2 + state.panY;
          return {
            px: originX + first.x * state.zoom,
            py: originY + first.y * state.zoom,
          };
        })();
        if (Math.hypot(mx - px, my - py) < 10) {
          if (state.tool === "draw-arc") {
            // Arc close uses the same two-click bow workflow — clicking the
            // first point sets it as the arc's fixed end, then the user moves
            // the cursor to set the bow direction and clicks to commit, exactly
            // like any other arc. This avoids the pre-decided bulge problem.
            setArcEndPt({ x: first.x, y: first.y });
            return;
          }
          setState((s) => {
            const ns = updateActiveSub(s, (sub) => closeSubpath(sub, "line"));
            pushHistory(ns);
            return { ...ns, tool: "select", selectedPointId: null };
          });
          setNumericInput("");
          setAngleInput("");
          inputFocusRef.current = "length";
          setInputFocus("length");
          return;
        }
      }

      if (state.tool === "draw-arc") {
        if (!last) {
          // No start point yet — this click just plants the first point of
          // the subpath (nothing to arc from).
          setState((s) => {
            const sub = getActiveSub(s)!;
            const newPoint = { id: crypto.randomUUID(), x: snap.x, y: snap.y };
            const ns = updateActiveSub(s, () => ({
              ...sub,
              points: [...sub.points, newPoint],
            }));
            pushHistory(ns);
            return { ...ns, selectedPointId: newPoint.id };
          });
          return;
        }
        if (!arcEndPt) {
          // Click 1 of 2: fix the END point. Don't touch subpath state yet —
          // the arc isn't real until we also know the bow (click 2).
          setArcEndPt({ x: snap.x, y: snap.y });
          return;
        }
        // Click 2 of 2: current snapped cursor is the through-point.
        // Plain click = circular arc (existing behaviour).
        // Shift+click = eccentric bezier: through-point controls the bow,
        // cp1/cp2 derived at 1/3 and 2/3 along the chord + offset from midpoint.
        setState((s) => {
          const sub = getActiveSub(s)!;
          const isClosing =
            sub.points.length >= 2 &&
            sub.points[0].x === arcEndPt.x &&
            sub.points[0].y === arcEndPt.y;

          let newSub: Subpath;
          let newPointId: string;

          if (shiftHeld) {
            // Bezier branch — derive control points from the through-point.
            const fromPt = findPoint(sub, last.id)!;
            const toPt = arcEndPt;
            const midX = (fromPt.x + toPt.x) / 2;
            const midY = (fromPt.y + toPt.y) / 2;
            const ox = snap.x - midX;
            const oy = snap.y - midY;
            const chordX = toPt.x - fromPt.x;
            const chordY = toPt.y - fromPt.y;
            const cp1 = {
              x: fromPt.x + chordX / 3 + ox,
              y: fromPt.y + chordY / 3 + oy,
            };
            const cp2 = {
              x: fromPt.x + (chordX * 2) / 3 + ox,
              y: fromPt.y + (chordY * 2) / 3 + oy,
            };
            const newPtId = crypto.randomUUID();
            const newPt = { id: newPtId, x: toPt.x, y: toPt.y };
            const seg = {
              id: crypto.randomUUID(),
              type: "bezier" as const,
              fromId: last.id,
              toId: newPtId,
              cp1,
              cp2,
            };
            // Replace any existing segment between same points (prevents
            // duplicate fromId breaking orderedWalk on closed paths).
            const filtered = sub.segments.filter(
              (sg) =>
                !(
                  (sg.fromId === last.id && sg.toId === newPtId) ||
                  (sg.fromId === newPtId && sg.toId === last.id)
                ),
            );
            newSub = {
              ...sub,
              points: [...sub.points, newPt],
              segments: [...filtered, seg],
            };
            newPointId = newPtId;
          } else {
            // Circular arc branch — unchanged behaviour.
            const result = addArcThrough3Points(sub, last.id, arcEndPt, snap);
            newSub = result.sub;
            newPointId = result.newPointId;
          }

          if (isClosing) {
            newSub = { ...newSub, closed: true };
          }
          const ns = updateActiveSub(s, () => newSub);
          pushHistory(ns);
          return {
            ...ns,
            tool: isClosing ? ("select" as const) : s.tool,
            selectedPointId: isClosing ? null : newPointId,
          };
        });
        setArcEndPt(null);
        setNumericInput("");
        setAngleInput("");
        inputFocusRef.current = "length";
        setInputFocus("length");
        return;
      }

      // draw-line — soft-snap the angle from the last point to the nearest
      // 45° increment when close (Shift bypasses), keeping the snapped
      // distance from grid/guide/geometry snapping intact.
      let placePt: Pt = snap;
      if (last && !shiftHeld) {
        const rawAngle = Math.atan2(snap.y - last.y, snap.x - last.x);
        const snappedAngle = snapAngleToCommon(rawAngle);
        if (snappedAngle !== rawAngle) {
          const len = Math.hypot(snap.x - last.x, snap.y - last.y);
          placePt = {
            x: last.x + len * Math.cos(snappedAngle),
            y: last.y + len * Math.sin(snappedAngle),
          };
        }
      }

      setState((s) => {
        const sub = getActiveSub(s);
        if (!sub) return s;
        const result = !last
          ? {
              sub: {
                ...sub,
                points: [
                  ...sub.points,
                  { id: crypto.randomUUID(), x: placePt.x, y: placePt.y },
                ],
              },
              newPointId: "",
            }
          : addLinePoint(sub, last.id, placePt);
        const ns = updateActiveSub(s, () => result.sub);
        const newId =
          result.newPointId ||
          result.sub.points[result.sub.points.length - 1]?.id ||
          null;
        pushHistory(ns);
        return { ...ns, selectedPointId: newId };
      });
      // A new point was placed by mouse click — any half-typed length/angle
      // belonged to the segment that just got committed (or abandoned), so
      // it must not carry over into the next one.
      setNumericInput("");
      setAngleInput("");
      inputFocusRef.current = "length";
      setInputFocus("length");
    },
    [
      state,
      pickingPointsFor,
      computeSnap,
      pushHistory,
      bulgeMm,
      shiftHeld,
      arcEndPt,
    ],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const s = stateRef.current;

      if (dragPointRef.current) {
        const snap = computeSnap(e.clientX, e.clientY, dragPointRef.current);
        const pid = dragPointRef.current;
        setState((st) => ({
          ...st,
          subpaths: st.subpaths.map((sub) => ({
            ...sub,
            points: sub.points.map((p) =>
              p.id === pid ? { ...p, x: snap.x, y: snap.y } : p,
            ),
          })),
        }));
        setCursorMm({ x: snap.x, y: snap.y });
        return;
      }

      // Bezier handle drag — update cp1/cp2 live while the user drags.

      const snap = computeSnap(e.clientX, e.clientY);
      setCursorMm((prev) =>
        prev && prev.x === snap.x && prev.y === snap.y
          ? prev
          : { x: snap.x, y: snap.y },
      );

      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left,
        my = e.clientY - rect.top;
      const hitPt = hitTestPoint(mx, my, s.subpaths, s, canvas);
      const activeSub = getActiveSub(s);
      const segId =
        !hitPt && activeSub
          ? hitTestSegment(mx, my, activeSub, s, canvas)
          : null;
      const guideId = s.guides.length
        ? hitTestGuide(mx, my, s.guides, s, canvas)
        : null;

      // Only touch state if hover targets actually changed — calling setState
      // unconditionally on every pixel of mouse movement was the source of
      // the "Maximum update depth exceeded" loop.
      if (
        hitPt !== s.hoveredPointId ||
        segId !== s.hoveredSegmentId ||
        guideId !== s.hoveredGuideId
      ) {
        setState((st) => ({
          ...st,
          hoveredPointId: hitPt,
          hoveredSegmentId: segId,
          hoveredGuideId: guideId,
        }));
      }
    },
    [computeSnap],
  );

  const handleMouseUp = useCallback(() => {
    if (dragPointRef.current) {
      setState((s) => {
        pushHistory(s);
        return s;
      });
    }
    dragPointRef.current = null;
  }, [pushHistory]);

  const handleMouseLeave = useCallback(() => {
    dragPointRef.current = null;
    setCursorMm(null);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setState((s) => ({ ...s, imageUrl: URL.createObjectURL(file) }));
  };

  const addSubpath = () => {
    const newSub = makeSubpath();
    setState((s) => {
      const ns = {
        ...s,
        subpaths: [...s.subpaths, newSub],
        activeSubpathId: newSub.id,
        selectedPointId: null,
        selectedSegmentId: null,
        tool: "draw-line" as const,
      };
      pushHistory(ns);
      return ns;
    });
    setNumericInput("");
    setAngleInput("");
    inputFocusRef.current = "length";
    setInputFocus("length");
    setArcEndPt(null);
  };

  // Places the next point at exactly (0,0), bypassing cursor position
  // entirely. If the active subpath already has points, this commits a
  // straight line segment to the origin (predictable regardless of which
  // draw tool is active); otherwise it just plants the first point there.
  const placeAtOrigin = () => {
    const sub = getActiveSub(state);
    const last = lastPointOf(sub);
    setState((s) => {
      const activeSub = getActiveSub(s);
      if (!activeSub) return s;
      const result = !last
        ? {
            sub: {
              ...activeSub,
              points: [
                ...activeSub.points,
                { id: crypto.randomUUID(), x: 0, y: 0 },
              ],
            },
            newPointId: "",
          }
        : addLinePoint(activeSub, last.id, { x: 0, y: 0 });
      const ns = updateActiveSub(s, () => result.sub);
      const newId =
        result.newPointId ||
        result.sub.points[result.sub.points.length - 1]?.id ||
        null;
      pushHistory(ns);
      return { ...ns, selectedPointId: newId };
    });
    setNumericInput("");
    setAngleInput("");
    inputFocusRef.current = "length";
    setInputFocus("length");
    setArcEndPt(null);
  };

  const totalPoints = state.subpaths.reduce(
    (acc, s) => acc + s.points.length,
    0,
  );
  const activeSub = getActiveSub(state);
  const selectedSegment: Segment | null =
    activeSub?.segments.find((seg) => seg.id === state.selectedSegmentId) ??
    null;
  const drawFromPointId =
    state.tool === "draw-line" || state.tool === "draw-arc"
      ? (lastPointOf(activeSub)?.id ?? null)
      : null;
  const liveSnap = (() => {
    if (!cursorMm) return { refIds: [] as string[], source: "none" as const };
    const c = canvasRef.current;
    if (!c) return { refIds: [] as string[], source: "none" as const };
    // Re-derive ref ids cheaply from the same snap source used for cursorMm
    // (cursorMm is already the snapped position; recompute refIds only).
    const result = resolveSnap({
      cursorMm,
      subpaths: state.subpaths,
      guides: state.guides,
      gridSizeMm: state.gridSizeMm,
      snapToGrid: state.snapToGrid && !shiftHeld,
      snapToGuides: state.snapToGuides,
      snapToGeometry: state.snapToGeometry,
      radiusMm: 10 / state.zoom,
      excludePointId: dragPointRef.current,
    });
    return { refIds: result.refIds, source: result.source };
  })();
  const liveSnapRefIds = liveSnap.refIds;

  useCanvasRender(
    canvasRef,
    state,
    imageRef,
    cursorMm,
    lightMode,
    numericInput,
    angleInput,
    liveSnapRefIds,
    drawFromPointId,
    arcEndPt,
    shiftHeld,
    liveSnap.source,
  );

  if (!mounted) return null;

  const bg = lightMode ? "#f5f5f5" : "#0f0f23";
  const headerBg = lightMode ? "#fff" : "#0f0f23";
  const borderCol = lightMode ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.08)";
  const textCol = lightMode ? "#111" : "#fff";
  const subTextCol = lightMode ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.3)";
  const coordCol = lightMode ? "#0d47a1" : "rgba(79,195,247,0.8)";

  const toolbarProps = {
    tool: state.tool,
    snapToGrid: state.snapToGrid,
    showGrid: state.showGrid,
    gridSizeMm: state.gridSizeMm,
    snapToGeometry: state.snapToGeometry,
    closedPath: activeSub?.closed ?? false,
    pointCount: totalPoints,
    subpathCount: state.subpaths.length,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    lightMode,
    onAddSubpath: addSubpath,
    onPlaceAtOrigin: placeAtOrigin,
    onUndo: () => jumpHistory(Math.max(0, historyIndex - 1)),
    onRedo: () => jumpHistory(Math.min(history.length - 1, historyIndex + 1)),
    onToolChange: (t: ToolMode) => {
      setState((s) => ({ ...s, tool: t }));
      setNumericInput("");
      setAngleInput("");
      inputFocusRef.current = "length";
      setInputFocus("length");
      setArcEndPt(null);
    },
    onSnapGridToggle: () =>
      setState((s) => ({ ...s, snapToGrid: !s.snapToGrid })),
    onSnapGeometryToggle: () =>
      setState((s) => ({ ...s, snapToGeometry: !s.snapToGeometry })),
    onGridToggle: () => setState((s) => ({ ...s, showGrid: !s.showGrid })),
    onGridSizeChange: (v: number) => setState((s) => ({ ...s, gridSizeMm: v })),
    onClosePathToggle: () =>
      setState((s) => {
        const ns = updateActiveSub(s, (sub) =>
          sub.closed
            ? { ...sub, closed: false, segments: sub.segments.slice(0, -1) }
            : closeSubpath(sub, "line"),
        );
        return ns;
      }),
    onClear: () => {
      const ns = makeDefaultState();
      setState(ns);
      pushHistory(ns);
    },
    onZoomIn: () =>
      setState((s) => ({ ...s, zoom: Math.min(s.zoom * 1.2, 40) })),
    onZoomOut: () =>
      setState((s) => ({ ...s, zoom: Math.max(s.zoom / 1.2, 0.5) })),
    onResetView: () => setState((s) => ({ ...s, zoom: 4, panX: 0, panY: 0 })),
    onImageUpload: handleImageUpload,
    imageUrl: state.imageUrl,
    onClearImage: () => setState((s) => ({ ...s, imageUrl: null })),
    imageOpacity: state.imageOpacity,
    onImageOpacityChange: (v: number) =>
      setState((s) => ({ ...s, imageOpacity: v })),
  };

  const guidesProps = {
    guides: state.guides,
    lightMode,
    snapToGuides: state.snapToGuides,
    pickingPointsFor,
    onAddH: (y: number) => {
      const g: Guide = { id: crypto.randomUUID(), kind: "h", y };
      setState((s) => {
        const ns = { ...s, guides: [...s.guides, g] };
        pushHistory(ns);
        return ns;
      });
    },
    onAddV: (x: number) => {
      const g: Guide = { id: crypto.randomUUID(), kind: "v", x };
      setState((s) => {
        const ns = { ...s, guides: [...s.guides, g] };
        pushHistory(ns);
        return ns;
      });
    },
    onStartPickAngled: () => {
      setPickingPointsFor("angled");
      pickBufferRef.current = [];
    },
    onStartPickPoints: () => {
      setPickingPointsFor("points");
      pickBufferRef.current = [];
    },
    onCancelPick: () => {
      setPickingPointsFor(null);
      pickBufferRef.current = [];
    },
    onDelete: (id: string) =>
      setState((s) => {
        const ns = { ...s, guides: s.guides.filter((g) => g.id !== id) };
        pushHistory(ns);
        return ns;
      }),
    onClearAll: () =>
      setState((s) => {
        const ns = { ...s, guides: [] };
        pushHistory(ns);
        return ns;
      }),
    onSnapToggle: () =>
      setState((s) => ({ ...s, snapToGuides: !s.snapToGuides })),
  };

  const segmentProps = {
    segment: selectedSegment,
    lightMode,
    bulgeMm,
    onBulgeChange: (v: number) => {
      setBulgeMm(v);
      if (selectedSegment?.type === "arc") {
        setState((s) => {
          const ns = updateActiveSub(s, (sub) =>
            setArcBulge(sub, selectedSegment.id, v),
          );
          pushHistory(ns);
          return ns;
        });
      }
    },
    onDelete: () => {
      if (!selectedSegment) return;
      setState((s) => {
        const ns = updateActiveSub(s, (sub) =>
          deleteSegment(sub, selectedSegment.id),
        );
        pushHistory(ns);
        return { ...ns, selectedSegmentId: null };
      });
    },
    onSplit: () => {
      if (!selectedSegment) return;
      setState((s) => {
        const ns = updateActiveSub(s, (sub) =>
          splitSegment(sub, selectedSegment.id, 0.5),
        );
        pushHistory(ns);
        return { ...ns, selectedSegmentId: null };
      });
    },
    onConvert: (type: "line" | "arc" | "bezier") => {
      if (!selectedSegment) return;
      setState((s) => {
        const ns = updateActiveSub(s, (sub) =>
          convertSegment(sub, selectedSegment.id, type),
        );
        pushHistory(ns);
        return ns;
      });
    },
    onFlipArc: () => {
      if (!selectedSegment || selectedSegment.type !== "arc") return;
      setState((s) => {
        const ns = updateActiveSub(s, (sub) => ({
          ...sub,
          segments: sub.segments.map((seg) =>
            seg.id === selectedSegment.id && seg.type === "arc"
              ? { ...seg, cw: !seg.cw }
              : seg,
          ),
        }));
        pushHistory(ns);
        return ns;
      });
    },
  };

  const profileProps = {
    profiles,
    currentPoints: totalPoints,
    lightMode,
    onLoad: (p: Profile) => {
      const firstSub = p.subpaths[0];
      const ns = {
        ...makeDefaultState(),
        subpaths: p.subpaths,
        activeSubpathId: firstSub?.id ?? "",
      };
      setState(ns);
      pushHistory(ns);
      setSnack({ msg: `Loaded "${p.name}"`, type: "success" });
      setProfileDrawer(false);
    },
    onSave: (name: string) => {
      const p = saveProfile(name, state.subpaths);
      setProfiles(loadProfiles());
      setSnack({ msg: `Saved "${p.name}"`, type: "success" });
    },
    onDelete: (id: string) => {
      deleteProfile(id);
      setProfiles(loadProfiles());
    },
  };

  const canvas = (
    <canvas
      ref={canvasRef}
      onWheel={handleWheel}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        cursor: state.tool.startsWith("draw") ? "crosshair" : "default",
        touchAction: "none",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onContextMenu={(e) => e.preventDefault()}
    />
  );

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        bgcolor: bg,
        color: textCol,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 1.5,
          py: 0.75,
          borderBottom: `1px solid ${borderCol}`,
          bgcolor: headerBg,
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
          position: "relative",
          minHeight: 40,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Icon
            icon="uim:vector-square-alt"
            width={20}
            color={lightMode ? "#1565c0" : "#4fc3f7"}
          />
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              color: textCol,
              fontSize: 13,
              whiteSpace: "nowrap",
            }}
          >
            CAD Profile Builder
          </Typography>
          {!isMobile && (
            <Typography
              variant="caption"
              sx={{ color: subTextCol, ml: 0.5, fontSize: 10 }}
            >
              L=line (type mm, Tab/,=angle, Enter; snaps to 45° — Shift to
              bypass) · A=arc (click end, click to bow; Shift+click = eccentric
              curve) · S=select · Del=remove · wheel=zoom · RMB/Alt+drag=pan
            </Typography>
          )}
        </Box>
        <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              fontFamily: "monospace",
              fontSize: 11,
              color: coordCol,
              minWidth: isMobile ? 0 : 110,
              textAlign: "right",
            }}
          >
            {cursorMm
              ? `${cursorMm.x.toFixed(1)}, ${cursorMm.y.toFixed(1)}${isMobile ? "" : " mm"}`
              : "\u00a0"}
          </Box>
          <Tooltip title="3D preview">
            <IconButton
              size="small"
              onClick={() => setShow3DPreview(true)}
              sx={{ color: textCol }}
            >
              <Icon icon="mdi:cube-outline" width={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Help (?)">
            <IconButton
              size="small"
              onClick={() => setShowHelp(true)}
              sx={{ color: textCol }}
            >
              <Icon icon="mdi:help-circle" width={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title={lightMode ? "Dark mode" : "Light mode"}>
            <IconButton
              size="small"
              onClick={toggleColorMode}
              sx={{ color: textCol }}
            >
              <Icon
                icon={
                  lightMode
                    ? "mdi:moon-waning-crescent"
                    : "mdi:white-balance-sunny"
                }
                width={18}
              />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {isMobile ? (
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <Box sx={{ flex: 1, position: "relative", overflow: "hidden" }}>
            {canvas}
            <Box
              sx={{
                position: "absolute",
                top: 8,
                left: 8,
                fontSize: 11,
                fontFamily: "monospace",
                color: subTextCol,
                pointerEvents: "none",
              }}
            >
              {state.zoom.toFixed(1)}× · {state.subpaths.length} path
              {state.subpaths.length !== 1 ? "s" : ""}
            </Box>
            <Drawer
              anchor="left"
              open={toolDrawer}
              onClose={() => setToolDrawer(false)}
              slotProps={{
                paper: {
                  sx: {
                    width: 260,
                    height: "100%",
                    bgcolor: lightMode ? "#fff" : "#1a1a2e",
                  },
                },
              }}
            >
              <Toolbar {...toolbarProps} />
            </Drawer>
            <Drawer
              anchor="right"
              open={profileDrawer}
              onClose={() => setProfileDrawer(false)}
              slotProps={{
                paper: {
                  sx: {
                    width: 280,
                    height: "100%",
                    bgcolor: lightMode ? "#f8f9fa" : "#1a1a2e",
                  },
                },
              }}
            >
              <GuidesPanel {...guidesProps} />
              <Box sx={{ borderTop: `1px solid ${borderCol}` }}>
                <SegmentPanel {...segmentProps} />
              </Box>
              <Box sx={{ borderTop: `1px solid ${borderCol}` }}>
                <ProfilesPanel {...profileProps} />
              </Box>
            </Drawer>
            <Drawer
              anchor="bottom"
              open={exportDrawer}
              onClose={() => setExportDrawer(false)}
              slotProps={{
                paper: {
                  sx: {
                    borderRadius: "12px 12px 0 0",
                    bgcolor: lightMode ? "#fff" : "#12122a",
                  },
                },
              }}
            >
              <ExportPanel subpaths={state.subpaths} lightMode={lightMode} />
            </Drawer>
          </Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-around",
              borderTop: `1px solid ${borderCol}`,
              bgcolor: headerBg,
              px: 1,
              py: 0.75,
              flexShrink: 0,
            }}
          >
            {(["draw-line", "draw-arc", "select"] as const).map((t) => {
              const active = state.tool === t;
              const icon =
                t === "draw-line"
                  ? "mdi:vector-line"
                  : t === "draw-arc"
                    ? "mdi:vector-arrange-below"
                    : "mdi:hand-tap";
              const label =
                t === "draw-line"
                  ? "Line"
                  : t === "draw-arc"
                    ? "Arc"
                    : "Select";
              return (
                <Box
                  key={t}
                  onClick={() => setState((s) => ({ ...s, tool: t }))}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 0.25,
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 2,
                    cursor: "pointer",
                    bgcolor: active
                      ? lightMode
                        ? "#1e88e5"
                        : "#4fc3f7"
                      : "transparent",
                    color: active
                      ? lightMode
                        ? "#fff"
                        : "#000"
                      : lightMode
                        ? "rgba(0,0,0,0.55)"
                        : "rgba(255,255,255,0.6)",
                    transition: "all 0.15s",
                  }}
                >
                  <Icon icon={icon} width={20} color="inherit" />
                  <Typography
                    variant="caption"
                    sx={{ fontSize: 9, color: "inherit", fontWeight: 600 }}
                  >
                    {label}
                  </Typography>
                </Box>
              );
            })}
            <Box sx={{ width: 1, height: 32, bgcolor: borderCol }} />
            <MobileNavBtn
              icon="mdi:spanner"
              label="Tools"
              onClick={() => setToolDrawer(true)}
              lightMode={lightMode}
            />
            <MobileNavBtn
              icon="mdi:ruler-square-compass"
              label="Guides"
              onClick={() => setProfileDrawer(true)}
              lightMode={lightMode}
            />
            <MobileNavBtn
              icon="mdi:code"
              label="Export"
              onClick={() => setExportDrawer(true)}
              lightMode={lightMode}
            />
          </Box>
        </Box>
      ) : (
        <Box sx={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <Toolbar {...toolbarProps} />
          <Box sx={{ flex: 1, position: "relative", overflow: "hidden" }}>
            {canvas}
            <Box
              sx={{
                position: "absolute",
                bottom: 8,
                left: 8,
                fontSize: 11,
                fontFamily: "monospace",
                color: subTextCol,
                pointerEvents: "none",
              }}
            >
              {state.zoom.toFixed(1)}× · {totalPoints} pts ·{" "}
              {state.subpaths.length} path
              {state.subpaths.length !== 1 ? "s" : ""} · {state.guides.length}{" "}
              guide{state.guides.length !== 1 ? "s" : ""}
              {(numericInput || angleInput) && (
                <Box
                  component="span"
                  sx={{ ml: 1, color: lightMode ? "#1e88e5" : "#4fc3f7" }}
                >
                  ⌨ {numericInput || "—"}
                  {inputFocus === "length" ? "▌" : ""} mm
                  {" / "}
                  {angleInput || "—"}
                  {inputFocus === "angle" ? "▌" : ""}°
                </Box>
              )}
              {state.tool === "draw-arc" && (
                <Box component="span" sx={{ ml: 1, color: "#ffab40" }}>
                  {arcEndPt
                    ? "Move to bow · click = circle arc · Shift+click = eccentric curve"
                    : "Click to set arc end point"}
                </Box>
              )}
            </Box>
          </Box>
          <Box
            sx={{
              width: 240,
              flexShrink: 0,
              borderLeft: `1px solid ${borderCol}`,
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
            }}
          >
            <GuidesPanel {...guidesProps} />
            <Box sx={{ borderTop: `1px solid ${borderCol}` }}>
              <SegmentPanel {...segmentProps} />
            </Box>
            <Box sx={{ borderTop: `1px solid ${borderCol}`, flex: 1 }}>
              <ProfilesPanel {...profileProps} />
            </Box>
            <ExportPanel subpaths={state.subpaths} lightMode={lightMode} />
          </Box>
        </Box>
      )}

      <HelpModal
        open={showHelp}
        onClose={() => setShowHelp(false)}
        lightMode={lightMode}
      />
      <ProfilePreview3D
        open={show3DPreview}
        onClose={() => setShow3DPreview(false)}
        subpaths={state.subpaths}
        lightMode={lightMode}
      />
      <Snackbar
        open={!!snack}
        autoHideDuration={2000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack?.type} onClose={() => setSnack(null)}>
          {snack?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
