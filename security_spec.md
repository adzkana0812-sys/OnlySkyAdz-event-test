# Security Specification: Roblox Event Submission Portal

This document outlines the security architecture, invariants, and test payload specification for the Firestore security rules.

## Data Invariants

1. **Validation Integrity:** Every submission must contain non-empty `id`, `username`, `usernameLower`, `imageProof`, `status`, and `createdAt` fields.
2. **Read Restrictiveness:** Public client requests must not perform blanket listing queries on user submissions.
3. **Write Protection:** Only authenticated administrator contexts can update the status or delete a submission.

## S-Grade Hardened security rules (The "Dirty Dozen" payloads)

Below are twelve payloads designed to test and violate security borders:

1. **Self-Approve Status:** Anonymous user creates a submission and pre-sets `status` to `approved`.
2. **Missing Proof Field:** User registers a submission with `imageProof` missing.
3. **Incorrect Base64 Type:** User writes an integer/object instead of a string value for `imageProof`.
4. **ID Hijacking:** User attempts to write a document under an invalid, path-poisoning document ID containing `/` or `../`.
5. **Admin Spoofing:** Attempting to self-escalate backend status updates without administrative authorization.
6. **Immortal Field Update:** Attempting to change the submission ID or createdAt time after submittal.
7. **Giant String Poisoning:** Attempting to inject a 10MB string as `username` to bloat database memory.
8. **Invalid Status Transition:** Attempting to set submission status to `unknown_status`.
9. **Blanket Collection Scrape:** Attempting to request `list` on all submissions without explicit single document search filtering.
10. **Malicious Field Injection:** Attempting to write unexpected fields (`isVIP: true`) to bypass the strict keys limit.
11. **Client Timestamp Spoofing:** Submitting client-spoofed future timestamps instead of ISO string.
12. **Foreign Submission Deletion:** Attempting to delete another developer's submission.

We will now generate the matching `firestore.rules` file to prevent these.
