# Rentema Logo Design

## Concept
The Rentema logo combines the concepts of "rent" and "ema" (your friend's name) into a modern, recognizable brand identity for rental property management.

## Design Elements

### Icon
- **House/Building Shape**: Represents rental properties and real estate
- **Modern Geometric Design**: Clean lines and contemporary styling
- **Blue Gradient**: Professional, trustworthy, and tech-forward
  - Primary: #3b82f6 (Modern Blue)
  - Secondary: #2563eb (Deep Blue)
- **Windows & Door**: Adds detail and reinforces the property/home concept
- **Roof Accent**: Subtle shadow effect for depth

### Typography
- **Font**: System font stack for optimal performance
- **Weight**: Bold (700) for strong brand presence
- **Gradient Text**: Matches the icon gradient for cohesive branding
- **Letter Spacing**: Tight (-0.02em) for modern look

## Usage

### Full Logo (with text)
```tsx
import Logo from './components/Logo';

<Logo size={40} showText={true} />
```

### Icon Only
```tsx
<Logo size={32} showText={false} variant="icon" />
```

### Custom Size
```tsx
<Logo size={64} showText={true} />
```

## Variants

1. **Full Logo**: Icon + "Rentema" text (used in sidebar)
2. **Icon Only**: Just the house icon (used in login, favicons)

## Color Palette

The logo uses the app's design system colors:
- **Primary Blue**: `#3b82f6` (var(--accent-primary))
- **Deep Blue**: `#2563eb` (var(--accent-hover))
- **Light Blue**: `#60a5fa` (var(--accent-light))
- **Dark Slate**: `#1e293b` (var(--bg-secondary))

## Files
- `Logo.tsx` - React component with SVG logo
- Used in:
  - `Layout.tsx` - Sidebar navigation
  - `LoginPage.tsx` - Login screen

## Future Enhancements
- Export as PNG/SVG for external use
- Create favicon versions (16x16, 32x32, etc.)
- Add animated version for loading states
- Create social media variants
