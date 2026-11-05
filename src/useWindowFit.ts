import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { LogicalPosition, LogicalSize, currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";

// Tamanho do widget com o painel aberto; decide para que lado ele cabe.
const PANEL_WIDTH = 300;
const PANEL_MAX_HEIGHT = 420;
// Distância mínima entre o widget e a borda da área útil.
const MARGIN = 8;
// Sem eventos de movimento por esse tempo, o arraste terminou.
const DRAG_END_MS = 250;
// Por quanto tempo um movimento feito pelo próprio app ainda pode gerar evento.
const OWN_MOVE_MS = 1_000;

/** Para que lado o widget cresce a partir da barra em repouso. */
export type Direction = { left: boolean; up: boolean };

type Point = { x: number; y: number };
type Size = { width: number; height: number };
type Rect = Point & Size;

/** Canto da barra que fica parado: o direito quando cresce para a esquerda, o de baixo quando cresce para cima. */
function anchorOf(pos: Point, size: Size, dir: Direction): Point {
  return { x: dir.left ? pos.x + size.width : pos.x, y: dir.up ? pos.y + size.height : pos.y };
}

/** Mantém a janela dentro da área útil do monitor, com uma margem. */
function clamp(pos: Point, size: Size, area: Rect | null): Point {
  if (!area) return pos;
  return {
    x: Math.max(area.x + MARGIN, Math.min(pos.x, area.x + area.width - size.width - MARGIN)),
    y: Math.max(area.y + MARGIN, Math.min(pos.y, area.y + area.height - size.height - MARGIN)),
  };
}

/**
 * A janela do Tauri segue o tamanho do widget, para não sobrar área invisível
 * bloqueando cliques nas janelas de trás.
 *
 * Quando o widget fica ativo (mouse em cima ou painel aberto), decide para onde
 * crescer: para a direita e para baixo se o painel aberto couber; senão para a
 * esquerda e/ou para cima. Se não couber de nenhum jeito, a janela é empurrada
 * para dentro da área útil e volta ao lugar quando encolhe. A direção não muda
 * enquanto o widget está ativo, para nada pular durante o uso.
 */
export function useWindowFit(ref: RefObject<HTMLElement | null>, active: boolean): Direction {
  const [dir, setDir] = useState<Direction>({ left: false, up: false });
  const dirRef = useRef(dir);
  // Posição e tamanho atuais da janela, em px lógicos.
  const pos = useRef<Point | null>(null);
  const size = useRef<Size>({ width: 0, height: 0 });
  const anchor = useRef<Point | null>(null);
  const area = useRef<Rect | null>(null);
  // Posições definidas pelo app há pouco, para não confundir com um arraste do usuário.
  // O evento de movimento chega atrasado, às vezes depois de o app já ter mudado de novo.
  const ownMoves = useRef<(Point & { at: number })[]>([]);
  const wasActive = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const win = getCurrentWindow();
    let dragTimer: number | undefined;

    const updateArea = async () => {
      const monitor = await currentMonitor();
      if (!monitor) return;
      const scale = monitor.scaleFactor;
      const wa = monitor.workArea ?? { position: monitor.position, size: monitor.size };
      area.current = {
        x: wa.position.x / scale,
        y: wa.position.y / scale,
        width: wa.size.width / scale,
        height: wa.size.height / scale,
      };
    };

    const fit = async () => {
      const width = Math.ceil(el.offsetWidth);
      const height = Math.ceil(el.offsetHeight);
      if (!width || !height) return;
      size.current = { width, height };
      const a = anchor.current;
      if (!a) {
        await win.setSize(new LogicalSize(width, height));
        return;
      }
      const d = dirRef.current;
      const target = clamp({ x: d.left ? a.x - width : a.x, y: d.up ? a.y - height : a.y }, size.current, area.current);
      const now = Date.now();
      ownMoves.current = [...ownMoves.current.filter((m) => now - m.at < OWN_MOVE_MS), { ...target, at: now }];
      pos.current = target;
      await Promise.all([
        win.setPosition(new LogicalPosition(target.x, target.y)),
        win.setSize(new LogicalSize(width, height)),
      ]);
    };

    (async () => {
      const scale = await win.scaleFactor();
      const p = (await win.outerPosition()).toLogical(scale);
      pos.current = { x: p.x, y: p.y };
      await updateArea();
      anchor.current = anchorOf(pos.current, size.current, dirRef.current);
      await fit();
    })();

    const observer = new ResizeObserver(() => void fit());
    observer.observe(el);

    // Arraste do usuário: a âncora acompanha e, quando ele solta, o widget volta para dentro da tela.
    const unlisten = win.onMoved(async ({ payload }) => {
      const at = Date.now();
      const p = payload.toLogical(await win.scaleFactor());
      const own = ownMoves.current.some(
        (m) => at - m.at < OWN_MOVE_MS && Math.abs(m.x - p.x) < 2 && Math.abs(m.y - p.y) < 2,
      );
      if (own) return;
      pos.current = { x: p.x, y: p.y };
      anchor.current = anchorOf(pos.current, size.current, dirRef.current);
      window.clearTimeout(dragTimer);
      dragTimer = window.setTimeout(async () => {
        await updateArea();
        await fit();
      }, DRAG_END_MS);
    });

    return () => {
      observer.disconnect();
      window.clearTimeout(dragTimer);
      unlisten.then((fn) => fn());
    };
  }, [ref]);

  // Decide a direção ao ativar, antes do ResizeObserver redimensionar a janela.
  useLayoutEffect(() => {
    if (active && !wasActive.current && pos.current) {
      const p = pos.current;
      const s = size.current;
      const a = area.current;
      let next: Direction = { left: false, up: false };
      if (a) {
        const right = a.x + a.width - MARGIN;
        const bottom = a.y + a.height - MARGIN;
        next = {
          left: p.x + PANEL_WIDTH > right && p.x + s.width - PANEL_WIDTH >= a.x + MARGIN,
          up: p.y + s.height + PANEL_MAX_HEIGHT > bottom && p.y - PANEL_MAX_HEIGHT >= a.y + MARGIN,
        };
      }
      dirRef.current = next;
      anchor.current = anchorOf(p, s, next);
      setDir(next);
    }
    wasActive.current = active;
  }, [active]);

  return dir;
}
