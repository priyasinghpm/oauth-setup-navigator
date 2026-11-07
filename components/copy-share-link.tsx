'use client';
import {useState} from 'react';
import Link from 'next/link';
export function CopyShareLink({path,staticGuide=false}:{path:string;staticGuide?:boolean}){
 const [message,setMessage]=useState('');
 async function copy(){try{await navigator.clipboard.writeText(new URL(path,window.location.origin).href);setMessage('Share link copied.');}catch{setMessage(staticGuide ? 'Copy was unavailable. Copy this page’s address from your browser.' : 'Copy was unavailable. Open the saved guide and copy its address.');}}
 return <div className="share-actions"><button className="button" type="button" onClick={copy}>{staticGuide ? 'Copy Link' : 'Copy Share Link'}</button>{!staticGuide && <Link href={path}>Open saved guide →</Link>}<p role="status" aria-live="polite">{message}</p></div>;
}
