import './globals.css';
import type { Metadata } from 'next';
import './style.css';
export const metadata: Metadata = {title:'Fantasy Time Machine',description:'Draft the greatest fantasy seasons since 2000'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}

