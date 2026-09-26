/**
 * Crea/actualiza los agentes predefinidos (idempotente: upsert por escritorio).
 *   pnpm --filter @hyvento/db seed
 * No pisa los cambios hechos desde el editor: solo crea los que falten.
 */
import { AGENT_PRESETS } from "@hyvento/shared";
import { prisma } from "./index";

for (const preset of AGENT_PRESETS) {
  const existing = await prisma.agentDefinition.findUnique({ where: { deskId: preset.deskId } });
  if (existing) {
    console.log(`= ${existing.name} ya existe en ${preset.deskId}`);
    continue;
  }
  const agent = await prisma.agentDefinition.create({
    data: {
      name: preset.name,
      role: preset.role,
      systemPrompt: preset.systemPrompt,
      model: preset.model,
      tools: preset.tools,
      effort: preset.effort,
      sprite: preset.sprite,
      deskId: preset.deskId,
    },
  });
  console.log(`+ ${agent.name} (${agent.role}) en ${agent.deskId}`);
}
await prisma.$disconnect();
