
# Part 3 - Production Incident

If withdrawal API latency increases from 300ms to 11 seconds and users report that money was deducted but not received, I would first focus on stopping further problems and checking where the issue is happening.

## First 10 Minutes - Check the Situation

1. I would check application logs for errors, timeouts and failed withdrawal requests.

2. I would check whether the problem is happening for all users or only some users.

3. I would check MongoDB Atlas metrics:
   - CPU usage
   - Memory usage
   - Database connections
   - Slow queries
   - Disk usage and I/O
   - Replication lag

4. I would also check the payment gateway dashboard to see whether payouts are successful, failed or still pending.

5. I would compare the time of the complaints with the application logs and gateway records using the payout ID.

## Next 10 Minutes - Stop Further Problems

1. If I find that new withdrawal requests are causing duplicate payments or money-related errors, I would temporarily pause new withdrawals.

2. I would inform my senior engineer and the support team about the issue.

3. I would not retry failed or timed-out gateway requests blindly because the payment might already have been successful.

4. I would keep the money reserved for payouts whose gateway status is not clear.

5. I would check whether the database is overloaded or whether the gateway is responding slowly.

## Last 10 Minutes - Find and Handle the Problem

1. I would compare the number of withdrawal requests with the number of successful and failed gateway payouts.

2. For every complaint, I would check its payout ID in our database and verify its status with the payment gateway.

3. If the gateway confirms success, I would update the payout status correctly.

4. If the gateway confirms failure, I would follow the proper reversal process and return the reserved money to the user's wallet.

5. If the gateway status is still unknown, I would keep the payout pending and investigate further. I would not return the money until I confirm that the payout failed.

6. After finding the main issue, I would fix it, test it with a small number of requests and slowly allow withdrawals again.

## What I Would Not Do

- I would not restart the database without understanding the problem.
- I would not blindly retry all failed payouts.
- I would not manually change wallet balances without checking the ledger and gateway records.
- I would not mark pending payouts as failed just because they are taking too long.
- I would not enable all withdrawals again until I am confident that the issue is fixed.

## Final Note

My first priority would be to protect users' money and prevent duplicate payouts. After that, I would find whether the issue is coming from our application, MongoDB or the payment gateway. I would keep the senior engineer and support team updated until all affected payouts are checked and resolved.
