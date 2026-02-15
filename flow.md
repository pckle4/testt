# CRM Application — Deep-Dive Flow Documentation

This document explains in theoretical, implementation-agnostic terms how the major features of the CRM application work: search (including the search bar and its debouncing), authentication and token handling, refresh tokens, filtering, sorting, and pagination. Variable names, component names, and API contracts used here match the actual project so you can trace the flow in the codebase.

---

## Table of Contents

1. [Search Bar and Search Logic (Frontend and Backend)](#1-search-bar-and-search-logic-frontend-and-backend)
2. [Authentication: How Tokens Are Taken, Fetched, and Checked](#2-authentication-how-tokens-are-taken-fetched-and-checked)
3. [Refresh Token: Concept, Storage, and End-to-End Flow](#3-refresh-token-concept-storage-and-end-to-end-flow)
4. [Filtering and Sorting: Deep Dive](#4-filtering-and-sorting-deep-dive)
5. [Pagination: Frontend and Backend](#5-pagination-frontend-and-backend)
6. [Extended Deep Dives and Edge Cases](#6-extended-deep-dives-and-edge-cases)
7. [Additional Theory: Request Shapes, JWT Structure, and Data Semantics](#7-additional-theory-request-shapes-jwt-structure-and-data-semantics)
8. [Further Deep Dives: End-to-End Data Travel and Security](#8-further-deep-dives-end-to-end-data-travel-and-security)

---

# 1. Search Bar and Search Logic (Frontend and Backend)

## 1.1 Overview: Two Search Entry Points

The application exposes search in two places:

- **Global header search (main layout):** A modal opened from the header. The user types a query and chooses a filter (All, Name, Email, Company). On submitting (e.g. Enter), the app sets the search state and navigates to the customers list. This bar does not fire HTTP requests itself; it only updates shared state and routes.
- **Customers page search:** An input and a search-field dropdown on the customers list page. This is where the actual search requests are triggered, with debouncing so that typing does not cause a request on every keystroke.

Both paths ultimately drive the same backend API and the same client-side state: the search query string and the search field (all, name, email, or id). The backend uses these to build SQL WHERE clauses and return a filtered, sorted, paginated list.

---

## 1.2 Where Search State Lives (Frontend)

Search state is centralized in a single service so that the header and the customers page stay in sync.

- **CustomerService** holds two pieces of reactive state:
  - **searchQueryState:** The current search text (e.g. what the user typed).
  - **searchFieldState:** Which field to search in: all, name, email, or id.

These are internal signals. The service exposes read-only derived state:

- **searchQuery:** Computed from searchQueryState.
- **searchField:** Computed from searchFieldState.

To change search, call **setSearch(query, field)**. That updates both signals. Any component that reads searchQuery or searchField will react when this state changes.

So: the global header search and the customers page both talk to the same service. When the user submits from the header, the layout calls setSearch with the modal’s query and the selected activeFilter (which maps to searchField), then navigates to the customers route. The customers page already reads searchQuery and searchField from the service; when it sees a change (or on init), it will trigger a fetch. Thus, one source of truth drives both the header “quick search” and the in-page search.

---

## 1.3 Global Header Search: Step-by-Step Flow

- The user opens the search modal (e.g. by clicking the search bar or pressing the shortcut key). The layout keeps an **isSearchOpen** signal; when true, the modal is shown.
- Inside the modal there is an input and a set of filter buttons (All, Name, Email, Company). The selected filter is stored in **activeFilter** (values: all, name, email, company). The placeholder text can reflect this (e.g. “Search by name...”).
- The user types in the input. The input is bound so that on a submit event (e.g. keyup.enter), the layout’s **onSearch** handler runs. That handler reads the current input value and the current activeFilter.
- **onSearch** does two things:
  - Call **CustomerService.setSearch(query, field)**. The field is the activeFilter value (or a mapping of it; e.g. “company” in the UI might map to the same searchField value the backend expects). This updates searchQueryState and searchFieldState.
  - Call **navigateTo('/customers')**, which closes the modal and navigates to the customers list.
- No HTTP request is made from the header. The customers page, when it loads or when it reacts to the service’s search signals, will perform the actual GET request with the new search and searchField.

So the header search is purely state + navigation: set shared search state, then go to the page that uses it.

---

## 1.4 Customers Page Search and Debouncing

On the customers page, the user can type in the search input and change the “search by” dropdown. Here we want to avoid sending a request on every single keystroke.

- The input is bound with **(input)="onSearchInput(value)"**. Every time the user types, onSearchInput is called with the current input value.
- **Debouncing:** The component keeps a **searchDebounceTimer** (a timeout handle). When onSearchInput runs:
  - If there is already a pending timer, it is cleared (clearTimeout).
  - A new timer is started (setTimeout) with a delay of **300 milliseconds**.
  - The timer callback calls **CustomerService.setSearch(value, this.searchField())** and then returns. It does not directly call the HTTP fetch.
- So: rapid typing only resets the timer. The service’s setSearch is invoked only after the user has stopped typing for 300 ms. That is the debounce: we wait for a short “quiet” period before updating the search state.

After setSearch runs, the **searchQuery** and **searchField** signals in the service have new values. The customers page uses an **effect** that depends on these signals. When they change, the effect runs and calls **fetchCustomers** (wrapped in untracked so that the effect does not depend on every signal that fetchCustomers reads). So the sequence is:

1. User types → onSearchInput runs → timer is set/restarted.
2. After 300 ms of no typing → timer fires → setSearch(query, field) → searchQuery and searchField signals change.
3. Effect runs → fetchCustomers() is called.
4. fetchCustomers builds the request (see below) and sends it to the backend.

So debouncing happens entirely on the frontend: the 300 ms delay ensures we do not hit the API on every keystroke, only after the user pauses. The backend does not implement debouncing; it just responds to whatever search and searchField it receives.

---

## 1.5 How the Customers Page Builds the Search Request

When **fetchCustomers** runs (on init, or when search/sort/page changes), it builds the request from:

- **search:** The value of searchQuery() from the service (the search text).
- **searchField:** The value of searchField() from the service (all, name, email, or id). If empty or invalid, it is sent as all so the backend always gets a valid value.
- **page:** Current page index for pagination. The UI often uses 1-based page numbers (currentPage); the API uses 0-based page index, so we send currentPage() - 1.
- **size:** Page size (e.g. pageSize(), often 10).
- **sortBy** and **sortDir:** Only added if the user has selected a sort column and direction (e.g. sortColumn and sortDirection). Otherwise the backend uses its default sort.

These are sent as query parameters on GET to the customers API (e.g. /api/customers). So the frontend does not “filter in memory”; every list view is the result of one API call with the current search, field, page, size, and sort.

---

## 1.6 Backend: Receiving Search Parameters

The **CustomerController** exposes GET on the customers resource. It reads query parameters:

- **search:** Optional, default empty string. The raw search term.
- **searchField:** Optional, default all. Must be one of: all, name, email, id. The controller validates this (e.g. isValidSearchField); if invalid, it falls back to all. This whitelist prevents injection or unexpected column names.
- **page:** 0-based page index; default 0. If negative, the controller clamps it to 0.
- **size:** Page size; default 10. The controller clamps size (e.g. between 1 and 100) so that a client cannot request unbounded or negative sizes.
- **sortBy** and **sortDir:** Optional. sortDir is validated to be asc or desc (case-insensitive); otherwise it is treated as null. sortBy is validated against a whitelist of allowed columns (e.g. id, name, email, company, status, phone). If invalid, sortBy/sortDir are not used and the repository will use default ordering.

So the backend normalizes and sanitizes all inputs before passing them to the service layer.

---

## 1.7 Backend: From Controller to Repository

The controller calls the **CustomerService** method that performs “get all” with search, pagination, and sort. The service receives the validated search, searchField, page, size, sortBy, and sortDir.

- It computes **offset = page * size** (0-based offset for SQL).
- It calls the repository’s **findAll(search, searchField, limit, offset, sortBy, sortDir)** to get the current page of rows.
- It calls the repository’s **count(search, searchField)** to get the total number of rows that match the search (without pagination).

The service then puts into a map: the list of customer DTOs (data), total count (total), page index (page), and size (size). This map is returned as the response body. So the client gets both the slice of data and the total so it can render “Showing X–Y of Z” and build pagination controls.

---

## 1.8 Backend: Building the WHERE Clause (Search / Filter)

The repository implements the actual search logic. It receives search (the term), searchField (all, name, email, id), and for the list query also limit, offset, sortBy, sortDir.

- **Search term normalization:** If search is null or blank after trim, the repository treats it as “no search”: no LIKE clause is added, and the query returns all rows (subject to sort and pagination). If search is non-empty, it is trimmed and lowercased, and a **like** pattern is formed by adding percent signs at the beginning and end (e.g. "%term%") for use in SQL LIKE. This gives substring, case-insensitive matching.

- **WHERE clause construction:** A private method **buildSearchWhereClause(searchField, like)** returns the appropriate SQL fragment:
  - For **searchField = name:** Add a condition like LOWER(name) LIKE ? with one placeholder (the like pattern).
  - For **email:** Same idea with LOWER(email) LIKE ?.
  - For **id:** Use CAST(id AS CHAR) LIKE ? so that the numeric id is compared as a string (e.g. for “12” matching id 12 or 123).
  - For **all** (or default): Add a single combined condition that ORs together LOWER(name) LIKE ?, LOWER(email) LIKE ?, LOWER(company) LIKE ?, and so on for all searchable columns. Each placeholder is bound to the same like pattern so that the same term is searched across columns.

So “filtering” in this context is the same as “search”: one search term, optionally scoped to one field or applied to all fields via one WHERE clause. There is no separate “filter” API; the only variable is search + searchField.

- **Parameter binding:** Another private method **setSearchParams** takes the prepared statement, the current parameter index, searchField, and like. It binds the right number of placeholders (one for name/email/id, or seven for “all”) so that the parameter count matches the WHERE clause. This avoids SQL syntax errors and keeps the query safe from injection because all user input is passed as parameters.

The full SELECT query is then: base table, WHERE 1=1 plus the search WHERE fragment, ORDER BY (see below), LIMIT and OFFSET. The same WHERE fragment (and same setSearchParams logic) is used in both findAll and count so that the total count matches the filtered set.

---

## 1.9 Summary: Search Data Flow

- **Frontend:** User types in either the header search or the customers page search. On the customers page, input is debounced (300 ms); then CustomerService.setSearch updates searchQuery and searchField. An effect calls fetchCustomers(), which sends GET /api/customers with query params search, searchField, page, size, sortBy, sortDir.
- **Backend:** Controller validates and normalizes these params, then calls the service. The service computes offset and calls the repository’s findAll and count. The repository builds a WHERE from search and searchField (with a single like pattern), binds parameters, and runs SELECT with LIMIT/OFFSET and ORDER BY. The response includes data, total, page, and size.
- **Frontend:** The response is used to set the customers list and total count; the table and pagination controls are updated. No code is shown here; this is the theoretical flow using the real variable and method names from the project.

---

# 2. Authentication: How Tokens Are Taken, Fetched, and Checked

## 2.1 High-Level Picture

The application uses JWT-based authentication. The backend issues two tokens on login (and register): an **access token** (short-lived) and a **refresh token** (long-lived). The frontend stores both and sends only the access token with each API request. When the access token expires, the frontend uses the refresh token to obtain a new access token (and optionally a new refresh token) and then retries the failed request. This section focuses on how the access token is obtained, stored, sent, and validated; the next section covers the refresh token in detail.

---

## 2.2 Login: Where the Token Comes From

When the user submits the login form:

- The form collects **email** and **password** (LoginPayload). The frontend sends a POST request to the backend auth login endpoint (e.g. /api/auth/login) with this payload. No token is sent at this point; the login request is unauthenticated.
- The backend **AuthController** receives the request and calls the **UserService** login method with the same email and password.
- The service looks up the user by email (e.g. UserRepository.findByEmail). If no user exists or the password does not match (using the same password encoder used at registration), it throws an exception and the controller returns an error (e.g. 401 or 400). If the user is disabled, it may also throw.
- If the user is valid, the service builds the response. It loads the user’s roles and calls **JwtUtil.generateToken(userId, email, roles)** to create an **access token**. It also calls **JwtUtil.generateRefreshToken(userId, email)** to create a **refresh token**. Both are put into a **UserDTO** (or similar response object) along with user id, name, email, and roles. The controller returns this object in the response body.

So the token is “fetched” in the sense that it is generated at login time and returned in the same HTTP response as the user info. The client does not request the token in a separate step; it gets token, refreshToken, and user data in one response.

---

## 2.3 What Is Inside the Access Token (Backend)

The backend uses a single **JwtUtil** and a secret key (from configuration, e.g. jwt.secret). The key must be at least 32 bytes for HS256.

- **generateToken** (access token) uses a fixed expiration (e.g. 30 minutes in milliseconds). It builds a JWT with:
  - **subject:** The user’s ID (UUID) as a string.
  - **email:** A custom claim with the user’s email.
  - **roles:** A custom claim with the list of role names, typically joined into a single string (e.g. comma-separated) so that it fits in one claim.
  - **issuedAt** and **expiration:** Standard JWT time claims.
  - The token is signed with the secret key (HS256).

So the access token is a signed, time-limited blob that encodes who the user is (userId, email) and what roles they have. The backend never stores this token; it only verifies the signature and the expiration when it receives it.

---

## 2.4 Storing the Token and User on the Frontend (After Login)

When the login HTTP response is successful, the frontend **AuthService** receives the response body. It normalizes it (e.g. mapping roles from array or array of objects to a simple array of role names) into an **AuthResponse** (id, name, email, roles, token, refreshToken). Then it calls **storeAuth(res)**.

- **storeAuth** does the following:
  - Stores the **access token** in **localStorage** under the key **auth_token**. This is the value that will be sent in the Authorization header for every subsequent API call (except login/register/refresh).
  - If the response contains a **refreshToken**, it is stored in localStorage under a dedicated key (e.g. **auth_refresh_token**). The refresh token is never sent with normal API requests; it is only sent to the refresh endpoint when the access token has expired.
  - Builds an **AuthUser** object (id, name, email, roles) and stores it as JSON in localStorage under **auth_user**. This is used to show the current user in the UI without parsing the JWT on the client.
  - Updates the service’s internal **userState** signal with the same AuthUser so that any component reading currentUser or isAuthenticated sees the logged-in user immediately.

So after login, the browser holds: auth_token (access token), auth_refresh_token (refresh token), and auth_user (plain user info). The token is “taken” from the response body and “stored” in localStorage and in memory (userState).

---

## 2.5 How the Token Is Sent With Every Request (Frontend)

The Angular application registers an **HTTP interceptor** (authInterceptor) that runs for every outgoing HTTP request.

- The interceptor reads the current access token from **localStorage.getItem('auth_token')**.
- If a token exists, it clones the request and sets the **Authorization** header to **Bearer &lt;token&gt;**.
- If no token exists, the request is sent unchanged (no Authorization header). The backend will then treat the request as unauthenticated for protected routes.

So the token is “taken” from localStorage on each request and “sent” in the Authorization header. The backend does not look at cookies or any other storage; it only looks at the Authorization header.

---

## 2.6 Backend: How the Token Is Received and Checked

Protected requests hit the backend with the header **Authorization: Bearer &lt;access_token&gt;**.
The backend uses a **JwtFilter** (a once-per-request filter in the Spring Security chain) that runs before the controller.

- The filter reads the **Authorization** header. If it is null or does not start with the string "Bearer ", the filter does nothing and simply continues the chain. The SecurityContext then has no authentication, so any protected endpoint will reject the request (e.g. 401).
- If the header is present and starts with "Bearer ", the filter extracts the token string (the part after "Bearer ").
- It calls **JwtUtil.isValid(token)**. Internally, isValid tries to parse and verify the JWT using the same secret key: it verifies the signature and checks that the token is not expired. If parsing or verification fails (wrong key, tampered token, or expired), isValid returns false. If it succeeds, it returns true.
- If the token is invalid, the filter does not set the SecurityContext; instead it calls the **JwtAuthenticationEntryPoint** so that the response is 401 Unauthorized with an appropriate body. The filter then returns and does not call the rest of the chain for that request.
- If the token is valid, the filter extracts **userId** (from the JWT subject), **email** (from the email claim), and **roles** (from the roles claim, e.g. split by comma into a set). It builds a **UsernamePasswordAuthenticationToken** with principal = userId and authorities = the set of role names (each wrapped as a SimpleGrantedAuthority). It sets this authentication object into **SecurityContextHolder.getContext().setAuthentication(...)**. Optionally it also attaches userId, email, and roles to the request so that controllers can use them. Then the filter continues the chain.

So the token is “checked” by: (1) presence of Bearer header, (2) signature and expiration via JwtUtil, (3) building an in-memory Authentication from the claims. No database lookup is done for the access token itself; all identity and roles come from the JWT. After that, Spring Security’s authorization (e.g. @PreAuthorize("hasAuthority('ADMIN')")) uses the SecurityContext’s authorities to allow or deny access.

---

## 2.7 When the Token Expires or Is Invalid

If the token is missing, malformed, or expired, JwtUtil.isValid returns false (or throws). The filter then triggers the authentication entry point and the HTTP response is **401 Unauthorized**. The frontend receives this 401. It does not show the raw error to the user in normal flow; instead the **auth interceptor** catches the 401 and attempts a **refresh** (see next section). If refresh fails or is not possible, the interceptor calls **AuthService.logout()**, which clears auth_token, auth_refresh_token, and auth_user from localStorage and sets userState to null, then navigates to the auth (login) page. So from the user’s perspective, an expired or invalid token leads either to a silent refresh and retry or to logout and redirect to login.

---

## 2.8 Summary: Authentication Token Flow

- **Obtaining the token:** User logs in (or registers); backend validates credentials and generates access (and refresh) token; frontend receives them in the response body and stores the access token in localStorage under auth_token and the user in auth_user and userState.
- **Sending the token:** Every outgoing HTTP request passes through the auth interceptor, which reads auth_token and, if present, sets Authorization: Bearer &lt;token&gt;.
- **Checking the token:** Backend JwtFilter reads the Bearer token, verifies signature and expiration with JwtUtil, and populates SecurityContext from the JWT claims (userId, email, roles). Protected endpoints then use the SecurityContext for authorization.
- **When it fails:** Backend responds 401; frontend interceptor can try refresh; if that fails, frontend logs out and redirects to login.

---

# 3. Refresh Token: Concept, Storage, and End-to-End Flow

## 3.1 Why Have a Refresh Token?

Access tokens are kept short-lived (e.g. 30 minutes) to limit the damage if a token is stolen. But if the only way to get a new access token were to log in again with password, the user would be logged out every 30 minutes. A **refresh token** is a separate, long-lived credential that is used only to obtain new access tokens. It is stored securely (e.g. in localStorage in this app, or in an HTTP-only cookie in other designs) and sent only to the refresh endpoint. So: access token = used on every API call, short-lived; refresh token = used only to get new access tokens, long-lived. If the refresh token is stolen, an attacker can get new access tokens until it expires or is revoked; that is why refresh tokens are often stored with more care (e.g. httpOnly cookie) or rotated (new refresh token on each refresh). In this project, the refresh token is stored in localStorage alongside the access token and is sent in the body of POST /api/auth/refresh.

---

## 3.2 Where the Refresh Token Is Stored (Frontend)

- On login (and register), the backend includes **refreshToken** in the response. The frontend **storeAuth** writes it to **localStorage** under the key **auth_refresh_token** (the actual key name used in the code). So we have two keys: **auth_token** for the access token and **auth_refresh_token** for the refresh token.
- The AuthService exposes **getRefreshToken()**, which simply returns **localStorage.getItem(auth_refresh_token)** (or the constant that holds that key string). This is used by the interceptor to decide whether to attempt a refresh when a 401 is received.
- On **logout**, the frontend removes both **auth_token** and **auth_refresh_token** (and auth_user). So the refresh token lives only in the browser’s localStorage and is cleared on logout.

---

## 3.3 Where the Refresh Token Is Stored (Backend)

The backend **does not store** the refresh token. It generates it at login (and at refresh) and returns it in the response; it does not persist it in a database or cache. When the client sends the refresh token later, the backend only verifies it as a JWT (signature and expiration). So the refresh token is “stateless”: the server validates it by cryptographic verification, not by looking it up. Revocation (e.g. invalidate all refresh tokens for a user) would require adding server-side state (e.g. a blocklist or a stored token version); in the current design there is no revocation until the refresh token expires (e.g. 24 hours).

---

## 3.4 How the Refresh Token Is Generated (Backend)

In the backend **UserService** (or its implementation), when building the login (or register) response, the code calls **JwtUtil.generateRefreshToken(userId, email)**. The **JwtUtil** builds a JWT with:

- **subject:** The user’s UUID (same as for the access token).
- **email:** A claim with the user’s email.
- **issuedAt** and **expiration:** A longer lifetime than the access token (e.g. 24 hours). No **roles** claim is needed because the refresh endpoint only needs to identify the user to load them from the database and then issue a new access token (with roles) and optionally a new refresh token.

This JWT is signed with the same secret key as the access token. It is returned in the response body (e.g. in the UserDTO’s refreshToken field) and the client stores it.

---

## 3.5 When Does the Frontend Use the Refresh Token?

The refresh token is **not** sent with every request. It is sent only when:

- An API request (that was sent with the current access token) returns **401 Unauthorized**, and
- The request that failed was **not** the refresh request itself (to avoid an infinite loop: refresh fails → 401 → try refresh again → …), and
- There **is** a stored refresh token (getRefreshToken() is not null).

When all these conditions hold, the **auth interceptor** treats the 401 as “access token expired or invalid” and attempts to get a new access token using the refresh token.

---

## 3.6 Refresh Flow Step by Step (Frontend)

- A request (e.g. GET /api/customers) is sent with **Authorization: Bearer &lt;old_access_token&gt;**.
- The backend validates the access token; it is expired or invalid, so the **JwtFilter** does not set the SecurityContext and the **JwtAuthenticationEntryPoint** is invoked. The response is **401**.
- The response is received by the frontend. The **auth interceptor**’s **catchError** sees that the error is an **HttpErrorResponse** with **status === 401**. It then checks: the request URL does not include the refresh path (e.g. /auth/refresh), and **authService.getRefreshToken()** is not null. So it proceeds to refresh.
- The interceptor calls **authService.refreshToken()**. This method:
  - Reads the refresh token from localStorage (getRefreshToken()). If null, it returns an observable that emits null and completes.
  - Sends **POST** to the backend refresh endpoint (e.g. /api/auth/refresh) with body **{ refreshToken: &lt;stored_refresh_token&gt; }**. No Authorization header is sent (or it doesn’t matter; the refresh endpoint is public).
  - The backend responds with a new **UserDTO** (or similar) containing a new **token** (access) and optionally a new **refreshToken**. The frontend normalizes this response and calls **storeAuth(res)** again, which updates **auth_token** and **auth_refresh_token** in localStorage and updates **userState**.
- Back in the interceptor, if **refreshToken()** succeeds and the response contains a new **token**, the interceptor **clones the original request** (the one that got 401), replaces the Authorization header with **Bearer &lt;new_access_token&gt;**, and passes this cloned request to **next(retry)**. So the same operation (e.g. GET /api/customers) is retried once with the new token.
- If the refresh request fails (e.g. 401 because the refresh token is expired) or returns no token, the interceptor calls **authService.logout()** and then rethrows the original error (or the refresh error). The user is logged out and redirected to the login page.

So the full flow is: request → 401 → one refresh attempt → on success, retry request with new token; on failure, logout and redirect. The user may never see the 401 if refresh succeeds.

**Important detail: no Authorization header on refresh.** The refresh request is sent without the expired (or missing) access token. The refresh endpoint is configured as public (permitAll) in the backend security configuration, so the backend does not expect a Bearer token for that call. The only credential sent is the refresh token in the request body. This avoids a chicken-and-egg problem: we cannot send a valid access token because that is exactly what we are trying to obtain.

**Single refresh in flight.** If multiple API requests fail with 401 at the same time (e.g. several tabs or rapid navigation), each could trigger the interceptor. In the current design, each failed request independently calls refreshToken(). So multiple refresh requests could be sent in parallel. The backend would accept each valid refresh token and return new tokens; the last response would overwrite the stored tokens. This is acceptable for many apps; for stricter control one could add a “single refresh in flight” lock so that only one refresh runs and other 401s wait for its result and then retry with the new token.

---

## 3.7 Backend Refresh Endpoint

The **AuthController** exposes **POST /api/auth/refresh** (or similar). It accepts a body with **refreshToken** (e.g. RefreshTokenRequestDTO with a single field refreshToken). This endpoint is configured as **permitAll** in the security configuration so that no access token is required.

- The controller calls **UserService.refreshAccessToken(request)**.
- The service reads the **refreshToken** from the request. If it is null or if **JwtUtil.isValid(refreshToken)** returns false (signature invalid or token expired), it throws (e.g. IllegalArgumentException). The controller then returns an error (e.g. 401 or 400).
- If the refresh token is valid, the service extracts **userId** from the token (e.g. **JwtUtil.getUserId(refreshToken)**). It loads the **User** from the database (e.g. UserRepository.findById(userId)). If the user does not exist, it throws. If the user exists, it builds the same kind of response as login: **getUserDTOWithToken(user)**. That method generates a **new access token** (with current roles from the database) and a **new refresh token**, attaches them to the DTO, and returns. The controller returns this DTO in the response body.

So the backend does not “look up” the refresh token; it only verifies the JWT and then loads the user by ID from the token. The new access token (and optionally the new refresh token) are then sent back. The client stores them and uses the new access token for subsequent requests.

---

## 3.8 Summary: Refresh Token Flow

- **Storage:** Frontend stores refresh token in **localStorage** under **auth_refresh_token**. Backend does not store it; it only verifies it as a JWT.
- **When it’s used:** Only when a non-refresh request returns 401 and a refresh token exists. The interceptor calls **refreshToken()**, which POSTs the refresh token to /api/auth/refresh.
- **Backend:** Validates the refresh JWT, loads user by userId from the token, issues new access (and optionally refresh) token, returns them in the body.
- **Frontend:** Stores the new tokens via **storeAuth**, then retries the original request with the new access token. If refresh fails, **logout()** is called and the user is redirected to login.

---

# 4. Filtering and Sorting: Deep Dive

## 4.1 Filtering in This Application

In this CRM app, “filtering” is implemented as **search**: the user enters a search term and optionally chooses which field to search (all, name, email, id). There is no separate “filter by status” or “filter by date range” in the sense of distinct UI controls that add extra query parameters. So when we say “filtering,” we mean the same search/WHERE logic described in Section 1: one **search** string and one **searchField** that together define which rows match. The backend builds a single WHERE clause from these; the frontend sends them as **search** and **searchField** query parameters. So the flow of “filter” data is: frontend searchQuery and searchField → GET /api/customers?search=...&searchField=... → backend buildSearchWhereClause and setSearchParams → SQL WHERE → filtered result set. The **count** query uses the same WHERE so that pagination totals match the filtered list.

---

## 4.2 Sort Parameters (Frontend)

The customers page keeps **sortColumn** and **sortDirection** (e.g. asc or desc). When the user clicks a column header, **handleSort(column)** is called:

- If the clicked column is already the current sortColumn, the direction is toggled (e.g. desc → asc). If it was already asc, some implementations clear the sort (sortColumn and sortDirection set to null) so that the next click cycles back to default.
- If the clicked column is different, sortColumn is set to that column and sortDirection is set to a default (e.g. desc).

After updating sort state, the page calls **fetchCustomers()**, which includes **sortBy** and **sortDir** in the request params when they are set. So sorting is “server-side”: the client does not sort the current page in memory; it tells the server which column and direction to use, and the server returns a new page of data already ordered.

---

## 4.3 Sort Parameters (Backend)

The **CustomerController** reads **sortBy** and **sortDir** from the query string. It validates:

- **sortDir:** Must be asc or desc (case-insensitive). Otherwise it is treated as null.
- **sortBy:** Must be one of a whitelist of column names (e.g. id, name, email, company, status, phone). This prevents SQL injection and ensures only sortable columns are used.

If either is invalid, it is not passed to the service (or passed as null). The **CustomerService** then calls the repository’s **findAll** with these values. The repository builds the **ORDER BY** clause:

- If both sortBy and sortDir are present, **orderClause** is built as **ORDER BY &lt;sortBy&gt; &lt;sortDir&gt;** (with sortDir normalized to ASC or DESC). The column name is not quoted or concatenated from user input; it comes from the whitelist, so it is safe.
- If either is missing, the repository uses a default, e.g. **ORDER BY id DESC**.

The full SQL is then: SELECT ... WHERE ... orderClause LIMIT ? OFFSET ?. So the same request that applies the search filter also applies the sort. There is no separate “sort” endpoint; filtering and sorting are part of the same list API.

---

## 4.4 Order of Operations (Backend)

Conceptually the backend: (1) applies the WHERE from search and searchField, (2) orders the filtered set by the chosen column and direction, (3) applies LIMIT and OFFSET to that ordered set. So: filter → sort → paginate. The **count** query uses only the WHERE (no ORDER BY, no LIMIT/OFFSET) so the total count is the number of rows that match the filter, regardless of sort or page.

---

# 5. Pagination: Frontend and Backend

## 5.1 Why Pagination

The customers list can be large. Loading all rows at once would be slow and memory-heavy. So the backend returns one “page” at a time (e.g. 10 or 20 rows), and the frontend sends **page** (0-based index) and **size** (page size) with each request. The backend uses LIMIT and OFFSET (or equivalent) to return only that slice. It also returns the **total** number of rows that match the current filter (and sort does not change the total), so the frontend can show “Page 1 of 5” and build next/previous or page-number buttons.

---

## 5.2 Frontend Pagination State

The customers page keeps:

- **currentPage:** 1-based page number (user-facing). So page 1 is the first page.
- **pageSize:** Number of rows per page (e.g. 10).
- **totalFilteredCount:** Total number of rows that match the current search (and optionally other filters). This comes from the API response’s **total** field.

From these it can compute:

- **totalPages:** Ceiling of (totalFilteredCount / pageSize). If totalFilteredCount is 0, totalPages is still at least 1 so that the UI does not show “page 0.”
- **visiblePages:** A list of page numbers (and possibly ellipsis) to show in the pagination control (e.g. 1, …, 3, 4, 5, …, 10). This is derived from currentPage and totalPages so that the user can jump to the first, last, or a few pages around the current one.

When the user clicks “next,” “previous,” “first,” “last,” or a specific page number, the component updates **currentPage** and then calls **fetchCustomers()**. So every page change triggers a new HTTP request with the new page index.

---

## 5.3 How Page Index Is Sent to the Backend

The API uses a **0-based** page index. So when **currentPage** is 1, the frontend sends **page=0**; when currentPage is 2, it sends **page=1**. The conversion is **page: currentPage() - 1** (and **size: pageSize()**). So the backend receives **page** (0-based) and **size**. The backend never sees the 1-based page number; it only sees index and size.

---

## 5.4 Backend: Receiving and Validating Page and Size

The **CustomerController** (or equivalent) reads **page** and **size** from the query string with defaults (e.g. page=0, size=10). It then sanitizes them:

- **page:** If negative, set to 0. So the first page is always 0.
- **size:** If greater than a cap (e.g. 100), set to the cap. If less than 1, set to a default (e.g. 10). This prevents the client from requesting size 0 or a huge size that could overload the database or memory.

These validated values are passed to the service.

---

## 5.5 Backend: Computing Offset and Running the Query

The **CustomerService** (or equivalent) computes **offset = page * size**. For example, page=0, size=10 → offset=0; page=2, size=10 → offset=20. It then calls the repository’s **findAll** (or similar) with **limit = size** and **offset = offset**. The repository runs a SQL query that includes **LIMIT size OFFSET offset**. So the database returns only rows from index **offset** to **offset + size - 1** (in the ordered, filtered set). The same service (or repository) also runs a **count** query with the same WHERE clause but no LIMIT/OFFSET, and returns that count as **total**.

The response body includes: **data** (the list of rows for the current page), **total** (total matching rows), **page** (the 0-based page index that was used), and **size** (the page size). The frontend uses **data** to render the table and **total** to compute totalPages and the “Showing X–Y of Z” text.

---

## 5.6 Resetting Page When Search or Sort Changes

When the user changes the search term or the search field, the result set can change (different rows, different total). If we kept the same currentPage, we might end up on a page that no longer exists (e.g. was page 5 of 5, now only 2 pages). So when **searchQuery** or **searchField** changes, the customers page **resets currentPage to 1** (and then the effect runs and fetchCustomers is called with page=0). Similarly, when the user changes sort, the page is often kept (same page index, but the rows on that page may change because the order changed). In this app, the effect that reacts to search changes resets the page; sort changes typically trigger a fetch without resetting the page. So pagination is tied to the current filter (search) and sort; the frontend ensures that after a new search, we always go back to the first page.

---

## 5.7 Summary: Pagination Flow

- **Frontend:** Keeps currentPage (1-based), pageSize, and totalFilteredCount. Sends page = currentPage - 1 and size = pageSize. On response, sets data and total; total is used for totalPages and “Showing X–Y of Z.”
- **Backend:** Validates page (≥ 0) and size (e.g. 1–100). Computes offset = page * size. Runs SELECT with WHERE and ORDER BY and LIMIT size OFFSET offset; runs COUNT with same WHERE. Returns data, total, page, size in the response.

---

# 6. Extended Deep Dives and Edge Cases

## 6.1 Search: Effect Dependency and Why fetchCustomers Runs

On the customers page, an **effect** is registered in the constructor that depends on **searchQuery()** and **searchField()**. In Angular's signal-based effects, when any of these signals change, the effect runs. Inside the effect, **fetchCustomers()** is called via **untracked()**. The purpose of untracked is to avoid creating a dependency on every signal that fetchCustomers reads (e.g. currentPage, pageSize, sortColumn, sortDirection). So the effect is explicitly "when search state changes, refetch." When the user changes the search field dropdown (e.g. from "All" to "By Name"), **onSearchFieldChange** is called, which calls **setSearch(this.searchQuery(), value)**. That updates searchFieldState; the effect runs; fetchCustomers runs with the new searchField. When the user types and the debounce timer fires, setSearch updates both query and field (field usually unchanged); the effect runs again. When the user navigates from the header search, setSearch was already called with the modal's query and filter; the customers page loads, the effect runs on init (because it depends on searchQuery and searchField), and fetchCustomers runs with that state. So the effect is the glue between "search state changed" and "perform the API call."

## 6.2 Search: Mapping Between UI Filter Labels and Backend searchField

The header search modal has filter buttons with labels like "All," "Name," "Email," "Company." The backend expects **searchField** to be one of: **all**, **name**, **email**, **id**. So "Company" in the UI must map to a backend-accepted value. In the backend, the CustomerRepository's buildSearchWhereClause supports **all**, **name**, **email**, and **id**. There is no separate "company" field in the whitelist for searchField; "company" might be included only under "all" (where the WHERE clause ORs together name, email, company, etc.). So when the UI sends searchField, it must use the exact backend whitelist. The frontend **activeFilter** might use values like **all**, **name**, **email**, **company** for display; when calling setSearch or building the request, "company" might be sent as-is if the backend adds support, or the UI might only offer all/name/email/id. The important point is: the backend **isValidSearchField** only allows **all**, **name**, **email**, **id**. Any other value is replaced with **all** by the controller. So the data flow is: UI filter choice to searchField state to sent as query param **searchField** to backend validates and normalizes to repository uses it to build WHERE.

## 6.3 Search: Clear Search and Resetting Page

The customers page has a "clear" button (e.g. an X) that appears when there is a non-empty search query. When clicked, it calls **clearSearch()**, which in turn calls **setSearch('', 'all')**, sets **currentPage** to 1, and then **fetchCustomers()**. So clearing the search resets both the term and the field to default (empty and all) and forces the user back to the first page. The backend then receives search empty and searchField all; the WHERE clause adds no conditions (because like is null when search is empty), so the full list (paginated) is returned.

## 6.4 Search: Keyboard Shortcut and Modal Open/Close

The main layout listens for a global keydown event. When the key is the slash key (**/**) and the search modal is not open and the user is not typing in an input or textarea (so that typing "/" in a form does not open search), the layout sets **isSearchOpen** to true. When the key is **Escape**, if the modal is open, it closes (isSearchOpen set to false). So the search bar can be opened without clicking (keyboard shortcut) and closed with Escape. The modal content may also have a "Close" button that sets isSearchOpen to false. When the user submits the search (Enter), **navigateTo('/customers')** is called, which also closes the modal (closeSearch or equivalent) and navigates. So the flow is: open modal, type query, choose filter, Enter, setSearch plus close plus navigate to customers.

## 6.5 Auth: Security Configuration and Public vs Protected Routes

The backend **SecurityConfig** defines which paths are **permitAll** (no token required) and which require authentication. Typically **/api/auth/** (login, register, refresh) and **/swagger-ui/** and API docs are permitAll. **/api/admin/** requires the **ADMIN** authority. All other requests (e.g. **/api/customers**) require **authenticated()** — any valid token, any role. So the flow is: request arrives; if path is permitAll, no JwtFilter check needed for access (but the filter still runs; it just does not block the request if there is no token); if path is protected, Spring Security checks SecurityContext; if no authentication, it returns 401 and the entry point is invoked. The JwtFilter only populates SecurityContext when the Bearer token is present and valid; so for protected routes, a valid token is required.

## 6.6 Auth: Role-Based UI and hasAuthority

The frontend **AuthService** exposes **isAdmin** (a computed signal) and **hasRole(role)**. These read **currentUser()** and check whether the **roles** array includes the given role (e.g. "ADMIN"). So the UI can hide or show "Add Customer," "Edit," "Delete" based on **isAdmin()**. The backend enforces the same with **@PreAuthorize("hasAuthority('ADMIN')")** on create/update/delete customer endpoints. So: token contains roles; JwtFilter puts them in SecurityContext as authorities; backend method security checks hasAuthority('ADMIN'); frontend uses the same role from auth_user to show/hide buttons. The data is consistent because the roles in the token (and in auth_user) come from the same source as the backend's SecurityContext.

## 6.7 Auth: Register Flow and Token Issuance

On registration, the frontend sends **RegisterPayload** (name, email, password) to **POST /api/auth/register**. The backend validates email format, password length, and that the email is not already registered. It creates a new **User**, assigns a default role (e.g. SALES_REP), saves the user, and then calls **getUserDTOWithToken(user)** so that the response includes **token** and **refreshToken** just like login. So the user is logged in immediately after registration without a separate login step. The frontend **storeAuth** runs and stores both tokens and auth_user; the user is redirected or kept on the current page depending on the app flow.

## 6.8 Auth: normalizeAuthResponse and Backend Role Shape

The backend may return **roles** as a set or list of **RoleDTO** objects (each with id and name) or as a list of strings. The frontend **normalizeAuthResponse** converts this to a flat array of role name strings: if the value is an array, it maps each element to either the string (if it is already a string) or the **name** property (if it is an object). So the frontend always ends up with **roles: string[]** (e.g. ["SALES_REP", "ADMIN"]). This is what is stored in auth_user and in userState and what **hasRole** and **isAdmin** use. So regardless of how the backend serializes roles, the client has a uniform representation.

## 6.9 Auth: isAuthenticated Computed and auth_token

The **isAuthenticated** computed signal is true when **userState()** is non-null **and** **localStorage.getItem('auth_token')** is non-null. So both in-memory state and the presence of the token are required. This guards against the case where auth_user exists (e.g. from a previous session) but the token was removed (e.g. another tab logged out). The **authGuard** uses **isAuthenticated()** to decide whether to allow access to protected routes; if false, it redirects to **/auth**. So the route guard and any "logged in" UI both rely on this single computed.

## 6.10 Refresh: Token Expiration Constants

On the backend, **JwtUtil** uses two constants: **ACCESS_TOKEN_EXPIRATION** (e.g. 30 minutes in milliseconds) and **REFRESH_TOKEN_EXPIRATION** (e.g. 24 hours). These are used when building the JWTs. So the access token expires quickly to limit exposure; the refresh token lasts longer so the user does not have to log in again every 30 minutes. If the user is inactive for longer than the refresh token lifetime, the next 401 will trigger a refresh attempt that fails (refresh token expired), and the app will logout and redirect to login.

## 6.11 Filtering: Exact searchField Values and buildSearchWhereClause Again

The backend **buildSearchWhereClause(searchField, like)** returns different SQL fragments. For **name**, it returns a string that adds **AND LOWER(name) LIKE ?**. For **email**, **AND LOWER(email) LIKE ?**. For **id**, **AND CAST(id AS CHAR) LIKE ?**. For **all** (and default), it returns a long string with seven placeholders: id, name, email, company, phone, address, status — all ORed together with the same like pattern. So "all" means "match if the search term appears in any of these columns." The **setSearchParams** method then binds the correct number of parameters: one for name, email, or id; seven for all. The order of bindings must match the order of ? in the WHERE clause. This is why the backend uses a switch and explicit index tracking (idx) so that parameter indices stay correct and SQL injection is impossible (all user input is bound as parameters).

## 6.12 Sorting: handleSort Cycle and Default Order

When the user clicks a column header, **handleSort(column)** runs. If the column is already the current **sortColumn**: if **sortDirection** is **desc**, it flips to **asc**; if it is already **asc**, some implementations set **sortColumn** and **sortDirection** to **null** so that the next request goes out without sortBy/sortDir and the backend uses its default (e.g. ORDER BY id DESC). So the UI can cycle: first click to sort desc, second click to sort asc, third click to no sort (default). After each state change, **fetchCustomers()** is called so the server returns the newly ordered page.

## 6.13 Sorting: Whitelist and SQL Safety

The backend **isValidSortColumn** only allows **id**, **name**, **email**, **company**, **status**, **phone**. The repository builds **orderClause** by concatenating **" ORDER BY " + sortBy + " " + orderDirection**. Because sortBy comes from the whitelist, it is never user-supplied free text, so this concatenation is safe. **sortDir** is normalized to **ASC** or **DESC** so it is also one of two literals. So there is no risk of SQL injection from sort parameters.

## 6.14 Pagination: visiblePages Algorithm

The frontend computes **visiblePages** so that the pagination bar shows a subset of page numbers (e.g. 1 ... 4 5 6 ... 20). If **totalPages** is small (e.g. 7 or less), all page numbers are shown. Otherwise, page 1 and the last page are always shown; between them, a window around **currentPage** (e.g. currentPage - 1 to currentPage + 1) is shown, and "..." is used where there is a gap. So the user can always go to first or last and to a few pages around the current one without cluttering the UI with 100 page buttons.

## 6.15 Pagination: First, Last, Previous, Next

The customers page exposes **firstPage()**, **lastPage()**, **prevPage()**, **nextPage()**. **prevPage** decreases **currentPage** by 1 only if currentPage is greater than 1, then calls **fetchCustomers()**. **nextPage** increases **currentPage** by 1 only if currentPage is less than totalPages(), then calls fetchCustomers(). **firstPage** sets currentPage to 1; **lastPage** sets currentPage to totalPages(); both then call fetchCustomers(). So every navigation triggers one new HTTP request with the new page index (0-based in the API).

## 6.16 Pagination: Loading State and Error State

When **fetchCustomers()** is called, the page typically sets **loading** to true and **fetchError** to empty. When the HTTP response arrives (success or error), loading is set to false. On error, fetchError is set to a user-friendly message (e.g. from **getErrorMessage**). So the table can show a loading skeleton or spinner while the request is in flight, and an error banner if the request fails. The pagination controls may be disabled during loading to avoid double requests.

## 6.17 End-to-End Example: User Searches, Sorts, and Changes Page

A complete flow: (1) User opens customers page. ngOnInit and effect run. fetchCustomers with search empty, searchField all, page 0, size 10, no sort. Backend returns first 10 rows and total. (2) User types "acme" in the search box. After 300 ms debounce, setSearch("acme", "all"). Effect runs. fetchCustomers with search=acme, searchField=all, page=0 (currentPage reset to 1 when search changed), size=10. Backend builds WHERE with seven ORed LIKE percent acme percent conditions, runs LIMIT 10 OFFSET 0, returns matching rows and total. (3) User clicks "Company" column header. handleSort("company"). sortColumn=company, sortDirection=desc. fetchCustomers with same search and page, plus sortBy=company, sortDir=desc. Backend adds ORDER BY company DESC, returns same page of data reordered. (4) User clicks next page. currentPage becomes 2. fetchCustomers with page=1 (0-based), same size and search and sort. Backend returns OFFSET 10, next 10 rows. All of this uses the same GET /api/customers endpoint with different query parameters; no code is shown, but the variable names and flow match the project.

---

# 7. Additional Theory: Request Shapes, JWT Structure, and Data Semantics

## 7.1 HTTP Request Shape for GET /api/customers

The frontend builds the URL and query string so that the backend receives a single GET request. The base URL comes from **environment.apiUrl** (e.g. http://localhost:8080/api). The path is **/customers**. The query parameters are appended: **search**, **searchField**, **page**, **size**, and optionally **sortBy** and **sortDir**. So the full request might look like: GET /api/customers?search=acme&searchField=all&page=0&size=10&sortBy=company&sortDir=desc. The backend controller parses these from the request; Spring maps them to method parameters via **@RequestParam** with **required = false** and **defaultValue** so that missing params get sensible defaults. The frontend uses **URLSearchParams** or equivalent to build the query string from the current signal values. So the contract is: same parameter names on both sides; frontend sends what the backend expects.

## 7.2 HTTP Response Shape for GET /api/customers

The backend returns a **Map** (or JSON object) with keys **data**, **total**, **page**, **size**. **data** is the array of customer objects for the current page (each with id, name, email, phone, address, company, status). **total** is the total number of rows that matched the WHERE clause (before LIMIT/OFFSET). **page** and **size** echo back the pagination parameters that were used. The frontend then sets **customersList** (or equivalent) to **response.data**, and **totalFilteredCount** to **response.total**. So the UI always has the current page of data and the total count; it never holds the full list in memory when the list is large.

## 7.3 JWT Structure: Header, Payload, Signature

A JWT has three parts separated by dots: header, payload, signature. The **header** typically indicates the algorithm (e.g. HS256). The **payload** (claims) holds the **subject** (sub), which in this app is the user’s UUID; **email**; **roles** (as a comma-separated string); **issuedAt** (iat) and **expiration** (exp). The backend **JwtUtil** builds this with **Jwts.builder()**, sets these claims, and signs with the secret key. The **signature** ensures that any tampering (e.g. changing the userId or roles) invalidates the token when the backend verifies it with **validateToken**. So the token is self-contained: the server does not need to look up the user in a session store; it only needs the shared secret to verify the signature and then reads identity from the claims.

## 7.4 Why the Access Token Contains Roles

The backend puts **roles** into the access token so that authorization decisions (e.g. @PreAuthorize("hasAuthority('ADMIN')")) can be made without a database call. When the **JwtFilter** runs, it parses the token, extracts the roles claim (e.g. split by comma), and builds **SimpleGrantedAuthority** for each. These are set on the **UsernamePasswordAuthenticationToken** and stored in the **SecurityContext**. When a controller method has **@PreAuthorize("hasAuthority('ADMIN')")**, Spring Security checks the current authentication’s authorities. So the flow is: token → filter extracts roles → SecurityContext holds authentication with those authorities → method security allows or denies. If roles were not in the token, the backend would have to load the user from the database on every request to know the roles; putting them in the token avoids that.

## 7.5 Refresh Token Payload: No Roles

The **refresh token** is built with **generateRefreshToken(userId, email)**. It contains **subject** (userId), **email**, **issuedAt**, and **expiration**. It does **not** contain **roles**. When the client sends the refresh token to **POST /api/auth/refresh**, the backend only needs to identify the user (via userId) and load them from the database. The **getUserDTOWithToken** then builds a **new** access token with the **current** roles from the database. So if an admin revokes a role from a user, the next time the user refreshes, the new access token will have the updated roles. The refresh token itself is only used to prove identity and get a new access token; it does not carry authorization data.

## 7.6 Secret Key and HMAC

The backend uses a **secret key** (from **jwt.secret** in application properties) to sign JWTs. The key must be at least 32 bytes (256 bits) for HS256. **JwtUtil** converts the string to bytes and builds a **SecretKey** with **Keys.hmacShaKeyFor(...)**. The same key is used to **sign** when generating tokens and to **verify** when parsing tokens. If the key is compromised, an attacker could forge tokens. So the key is kept server-side only and never sent to the client. The client only ever sees the opaque token string; it cannot extract or change the payload without invalidating the signature.

## 7.7 OncePerRequestFilter and Filter Order

The **JwtFilter** extends **OncePerRequestFilter**, so it runs at most once per HTTP request. It runs early in the Spring Security filter chain (before the DispatcherServlet invokes the controller). When the filter runs, it reads the **Authorization** header; if there is a Bearer token, it validates and sets the SecurityContext; then it calls **chain.doFilter** so the request continues. If the token is invalid, it calls the **JwtAuthenticationEntryPoint** and does **not** call chain.doFilter, so the controller is never reached and the response is 401. So the filter is the gatekeeper: valid token → SecurityContext set → request proceeds; invalid or missing token on a protected path → 401.

## 7.8 SQL Semantics: LIKE and Case-Insensitivity

The backend builds **like** as **"%" + search.trim().toLowerCase() + "%"**. So the search term is trimmed, lowercased, and wrapped in percent signs. In the SQL, the condition is **LOWER(column) LIKE ?** and the bound value is that lowercased pattern. So the search is **case-insensitive** and **substring**: "ACME" in the DB will match search "acme" or "acm" because both sides are compared in lower case and the percent signs allow any characters before and after. The **id** column uses **CAST(id AS CHAR) LIKE ?** so that numeric id is treated as text for matching (e.g. search "12" can match id 12 or 123 depending on the pattern).

## 7.9 LIMIT and OFFSET in the Repository

The repository method **findAll(search, searchField, limit, offset, sortBy, sortDir)** receives **limit** (same as **size**) and **offset** (computed as **page * size**). The SQL appends **LIMIT ? OFFSET ?** with these values. So for page=2, size=10, offset=20: the database skips the first 20 rows (of the filtered and ordered set) and returns the next 10. This is **offset-based pagination**. The **count** query has no LIMIT or OFFSET; it returns the total number of rows that match the WHERE clause. So the frontend can compute how many pages there are: totalPages = ceil(total / size).

## 7.10 CORS and the Authorization Header

The backend **SecurityConfig** (or CORS config) allows origins such as **http://localhost:4200** (the Angular dev server) and **http://localhost:8080**. It allows methods GET, POST, PUT, DELETE, OPTIONS, PATCH and headers including **Authorization**. It also **setExposedHeaders("Authorization")** so that if the server ever sends back a new token in the response header, the browser would allow the frontend to read it. In this app, tokens are exchanged in the response **body** (login, refresh), not in headers, but the CORS setup is consistent with sending the Authorization header on every request from the SPA.

## 7.11 Why 401 Triggers Refresh and Not 403

**401 Unauthorized** means “not authenticated” (no valid identity). **403 Forbidden** means “authenticated but not allowed” (e.g. missing ADMIN role). The backend returns 401 when the JWT is missing, invalid, or expired. It returns 403 when the user is authenticated but does not have the required authority (e.g. non-admin calling an admin-only endpoint). The frontend interceptor only tries **refresh** on **401**, because 401 indicates “your access token is no good,” so we might get a new one with the refresh token. On **403**, we do not refresh; the user simply does not have permission, and a new token would not help. So the interceptor’s condition is explicitly **err.status === 401**.

## 7.12 Logout and Clearing All Auth State

When **logout()** is called (e.g. user clicks Logout or refresh fails), the frontend removes **auth_token**, **auth_refresh_token**, and **auth_user** from localStorage and sets **userState** to null. Then it navigates to **/auth**. So the next time the user tries to access a protected route, **isAuthenticated()** is false (no token, no user), and the **authGuard** redirects to /auth. Any in-flight request that had the old token would get 401 if retried; but after logout we are not retrying, we are leaving the app flow. So logout is a full clear of client-side auth state plus redirect.

## 7.13 loadOrCreateMockUser and Initial State

On app bootstrap, **AuthService** initializes **userState** with **loadOrCreateMockUser()**. That method calls **loadStoredUser()**, which reads **auth_user** from localStorage and parses it as JSON. If that succeeds and returns an object, that becomes the initial userState. If there is nothing in localStorage or parse fails, initial state is null. So when the user refreshes the page, the UI can show the current user (name, roles) from localStorage without waiting for an API call. The **access token** is still in **auth_token**; the next API request will send it. So the app “remembers” the user across page reloads as long as localStorage is not cleared.

## 7.14 Error Handling: getErrorMessage and User Visibility

When an HTTP request fails, the frontend does not show the raw error message or status code to the user. Instead it uses **getErrorMessage(err, fallback)** (or equivalent) to produce a safe, user-friendly string. So network errors, 500s, or backend exception messages are not exposed; the user sees something like “Unable to load customers. Please try again.” This avoids leaking internal details and improves UX. The same pattern is used for login errors (e.g. “Invalid email or password” instead of the exact backend message) and for refresh failure (user is logged out and sent to login, not shown a raw 401).

## 7.15 Concurrency: Multiple 401s and Refresh

If two or more API requests fail with 401 at roughly the same time (e.g. token just expired), each will trigger the interceptor’s catchError. Each might then call **authService.refreshToken()** and send a separate POST to /api/auth/refresh. So multiple refresh requests can be in flight. The backend will accept each valid refresh token and return new tokens. The frontend will call **storeAuth** for each response, so the last response wins. This is usually acceptable: the user gets a new token and subsequent requests succeed. A more advanced approach would serialize refresh (e.g. only one refresh at a time; others wait and retry with the new token from the first refresh).

## 7.16 Summary of All Storage Keys

- **auth_token:** Access token (JWT). Sent in Authorization header on every API request (except login, register, refresh). Cleared on logout.
- **auth_refresh_token:** Refresh token (JWT). Sent only in the body of POST /api/auth/refresh. Cleared on logout.
- **auth_user:** JSON string of **AuthUser** (id, name, email, roles). Used to display current user in the UI and to compute isAuthenticated and hasRole. Cleared on logout. Updated when login, register, or refresh succeed (and when the user edits profile in the UI).

## 7.17 Table of Variable and Key Names (Quick Reference)

| Concept | Frontend | Backend |
|--------|----------|---------|
| Access token storage | localStorage key **auth_token** | Not stored; verified per request |
| Refresh token storage | localStorage key **auth_refresh_token** | Not stored; verified when used |
| User info storage | localStorage key **auth_user**; signal **userState** | User entity in DB |
| Search text | **searchQueryState** / **searchQuery** | Query param **search** |
| Search field | **searchFieldState** / **searchField** | Query param **searchField** (all/name/email/id) |
| Page (UI) | **currentPage** (1-based) | — |
| Page (API) | Sent as **page** (0-based) | **page** (0-based), then **offset = page * size** |
| Page size | **pageSize** | **size**; validated 1–100 |
| Sort column | **sortColumn** | **sortBy**; whitelist |
| Sort direction | **sortDirection** (asc/desc) | **sortDir** (ASC/DESC) |
| Total count | **totalFilteredCount** from response **total** | **total** from COUNT query |
| List data | **customersList** from response **data** | **data** from SELECT with LIMIT/OFFSET |

---

# 8. Further Deep Dives: End-to-End Data Travel and Security

## 8.1 Data Travel: From User Keystroke to Rendered Row

When the user types in the customers page search box, the following happens in order. (1) **Input event** fires; **onSearchInput(value)** runs with the new string. (2) The previous **searchDebounceTimer** (if any) is cleared; a new timer is scheduled for 300 ms later. (3) After 300 ms with no new input, the timer callback runs and calls **customerService.setSearch(value, searchField())**. (4) **searchQueryState** and **searchFieldState** are updated in the service. (5) The **effect** on the customers page runs because it depends on **searchQuery()** and **searchField()**; inside the effect, **fetchCustomers()** is invoked via **untracked**. (6) **fetchCustomers** builds **URLSearchParams** with search, searchField, page (currentPage - 1), size; if sortColumn and sortDirection are set, it adds sortBy and sortDir. (7) **HttpClient.get** is called with the full URL and params. (8) The **authInterceptor** runs; it reads **auth_token** from localStorage and clones the request with **Authorization: Bearer &lt;token&gt;** (unless the request is to a public path). (9) The HTTP request is sent over the network to the backend. (10) The backend **CustomerController** receives the request; Spring parses query params into **search**, **searchField**, **page**, **size**, **sortBy**, **sortDir**. (11) The controller validates and normalizes (e.g. size 1–100, searchField whitelist, sortBy whitelist, sortDir asc/desc). (12) **CustomerService.getAll** is called with these values. (13) The service computes **offset = page * size** and calls **CustomerRepository.findAll** and **CustomerRepository.count** with the same search and searchField. (14) The repository builds the SQL WHERE from **buildSearchWhereClause(searchField, like)** and ORDER BY from sortBy/sortDir (or default id DESC), then runs SELECT with LIMIT and OFFSET and a separate COUNT query. (15) The database returns rows and the count; the repository maps rows to **Customer** entities; the service maps them to DTOs and puts them in a map with keys data, total, page, size. (16) The controller returns this map as the response body (JSON). (17) The response travels back over the network. (18) The frontend **subscribe** callback runs; **customersList.set(res.data)** and **totalFilteredCount.set(res.total)** and **loading.set(false)**. (19) Angular change detection runs; the template re-renders; the table shows the new rows and the pagination bar shows the updated total and “Showing X–Y of Z.” So one keystroke (after debounce) triggers a long chain: signal update → effect → HTTP request → interceptor → backend controller → service → repository → SQL → response → signal update → re-render.

## 8.2 Data Travel: From Login Form to Authenticated Request

When the user submits the login form: (1) The form emits **LoginPayload** (email, password). (2) The auth page (or parent) calls **authService.login(payload)**. (3) **AuthService** sends **POST /api/auth/login** with the payload in the body (no Authorization header). (4) The request is sent (the auth interceptor may still run but there is no token yet, so no header is added). (5) The backend **AuthController** receives the request and calls **UserService.login**. (6) The service loads the user by email, checks password with **passwordEncoder.matches**, and if valid calls **getUserDTOWithToken(user)**. (7) **getUserDTOWithToken** generates **token** (access) and **refreshToken** via **JwtUtil**, attaches them to the UserDTO along with id, name, email, roles, and returns. (8) The controller returns this DTO; the response body is serialized as JSON. (9) The response arrives at the frontend. (10) **AuthService**’s **login** pipe uses **map(normalizeAuthResponse)** so the raw response is converted to **AuthResponse** (id, name, email, roles, token, refreshToken). (11) The **tap** operator calls **storeAuth(res)**: **localStorage.setItem('auth_token', res.token)**, **localStorage.setItem('auth_refresh_token', res.refreshToken)** (if present), **localStorage.setItem('auth_user', JSON.stringify(user))** where user is **AuthUser** (id, name, email, roles), and **userState.set(user)**. (12) The **tap** also calls **router.navigateByUrl('/dashboard')**. (13) The user is now on the dashboard; **isAuthenticated()** is true because userState is set and auth_token exists. (14) When the user navigates to the customers page or any protected route, the **authGuard** allows it because **isAuthenticated()** is true. (15) When **fetchCustomers** (or any API call) runs, the **authInterceptor** reads **auth_token** and adds **Authorization: Bearer &lt;token&gt;** to the request. So the login response carries the tokens and user; the frontend stores them once; every subsequent request automatically carries the access token until it expires or the user logs out.

## 8.3 Data Travel: From 401 to Retry with New Token

When a request returns 401: (1) The **authInterceptor**’s **catchError** receives the error. (2) It checks: **err instanceof HttpErrorResponse**, **err.status === 401**, the request URL does **not** include **/auth/refresh**, and **authService.getRefreshToken()** is not null. (3) If all true, it calls **authService.refreshToken()**. (4) **refreshToken()** reads **localStorage.getItem('auth_refresh_token')**; if null it returns **of(null)**. (5) Otherwise it sends **POST /api/auth/refresh** with body **{ refreshToken: &lt;stored_refresh_token&gt; }** (no Authorization header). (6) The backend **AuthController** calls **UserService.refreshAccessToken(request)**. (7) The service reads **request.getRefreshToken()**, calls **jwtUtil.isValid(refreshToken)** (signature and expiration); if invalid it throws. (8) It then calls **jwtUtil.getUserId(refreshToken)** to get the UUID from the token’s subject, and **userRepository.findById(userId)** to load the user. (9) It calls **getUserDTOWithToken(user)** which generates a **new** access token and **new** refresh token and returns the DTO. (10) The controller returns this DTO. (11) The frontend **refreshToken()** pipe receives the response, **map(normalizeAuthResponse)**, **tap(storeAuth)** so the new token and refreshToken are written to localStorage and userState is updated. (12) Back in the interceptor, **switchMap** receives the result; if **res?.token** exists, it clones the **original** request (the one that got 401) with **setHeaders: { Authorization: 'Bearer ' + res.token }** and passes it to **next(retry)**. (13) The retry request is sent; the backend now sees a valid token and processes the request successfully. (14) The observable returned by **next(retry)** emits the successful response; the subscriber (e.g. fetchCustomers) receives the data as if the first request had succeeded. So the user never sees the 401; they see the data after a brief delay (one round-trip for refresh plus one for retry). If the refresh fails (e.g. refresh token expired), **refreshToken()** emits null or the inner observable errors; the interceptor then calls **authService.logout()** and rethrows, so the original error propagates and the user is redirected to login.

## 8.4 Security: Why We Do Not Send the Refresh Token on Every Request

The refresh token is long-lived and has the power to issue new access tokens. If it were sent on every request (e.g. in a header), it would be exposed as often as the access token and could be stolen by the same mechanisms (e.g. XSS, malicious script). By sending it **only** to the refresh endpoint and only when we need a new access token (after a 401), we reduce its exposure. The access token is short-lived, so even if it is leaked, the window of abuse is limited. So the design is: access token in every request (necessary for auth), refresh token only when refreshing (minimal exposure).

## 8.5 Security: XSS and localStorage

Both **auth_token** and **auth_refresh_token** are stored in **localStorage**. Any script running in the same origin (e.g. injected via XSS) can read localStorage and steal the tokens. So the app must prevent XSS (sanitize inputs, use CSP, avoid eval, etc.). If the backend supported it, storing the refresh token in an **httpOnly** cookie would prevent JavaScript from reading it, so XSS could not steal the refresh token; the access token might still be in memory or a non-httpOnly cookie depending on design. In the current project, both tokens are in localStorage, so XSS mitigation is critical.

## 8.6 Filtering vs Search: Terminology

In this document and in the project, “filtering” and “search” are used to mean the same thing: the user supplies a **search** string and a **searchField** (all, name, email, id), and the backend restricts rows with a WHERE clause built from that. There is no separate “filter” for status or date range in the customers list API; everything goes through the single **search** and **searchField** parameters. So when we say “filtering,” we mean “the set of rows that match the search.” Sorting is separate: it only affects the **order** of those rows, not which rows are included. Pagination then takes a slice of that ordered set.

## 8.7 Pagination: Why total Is Returned With Every Request

The frontend needs to know the **total** number of matching rows to compute **totalPages** and to show “Showing X–Y of Z.” The backend could expose a separate “count” endpoint, but then the frontend would have to make two requests (one for data, one for count) whenever the search or filter changes, and the two could get out of sync. By returning **total** in the same response as **data**, the backend guarantees that the count corresponds exactly to the query that produced the current page. So one request gives both the page of rows and the total; the frontend stores **totalFilteredCount** and uses it for the pagination UI.

## 8.8 Default Sort and Default Page

When the user has not chosen a sort, the frontend sends no **sortBy** or **sortDir** (or sends them as null/empty). The backend then uses a default **orderClause**, e.g. **ORDER BY id DESC**, so the newest customers (by id) appear first. When the user has not changed the page, **currentPage** is 1, so **page** sent is 0 and **offset** is 0. So the first load of the customers page shows the first page of the default-ordered list (or the first page of the search result if the user came from the header search with a query).

## 8.9 What Happens When search Is Empty

When **search** is empty (or only whitespace), the frontend still sends it (e.g. empty string). The backend **CustomerRepository** checks: if **search** is null or blank after trim, it sets **like** to null. When **like** is null, **buildSearchWhereClause** returns an empty string (no AND clauses), and **setSearchParams** does not bind any parameters. So the SQL has no WHERE conditions (other than the constant 1=1 if used); the query returns all rows (subject to ORDER BY and LIMIT/OFFSET). So an empty search means “no filter”; the user sees the full list (paginated).

## 8.10 What Happens When the User Clears the Search Field Dropdown

If the frontend allowed clearing the search field (e.g. no selection), it would need to send a value the backend accepts. The backend **isValidSearchField** rejects any value not in the whitelist and replaces it with **all**. So if the frontend sent an empty or unknown **searchField**, the backend would treat it as **all**. The UI typically keeps a default selection (e.g. “All Fields”) so **searchField** is always one of all, name, email, id (or company if the backend adds it). So there is no “no field” state; there is “all” which means search across all columns.

---

# Document End

This concludes the deep-dive flow documentation for the CRM application search bar, authentication, refresh tokens, filtering, sorting, and pagination. All flows are described using the actual variable names, method names, and API contracts used in the project so that you can map this theory directly to the codebase.

This concludes the deep-dive flow documentation for the CRM application’s search bar, authentication, refresh tokens, filtering, sorting, and pagination. All flows are described using the actual variable names, method names, and API contracts used in the project so that you can map this theory directly to the codebase.
