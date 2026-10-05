import { expect, test, type Page } from "@playwright/test";

// Smoke de la cabaña: entrar con el ingreso de prueba, esperar a que cargue, caminar con el teclado y
// mandar un mensaje al chat global. Necesita la web en `next dev` y el servidor de juego (ver
// playwright.config.ts).

interface OfficeSceneDebug {
  local?: { x: number; y: number };
}

/** Posición del personaje propio, leída de la escena de Phaser (`window.__hyventoGame`, solo en desarrollo). */
async function localPosition(page: Page): Promise<{ x: number; y: number } | null> {
  return page.evaluate(() => {
    const game = (window as unknown as { __hyventoGame?: { scene: { getScene(key: string): unknown } } }).__hyventoGame;
    const scene = game?.scene.getScene("office") as OfficeSceneDebug | undefined;
    return scene?.local ? { x: scene.local.x, y: scene.local.y } : null;
  });
}

test("entrar de prueba, caminar y chatear", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  const name = `Smoke${Date.now().toString(36).slice(-5)}`;
  await page.goto("/login");
  await page.getByLabel("Nombre").fill(name);
  await page.getByRole("button", { name: "Entrar de prueba" }).click();

  // La cabaña: el juego tiene al personaje propio y la pantalla de carga ya se fue.
  await expect.poll(() => localPosition(page), { timeout: 180_000, message: "que aparezca el personaje" }).not.toBeNull();
  await expect(page.locator(".entry-loader")).toHaveCount(0, { timeout: 60_000 });
  await expect(page.getByRole("button", { name: "Menú", exact: true })).toBeVisible();

  // Quien entra por primera vez ve la bienvenida de Doña Aurora como cinemática (toma la pantalla y no deja
  // caminar): se salta con Esc, como lo haría cualquiera.
  const cine = page.getByLabel("Cinemática");
  if (await cine.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.keyboard.press("Escape");
    await expect(cine).toHaveCount(0);
  }

  // Caminar: se prueba cada dirección hasta que el personaje se mueva (alguna puede estar tapada).
  const start = (await localPosition(page))!;
  let moved = false;
  for (const key of ["s", "d", "w", "a"]) {
    await page.keyboard.down(key);
    await page.waitForTimeout(700);
    await page.keyboard.up(key);
    const now = await localPosition(page);
    if (now && Math.hypot(now.x - start.x, now.y - start.y) > 8) {
      moved = true;
      break;
    }
  }
  expect(moved, "el personaje debería caminar con el teclado").toBe(true);

  // Chat: Enter saca el celular en Mensajes; con las flechas se pasa al canal global, se escribe con el
  // teclado y el mensaje vuelve del servidor.
  const text = `hola desde el smoke ${Date.now()}`;
  await page.keyboard.press("Enter");
  const global = page.getByRole("tablist", { name: "Canal" }).getByRole("tab", { name: "Global" });
  await expect(global).toBeVisible();
  for (let i = 0; i < 3 && (await global.getAttribute("aria-selected")) !== "true"; i++) await page.keyboard.press("ArrowRight");
  await expect(global).toHaveAttribute("aria-selected", "true");
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
  await expect(page.getByText(text)).toBeVisible();

  expect(errors, "sin errores sin atrapar en la página").toEqual([]);
});
