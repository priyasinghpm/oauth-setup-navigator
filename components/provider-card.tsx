import Link from 'next/link';
import type { OAuthGuide } from '@/lib/types';
import { ProviderMark } from './provider-mark';
export function ProviderCard({ guide }: { guide: OAuthGuide }) {
  return <Link href={`/guides/${guide.slug}`} className="provider-card">
    <div className="card-top"><ProviderMark slug={guide.slug} mark={guide.mark} /><span className="research-badge">Source-backed</span></div>
    <p className="eyebrow card-category">{guide.category}</p>
    <h3>{guide.name}</h3><p className="card-description">{guide.summary}</p>
    <dl className="card-facts"><div><dt>Difficulty</dt><dd>{guide.difficulty.level} · editorial</dd></div><div><dt>Registration effort</dt><dd>{guide.setupEstimate.minMinutes}–{guide.setupEstimate.maxMinutes} min · estimate</dd></div></dl>
    <p className="card-research">Researched {guide.lastResearchedAt}<br />Not end-to-end tested</p>
    <div className="card-link">Explore setup guide <span aria-hidden="true">↗</span></div>
  </Link>;
}
