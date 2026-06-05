# SweetCare Mobile — Interface Design System

## Direction & Feel

**"The Quiet Watch"** — The experience of a parent who has learned to carry medical vigilance lightly. Not panic, not hospital sterility. Deep confidence + parental warmth. Like a trusted medical partner that knows you'll be back.

The product domain: glucose rhythms, quiet vigilance, the 3am CGM check, the care logbook, the calibration that never ends.

---

## Auth Flow Patterns

### Hero Structure

- **Background:** `#1E3A8A` (blue-900) — "the 3am monitoring screen blue", not clinical blue-600
- **Height:** `Math.min(SCREEN_HEIGHT * 0.44, 380)` for login · `Math.min(SCREEN_HEIGHT * 0.38, 320)` for register
- **Padding:** `paddingHorizontal: 28`, `paddingTop: insets.top + 20`
- **Overflow:** `hidden` (clips the ambient glow circles)

### Ambient Depth (NOT gradients, NOT dot grids)

Two absolute-positioned circles creating blue-on-navy depth:

```tsx
// Outer glow — login: upper-right · register: lower-left (compositional variation)
glowOuter: {
  position: "absolute", top: -80, right: -60,
  width: 260, height: 260, borderRadius: 130,
  backgroundColor: "#2563EB",  // blue-600
  opacity: 0.22,
}
// Inner accent
glowInner: {
  position: "absolute", top: 10, right: 50,
  width: 90, height: 90, borderRadius: 45,
  backgroundColor: "#60A5FA",  // blue-400
  opacity: 0.12,
}
```

The outer/inner glow changes position between screens for visual variety while maintaining the same design language.

### Brand Mark

Small, corner-anchored, top-left — like an app you already trust:

```tsx
<View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
  <Icon name="activity" size="sm" color="rgba(255,255,255,0.75)" />
  <Text
    style={{ fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.65)", letterSpacing: 0.4 }}
  >
    SweetCare
  </Text>
</View>
```

**Icon:** `activity` (ECG/pulse line from Feather) — NOT a heart. Signals health monitoring without sentimentality.

### Dual-Register Headline (THE signature)

Two typographic registers — context whispers, statement asserts:

```tsx
<View style={{ flex: 1, justifyContent: "flex-end", paddingBottom: 20 }}>
  <Text
    style={{ fontSize: 17, fontWeight: "400", color: "rgba(255,255,255,0.52)", marginBottom: 2 }}
  >
    {contextLine} {/* "Bem-vindo" / "Tudo começa" */}
  </Text>
  <Text
    style={{
      fontSize: 38,
      fontWeight: "700",
      color: "#ffffff",
      letterSpacing: -0.8,
      lineHeight: 42,
    }}
  >
    {mainLine} {/* "de volta." / "aqui." */}
  </Text>
</View>
```

The headline anchors to the **bottom** of the hero — empty space above is intentional breathing room. Never centered.

### Form Surface (organic scoop edge)

```tsx
formSurface: {
  flex: 1,
  marginTop: -28,           // overlaps hero by 28px
  borderTopLeftRadius: 28,  // organic scoop where blue meets white
  borderTopRightRadius: 28,
  paddingTop: 12,
}
```

No card wrapper. No border. No shadow. The form lives directly on `theme.colors.background.DEFAULT` (slate-50). The `marginTop: -28` + `borderTopRadius: 28` creates the signature scoop edge where blue-900 peeks around the rounded corners.

### Drag Handle

```tsx
handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 28 }
backgroundColor: theme.colors.border.DEFAULT
```

Signals scrollability. Adds tactile quality. Always present in the form surface.

### Error Stripe (NOT a full-border box)

```tsx
errorStripe: {
  borderLeftWidth: 3,
  borderRadius: 8,
  padding: 12,
  paddingLeft: 14,
  marginBottom: 20,
}
// Colors:
backgroundColor: theme.colors.error.surface
borderLeftColor: theme.colors.error.DEFAULT
```

Left-border accent pattern — used by Linear, Vercel. More refined than a full-border box.

### Field Spacing

```tsx
fields: { gap: 20, marginBottom: 28 }
```

20px between fields (vs 16px default) — breathing room signals that we value the user's attention.

No left icons in form fields. Labels alone are sufficient. Premium apps (Things 3, Bear) don't need icons to clarify field purpose.

### Entrance Animation

```tsx
// On mount — hero then form with 160ms stagger
Animated.parallel([
  Animated.timing(heroOpacity, {
    toValue: 1,
    duration: duration.slow,
    easing: easing.decelerate,
    useNativeDriver: true,
  }),
  Animated.timing(heroY, {
    toValue: 0,
    duration: duration.slow,
    easing: easing.decelerate,
    useNativeDriver: true,
  }),
  Animated.sequence([
    Animated.delay(160),
    Animated.parallel([
      Animated.timing(formOpacity, {
        toValue: 1,
        duration: duration.slow,
        easing: easing.decelerate,
        useNativeDriver: true,
      }),
      Animated.timing(formY, {
        toValue: 0,
        duration: duration.slow,
        easing: easing.decelerate,
        useNativeDriver: true,
      }),
    ]),
  ]),
]).start();

// Initial values: opacity=0, Y=14 (hero) / Y=10 (form)
// Always useNativeDriver: true
// Always use motion.ts tokens: easing.decelerate, duration.slow
```

### CTA Copy

- Login: `"Entrar no SweetCare"` — not just "Entrar"
- Register: `"Criar minha conta"` — personal, not corporate

---

## Depth Strategy

**Borders only** for form surface separation. No shadows on the hero or form container — the color contrast between blue-900 and slate-50 provides all the depth needed.

Shadows (`theme.shadows.md`) only on interactive elements (Button component handles this internally).

---

## Spacing

Base unit: **4pt grid** from `spacing.ts`.
Auth screens use `paddingHorizontal: 24` on form scroll, `paddingHorizontal: 28` on hero.

---

## Typography Principles for Auth

- Hero headline: raw `fontSize/fontWeight` values (not Text component variants) for precise control over the dual-register effect
- Form labels: Text component with `variant="label"` (handled by Input component)
- Links: Text component with `variant="bodySm"` + `color={theme.colors.primary.DEFAULT}`
- Legal footer: `variant="caption"`, `color={theme.colors.text.tertiary}`, centered

---

## Register-Specific

### Password Strength Indicator

Three dots + label, appears only when `password.length > 0`:

```tsx
// Colors by strength:
// length < 8:  error.DEFAULT (red)  + "Fraca"
// length 8-11: warning.DEFAULT (amber) + "Média"
// length >= 12: success.DEFAULT (green) + "Senha forte"

strengthDot: { width: 6, height: 6, borderRadius: 3 }
strengthRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 24 }
```

Not a progress bar. Three dots, gestural, reads at a glance.

---

## What This Direction Explicitly Rejects

- Centered logo marks as primary brand expression
- Dot grid decorative patterns
- Hero-then-card with straight horizontal separation
- Gradient overlays of any kind
- Heart icons (cliché in health/care apps)
- Left icons in every form field
- Cards with explicit borders or shadows in auth forms
- Generic CTA copy ("Entrar", "Cadastrar")
- Error banners with full border-box styling
