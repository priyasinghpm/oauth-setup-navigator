import { notFound } from 'next/navigation';
import {resolveGuideRoute} from '@/lib/guide-route';
// Validate before the page's loading boundary can stream a successful response.
export default async function GuideLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  if (!await resolveGuideRoute((await params).slug)) notFound();
  return children;
}
