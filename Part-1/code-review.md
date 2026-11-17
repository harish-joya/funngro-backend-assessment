# Part 1: Code Review of Withdrawal Handler

After reviewing the given code, I found several problems that can cause money-related issues, duplicate payments, and performance problems. I have listed them below, starting with the most serious ones.

## 1. Race Condition in Wallet Balance — Critical

**Problem:** The code first checks the wallet balance and then updates it separately. If two withdrawal requests come at almost the same time, both requests can read the same balance before either one updates it.

**Example:** Suppose a user has ₹1,000 in their wallet. They send two withdrawal requests of ₹700 at the same time. Both requests may pass the balance check, so the user could receive ₹1,400 even though they only had ₹1,000.

**Solution:** We should use an atomic database update or a MongoDB transaction. The balance should only be reduced if the latest available balance is enough.

## 2. No Protection Against Duplicate Requests — Critical

**Problem:** There is no idempotency check in the code. The mobile app retries a request if it does not receive a response. This can create the same withdrawal more than once.

**Example:** Suppose a withdrawal is successful, but the mobile app does not receive the response because of a network problem. The app sends the same request again, and the user may receive the money twice.

**Solution:** Every withdrawal should have a unique idempotency key. We should save this key with the withdrawal record and create a unique index on `userId` and `idempotencyKey`. If the same request comes again, we should return the previous result instead of creating another payout.

## 3. Money Is Deducted Before Confirming the Payout — Critical

**Problem:** The wallet balance is reduced before checking whether the payment gateway has successfully transferred the money.

**Example:** The wallet balance is reduced, but the gateway rejects the bank transfer. In this situation, the user loses money from their wallet without receiving it in their bank account.

**Solution:** We should maintain payout statuses such as `pending`, `processing`, `success`, and `failed`. First, reserve the withdrawal amount. Once the gateway confirms success, complete the deduction. If the gateway confirms failure, release the reserved amount.

## 4. Missing `await` in Gateway Call — Critical

**Problem:** The code calls `gateway.createPayout()` without using `await`. This means the function does not wait for the gateway response. Also, the `try/catch` may not catch errors from the asynchronous operation.

**Example:** The code may continue and insert a ledger record even if the gateway request later fails.

**Solution:** We should use `await` when calling the gateway and handle its response properly. In a production system, I would prefer processing payouts through a background worker so that gateway delays do not block the API request.

## 5. Wallet Update and Ledger Entry Are Separate — High

**Problem:** The wallet balance is updated first, and the ledger entry is created afterwards. If the second operation fails, the wallet balance and transaction history will not match.

**Example:** The user's balance gets reduced, but the ledger record is not saved because of a database error.

**Solution:** We should use a MongoDB transaction to make related database changes together. If one operation fails, the transaction should be rolled back.

## 6. User ID Is Taken Directly From Request Body — High

**Problem:** The code takes `userId` from `req.body`. This is not safe because a user can change the ID in the request.

**Example:** A user could try sending another person's user ID and attempt to withdraw money from their wallet.

**Solution:** We should get the user ID from authenticated information, such as `req.user.id`, instead of trusting the value sent by the client.

## 7. No Proper Validation of Withdrawal Amount — High

**Problem:** The code does not check whether the amount is valid. It does not prevent negative values, zero, or invalid amounts.

**Example:** If someone sends a negative withdrawal amount, subtracting it from the wallet balance can actually increase the balance.

**Solution:** We should check that the amount is a valid positive number and apply minimum and maximum withdrawal limits. For money calculations, we should store amounts in integer paise instead of using floating-point values.

## 8. Wallet Existence Is Not Checked — Medium

**Problem:** The code checks whether the user exists, but it does not check whether the user's wallet exists before accessing `wallet.balance`.

**Example:** If a user exists but their wallet has not been created, the code will throw an error when it tries to read the balance.

**Solution:** We should check whether the wallet exists and return a proper error if it is not found.

## 9. No Proper Payout Status Tracking — High

**Problem:** The code does not maintain the status of a withdrawal. It cannot clearly identify whether a payout is successful, failed, or still being processed.

**Example:** The gateway may process the payment, but our API may receive a timeout. If we retry without checking the gateway, the user might receive the money twice.

**Solution:** We should save every payout with a unique reference and its current status. If the gateway response is unclear, we should first check the payout status with the gateway before retrying or releasing the reserved money.

## 10. Transaction History Query Can Be Slow — High

**Problem:** The code fetches the user's complete transaction history every time they make a withdrawal. Also, the Ledger collection has around 40 million documents and does not have an index for this query.

**Example:** If a user has thousands of transactions, fetching and sorting all of them can make the API very slow and consume more memory.

**Solution:** We should create a compound index on `{ userId: 1, createdAt: -1 }` because we frequently search transactions by user and sort them by date. We should also use pagination or return only the latest few transactions.

## 11. Withdrawal Reference May Not Be Unique — Medium

**Problem:** The code uses `Date.now()` to generate the withdrawal reference. Two requests made within the same millisecond could get the same reference.

**Example:** If two withdrawals receive the same reference, it can become difficult to identify and track the correct payment.

**Solution:** We should generate a unique ID using UUID or MongoDB ObjectId and use it as the withdrawal reference.

## 12. Error Handling Is Not Proper — Medium

**Problem:** The code only logs gateway errors. It does not properly handle database errors or other unexpected failures. It also returns the complete transaction history in the response.

**Example:** If a database operation fails after the wallet balance is updated, the API may return an error without clearly telling the client what happened to the withdrawal.

**Solution:** We should use proper error handling and save useful information in application logs. The API should return a clear withdrawal status and reference ID instead of the complete transaction history.

---

## Overall Changes I Would Make

I would not use this withdrawal flow directly in a production application because it handles real money and has several safety issues. First, I would make wallet updates safe using atomic operations and add idempotency to prevent duplicate withdrawals. I would also maintain proper payout statuses and use MongoDB transactions to keep wallet and ledger data consistent. Finally, I would add the required indexes and pagination to improve performance as the number of users and transactions increases.