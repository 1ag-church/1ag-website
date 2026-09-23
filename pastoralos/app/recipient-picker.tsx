'use client';
import {useId,useRef,useState} from 'react';
import {Search,X} from 'lucide-react';
import {Input} from '@/components/ui/input';
import {directoryGroups,type CommunicationsState,type DirectoryPerson} from '@/lib/pastoral/communications';
import type {Channel} from '@/lib/pastoral/model';

export function PersonSearch({people,selected,channel,label,onSelect}:{people:DirectoryPerson[];selected:string[];channel:Channel;label:string;onSelect:(id:string)=>void}){
 const id=useId(),input=useRef<HTMLInputElement>(null);
 const [query,setQuery]=useState(''),[open,setOpen]=useState(false),[active,setActive]=useState(-1);
 const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 const matches=terms.length?people.filter(p=>!p.archived&&!selected.includes(p.id)&&terms.every(term=>`${p.name} ${p.email} ${p.phone}`.toLocaleLowerCase().includes(term))).sort((a,b)=>a.name.localeCompare(b.name)):[];
 const shown=matches.slice(0,30),expanded=open&&terms.length>0;
 function choose(personId:string){onSelect(personId);setQuery('');setOpen(false);setActive(-1);input.current?.focus();}
 return <div className="person-search" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}}>
  <label className="field" htmlFor={id}><span>{label}</span><div className="recipient-search-input"><Search size={17}/><Input ref={input} id={id} role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={expanded} aria-controls={id+'-results'} aria-activedescendant={expanded&&shown[active]?id+'-option-'+active:undefined} placeholder="Start typing a name…" value={query} onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setOpen(true);setActive(-1);}} onKeyDown={e=>{
   if(e.key==='Escape'){setOpen(false);setActive(-1);}
   if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true);const next=shown.length?(active<0?(e.key==='ArrowDown'?0:shown.length-1):(active+(e.key==='ArrowDown'?1:-1)+shown.length)%shown.length):-1;setActive(next);document.getElementById(id+'-option-'+next)?.scrollIntoView({block:'nearest'});}
   if(e.key==='Enter'&&expanded&&shown[active]){e.preventDefault();choose(shown[active].id);}
  }}/></div></label>
  {expanded&&<div className="recipient-results"><ul id={id+'-results'} role="listbox" aria-label={label+' matches'}>{shown.map((p,i)=><li id={id+'-option-'+i} key={p.id} role="option" aria-selected={i===active} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(p.id)}><strong>{p.name}</strong><small>{p[channel==='email'?'email':'phone']||`No ${channel==='email'?'email address':'phone number'}`}</small></li>)}</ul><p role="status">{matches.length===0?'No matching people.':matches.length>30?'Showing 30 matches. Keep typing to narrow the list.':`${matches.length} ${matches.length===1?'match':'matches'} · Click a name to select`}</p></div>}
 </div>;
}

export function RecipientPicker({state,channel,groups,people,onChange}:{state:CommunicationsState;channel:Channel;groups:string[];people:string[];onChange:(groups:string[],people:string[])=>void}){
 const tags=directoryGroups(state).filter(g=>channel==='sms'||g.id!=='prayer'),sms=channel==='sms';
 const smsChoice=groups.length===0&&people.length<=1?'person':groups.length===1&&people.length===0?'tag:'+groups[0]:'saved';
 return <>
  <label className="field"><span>{sms?'Send to':'Add a group or tag'}</span><select className="plain-select" aria-label={sms?'Text recipients':'Email recipient tag'} value={sms?smsChoice:''} onChange={e=>{const value=e.target.value;if(sms){if(value==='person')onChange([],[]);else if(value.startsWith('tag:'))onChange([value.slice(4)],[]);}else if(value)onChange([...new Set([...groups,value])],people);}}>
   {sms?<><option value="person">One person</option>{smsChoice==='saved'&&<option value="saved">Saved audience — {groups.length} tags, {people.length} people</option>}</>:<option value="">Choose a group or tag…</option>}
   <optgroup label="Tags">{tags.filter(t=>sms||!groups.includes(t.id)).map(t=><option key={t.id} value={sms?'tag:'+t.id:t.id}>{t.name}</option>)}</optgroup>
  </select></label>
  {(!sms||smsChoice==='saved')&&groups.length>0&&<div className="chip-list" aria-label="Selected recipient tags">{groups.map(id=><button type="button" className="group-chip" key={id} aria-label={'Remove tag '+(tags.find(t=>t.id===id)?.name??id)} onClick={()=>onChange(groups.filter(g=>g!==id),people)}>{tags.find(t=>t.id===id)?.name??id}<X size={13}/></button>)}</div>}
  {(!sms||smsChoice==='person')&&<PersonSearch people={state.people} selected={people} channel={channel} label={sms?'Find a person':'Add a person'} onSelect={id=>onChange(groups,sms?[id]:[...people,id])}/>}
  {people.length>0&&<div className="chip-list" aria-label="Selected people">{people.map(id=><button type="button" className="group-chip" key={id} aria-label={'Remove person '+(state.people.find(p=>p.id===id)?.name??id)} onClick={()=>onChange(groups,people.filter(p=>p!==id))}>{state.people.find(p=>p.id===id)?.name??'Unavailable person'}<X size={13}/></button>)}</div>}
 </>;
}
