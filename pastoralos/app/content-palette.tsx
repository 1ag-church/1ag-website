import {useEffect, useRef, useState} from 'react';
import {Popover} from 'radix-ui';
import {ChevronDown, Columns2, Heading, Image, Link, Minus, RectangleHorizontal, Share2, Type, Video} from 'lucide-react';
import {blockLabels, type BlockType} from '@/lib/pastoral/email-design';

type Choice = {type: BlockType; label: string; description: string; icon: typeof Type};
const groups = [
  {label: 'Text', icon: Type, choices: [
    {type: 'text', label: '1 column', description: 'One full-width text area', icon: RectangleHorizontal},
    {type: 'columns', label: '2 columns', description: 'Two text areas side by side', icon: Columns2},
    {type: 'heading', label: 'Heading', description: 'A title or section heading', icon: Heading},
  ]},
  {label: 'Image', icon: Image, choices: [
    {type: 'image', label: '1 column', description: 'One full-width image', icon: RectangleHorizontal},
    {type: 'image-pair', label: '2 columns', description: 'Two images side by side', icon: Columns2},
  ]},
] satisfies {label: string; icon: typeof Type; choices: Choice[]}[];
const singles = [
  {type: 'button', icon: Link}, {type: 'divider', icon: Minus},
  {type: 'video', icon: Video}, {type: 'social', icon: Share2},
] satisfies {type: BlockType; icon: typeof Type}[];

function BlockChoices({label, icon: Icon, choices, open, onOpenChange, add}: {
  label: string; icon: typeof Type; choices: Choice[]; open: boolean;
  onOpenChange: (open: boolean) => void; add: (type: BlockType) => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hovering = useRef(false), dragging = useRef(false);
  const content = useRef<HTMLDivElement>(null);
  function cancelClose() {clearTimeout(timer.current);}
  function leave() {
    cancelClose();
    timer.current = setTimeout(() => {
      if (!dragging.current && !content.current?.contains(document.activeElement)) onOpenChange(false);
    }, 180);
  }
  useEffect(() => () => clearTimeout(timer.current), []);
  return <Popover.Root open={open} onOpenChange={onOpenChange}>
    <Popover.Trigger asChild>
      <button type="button" className="block-choice-trigger"
        onPointerEnter={e => {if (e.pointerType === 'mouse') {cancelClose(); hovering.current = true; onOpenChange(true);}}}
        onPointerLeave={leave}
        onClick={e => {e.preventDefault(); cancelClose(); hovering.current = false; onOpenChange(true);}}
        onKeyDown={e => {if (e.key === 'ArrowDown') {e.preventDefault(); hovering.current = false; onOpenChange(true); content.current?.querySelector('button')?.focus();}}}>
        <Icon size={19}/><span>{label}<ChevronDown size={12}/></span>
      </button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content ref={content} className="block-choice-bubble" side="bottom" align="start" sideOffset={10} collisionPadding={16}
        aria-label={`${label} options`} onPointerEnter={cancelClose} onPointerLeave={leave}
        onOpenAutoFocus={e => {if (hovering.current) e.preventDefault();}}
        onCloseAutoFocus={e => {if (hovering.current) e.preventDefault();}}
        onEscapeKeyDown={() => {hovering.current = false; cancelClose();}}
        onFocusOutside={() => {cancelClose(); onOpenChange(false);}}>
        <p className="block-choice-title">Add {label.toLowerCase()}</p>
        {choices.map(({type, label: choiceLabel, description, icon: ChoiceIcon}) =>
          <button type="button" key={type} draggable aria-label={`${label}: ${choiceLabel}`}
            onDragStart={e => {cancelClose(); dragging.current = true; e.dataTransfer.setData('block-type', type);}}
            onDragEnd={() => {dragging.current = false; onOpenChange(false);}}
            onClick={() => {cancelClose(); add(type); onOpenChange(false);}}>
            <ChoiceIcon size={23}/><span><strong>{choiceLabel}</strong><small>{description}</small></span>
          </button>)}
        <Popover.Arrow className="block-choice-arrow" width={12} height={6}/>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}

export function ContentPalette({add}: {add: (type: BlockType) => void}) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  return <div className="block-grid">
    {groups.map(group => <BlockChoices key={group.label} {...group} add={add}
      open={openGroup === group.label}
      onOpenChange={open => setOpenGroup(current => open ? group.label : current === group.label ? null : current)}/>)}
    {singles.map(({type, icon: Icon}) => <button type="button" key={type} draggable
      onPointerEnter={() => setOpenGroup(null)}
      onDragStart={e => e.dataTransfer.setData('block-type', type)} onClick={() => add(type)}>
      <Icon size={19}/>{blockLabels[type]}
    </button>)}
  </div>;
}
