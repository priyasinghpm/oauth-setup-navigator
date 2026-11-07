import type { OAuthGuide } from './types';
export function filterGuides(guides: OAuthGuide[], query: string, provider: string) {
  const term = query.trim().toLocaleLowerCase();
  return guides.filter(guide => (provider === 'all' || guide.slug === provider) &&
    [guide.name, guide.summary, ...guide.keywords].join(' ').toLocaleLowerCase().includes(term));
}
