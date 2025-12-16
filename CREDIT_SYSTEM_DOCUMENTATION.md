# Credit-Based System Implementation

## Overview
This implementation adds a comprehensive credit-based billing system to track API usage and charge users accordingly. The system applies a **1.25x markup** on actual API costs to generate profit.

## Key Features

### 1. Credit Tracking
- Each user starts with **100 free credits** (default: $100)
- Real-time credit balance displayed in user profile
- Automatic credit deduction after each search
- Detailed transaction history for transparency

### 2. Cost Calculation

#### API Costs (Our Side)
- **Serper API**: $0.001 per call
- **Gemini API**: $0.0001 per call

#### User Charges
- **Markup**: 1.25x actual cost
- **Formula**: `chargedCost = (serperCalls × $0.001 + geminiCalls × $0.0001) × 1.25`

#### Example Cost Breakdown
For a typical people search with:
- 1 Gemini API call
- 20 Serper API calls

**Actual Cost**: (1 × $0.0001) + (20 × $0.001) = $0.0201
**Charged to User**: $0.0201 × 1.25 = **$0.025125**

### 3. Transaction Tracking
Every credit transaction records:
- Amount deducted/added
- Transaction type (search, purchase, admin_adjustment)
- API costs (actual vs charged)
- Number of Serper and Gemini calls
- Number of results returned
- Balance before and after
- Timestamp

## Database Schema

### User Model
```prisma
model User {
  // ... existing fields
  credits Float @default(100.0) // Starting balance
  creditTransactions CreditTransaction[]
}
```

### CreditTransaction Model
```prisma
model CreditTransaction {
  id              String   @id @default(uuid())
  userId          String
  amount          Float    // Negative for deductions, positive for additions
  type            String   // "search", "purchase", "admin_adjustment", "signup_bonus"
  description     String?
  searchType      String?  // "people" or "business"
  apiCostActual   Float?   // Actual API cost incurred
  apiCostCharged  Float?   // Amount charged (1.25x markup)
  serperCalls     Int?     // Number of Serper API calls
  geminiCalls     Int?     // Number of Gemini API calls
  resultCount     Int?     // Number of results returned
  balanceBefore   Float    // Balance before transaction
  balanceAfter    Float    // Balance after transaction
  createdAt       DateTime @default(now())
  
  user            User     @relation(fields: [userId], references: [id])
}
```

## API Endpoints

### GET `/api/credits/balance`
Get user's current credit balance
**Response:**
```json
{
  "success": true,
  "credits": 99.975
}
```

### GET `/api/credits/history?limit=50`
Get user's credit transaction history
**Response:**
```json
{
  "success": true,
  "transactions": [
    {
      "id": "uuid",
      "amount": -0.025,
      "type": "search",
      "description": "LinkedIn people search: Software Engineer in Delhi",
      "searchType": "people",
      "apiCostActual": 0.02,
      "apiCostCharged": 0.025,
      "serperCalls": 20,
      "geminiCalls": 1,
      "resultCount": 15,
      "balanceBefore": 100.0,
      "balanceAfter": 99.975,
      "createdAt": "2025-12-15T12:00:00Z"
    }
  ]
}
```

### POST `/api/credits/purchase`
Purchase credits (placeholder for payment gateway integration)
**Request:**
```json
{
  "amount": 100,
  "paymentId": "stripe_payment_id"
}
```

### POST `/api/credits/admin/add`
Admin endpoint to add credits to any user
**Request:**
```json
{
  "userId": "user_uuid",
  "amount": 50,
  "description": "Promotional credits"
}
```

## Implementation Details

### Credit Tracking in Search Endpoints

#### People Search (`/api/search/people`)
```javascript
// Track API calls
let serperCallsCount = 0;
let geminiCallsCount = 0;

// Increment counters when APIs are called
geminiCallsCount++; // When calling Gemini
serperCallsCount++; // When calling Serper

// At end of search, deduct credits
const costs = calculateSearchCost(serperCallsCount, geminiCallsCount);
await deductCredits(userId, {
  amount: costs.chargedCost,
  type: "search",
  searchType: "people",
  apiCostActual: costs.actualCost,
  apiCostCharged: costs.chargedCost,
  serperCalls: serperCallsCount,
  geminiCalls: geminiCallsCount,
  resultCount: results.length
});
```

#### Business Search (`/api/search/business`)
Same pattern as people search, tracking both API types.

### Caching Benefits
- **Cached results = No credits deducted**
- Users can choose to use cached results (instant, free)
- Or fresh results (with deduplication, costs credits)

## Frontend Integration

### User Profile Component
- Displays current credit balance with $ symbol
- Shows balance in real-time
- "Add Credits" button for future payment integration
- Yellow coin icon for visual appeal

### Credit Display
```jsx
<div className="flex items-center gap-2">
  <Coins className="w-5 h-5 text-yellow-300" />
  <div>
    <p className="text-white font-bold">$99.9750</p>
    <p className="text-xs">Available Credits</p>
  </div>
</div>
```

## Future Enhancements

### Payment Integration
```javascript
// TODO: Integrate with payment gateway
// Options:
// 1. Stripe
// 2. Razorpay (for India)
// 3. PayPal

router.post("/purchase", authenticateToken, async (req, res) => {
  const { amount, paymentMethod } = req.body;
  
  // 1. Create payment intent with gateway
  // 2. Process payment
  // 3. On success, add credits to user
  // 4. Create transaction record
});
```

### Credit Packages
```javascript
const CREDIT_PACKAGES = {
  starter: { amount: 10, price: 10, bonus: 0 },
  pro: { amount: 50, price: 45, bonus: 5 },      // 10% bonus
  business: { amount: 100, price: 85, bonus: 15 }, // 15% bonus
  enterprise: { amount: 500, price: 400, bonus: 100 } // 20% bonus
};
```

### Low Credit Warnings
```javascript
if (userCredits < 0.1) {
  // Show warning in UI
  // Send email notification
  // Suggest purchasing more credits
}
```

### Admin Dashboard
- View all user credit balances
- Top spenders analytics
- Revenue tracking
- Adjust individual user credits
- Grant promotional credits

## Cost Optimization Tips

### For the Business
1. **Increase caching**: Reduce Gemini calls by caching more aggressively
2. **Batch operations**: Group similar searches to reduce API calls
3. **Rate limiting**: Prevent abuse with per-user rate limits
4. **Adjust markup**: Can increase to 1.5x or 2x for higher margins

### For Users
1. Use cached results when available (instant + free)
2. Be specific with search queries to get better results with fewer calls
3. Review search history before searching again

## Monitoring & Analytics

### Key Metrics to Track
```sql
-- Total revenue (sum of all charged amounts)
SELECT SUM(apiCostCharged) FROM CreditTransaction WHERE type = 'search';

-- Profit margin
SELECT 
  SUM(apiCostCharged - apiCostActual) as profit,
  (SUM(apiCostCharged - apiCostActual) / SUM(apiCostActual)) * 100 as margin_percent
FROM CreditTransaction WHERE type = 'search';

-- Average cost per search
SELECT AVG(apiCostCharged) FROM CreditTransaction WHERE type = 'search';

-- Users who need credits
SELECT userId, credits FROM User WHERE credits < 1.0;
```

## Migration Commands

```bash
# Create and apply migration
cd server
npx prisma migrate dev --name add_credit_system

# Generate Prisma client
npx prisma generate

# Check migration status
npx prisma migrate status
```

## Testing

### Test Credit Deduction
1. Login as a user
2. Check initial balance (should be 100.0)
3. Perform a people search
4. Check balance again (should be slightly less)
5. View credit history in `/api/credits/history`

### Test Admin Functions
```javascript
// Add credits to a user
POST /api/credits/admin/add
{
  "userId": "user_id_here",
  "amount": 50,
  "description": "Test credit addition"
}
```

## Security Considerations

1. **Authentication**: All credit endpoints require valid JWT token
2. **Authorization**: Admin endpoints need admin role check (TODO)
3. **Rate Limiting**: Prevent abuse of free searches
4. **Transaction Atomicity**: All credit operations use database transactions
5. **Audit Trail**: Every transaction is logged with full details

## Support & Maintenance

### Common Issues

**Issue**: User has negative balance
**Solution**: Use admin endpoint to add credits

**Issue**: Credits not deducting
**Solution**: Check server logs for API call tracking

**Issue**: Cached results showing but credits still deducted
**Solution**: Verify `useCached` parameter is set correctly

## Files Modified/Created

### Backend
- `server/prisma/schema.prisma` - Added credits field and CreditTransaction model
- `server/utils/credits.js` - Credit management utilities
- `server/routes/credits.js` - Credit API endpoints
- `server/server.js` - Integrated credit tracking in search endpoints

### Frontend
- `client/src/components/UserProfile.jsx` - Added credit display

### Database
- Migration: `20251215115854_add_credit_system/migration.sql`

## Conclusion

This credit system provides:
✅ Transparent pricing (users see exact costs)
✅ Profitable business model (1.25x markup)
✅ Detailed analytics (track every API call)
✅ User-friendly (clear balance display)
✅ Scalable (ready for payment integration)
✅ Fair (only charge for actual API usage)
