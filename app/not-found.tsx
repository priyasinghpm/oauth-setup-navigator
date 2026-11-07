import Link from 'next/link';
export default function NotFound() { return <div className="empty-state not-found"><p className="eyebrow">404 · GUIDE NOT FOUND</p><h1>Let’s find your starting point.</h1><p>This guide is unavailable or the saved link is invalid. Explore Google Calendar, Slack, or Notion in the directory.</p><Link href="/" className="button">Back to provider guides</Link></div>; }
