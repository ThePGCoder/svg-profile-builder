"use client";

import {
  Box,
  Stack,
  Typography,
  IconButton,
  Tooltip,
  Divider,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { Segment } from "./types";

interface SegmentPanelProps {
  segment: Segment | null;
  lightMode: boolean;
  bulgeMm: number;
  onBulgeChange: (v: number) => void;
  onDelete: () => void;
  onSplit: () => void;
  onConvert: (type: "line" | "arc" | "bezier") => void;
  onFlipArc: () => void;
}

const SEGMENT_TYPES: { id: "line" | "arc" | "bezier"; icon: string }[] = [
  { id: "line", icon: "mdi:vector-line" },
  { id: "arc", icon: "mdi:vector-arrange-below" },
  { id: "bezier", icon: "mdi:vector-curve" },
];

export default function SegmentPanel({
  segment,
  bulgeMm,
  onBulgeChange,
  onDelete,
  onSplit,
  onConvert,
  onFlipArc,
}: SegmentPanelProps) {
  if (!segment) {
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
          Segment
        </Typography>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            mt: 1,
            color: "text.secondary",
            fontStyle: "italic",
          }}
        >
          Click a path edge to select it
        </Typography>
      </Box>
    );
  }

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
        Segment
      </Typography>

      <ToggleButtonGroup
        exclusive
        value={segment.type}
        onChange={(_, v) => v && onConvert(v)}
        fullWidth
        sx={{
          mt: 1,
          gap: 0.5,
          "& .MuiToggleButtonGroup-grouped": { borderRadius: "6px !important" },
        }}
      >
        {SEGMENT_TYPES.map((t) => (
          <ToggleButton
            key={t.id}
            value={t.id}
            sx={{ flexDirection: "column", gap: 0.25, py: 0.75 }}
          >
            <Tooltip title={`Convert to ${t.id}`}>
              <Stack sx={{ alignItems: "center", gap: 0.25 }}>
                <Icon icon={t.icon} width={16} color="inherit" />
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: 9,
                    color: "inherit",
                    textTransform: "capitalize",
                  }}
                >
                  {t.id}
                </Typography>
              </Stack>
            </Tooltip>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {segment.type === "arc" && (
        <Box sx={{ mt: 1.25 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between" }}>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Bulge
            </Typography>
            <Tooltip title="Flip arc side">
              <IconButton size="small" onClick={onFlipArc} sx={{ p: 0.25 }}>
                <Icon icon="mdi:swap-horizontal" width={14} />
              </IconButton>
            </Tooltip>
          </Stack>
          <Slider
            size="small"
            min={-100}
            max={100}
            value={bulgeMm}
            onChange={(_, v) => onBulgeChange(v as number)}
          />
        </Box>
      )}

      <Divider sx={{ my: 1.25 }} />

      <Stack direction="row" sx={{ gap: 0.5 }}>
        <Tooltip title="Split segment at midpoint">
          <IconButton size="small" onClick={onSplit}>
            <Icon icon="mdi:content-cut" width={18} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete segment">
          <IconButton size="small" onClick={onDelete}>
            <Icon icon="mdi:delete-outline" width={18} />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
}
