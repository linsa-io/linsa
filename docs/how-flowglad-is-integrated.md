# How Flowglad is Integrated

This document explains the Flowglad billing integration in this codebase.

## Overview

Flowglad handles usage-based billing with metered subscriptions. Users can:
- Use the app for free with limited requests
- Subscribe to a paid plan for more usage
- Top up credits when needed

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │ useBilling()    │    │ Pricing UI      │                     │
│  │ (Flowglad hook) │    │ (checkout)      │                     │
│  └────────┬────────┘    └────────┬────────┘                     │
└───────────┼──────────────────────┼──────────────────────────────┘
            │                      │
            ▼                      ▼
┌───────────────────────┐  ┌───────────────────────┐
│ /api/flowglad/*       │  │ /api/usage-events     │
│ (billing endpoints)   │  │ (record usage)        │
└───────────┬───────────┘  └───────────┬───────────┘
            │                          │
            ▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Flowglad API                                │
│  - Customer management                                           │
│  - Subscriptions                                                 │
│  - Usage metering                                                │
│  - Checkout sessions                                             │
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

```
packages/web/src/
├── lib/
│   ├── flowglad.ts          # FlowgladServer initialization
│   ├── billing.ts           # Usage checking & recording logic
│   └── billing-helpers.ts   # Utility functions for pricing/usage
└── routes/api/
    ├── flowglad/
    │   └── $.ts             # Catch-all route for Flowglad API
    └── usage-events.ts      # Record usage events
```

## Core Files

### 1. `lib/flowglad.ts` - Server Initialization

Creates a FlowgladServer instance for a specific user:

```typescript
import { FlowgladServer } from "@flowglad/server"
import { db } from "@/db/connection"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"

export const flowglad = (customerExternalId: string) => {
  const env = getEnv()

  if (!env.FLOWGLAD_SECRET_KEY) {
    return null
  }

  return new FlowgladServer({
    apiKey: env.FLOWGLAD_SECRET_KEY,
    customerExternalId,  // Maps to user.id
    getCustomerDetails: async (externalId: string) => {
      // Fetch user details from database
      const user = await db().query.users.findFirst({
        where: eq(users.id, externalId),
      })

      if (!user) {
        throw new Error(`User not found: ${externalId}`)
      }

      return {
        email: user.email,
        name: user.name ?? undefined,
      }
    },
  })
}
```

**Key Points:**
- Takes `customerExternalId` which is the user's ID from better-auth
- Fetches customer details (email, name) from database when needed
- Returns `null` if `FLOWGLAD_SECRET_KEY` is not configured

### 2. `routes/api/flowglad/$.ts` - API Route Handler

Proxies requests to Flowglad for billing operations:

```typescript
export const Route = createFileRoute("/api/flowglad/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const userId = await getUserId(request)
        if (!userId) {
          return json({ error: "Unauthorized" }, 401)
        }

        const flowgladServer = flowglad(userId)
        // ... handle request
      },
      POST: async ({ request, params }) => {
        // Same pattern for POST
      },
    },
  },
})
```

**Endpoints available:**
- `GET /api/flowglad/billing` - Get user's billing info
- `POST /api/flowglad/checkout` - Create checkout session
- etc.

### 3. `routes/api/usage-events.ts` - Record Usage

Records usage events after AI requests:

```typescript
// POST /api/usage-events
// Body: { usageMeterSlug: "ai_requests", amount: 1 }

const usageEvent = await flowgladServer.createUsageEvent({
  subscriptionId: currentSubscription.id,
  priceSlug: usagePrice.slug,
  amount,
  transactionId: finalTransactionId,  // For idempotency
})
```

### 4. `lib/billing.ts` - Usage Logic

Implements billing business logic:

```typescript
// Usage limits by tier
const GUEST_FREE_REQUESTS = 5        // No auth required
const AUTH_FREE_REQUESTS_DAILY = 20  // Authenticated, no subscription
const PAID_PLAN_REQUESTS = 1000      // Pro plan per billing period

// Meter slug (must match Flowglad dashboard)
export const AI_REQUESTS_METER = "ai_requests"

// Key functions:
export async function checkUsageAllowed(request: Request): Promise<UsageCheckResult>
export async function recordUsage(request: Request, amount?: number): Promise<void>
export async function getBillingSummary(request: Request): Promise<BillingSummary>
```

### 5. `lib/billing-helpers.ts` - Utilities

Helper functions for working with Flowglad data:

```typescript
// Find usage price by meter slug
findUsagePriceByMeterSlug(usageMeterSlug, pricingModel)

// Compute total usage credits from subscription
computeUsageTotal(usageMeterSlug, currentSubscription, pricingModel)

// Check if plan is default/free
isDefaultPlanBySlug(pricingModel, priceSlug)
```

## Usage Flow

### 1. User Makes AI Request

```typescript
// In /api/chat/ai.ts
const usage = await checkUsageAllowed(request)
if (!usage.allowed) {
  return new Response("Usage limit reached", { status: 429 })
}

// ... process AI request ...

// Record usage after success
await recordUsage(request, 1)
```

### 2. Frontend Checks Billing

```typescript
// Using Flowglad React hook
import { useBilling } from "@flowglad/react"  // or @flowglad/nextjs

function Dashboard() {
  const billing = useBilling()

  if (!billing.loaded) return <Loading />

  const usage = billing.checkUsageBalance("ai_requests")
  const remaining = usage?.availableBalance ?? 0

  return <div>Remaining: {remaining}</div>
}
```

### 3. User Upgrades

```typescript
// Create checkout session
const handleUpgrade = async () => {
  await billing.createCheckoutSession({
    priceSlug: "pro_monthly",
    successUrl: `${window.location.origin}/`,
    cancelUrl: window.location.href,
    quantity: 1,
    autoRedirect: true,
  })
}
```

## Flowglad Dashboard Setup

### 1. Create Usage Meter

In Flowglad dashboard, create a usage meter:
- **Slug**: `ai_requests`
- **Name**: "AI Requests"
- **Type**: Sum
- **Reset**: Per billing period

### 2. Create Products & Prices

**Free Plan (default):**
- Default: Yes
- Price: $0/month

**Pro Plan:**
- Name: "Pro"
- Price slug: `pro_monthly`
- Amount: $7.99/month
- Add usage price for `ai_requests` meter with 1000 included credits

### 3. Get API Key

1. Go to Settings → API Keys
2. Create a secret key (starts with `sk_`)
3. Add to environment:

```bash
# Local development
echo "FLOWGLAD_SECRET_KEY=sk_test_xxx" >> packages/web/.env

# Production (Cloudflare)
wrangler secret put FLOWGLAD_SECRET_KEY
```

## Environment Variables

```bash
# Required for Flowglad
FLOWGLAD_SECRET_KEY=sk_live_xxx  # or sk_test_xxx for testing
```

## Testing Locally

1. Set up Flowglad account and get test API key
2. Add to `.env`:
   ```
   FLOWGLAD_SECRET_KEY=sk_test_xxx
   ```
3. Create products/prices in Flowglad dashboard
4. Run the app and test:
   - Sign up → user becomes Flowglad customer
   - Make AI requests → usage is tracked
   - Hit limit → upgrade prompt shown
   - Subscribe → checkout flow
   - More requests → usage deducted from subscription

## Debugging

### Check if Flowglad is configured

```bash
curl 'http://localhost:3000/api/flowglad/billing' -H 'Cookie: ...'

# Error: "Flowglad not configured" → FLOWGLAD_SECRET_KEY not set
# Error: "Unauthorized" → User not logged in
# Success: Returns billing data with subscriptions, usage, etc.
```

### Check usage balance

```typescript
const billing = await flowglad(userId).getBilling()
const usage = billing.checkUsageBalance("ai_requests")
console.log("Available:", usage?.availableBalance)
```

### Record test usage

```bash
curl -X POST 'http://localhost:3000/api/usage-events' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: ...' \
  -d '{"usageMeterSlug": "ai_requests", "amount": 1}'
```

## Common Issues

### "Customer not found"

The user doesn't have a Flowglad customer record yet. This is created automatically when:
- User first accesses billing endpoints
- `getCustomerDetails` is called

### "No active subscription found"

User needs to subscribe to a plan. Show them the pricing page.

### "Usage price not found for meter"

The `ai_requests` meter exists but no usage price is attached to it in your pricing model. Add a usage price in Flowglad dashboard.
