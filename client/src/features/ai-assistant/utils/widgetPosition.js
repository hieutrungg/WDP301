// Placement of the draggable Popo launcher and its chat panel, in viewport pixels.
export const LAUNCHER_SIZE = 56
export const DRAG_THRESHOLD = 5

const EDGE = 16
const GAP = 12
const PANEL_MAX_WIDTH = 400
const PANEL_MAX_HEIGHT = 620

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max))

// Keeps the whole launcher inside the viewport, EDGE px from every side.
export function clampLauncherPosition(position, viewport) {
  return {
    x: Math.round(clamp(position.x, EDGE, viewport.width - LAUNCHER_SIZE - EDGE)),
    y: Math.round(clamp(position.y, EDGE, viewport.height - LAUNCHER_SIZE - EDGE)),
  }
}

// Bottom-right corner, where Popo sits until it is dragged.
export function defaultLauncherPosition(viewport) {
  const inset = viewport.width >= 640 ? 24 : 16
  return {
    x: viewport.width - LAUNCHER_SIZE - inset,
    y: viewport.height - LAUNCHER_SIZE - inset,
  }
}

// The panel opens on the side of the launcher with more room (above or below) and lines up with
// the launcher's nearer screen edge, never leaving the viewport.
export function panelLayout(position, viewport) {
  const width = Math.max(0, Math.min(PANEL_MAX_WIDTH, viewport.width - 2 * EDGE))
  const onRightHalf = position.x + LAUNCHER_SIZE / 2 >= viewport.width / 2
  const preferredLeft = onRightHalf ? position.x + LAUNCHER_SIZE - width : position.x
  const left = clamp(preferredLeft, EDGE, viewport.width - EDGE - width)

  const spaceAbove = position.y - GAP - EDGE
  const spaceBelow = viewport.height - (position.y + LAUNCHER_SIZE + GAP) - EDGE
  const above = spaceAbove >= spaceBelow
  const height = Math.max(0, Math.min(PANEL_MAX_HEIGHT, above ? spaceAbove : spaceBelow))
  const top = above ? position.y - GAP - height : position.y + LAUNCHER_SIZE + GAP

  return { left: Math.round(left), top: Math.round(top), width, height: Math.round(height) }
}

export function parseStoredPosition(raw) {
  try {
    const value = JSON.parse(raw)
    return Number.isFinite(value?.x) && Number.isFinite(value?.y) ? { x: value.x, y: value.y } : null
  } catch {
    return null
  }
}
