'use client';
import { useState } from 'react';
import type { OAuthGuide } from '@/lib/types';
import { filterGuides } from '@/lib/search';
import { ProviderCard } from './provider-card';
export function ProviderDirectory({ guides }: { guides: OAuthGuide[] }) {
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState('all');
  const results = filterGuides(guides, query, provider);
  function reset() { setQuery(''); setProvider('all'); }
  return <section aria-labelledby="directory-title" id="providers">
    <div className="search-panel"><div className="search-field"><label htmlFor="search">Find your provider</label><div className="input-wrap"><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="Search providers, scopes, or keywords…" value={query} onChange={e => setQuery(e.target.value)} /></div></div><div className="filter-field"><label htmlFor="provider">Provider</label><select id="provider" value={provider} onChange={e => setProvider(e.target.value)}><option value="all">All providers</option>{guides.map(g => <option key={g.slug} value={g.slug}>{g.name}</option>)}</select></div></div>
    <div className="directory-heading"><div><p className="eyebrow">THE PROVIDER DIRECTORY</p><h2 id="directory-title">Find your starting point.</h2></div><p className="result-count" role="status" aria-live="polite">{results.length} {results.length === 1 ? 'provider' : 'providers'}{results.length !== guides.length ? ` of ${guides.length}` : ' available'}</p></div>
    {results.length ? <div className="provider-grid">{results.map(guide => <ProviderCard key={guide.slug} guide={guide} />)}</div> : <div className="empty-state"><span aria-hidden="true">⌕</span><h3>No providers found</h3><p>Try a different keyword or choose another provider.</p><button className="button" onClick={reset}>Reset search and filters</button><p><a className="begin-setup-link" href="#stepwise-generation">Generate a guide for another provider →</a></p></div>}
    {results.length > 0 && (query || provider !== 'all') && <button className="text-button" onClick={reset}>Reset search and filters ↺</button>}
  </section>;
}
