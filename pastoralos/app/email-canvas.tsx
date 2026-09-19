import {type Dispatch, type SetStateAction} from 'react';
import {createPortal} from 'react-dom';
import {ArrowUp, ArrowDown, Copy, Trash2, GripVertical} from 'lucide-react';
import {blockLabels, renderBlock, type EmailDesign} from '@/lib/pastoral/email-design';
import type {EmailDragController} from './email-drag';

type Props = {
  design: EmailDesign; setDesign: Dispatch<SetStateAction<EmailDesign>>;
  selected: string | null; select: (id: string | null) => void; mobile: boolean;
  move: (id: string, to: number) => void; drag: EmailDragController;
};

export function EmailCanvas({design, setDesign, selected, select, mobile, move, drag}: Props) {
  const {gap, landed} = drag;
  const movingFrom = design.blocks.findIndex(block => block.id === drag.item?.id);
  const visibleGap = drag.item && !(movingFrom >= 0 && (gap === movingFrom || gap === movingFrom + 1)) ? gap : null;
  const dropLabel = drag.item?.id ? 'Move here' : 'Add here';
  return <div ref={drag.canvas} className={`email-canvas ${mobile ? 'mobile' : ''} ${drag.item ? 'is-dragging' : ''}`}
    style={{background: design.surface, fontFamily: design.font}}>
    {design.blocks.map((block, index) => <div key={block.id}
      className={`editable-block ${selected === block.id ? 'selected' : ''} ${drag.item?.id === block.id ? 'drag-source' : ''} ${landed === block.id ? 'just-dropped' : ''}`}>
      {visibleGap === index && <div className="email-drop-indicator" aria-hidden="true"><span>{dropLabel}</span></div>}
      <button className="block-select" aria-label={`Edit ${blockLabels[block.type]} block ${index + 1}`} onClick={() => select(block.id)}>
        <span dangerouslySetInnerHTML={{__html: renderBlock(block, true)}}/>
      </button>
      <div className="block-tools">
        <button className="email-drag-handle" onPointerDown={event => drag.start(event, {id: block.id, type: block.type}, block)}
          onClickCapture={drag.suppressClick} aria-label="Drag block" title="Drag to move this block"><GripVertical size={15}/></button>
        <button aria-label="Move block up" disabled={index === 0} onClick={() => move(block.id, index - 1)}><ArrowUp size={15}/></button>
        <button aria-label="Move block down" disabled={index === design.blocks.length - 1} onClick={() => move(block.id, index + 1)}><ArrowDown size={15}/></button>
        <button aria-label="Duplicate block" onClick={() => {
          const copy = {...block, id: crypto.randomUUID()};
          setDesign({...design, blocks: [...design.blocks.slice(0, index + 1), copy, ...design.blocks.slice(index + 1)]});
          select(copy.id);
        }}><Copy size={15}/></button>
        <button aria-label="Delete block" onClick={() => {setDesign({...design, blocks: design.blocks.filter(b => b.id !== block.id)}); select(null);}}><Trash2 size={15}/></button>
      </div>
    </div>)}
    <div className={`canvas-drop ${visibleGap === design.blocks.length ? 'drop-active' : ''}`}>
      {visibleGap === design.blocks.length && <div className="email-drop-indicator" aria-hidden="true"><span>{dropLabel}</span></div>}
      {drag.item ? 'Drop here to place at the end' : 'Drop a block here'}
    </div>
    <div className="email-footer-preview">1AG Church<br/>Mailing address and unsubscribe link are added when sent.</div>
    <span className="sr-only" role="status" aria-live="polite">{drag.item
      ? `Dragging ${blockLabels[drag.item.type]}. ${visibleGap === null ? 'Move over the email to choose a position.' : `Drop at position ${visibleGap + 1}.`}`
      : landed ? 'Block placed.' : ''}</span>
    {drag.preview && createPortal(<div className="email-drag-preview" aria-hidden="true"
      style={{left: Math.max(8, Math.min(drag.preview.x + 18, innerWidth - 306)), top: Math.max(8, Math.min(drag.preview.y + 18, innerHeight - 210))}}>
      <strong>{drag.item?.id ? 'Move' : 'Add'} {blockLabels[drag.preview.item.type]}</strong>
      <div className="email-drag-preview-content" dangerouslySetInnerHTML={{__html: renderBlock(drag.preview.block, true)}}/>
    </div>, document.body)}
  </div>;
}
