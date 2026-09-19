import {useEffect, useRef, useState, type Dispatch, type MouseEvent, type PointerEvent as ReactPointerEvent, type SetStateAction} from 'react';
import {newBlock, type BlockType, type EmailBlock, type EmailDesign} from '@/lib/pastoral/email-design';
import {moveBlockToGap} from '@/lib/pastoral/email-block-order';

export type EmailDragItem = {type: BlockType; id?: string};
type Gesture = {item: EmailDragItem; block: EmailBlock; source: HTMLElement; pointerId: number; originX: number; originY: number; x: number; y: number; started: boolean};
type DragPreview = {item: EmailDragItem; block: EmailBlock; x: number; y: number};
type Options = {setDesign: Dispatch<SetStateAction<EmailDesign>>; select: (id: string | null) => void};

export function useEmailDrag(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const canvas = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const suppressNextClick = useRef(false);
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const [gap, setGap] = useState<number | null>(null);
  const [landed, setLanded] = useState<string | null>(null);

  useEffect(() => {
    let frame = 0;
    let landingTimer: ReturnType<typeof setTimeout> | undefined;
    function gapAt(x: number, y: number) {
      const node = canvas.current;
      if (!node) return null;
      const bounds = node.getBoundingClientRect();
      if (x < bounds.left || x > bounds.right || y < Math.max(0, bounds.top) || y > Math.min(innerHeight, bounds.bottom)) return null;
      const blocks = [...node.querySelectorAll<HTMLElement>('.editable-block')];
      const index = blocks.findIndex(block => {const rect = block.getBoundingClientRect(); return y < rect.top + rect.height / 2;});
      return index < 0 ? blocks.length : index;
    }
    function publish(current: Gesture) {
      setPreview({item: current.item, block: current.block, x: current.x, y: current.y});
      setGap(gapAt(current.x, current.y));
    }
    function scroll() {
      const current = gesture.current;
      if (!current?.started) return;
      const speed = current.y < 70 ? -Math.ceil((70 - current.y) / 4) : current.y > innerHeight - 70 ? Math.ceil((current.y - innerHeight + 70) / 4) : 0;
      if (speed) {window.scrollBy(0, Math.max(-18, Math.min(18, speed))); publish(current);}
      frame = requestAnimationFrame(scroll);
    }
    function clear() {
      cancelAnimationFrame(frame);
      const current = gesture.current;
      gesture.current = null;
      if (current?.source.hasPointerCapture(current.pointerId)) current.source.releasePointerCapture(current.pointerId);
      setPreview(null);
      setGap(null);
    }
    function move(event: PointerEvent) {
      const current = gesture.current;
      if (!current || current.pointerId !== event.pointerId) return;
      current.x = event.clientX; current.y = event.clientY;
      if (!current.started && Math.hypot(current.x - current.originX, current.y - current.originY) < 6) return;
      event.preventDefault();
      if (!current.started) {
        current.started = true;
        suppressNextClick.current = true;
        if (current.item.id) latest.current.select(current.item.id);
        frame = requestAnimationFrame(scroll);
      }
      publish(current);
    }
    function finish(event: PointerEvent) {
      const current = gesture.current;
      if (!current || current.pointerId !== event.pointerId) return;
      const index = current.started ? gapAt(event.clientX, event.clientY) : null;
      if (index !== null) {
        const {item, block} = current;
        latest.current.setDesign(design => ({...design, blocks: item.id
          ? moveBlockToGap(design.blocks, item.id, index)
          : [...design.blocks.slice(0, index), block, ...design.blocks.slice(index)]}));
        latest.current.select(block.id);
        clearTimeout(landingTimer);
        setLanded(block.id);
        landingTimer = setTimeout(() => setLanded(null), 700);
      }
      clear();
    }
    function cancel(event: KeyboardEvent) {if (event.key === 'Escape') clear();}
    window.addEventListener('pointermove', move, {passive: false});
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', clear);
    window.addEventListener('blur', clear);
    window.addEventListener('keydown', cancel);
    return () => {
      cancelAnimationFrame(frame); clearTimeout(landingTimer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', clear);
      window.removeEventListener('blur', clear);
      window.removeEventListener('keydown', cancel);
      const current = gesture.current;
      gesture.current = null;
      if (current?.source.hasPointerCapture(current.pointerId)) current.source.releasePointerCapture(current.pointerId);
    };
  }, []);

  function start(event: ReactPointerEvent<HTMLElement>, item: EmailDragItem, block?: EmailBlock) {
    if (event.button !== 0 || gesture.current) return;
    suppressNextClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {item, block: block ?? newBlock(item.type), source: event.currentTarget, pointerId: event.pointerId,
      originX: event.clientX, originY: event.clientY, x: event.clientX, y: event.clientY, started: false};
  }
  function suppressClick(event: MouseEvent) {
    if (!suppressNextClick.current || event.detail === 0) return;
    suppressNextClick.current = false;
    event.preventDefault(); event.stopPropagation();
  }
  return {item: preview?.item ?? null, preview, gap, landed, canvas, start, suppressClick};
}

export type EmailDragController = ReturnType<typeof useEmailDrag>;
