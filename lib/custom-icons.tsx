import { createElement, forwardRef, type ReactNode } from "react";
import type { LucideProps } from "lucide-react";

// Storvia's own Lucide-style icons for the curated category list, for shapes
// lucide-react (pinned 0.577.0) lacks. Drop-in compatible with Lucide icons:
// same props (size, color, strokeWidth, absoluteStrokeWidth, className, other
// SVG props, ref) and the same rendered attributes. Paths are approved; do
// not redesign them. Keep this file identical in storvia-admin and
// storvia-storefront.

type IconNode = Array<[string, Record<string, string>]>;

function createIcon(name: string, iconNode: IconNode) {
  const Component = forwardRef<SVGSVGElement, LucideProps>(
    (
      {
        color = "currentColor",
        size = 24,
        strokeWidth = 2,
        absoluteStrokeWidth,
        className,
        children,
        ...rest
      },
      ref
    ) =>
      createElement(
        "svg",
        {
          ref,
          xmlns: "http://www.w3.org/2000/svg",
          width: size,
          height: size,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: color,
          strokeWidth: absoluteStrokeWidth
            ? (Number(strokeWidth) * 24) / Number(size)
            : strokeWidth,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          className: ["lucide", `lucide-${name}`, className].filter(Boolean).join(" "),
          ...rest,
        },
        ...iconNode.map(([tag, attrs], index) => createElement(tag, { key: index, ...attrs })),
        children as ReactNode
      )
  );

  Component.displayName = `${name.charAt(0).toUpperCase()}${name.slice(1)}Icon`;

  return Component;
}

export const RingIcon = createIcon("ring", [
  ["path", { d: "M9.5 4h5l2 2.5-4.5 3.5-4.5-3.5z" }],
  ["circle", { cx: "12", cy: "15.5", r: "5.5" }],
]);

export const NecklaceIcon = createIcon("necklace", [
  ["path", { d: "M5 3c0 7 3 11 7 11s7-4 7-11" }],
  ["path", { d: "M12 14v1.5" }],
  ["path", { d: "M12 15.5l2.5 3-2.5 3-2.5-3z" }],
]);

export const EarringsIcon = createIcon("earrings", [
  ["circle", { cx: "7", cy: "4", r: "1.5" }],
  ["path", { d: "M7 5.5v3" }],
  ["path", { d: "M7 8.5c-2 3-3 5-3 7a3 3 0 0 0 6 0c0-2-1-4-3-7z" }],
  ["circle", { cx: "17", cy: "4", r: "1.5" }],
  ["path", { d: "M17 5.5v3" }],
  ["path", { d: "M17 8.5c-2 3-3 5-3 7a3 3 0 0 0 6 0c0-2-1-4-3-7z" }],
]);

export const BangleIcon = createIcon("bangle", [
  ["ellipse", { cx: "12", cy: "10", rx: "9", ry: "4.5" }],
  ["path", { d: "M3 10v3a9 4.5 0 0 0 18 0v-3" }],
]);

export const BraceletIcon = createIcon("bracelet", [
  ["circle", { cx: "12", cy: "5.5", r: "2" }],
  ["circle", { cx: "17.63", cy: "8.75", r: "2" }],
  ["circle", { cx: "17.63", cy: "15.25", r: "2" }],
  ["circle", { cx: "12", cy: "18.5", r: "2" }],
  ["circle", { cx: "6.37", cy: "15.25", r: "2" }],
  ["circle", { cx: "6.37", cy: "8.75", r: "2" }],
]);
