import {GenerationAccess} from '@/components/generation-access';
import Link from 'next/link';
import {QueuedGuideRequest} from '@/components/queued-guide-request';
import {guides} from '@/lib/guides';
export const metadata={title:'Resumable generation'};
export default function StepwisePage(){return <><p><Link href='/#generate'>← Back to standard generation</Link></p><p>Optional advanced mode: save each completed section and resume a failed section deliberately. Requires the local background worker; provider errors can still occur.</p><GenerationAccess><QueuedGuideRequest guides={guides}/></GenerationAccess></>;}
