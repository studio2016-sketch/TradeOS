import "./globals.css";
export const metadata = {
  title: "TradeOS — 100-Gear Decision Intelligence",
  description: "A risk-first trading decision system combining live, official, historical, derived, and paper-account evidence across 100 market variables and supervisory governors."
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
