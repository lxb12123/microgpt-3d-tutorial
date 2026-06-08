'use client';

import { Billboard } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useRef, useState, type ReactNode } from 'react';
import type { Group } from 'three';
import { SceneText } from '@/components/3d/overview/scene/SceneText';

export interface LegendZoneProps {
  /** World-space center of this zone (the 2×2 grid slot). */
  center: [number, number, number];
  /** Billboarded category heading, e.g. "Tokens". */
  title: string;
  /** Billboarded sub-line naming the lessons this primitive appears in. */
  caption: string;
  /** One-line explanation shown on hover. */
  tooltip: string;
  /** Idle label ink; flips to `accentColor` on hover. */
  labelColor: string;
  captionColor: string;
  /** Category accent (orange/blue/green/amber) used for the hovered heading. */
  accentColor: string;
  /** Legibility outline for the in-scene text. */
  halo: string;
  /** Lifts the hover explanation to a fixed caption strip below the canvas, so it
   *  is never clipped by the canvas card the way an in-scene tooltip was at the
   *  right/bottom edges. Called with the tooltip on enter, `null` on leave. */
  onHover?: (tooltip: string | null) => void;
  /** Ambient float allowed (false under prefers-reduced-motion). */
  float: boolean;
  /** Per-zone phase so the four zones don't bob in lockstep. */
  floatPhase: number;
  /** Navigate to this zone's lesson (called on a click that wasn't a drag). */
  onNavigate: () => void;
  /** Local Y of the billboarded heading (lets the layout clear the title row). */
  headingOffset?: number;
  /** Local Y of the lesson caption (sits just below the heading). */
  captionOffset?: number;
  /** The primitive(s), positioned relative to the zone's local origin. */
  children: ReactNode;
}

const HOVER_SCALE = 1.04;
const FLOAT_AMP = 0.06;
// Clicks that move more than this many CSS px between down and up are treated
// as an orbit-drag, not a navigation intent.
const DRAG_PX = 6;

export function LegendZone({
  center,
  title,
  caption,
  tooltip,
  labelColor,
  captionColor,
  accentColor,
  halo,
  onHover,
  float,
  floatPhase,
  onNavigate,
  headingOffset = 1.5,
  captionOffset = 1.12,
  children,
}: LegendZoneProps) {
  const groupRef = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const downPos = useRef<{ x: number; y: number } | null>(null);

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    // Gentle, reversible bob — disabled entirely under reduced motion.
    const bob = float ? Math.sin(clock.elapsedTime * 0.8 + floatPhase) * FLOAT_AMP : 0;
    g.position.y = center[1] + bob;
    // Hover "pop" — instant when motion is reduced, eased otherwise.
    const target = hovered ? HOVER_SCALE : 1;
    const ease = float ? 0.2 : 1;
    g.scale.x += (target - g.scale.x) * ease;
    g.scale.y = g.scale.z = g.scale.x;
  });

  return (
    <group
      ref={groupRef}
      position={center}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(true);
        onHover?.(tooltip);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(false);
        onHover?.(null);
        document.body.style.cursor = '';
      }}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        downPos.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        const d = downPos.current;
        if (d) {
          const moved = Math.hypot(e.nativeEvent.clientX - d.x, e.nativeEvent.clientY - d.y);
          if (moved > DRAG_PX) return; // it was an orbit drag, not a click
        }
        onNavigate();
      }}
    >
      {children}

      {/* Required category label — real in-scene SDF text, billboarded so it
          always faces the camera and stays readable at any orbit angle. */}
      <Billboard position={[0, headingOffset, 0]}>
        <SceneText
          fontSize={0.4}
          color={hovered ? accentColor : labelColor}
          outlineColor={halo}
          outlineWidth={0.02}
        >
          {title}
        </SceneText>
      </Billboard>

      {/* Which lessons use this primitive. */}
      <Billboard position={[0, captionOffset, 0]}>
        <SceneText fontSize={0.17} color={captionColor} outlineColor={halo} outlineWidth={0.008}>
          {caption}
        </SceneText>
      </Billboard>
    </group>
  );
}
