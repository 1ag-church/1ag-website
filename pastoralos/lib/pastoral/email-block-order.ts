// Drop positions refer to gaps in the original list, including the gap after its last item.
export function moveBlockToGap<T extends {id: string}>(blocks: T[], id: string, gap: number): T[] {
  const from = blocks.findIndex(block => block.id === id);
  if (from < 0) return blocks;
  const boundary = Math.max(0, Math.min(gap, blocks.length));
  const to = boundary > from ? boundary - 1 : boundary;
  if (to === from) return blocks;
  const next = [...blocks];
  const [block] = next.splice(from, 1);
  next.splice(to, 0, block);
  return next;
}
