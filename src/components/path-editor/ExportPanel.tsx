"use client";

import { useState } from "react";
import {
  Box,
  Stack,
  Typography,
  Button,
  Chip,
  Paper,
  Collapse,
  IconButton,
} from "@mui/material";
import { Icon } from "@iconify/react";

import { exportData } from "./storage";
import { Subpath } from "@/components/path-editor/types";

interface ExportPanelProps {
  subpaths: Subpath[];
  lightMode: boolean;
}

export default function ExportPanel({ subpaths, lightMode }: ExportPanelProps) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(true);

  const totalPts = subpaths.reduce((a, s) => a + s.points.length, 0);
  const disabled = totalPts < 2;
  const { threeShape, widthMm, heightMm } = exportData(subpaths);

  const copy = async () => {
    await navigator.clipboard.writeText(threeShape);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const bg = lightMode ? "#fff" : "#12122a";
  const border = lightMode ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.08)";
  const textCol = lightMode ? "#111" : "#fff";
  const subCol = lightMode ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.4)";
  const codeBg = lightMode ? "#f0f4f8" : "rgba(0,0,0,0.3)";
  const codeCol = lightMode ? "#1a237e" : "#a5d6a7";

  return (
    <Box sx={{ borderTop: `1px solid ${border}`, bgcolor: bg, flexShrink: 0 }}>
      <Stack
        direction="row"
        onClick={() => setOpen((v) => !v)}
        sx={{
          alignItems: "center",
          px: 1.5,
          py: 0.75,
          cursor: "pointer",
          gap: 1,
          "&:hover": {
            bgcolor: lightMode ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)",
          },
        }}
      >
        <Icon icon="mdi:code" width={15} color={subCol} />
        <Typography variant="caption" sx={{ fontWeight: 700, color: textCol }}>
          THREE.Shape output
        </Typography>
        {!disabled && (
          <>
            <Chip
              label={`${totalPts} pts`}
              size="small"
              sx={{ height: 16, fontSize: 10 }}
            />
            {subpaths.length > 1 && (
              <Chip
                label={`${subpaths.length} paths`}
                size="small"
                color="secondary"
                sx={{ height: 16, fontSize: 10 }}
              />
            )}
            <Chip
              label={`${widthMm} × ${heightMm} mm`}
              size="small"
              color="primary"
              variant="filled"
              sx={{ height: 16, fontSize: 10 }}
            />
          </>
        )}
        <Box
          sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 0.5 }}
        >
          {!disabled && open && (
            <Button
              size="small"
              variant={copied ? "contained" : "text"}
              color={copied ? "success" : "primary"}
              startIcon={
                <Icon
                  icon={copied ? "mdi:check" : "mdi:content-copy"}
                  width={13}
                />
              }
              onClick={(e) => {
                e.stopPropagation();
                copy();
              }}
              sx={{ height: 24, fontSize: 11, minWidth: 70 }}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          )}
          <IconButton size="small" sx={{ color: subCol, p: 0.25 }}>
            <Icon
              icon={open ? "mdi:chevron-down" : "mdi:chevron-up"}
              width={16}
            />
          </IconButton>
        </Box>
      </Stack>
      <Collapse in={open}>
        <Box sx={{ px: 1.5, pb: 1.25 }}>
          <Paper
            variant="outlined"
            onClick={!disabled ? copy : undefined}
            sx={{
              p: 1.25,
              fontFamily: "monospace",
              fontSize: 11.5,
              lineHeight: 1.6,
              color: disabled ? subCol : codeCol,
              bgcolor: codeBg,
              borderColor: border,
              maxHeight: 110,
              overflowY: "auto",
              whiteSpace: "pre",
              cursor: disabled ? "default" : "pointer",
              userSelect: "all",
              "&:hover": disabled ? {} : { opacity: 0.85 },
            }}
          >
            {disabled
              ? "// Draw at least 2 points to generate output"
              : threeShape}
          </Paper>
          {!disabled && (
            <Typography
              variant="caption"
              sx={{ color: subCol, mt: 0.5, display: "block" }}
            >
              Click to select all · origin bottom-left · Y-up · metres
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
