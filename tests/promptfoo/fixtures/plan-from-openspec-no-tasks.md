# OpenSpec Context: Spec In Progress (No Tasks)

## plan-prepare.js Output (pre-computed)

```json
{
  "openspec": {
    "present": true,
    "activeChanges": [{
      "name": "add-webhooks",
      "stage": "spec-in-progress",
      "deltaSpecCount": 2,
      "hasProposal": true,
      "hasDesign": false,
      "hasTasks": false,
      "tasksDone": 0,
      "tasksTotal": 0
    }],
    "branchMatch": null
  },
  "fromOpenspec": {
    "valid": true,
    "changeName": "add-webhooks",
    "hasProposal": true,
    "deltaSpecCount": 2,
    "hasDesign": false,
    "hasTasks": false,
    "tasksDone": 0,
    "tasksTotal": 0,
    "stage": "spec-in-progress"
  },
  "guardrails": [],
  "errors": []
}
```

## OpenSpec Artifacts (simulated reads)

### proposal.md
Webhook notification system — send HTTP callbacks to registered URLs when order events occur. Supports creation, update, and cancellation events with configurable retry and signature verification.

### specs/webhook-delivery.md
#### ADDED
- WebhookDelivery service with exponential backoff retry (max 3 attempts)
- HMAC-SHA256 signature header for payload verification

### specs/webhook-registration.md
#### ADDED
- POST /api/webhooks — register a new webhook endpoint
- DELETE /api/webhooks/:id — remove a webhook registration
- GET /api/webhooks — list registered webhooks for the authenticated user
