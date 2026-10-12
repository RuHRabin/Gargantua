# Gargantua: A Gravity Odyssey

A browser game inspired by Interstellar. Fly a small ship around a black hole, collect data, and get back to the Endurance before Earth runs out of time. Built with Three.js, React, and Vite.

The black hole is rendered in a fragment shader that ray-marches light paths through Schwarzschild-style curvature, so the lensing around the accretion disk is computed per pixel. Music and sound effects are generated live with the Web Audio API.

## Controls

| Input | Action |
| --- | --- |
| Mouse | Steer |
| W / Space / Click | Thrust |
| Shift | Boost |
| S | Retro burn |
| A / D | Roll |
| Esc | Pause |

On touch devices, hold the on-screen thrust button.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy

Pushing to `main` builds the site and publishes it to GitHub Pages through `.github/workflows/deploy.yml`. In the repository, open Settings > Pages and set Source to **GitHub Actions**.

## 🤝 Contributors
* **Claude** (AI Assistant by Anthropic) - Code generation & optimization.

## Disclaimer

Fan project. Not affiliated with or endorsed by the makers of Interstellar.
