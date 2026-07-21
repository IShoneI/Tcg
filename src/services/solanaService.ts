/**
 * Get how many days the current owner has held this NFT.
 * Uses Helius parsed transaction history.
 */
export async function getHoldTimeDays(mintAddress: string): Promise<number> {
  return (await batchGetHoldTimes([mintAddress])).get(mintAddress) ?? 0;
}

/**
 * Batch hold time lookups with concurrency control.
 * Returns Map<mintAddress, holdDays>.
 */
export async function batchGetHoldTimes(
  mintAddresses: string[],
  concurrency: number = 5
): Promise<Map<string, number>> {
  void concurrency;
  const response = await fetch("/api/hold-times", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mintAddresses }),
  });
  if (!response.ok) throw new Error(`Hold-time request failed (${response.status})`);
  const payload = await response.json();
  return new Map(Object.entries(payload.holdTimes) as Array<[string, number]>);
}
