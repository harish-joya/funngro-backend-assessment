
# Part 2 - Database Design

## 1. MongoDB Collections

I would use four collections to store and manage reward points.

### A. PointBalances

This collection stores how many points a user currently has.

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  availablePoints: Number,
  updatedAt: Date
}
```

### B. PointLedger

This collection stores all points transactions, such as earned, converted and expired points.

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  type: String, // earned, converted, expired
  points: Number,
  sourceId: String,
  cohort: String,
  conversionId: ObjectId,
  createdAt: Date
}
```

I will keep all these records so that we can check the transaction history whenever needed.

### C. ConversionRates

This collection stores how much cash a user gets for their points.

```javascript
{
  _id: ObjectId,
  pointsRequired: Number,
  cashAmountPaise: Number,
  effectiveFrom: Date,
  createdAt: Date
}
```

For example, 100 points may be equal to ₹10. If the rate changes, I will add a new record instead of changing the old one.

### D. PointConversions

This collection stores the details of every points-to-cash conversion.

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  pointsUsed: Number,
  cashAmountPaise: Number,
  conversionRateId: ObjectId,
  idempotencyKey: String,
  status: String, // pending, success, failed
  createdAt: Date
}
```

---

## 2. Indexes and Their Purpose

```javascript
// Each user should have only one balance record
PointBalanceSchema.index(
  { userId: 1 },
  { unique: true }
);

// Get the transaction history of a user
PointLedgerSchema.index(
  { userId: 1, createdAt: -1 }
);

// Find records for monthly reports
PointLedgerSchema.index(
  { createdAt: 1, cohort: 1, userId: 1 }
);

// Avoid adding the same earning or expiry event twice
PointLedgerSchema.index(
  { type: 1, sourceId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceId: { $type: "string" }
    }
  }
);

// Find the conversion rate for a particular date
ConversionRateSchema.index(
  { effectiveFrom: -1 }
);

// Avoid processing the same conversion request twice
PointConversionSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true }
);
```

---

## 3. How I Prevent Double Conversion

I would use a MongoDB transaction when a user converts points into cash.

First, I will check if the user has enough points. Then I will reduce the points using an atomic update, so two requests cannot use the same points at the same time.

I will also save the conversion details and add a record to the points ledger in the same transaction. If something goes wrong, all the changes will be cancelled.

Finally, I will use a unique idempotency key for every request. This will stop the same request from being processed twice if the mobile app sends it again.
