import {resolveGuideRoute} from '@/lib/guide-route';
import {CopyShareLink} from '@/components/copy-share-link';
import {notFound} from 'next/navigation';
import {GuidePresentation} from '@/components/guide-presentation';
// UUID guides read durable storage at request time. Avoid static fallback
// rendering that turns connection() into DYNAMIC_SERVER_USAGE in production.
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const result = await resolveGuideRoute((await params).slug); return { title: result ? `${result.guide.name} OAuth guide` : 'Guide not found',...(result?.saved?{robots:{index:false,follow:false}}:{}) }; }
export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const result = await resolveGuideRoute((await params).slug); if (!result) notFound();
  return <>{result.saved&&<><p>Saved AI-generated draft · Not human reviewed · Not end-to-end tested</p><p>Saved <time dateTime={result.saved.createdAt}>{result.saved.createdAt}</time>. Research date: {result.guide.lastResearchedAt}.</p><CopyShareLink path={`/guides/${result.saved.id}`} /></>}<GuidePresentation guide={result.guide} generated={Boolean(result.saved)} /></>;
}
