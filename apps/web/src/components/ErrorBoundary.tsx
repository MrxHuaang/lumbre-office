"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { PixelIcon } from "./Cozy";

interface ErrorBoundaryProps {
  /** Qué parte de la pantalla cuida (para el log): "hud", "paneles"… */
  name: string;
  children: ReactNode;
  /** "Cerrar": qué hacer además de esconder el aviso (p. ej. cerrar el panel que se rompió). */
  onClose?: () => void;
  /** Si cambia (se abrió otro panel), se vuelve a intentar dibujar solo. */
  resetKey?: unknown;
  /** Dónde va el aviso; por defecto, arriba a la izquierda, bajo la barra del HUD. */
  className?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
  resetKey: unknown;
  /** Se cerró el aviso sin reintentar: no se dibuja nada hasta que cambie `resetKey`. */
  dismissed: boolean;
}

/**
 * Atrapa un error al dibujar una parte del HUD (un panel, un aviso) para que no tumbe toda la cabaña:
 * el juego sigue y en su lugar aparece un aviso chico con "Reintentar" y "Cerrar".
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, resetKey: this.props.resetKey, dismissed: false };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error, dismissed: false };
  }

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: ErrorBoundaryState): Partial<ErrorBoundaryState> | null {
    if (Object.is(props.resetKey, state.resetKey)) return null;
    return { error: null, dismissed: false, resetKey: props.resetKey };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[web] se rompió "${this.props.name}"`, error, info.componentStack);
  }

  private retry = () => this.setState({ error: null, dismissed: false });

  private close = () => {
    const { onClose } = this.props;
    // Con algo que cerrar, se cierra y se vuelve a dibujar el resto; si no, solo se esconde el aviso.
    if (onClose) {
      onClose();
      this.setState({ error: null, dismissed: false });
    } else {
      this.setState({ dismissed: true });
    }
  };

  render() {
    const { error, dismissed } = this.state;
    if (!error) return this.props.children;
    if (dismissed) return null;
    return (
      <div
        role="alert"
        className={
          this.props.className ??
          "cozy-panel pointer-events-auto absolute top-[calc(var(--cozy-hud-bottom,3.5rem)_+_0.5rem)] left-3 z-50 flex w-[min(300px,calc(100%-1.5rem))] flex-col gap-2.5 px-4 py-3 font-pixel text-[14px]"
        }
      >
        <p className="flex items-center gap-2">
          <PixelIcon name="close" size={12} color="var(--color-cozy-red)" />
          <span>Esta parte de la cabaña no se pudo mostrar.</span>
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={this.retry} className="cozy-btn cozy-btn-primary px-3 py-1.5 text-[13px]">
            Reintentar
          </button>
          <button type="button" onClick={this.close} className="cozy-btn px-3 py-1.5 text-[13px]">
            Cerrar
          </button>
        </div>
      </div>
    );
  }
}
