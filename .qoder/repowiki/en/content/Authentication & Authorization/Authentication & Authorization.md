# Authentication & Authorization

<cite>
**Referenced Files in This Document**
- [hooks.server.js](file://frontend/src/hooks.server.js)
- [auth.js](file://frontend/src/lib/server/auth.js)
- [jwt.js](file://frontend/src/lib/server/jwt.js)
- [security.js](file://frontend/src/lib/server/security.js)
- [db.js](file://frontend/src/lib/server/db.js)
- [schema_sqlite.sql](file://schema_sqlite.sql)
- [+server.js (admin)](file://frontend/src/routes/api/admin/+server.js)
- [auth.test.js](file://tests/auth.test.js)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document explains VSocial’s authentication and authorization system. It covers JWT-based session management, password hashing considerations, token lifecycle, and the complete authentication flow from registration to login to protected route access. It also documents user roles and permissions, access control mechanisms, API endpoint specifications for authentication routes, request/response schemas, error handling, session management, token refresh strategies, and security considerations. Practical examples of middleware usage and protected resource access are included, along with common security vulnerabilities and mitigation strategies.

## Project Structure
The authentication stack is implemented in the SvelteKit backend under the frontend module. Key files include:
- Server hooks for global security headers and setup guard
- JWT utilities for signing and verifying tokens
- Authentication middleware for enforcing auth and admin checks
- Security utilities for rate limiting and input validation
- Database adapter abstraction supporting two drivers
- Admin API endpoints guarded by role checks
- Database schema defining users, sessions, and roles

```mermaid
graph TB
subgraph "Server Runtime"
HK["hooks.server.js"]
end
subgraph "Auth Layer"
JWT["jwt.js"]
SEC["security.js"]
AUTH["auth.js"]
end
subgraph "Persistence"
DB["db.js"]
SCHEMA["schema_sqlite.sql"]
end
subgraph "API"
ADMIN["+server.js (admin)"]
end
HK --> AUTH
AUTH --> JWT
AUTH --> DB
DB --> SCHEMA
ADMIN --> AUTH
SEC --> ADMIN
```

**Diagram sources**
- [hooks.server.js:105-147](file://frontend/src/hooks.server.js#L105-L147)
- [jwt.js:1-45](file://frontend/src/lib/server/jwt.js#L1-L45)
- [auth.js:1-92](file://frontend/src/lib/server/auth.js#L1-L92)
- [security.js:1-54](file://frontend/src/lib/server/security.js#L1-L54)
- [db.js:117-181](file://frontend/src/lib/server/db.js#L117-L181)
- [+server.js (admin):188-233](file://frontend/src/routes/api/admin/+server.js#L188-L233)

**Section sources**
- [hooks.server.js:105-147](file://frontend/src/hooks.server.js#L105-L147)
- [jwt.js:1-45](file://frontend/src/lib/server/jwt.js#L1-L45)
- [auth.js:1-92](file://frontend/src/lib/server/auth.js#L1-L92)
- [security.js:1-54](file://frontend/src/lib/server/security.js#L1-L54)
- [db.js:117-181](file://frontend/src/lib/server/db.js#L117-L181)
- [+server.js (admin):188-233](file://frontend/src/routes/api/admin/+server.js#L188-L233)

## Core Components
- JWT utilities: sign, verify, and extract bearer tokens
- Authentication middleware: enforce auth, optional auth, create session, require admin
- Security utilities: rate limiting, input validation, sanitization
- Database adapter: unified async API for two drivers
- Admin API: endpoints guarded by requireAdmin
- Database schema: users, user_sessions, user_roles, system_settings

Key responsibilities:
- JWT utilities manage token lifecycle and extraction
- Authentication middleware validates tokens against stored sessions and enforces roles
- Security utilities protect endpoints from abuse and sanitize inputs
- Database adapter ensures consistent SQL operations across drivers
- Admin API demonstrates role-based access control

**Section sources**
- [jwt.js:13-42](file://frontend/src/lib/server/jwt.js#L13-L42)
- [auth.js:15-89](file://frontend/src/lib/server/auth.js#L15-L89)
- [security.js:12-53](file://frontend/src/lib/server/security.js#L12-L53)
- [db.js:31-112](file://frontend/src/lib/server/db.js#L31-L112)
- [+server.js (admin):188-233](file://frontend/src/routes/api/admin/+server.js#L188-L233)
- [schema_sqlite.sql:13-68](file://schema_sqlite.sql#L13-L68)

## Architecture Overview
The authentication architecture combines JWT-based identity with DB-backed session validation. Tokens are signed server-side and verified on each request. Sessions are persisted with hashed tokens to detect tampering and expiration.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Hooks as "hooks.server.js"
participant Auth as "auth.js"
participant JWT as "jwt.js"
participant DB as "db.js"
Client->>Hooks : "HTTP Request"
Hooks->>Auth : "requireAuth(request)"
Auth->>JWT : "decodeToken(token)"
JWT-->>Auth : "payload or null"
Auth->>DB : "SELECT session by token_hash"
DB-->>Auth : "session row"
Auth-->>Hooks : "userId or error"
Hooks-->>Client : "Response or 401/403"
```

**Diagram sources**
- [hooks.server.js:105-147](file://frontend/src/hooks.server.js#L105-L147)
- [auth.js:15-44](file://frontend/src/lib/server/auth.js#L15-L44)
- [jwt.js:26-32](file://frontend/src/lib/server/jwt.js#L26-L32)
- [db.js:31-112](file://frontend/src/lib/server/db.js#L31-L112)

## Detailed Component Analysis

### JWT Utilities
- Purpose: encode and decode JWTs, extract bearer tokens
- Configuration: reads secret and expiry from environment
- Behavior: sign with expiry, verify with secret, extract Authorization header

```mermaid
flowchart TD
Start(["getBearerToken(request)"]) --> GetHeader["Read 'authorization' header"]
GetHeader --> HasHeader{"Has header?"}
HasHeader --> |No| ReturnNull["Return null"]
HasHeader --> |Yes| Match["Match 'Bearer <token>'"]
Match --> HasToken{"Match found?"}
HasToken --> |No| ReturnNull
HasToken --> |Yes| ReturnToken["Return token"]
```

**Diagram sources**
- [jwt.js:37-42](file://frontend/src/lib/server/jwt.js#L37-L42)

**Section sources**
- [jwt.js:13-42](file://frontend/src/lib/server/jwt.js#L13-L42)

### Authentication Middleware
- requireAuth(request): extracts token, verifies JWT, checks DB session and expiry
- optionalAuth(request): same as requireAuth but returns null on failure
- createSession(userId, request): signs JWT, hashes token, persists session with IP/user-agent
- requireAdmin(request): requires admin or super_admin role

```mermaid
flowchart TD
A["requireAuth(request)"] --> B["getBearerToken(request)"]
B --> C{"token present?"}
C --> |No| E401a["Throw 401"]
C --> |Yes| D["decodeToken(token)"]
D --> E{"valid payload?"}
E --> |No| E401b["Throw 401"]
E --> |Yes| F["token_hash = sha256(token)"]
F --> G["SELECT session by token_hash"]
G --> H{"session exists?"}
H --> |No| E401c["Throw 401"]
H --> |Yes| I["Compare expires_at vs now"]
I --> J{"expired?"}
J --> |Yes| K["DELETE session and throw 401"]
J --> |No| L["Return user_id"]
```

**Diagram sources**
- [auth.js:15-44](file://frontend/src/lib/server/auth.js#L15-L44)

**Section sources**
- [auth.js:15-89](file://frontend/src/lib/server/auth.js#L15-L89)

### Security Utilities
- Rate limiting: in-memory counter per identifier with window and max requests
- Input validation: email, username, password length
- Sanitization: remove angle brackets and trim whitespace

```mermaid
flowchart TD
S["checkRateLimit(ident)"] --> Load["Load record or create"]
Load --> Reset{"Reset window?"}
Reset --> |Yes| NewWindow["Reset count and resetAt"]
Reset --> |No| Over{"count >= MAX?"}
Over --> |Yes| E429["Throw 429"]
Over --> |No| Inc["Increment count"]
NewWindow --> Ok["Return true"]
Inc --> Ok
```

**Diagram sources**
- [security.js:12-33](file://frontend/src/lib/server/security.js#L12-L33)

**Section sources**
- [security.js:12-53](file://frontend/src/lib/server/security.js#L12-L53)

### Database Adapter
- Driver auto-detection: prefers @libsql/client, falls back to better-sqlite3
- Unified async API: prepare().run/get/all() and transaction(fn)
- Initialization: sets pragmas for WAL, foreign keys, timeouts, cache

```mermaid
classDiagram
class DbAdapter {
+prepare(sql) Stmt
+exec(sql) void
+transaction(fn) Txn
+close() void
}
class Stmt {
+run(args) Promise
+get(args) Promise
+all(args) Promise
}
class Txn {
+() void
}
DbAdapter --> Stmt : "prepare"
DbAdapter --> Txn : "transaction"
```

**Diagram sources**
- [db.js:31-112](file://frontend/src/lib/server/db.js#L31-L112)

**Section sources**
- [db.js:117-181](file://frontend/src/lib/server/db.js#L117-L181)
- [db.js:31-112](file://frontend/src/lib/server/db.js#L31-L112)

### Admin API Access Control
- Endpoints guarded by requireAdmin(request)
- Demonstrates role enforcement and structured updates

```mermaid
sequenceDiagram
participant Client as "Client"
participant Admin as "+server.js (admin)"
participant Auth as "auth.js"
participant DB as "db.js"
Client->>Admin : "PUT /api/admin/..."
Admin->>Auth : "requireAdmin(request)"
Auth->>DB : "SELECT role FROM users WHERE id = ?"
DB-->>Auth : "role"
Auth-->>Admin : "userId or 403"
Admin-->>Client : "JSON response"
```

**Diagram sources**
- [+server.js (admin):188-233](file://frontend/src/routes/api/admin/+server.js#L188-L233)
- [auth.js:79-89](file://frontend/src/lib/server/auth.js#L79-L89)

**Section sources**
- [+server.js (admin):188-233](file://frontend/src/routes/api/admin/+server.js#L188-L233)
- [auth.js:79-89](file://frontend/src/lib/server/auth.js#L79-L89)

### Password Hashing
- Current implementation stores password_hash in users table
- No bcryptjs usage observed in the reviewed files
- Recommendation: adopt bcryptjs for secure hashing and verification

**Section sources**
- [schema_sqlite.sql:13-48](file://schema_sqlite.sql#L13-L48)

### Token Lifecycle
- Creation: createSession signs JWT and stores token_hash with expiry
- Validation: requireAuth decodes JWT, matches token_hash, checks expiry
- Expiration: expired sessions are removed during validation
- Refresh: not implemented; consider rotating tokens or short-lived JWTs with refresh tokens

```mermaid
flowchart TD
T1["createSession(userId, request)"] --> T2["encodeToken(payload)"]
T2 --> T3["token_hash = sha256(token)"]
T3 --> T4["INSERT INTO user_sessions"]
T4 --> T5["Return token"]
U1["requireAuth(request)"] --> U2["decodeToken(token)"]
U2 --> U3["token_hash = sha256(token)"]
U3 --> U4["SELECT session by token_hash"]
U4 --> U5{"expires_at < now?"}
U5 --> |Yes| U6["DELETE session and throw 401"]
U5 --> |No| U7["Return user_id"]
```

**Diagram sources**
- [auth.js:60-74](file://frontend/src/lib/server/auth.js#L60-L74)
- [auth.js:15-44](file://frontend/src/lib/server/auth.js#L15-L44)

**Section sources**
- [auth.js:60-74](file://frontend/src/lib/server/auth.js#L60-L74)
- [auth.js:15-44](file://frontend/src/lib/server/auth.js#L15-L44)

### Roles and Permissions
- Users table includes role field with defaults
- user_roles table supports multi-role assignments
- requireAdmin enforces admin or super_admin

```mermaid
erDiagram
USERS {
int id PK
varchar username
varchar email UK
varchar role
}
USER_ROLES {
int user_id FK
varchar role
}
USERS ||--o{ USER_ROLES : "has"
```

**Diagram sources**
- [schema_sqlite.sql:13-55](file://schema_sqlite.sql#L13-L55)

**Section sources**
- [schema_sqlite.sql:13-55](file://schema_sqlite.sql#L13-L55)
- [auth.js:79-89](file://frontend/src/lib/server/auth.js#L79-L89)

### Authentication Flow: Registration to Protected Access
- Registration: insert user with password_hash and default role
- Login: verify credentials, create session, return token
- Protected access: requireAuth on endpoints; optionalAuth for guest-accessible resources
- Admin access: requireAdmin for administrative endpoints

```mermaid
sequenceDiagram
participant Client as "Client"
participant API as "Auth API"
participant Auth as "auth.js"
participant DB as "db.js"
Client->>API : "POST /api/auth/register"
API->>DB : "INSERT users (username, email, password_hash, role)"
DB-->>API : "success"
API-->>Client : "201 Created"
Client->>API : "POST /api/auth/login"
API->>DB : "SELECT user by email"
DB-->>API : "user row"
API->>Auth : "createSession(user.id, request)"
Auth->>DB : "INSERT user_sessions"
DB-->>Auth : "success"
Auth-->>API : "token"
API-->>Client : "{token}"
Client->>Protected : "GET /resource"
Protected->>Auth : "requireAuth(request)"
Auth->>DB : "SELECT session by token_hash"
DB-->>Auth : "session"
Auth-->>Protected : "userId"
Protected-->>Client : "Resource data"
```

[No sources needed since this diagram shows conceptual workflow, not actual code structure]

## Dependency Analysis
- auth.js depends on jwt.js for token operations and db.js for persistence
- hooks.server.js applies global security headers and guards
- security.js provides shared utilities for rate limiting and validation
- Admin API depends on auth.js for role checks

```mermaid
graph LR
HK["hooks.server.js"] --> AUTH["auth.js"]
AUTH --> JWT["jwt.js"]
AUTH --> DB["db.js"]
SEC["security.js"] --> ADMIN["+server.js (admin)"]
ADMIN --> AUTH
DB --> SCHEMA["schema_sqlite.sql"]
```

**Diagram sources**
- [hooks.server.js:105-147](file://frontend/src/hooks.server.js#L105-L147)
- [auth.js:6-8](file://frontend/src/lib/server/auth.js#L6-L8)
- [jwt.js:5](file://frontend/src/lib/server/jwt.js#L5)
- [db.js:117-181](file://frontend/src/lib/server/db.js#L117-L181)
- [+server.js (admin):188-233](file://frontend/src/routes/api/admin/+server.js#L188-L233)

**Section sources**
- [auth.js:6-8](file://frontend/src/lib/server/auth.js#L6-L8)
- [jwt.js:5](file://frontend/src/lib/server/jwt.js#L5)
- [db.js:117-181](file://frontend/src/lib/server/db.js#L117-L181)
- [+server.js (admin):188-233](file://frontend/src/routes/api/admin/+server.js#L188-L233)

## Performance Considerations
- Session lookup uses token_hash index for O(log n) retrieval
- JWT decoding is CPU-bound; keep payload minimal
- Rate limiter is in-memory; consider external caching for multi-instance deployments
- Database initialization occurs once per process; ensure proper driver selection

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- 401 Unauthorized: missing or invalid/expired token; verify Authorization header and session expiry
- 403 Forbidden: insufficient privileges; ensure user has admin or super_admin role
- 429 Too Many Requests: rate limit exceeded; adjust limits or deploy rate-limiting infrastructure
- Database errors: generic 500 responses; check logs for DB run/get/all errors

**Section sources**
- [auth.js:17-41](file://frontend/src/lib/server/auth.js#L17-L41)
- [auth.js:84-86](file://frontend/src/lib/server/auth.js#L84-L86)
- [security.js:27-29](file://frontend/src/lib/server/security.js#L27-L29)
- [hooks.server.js:154-178](file://frontend/src/hooks.server.js#L154-L178)

## Conclusion
VSocial implements a robust JWT-based authentication system with DB-backed session validation and role-based access control. The design emphasizes explicit token verification, session persistence, and admin safeguards. Recommendations include adopting bcryptjs for password hashing, implementing token refresh strategies, and enhancing rate limiting for distributed environments.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### API Endpoint Specifications
- POST /api/auth/register
  - Request: username, email, password
  - Response: 201 Created or error
  - Notes: Requires system registration enabled; password must meet validation rules
- POST /api/auth/login
  - Request: email, password
  - Response: { token }
  - Notes: On success, creates a session with hashed token and expiry
- GET /api/admin/settings
  - Request: Authorization: Bearer <token>
  - Response: { success, message }
  - Notes: Requires admin or super_admin role
- PUT /api/admin/users/:id
  - Request: Authorization: Bearer <token>, JSON body with allowed fields
  - Response: { success, message }
  - Notes: Requires admin or super_admin role

**Section sources**
- [+server.js (admin):188-233](file://frontend/src/routes/api/admin/+server.js#L188-L233)

### Request/Response Schemas
- Register
  - Body: { username, email, password }
  - Success: 201
- Login
  - Body: { email, password }
  - Success: { token }
- Admin Settings
  - Body: { key: string, value: string|number|boolean }
  - Success: { success: true, message: string }
- Admin Users
  - Body: { role?: string, is_verified?: boolean }
  - Success: { success: true, message: string }

**Section sources**
- [+server.js (admin):188-233](file://frontend/src/routes/api/admin/+server.js#L188-L233)

### Security Considerations and Mitigations
- Use HTTPS/TLS to protect tokens in transit
- Store JWT_SECRET securely and rotate periodically
- Enforce strong password policies and adopt bcryptjs hashing
- Implement token refresh strategies to reduce long-lived tokens
- Add CSRF protection for form submissions
- Apply rate limiting at gateway/proxy for brute-force prevention
- Regularly audit admin endpoints and monitor failed auth attempts

[No sources needed since this section provides general guidance]