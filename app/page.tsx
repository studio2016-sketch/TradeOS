"use client";
import { useMemo, useState } from "react";
import { Activity, BrainCircuit, ChartNoAxesCombined, Compass, GraduationCap, History, NotebookText, ShieldCheck, Sparkles, TriangleAlert, WalletCards } from "lucide-react";

const opportunities = [
  { ticker:"NVDA", score:91, setup:"Opening pullback", catalyst:"AI infrastructure demand", rvol:"3.8Ã—", entry:"183.40â€“184.10", stop:"181.85", target:"188.80", rr:"2.7:1", reason:"Strong relative volume with buyers defending VWAP." },
  { ticker:"AMD", score:87, setup:"Trend continuation", catalyst:"Sector strength", rvol:"2.6Ã—", entry:"213.20â€“214.00", stop:"211.55", target:"218.10", rr:"2.3:1", reason:"Constructive pullback inside a strong sector trend." },
  { ticker:"PLTR", score:82, setup:"Breakout retest", catalyst:"Contract momentum", rvol:"2.1Ã—", entry:"187.10â€“187.80", stop:"185.70", target:"191.40", rr:"2.4:1", reason:"Retest is holding, but price is somewhat extended." }
];

const nav = [
  ["Today", Activity],["Discover", Compass],["Analyze", ChartNoAxesCombined],["Trade", WalletCards],["Learn", GraduationCap],["Replay", History],["Journal", NotebookText]
] as const;

export default function Home() {
  const [active,setActive] = useState("Today");
  const [selected,setSelected] = useState(opportunities[0]);
  const [query,setQuery] = useState("");
  const [assistant,setAssistant] = useState("");
  const [risk,setRisk] = useState(50);
  const [entry,setEntry] = useState(183.75);
  const [stop,setStop] = use¶»§q«^