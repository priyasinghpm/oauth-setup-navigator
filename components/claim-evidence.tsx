import type { Claim, Evidence, OfficialSource } from '@/lib/types';
const labels = { documented: 'Officially documented', estimated: 'Estimated / inferred', unknown: 'Needs confirmation' };
export function ClaimEvidence({ evidence, sources,generated=false }: { evidence: Evidence; sources: OfficialSource[];generated?:boolean }) {
  return <div className="claim-evidence"><span className={`evidence-label evidence-${evidence.status}`}>{generated&&evidence.status==='documented'?'Cites retrieved documentation · relevance needs review':labels[evidence.status]}</span>
    {evidence.sourceIds.map(id => { const source=sources.find(s => s.id === id); return <a key={id} href={generated&&source?source.url:`#source-${id}`} target={generated?"_blank":undefined} rel={generated?"noopener noreferrer":undefined} aria-label={`Source: ${source?.title ?? id}`}>{source?.title ?? id}</a>; })}
    {evidence.quotations?.map(q=><figure className="official-excerpt" key={q.evidenceId}>
      <figcaption>Official documentation excerpt · <a href={q.sourceUrl} target="_blank" rel="noopener noreferrer">{q.sourceTitle} ↗</a></figcaption>
      {generated&&<p className="excerpt-heading">{q.sectionHeading||'Section heading not available'} · Research date: {sources.find(s=>s.id===q.sourceId)?.inspectedAt}{q.clipped&&<strong> · Partial excerpt: do not treat this as a complete instruction.</strong>}</p>}
      <blockquote><p>{q.quote}</p></blockquote>
      <details><summary>Surrounding source context</summary>{q.sectionHeading && <p className="excerpt-heading">{q.sectionHeading}</p>}<p className="excerpt-context">{q.contextBefore}<mark>{q.quote}</mark>{q.contextAfter}</p><p>Extracted-text characters {q.startOffset}–{q.endOffset}.{q.clipped ? ' This excerpt is a segment of a longer source passage.' : ''}</p></details>
    </figure>)}
    {evidence.qualification && <p className="evidence-qualification">{evidence.qualification}</p>}
  </div>;
}
export function ClaimList({ items, sources,generated=false }: { items: Claim[]; sources: OfficialSource[];generated?:boolean }) {
  return <ul className="claim-list">{items.map((item,i) => <li key={`${i}-${item.text}`}><p>{item.text}</p><ClaimEvidence evidence={item.evidence} sources={sources} generated={generated} /></li>)}</ul>;
}
