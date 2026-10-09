import "./globals.css";
export const metadata = {
  title: "TradeOS — 120-Gear Adaptive Decision Intelligence",
  description: "A risk-first trading decision system combining 108 market/decision gears, 12 adaptive-intelligence gears, and supervisory governors across live, official, historical, derived, and paper-account evidence."
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
