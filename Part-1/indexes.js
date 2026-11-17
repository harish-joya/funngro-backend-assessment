
// One payout per user for each idempotency key
PayoutSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true }
);

// Avoid duplicate ledger entries for the same payout event
LedgerSchema.index(
  { payoutId: 1, type: 1 },
  { unique: true }
);

// Avoid duplicate outbox events for the same payout
OutboxSchema.index(
  { payoutId: 1, eventType: 1 },
  { unique: true }
);

// Find a user's latest ledger entries
LedgerSchema.index(
  { userId: 1, createdAt: -1 }
);
