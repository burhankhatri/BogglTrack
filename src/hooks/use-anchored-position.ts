"use client";

import * as React from "react";

export type Align = "start" | "center" | "end";
export type Side = "top" | "bottom";

export interface AnchoredPosition {
  top: number;
  left: number;
  width: number;
  /** Which side the content ended up on, after flipping. */
  side: Side;
}

export interface UseAnchoredPositionOptions {
  /** Ref to the trigger element. */
  triggerRef: React.RefObject<HTMLElement | null>;
  /** Whether the content is currently open (positioning is active). */
  open: boolean;
  /** Horizontal alignment relative to the trigger. Default: "start". */
  align?: Align;
  /** Vertical gap between trigger and content, in px. Default: 6. */
  sideOffset?: number;
  /** Preferred side. Default: "bottom" — will flip to "top" if it overflows viewport. */
  side?: Side;
  /** Use the trigger's width for the content's width. Default: false. */
  matchWidth?: boolean;
  /**
   * Estimated content height (used for viewport-flip before measurement).
   * If unknown, supply max-height value you'll render with.
   */
  estimatedHeight?: number;
}

/**
 * Computes fixed-position coordinates for floating content anchored to a
 * trigger element. Automatically:
 *   - Escapes ancestor `overflow-hidden` by using position: fixed.
 *   - Flips from bottom→top when close to the viewport edge.
 *   - Re-measures on scroll / resize while open.
 *
 * Returns `null` until the first measurement is available (render the portal
 * content hidden or off-screen for that first frame — the returned values
 * update synchronously before paint).
 */
export function useAnchoredPosition({
  triggerRef,
  open,
  align = "start",
  sideOffset = 6,
  side: preferredSide = "bottom",
  matchWidth = false,
  estimatedHeight = 300,
}: UseAnchoredPositionOptions): AnchoredPosition | null {
  const [position, setPosition] = React.useState<AnchoredPosition | null>(null);

  const measure = React.useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Decide side: prefer requested, flip if not enough room.
    const spaceBelow = vh - rect.bottom - sideOffset;
    const spaceAbove = rect.top - sideOffset;
    let side: Side = preferredSide;
    if (preferredSide === "bottom" && spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
      side = "top";
    } else if (preferredSide === "top" && spaceAbove < estimatedHeight && spaceBelow > spaceAbove) {
      side = "bottom";
    }

    const width = matchWidth ? rect.width : 0;

    let left: number;
    switch (align) {
      case "end":
        left = rect.right - (matchWidth ? rect.width : 0);
        break;
      case "center":
        left = rect.left + rect.width / 2 - (matchWidth ? rect.width / 2 : 0);
        break;
      case "start":
      default:
        left = rect.left;
    }

    // Keep content within viewport horizontally (8px margin).
    if (!matchWidth) {
      const margin = 8;
      if (left < margin) left = margin;
      if (left > vw - margin) left = vw - margin;
    }

    const top = side === "bottom" ? rect.bottom + sideOffset : rect.top - sideOffset;

    setPosition({ top, left, width, side });
  }, [triggerRef, align, sideOffset, preferredSide, matchWidth, estimatedHeight]);

  React.useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    measure();
    const onScroll = () => measure();
    const onResize = () => measure();
    // Use capture so we catch scrolls on any ancestor scroll container.
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, measure]);

  return position;
}
