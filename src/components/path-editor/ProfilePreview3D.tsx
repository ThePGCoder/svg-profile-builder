"use client";

import { useMemo, useRef, useState, Suspense } from "react";
import {
  Dialog,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Slider,
  Stack,
  Tooltip,
  Popover,
  FormControlLabel,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { HexColorPicker, HexColorInput } from "react-colorful";
import * as THREE from "three";
import { Subpath } from "./types";
import { ShapeInstruction, buildShapeInstructions } from "./storage";

interface ProfilePreview3DProps {
  open: boolean;
  onClose: () => void;
  subpaths: Subpath[];
  lightMode: boolean;
}

type MaterialType = "standard" | "phong" | "lambert" | "toon" | "basic";

interface MaterialSettings {
  color: string;
  roughness: number; // standard only
  metalness: number; // standard only
  shininess: number; // phong only
  specular: string; // phong only
  flatShading: boolean;
}

const MATERIAL_LABELS: Record<
  MaterialType,
  { label: string; icon: string; description: string }
> = {
  standard: {
    label: "Standard",
    icon: "mdi:texture-box",
    description: "PBR — roughness/metalness, most realistic",
  },
  phong: {
    label: "Phong",
    icon: "mdi:circle-half-full",
    description: "Classic specular highlight, shiny plastic look",
  },
  lambert: {
    label: "Lambert",
    icon: "mdi:circle-outline",
    description: "Matte, no specular highlight",
  },
  toon: {
    label: "Toon",
    icon: "mdi:circle-slice-8",
    description: "Cel-shaded, flat bands of light",
  },
  basic: {
    label: "Basic",
    icon: "mdi:circle",
    description: "Unlit flat color, ignores all lighting",
  },
};

const PRESET_COLORS = [
  "#c9a876", // timber
  "#8d6e63", // dark timber
  "#9e9e9e", // concrete/aluminium
  "#b0bec5", // steel
  "#37474f", // dark steel
  "#43a047", // green (test/highlight)
  "#e53935", // red (test/highlight)
  "#1e88e5", // blue (test/highlight)
];

/** Builds a real THREE.Shape from the same instruction list the code
 * exporter produces, so the preview can never show something different
 * from what gets exported. */
function buildThreeShape(instructions: ShapeInstruction[]): THREE.Shape {
  const shape = new THREE.Shape();
  for (const ins of instructions) {
    switch (ins.op) {
      case "moveTo":
        shape.moveTo(ins.x, ins.y);
        break;
      case "lineTo":
        shape.lineTo(ins.x, ins.y);
        break;
      case "bezierCurveTo":
        shape.bezierCurveTo(
          ins.cp1x,
          ins.cp1y,
          ins.cp2x,
          ins.cp2y,
          ins.x,
          ins.y,
        );
        break;
      case "absarc":
        shape.absarc(
          ins.cx,
          ins.cy,
          ins.radius,
          ins.startAngle,
          ins.endAngle,
          ins.ccw,
        );
        break;
      case "closePath":
        shape.closePath();
        break;
    }
  }
  return shape;
}

function ExtrudedProfile({
  subpathInstructions,
  depth,
  wireframe,
  materialType,
  settings,
}: {
  subpathInstructions: ShapeInstruction[][];
  depth: number;
  wireframe: boolean;
  materialType: MaterialType;
  settings: MaterialSettings;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    if (subpathInstructions.length === 0) return null;
    // Single subpath only — multiple subpaths used to be treated as
    // outer-boundary-plus-holes, but that produced garbled/broken
    // extrusion whenever the subpaths weren't actually meant as
    // nested holes (e.g. two separate boundary pieces, or pieces drawn
    // with inconsistent winding). Subpath creation is disabled in the UI
    // for now, so this just extrudes the one path that exists. If a
    // stale profile somehow has extra subpaths, only the first is used.
    const shape = buildThreeShape(subpathInstructions[0]);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
      curveSegments: 32,
    });
    geo.center();
    return geo;
  }, [subpathInstructions, depth]);

  if (!geometry) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      castShadow={false}
      receiveShadow={false}
    >
      {materialType === "standard" && (
        <meshStandardMaterial
          key={`standard-${settings.color}-${settings.roughness}-${settings.metalness}-${settings.flatShading}`}
          color={settings.color}
          roughness={settings.roughness}
          metalness={settings.metalness}
          flatShading={settings.flatShading}
          wireframe={wireframe}
        />
      )}
      {materialType === "phong" && (
        <meshPhongMaterial
          key={`phong-${settings.color}-${settings.shininess}-${settings.specular}-${settings.flatShading}`}
          color={settings.color}
          shininess={settings.shininess}
          specular={settings.specular}
          flatShading={settings.flatShading}
          wireframe={wireframe}
        />
      )}
      {materialType === "lambert" && (
        <meshLambertMaterial
          key={`lambert-${settings.color}-${settings.flatShading}`}
          color={settings.color}
          flatShading={settings.flatShading}
          wireframe={wireframe}
        />
      )}
      {materialType === "toon" && (
        <meshToonMaterial
          key={`toon-${settings.color}`}
          color={settings.color}
          wireframe={wireframe}
        />
      )}
      {materialType === "basic" && (
        <meshBasicMaterial
          key={`basic-${settings.color}`}
          color={settings.color}
          wireframe={wireframe}
        />
      )}
    </mesh>
  );
}

function SceneContent({
  subpathInstructions,
  depth,
  wireframe,
  materialType,
  settings,
  lightMode,
}: {
  subpathInstructions: ShapeInstruction[][];
  depth: number;
  wireframe: boolean;
  materialType: MaterialType;
  settings: MaterialSettings;
  lightMode: boolean;
}) {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 3, 2]} intensity={1.1} />
      <directionalLight position={[-2, -1, -2]} intensity={0.35} />
      <directionalLight position={[0, -2, 1]} intensity={0.2} />
      <ExtrudedProfile
        subpathInstructions={subpathInstructions}
        depth={depth}
        wireframe={wireframe}
        materialType={materialType}
        settings={settings}
      />
      <Grid
        args={[2, 2]}
        cellSize={0.05}
        cellThickness={0.5}
        sectionSize={0.25}
        sectionThickness={1}
        fadeDistance={2}
        cellColor={lightMode ? "#ccc" : "#444"}
        sectionColor={lightMode ? "#999" : "#666"}
        position={[0, -0.3, 0]}
      />
      <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
    </>
  );
}

function ColorSwatchButton({
  color,
  onChange,
  lightMode,
}: {
  color: string;
  onChange: (c: string) => void;
  lightMode: boolean;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const border = lightMode ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.25)";

  return (
    <>
      <Tooltip title="Color">
        <Box
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            width: 28,
            height: 28,
            borderRadius: 1,
            bgcolor: color,
            border: `1.5px solid ${border}`,
            cursor: "pointer",
            flexShrink: 0,
          }}
        />
      </Tooltip>
      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
        slotProps={{
          paper: { sx: { p: 1.5, bgcolor: lightMode ? "#fff" : "#1a1a2e" } },
        }}
      >
        <Box sx={{ width: 200 }}>
          <HexColorPicker
            color={color}
            onChange={onChange}
            style={{ width: "100%" }}
          />
          <Box sx={{ mt: 1.25 }}>
            <HexColorInput
              color={color}
              onChange={onChange}
              prefixed
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "6px 8px",
                borderRadius: 4,
                border: `1px solid ${border}`,
                background: "transparent",
                color: lightMode ? "#111" : "#fff",
                fontFamily: "monospace",
                fontSize: 12,
              }}
            />
          </Box>
          <Stack direction="row" sx={{ gap: 0.5, mt: 1, flexWrap: "wrap" }}>
            {PRESET_COLORS.map((c) => (
              <Box
                key={c}
                onClick={() => onChange(c)}
                sx={{
                  width: 18,
                  height: 18,
                  borderRadius: 0.5,
                  bgcolor: c,
                  cursor: "pointer",
                  border:
                    c === color
                      ? `2px solid ${lightMode ? "#1565c0" : "#4fc3f7"}`
                      : `1px solid ${border}`,
                }}
              />
            ))}
          </Stack>
        </Box>
      </Popover>
    </>
  );
}

export default function ProfilePreview3D({
  open,
  onClose,
  subpaths,
  lightMode,
}: ProfilePreview3DProps) {
  const [depthMm, setDepthMm] = useState(100);
  const [wireframe, setWireframe] = useState(false);
  const [materialType, setMaterialType] = useState<MaterialType>("standard");
  const [settings, setSettings] = useState<MaterialSettings>({
    color: "#c9a876",
    roughness: 0.7,
    metalness: 0.05,
    shininess: 60,
    specular: "#ffffff",
    flatShading: false,
  });

  const update = (patch: Partial<MaterialSettings>) =>
    setSettings((s) => ({ ...s, ...patch }));

  const { subpathInstructions, widthMm, heightMm } = useMemo(
    () => buildShapeInstructions(subpaths),
    [subpaths],
  );

  const bg = lightMode ? "#fff" : "#1a1a2e";
  const textCol = lightMode ? "#111" : "#fff";
  const subCol = lightMode ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)";
  const labelCol = lightMode ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)";
  const border = lightMode ? "rgba(0,0,0,0.14)" : "rgba(255,255,255,0.16)";
  const accent = lightMode ? "#1e88e5" : "#4fc3f7";

  const hasGeometry = subpathInstructions.length > 0;

  const SectionLabel = ({ text }: { text: string }) => (
    <Typography
      variant="caption"
      sx={{
        color: labelCol,
        textTransform: "uppercase",
        letterSpacing: 1,
        fontSize: 10,
        display: "block",
        mb: 0.75,
      }}
    >
      {text}
    </Typography>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      slotProps={{
        paper: { sx: { bgcolor: bg, color: textCol, height: "85vh" } },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          px: 2,
          py: 1.25,
          borderBottom: `1px solid ${border}`,
          flexShrink: 0,
        }}
      >
        <Icon icon="mdi:cube-outline" width={20} color={accent} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700, ml: 1 }}>
          3D Preview
        </Typography>
        {hasGeometry && (
          <Typography variant="caption" sx={{ color: subCol, ml: 1.5 }}>
            {widthMm} × {heightMm} mm profile
          </Typography>
        )}
        <IconButton onClick={onClose} sx={{ ml: "auto", color: textCol }}>
          <Icon icon="mdi:close" width={20} />
        </IconButton>
      </Box>

      <DialogContent
        sx={{ p: 0, display: "flex", flex: 1, overflow: "hidden" }}
      >
        {!hasGeometry ? (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 1,
            }}
          >
            <Icon icon="mdi:cube-off-outline" width={32} color={subCol} />
            <Typography variant="body2" sx={{ color: subCol }}>
              Draw a closed profile to see it extruded here.
            </Typography>
          </Box>
        ) : (
          <>
            <Box
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <Box sx={{ flex: 1, position: "relative" }}>
                <Canvas
                  camera={{ position: [0.3, 0.25, 0.3], fov: 45 }}
                  style={{ background: lightMode ? "#eef1f4" : "#0f0f23" }}
                >
                  <Suspense fallback={null}>
                    <SceneContent
                      subpathInstructions={subpathInstructions}
                      depth={depthMm / 1000}
                      wireframe={wireframe}
                      materialType={materialType}
                      settings={settings}
                      lightMode={lightMode}
                    />
                  </Suspense>
                </Canvas>
              </Box>
              <Box
                sx={{
                  px: 2,
                  py: 1.5,
                  borderTop: `1px solid ${border}`,
                  flexShrink: 0,
                }}
              >
                <Stack
                  direction="row"
                  sx={{ gap: 3, alignItems: "center", flexWrap: "wrap" }}
                >
                  <Box sx={{ minWidth: 220, flex: 1 }}>
                    <Typography variant="caption" sx={{ color: subCol }}>
                      Extrude depth: {depthMm} mm
                    </Typography>
                    <Slider
                      size="small"
                      min={5}
                      max={500}
                      value={depthMm}
                      onChange={(_, v) => setDepthMm(v as number)}
                      sx={{ color: accent }}
                    />
                  </Box>
                  <Tooltip title="Toggle wireframe">
                    <ToggleButton
                      size="small"
                      value="wireframe"
                      selected={wireframe}
                      onChange={() => setWireframe((w) => !w)}
                      sx={{}}
                    >
                      <Icon icon="mdi:cube-outline" width={20} />
                    </ToggleButton>
                  </Tooltip>
                  <Typography variant="caption" sx={{ color: subCol }}>
                    Drag to orbit · scroll to zoom
                  </Typography>
                </Stack>
              </Box>
            </Box>

            {/* Material panel */}
            <Box
              sx={{
                width: 240,
                flexShrink: 0,
                borderLeft: `1px solid ${border}`,
                overflowY: "auto",
                p: 1.5,
                bgcolor: lightMode
                  ? "rgba(0,0,0,0.02)"
                  : "rgba(255,255,255,0.025)",
              }}
            >
              <SectionLabel text="Material" />
              <Stack sx={{ mb: 2, gap: 0.5 }}>
                {(Object.keys(MATERIAL_LABELS) as MaterialType[]).map((t) => {
                  const m = MATERIAL_LABELS[t];
                  return (
                    <ToggleButton
                      key={t}
                      value={t}
                      selected={materialType === t}
                      onChange={() => setMaterialType(t)}
                      fullWidth
                      sx={{
                        justifyContent: "flex-start",
                        py: 0.75,
                        px: 1,
                        textTransform: "none",
                        borderRadius: "6px !important",
                      }}
                    >
                      <Tooltip title={m.description} placement="left">
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: 12,
                            color: "inherit",
                            fontWeight: 600,
                          }}
                        >
                          {m.label}
                        </Typography>
                      </Tooltip>
                    </ToggleButton>
                  );
                })}
              </Stack>

              <SectionLabel text="Color" />
              <Stack
                direction="row"
                sx={{ alignItems: "center", gap: 1, mb: 2 }}
              >
                <ColorSwatchButton
                  color={settings.color}
                  onChange={(c) => update({ color: c })}
                  lightMode={lightMode}
                />
                <Typography
                  variant="caption"
                  sx={{ fontFamily: "monospace", color: subCol }}
                >
                  {settings.color}
                </Typography>
              </Stack>

              {materialType === "standard" && (
                <>
                  <SectionLabel text="Roughness" />
                  <Slider
                    size="small"
                    min={0}
                    max={1}
                    step={0.01}
                    value={settings.roughness}
                    onChange={(_, v) => update({ roughness: v as number })}
                    sx={{ color: accent, mb: 1.5 }}
                  />
                  <SectionLabel text="Metalness" />
                  <Slider
                    size="small"
                    min={0}
                    max={1}
                    step={0.01}
                    value={settings.metalness}
                    onChange={(_, v) => update({ metalness: v as number })}
                    sx={{ color: accent, mb: 1.5 }}
                  />
                </>
              )}

              {materialType === "phong" && (
                <>
                  <SectionLabel text="Shininess" />
                  <Slider
                    size="small"
                    min={0}
                    max={200}
                    value={settings.shininess}
                    onChange={(_, v) => update({ shininess: v as number })}
                    sx={{ color: accent, mb: 1.5 }}
                  />
                  <SectionLabel text="Specular" />
                  <Stack
                    direction="row"
                    sx={{ alignItems: "center", gap: 1, mb: 1.5 }}
                  >
                    <ColorSwatchButton
                      color={settings.specular}
                      onChange={(c) => update({ specular: c })}
                      lightMode={lightMode}
                    />
                    <Typography
                      variant="caption"
                      sx={{ fontFamily: "monospace", color: subCol }}
                    >
                      {settings.specular}
                    </Typography>
                  </Stack>
                </>
              )}

              {(materialType === "standard" ||
                materialType === "phong" ||
                materialType === "lambert") && (
                <FormControlLabel
                  sx={{ m: 0, mb: 1 }}
                  control={
                    <Switch
                      size="small"
                      checked={settings.flatShading}
                      onChange={(e) =>
                        update({ flatShading: e.target.checked })
                      }
                    />
                  }
                  label={
                    <Typography variant="caption">Flat shading</Typography>
                  }
                />
              )}

              {materialType === "toon" && (
                <Typography
                  variant="caption"
                  sx={{ color: subCol, display: "block", lineHeight: 1.5 }}
                >
                  Toon shading bands light into flat steps — no
                  roughness/metalness controls apply.
                </Typography>
              )}
              {materialType === "basic" && (
                <Typography
                  variant="caption"
                  sx={{ color: subCol, display: "block", lineHeight: 1.5 }}
                >
                  Basic material ignores scene lighting entirely — flat,
                  unshaded color.
                </Typography>
              )}
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
