import PaperWorkspace from "./PaperWorkspace";
import "./paper-workspace.css";

export const metadata = {
  title: "Paper Risk Workspace | TradeOS",
  description: "Manual hypothetical position-size arithmetic. No orders, market quotes or trading authorization.",
};

export default function PaperWorkspacePage() {
  return <main className="paperWorkspace">
    <a className="paperBack" href="/">Back to TradeOS</a>
    <header>
      <span className="paperBadge">PAPER ONLY · MANUAL INPUTS</span>
      <h1>Build a hypothetical risk plan</h1>
      <p>Explore how equity, risk percentage and planned prices affect whole-share size. This is arithmetic, not a recommendation, fill simulation or permission to trade.</p>
    </header>
    <PaperWorkspace />
  </main>;
}
