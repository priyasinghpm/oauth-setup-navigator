'use client';
import Link from 'next/link';
export default function GuideError(){return <div className="empty-state"><h1>Saved guide unavailable</h1><p>The server could not read this guide. Check persistent storage before trying the link again. Opening a guide never calls Gemini.</p><Link href="/" className="button">Back to provider guides</Link></div>;}
