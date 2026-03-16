import {
  Connection,
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { PumpAgent } from "@pump-fun/agent-payments-sdk";

export const AGENT_MINT = new PublicKey(
  process.env.AGENT_TOKEN_MINT_ADDRESS!
);
export const CURRENCY_MINT = new PublicKey(process.env.CURRENCY_MINT!);

// Price range: 0.1 SOL – 0.5 SOL in lamports
const PRICE_MIN = Number(process.env.PRICE_MIN_LAMPORTS ?? 100_000_000);
const PRICE_MAX = Number(process.env.PRICE_MAX_LAMPORTS ?? 500_000_000);

/** Returns a random integer in [min, max] inclusive. */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Random price between 0.1 and 0.5 SOL, rounded to 0.01 SOL increments. */
export function randomPriceLamports(): number {
  // Step in 0.01 SOL = 10_000_000 lamports → gives values like 0.10, 0.11, … 0.50
  const step = 10_000_000;
  const steps = Math.floor((PRICE_MAX - PRICE_MIN) / step);
  return PRICE_MIN + randomInt(0, steps) * step;
}

export function lamportsToSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(2);
}

export interface InvoiceParams {
  amount: string;
  memo: string;
  startTime: string;
  endTime: string;
  priceSol: string;
}

export function generateInvoiceParams(): InvoiceParams {
  const amount = String(randomPriceLamports());
  const memo = String(Math.floor(Math.random() * 900_000_000_000) + 100_000);
  const now = Math.floor(Date.now() / 1000);
  const startTime = String(now);
  const endTime = String(now + 86_400); // 24 hours
  const priceSol = lamportsToSol(Number(amount));
  return { amount, memo, startTime, endTime, priceSol };
}

export async function buildPaymentTransaction(params: {
  userWallet: string;
  amount: string;
  memo: string;
  startTime: string;
  endTime: string;
}): Promise<string> {
  const connection = new Connection(process.env.SOLANA_RPC_URL!);
  const agent = new PumpAgent(AGENT_MINT, "mainnet", connection);
  const userPublicKey = new PublicKey(params.userWallet);

  const instructions = await agent.buildAcceptPaymentInstructions({
    user: userPublicKey,
    currencyMint: CURRENCY_MINT,
    amount: params.amount,
    memo: params.memo,
    startTime: params.startTime,
    endTime: params.endTime,
  });

  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.feePayer = userPublicKey;
  tx.add(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
    ...instructions
  );

  return tx.serialize({ requireAllSignatures: false }).toString("base64");
}

export async function verifyPaymentWithRetry(params: {
  user: string;
  amount: number;
  memo: number;
  startTime: number;
  endTime: number;
}): Promise<boolean> {
  const agent = new PumpAgent(AGENT_MINT);

  const invoiceParams = {
    user: new PublicKey(params.user),
    currencyMint: CURRENCY_MINT,
    amount: params.amount,
    memo: params.memo,
    startTime: params.startTime,
    endTime: params.endTime,
  };

  for (let attempt = 0; attempt < 10; attempt++) {
    const verified = await agent.validateInvoicePayment(invoiceParams);
    if (verified) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }

  return false;
}
