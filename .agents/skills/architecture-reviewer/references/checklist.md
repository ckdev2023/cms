# Quick review checklist

## Frontend
- Is state ownership obvious?
- Is server state confused with client state?
- Are hooks/services/shared utils created before stable repetition?
- Are route, page, and component responsibilities mixed?
- Is there unnecessary indirection hurting readability?

## Backend
- Is module ownership clear?
- Are transactions and consistency rules explicit?
- Is auth enforced at the correct layer?
- Are queues/retries/idempotency real or hand-waved?
- Does schema design support actual query patterns?

## Full-stack
- Is there one source of truth per business fact?
- Are permissions enforced server-side, not implied client-side?
- Is the api contract aligned with ui workflow?
- Are frontend and backend deploys tightly coupled?
- Is there chatty data fetching or duplicated validation?
