"use client";

import { createContext, useContext, useMemo, useState } from "react";
import {
  createTheme,
  ThemeProvider as MuiThemeProvider,
  CssBaseline,
  PaletteMode,
} from "@mui/material";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

// ── Color mode context ───────────────────────────────────────────
// Single source of truth for light/dark mode. Previously every panel
// (Toolbar, GuidesPanel, SegmentPanel, PathEditor itself) owned a local
// `lightMode` boolean prop and independently hand-picked rgba() values
// per component, which is how contrast drifted out of sync between
// panels and went stale when only some files got fixed. Now there's one
// boolean, owned here, and the MUI theme itself switches with it — so
// any component using theme-aware colors (text.secondary, divider,
// background.paper, component style overrides below) just works.
interface ColorModeContextValue {
  mode: PaletteMode;
  toggle: () => void;
}
const ColorModeContext = createContext<ColorModeContextValue>({
  mode: "dark",
  toggle: () => {},
});

export function useColorMode() {
  return useContext(ColorModeContext);
}

// ── Component style overrides, generated per-mode ─────────────────
// These were previously dark-only constants. Built as a function of
// `mode` so light mode gets equivalent (inverted) contrast instead of
// silently falling back to MUI's defaults.
function buildComponents(mode: PaletteMode) {
  const isDark = mode === "dark";
  const borderStrong = isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.25)";
  const borderHover = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)";
  const borderToggle = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)";
  const hoverFill = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)";
  const toggleHover = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";
  const switchTrack = isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)";
  const accent = "#4fc3f7";
  const accentDark = "#1565c0";

  return {
    MuiButton: {
      styleOverrides: {
        outlined: {
          borderColor: borderStrong,
          "&:hover": { borderColor: borderHover },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          "&:hover": { backgroundColor: hoverFill },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
          color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.7)",
          "&.Mui-selected": {
            backgroundColor: isDark ? "#4fc3f7" : "#1565c0",
            color: isDark ? "#000" : "#fff",
            borderColor: isDark ? "#4fc3f7" : "#1565c0",
            "&:hover": {
              backgroundColor: isDark ? "#29b6f6" : "#1976d2",
            },
          },
          "&:hover": { backgroundColor: toggleHover },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-notchedOutline": { borderColor: borderStrong },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: borderHover,
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: isDark ? accent : accentDark,
          },
        },
        input: {
          color: isDark ? "#ffffff" : "#111111",
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)",
          "&.Mui-focused": { color: isDark ? accent : accentDark },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        track: { backgroundColor: switchTrack },
      },
    },
  };
}

function buildTheme(mode: PaletteMode, fontFamily: string) {
  const isDark = mode === "dark";
  return createTheme({
    typography: { fontFamily },
    palette: {
      mode,
      // Matches the colors this app already used directly in PathEditor's
      // hand-picked bg/headerBg constants, so switching to theme-driven
      // colors doesn't shift the app's existing visual identity.
      background: {
        default: isDark ? "#0f0f23" : "#f5f5f5",
        paper: isDark ? "#1a1a2e" : "#ffffff",
      },
      text: {
        primary: isDark ? "#ffffff" : "#111111",
        secondary: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)",
      },
      divider: isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)",
      primary: {
        main: isDark ? "#4fc3f7" : "#1565c0",
      },
    },
    components: buildComponents(mode),
  });
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mode, setMode] = useState<PaletteMode>("dark");

  const colorMode = useMemo<ColorModeContextValue>(
    () => ({
      mode,
      toggle: () => setMode((m) => (m === "dark" ? "light" : "dark")),
    }),
    [mode],
  );

  const theme = useMemo(() => buildTheme(mode, inter.style.fontFamily), [mode]);

  return (
    <AppRouterCacheProvider options={{ key: "mui" }}>
      <ColorModeContext.Provider value={colorMode}>
        <MuiThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </MuiThemeProvider>
      </ColorModeContext.Provider>
    </AppRouterCacheProvider>
  );
}
