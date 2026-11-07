'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
export function AccessForm(){
 const [pin,setPin]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');const router=useRouter();
 async function submit(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{const r=await fetch('/api/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin}),cache:'no-store'});if(!r.ok){setError(r.status===429?'Too many access attempts. Wait 15 minutes before trying again.':r.status===401?'The access code is incorrect.':'Access could not be unlocked. Contact the person who shared this demo.');return;}setPin('');router.refresh();}catch{setError('Could not connect. Please try unlocking again.');}finally{setBusy(false);}}
 return <section className="generation-panel" id="generate"><h2>Generate an OAuth setup guide</h2><p>Generation is available to invited testers. Enter the access code shared with you. Existing guides are available without a code.</p><form onSubmit={submit}><label htmlFor="access-pin">Access code</label><input id="access-pin" type="password" autoComplete="current-password" maxLength={128} value={pin} onChange={e=>setPin(e.target.value)} disabled={busy}/><button className="button" disabled={busy||!pin}>{busy?'Unlocking…':'Unlock generation'}</button></form>{error&&<p role="alert">{error}</p>}</section>;
}
