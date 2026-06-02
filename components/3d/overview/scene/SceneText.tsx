'use client';

import { Text } from '@react-three/drei';
import type { ComponentProps } from 'react';

const FONT = '/microgpt-3d-tutorial/fonts/RobotoMono-Regular.ttf';

export interface SceneTextProps extends Omit<ComponentProps<typeof Text>, 'font'> {
  /** Outline color for legibility on both themes. Defaults to a dark halo. */
  halo?: string;
}

/**
 * The single place that configures in-scene text. Uses a bundled SDF font so
 * labels stay crisp at any GIF scale and never depend on a runtime CDN fetch.
 * A thin outline keeps text readable over both the dark and light canvas bg.
 */
export function SceneText({
  halo = '#000000',
  fontSize = 0.34,
  color = '#e5edff',
  anchorX = 'center',
  anchorY = 'middle',
  outlineWidth = 0.012,
  outlineColor,
  children,
  ...rest
}: SceneTextProps) {
  return (
    <Text
      font={FONT}
      fontSize={fontSize}
      color={color}
      anchorX={anchorX}
      anchorY={anchorY}
      outlineWidth={outlineWidth}
      outlineColor={outlineColor ?? halo}
      {...rest}
    >
      {children}
    </Text>
  );
}
