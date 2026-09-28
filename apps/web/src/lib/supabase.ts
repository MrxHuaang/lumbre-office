import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** URL y anon key del proyecto de Supabase (públicas: la anon key no da acceso a datos, solo a Auth). */
export function supabaseConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

/**
 * Cliente de Supabase para el servidor (componentes, acciones y rutas). Solo se usa para la
 * identidad: los datos siguen en Neon con Prisma. La sesión vive en cookies `sb-*`.
 */
export async function supabaseServer() {
  const config = supabaseConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Desde un componente de servidor no se pueden escribir cookies; el middleware las renueva.
        }
      },
    },
  });
}
