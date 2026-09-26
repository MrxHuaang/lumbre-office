# Hyvento Office

Oficina virtual 2D (pixel-art top-down) para el equipo Hyvento: oficinas personales, chat y video por proximidad, y un equipo de agentes de IA que colaboran en tareas de forma visible dentro de la oficina.

## Stack
- **apps/web**: Next.js + Phaser 3 (mapa, avatares) + UI React
- **apps/server**: Colyseus (estado multijugador en tiempo real)
- **apps/agents**: worker de agentes (Claude API, BullMQ) — Fase 4+
- **packages/map**: mapa Tiled, zonas, colisión y pathfinding compartidos
- **packages/shared**: protocolo y esquemas de eventos (zod)
- **packages/db**: Prisma + Postgres

## Requisitos
- Node 22+ y pnpm 10 (`npm i -g pnpm@10`)
- Docker Desktop (Postgres, Redis, LiveKit) — necesario desde la Fase 2

## Desarrollo
```bash
pnpm install
cp .env.example .env
pnpm dev
```

## Roadmap
0. Base del monorepo · 1. Oficina multijugador · 2. Oficinas personales · 3. Video por proximidad (LiveKit) · 4. Agente único · 5. Equipo de agentes · 6. Editor de agentes y rol Developer · 7. Despliegue
