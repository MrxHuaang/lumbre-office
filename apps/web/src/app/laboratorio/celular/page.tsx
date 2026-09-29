import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CelularLab } from "@/components/phone/lab/CelularLab";

export const metadata: Metadata = { title: "Laboratorio del celular", robots: { index: false } };

// Solo desarrollo: el celular con datos falsos para probarlo sin entrar a la cabaña. En producción no existe.
export default function LaboratorioCelularPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <CelularLab />;
}
