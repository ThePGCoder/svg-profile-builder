import { Point, Profile, Pt, Subpath } from "./types";
import { orderedWalk, segEndpoints } from "./segments";

const STORAGE_KEY = "path-editor-profiles-v2";

export function loadProfiles(): Profile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveProfile(name: string, subpaths: Subpath[]): Profile {
  const profiles = loadProfiles();
  const existing = profiles.find((p) => p.name === name);
  const now = Date.now();
  if (existing) {
    existing.subpaths = subpaths;
    existing.updatedAt = now;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    return existing;
  }
  const profile: Profile = {
    id: crypto.randomUUID(),
    name,
    subpaths,
    createdAt: now,
    updatedAt: now,
  };
  profiles.push(profile);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  return profile;
}

export function deleteProfile(id: string): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(loadProfiles().filter((p) => p.id !== id)),
  );
}

function allPoints(subpaths: Subpath[]): Point[] {
  return subpaths.flatMap((s) => s.points);
}

function norm(p: Pt, minX: number, maxY: number) {
  return {
    x: parseFloat(((p.x - minX) / 1000).toFixed(6)),
    y: parseFloat(((maxY - p.y) / 1000).toFixed(6)),
  };
}

// ── Shared shape-building instructions ───────────────────────────
// A single source of truth for "what THREE.Shape calls does this profile
// produce", consumed by both the code-string exporter (for the user to
// copy/paste) and the live 3D preview (which builds a real THREE.Shape
// object). Keeping these on one path means the preview can never drift
// out of sync with what gets exported.

export type ShapeInstruction =
  | { op: "moveTo"; x: number; y: number }
  | { op: "lineTo"; x: number; y: number }
  | {
      op: "bezierCurveTo";
      cp1x: number;
      cp1y: number;
      cp2x: number;
      cp2y: number;
      x: number;
      y: number;
    }
  | {
      op: "absarc";
      cx: number;
      cy: number;
      radius: number;
      startAngle: number;
      endAngle: number;
      ccw: boolean;
    }
  | { op: "closePath" };

export interface ShapeBuildResult {
  subpathInstructions: ShapeInstruction[][];
  widthMm: number;
  heightMm: number;
}

export function buildShapeInstructions(subpaths: Subpath[]): ShapeBuildResult {
  const pts = allPoints(subpaths);
  if (pts.length === 0)
    return { subpathInstructions: [], widthMm: 0, heightMm: 0 };

  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const widthMm = Math.round((maxX - minX) * 10) / 10;
  const heightMm = Math.round((maxY - minY) * 10) / 10;

  const subpathInstructions: ShapeInstruction[][] = [];

  subpaths.forEach((sub) => {
    const ordered = orderedWalk(sub);
    if (ordered.length === 0) return;
    const instructions: ShapeInstruction[] = [];

    const first = norm(ordered[0], minX, maxY);
    instructions.push({ op: "moveTo", x: first.x, y: first.y });

    for (const seg of sub.segments) {
      const ends = segEndpoints(sub, seg);
      if (!ends) continue;
      const to = norm(ends.to, minX, maxY);

      if (seg.type === "line") {
        instructions.push({ op: "lineTo", x: to.x, y: to.y });
      } else if (seg.type === "bezier") {
        const cp1 = norm(seg.cp1, minX, maxY);
        const cp2 = norm(seg.cp2, minX, maxY);
        instructions.push({
          op: "bezierCurveTo",
          cp1x: cp1.x,
          cp1y: cp1.y,
          cp2x: cp2.x,
          cp2y: cp2.y,
          x: to.x,
          y: to.y,
        });
      } else if (seg.type === "arc") {
        const center = norm(seg.center, minX, maxY);
        const radius =
          Math.hypot(ends.from.x - seg.center.x, ends.from.y - seg.center.y) /
          1000;
        const a0 = Math.atan2(
          ends.from.y - seg.center.y,
          ends.from.x - seg.center.x,
        );
        const a1 = Math.atan2(
          ends.to.y - seg.center.y,
          ends.to.x - seg.center.x,
        );
        // y is flipped in normalised space (maxY - y), so flip sweep sense
        instructions.push({
          op: "absarc",
          cx: center.x,
          cy: center.y,
          radius: parseFloat(radius.toFixed(6)),
          startAngle: -a0,
          endAngle: -a1,
          ccw: !seg.cw,
        });
      }
    }
    if (sub.closed) instructions.push({ op: "closePath" });
    subpathInstructions.push(instructions);
  });

  return { subpathInstructions, widthMm, heightMm };
}

export function exportData(subpaths: Subpath[]) {
  const { subpathInstructions, widthMm, heightMm } =
    buildShapeInstructions(subpaths);
  if (subpathInstructions.length === 0)
    return { threeShape: "", widthMm: 0, heightMm: 0 };

  const lines: string[] = ["const shape = new THREE.Shape();"];
  subpathInstructions.forEach((instructions, si) => {
    if (si > 0) lines.push("");
    for (const ins of instructions) {
      switch (ins.op) {
        case "moveTo":
          lines.push(`shape.moveTo(${ins.x}, ${ins.y});`);
          break;
        case "lineTo":
          lines.push(`shape.lineTo(${ins.x}, ${ins.y});`);
          break;
        case "bezierCurveTo":
          lines.push(
            `shape.bezierCurveTo(${ins.cp1x}, ${ins.cp1y}, ${ins.cp2x}, ${ins.cp2y}, ${ins.x}, ${ins.y});`,
          );
          break;
        case "absarc":
          lines.push(
            `shape.absarc(${ins.cx}, ${ins.cy}, ${ins.radius}, ${ins.startAngle.toFixed(4)}, ${ins.endAngle.toFixed(4)}, ${ins.ccw});`,
          );
          break;
        case "closePath":
          lines.push(`shape.closePath();`);
          break;
      }
    }
  });

  return { threeShape: lines.join("\n"), widthMm, heightMm };
}
