"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ASK_CHIPS = [
  "Summarize the Vivint non-competition agreement",
  "What are the renewal terms in the Netzee maintenance agreement?",
  "What does the Salesforce reseller agreement cover?",
];

const CAPS = [
  { href: "/assistant", ico: "✦", name: "Discuss", desc: "Multi-turn chat with your AI co-counsel. Cites your documents." },
  { href: "/research", ico: "◊", name: "Research", desc: "Deep, pin-cited answers across your whole corpus." },
  { href: "/diligence", ico: "⊞", name: "Extract", desc: "Pull structured data across thousands of docs at once." },
  { href: "/agents", ico: "⚙", name: "Automate", desc: "Agents that monitor your portfolio 24/7 in your VPC." },
  { href: "/review", ico: "✎", name: "Review & Draft", desc: "Clause review with severity, drafting in your firm's voice." },
];

const MODULES = [
  { href: "/research", ico: "◊", name: "Research", tier: "Corpus Q&A", metric: "86", unit: "questions answered", line: "avg 4.2s · 9 saved to dashboard · top topic: indemnity caps", bars: [30, 45, 60, 48, 100, 72, 55], peak: 4 },
  { href: "/diligence", ico: "⊞", name: "Diligence", tier: "Bulk extraction", metric: "3", unit: "grids run", line: "11,200 cells extracted · 2 exported to CSV · 1 grid in progress (73%)", bars: [20, 20, 100, 30, 25, 80, 45], peak: 2 },
  { href: "/agents", ico: "⟳", name: "Agents", tier: "Scheduled · Enclave wedge", metric: "48", unit: "agent runs", line: "7 agents active · 18 items flagged · 2 awaiting approval", bars: [55, 60, 58, 65, 62, 100, 60], peak: 5 },
  { href: "/review", ico: "▤", name: "Review", tier: "Clause review · playbook", metric: "32", unit: "docs reviewed", line: "71 findings · 12 high-severity · playbook: Acme MSA v3", bars: [40, 30, 50, 90, 35, 45, 25], peak: 3 },
  { href: "/draft", ico: "✎", name: "Draft", tier: "Clause generation · your voice", metric: "19", unit: "clauses drafted", line: "in firm voice · 6 inserted into live docs · 4 templates saved", bars: [25, 40, 30, 55, 80, 35, 20], peak: 4 },
];

const FEED = [
  { dot: "workflows", text: <><b>Auto-Renewal Watch</b> flagged 14 contracts renewing in next 60 days and drafted renegotiation memos.</>, meta: "Agents · 2h ago" },
  { dot: "vault", text: <>Sarah asked <b>&quot;median indemnity cap across SaaS MSAs&quot;</b> — 6 sources cited, saved to dashboard.</>, meta: "Research · 4h ago" },
  { dot: "connect", text: <><b>iManage</b> sync completed — 312 new documents indexed and ACL-mapped.</>, meta: "Indexing · Settings · 8h ago" },
  { dot: "workflows", text: <><b>2 agent actions</b> are awaiting your approval before sending external emails.</>, meta: "Agents · approval gate · 1 day ago" },
  { dot: "matrix", text: <><b>Project Atlas dataroom</b> grid finished — 11,200 cells extracted across 187 docs, exported to CSV.</>, meta: "Diligence · 1 day ago" },
  { dot: "review", text: <><b>Contract Triage</b> escalated 5 of 23 incoming contracts to attorney review.</>, meta: "Agents → Review · 4 days ago" },
];

export default function HomePage() {
  const router = useRouter();
  const [ask, setAsk] = useState("");

  function go(q: string) {
    const query = q.trim();
    if (!query) return;
    sessionStorage.setItem("enclave:ask", query);
    router.push("/research");
  }

  return (
    <main className="main">
      <div className="page-head">
        <div>
          <div className="eyebrow">Acme Legal · workspace overview · all activity in-VPC</div>
          <h1 className="page-title">Good morning, Sarah.</h1>
          <p className="page-sub">
            Everything your AI workforce and your team did across the platform — last 7 days.
          </p>
        </div>
        <div className="page-actions" style={{ alignItems: "center", gap: 12 }}>
          <div className="range">
            <button>24h</button>
            <button className="active">7d</button>
            <button>30d</button>
            <button>90d</button>
          </div>
          <Link className="btn btn-primary" href="/research">
            Ask Research
          </Link>
        </div>
      </div>

      <div className="ask-hero">
        <div className="ask-hero-label">✦ Ask your AI · grounded in your corpus · in-VPC</div>
        <div className="ask-box">
          <span className="ask-ico">✦</span>
          <input
            value={ask}
            placeholder="Ask anything about your contracts, matters, or portfolio — or describe a task to run…"
            onChange={(e) => setAsk(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") go(ask);
            }}
          />
          <button className="btn btn-primary" onClick={() => go(ask)}>
            Ask
          </button>
        </div>
        <div className="ask-suggest">
          <span>Try:</span>
          {ASK_CHIPS.map((c) => (
            <button key={c} className="ask-chip" onClick={() => go(c)}>
              {c}
            </button>
          ))}
          <Link href="/assistant" className="ask-open">
            Open full Assistant →
          </Link>
        </div>
      </div>

      <div className="section-label">What your AI can do</div>
      <div className="caps">
        {CAPS.map((c) => (
          <Link key={c.name} className="cap" href={c.href}>
            <div className="cap-ico">{c.ico}</div>
            <div className="cap-name">{c.name}</div>
            <div className="cap-desc">{c.desc}</div>
          </Link>
        ))}
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-num">312</div>
          <div className="kpi-lbl">AI tasks run · all modules</div>
          <div className="kpi-delta up">▲ 18% vs. prior 7d</div>
        </div>
        <div className="kpi">
          <div className="kpi-num">86</div>
          <div className="kpi-lbl">Questions answered · Research</div>
          <div className="kpi-delta up">▲ 22% vs. prior 7d</div>
        </div>
        <div className="kpi">
          <div className="kpi-num">48</div>
          <div className="kpi-lbl">Agent runs · Agents</div>
          <div className="kpi-delta flat">7 agents active · 0 failed</div>
        </div>
        <div className="kpi">
          <div className="kpi-num" style={{ color: "#f4c47a" }}>11</div>
          <div className="kpi-lbl">Items need your attention</div>
          <div className="kpi-delta warn">2 approvals overdue</div>
        </div>
      </div>

      <div className="section-label">Needs your attention</div>
      <div className="attention">
        <Link className="att-item high" href="/agents">
          <div className="att-count">2</div>
          <div className="att-text">Approvals pending — agent actions awaiting sign-off</div>
          <div className="att-src">Agents · oldest 2 days</div>
        </Link>
        <Link className="att-item med" href="/agents">
          <div className="att-count">14</div>
          <div className="att-text">Contracts auto-renewing in next 60 days</div>
          <div className="att-src">Auto-Renewal Watch</div>
        </Link>
        <Link className="att-item med" href="/diligence">
          <div className="att-count">4</div>
          <div className="att-text">Deals drifting from firm norm on indemnity / LoL</div>
          <div className="att-src">Portfolio Drift Monitor</div>
        </Link>
        <Link className="att-item low" href="/research">
          <div className="att-count">5</div>
          <div className="att-text">Contracts escalated to attorney review</div>
          <div className="att-src">Contract Triage</div>
        </Link>
      </div>

      <div className="dash-body">
        <div>
          <div className="section-label">Activity · last 7 days</div>
          <div className="mod-grid">
            {MODULES.map((m) => (
              <Link key={m.name} className="mod" href={m.href}>
                <div className="mod-head">
                  <div className="mod-icon">{m.ico}</div>
                  <div>
                    <div className="mod-name">{m.name}</div>
                    <div className="mod-tier">{m.tier}</div>
                  </div>
                  <span className="mod-open">Open →</span>
                </div>
                <div className="mod-metric">
                  {m.metric} <small>{m.unit}</small>
                </div>
                <div className="mod-line">{m.line}</div>
                <div className="spark">
                  {m.bars.map((h, i) => (
                    <span
                      key={i}
                      className={i === m.peak ? "peak" : undefined}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="feed">
          <div className="feed-head">
            <h3>Activity</h3>
            <span className="all">View all →</span>
          </div>
          {FEED.map((ev, i) => (
            <div className="ev" key={i}>
              <div className="ev-rail">
                <div className={`ev-dot ${ev.dot}`} />
              </div>
              <div className="ev-body">
                <div className="ev-text">{ev.text}</div>
                <div className="ev-meta">
                  <span className="ev-mod">{ev.meta}</span>
                </div>
              </div>
            </div>
          ))}
          <div className="health" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
            <span className="chip chip-active">
              <span className="chip-dot" />
              All systems healthy · Onyx + Paperclip · in your VPC
            </span>
            <span style={{ color: "var(--text-faint)" }}>
              12,847 docs indexed · 14 sources syncing ·{" "}
              <Link href="/settings" style={{ color: "var(--text-muted)" }}>
                manage in Settings →
              </Link>
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
