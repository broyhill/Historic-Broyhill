# Adobe Firefly Services SDK Core (`@adobe/firefly-services-sdk-core` v2.0.0)
## Comprehensive Reverse Engineering & Architectural Inspection Report

**Investigation Date:** October 22, 2026  
**Analyzed Target:** `/Users/Broyhill/rea-workspace/targets/firefly-core/package`  
**REA Engine:** REA 6.7.0 (`/Users/Broyhill/rea-workspace/rea-local/node_modules/.bin/rea`)  
**Generated Evidence:** `/Users/Broyhill/rea-workspace/evidence/firefly-core-6.7.0-evidence.json`  
**Inventory Directory:** `/Users/Broyhill/rea-workspace/inventory/firefly-core/`  

---

## 1. Executive Summary & Verification Findings

An exhaustive forensic analysis and architectural inspection of the unpacked Adobe Firefly Services SDK Core library (`@adobe/firefly-services-sdk-core` version `2.0.0`) was conducted using local shell diagnostics and the REA 6.7.0 static analysis engine.

### Key Inspection Results:
1. **Binary Wrapper / Leading Byte Audit:**
   - Every `.js` (14 files) and `.json` (1 file) within `targets/firefly-core/package` was scanned at the byte level (first 200 bytes).
   - **Result:** No leading `S` character, no proprietary binary wrappers, no bytecode headers, and no obfuscation layers were detected. All `.js` files start with `"use strict";\n/***********************************` and `package.json` starts with standard ASCII `{`.
2. **REA 6.7.0 Engine Execution & Evidence Record:**
   - **Evidence ID:** `ev_5602876a9555af24e4e84cc5a52e4cdec037083fd5eebe882ca290f40034c5ca`
   - **Provider:** `rea-javascript-application` (Version 1)
   - **Authority:** `shipped-artifact` | **Confidence:** `derived`
   - **Target Artifacts Analyzed:** 29 application files (28 parsed JavaScript / TypeScript definition files, 1 package JSON file, 4,097 visited AST nodes, 167 findings, 0 parse failures).
   - **Runtime Boundaries:** REA confirmed 0 native addon bindings, 0 preload entrypoints, 0 browser windows, and 0 IPC channels—establishing that the package is an environment-agnostic transport foundation suitable for Node.js (>=18), modern browsers, and edge runtimes.
3. **Artifact Composition:**
   - **Total Files:** 30 files in the distribution package.
   - **Source Breakdown:** 14 `.js` CommonJS runtime files, 14 `.d.ts` TypeScript declaration files, 1 `.json` manifest (`package.json`), and 1 `README.md`.
   - **Absence of Other Languages:** 0 Python (`.py`), 0 SQL (`.sql`), and 0 YAML (`.yaml`/`.yml`) files are present.

---

## 2. Package Architecture, Tech Stack & Dependencies

### Package Metadata
- **Package Name:** `@adobe/firefly-services-sdk-core`
- **Version:** `2.0.0`
- **License:** `Copyright (c) 2024 Adobe Inc`
- **Author:** `Adobe`
- **Homepage:** `https://github.com/Firefly-Services/firefly-services-sdk-js/blob/main/packages/cc-apis/core/README.md`
- **Repository:** `https://github.com/Firefly-Services/firefly-services-sdk-js`
- **Entrypoints:**
  - Public Main: `dist/index.js` (`dist/index.d.ts`)
  - Internal Main: `dist/internal.js` (`dist/internal.d.ts`)
- **Package Exports Configuration:**
  ```json
  "exports": {
    ".": "./dist/index.js",
    "./internal": "./dist/internal.js"
  },
  "typesVersions": {
    "*": {
      "internal": [
        "./dist/internal.d.ts"
      ]
    }
  }
  ```
- **Supported Engines:** Node.js `>=18.0.0`

### Runtime Dependencies
- **Zero External Runtime Dependencies (`dependencies: {}`):**  
  The core SDK is completely self-contained. It relies exclusively on web standards natively available in modern runtimes (Node.js 18+, modern browsers, and edge environments):
  - Global `fetch` (used by `sendRequest` in `dist/core/request.js`)
  - Global `Headers`, `Response`, `FormData`, `Blob`
  - Global `AbortSignal` for request cancellation
  - Environment-agnostic base64 encoding (`btoa` with fallback to Node's `Buffer.from`)

### Build System & Toolchain
- **Monorepo Manager:** Microsoft Rush (`rushx clean && rushx ibuild`)
- **Transpiler:** TypeScript Compiler `tsc` (v5.2.2)
- **Cleaner:** `rimraf` (v3.0.2)

---

## 3. Directory Structure & File Classification

### Directory Tree Overview
```
package/
├── dist/
│   ├── core/
│   │   ├── ApiError.d.ts & .js (1,496 & 1,189 bytes)
│   │   ├── ApiRequestOptions.d.ts & .js (1,269 & 811 bytes)
│   │   ├── ApiResponse.d.ts & .js (1,069 & 811 bytes)
│   │   ├── AsyncJobPromise.d.ts & .js (3,243 & 5,035 bytes)
│   │   ├── BaseHttpRequest.d.ts & .js (1,124 & 976 bytes)
│   │   ├── BaseServiceClient.d.ts & .js (1,574 & 2,525 bytes)
│   │   ├── CoreTypes.d.ts & .js (2,254 & 811 bytes)
│   │   ├── Deferred.d.ts & .js (1,719 & 2,471 bytes)
│   │   ├── FetchHttpRequest.d.ts & .js (1,281 & 1,399 bytes)
│   │   ├── request.d.ts & .js (2,620 & 12,233 bytes)
│   │   ├── ServiceTypes.d.ts & .js (976 & 811 bytes)
│   │   └── Utils.d.ts & .js (969 & 1,114 bytes)
│   ├── index.d.ts & .js (986 & 811 bytes)
│   └── internal.d.ts & .js (1,048 & 1,885 bytes)
├── package.json (1,029 bytes)
└── README.md (568 bytes)
```

### Classification Breakdown:
| File Category | Count | Primary Roles & Characteristics |
|:---|:---:|:---|
| **Python (`.py`)** | **0** | Pure TypeScript/JavaScript client core. |
| **SQL (`.sql`)** | **0** | Stateless HTTP transport library; no local SQL databases. |
| **YAML (`.yaml`/`.yml`)** | **0** | No YAML configuration or specification files. |
| **JSON (`.json`)** | **1** | `package.json` (NPM package manifest). |
| **TypeScript (`.d.ts`)**| **14** | 2 barrel type definitions (`index.d.ts`, `internal.d.ts`) + 12 subsystem definition files in `core/`. |
| **JavaScript (`.js`)** | **14** | 2 barrel runtime entrypoints (`index.js`, `internal.js`) + 12 CommonJS modules in `core/`. |
| **Markdown (`.md`)** | **1** | `README.md` (overview and documentation link). |
| **Total Artifacts** | **30** | Verified package artifact count. |

---

## 4. Architectural Subsystems & Transport Engine Deep-Dive

`@adobe/firefly-services-sdk-core` provides the shared runtime foundation across the entire Adobe Firefly Services SDK family (`@adobe/firefly-apis`, `@adobe/photoshop-apis`, `@adobe/lightroom-apis`, `@adobe/content-tagging-apis`).

### 1. `BaseServiceClient` Subsystem (`dist/core/BaseServiceClient.js`)
All product clients (such as `FireflyClient`) inherit from `BaseServiceClient`.
- **Configuration Validation (`validateServiceConfig`):**
  - Asserts that `config.baseUrl` is a non-empty string; throws `Error("Internal Error: Invalid Domain")` otherwise.
  - Asserts that `config.clientId` is a non-empty string; throws `Error("config.clientId is not valid")` otherwise.
  - Automatically merges `"x-api-key": config.clientId` into `config.headers`.
- **Environment & URL Computation:**
  - `BaseServiceClient.getBaseUrl(urlMap: Map<string, string>, environment: string): string`: Looks up the environment URL. Throws `Error("Unsupported environment: <env>")` if unmapped.
  - `BaseServiceClient.getEnvFromVersion(version: string): string`: Checks if `version.toLowerCase().includes("beta")` -> returns `"beta"`, otherwise returns `"production"`.
- **HTTP Engine Association:** Instantiates an internal `FetchHttpRequest` assigned to `this._httpRequest`.

### 2. Transport Abstraction (`BaseHttpRequest` & `FetchHttpRequest`)
- `BaseHttpRequest`: Abstract contract defining `abstract request<T>(options: ApiRequestOptions): Promise<ApiResponse<T>>`.
- `FetchHttpRequest`: Concrete implementation that delegates to `request(this.config, options)`.

### 3. HTTP Request Execution Pipeline (`dist/core/request.js`)
The `request` module coordinates low-level HTTP transmission:
1. **URL Resolution (`getUrl`):**  
   Interpolates path parameters from `options.path` into URL templates (e.g. `/v3/status/{jobId}` -> `/v3/status/12345`), sanitizes slash boundaries, and serializes query strings via `getQueryString(options.query)`.
2. **Form Data Serialization (`getFormData`):**  
   Constructs standard `FormData` objects for multipart requests, auto-stringifying objects while passing Blobs and strings natively.
3. **Request Body Preparation (`getRequestBody`):**  
   Automatically executes `JSON.stringify()` if `mediaType` contains `/json` or for standard JavaScript objects, while passing raw `Blob`, `FormData`, or `string` payloads untouched.
4. **Headers Assembly & Token Injection (`getHeaders`):**  
   - Asynchronously awaits `config.tokenProvider.getToken(config.serviceEnvironment)`.
   - Injects `Authorization: Bearer <token>` when a token is returned.
   - Sets `Accept: application/json` by default.
   - Computes `Content-Type`: sets `Blob.type` for blobs, explicit `mediaType`, `application/json` for objects, or `text/plain` for strings.
   - Merges caller `options.headers` over `config.headers`.
5. **Native Fetch Dispatch (`sendRequest`):**  
   Calls the global `fetch(url, { headers, body, method, signal })`.
6. **Response Body Decoding (`getResponseBody`):**  
   - Skips HTTP 204 No Content.
   - If `Content-Type` starts with `application/json` or `application/problem+json`: parses as JSON (`response.json()`).
   - If `Content-Type` includes `multipart/form-data`: parses as `FormData` (`response.formData()`).
   - Otherwise: parses as raw text (`response.text()`).
7. **Error Detection & Exception Handling (`catchErrorCodes`):**  
   - Merges `options.errors` over the default HTTP error table:  
     `400: Bad Request`, `401: Unauthorized`, `403: Forbidden`, `404: Not Found`, `500: Internal Server Error`, `502: Bad Gateway`, `503: Service Unavailable`.
   - If response matches an error code or `response.ok` is false: throws an `ApiError`.

---

## 5. Asynchronous Polling State Machine & Workflow Triggers

Core provides a complete asynchronous job lifecycle framework for background operations:

### 1. `AsyncJobState` Enumeration (`dist/core/AsyncJobPromise.js`)
```typescript
export enum AsyncJobState {
    PENDING = "PENDING",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
    CANCELLED = "CANCELLED"
}
```

### 2. `AsyncJobPromise<ResultT>` Abstract Class
Implements `PromiseLike<ApiResponse<ResultT>>` to allow asynchronous background jobs to be directly `await`ed or chained with `.then()`, `.catch()`, and `.finally()`.
- **State Machine Architecture:**
  - Initial state: `PENDING`.
  - Abstract status query: `protected abstract _fetchJobStatus(): Promise<void>`.
  - Configurable polling delay: `protected _getNextRetryTimeInMilliSecs(): number` (defaults to **2,000 milliseconds / 2 seconds**; overridden by concrete subclasses based on `Retry-After` headers or server hints).
  - Polling loop (`_pollJobStatus`): Recursively invokes `_fetchJobStatus()` followed by `sleep(_getNextRetryTimeInMilliSecs())` until `_isDone` is true.
  - State event dispatcher (`_checkNDispatchStateChange`): Detects state transitions and fires registered `StatusChangeCallback` listeners.
  - Result retrieval: `getResult()` returns `ApiResponse<ResultT>` upon `COMPLETED`.
  - Error retrieval: `getError()` returns `ApiError | Error` upon `FAILED`.

### 3. Concurrency Utilities
- **`Deferred<T>` (`dist/core/Deferred.js`):**  
  Encapsulates an externally resolvable and rejectable Promise, tracking `isSettled`, `isFulfilled`, and `isRejected`.
- **`sleep(millisec: number)` (`dist/core/Utils.js`):**  
  Standard Promise-based delay wrapper using `setTimeout`.

---

## 6. Schemas, Interfaces & Taxonomies

### 1. Client Configuration Schemas (`dist/core/CoreTypes.d.ts`)
- **`TokenProvider`:**
  ```typescript
  export interface TokenProvider {
      getToken(env: string | undefined): Promise<string>;
  }
  ```
- **`ClientConfig`:**
  - `tokenProvider: TokenProvider` (Required)
  - `clientId: string` (Required, auto-injected as `x-api-key`)
  - `serviceEnvironment?: string` (Optional, `'production'`, `'beta'`)
- **`ClientCredentials`:**
  - `clientId: string` (Required)
  - `clientSecret: string` (Required)
  - `serviceEnvironment?: string` (Optional)
  - `scopes?: string` (Optional)
- **`ServiceConfig` (extends `ClientConfig`):**
  - `baseUrl: string` (Required)
  - `headers?: Record<string, string>` (Optional)

### 2. Documented Product OAuth Scopes Taxonomy
- **Firefly Services:** `"firefly_api, ff_apis"`
- **Content Tagging Services:** `"openid, AdobeID, session, additional_info"`
- **Lightroom Services:** `"openid, AdobeID, read_organizations"`
- **Photoshop Services:** `"openid, AdobeID, read_organizations"`

### 3. HTTP Methods & Response Types
- **HTTP Methods:** `"GET" | "PUT" | "POST" | "DELETE" | "OPTIONS" | "HEAD" | "PATCH"`
- **`ApiResponse<T>`:**
  ```typescript
  export type ApiResponse<T> = {
      result: T;
      headers: Headers;
  };
  ```
- **`ApiError`:**
  ```typescript
  export class ApiError extends Error {
      readonly url: string;
      readonly status: number;
      readonly statusText: string;
      readonly body: any;
      readonly request: ApiRequestOptions;
  }
  ```

---

## 7. Generated Inventory Artifacts

All detailed technical raw data has been systematically indexed into seven dedicated inventory files inside `inventory/firefly-core/`:

1. **`inventory/firefly-core/00-full-code-list.txt`** (10 KB):  
   Complete enumeration of all 30 files with exact byte sizes, SHA-256 hashes, and export summaries.
2. **`inventory/firefly-core/01-directories.txt`** (1.8 KB):  
   Hierarchical ASCII directory tree map of the core package.
3. **`inventory/firefly-core/02-py-sql-yaml-files.txt`** (5.3 KB):  
   File classification audit: 0 `.py`, 0 `.sql`, 0 `.yaml`/`.yml`, 1 `.json`, 14 `.d.ts`, 14 `.js`, 1 `.md`.
4. **`inventory/firefly-core/03-tech-stack.txt`** (3.3 KB):  
   Tech stack metadata, zero-dependency architecture, web-standard primitives, and Rush/TypeScript toolchain.
5. **`inventory/firefly-core/04-schemas-and-triggers.txt`** (5.6 KB):  
   All interfaces, configuration models, error classes, and the `AsyncJobPromise` / `AsyncJobState` polling state machine.
6. **`inventory/firefly-core/05-api-endpoints.txt`** (4.1 KB):  
   HTTP transport pipeline, environment URL resolution (`getBaseUrl`, `getEnvFromVersion`), header compilation, and error status mapping.
7. **`inventory/firefly-core/06-taxonomies-and-enums.txt`** (2.2 KB):  
   Runtime `AsyncJobState` enumeration, HTTP method types, environment taxonomies, and Adobe product OAuth scopes.

---
*Report generated and validated autonomously in ~/rea-workspace.*
