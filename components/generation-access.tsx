import 'server-only';
import {cookies} from 'next/headers';
import {ACCESS_COOKIE,accessConfig,validAccess} from '@/lib/access/generation-access';
import {AccessForm} from './access-form';
export async function GenerationAccess({children}:{children:React.ReactNode}){
 const config=accessConfig();if(!config.required)return children;
 if(!config.pin)return <section className="generation-panel" id="generate"><h2>Guide generation is unavailable</h2><p>The demo owner has not configured generation access. You can still explore the existing guides.</p></section>;
 if(validAccess((await cookies()).get(ACCESS_COOKIE)?.value,config.pin))return children;
 return <AccessForm/>;
}
