"use client";

import {
  Box,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  IconButton,
  Divider,
  Typography,
  Slider,
  Switch,
  FormControlLabel,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { ToolMode } from "./types";

interface ToolbarProps {
  tool: ToolMode;
  snapToGrid: boolean;
  showGrid: boolean;
  gridSizeMm: number;
  snapToGeometry: boolean;
  closedPath: boolean;
  pointCount: number;
  subpathCount: number;
  canUndo: boolean;
  canRedo: boolean;
  lightMode: boolean;
  onAddSubpath: () => void;
  onPlaceAtOrigin: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToolChange: (tool: ToolMode) => void;
  onSnapGridToggle: () => void;
  onSnapGeometryToggle: () => void;
  onGridToggle: () => void;
  onGridSizeChange: (v: number) => void;
  onClosePathToggle: () => void;
  onClear: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  imageUrl: string | null;
  onClearImage: () => void;
  imageOpacity: number;
  onImageOpacityChange: (v: number) => void;
}

const drawTools: {
  id: ToolMode;
  icon: string;
  label: string;
  title: string;
}[] = [
  {
    id: "draw-line",
    icon: "mdi:vector-line",
    label: "Line",
    title: "Draw line (L)",
  },
  {
    id: "draw-arc",
    icon: "mdi:vector-curve",
    label: "Arc",
    title: "Draw arc — circle (A) · hold Shift for eccentric curve",
  },
  {
    id: "select",
    icon: "mdi:hand-tap",
    label: "Select",
    title: "Select / edit (S)",
  },
];

function SectionLabel({ text }: { text: string }) {
  return (
    <Typography
      variant="caption"
      sx={{
        color: "text.secondary",
        textTransform: "uppercase",
        letterSpacing: 1,
        fontSize: 10,
      }}
    >
      {text}
    </Typography>
  );
}

export default function Toolbar({
  tool,
  snapToGrid,
  showGrid,
  gridSizeMm,
  snapToGeometry,
  closedPath,
  pointCount,
  subpathCount,
  canUndo,
  canRedo,
  onAddSubpath,
  onPlaceAtOrigin,
  onUndo,
  onRedo,
  onToolChange,
  onSnapGridToggle,
  onSnapGeometryToggle,
  onGridToggle,
  onGridSizeChange,
  onClosePathToggle,
  onClear,
  onZoomIn,
  onZoomOut,
  onResetView,
  onImageUpload,
  imageUrl,
  onClearImage,
  imageOpacity,
  onImageOpacityChange,
}: ToolbarProps) {
  return (
    <Box
      sx={{
        width: 220,
        flexShrink: 0,
        bgcolor: "background.paper",
        borderRight: 1,
        borderColor: "divider",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        color: "text.primary",
      }}
    >
      {/* Tool */}
      <Box sx={{ p: 1.5 }}>
        <SectionLabel text="Tool" />
        <Stack sx={{ mt: 1, gap: 0.5 }}>
          {drawTools.map((t) => (
            <ToggleButton
              key={t.id}
              value={t.id}
              selected={tool === t.id}
              onChange={() => onToolChange(t.id)}
              fullWidth
              sx={{
                justifyContent: "flex-start",
                gap: 1,
                py: 0.75,
                px: 1,
                textTransform: "none",
                borderRadius: "6px !important",
              }}
            >
              <Tooltip title={t.title}>
                <Stack
                  direction="row"
                  sx={{ alignItems: "center", gap: 1, width: "100%" }}
                >
                  <Icon icon={t.icon} width={16} color="inherit" />
                  <Typography
                    variant="caption"
                    sx={{ fontSize: 11, color: "inherit", fontWeight: 600 }}
                  >
                    {t.label}
                  </Typography>
                </Stack>
              </Tooltip>
            </ToggleButton>
          ))}
        </Stack>
      </Box>

      <Divider />

      {/* History */}
      <Box sx={{ p: 1.5 }}>
        <SectionLabel text="History" />
        <Stack direction="row" sx={{ gap: 0.5, mt: 1 }}>
          <Tooltip title="Undo (Ctrl+Z)">
            <span>
              <IconButton size="small" onClick={onUndo} disabled={!canUndo}>
                <Icon icon="mdi:undo" width={18} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo (Ctrl+Y)">
            <span>
              <IconButton size="small" onClick={onRedo} disabled={!canRedo}>
                <Icon icon="mdi:redo" width={18} />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Box>

      <Divider />

      {/* Snapping */}
      <Box sx={{ p: 1.5 }}>
        <SectionLabel text="Snapping" />
        <Stack sx={{ gap: 0.5, mt: 1 }}>
          <FormControlLabel
            control={
              <Switch size="small" checked={showGrid} onChange={onGridToggle} />
            }
            label={<Typography variant="caption">Show grid</Typography>}
            sx={{ m: 0 }}
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={snapToGrid}
                onChange={onSnapGridToggle}
              />
            }
            label={<Typography variant="caption">Snap to grid</Typography>}
            sx={{ m: 0 }}
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={snapToGeometry}
                onChange={onSnapGeometryToggle}
              />
            }
            label={<Typography variant="caption">Snap to points</Typography>}
            sx={{ m: 0 }}
          />
          <Box sx={{ mt: 0.5 }}>
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", display: "block", mb: 0.5 }}
            >
              Grid: {gridSizeMm}mm
            </Typography>
            <Slider
              size="small"
              min={0.5}
              max={20}
              step={0.5}
              value={gridSizeMm}
              onChange={(_, v) => onGridSizeChange(v as number)}
            />
          </Box>
        </Stack>
      </Box>

      <Divider />

      {/* Path */}
      <Box sx={{ p: 1.5 }}>
        <SectionLabel text="Path" />
        <Stack sx={{ gap: 0.5, mt: 1 }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={closedPath}
                onChange={onClosePathToggle}
              />
            }
            label={<Typography variant="caption">Close path</Typography>}
            sx={{ m: 0 }}
          />
          <Box sx={{ height: 18 }}>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {pointCount} pts · {subpathCount} path
              {subpathCount !== 1 ? "s" : ""}
            </Typography>
          </Box>
          <Tooltip title="Place the next point exactly at (0, 0) — ignores cursor position">
            <Box
              onClick={onPlaceAtOrigin}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                mt: 0.5,
                px: 1,
                py: 0.5,
                borderRadius: 1,
                cursor: "pointer",
                border: 1,
                borderStyle: "dashed",
                borderColor: "divider",
                color: "text.secondary",
                "&:hover": {
                  borderColor: "primary.main",
                  color: "text.primary",
                },
                transition: "all 0.15s",
              }}
            >
              <Icon icon="mdi:crosshairs-gps" width={14} color="inherit" />
              <Typography
                variant="caption"
                sx={{ fontSize: 11, color: "inherit" }}
              >
                Place at origin (0,0)
              </Typography>
            </Box>
          </Tooltip>
        </Stack>
        <Stack direction="row" sx={{ gap: 0.5, mt: 0.5 }}>
          <Tooltip title="Clear all">
            <span>
              <IconButton
                size="small"
                onClick={onClear}
                disabled={pointCount === 0}
              >
                <Icon icon="mdi:trash-can-outline" width={18} />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Box>

      <Divider />

      {/* View */}
      <Box sx={{ p: 1.5 }}>
        <SectionLabel text="View" />
        <Stack direction="row" sx={{ gap: 0.5, mt: 1 }}>
          <Tooltip title="Zoom in (+)">
            <IconButton size="small" onClick={onZoomIn}>
              <Icon icon="mdi:plus" width={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom out (-)">
            <IconButton size="small" onClick={onZoomOut}>
              <Icon icon="mdi:minus" width={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reset view (R)">
            <IconButton size="small" onClick={onResetView}>
              <Icon icon="mdi:fit-to-screen-outline" width={18} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      <Divider />

      {/* Reference image */}
      <Box sx={{ p: 1.5 }}>
        <SectionLabel text="Reference image" />
        <Stack sx={{ gap: 1, mt: 1 }}>
          <label>
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={onImageUpload}
            />
            <Box
              component="span"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                border: 1,
                borderStyle: "dashed",
                borderColor: "divider",
                borderRadius: 1,
                p: 1,
                cursor: "pointer",
                color: "text.secondary",
                "&:hover": {
                  borderColor: "primary.main",
                  color: "text.primary",
                },
              }}
            >
              <Icon icon="mdi:image-plus-outline" width={16} />
              <Typography variant="caption">
                {imageUrl ? "Change image" : "Upload image"}
              </Typography>
            </Box>
          </label>
          {imageUrl && (
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Opacity: {Math.round(imageOpacity * 100)}%
              </Typography>
              <Slider
                size="small"
                min={0}
                max={1}
                step={0.05}
                value={imageOpacity}
                onChange={(_, v) => onImageOpacityChange(v as number)}
                sx={{ mt: 0.5 }}
              />
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  mt: 0.5,
                }}
              >
                <IconButton size="small" onClick={onClearImage}>
                  <Icon icon="mdi:image-remove-outline" width={16} />
                </IconButton>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Remove image
                </Typography>
              </Box>
            </Box>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
