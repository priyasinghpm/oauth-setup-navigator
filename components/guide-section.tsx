export function GuideSection({ id, title, number, children }: { id: string; title: string; number: string; children: React.ReactNode }) {
  return <section id={id} className="guide-section"><div className="section-title"><span>{number}</span><h2>{title}</h2></div>{children}</section>;
}
export function BulletList({ items }: { items: string[] }) { return <ul className="bullet-list">{items.map(item => <li key={item}>{item}</li>)}</ul>; }
