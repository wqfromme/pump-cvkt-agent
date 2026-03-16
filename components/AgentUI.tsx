"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { signAndSendPayment } from "@/lib/client-payments";

type Stage =
  | "idle"
  | "building"
  | "signing"
  | "verifying"
  | "done"
  | "error";

interface Invoice {
  amount: string;
  memo: string;
  startTime: string;
  endTime: string;
  priceSol: string;
}

const STAGE_MESSAGES: Partial<Record<Stage, string>> = {
  building:  "Building transaction…",
  signing:   "Waiting for wallet approval…",
  verifying: "Verifying payment on-chain…",
};

export default function AgentUI() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  const [prompt, setPrompt]   = useState("");
  const [stage, setStage]     = useState<Stage>("idle");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [txSig, setTxSig]     = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const busy = !["idle", "done", "error"].includes(stage);

  // ── Single action: build tx → sign → verify → deliver ───────────────────
  async function handlePay() {
    if (!publicKey || !signTransaction) return;
    setStage("building");
    setError(null);
    setInvoice(null);
    setResponse(null);
    setTxSig(null);

    try {
      // Build transaction server-side
      const res = await fetch("/api/build-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userWallet: publicKey.toBase58() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const { transaction, invoice: inv } = await res.json();
      setInvoice(inv);

      // Sign & send immediately
      setStage("signing");
      const sig = await signAndSendPayment(transaction, signTransaction, connection);
      setTxSig(sig);

      // Verify on-chain then deliver
      setStage("verifying");
      const verifyRes = await fetch("/api/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: publicKey.toBase58(),
          amount: inv.amount,
          memo: inv.memo,
          startTime: inv.startTime,
          endTime: inv.endTime,
          prompt: prompt.trim() || undefined,
        }),
      });
      if (!verifyRes.ok) throw new Error((await verifyRes.json()).error);
      const result = await verifyRes.json();
      setResponse(result.response);
      setStage("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStage("error");
    }
  }

  function reset() {
    setStage("idle");
    setInvoice(null);
    setResponse(null);
    setTxSig(null);
    setError(null);
    setPrompt("");
  }

  return (
    <main className="root">
      <div className="bg-grid" />

      {/* ── Header ── */}
      <header className="header">
        <span className="hex">⬡</span>
        <h1>CVKT Agent</h1>
        <p className="tagline">AI answers · 0.10 – 0.50 SOL per request</p>
        <div className="wallet-row">
          <WalletMultiButton />
        </div>
      </header>

      {/* ── Card ── */}
      <div className="card">

        {/* Prompt input */}
        <label className="field-label" htmlFor="prompt">Your question</label>
        <textarea
          id="prompt"
          className="textarea"
          rows={4}
          placeholder="Ask anything — or leave blank for a Solana insight."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={busy || stage === "building"}
        />

        {/* ── Idle / Error: single Pay button ── */}
        {(stage === "idle" || stage === "error") && (
          <button
            className="btn btn-primary"
            onClick={handlePay}
            disabled={!publicKey}
          >
            {!publicKey ? "Connect wallet first" : "Pay & run →"}
          </button>
        )}

        {/* ── Busy spinner ── */}
        {busy && stage !== "building" && (
          <div className="status">
            <span className="spinner" />
            {STAGE_MESSAGES[stage]}
          </div>
        )}

        {/* ── Error ── */}
        {stage === "error" && error && (
          <div className="alert-error">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* ── Done ── */}
        {stage === "done" && response && (
          <div className="result">
            <div className="result-header">
              <span className="check">✓</span>
              <span>Response</span>
              {txSig && (
                <a
                  className="tx-link"
                  href={`https://solscan.io/tx/${txSig}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View tx ↗
                </a>
              )}
            </div>
            <p className="result-body">{response}</p>
            <button className="btn btn-ghost" onClick={reset}>
              Ask another
            </button>
          </div>
        )}
      </div>

      <footer className="footer">
        Powered by{" "}
        <a href="https://pump.fun" target="_blank" rel="noopener noreferrer">
          pump.fun
        </a>{" "}
        · Solana mainnet-beta
      </footer>

      {/* ── Styles ── */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Bricolage+Grotesque:wght@400;600;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg:        #07080f;
          --surface:   #0d0f1c;
          --border:    #1a1d2e;
          --accent:    #5dffa0;
          --accent2:   #5d9fff;
          --text:      #e2e4f0;
          --muted:     #505570;
          --error:     #ff6b6b;
          --radius:    14px;
          --ff-head:   'Bricolage Grotesque', sans-serif;
          --ff-mono:   'DM Mono', monospace;
        }

        html, body { background: var(--bg); color: var(--text); font-family: var(--ff-head); min-height: 100vh; }

        .root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 2.5rem 1rem 5rem;
          position: relative;
          overflow: hidden;
        }

        /* subtle grid background */
        .bg-grid {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background-image:
            linear-gradient(rgba(93,255,160,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(93,255,160,0.03) 1px, transparent 1px);
          background-size: 40px 40px;
        }

        .root > * { position: relative; z-index: 1; }

        /* ── Header ── */
        .header {
          text-align: center;
          margin-bottom: 2.5rem;
          animation: fadeUp .5s ease both;
        }

        .hex {
          display: block;
          font-size: 2.8rem;
          color: var(--accent);
          filter: drop-shadow(0 0 12px var(--accent));
          animation: glow 3s ease-in-out infinite;
          margin-bottom: .4rem;
        }

        @keyframes glow {
          0%,100% { filter: drop-shadow(0 0 8px var(--accent)); }
          50%      { filter: drop-shadow(0 0 22px var(--accent)); }
        }

        .header h1 {
          font-size: clamp(2.2rem, 6vw, 4rem);
          font-weight: 800;
          letter-spacing: -.03em;
        }

        .tagline {
          font-family: var(--ff-mono);
          font-size: .72rem;
          color: var(--muted);
          letter-spacing: .1em;
          margin-top: .35rem;
        }

        .wallet-row {
          margin-top: 1.1rem;
          display: flex;
          justify-content: center;
        }

        /* wallet button overrides */
        .wallet-adapter-button {
          font-family: var(--ff-mono) !important;
          font-size: .72rem !important;
          background: var(--surface) !important;
          border: 1px solid var(--border) !important;
          color: var(--text) !important;
          border-radius: 10px !important;
          padding: .45rem 1.1rem !important;
          height: auto !important;
          transition: border-color .2s !important;
        }
        .wallet-adapter-button:hover {
          border-color: var(--accent) !important;
          background: var(--surface) !important;
        }

        /* ── Card ── */
        .card {
          width: 100%;
          max-width: 580px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1.8rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          animation: fadeUp .5s .1s ease both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .field-label {
          font-family: var(--ff-mono);
          font-size: .66rem;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: var(--muted);
        }

        .textarea {
          width: 100%;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text);
          font-family: var(--ff-head);
          font-size: .93rem;
          line-height: 1.6;
          padding: .85rem 1rem;
          resize: vertical;
          outline: none;
          transition: border-color .2s;
        }
        .textarea:focus { border-color: var(--accent); }
        .textarea::placeholder { color: var(--muted); }
        .textarea:disabled { opacity: .45; cursor: not-allowed; }

        /* ── Buttons ── */
        .btn {
          font-family: var(--ff-mono);
          font-size: .75rem;
          font-weight: 500;
          letter-spacing: .06em;
          text-transform: uppercase;
          border: none;
          border-radius: 8px;
          padding: .8rem 1.4rem;
          cursor: pointer;
          transition: opacity .2s, transform .15s;
        }
        .btn:hover:not(:disabled) { opacity: .88; transform: translateY(-1px); }
        .btn:active:not(:disabled) { transform: translateY(0); }
        .btn:disabled { opacity: .3; cursor: not-allowed; }

        .btn-primary {
          background: var(--accent);
          color: #07080f;
        }

        .btn-ghost {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--muted);
        }
        .btn-ghost:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); opacity: 1; }

        /* ── Quote box ── */
        .quote-box {
          background: rgba(93,255,160,.04);
          border: 1px solid rgba(93,255,160,.18);
          border-radius: 10px;
          padding: 1.2rem 1.3rem;
          display: flex;
          flex-direction: column;
          gap: .5rem;
          animation: fadeUp .3s ease both;
        }

        .quote-label {
          font-family: var(--ff-mono);
          font-size: .65rem;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: var(--muted);
        }

        .quote-price {
          font-size: 2.4rem;
          font-weight: 800;
          letter-spacing: -.03em;
          color: var(--accent);
          line-height: 1;
        }

        .quote-sub {
          font-family: var(--ff-mono);
          font-size: .65rem;
          color: var(--muted);
        }

        .quote-actions {
          display: flex;
          gap: .7rem;
          margin-top: .4rem;
          flex-wrap: wrap;
        }

        .quote-actions .btn-primary { flex: 1; }

        /* ── Status ── */
        .status {
          display: flex;
          align-items: center;
          gap: .6rem;
          font-family: var(--ff-mono);
          font-size: .72rem;
          color: var(--muted);
        }

        .spinner {
          width: 13px; height: 13px;
          border: 2px solid var(--border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin .7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Error ── */
        .alert-error {
          background: rgba(255,107,107,.07);
          border: 1px solid rgba(255,107,107,.22);
          border-radius: 8px;
          padding: .8rem 1rem;
          font-size: .85rem;
          color: var(--error);
          line-height: 1.5;
        }

        /* ── Result ── */
        .result {
          background: rgba(93,159,255,.04);
          border: 1px solid rgba(93,159,255,.16);
          border-radius: 10px;
          padding: 1.1rem 1.2rem;
          display: flex;
          flex-direction: column;
          gap: .8rem;
          animation: fadeUp .35s ease both;
        }

        .result-header {
          display: flex;
          align-items: center;
          gap: .45rem;
          font-family: var(--ff-mono);
          font-size: .65rem;
          letter-spacing: .1em;
          text-transform: uppercase;
          color: var(--accent2);
        }

        .check { font-size: .85rem; }

        .tx-link {
          margin-left: auto;
          color: var(--muted);
          text-decoration: none;
          transition: color .2s;
        }
        .tx-link:hover { color: var(--accent2); }

        .result-body {
          font-size: .93rem;
          line-height: 1.75;
          color: var(--text);
          white-space: pre-wrap;
        }

        /* ── Footer ── */
        .footer {
          margin-top: 2.5rem;
          font-family: var(--ff-mono);
          font-size: .66rem;
          color: var(--muted);
          letter-spacing: .06em;
        }
        .footer a { color: var(--muted); text-decoration: none; }
        .footer a:hover { color: var(--accent); }
      `}</style>
    </main>
  );
}
