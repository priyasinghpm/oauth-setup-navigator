import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
export const metadata: Metadata = { title: { default: 'OAuth Setup Navigator', template: '%s | OAuth Setup Navigator' }, description: 'A clear starting point for third-party OAuth application setup. Source-backed guides with claim evidence and transparent estimates.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Extensions may inject body attributes (e.g. cz-shortcut-listen) before hydration.
  // Suppress only this element; descendant hydration checks remain enabled.
  return <html lang="en"><body suppressHydrationWarning><a href="#main" className="skip-link">Skip to content</a><header className="site-header"><div className="header-inner"><Link href="/" className="brand"><span className="brand-symbol" aria-hidden="true">↗</span><span>OAuth<span className="brand-light"> / Navigator</span></span></Link><div className="header-right"><Link href="/#providers">Provider guides</Link><span className="phase-tag">OAUTH GUIDES</span></div></div></header><main id="main" className="container">{children}</main><footer className="site-footer"><div><span className="footer-brand">OAuth Setup Navigator</span><span>Built for a clearer first step.</span></div><p>Composio take-home · Source-backed OAuth guidance</p></footer></body></html>;
}
