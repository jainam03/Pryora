# PRYORA Firebase Security Specification

## 1. Data Invariants
- Each user's financial domain state is strictly sandboxed under `/users/{userId}/**`.
- No user can read, list, create, update, or delete any account, transaction, category, budget, goal, or recurring rule belonging to another user.
- Document IDs must conform to `isValidId()` (alphanumeric with dashes/underscores, maximum 128 characters).
- Transactions must have a valid `type` in `['expense', 'income', 'transfer', 'refund', 'reimbursement']`.
- Account types must be in `['checking', 'savings', 'cash', 'credit_card', 'wallet', 'investment', 'loan', 'other']`.
- All writes require authenticated user matching the path userId (`request.auth.uid == userId`).

## 2. The "Dirty Dozen" Threat Payloads
1. **Orphaned Account Creation**: Write to `/users/alice/accounts/acc_1` with `request.auth.uid = "bob"`. (Expect: PERMISSION_DENIED).
2. **Transaction Poisoning**: Write transaction with amount = -50000 into another user's ledger. (Expect: PERMISSION_DENIED).
3. **Ghost Field Injection**: Attempt to create an account with an unexpected field `isAdmin: true`. (Expect: PERMISSION_DENIED).
4. **Id Injection / Buffer Overflow**: Pass document ID with 500 characters of junk to cause DoS. (Expect: PERMISSION_DENIED).
5. **Cross-User Query Scraping**: Issue `list` on `/users/{userId}/transactions` for another user's `userId`. (Expect: PERMISSION_DENIED).
6. **Immutable Field Tampering**: Update a transaction and change `createdAt` or `userId`. (Expect: PERMISSION_DENIED).
7. **Unverified Email Bypass**: Anonymous or spoofed write without authentication. (Expect: PERMISSION_DENIED).
8. **Invalid Enum Attack**: Create account with type `"swiss_bank_vault_hacked"`. (Expect: PERMISSION_DENIED).
9. **Negative Credit Limit**: Create a credit card account with invalid string credit limit. (Expect: PERMISSION_DENIED).
10. **Split Discrepancy Write**: Writing non-integer fractional cent amounts without integer minor units. (Expect: PERMISSION_DENIED).
11. **User Profile Hijacking**: Updating another user's currency or onboarding state at `/users/victim_uid`. (Expect: PERMISSION_DENIED).
12. **System Rule Wipe**: Attempt to delete another user's entire categories collection. (Expect: PERMISSION_DENIED).
