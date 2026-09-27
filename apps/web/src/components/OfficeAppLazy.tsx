"use client";

// La cabaña cargada aparte: "/" también sirve la portada pública, y así quien no inició sesión no
// descarga el código del juego. Se sigue renderizando en el servidor (ssr), como antes.
import dynamic from "next/dynamic";
import type { CurrentUser } from "./OfficeApp";

const OfficeApp = dynamic(() => import("./OfficeApp").then((m) => m.OfficeApp));

export function OfficeAppLazy({ user }: { user: CurrentUser }) {
  return <OfficeApp user={user} />;
}
