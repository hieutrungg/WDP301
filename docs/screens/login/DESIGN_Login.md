---
name: Blockbuster Cinema Experience
colors:
  surface: '#121317'
  surface-dim: '#121317'
  surface-bright: '#38393e'
  surface-container-lowest: '#0d0e12'
  surface-container-low: '#1a1b20'
  surface-container: '#1f1f24'
  surface-container-high: '#292a2e'
  surface-container-highest: '#343439'
  on-surface: '#e3e2e8'
  on-surface-variant: '#e9bcb6'
  inverse-surface: '#e3e2e8'
  inverse-on-surface: '#2f3035'
  outline: '#af8782'
  outline-variant: '#5e3f3b'
  surface-tint: '#ffb4aa'
  primary: '#ffb4aa'
  on-primary: '#690003'
  primary-container: '#e50914'
  on-primary-container: '#fff7f6'
  inverse-primary: '#c0000c'
  secondary: '#ffd65b'
  on-secondary: '#3d2f00'
  secondary-container: '#e7b900'
  on-secondary-container: '#5f4a00'
  tertiary: '#c3c6d8'
  on-tertiary: '#2c303e'
  tertiary-container: '#6e7283'
  on-tertiary-container: '#faf8ff'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdad5'
  primary-fixed-dim: '#ffb4aa'
  on-primary-fixed: '#410001'
  on-primary-fixed-variant: '#930007'
  secondary-fixed: '#ffe08b'
  secondary-fixed-dim: '#f0c110'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#584400'
  tertiary-fixed: '#dfe1f5'
  tertiary-fixed-dim: '#c3c6d8'
  on-tertiary-fixed: '#171b29'
  on-tertiary-fixed-variant: '#424656'
  background: '#121317'
  on-background: '#e3e2e8'
  surface-variant: '#343439'
typography:
  display-hero:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
  display-hero-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 30px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-badge:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.05em
  label-currency:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '700'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 0.75rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system crafts an immersive, high-energy cinema ticketing and theatrical management environment. It blends modern streaming aesthetics with the visceral excitement of entering a state-of-the-art theater: dim theater illumination, deep obsidian surfaces, and the punchy impact of cinema red projection. 

The aesthetic is clean, cinematic, and functional—combining modern dark surfaces with subtle acrylic glass borders, intense crimson highlights, and understated gold accents for VIP status, theatrical certifications, and ratings. 

Targeted at moviegoers booking premier formats (IMAX, ScreenX, Gold Class) and cinema staff operating high-throughput box offices across Vietnam, the interface minimizes eye fatigue in dark environments while driving frictionless conversions.

## Colors

The palette establishes an obsidian canvas punctuated by cinematic lighting effects:

- **Primary (`#E50914`)**: Cinema Red. Reserved for primary booking actions, active theater seats, seat selection states, play buttons, and brand indicators. Emits an ambient crimson glow (`rgba(229, 9, 20, 0.35)`) on focused interactive elements.
- **Secondary (`#F5C518`)**: Cinema Gold. Used strictly for VIP lounge tiers, IMDb/user review ratings, critic scores, and special theatrical perks (e.g., Sweetbox or Gold Class lounges).
- **Tertiary (`#1E2230`)**: Elevated Slate Navy. Serves as interactive card surfaces, filter chips, screen curvature indicators, and unselected standard seats.
- **Neutral Canvas (`#0B0C10` to `#181A24`)**: Deep obsidian-to-midnight stepped tones that establish seamless visual depth without harsh pure-black cutoffs.
- **Text & Metadata**: Crisp White (`#FFFFFF`) for primary headings and selected states; Slate Gray (`#94A3B8`) for showtimes, branch locations (e.g., Vincom Landmark 81), and VND pricing metadata.

## Typography

Typography balances cinematic impact with extreme operational legibility:

- **Headlines (`Plus Jakarta Sans`)**: Contemporary geometric curves provide high energy for movie titles, hall formats (IMAX with Laser, 4DX), and hero promotional billboards.
- **Body & Numerical Readouts (`Inter`)**: Utilitarian, highly readable grotesque sans-serif chosen to render dense showtime schedules, auditorium row/seat alphanumeric combinations (e.g., `H-12`), and Vietnamese currency formatting (`145.000 ₫`) without glyph crowding.
- **Age Rating & Classification Labels**: Set in all-caps, heavy-weight typography with letter spacing for instantaneous recognition across movie thumbnails (e.g., `T18`, `T16`, `P`).

## Layout & Spacing

The layout is structured around an adaptive 12-column fluid grid on desktop (`1280px+`), collapsing into an 8-column layout on tablets and a 4-column layout on mobile devices.

- **Horizontal Rhythm**: Desktop views employ generous outer margins (`margin: 2rem`) with `1.5rem` gutters to permit poster art cards to breathe. Mobile interfaces reduce margins to `1rem` and gutters to `0.75rem`, maximizing horizontal cinema seat map real estate.
- **Auditorium Seat Maps**: Unbounded by standard column flow. Seat maps run within a pinch-to-zoom, horizontally scrollable container with a constant minimum touch spacing of `0.5rem` (`space-sm`) between individual seats to prevent mis-taps.
- **Vertical Hierarchy**: Large section gaps (`space-xl`) cleanly demarcate distinct theater features: featured hero carousel, now showing, upcoming releases, branch selection drop-downs, and concession combos.

## Elevation & Depth

Visual hierarchy leverages obsidian tonal staging, translucent frosted overlays, and cinema projector backlighting rather than conventional diffuse shadows:

- **Level 0 (Canvas Base - `#0B0C10`)**: The core application substrate representing the dark cinema hall.
- **Level 1 (Card & Content Blocks - `#12141D`)**: Slightly lifted surface for movie cards, schedule rows, and theater specs, bounded by a 1px acrylic border (`rgba(255, 255, 255, 0.08)`).
- **Level 2 (Popovers, Drawers & Concession Modals - `#181A24`)**: Elevated dialog surfaces with a 16px backdrop blur (`backdrop-filter: blur(16px)`) and a deep ambient drop shadow (`0 20px 40px rgba(0, 0, 0, 0.7)`).
- **Projection Aura (Active & Selected Elements)**: Interactive primary highlights (such as selected seats, active dates, or checkout CTAs) receive a focused crimson glow (`box-shadow: 0 0 20px rgba(229, 9, 20, 0.45)`).

## Shapes

The roundedness level is strictly set to `2` (medium-rounded), reinforcing a contemporary media-center look:

- **Cards & Modals (`rounded-lg: 1rem`)**: Movie poster wrappers, branch information panels, and checkout breakdown containers.
- **Interactive Controls (`rounded: 0.5rem`)**: Showtime pills, cinema format filters (2D, 3D, IMAX), and text input fields.
- **Seats & Status Badges (`rounded-sm: 0.25rem` to `rounded: 0.5rem`)**: Cinema auditorium seats maintain soft curved corners to mirror physical theater recliners.
- **System Tags (`rounded-full`)**: Genre markers, age ratings (T18, T16, T13), and live indicator badges.

## Components

### Action Buttons
- **Primary ("Book Ticket" / "Proceed to Payment")**: Solid `#E50914` background, crisp white bold text, `0.5rem` radius, 48px height on desktop (44px on mobile). On hover or focus, applies an ambient crimson outer aura (`0 0 16px rgba(229, 9, 20, 0.4)`).
- **Secondary / Ghost**: Translucent background (`rgba(255, 255, 255, 0.05)`), 1px border (`rgba(255, 255, 255, 0.12)`), text in `#CBD5E1`. Used for trailer previews and schedule date selection.

### Movie Cards
- Vertical 2:3 aspect ratio poster display with `rounded-lg` (16px) corners.
- Acrylic border (`rgba(255, 255, 255, 0.08)`) with progressive dark gradient scrim at the card base containing movie title, duration, and format badges (IMAX, ATMOS).
- Top-right corner houses the Gold Rating badge (`#F5C518` star icon + score).
- Top-left corner houses age restriction badges (`T18` red badge, `T13` yellow badge, `P` green badge).

### Auditorium Seat Selector
- **Standard Seat**: Muted dark slate (`#1E2230`), subtle border.
- **VIP Seat**: Bordered in subtle gold (`#D4AF37`) with dark interior.
- **Sweetbox (Couples)**: Double-width capsule shape in muted plum/slate tone.
- **Selected Seat**: Solid Cinema Red (`#E50914`) with a radiant backlight glow.
- **Sold / Occupied**: Deep translucent charcoal with an inner diagonal slash or low opacity (`opacity: 0.25`).
- **Screen Indicator**: A curved, glowing white-to-crimson arc at the top with text "MÀN HÌNH / SCREEN".

### Showtime Pills & Branch Selectors
- Showtime chips display format (2D Eng Sub) above the time (`19:45`). Inactive state is dark surface with faint white border; active state is filled Cinema Red or high-contrast white text with red highlight.
- Branch dropdown presents clear typography: branch name (e.g., "F-Cinema Landmark 81"), distance or city ("Bình Thạnh, TP.HCM"), and available hall types.

### Concession & Food Counters
- Horizontal line items featuring preview imagery, portion size, VND price formatted with thousands separator (`95.000 ₫`), and steppers (`-`, count, `+`) styled with glassmorphic backgrounds.