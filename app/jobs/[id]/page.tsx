import {notFound} from 'next/navigation';
import {GenerationJobView} from '@/components/generation-job';
import {jobStore} from '@/lib/jobs/runtime';
import {validJobId} from '@/lib/jobs/store';
import {jobView} from '@/lib/jobs/view';
export const dynamic='force-dynamic';
export const metadata={title:'Stepwise guide job',robots:{index:false,follow:false}};
export default async function JobPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!validJobId(id))notFound();
 let job;try{job=await jobStore().get(id);}catch{return <><h1>Job temporarily unavailable</h1><p>The saved checkpoint could not be read. Check the server storage; no generation was started.</p></>;}
 if(!job)notFound();return <GenerationJobView initial={jobView(job)}/>;
}
