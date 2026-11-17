# Funngro Backend Engineer – Take-Home Assessment

This repository contains my solutions for the Funngro Backend Engineer take-home assessment.

I have divided the assignment into four parts.

## Project Structure

```text
Funngro-Backend-Assessment/
│
├── README.md
│
├── Part-1/
│   ├── code-review.md
│   ├── withdrawal.js
│   └── indexes.js
│
├── Part-2/
│   ├── database-design.md
│   └── monthly-report.js
│
├── Part-3/
│   └── incident-response.md
│
└── Part-4/
    └── walkthrough.mp4
```

## Parts Overview

### Part 1 – Withdrawal API
Reviewed the existing withdrawal API, identified the main issues, and rewrote the withdrawal logic with a focus on preventing duplicate withdrawals and keeping wallet balances safe.

### Part 2 – Database Design
Designed MongoDB collections for reward points, added indexes, and created an aggregation query for the monthly report.

### Part 3 – Incident Response
Explained the steps I would take to investigate and handle high API latency and withdrawal-related issues.

### Part 4 – Walkthrough
Contains a video explaining my approach and the important parts of my solution.

## Note

The withdrawal worker is provided as pseudocode because its actual implementation depends on the payment gateway and queue infrastructure.

The code assumes that the required MongoDB models, authentication middleware, indexes, and database transaction support are configured.

Thank you for reviewing my submission.