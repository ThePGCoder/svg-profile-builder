"use client";

import { useState } from "react";
import {
  Box,
  Stack,
  Typography,
  IconButton,
  Tooltip,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  Divider,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { Guide } from "./types";

interface GuidesPanelProps {
  guides: Guide[];
  lightMode: boolean;
  snapToGuides: boolean;
  pickingPointsFor: "points" | "angled" | null;
  onAddH: (y: number) => void;
  onAddV: (x: number) => void;
  onStartPickAngled: () => void;
  onStartPickPoints: () => void;
  onCancelPick: () => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onSnapToggle: () => void;
}

export default function GuidesPanel({
  guides,
  lightMode,
  snapToGuides,
  pickingPointsFor,
  onAddH,
  onAddV,
  onStartPickAngled,
  onStartPickPoints,
  onCancelPick,
  onDelete,
  onClearAll,
  onSnapToggle,
}: GuidesPanelProps) {
  const [hVal, setHVal] = useState("0");
  const [vVal, setVVal] = useState("0");

  // Only the "currently picking" accent is genuinely component-specific —
  // everything else (text, borders, dividers, button/switch contrast)
  // comes from the theme now (see ThemeProvider.tsx) rather than being
  // re-guessed here, which is what made fields/buttons read as "too
  // light": this file used to define its own low-contrast constants that
  // didn't match, and TextField/Switch/Button weren't getting any of the
  // theme's contrast fixes because nothing here actually deferred to it.
  const accentBg = "#ffab40";
  const accentColor = "#1a1100";
  const rowBg = "action.hover";

  const guideLabel = (g: Guide) => {
    switch (g.kind) {
      case "h":
        // Internal mm y is down-positive (matches canvas/export convention),
        // but the H-guide field is presented up-positive since that's the
        // natural way to think about "a guide 50mm above the origin".
        return `H  y = ${(-g.y).toFixed(1)}`;
      case "v":
        return `V  x = ${g.x.toFixed(1)}`;
      case "angled":
        return `∠ ${g.angleDeg.toFixed(1)}° thru (${g.through.x.toFixed(0)}, ${g.through.y.toFixed(0)})`;
      case "points":
        return `⟍ pts (${g.a.x.toFixed(0)},${g.a.y.toFixed(0)})→(${g.b.x.toFixed(0)},${g.b.y.toFixed(0)})`;
    }
  };

  return (
    <Box sx={{ p: 1.5 }}>
      <Typography
        variant="caption"
        sx={{
          color: "text.secondary",
          textTransform: "uppercase",
          letterSpacing: 1,
          fontSize: 10,
        }}
      >
        Guides
      </Typography>

      <FormControlLabel
        sx={{ m: 0, mt: 0.5, display: "flex" }}
        control={
          <Switch size="small" checked={snapToGuides} onChange={onSnapToggle} />
        }
        label={<Typography variant="caption">Snap to guides</Typography>}
      />

      <Stack sx={{ gap: 1, mt: 1.25 }}>
        {/* Horizontal */}
        <Stack direction="row" sx={{ gap: 0.5, alignItems: "center" }}>
          <TextField
            size="small"
            label="H guide (y mm, + = up)"
            value={hVal}
            onChange={(e) => setHVal(e.target.value)}
            sx={{ flex: 1 }}
            slotProps={{ htmlInput: { inputMode: "decimal" } }}
          />
          <Tooltip title="Add horizontal guide">
            <IconButton
              size="small"
              onClick={() => {
                const y = parseFloat(hVal);
                // Internal storage is down-positive mm; flip so a typed
                // positive value places the guide above the origin.
                if (!isNaN(y)) onAddH(-y);
              }}
            >
              <Icon icon="mdi:plus" width={18} />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Vertical */}
        <Stack direction="row" sx={{ gap: 0.5, alignItems: "center" }}>
          <TextField
            size="small"
            label="V guide (x mm)"
            value={vVal}
            onChange={(e) => setVVal(e.target.value)}
            sx={{ flex: 1 }}
            slotProps={{ htmlInput: { inputMode: "decimal" } }}
          />
          <Tooltip title="Add vertical guide">
            <IconButton
              size="small"
              onClick={() => {
                const x = parseFloat(vVal);
                if (!isNaN(x)) onAddV(x);
              }}
            >
              <Icon icon="mdi:plus" width={18} />
            </IconButton>
          </Tooltip>
        </Stack>

        <Divider sx={{ my: 0.5 }} />

        {/* Angled — click a point, then type angle */}
        <Button
          size="small"
          variant={pickingPointsFor === "angled" ? "contained" : "outlined"}
          onClick={
            pickingPointsFor === "angled" ? onCancelPick : onStartPickAngled
          }
          startIcon={<Icon icon="mdi:angle-acute" width={16} />}
          sx={{
            justifyContent: "flex-start",
            textTransform: "none",
            fontSize: 12,
            ...(pickingPointsFor === "angled" && {
              bgcolor: accentBg,
              color: accentColor,
              "&:hover": { bgcolor: accentBg },
            }),
          }}
        >
          {pickingPointsFor === "angled"
            ? "Click a point on canvas…"
            : "Angled guide thru point"}
        </Button>

        {/* Through 2 points */}
        <Button
          size="small"
          variant={pickingPointsFor === "points" ? "contained" : "outlined"}
          onClick={
            pickingPointsFor === "points" ? onCancelPick : onStartPickPoints
          }
          startIcon={<Icon icon="mdi:vector-line" width={16} />}
          sx={{
            justifyContent: "flex-start",
            textTransform: "none",
            fontSize: 12,
            ...(pickingPointsFor === "points" && {
              bgcolor: accentBg,
              color: accentColor,
              "&:hover": { bgcolor: accentBg },
            }),
          }}
        >
          {pickingPointsFor === "points"
            ? "Click 2 points on canvas…"
            : "Guide thru 2 points"}
        </Button>
      </Stack>

      <Divider sx={{ my: 1.5 }} />

      <Stack sx={{ gap: 0.5, maxHeight: 220, overflowY: "auto" }}>
        {guides.length === 0 && (
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", fontStyle: "italic" }}
          >
            No guides yet
          </Typography>
        )}
        {guides.map((g) => (
          <Stack
            key={g.id}
            direction="row"
            sx={{
              alignItems: "center",
              gap: 0.5,
              px: 0.75,
              py: 0.5,
              borderRadius: 1,
              bgcolor: rowBg,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontFamily: "monospace",
                fontSize: 10.5,
                flex: 1,
              }}
            >
              {guideLabel(g)}
            </Typography>
            <IconButton
              size="small"
              onClick={() => onDelete(g.id)}
              sx={{ p: 0.25 }}
            >
              <Icon icon="mdi:close" width={14} />
            </IconButton>
          </Stack>
        ))}
      </Stack>

      {guides.length > 0 && (
        <Button
          size="small"
          onClick={onClearAll}
          startIcon={<Icon icon="mdi:trash-can-outline" width={14} />}
          sx={{
            mt: 1,
            fontSize: 11,
            textTransform: "none",
            color: "text.secondary",
          }}
        >
          Clear all guides
        </Button>
      )}
    </Box>
  );
}
