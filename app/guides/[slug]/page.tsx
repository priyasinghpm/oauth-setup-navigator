import {resolveGuideRoute} from '@/lib/guide-route';
import {CopyShareLink} from '@/components/copy-share-link';
import {notFound} from 'next/navigation';
import {guides} from '@/lib/guides';
import {GuidePresentation} from '@/components/guide-presentation';
export const dynamicParams = true;
export function generateStaticParams() { return guides.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const result = await resolveGuideRoute((await params).slug); return { title: result ? `${result.guide.name} OAuth guide` : 'Guide not found',...(result?.saved?{robots:{index:false,follow:false}}:{}) }; }
export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const result = await resolveGuideRoute((await params).slug); if (!result) notFound();
  return <>{result.saved&&<><p>Saved AI-generated draft · Not human reviewed · Not end-to-end tested</p><p>Saved <time dateTime={result.saved.createdAt}>{result.saved.createdAt}</time>. Research date: {result.guide.lastResearchedAt}.</p><CopyShareLink path={`/guides/${result.saved.id}`} /></>}<GuidePresentation guide={result.guide} generated={Boolean(result.saved)} /></>;
}
