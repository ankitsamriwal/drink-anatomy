# Anatomy of a Drink

An interactive visual guide to what actually goes into every coffee and cocktail - built layer by layer, pour by pour, in front of you, with synthesized sound.

**Prototype.** One engine, two content packs:

- **Coffee** (27 drinks) - espresso, ristretto, doppio, lungo, con panna, macchiato, cortado, piccolo, flat white, cappuccino, latte, cafe au lait, mocha, americano, red eye, irish coffee, iced americano, iced latte, cold brew, nitro cold brew, frappe, dalgona, shakerato, affogato, vietnamese iced coffee, turkish coffee, cafe bombon. Hot/cold filter wipes the irrelevant drinks off the board, then a top-down animated build over the cup shows exactly what goes in and in what order: the espresso pull, the milk pour, the foam cap, the latte art, the sprinkle. Add-ons rail: cocoa, cinnamon, whipped cream, ice cream, hazelnut, vanilla, caramel, protein, ristretto, extra shot, decaf.
- **Cocktails** (24 drinks) - dry martini, negroni, manhattan, daiquiri, cosmopolitan, whiskey sour, espresso martini, pina colada, mai tai, aperol spritz, bloody mary, tequila sunrise, sangria, caipirinha, tom collins, dark 'n' stormy, long island iced tea, moscow mule, margarita, screwdriver, jagerbomb, mojito, old fashioned, gin & tonic. The right glass, the right ice (cubes, crushed, one big block), the shake, the stir, the strain, the fizz, the garnish. The jagerbomb drops the shot into the glass on screen.

Every build ends on the recipe card: this is how it's made.

## Tech

Zero-dependency static SPA. No build step, no frameworks, no audio or image assets:

- Top-down vessels and every animation are hand-drawn SVG driven by CSS transitions.
- All sound (espresso extraction, pours, froth, ice clinks, the shaker, fizz, the splash) is synthesized live with the Web Audio API.
- Hash routing, so every drink is linkable (`#/coffee/cappuccino`).
- Respects `prefers-reduced-motion`.

## Run

Any static file server works. With Node:

```
npm start   # serves on :3000
```

## Deploy

Static - Vercel serves the files directly (`vercel.json` included). `server.js` is a zero-dependency Node static server for container hosts (Railway, Render, Fly).

---

Built with agents by [Ankit Samriwal](https://ankit-samriwal.vercel.app/).
