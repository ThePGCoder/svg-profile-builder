"use client";

import { useState } from "react";
import {
  Box,
  Stack,
  Typography,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  Tooltip,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { Profile } from "@/components/path-editor/types";

interface ProfilesPanelProps {
  lightMode: boolean;
  profiles: Profile[];
  currentPoints: number; // total point count
  onLoad: (profile: Profile) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
}

export default function ProfilesPanel({
  profiles,
  currentPoints,
  lightMode,
  onLoad,
  onSave,
  onDelete,
}: ProfilesPanelProps) {
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const bg = lightMode ? "#f8f9fa" : "#1a1a2e";
  const border = lightMode ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.08)";
  const labelCol = lightMode ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.4)";
  const textCol = lightMode ? "#111" : "#fff";
  const subCol = lightMode ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.35)";
  const itemBg = lightMode ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)";
  const itemHover = lightMode ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)";
  const iconCol = lightMode ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.6)";
  const activeBg = lightMode ? "#1e88e5" : "#4fc3f7";

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName("");
  };

  return (
    <Box
      sx={{
        width: 220,
        flexShrink: 0,
        bgcolor: bg,
        borderLeft: `1px solid ${border}`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        color: textCol,
        "& .MuiIconButton-root": { color: iconCol },
        "& .MuiIconButton-root:hover": {
          color: lightMode ? "#000" : "#fff",
          bgcolor: lightMode ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.12)",
        },
        "& .MuiOutlinedInput-root": {
          color: textCol,
          "& fieldset": { borderColor: border },
          "&:hover fieldset": {
            borderColor: lightMode
              ? "rgba(0,0,0,0.3)"
              : "rgba(255,255,255,0.3)",
          },
          "&.Mui-focused fieldset": { borderColor: activeBg },
        },
        "& .MuiInputBase-input::placeholder": { color: subCol, opacity: 1 },
      }}
    >
      {/* Save */}
      <Box sx={{ p: 1.5 }}>
        <Typography
          variant="caption"
          sx={{
            color: labelCol,
            textTransform: "uppercase",
            letterSpacing: 1,
            fontSize: 10,
          }}
        >
          Save profile
        </Typography>
        <Stack sx={{ gap: 1, mt: 1 }}>
          <TextField
            size="small"
            placeholder="Profile name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            fullWidth
            slotProps={{
              htmlInput: { style: { fontSize: 13, color: textCol } },
            }}
          />
          {/* Text button not outlined */}
          <Box
            onClick={!name.trim() || currentPoints < 2 ? undefined : handleSave}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 0.75,
              py: 0.75,
              borderRadius: 1,
              cursor: !name.trim() || currentPoints < 2 ? "default" : "pointer",
              bgcolor:
                !name.trim() || currentPoints < 2 ? "transparent" : activeBg,
              color: !name.trim() || currentPoints < 2 ? subCol : "#fff",
              opacity: !name.trim() || currentPoints < 2 ? 0.5 : 1,
              transition: "all 0.15s",
              "&:hover":
                !name.trim() || currentPoints < 2 ? {} : { opacity: 0.88 },
            }}
          >
            <Icon icon="mdi:content-save" width={15} />
            <Typography
              variant="caption"
              sx={{ fontWeight: 600, fontSize: 12, color: "inherit" }}
            >
              Save
            </Typography>
          </Box>
          {currentPoints < 2 && (
            <Typography variant="caption" sx={{ color: subCol, fontSize: 10 }}>
              Need at least 2 points
            </Typography>
          )}
        </Stack>
      </Box>

      <Divider sx={{ borderColor: border }} />

      {/* Profile list */}
      <Box sx={{ flex: 1, overflowY: "auto", p: 1 }}>
        <Typography
          variant="caption"
          sx={{
            color: labelCol,
            textTransform: "uppercase",
            letterSpacing: 1,
            fontSize: 10,
            px: 0.5,
          }}
        >
          Saved ({profiles.length})
        </Typography>

        {profiles.length === 0 && (
          <Typography
            variant="caption"
            sx={{ color: subCol, display: "block", mt: 2, textAlign: "center" }}
          >
            No profiles saved yet
          </Typography>
        )}

        <List dense disablePadding sx={{ mt: 0.5 }}>
          {profiles.map((profile) => (
            <ListItem
              key={profile.id}
              disablePadding
              sx={{
                borderRadius: 1,
                mb: 0.5,
                bgcolor: itemBg,
                "&:hover": { bgcolor: itemHover },
                pr: 8,
              }}
            >
              <ListItemText
                sx={{ px: 1, py: 0.75 }}
                primary={
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: textCol,
                      lineHeight: 1.3,
                    }}
                  >
                    {profile.name}
                  </Typography>
                }
                secondary={
                  <Typography
                    variant="caption"
                    sx={{ color: subCol, fontSize: 10 }}
                  >
                    {profile.subpaths.reduce(
                      (a: number, s: any) => a + s.points.length,
                      0,
                    )}{" "}
                    pts · {profile.subpaths.length} path
                    {profile.subpaths.length !== 1 ? "s" : ""} ·{" "}
                    {new Date(profile.updatedAt).toLocaleDateString()}
                  </Typography>
                }
              />
              <ListItemSecondaryAction>
                <Tooltip title="Load">
                  <IconButton size="small" onClick={() => onLoad(profile)}>
                    <Icon icon="mdi:tray-arrow-down" width={15} />
                  </IconButton>
                </Tooltip>
                {confirmDelete === profile.id ? (
                  <Tooltip title="Confirm delete">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => {
                        onDelete(profile.id);
                        setConfirmDelete(null);
                      }}
                    >
                      <Icon icon="mdi:check" width={15} />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      onClick={() => setConfirmDelete(profile.id)}
                    >
                      <Icon icon="mdi:delete" width={15} />
                    </IconButton>
                  </Tooltip>
                )}
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Box>
    </Box>
  );
}
