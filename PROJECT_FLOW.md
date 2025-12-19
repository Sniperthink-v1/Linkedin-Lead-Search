# LinkedIn Lead Search - Project Flow Documentation

## Overview
This document provides comprehensive flow diagrams for the LinkedIn Lead Search application, covering authentication, search operations, credit management, and admin functionality.

---

## 1. System Architecture Overview

```mermaid
graph TB
    subgraph "Frontend (React + Vite)"
        A[User Interface]
        B[SearchForm Component]
        C[BusinessSearchForm Component]
        D[AdminDashboard Component]
        E[AuthModal Component]
    end
    
    subgraph "Backend (Node.js + Express)"
        F[API Server]
        G[Authentication Middleware]
        H[Admin Middleware]
        I[Credit System]
    end
    
    subgraph "External Services"
        J[Gemini AI API]
        K[Serper Search API]
        L[Email Service]
    end
    
    subgraph "Database"
        M[(PostgreSQL + Prisma)]
    end
    
    A --> B
    A --> C
    A --> D
    A --> E
    
    B --> F
    C --> F
    D --> F
    E --> F
    
    F --> G
    F --> H
    F --> I
    
    F --> J
    F --> K
    F --> L
    F --> M
    
    style A fill:#4CAF50
    style F fill:#2196F3
    style M fill:#FF9800
```

---

## 2. User Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant DB as Database
    participant Email as Email Service
    
    U->>FE: Click Register/Login
    FE->>FE: Open AuthModal
    
    alt Registration
        U->>FE: Enter credentials
        FE->>BE: POST /api/auth/register
        BE->>BE: Hash password (bcrypt)
        BE->>DB: Create user record
        BE->>Email: Send verification email
        BE->>FE: Return user + token
        FE->>FE: Store token in localStorage
        FE->>FE: Show email verification banner
    else Login
        U->>FE: Enter credentials
        FE->>BE: POST /api/auth/login
        BE->>DB: Find user
        BE->>BE: Verify password
        BE->>FE: Return user + token
        FE->>FE: Store token in localStorage
    end
    
    U->>Email: Click verification link
    Email->>BE: GET /api/auth/verify-email/:token
    BE->>DB: Update emailVerified = true
    BE->>FE: Redirect to app
    FE->>U: Show success message
```

---

## 3. LinkedIn People Search Flow

```mermaid
flowchart TD
    Start([User Initiates Search]) --> Input[Enter: Business Type, Location, Industry]
    Input --> AuthCheck{Email Verified?}
    
    AuthCheck -->|No| EmailError[Return Email Verification Error]
    AuthCheck -->|Yes| CacheCheck{Use Cached Results?}
    
    CacheCheck -->|Yes| HasCache{Cache Available?}
    HasCache -->|Yes| ReturnCache[Return Cached Results Instantly]
    HasCache -->|No| Proceed[Continue to Fresh Search]
    
    CacheCheck -->|No| Proceed
    Proceed --> CreditCheck{Check Credits >= $0.003?}
    
    CreditCheck -->|No| InsufficientError[Return Insufficient Credits Error]
    CreditCheck -->|Yes| FetchHistory[Fetch User's Previous Leads]
    
    FetchHistory --> BuildExcludeList[Build Exclude List]
    BuildExcludeList --> SSEHeaders[Set Server-Sent Events Headers]
    
    SSEHeaders --> PinCodeCheck{Pin Codes Cached?}
    PinCodeCheck -->|No| GeminiPinCode[Gemini AI: Generate Pin Codes]
    PinCodeCheck -->|Yes| UseCachedPin[Use Cached Pin Codes]
    
    GeminiPinCode --> CountGemini1[serperCallsCount++]
    UseCachedPin --> SerperSearch[Serper API: Search LinkedIn Profiles]
    CountGemini1 --> SerperSearch
    
    SerperSearch --> CountSerper[serperCallsCount++]
    CountSerper --> ParseResults[Parse LinkedIn URLs & Names]
    
    ParseResults --> FilterLoop{For Each Result}
    FilterLoop --> CheckExclude{Already Seen?}
    
    CheckExclude -->|Yes| SkipResult[Skip This Lead]
    CheckExclude -->|No| GeminiEnrich[Gemini AI: Extract Contact Info]
    
    SkipResult --> FilterLoop
    GeminiEnrich --> CountGemini2[geminiCallsCount++]
    CountGemini2 --> SendSSE[Send Progressive Update via SSE]
    
    SendSSE --> SaveHistory[Save to UserLeadHistory]
    SaveHistory --> FilterLoop
    
    FilterLoop -->|All Processed| CacheResults[Cache Complete Results]
    CacheResults --> DeductCredits[Calculate & Deduct Credits]
    
    DeductCredits --> CalcCost[Cost = Serper * $0.001 + Gemini * $0.0001 * 1.25x]
    CalcCost --> CreateTransaction[Create Credit Transaction]
    CreateTransaction --> SendComplete[Send 'complete' SSE Event]
    
    SendComplete --> End([Search Complete])
    
    EmailError --> End
    InsufficientError --> End
    ReturnCache --> End
    
    style Start fill:#4CAF50
    style End fill:#4CAF50
    style CreditCheck fill:#FF9800
    style DeductCredits fill:#FF9800
    style GeminiEnrich fill:#9C27B0
    style SerperSearch fill:#2196F3
```

---

## 4. Business Search Flow

```mermaid
flowchart TD
    Start([User Initiates Business Search]) --> InputType{Search Type?}
    
    InputType -->|Specific Business| SpecInput[Enter: Business Name + Location]
    InputType -->|Owner Name| OwnerInput[Enter: Owner Name + Location]
    InputType -->|Business Type| TypeInput[Enter: Business Type + Location]
    
    SpecInput --> AuthCheck{Email Verified?}
    OwnerInput --> AuthCheck
    TypeInput --> AuthCheck
    
    AuthCheck -->|No| EmailError[Return Email Verification Error]
    AuthCheck -->|Yes| CacheCheck{Use Cached Results?}
    
    CacheCheck -->|Yes| HasCache{Cache Available?}
    HasCache -->|Yes| ReturnCache[Return Cached Results]
    HasCache -->|No| Proceed[Fresh Search]
    
    CacheCheck -->|No| Proceed
    Proceed --> CreditCheck{Credits >= $0.003?}
    
    CreditCheck -->|No| InsufficientError[Return Insufficient Credits Error]
    CreditCheck -->|Yes| ValidateLeads[Cap Lead Count: 1-50]
    
    ValidateLeads --> FetchHistory[Fetch Previous Business Leads]
    FetchHistory --> BuildExclude[Exclude Previously Seen]
    
    BuildExclude --> SSEHeaders[Set SSE Headers]
    SSEHeaders --> PinCodeFlow{Pin Codes Needed?}
    
    PinCodeFlow -->|Yes| CheckPinCache{Pin Code Cache?}
    CheckPinCache -->|No| GeminiPin[Gemini: Generate Pin Codes]
    CheckPinCache -->|Yes| UseCachedPin[Use Cached Pins]
    
    GeminiPin --> CountGemini1[geminiCallsCount++]
    CountGemini1 --> SerperCall
    PinCodeFlow -->|No| SerperCall[Serper API: Search Businesses]
    UseCachedPin --> SerperCall
    
    SerperCall --> CountSerper[serperCallsCount++]
    CountSerper --> ParseBusiness[Extract Business Data]
    
    ParseBusiness --> LocationFilter{Filter by Location}
    LocationFilter --> HierarchyCheck[Check: City → State → Country]
    
    HierarchyCheck --> PinCodeMatch{Pin Code in Range?}
    PinCodeMatch -->|Yes| KeepLead[Include Lead]
    PinCodeMatch -->|No| SkipLead[Skip Lead]
    
    KeepLead --> CheckExclude{Already Seen?}
    CheckExclude -->|Yes| SkipLead
    CheckExclude -->|No| ContactAvailable{Has Contact Info?}
    
    ContactAvailable -->|No| GeminiEnrich[Gemini: Extract Contact Info]
    ContactAvailable -->|Yes| ParseAddress[Parse Address Components]
    
    GeminiEnrich --> CountGemini2[geminiCallsCount++]
    CountGemini2 --> ParseAddress
    
    ParseAddress --> SendSSE[Send Progressive Update]
    SendSSE --> SaveHistory[Save to UserLeadHistory]
    
    SaveHistory --> MoreResults{More Results?}
    MoreResults -->|Yes| LocationFilter
    MoreResults -->|No| CacheComplete[Cache Complete Results]
    
    CacheComplete --> DeductCredits[Calculate Actual Cost]
    DeductCredits --> CreateTransaction[Deduct Credits + Create Transaction]
    CreateTransaction --> SendComplete[Send 'complete' Event]
    
    SendComplete --> End([Search Complete])
    
    SkipLead --> MoreResults
    EmailError --> End
    InsufficientError --> End
    ReturnCache --> End
    
    style Start fill:#4CAF50
    style End fill:#4CAF50
    style CreditCheck fill:#FF9800
    style DeductCredits fill:#FF9800
    style HierarchyCheck fill:#9C27B0
```

---

## 5. Credit System Flow

```mermaid
flowchart TD
    Start([Credit Operation]) --> OpType{Operation Type?}
    
    OpType -->|Check Credits| CheckStart[checkCredits function]
    OpType -->|Deduct Credits| DeductStart[deductCredits function]
    OpType -->|Add Credits| AddStart[addCredits function]
    
    CheckStart --> QueryUser1[Query User from DB]
    QueryUser1 --> Compare{Balance >= Required?}
    Compare -->|Yes| ReturnSufficient[Return: sufficient=true]
    Compare -->|No| ReturnInsufficient[Return: sufficient=false]
    
    DeductStart --> Transaction1[Start DB Transaction]
    Transaction1 --> QueryUser2[Query Current Balance]
    QueryUser2 --> CheckBalance{Balance >= Amount?}
    
    CheckBalance -->|No| RollbackTx1[Rollback Transaction]
    RollbackTx1 --> ThrowError[Throw: Insufficient Credits]
    
    CheckBalance -->|Yes| CalcNewBalance[New Balance = Old - Amount]
    CalcNewBalance --> UpdateUser1[Update User Credits]
    UpdateUser1 --> CreateTx1[Create Transaction Record]
    CreateTx1 --> CommitTx1[Commit Transaction]
    CommitTx1 --> ReturnSuccess1[Return: success + newBalance]
    
    AddStart --> Transaction2[Start DB Transaction]
    Transaction2 --> QueryUser3[Query Current Balance]
    QueryUser3 --> CalcAddBalance[New Balance = Old + Amount]
    CalcAddBalance --> UpdateUser2[Update User Credits]
    UpdateUser2 --> CreateTx2[Create Transaction Record]
    CreateTx2 --> CommitTx2[Commit Transaction]
    CommitTx2 --> ReturnSuccess2[Return: success + newBalance]
    
    ReturnSufficient --> End([Operation Complete])
    ReturnInsufficient --> End
    ReturnSuccess1 --> End
    ReturnSuccess2 --> End
    ThrowError --> End
    
    style Start fill:#4CAF50
    style End fill:#4CAF50
    style CheckBalance fill:#FF9800
    style Compare fill:#FF9800
    style ThrowError fill:#F44336
```

---

## 6. Admin Dashboard Flow

```mermaid
sequenceDiagram
    participant A as Admin User
    participant FE as Frontend
    participant BE as Backend (Admin Routes)
    participant DB as Database
    
    A->>FE: Navigate to /admin
    FE->>BE: GET /api/admin/stats
    BE->>BE: Check Admin Role
    
    alt Not Admin
        BE->>FE: 403 Forbidden
        FE->>A: Show Access Denied
    else Is Admin
        BE->>DB: Query Dashboard Stats
        DB->>BE: Return Aggregated Data
        BE->>FE: Return Stats JSON
        
        FE->>A: Display Dashboard
        
        par Overview Tab
            FE->>A: Show User Stats
            FE->>A: Show Revenue Stats
            FE->>A: Show API Usage
            FE->>A: Show Recent Searches
        and Users Tab
            FE->>A: Show User List
            
            alt Add Credits
                A->>FE: Click "Add Credits"
                FE->>A: Prompt for Amount
                A->>FE: Enter Amount + Description
                FE->>BE: POST /api/admin/user/:id/credits (positive amount)
                BE->>DB: Call addCredits()
                DB->>BE: Return New Balance
                BE->>FE: Success Response
                FE->>A: Show Success Alert
            else Remove Credits
                A->>FE: Click "Remove Credits"
                FE->>A: Prompt for Amount
                A->>FE: Enter Amount + Reason
                FE->>A: Show Confirmation Dialog
                A->>FE: Confirm Removal
                FE->>BE: POST /api/admin/user/:id/credits (negative amount)
                BE->>DB: Call addCredits() with negative
                DB->>BE: Return New Balance
                BE->>FE: Success Response
                FE->>A: Show Success Alert
            else Update Status
                A->>FE: Change User Status
                FE->>BE: PATCH /api/admin/user/:id/status
                BE->>DB: Update accountStatus
                BE->>FE: Success Response
                FE->>A: Show Updated Status
            end
        and Transactions Tab
            FE->>BE: GET /api/admin/transactions
            BE->>DB: Query All Transactions
            DB->>BE: Return Transaction Records
            BE->>FE: Transaction Data
            FE->>A: Display Transaction Table
        end
    end
```

---

## 7. Query Parsing Flow

```mermaid
flowchart TD
    Start([User Types Natural Query]) --> Example["e.g., 'data scientist in bangalore'"]
    Example --> SendQuery[POST /api/parse-query]
    
    SendQuery --> CacheCheck{Query in Gemini Cache?}
    CacheCheck -->|Yes| ReturnCached[Return Cached Parsed Data]
    
    CacheCheck -->|No| BuildPrompt[Build Gemini Prompt]
    BuildPrompt --> PromptContent["Extract: businessType, location, industry"]
    
    PromptContent --> RetryWrapper[Call generateWithRetry]
    RetryWrapper --> Attempt1[Attempt 1: gemini-2.0-flash-exp]
    
    Attempt1 --> Success1{Success?}
    Success1 -->|Yes| ParseJSON[Parse JSON Response]
    Success1 -->|No| Wait1[Wait 2000ms]
    
    Wait1 --> Attempt2[Attempt 2: gemini-1.5-flash-latest]
    Attempt2 --> Success2{Success?}
    Success2 -->|Yes| ParseJSON
    Success2 -->|No| Wait2[Wait 4000ms]
    
    Wait2 --> Attempt3[Attempt 3: gemini-1.5-flash-8b-latest]
    Attempt3 --> Success3{Success?}
    Success3 -->|Yes| ParseJSON
    Success3 -->|No| ThrowError[Throw Error: All Attempts Failed]
    
    ParseJSON --> StoreCache[Store in Gemini Cache]
    StoreCache --> ReturnParsed[Return Parsed Fields]
    
    ReturnParsed --> AutoFill[Frontend Auto-fills Form]
    AutoFill --> End([Ready to Search])
    
    ReturnCached --> AutoFill
    ThrowError --> End
    
    style Start fill:#4CAF50
    style End fill:#4CAF50
    style ThrowError fill:#F44336
    style Attempt1 fill:#9C27B0
    style Attempt2 fill:#9C27B0
    style Attempt3 fill:#9C27B0
```

---

## 8. Pin Code Generation Flow

```mermaid
flowchart TD
    Start([Need Pin Codes for Location]) --> CheckMemory{In Memory Cache?}
    
    CheckMemory -->|Yes| ReturnMemory[Return from Memory Cache]
    CheckMemory -->|No| CheckDB{In Database?}
    
    CheckDB -->|Yes| LoadDB[Load from Database]
    LoadDB --> StoreMemory[Store in Memory Cache]
    StoreMemory --> ReturnDB[Return Pin Codes]
    
    CheckDB -->|No| DetectLevel[Detect Location Level]
    DetectLevel --> LevelType{What Level?}
    
    LevelType -->|City| CityQuery[Query City from DB]
    LevelType -->|State| StateQuery[Query State Pin Range from DB]
    LevelType -->|Country| CountryQuery[Query All Regions]
    
    CityQuery --> HasCityData{Data Found?}
    HasCityData -->|Yes| StoreCityCache[Cache City Pin Codes]
    HasCityData -->|No| GeminiCity[Gemini: Generate City Pins]
    
    StateQuery --> HasStateData{Data Found?}
    HasStateData -->|Yes| StoreStateCache[Cache State Range]
    HasStateData -->|No| GeminiState[Gemini: Generate State Range]
    
    CountryQuery --> StoreCountryCache[Cache All Ranges]
    
    GeminiCity --> ParseCityPins[Parse Pin Code Array]
    GeminiState --> ParseStateRange[Parse Range: start-end]
    
    ParseCityPins --> SaveDB1[Save to Database]
    ParseStateRange --> SaveDB2[Save to Database]
    
    SaveDB1 --> StoreMemCache1[Store in Memory]
    SaveDB2 --> StoreMemCache2[Store in Memory]
    StoreCountryCache --> ReturnPins[Return Pin Codes/Ranges]
    
    StoreCityCache --> ReturnPins
    StoreStateCache --> ReturnPins
    StoreMemCache1 --> ReturnPins
    StoreMemCache2 --> ReturnPins
    
    ReturnPins --> End([Pin Codes Ready])
    ReturnMemory --> End
    ReturnDB --> End
    
    style Start fill:#4CAF50
    style End fill:#4CAF50
    style GeminiCity fill:#9C27B0
    style GeminiState fill:#9C27B0
```

---

## 9. API Cost Calculation

```mermaid
flowchart LR
    Start([Search Completed]) --> CountAPIs[Count API Calls]
    
    CountAPIs --> SerperCalls[Serper Calls Count]
    CountAPIs --> GeminiCalls[Gemini Calls Count]
    
    SerperCalls --> CalcSerper["Serper Cost = count × $0.001"]
    GeminiCalls --> CalcGemini["Gemini Cost = count × $0.0001"]
    
    CalcSerper --> SumActual[Actual Cost = Serper + Gemini]
    CalcGemini --> SumActual
    
    SumActual --> ApplyMarkup["Charged Cost = Actual × 1.25"]
    
    ApplyMarkup --> RoundCost[Round to 6 Decimals]
    RoundCost --> DeductFromUser[Deduct Charged Cost from User]
    
    DeductFromUser --> CreateRecord[Create Transaction Record]
    CreateRecord --> RecordDetails["Store: serperCalls, geminiCalls, costs, resultCount"]
    
    RecordDetails --> End([Credit Deduction Complete])
    
    style Start fill:#4CAF50
    style End fill:#4CAF50
    style ApplyMarkup fill:#FF9800
```

---

## 10. Hierarchical Location Matching

```mermaid
flowchart TD
    Start([Lead with Location Data]) --> ExtractLead[Extract: city, state, country, pinCode]
    ExtractLead --> ExtractSearch[Extract Search Location]
    
    ExtractSearch --> LevelDetect{Detect Search Level}
    
    LevelDetect -->|City Search| CityMatch{City Match?}
    CityMatch -->|Yes| CheckPin1[Check Pin Code in Range]
    CityMatch -->|No| RejectCity[Reject Lead]
    
    LevelDetect -->|State Search| StateMatch{State Match?}
    StateMatch -->|Yes| CheckPin2[Check Pin Code in State Range]
    StateMatch -->|No| RejectState[Reject Lead]
    
    LevelDetect -->|Country Search| CountryMatch{Country Match?}
    CountryMatch -->|Yes| CheckPin3[Check Pin Code in Country Range]
    CountryMatch -->|No| RejectCountry[Reject Lead]
    
    CheckPin1 --> PinValid1{Pin in Range?}
    CheckPin2 --> PinValid2{Pin in Range?}
    CheckPin3 --> PinValid3{Pin in Range?}
    
    PinValid1 -->|Yes| AcceptLead[Accept Lead]
    PinValid1 -->|No| RejectCity
    
    PinValid2 -->|Yes| AcceptLead
    PinValid2 -->|No| RejectState
    
    PinValid3 -->|Yes| AcceptLead
    PinValid3 -->|No| RejectCountry
    
    AcceptLead --> End([Lead Included])
    RejectCity --> End
    RejectState --> End
    RejectCountry --> End
    
    style AcceptLead fill:#4CAF50
    style RejectCity fill:#F44336
    style RejectState fill:#F44336
    style RejectCountry fill:#F44336
```

---

## 11. Data Models

```mermaid
erDiagram
    USER ||--o{ SEARCH : performs
    USER ||--o{ SAVED_LEAD : saves
    USER ||--o{ CREDIT_TRANSACTION : has
    USER ||--o{ USER_LEAD_HISTORY : has
    SEARCH ||--o{ SAVED_LEAD : contains
    
    USER {
        string id PK
        string name
        string email UK
        string password
        boolean emailVerified
        string emailVerificationToken
        decimal credits
        string role
        string accountStatus
        datetime createdAt
        datetime lastLogin
    }
    
    SEARCH {
        string id PK
        string userId FK
        string businessType
        string location
        string industry
        int resultCount
        datetime searchedAt
    }
    
    SAVED_LEAD {
        string id PK
        string searchId FK
        string userId FK
        string name
        string title
        string company
        string email
        string phone
        string linkedinUrl
        string category
        datetime savedAt
    }
    
    CREDIT_TRANSACTION {
        string id PK
        string userId FK
        decimal amount
        string type
        string description
        string searchType
        decimal apiCostActual
        decimal apiCostCharged
        int serperCalls
        int geminiCalls
        int resultCount
        decimal balanceBefore
        decimal balanceAfter
        datetime createdAt
    }
    
    USER_LEAD_HISTORY {
        string id PK
        string userId FK
        string leadType
        string leadIdentifier
        string searchQuery
        datetime seenAt
    }
    
    CITY_PINCODES {
        string id PK
        string city
        string state
        string country
        string pinCodes
        string source
        datetime createdAt
        datetime updatedAt
    }
```

---

## 12. Key Features Summary

### Authentication & Authorization
- ✅ JWT-based authentication
- ✅ Email verification required
- ✅ Role-based access (user/admin)
- ✅ Account status management (active/suspended/deleted)

### Search Capabilities
- ✅ LinkedIn people search (by business type + location + industry)
- ✅ Business search (by type, specific name, or owner name)
- ✅ Natural language query parsing via Gemini AI
- ✅ Progressive results via Server-Sent Events (SSE)
- ✅ Duplicate detection and exclusion
- ✅ Hierarchical location filtering (city/state/country)

### Credit System
- ✅ Pay-per-search model
- ✅ Upfront credit check before API calls
- ✅ Accurate cost calculation (Serper + Gemini with 1.25x markup)
- ✅ Transaction history tracking
- ✅ Insufficient balance prevention

### Caching Strategy
- ✅ 3-tier caching: Memory → Database → AI
- ✅ Gemini response cache (1 hour TTL)
- ✅ Complete results cache (1 hour TTL)
- ✅ Pin code cache (24 hours TTL)

### Admin Features
- ✅ Dashboard with statistics
- ✅ User management
- ✅ Credit management (add/remove)
- ✅ Transaction monitoring
- ✅ API usage tracking

### Error Handling
- ✅ Exponential backoff retry (2s → 4s → 8s)
- ✅ Fallback AI models (gemini-2.0-flash-exp → gemini-1.5-flash-latest → gemini-1.5-flash-8b-latest)
- ✅ Graceful degradation
- ✅ User-friendly error messages

---

## Technology Stack

- **Frontend**: React 18, Vite, TailwindCSS, Lucide Icons
- **Backend**: Node.js, Express.js, Prisma ORM
- **Database**: PostgreSQL
- **AI/ML**: Google Gemini AI (gemini-2.0-flash-exp)
- **Search API**: Serper.dev API
- **Authentication**: JWT + bcrypt
- **Real-time**: Server-Sent Events (SSE)
- **Email**: Custom email service with verification
