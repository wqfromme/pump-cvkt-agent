"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { signAndSendPayment } from "@/lib/client-payments";

type Stage = "idle" | "building" | "signing" | "verifying" | "done" | "error";

interface Invoice {
  amount: string;
  memo: string;
  startTime: string;
  endTime: string;
  priceSol: string;
}

const STAGE_MESSAGES: Partial<Record<Stage, string>> = {
  building:  "Charmander is warming up…",
  signing:   "Waiting for trainer approval…",
  verifying: "Verifying on-chain…",
};

export default function AgentUI() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  const [prompt, setPrompt]     = useState("");
  const [stage, setStage]       = useState<Stage>("idle");
  const [invoice, setInvoice]   = useState<Invoice | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [txSig, setTxSig]       = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const busy = !["idle", "done", "error"].includes(stage);

  async function handlePay() {
    if (!publicKey || !signTransaction) return;
    setStage("building");
    setError(null);
    setInvoice(null);
    setResponse(null);
    setTxSig(null);

    try {
      const res = await fetch("/api/build-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userWallet: publicKey.toBase58() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const { transaction, invoice: inv } = await res.json();
      setInvoice(inv);

      setStage("signing");
      const sig = await signAndSendPayment(transaction, signTransaction, connection);
      setTxSig(sig);

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
      <div className="fire-bg">
        <div className="ember e1" /><div className="ember e2" /><div className="ember e3" />
        <div className="ember e4" /><div className="ember e5" /><div className="ember e6" />
      </div>

      <header className="header">
        <div className="charmander">
          <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" width="100" height="100">
            <ellipse cx="40" cy="50" rx="18" ry="20" fill="#FF6B35"/>
            <ellipse cx="40" cy="53" rx="11" ry="13" fill="#FFCC99"/>
            <circle cx="40" cy="28" r="16" fill="#FF6B35"/>
            <circle cx="34" cy="25" r="4" fill="white"/>
            <circle cx="46" cy="25" r="4" fill="white"/>
            <circle cx="35" cy="26" r="2.5" fill="#1a1a2e"/>
            <circle cx="47" cy="26" r="2.5" fill="#1a1a2e"/>
            <circle cx="35.8" cy="25.2" r="1" fill="white"/>
            <circle cx="47.8" cy="25.2" r="1" fill="white"/>
            <circle cx="38" cy="30" r="1" fill="#cc4400"/>
            <circle cx="42" cy="30" r="1" fill="#cc4400"/>
            <path d="M36 33 Q40 37 44 33" stroke="#cc4400" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            <ellipse cx="22" cy="48" rx="5" ry="8" fill="#FF6B35" transform="rotate(-20 22 48)"/>
            <ellipse cx="58" cy="48" rx="5" ry="8" fill="#FF6B35" transform="rotate(20 58 48)"/>
            <ellipse cx="32" cy="68" rx="6" ry="8" fill="#FF6B35"/>
            <ellipse cx="48" cy="68" rx="6" ry="8" fill="#FF6B35"/>
            <path d="M58 62 Q72 55 68 42 Q65 35 70 28" stroke="#FF6B35" strokeWidth="7" fill="none" strokeLinecap="round"/>
            <ellipse cx="71" cy="24" rx="5" ry="8" fill="#FFD700" transform="rotate(15 71 24)"/>
            <ellipse cx="71" cy="24" rx="3" ry="5" fill="#FF8C00" transform="rotate(15 71 24)"/>
            <ellipse cx="71" cy="26" rx="1.5" ry="3" fill="#FF4500" transform="rotate(15 71 24)"/>
          </svg>
        </div>
        <h1>Charmander Agent</h1>
        <p className="tagline">🔥 0.01 SOL per battle · Powered by pump.fun</p>
        <div className="wallet-row"><WalletMultiButton /></div>
      </header>

      <div className="card">
        <label className="field-label" htmlFor="prompt">⚔️ Your challenge</label>
        <textarea
          id="prompt"
          className="textarea"
          rows={4}
          placeholder="Ask Charmander anything… or leave blank for a fire-type insight!"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={busy}
        />

        {(stage === "idle" || stage === "error") && (
          <button className="btn btn-primary" onClick={handlePay} disabled={!publicKey}>
            {!publicKey ? "Connect wallet, Trainer!" : "🔥 Use Fire Attack →"}
          </button>
        )}

        {busy && (
          <div className="status">
            <span className="flame-spinner">🔥</span>
            {STAGE_MESSAGES[stage]}
          </div>
        )}

        {stage === "error" && error && (
          <div className="alert-error"><strong>💀 Charmander fainted!</strong> {error}</div>
        )}

        {stage === "done" && response && (
          <div className="result">
            <div className="result-header">
              <span>🏆</span>
              <span>Charmander used FLAMETHROWER!</span>
              {txSig && (
                <a className="tx-link" href={`https://solscan.io/tx/${txSig}`} target="_blank" rel="noopener noreferrer">
                  View tx ↗
                </a>
              )}
            </div>
            {invoice && <div className="price-badge">Paid {invoice.priceSol} SOL</div>}
            <p className="result-body">{response}</p>
            <button className="btn btn-ghost" onClick={reset}>↩ Fight again</button>
          </div>
        )}
      </div>

      <footer className="footer">
        Charmander #004 · Solana mainnet-beta ·{" "}
        <a href="https://pump.fun" target="_blank" rel="noopener noreferrer">pump.fun</a>
      </footer>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Nunito:wght@400;600;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #1a0a00; --surface: #2d1200; --border: #8B3A00;
          --orange: #FF6B35; --yellow: #FFD700; --red: #FF4500;
          --cream: #FFCC99; --text: #FFE8CC; --muted: #996633;
          --error: #ff4444; --radius: 12px;
          --ff-pixel: 'Press Start 2P', monospace;
          --ff-body: 'Nunito', sans-serif;
        }
        html, body { background: var(--bg); color: var(--text); font-family: var(--ff-body); min-height: 100vh; }
        .root { min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 2rem 1rem 5rem; position: relative; overflow: hidden; }
        .fire-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; background: radial-gradient(ellipse at 50% 100%, rgba(255,107,53,0.15) 0%, transparent 70%); }
        .ember { position: absolute; bottom: -20px; width: 8px; height: 8px; border-radius: 50% 50% 30% 30%; animation: rise linear infinite; opacity: 0; }
        .e1 { left: 10%; animation-duration: 4s;   animation-delay: 0s;   width: 6px;  height: 6px;  background: var(--orange); }
        .e2 { left: 25%; animation-duration: 5s;   animation-delay: 1s;   width: 10px; height: 10px; background: var(--yellow); }
        .e3 { left: 45%; animation-duration: 3.5s; animation-delay: 2s;   width: 5px;  height: 5px;  background: var(--red); }
        .e4 { left: 60%; animation-duration: 4.5s; animation-delay: 0.5s; width: 8px;  height: 8px;  background: var(--orange); }
        .e5 { left: 75%; animation-duration: 5.5s; animation-delay: 1.5s; width: 6px;  height: 6px;  background: var(--yellow); }
        .e6 { left: 88%; animation-duration: 3.8s; animation-delay: 2.5s; width: 9px;  height: 9px;  background: var(--red); }
        @keyframes rise { 0% { transform: translateY(0) scale(1); opacity: 0; } 10% { opacity: 1; } 80% { opacity: 0.6; } 100% { transform: translateY(-100vh) translateX(30px) scale(0); opacity: 0; } }
        .root > * { position: relative; z-index: 1; }
        .header { text-align: center; margin-bottom: 2rem; animation: fadeUp .5s ease both; }
        .charmander { display: flex; justify-content: center; margin-bottom: .5rem; filter: drop-shadow(0 0 16px rgba(255,107,53,0.8)); animation: charBob 2s ease-in-out infinite; }
        @keyframes charBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .header h1 { font-family: var(--ff-pixel); font-size: clamp(1rem, 3.5vw, 1.6rem); color: var(--yellow); text-shadow: 3px 3px 0 var(--red), 6px 6px 0 rgba(0,0,0,0.3); line-height: 1.4; }
        .tagline { font-size: .8rem; color: var(--muted); margin-top: .6rem; }
        .wallet-row { margin-top: 1.2rem; display: flex; justify-content: center; }
        .wallet-adapter-button { font-family: var(--ff-pixel) !important; font-size: .55rem !important; background: var(--surface) !important; border: 2px solid var(--border) !important; color: var(--yellow) !important; border-radius: 6px !important; padding: .6rem 1rem !important; height: auto !important; transition: border-color .2s, box-shadow .2s !important; }
        .wallet-adapter-button:hover { border-color: var(--yellow) !important; box-shadow: 0 0 12px rgba(255,215,0,0.4) !important; background: var(--surface) !important; }
        .card { width: 100%; max-width: 580px; background: var(--surface); border: 2px solid var(--border); border-radius: var(--radius); padding: 1.8rem; display: flex; flex-direction: column; gap: 1rem; box-shadow: 0 0 30px rgba(255,107,53,0.15); animation: fadeUp .5s .1s ease both; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .field-label { font-family: var(--ff-pixel); font-size: .55rem; letter-spacing: .08em; color: var(--orange); }
        .textarea { width: 100%; background: #0d0500; border: 2px solid var(--border); border-radius: 8px; color: var(--text); font-family: var(--ff-body); font-size: .93rem; line-height: 1.6; padding: .85rem 1rem; resize: vertical; outline: none; transition: border-color .2s, box-shadow .2s; }
        .textarea:focus { border-color: var(--orange); box-shadow: 0 0 10px rgba(255,107,53,0.3); }
        .textarea::placeholder { color: var(--muted); }
        .textarea:disabled { opacity: .45; cursor: not-allowed; }
        .btn { font-family: var(--ff-pixel); font-size: .6rem; border: none; border-radius: 6px; padding: .9rem 1.4rem; cursor: pointer; transition: transform .15s, box-shadow .2s; line-height: 1.6; }
        .btn:hover:not(:disabled) { transform: translateY(-2px); }
        .btn:active:not(:disabled) { transform: translateY(1px); }
        .btn:disabled { opacity: .3; cursor: not-allowed; }
        .btn-primary { background: linear-gradient(135deg, var(--orange), var(--red)); color: #fff; box-shadow: 0 4px 0 #8B1A00, 0 6px 12px rgba(255,69,0,0.4); }
        .btn-primary:hover:not(:disabled) { box-shadow: 0 6px 0 #8B1A00, 0 8px 20px rgba(255,69,0,0.5); }
        .btn-ghost { background: transparent; border: 2px solid var(--border); color: var(--muted); }
        .btn-ghost:hover:not(:disabled) { border-color: var(--orange); color: var(--orange); }
        .status { display: flex; align-items: center; gap: .7rem; font-family: var(--ff-pixel); font-size: .55rem; color: var(--orange); line-height: 1.8; }
        .flame-spinner { font-size: 1.2rem; animation: flamePulse .6s ease-in-out infinite alternate; }
        @keyframes flamePulse { from { transform: scale(1) rotate(-5deg); } to { transform: scale(1.3) rotate(5deg); } }
        .alert-error { background: rgba(255,68,68,.08); border: 2px solid rgba(255,68,68,.3); border-radius: 8px; padding: .9rem 1rem; font-size: .85rem; color: var(--error); line-height: 1.5; }
        .result { background: rgba(255,107,53,.06); border: 2px solid rgba(255,107,53,.3); border-radius: 10px; padding: 1.2rem; display: flex; flex-direction: column; gap: .85rem; animation: fadeUp .35s ease both; }
        .result-header { display: flex; align-items: center; gap: .5rem; font-family: var(--ff-pixel); font-size: .55rem; color: var(--yellow); line-height: 1.8; flex-wrap: wrap; }
        .price-badge { display: inline-block; background: rgba(255,215,0,.12); border: 1px solid rgba(255,215,0,.3); border-radius: 20px; padding: .2rem .8rem; font-family: var(--ff-pixel); font-size: .5rem; color: var(--yellow); align-self: flex-start; }
        .tx-link { margin-left: auto; color: var(--muted); text-decoration: none; font-family: var(--ff-body); font-size: .75rem; transition: color .2s; }
        .tx-link:hover { color: var(--yellow); }
        .result-body { font-size: .95rem; line-height: 1.75; color: var(--text); white-space: pre-wrap; }
        .footer { margin-top: 2.5rem; font-family: var(--ff-pixel); font-size: .45rem; color: var(--muted); letter-spacing: .06em; line-height: 2; text-align: center; }
        .footer a { color: var(--muted); text-decoration: none; }
        .footer a:hover { color: var(--orange); }
      `}</style>
    </main>
  );
}
