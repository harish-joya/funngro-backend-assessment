
const mongoose = require("mongoose");

// Models assumed to be already created
// Wallets, Payouts, Ledger and Outbox


// Withdraw money from wallet
async function withdraw(req, res) {
  const userId = req.user.id;
  const amount = req.body.amountPaise;
  const key = req.headers["idempotency-key"];

  // Check amount
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return res.status(400).json({
      error: "Invalid amount"
    });
  }

  // Check idempotency key
  if (!key || typeof key !== "string") {
    return res.status(400).json({
      error: "Idempotency key is required"
    });
  }

  try {
    // Check if this request was already made
    const oldPayout = await Payouts.findOne({
      userId: userId,
      idempotencyKey: key
    });

    if (oldPayout) {
      if (oldPayout.amountPaise !== amount) {
        return res.status(409).json({
          error: "This key was already used with another amount"
        });
      }

      return res.status(200).json({
        message: "Request already exists",
        payoutId: oldPayout._id,
        status: oldPayout.status
      });
    }

    const session = await mongoose.startSession();
    const payoutId = new mongoose.Types.ObjectId();

    try {
      await session.withTransaction(async () => {

        // Check balance and reserve money
        const wallet = await Wallets.findOneAndUpdate(
          {
            userId: userId,
            availableBalance: { $gte: amount }
          },
          {
            $inc: {
              availableBalance: -amount,
              reservedBalance: amount
            }
          },
          {
            new: true,
            session: session
          }
        );

        if (!wallet) {
          throw new Error("INSUFFICIENT_BALANCE");
        }

        // Create payout record
        await Payouts.create([{
          _id: payoutId,
          userId: userId,
          amountPaise: amount,
          idempotencyKey: key,
          status: "pending",
          createdAt: new Date()
        }], { session });

        // Add entry in ledger
        await Ledger.create([{
          userId: userId,
          payoutId: payoutId,
          type: "withdrawal_reserved",
          amountPaise: amount,
          createdAt: new Date()
        }], { session });

        // Add event for background worker
        await Outbox.create([{
          payoutId: payoutId,
          eventType: "PROCESS_PAYOUT",
          status: "pending",
          createdAt: new Date()
        }], { session });

      });

    } finally {
      await session.endSession();
    }

    return res.status(202).json({
      message: "Withdrawal request accepted",
      payoutId: payoutId,
      status: "pending"
    });

  } catch (error) {

    // Handle duplicate requests
    if (error.code === 11000) {
      const oldPayout = await Payouts.findOne({
        userId: userId,
        idempotencyKey: key
      });

      if (oldPayout) {
        if (oldPayout.amountPaise !== amount) {
          return res.status(409).json({
            error: "Idempotency key already used with another amount"
          });
        }

        return res.status(200).json({
          message: "Request already exists",
          payoutId: oldPayout._id,
          status: oldPayout.status
        });
      }
    }

    if (error.message === "INSUFFICIENT_BALANCE") {
      return res.status(400).json({
        error: "Insufficient balance"
      });
    }

    console.log("Withdrawal error:", error);

    return res.status(500).json({
      error: "Something went wrong"
    });
  }
}


// Background worker - pseudocode
/*
1. Get a pending event from Outbox.

2. Mark the payout as processing using a database update
   that only succeeds if its current status is pending.

3. Get the user's verified bank account.

4. Send the payout request to the payment gateway.
   Use payoutId as the unique gateway reference.

5. If the gateway confirms success:
   Call completePayout(payoutId).

6. If the gateway confirms failure:
   Call failPayout(payoutId).

7. If the gateway times out:
   Keep the money reserved.
   Check the payout status with the gateway.
   Do not blindly send another payout.

8. Mark the outbox event as completed after processing.
*/


// Complete a successful payout
async function completePayout(payoutId) {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {

      // Change payout status only once
      const payout = await Payouts.findOneAndUpdate(
        {
          _id: payoutId,
          status: "processing"
        },
        {
          $set: {
            status: "success",
            completedAt: new Date()
          }
        },
        {
          new: true,
          session: session
        }
      );

      if (!payout) {
        return;
      }

      // Remove money from reserved balance
      const result = await Wallets.updateOne(
        {
          userId: payout.userId,
          reservedBalance: { $gte: payout.amountPaise }
        },
        {
          $inc: {
            reservedBalance: -payout.amountPaise
          }
        },
        { session }
      );

      if (result.modifiedCount !== 1) {
        throw new Error("Reserved balance not found");
      }

      // Add success entry in ledger
      await Ledger.create([{
        userId: payout.userId,
        payoutId: payout._id,
        type: "withdrawal_completed",
        amountPaise: payout.amountPaise,
        createdAt: new Date()
      }], { session });

    });

  } finally {
    await session.endSession();
  }
}


// Handle a failed payout
async function failPayout(payoutId) {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {

      // Change payout status only once
      const payout = await Payouts.findOneAndUpdate(
        {
          _id: payoutId,
          status: "processing"
        },
        {
          $set: {
            status: "failed",
            failedAt: new Date()
          }
        },
        {
          new: true,
          session: session
        }
      );

      if (!payout) {
        return;
      }

      // Return reserved money to available balance
      const result = await Wallets.updateOne(
        {
          userId: payout.userId,
          reservedBalance: { $gte: payout.amountPaise }
        },
        {
          $inc: {
            reservedBalance: -payout.amountPaise,
            availableBalance: payout.amountPaise
          }
        },
        { session }
      );

      if (result.modifiedCount !== 1) {
        throw new Error("Reserved balance not found");
      }

      // Add reversal entry in ledger
      await Ledger.create([{
        userId: payout.userId,
        payoutId: payout._id,
        type: "withdrawal_reversed",
        amountPaise: payout.amountPaise,
        createdAt: new Date()
      }], { session });

    });

  } finally {
    await session.endSession();
  }
}


module.exports = {
  withdraw,
  completePayout,
  failPayout
};
