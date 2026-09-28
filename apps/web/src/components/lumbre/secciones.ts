// Las anclas de la portada (barra de arriba y pie). Va aparte de Nav.tsx: un módulo "use client" no
// le puede pasar datos al servidor, solo componentes.
export const SECCIONES = [
  { href: "#funciones", texto: "Funciones" },
  { href: "#mundo", texto: "El mundo" },
  { href: "#como-funciona", texto: "Cómo funciona" },
  { href: "#tu-equipo", texto: "Tu equipo" },
  { href: "#preguntas", texto: "Preguntas" },
] as const;
