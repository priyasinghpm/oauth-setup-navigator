'use client';
import { useState } from 'react';
import type { Claim, OfficialSource } from '@/lib/types';
import { ClaimEvidence } from './claim-evidence';
export function PrerequisiteChecklist({ items, sources,generated=false }: { items: Claim[]; sources: OfficialSource[];generated?:boolean }) {
  const [checked, setChecked] = useState<number[]>([]);
  return <div className="checklist"><p className="section-intro">Check what you have ready. Progress is temporary and resets when you leave this guide.</p><p className="checklist-progress" role="status" aria-live="polite">{checked.length} of {items.length} ready</p>
    {items.map((item,i) => <div className="checklist-item" key={item.text}><label><input type="checkbox" checked={checked.includes(i)} onChange={e => setChecked(current => e.target.checked ? [...current,i] : current.filter(index => index !== i))} /><span>{item.text}</span></label><ClaimEvidence evidence={item.evidence} sources={sources} generated={generated} /></div>)}
  </div>;
}
