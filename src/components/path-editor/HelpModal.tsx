"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Divider,
  Stack,
} from "@mui/material";
import { Icon } from "@iconify/react";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
  lightMode: boolean;
}

interface ShortcutRow {
  keys: string[];
  description: string;
}

export default function HelpModal({
  open,
  onClose,
  lightMode,
}: HelpModalProps) {
  const bg = lightMode ? "#fff" : "#1a1a2e";
  const textCol = lightMode ? "#111" : "#fff";
  const subCol = lightMode ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)";
  const labelCol = lightMode ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)";
  const kbdBg = lightMode ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.1)";
  const kbdBorder = lightMode ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.25)";
  const divCol = lightMode ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";
  const tipBg = lightMode ? "rgba(21,101,192,0.07)" : "rgba(79,195,247,0.07)";
  const tipBorder = lightMode ? "rgba(21,101,192,0.2)" : "rgba(79,195,247,0.2)";
  const codeBg = lightMode ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)";

  function KBD({ k }: { k: string }) {
    return (
      <Box
        component="span"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          px: 0.75,
          py: 0.2,
          borderRadius: 0.75,
          fontFamily: "monospace",
          fontSize: 11,
          fontWeight: 700,
          color: textCol,
          bgcolor: kbdBg,
          border: `1px solid ${kbdBorder}`,
          minWidth: 22,
          mr: 0.35,
          lineHeight: 1.6,
        }}
      >
        {k}
      </Box>
    );
  }

  function Section({
    title,
    icon,
    rows,
  }: {
    title: string;
    icon: string;
    rows: ShortcutRow[];
  }) {
    return (
      <Box sx={{ mb: 2.5 }}>
        <Stack direction="row" sx={{ alignItems: "center", gap: 0.75, mb: 1 }}>
          <Icon icon={icon} width={15} color={labelCol} />
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
              fontSize: 10,
              color: labelCol,
            }}
          >
            {title}
          </Typography>
        </Stack>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
          {rows.map((r, i) => (
            <Box
              key={i}
              sx={{ display: "flex", alignItems: "baseline", gap: 1 }}
            >
              <Box sx={{ flexShrink: 0, minWidth: 140 }}>
                {r.keys.map((k) => (
                  <KBD key={k} k={k} />
                ))}
              </Box>
              <Typography
                variant="caption"
                sx={{ color: subCol, lineHeight: 1.5 }}
              >
                {r.description}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: { sx: { bgcolor: bg, color: textCol, maxHeight: "88vh" } },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          pb: 1,
          color: textCol,
        }}
      >
        <Icon
          icon="uim:vector-square-alt"
          width={22}
          color={lightMode ? "#1565c0" : "#4fc3f7"}
        />
        <Box>
          <Typography
            variant="h6"
            sx={{ fontWeight: 700, lineHeight: 1, color: textCol }}
          >
            CAD Profile Builder
          </Typography>
          <Typography variant="caption" sx={{ color: subCol }}>
            Keyboard shortcuts & usage guide
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ ml: "auto", color: textCol }}>
          <Icon icon="mdi:close" width={20} />
        </IconButton>
      </DialogTitle>

      <Divider sx={{ borderColor: divCol }} />

      <DialogContent sx={{ pt: 2 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 3,
          }}
        >
          {/* Column 1 */}
          <Box>
            <Section
              title="Tools"
              icon="mdi:tools"
              rows={[
                { keys: ["L"], description: "Switch to Line tool" },
                { keys: ["A"], description: "Switch to Arc tool" },
                { keys: ["S"], description: "Switch to Select mode" },
                {
                  keys: ["M"],
                  description:
                    "New subpath — lift pen, start a disconnected area",
                },
                {
                  keys: ["Origin (0,0)"],
                  description:
                    "Sidebar button — places next point exactly at (0,0)",
                },
                { keys: ["H", "?"], description: "Open this help dialog" },
              ]}
            />

            <Section
              title="Drawing — Line"
              icon="mdi:vector-line"
              rows={[
                { keys: ["Click"], description: "Place the next point" },
                {
                  keys: ["Click first pt"],
                  description: "Close the active subpath",
                },
                {
                  keys: ["Angle snap"],
                  description:
                    "Soft-snaps to 0/45/90/135/180° — hold Shift to bypass",
                },
                {
                  keys: ["0–9", "."],
                  description: "Type a length in mm — line live-updates",
                },
                {
                  keys: ["Tab", ","],
                  description: "Switch to the angle field",
                },
                { keys: ["@"], description: "Jump straight to angle field" },
                {
                  keys: ["Enter"],
                  description: "Commit point at typed length / angle",
                },
                {
                  keys: ["Backspace"],
                  description:
                    "Delete last digit; empty angle → back to length",
                },
                {
                  keys: ["Esc"],
                  description: "Cancel current numeric entry",
                },
              ]}
            />

            <Section
              title="Drawing — Arc"
              icon="mdi:vector-arrange-below"
              rows={[
                {
                  keys: ["Click"],
                  description: "1st click — set the arc's end point",
                },
                {
                  keys: ["Move"],
                  description: "Live arc preview bows toward the cursor",
                },
                {
                  keys: ["Click"],
                  description: "2nd click — commit, cursor sets the bow",
                },
                {
                  keys: ["Esc"],
                  description: "Cancel a pending arc end point",
                },
              ]}
            />
          </Box>

          {/* Column 2 */}
          <Box>
            <Section
              title="Select & Edit"
              icon="mdi:hand-tap"
              rows={[
                { keys: ["Click pt"], description: "Select / drag a point" },
                {
                  keys: ["Click edge"],
                  description: "Select a segment (line, arc, or bezier)",
                },
                {
                  keys: ["Sidebar"],
                  description: "Convert type, split, flip arc, or delete",
                },
                { keys: ["Del"], description: "Delete the selected segment" },
                { keys: ["Esc"], description: "Deselect" },
              ]}
            />

            <Section
              title="Guides"
              icon="mdi:ruler-square-compass"
              rows={[
                {
                  keys: ["H guide"],
                  description: "Type a y value (+ = above origin)",
                },
                { keys: ["V guide"], description: "Type an x value" },
                {
                  keys: ["∠ guide"],
                  description: "Click a point, then type an angle",
                },
                {
                  keys: ["2-pt guide"],
                  description: "Click two points to draw a line through both",
                },
                {
                  keys: ["Snap"],
                  description:
                    "Drawing snaps to guides and guide-guide intersections",
                },
              ]}
            />

            <Section
              title="Navigation"
              icon="mdi:compass"
              rows={[
                { keys: ["Wheel"], description: "Pan the canvas" },
                { keys: ["Ctrl+Wheel"], description: "Zoom in / out" },
                { keys: ["RMB+drag"], description: "Pan (right mouse button)" },
                {
                  keys: ["Middle+drag"],
                  description: "Pan (middle mouse button)",
                },
                { keys: ["Alt+drag"], description: "Pan" },
                { keys: ["R"], description: "Reset view to default" },
                { keys: ["+", "-"], description: "Zoom in / out" },
              ]}
            />

            <Section
              title="History"
              icon="mdi:history"
              rows={[
                { keys: ["Ctrl Z"], description: "Undo (up to 50 steps)" },
                { keys: ["Ctrl Y", "Ctrl⇧Z"], description: "Redo" },
              ]}
            />

            <Divider sx={{ my: 2, borderColor: divCol }} />

            <Section
              title="Output"
              icon="mdi:code"
              rows={[
                {
                  keys: ["Origin"],
                  description: "Bottom-left of bounding box = (0, 0)",
                },
                {
                  keys: ["Y-axis"],
                  description: "Flipped for Three.js — upward is positive",
                },
                {
                  keys: ["Units"],
                  description: "mm → metres automatically (÷ 1000)",
                },
                {
                  keys: ["Arcs"],
                  description:
                    "Export as shape.absarc() with solved center/radius",
                },
                {
                  keys: ["Subpaths"],
                  description:
                    "Each area emits a new moveTo() in the same Shape",
                },
              ]}
            />

            <Box
              sx={{
                mt: 1.5,
                p: 1.5,
                borderRadius: 1,
                bgcolor: tipBg,
                border: `1px solid ${tipBorder}`,
              }}
            >
              <Typography
                variant="caption"
                sx={{ display: "block", lineHeight: 1.7, color: subCol }}
              >
                <Box component="span" sx={{ fontWeight: 700, color: textCol }}>
                  Tip:{" "}
                </Box>
                Draw at full mm scale — e.g. a 90×45mm section. Output drops
                straight into{" "}
                <Box
                  component="code"
                  sx={{
                    bgcolor: codeBg,
                    px: 0.5,
                    borderRadius: 0.5,
                    fontSize: 11,
                    color: textCol,
                  }}
                >
                  ExtrudeGeometry
                </Box>
                .
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Canvas indicators */}
        <Divider sx={{ my: 2, borderColor: divCol }} />
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1,
            fontSize: 10,
            color: labelCol,
            display: "block",
            mb: 1,
          }}
        >
          Canvas indicators
        </Typography>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          {[
            {
              color: "#4fc3f7",
              label: "Active subpath line",
            },
            {
              color: "rgba(79,195,247,0.3)",
              label: "Inactive subpath",
            },
            {
              color: "#ff5252",
              label: "Selected segment",
            },
            {
              color: "rgba(255,171,64,0.65)",
              label: "Guide line",
            },
            {
              color: "#66bb6a",
              label: "Active snap point/guide",
            },
            {
              color: lightMode ? "#1565c0" : "#fff",
              label: "Selected point",
            },
            { color: "#4fc3f7", label: "Unselected point" },
          ].map(({ color, label }) => (
            <Stack
              key={label}
              direction="row"
              sx={{ alignItems: "center", gap: 0.75 }}
            >
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  bgcolor: color,
                  flexShrink: 0,
                  border: `1px solid ${kbdBorder}`,
                }}
              />
              <Typography
                variant="caption"
                sx={{ color: subCol, fontSize: 11 }}
              >
                {label}
              </Typography>
            </Stack>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
