import "./globals.css";
export const metadata = { title: "TradeOS — Decision Intelligence", description: "AI-assisted trading simulation and learning cockpit" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
