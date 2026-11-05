import { useEffect, useRef, useState, type RefObject } from "react";
import { LogicalPosition, LogicalSize, currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";

// Altura máxima que o painel aberto pode ter; decide se ele cabe abaixo da barra.
const PANEL_MAX_HEIGHT = 420;

/**
 * A janela do Tauri segue o tamanho do widget, para não sobrar área invisível
 * bloqueando cliques nas janelas de trás. Perto da borda de baixo da tela, o
 * painel abre para cima: a barra fica parada e a janela cresce para cima.
 * Devolve `true` quando o painel deve abrir para cima.
 */
export function useWindowFit(ref: RefObject<HTMLElement | null>, open: boolean): boolean {
  const [up, setUp] = useState(false);
  // Base da barra (px lógicos) enquanto o painel está aberto para cima.
  const anchor = useRef<{ x: number; bottom: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const win = getCurrentWindow();
    const fit = async () => {
      const width = Math.ceil(el.offsetWidth);
      const height = Math.ceil(el.offsetHeight);
      if (!width || !height) return;
      await win.setSize(new LogicalSize(width, height));
      const a = anchor.current;
      if (a) await win.setPosition(new LogicalPosition(a.x, a.bottom - height));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    // Se o usuário arrastar a janela com o painel aberto para cima, a âncora acompanha.
    const unlisten = win.onMoved(async ({ payload }) => {
      if (!anchor.current) return;
      const pos = payload.toLogical(await win.scaleFactor());
      anchor.current = { x: pos.x, bottom: pos.y + el.offsetHeight };
    });
    return () => {
      observer.disconnect();
      unlisten.then((fn) => fn());
    };
  }, [ref]);

  useEffect(() => {
    const win = getCurrentWindow();
    const barHeight = ref.current?.querySelector<HTMLElement>(".bar")?.offsetHeight ?? 28;
    (async () => {
      const scale = await win.scaleFactor();
      const pos = (await win.outerPosition()).toLogical(scale);
      if (open) {
        const monitor = await currentMonitor();
        if (!monitor) return;
        const area = monitor.workArea ?? { position: monitor.position, size: monitor.size };
        const screenBottom = (area.position.y + area.size.height) / scale;
        if (pos.y + barHeight + PANEL_MAX_HEIGHT > screenBottom) {
          anchor.current = { x: pos.x, bottom: pos.y + barHeight };
          setUp(true);
        }
      } else if (anchor.current) {
        const a = anchor.current;
        anchor.current = null;
        setUp(false);
        await win.setPosition(new LogicalPosition(a.x, a.bottom - barHeight));
      }
    })();
  }, [open, ref]);

  return up;
}
