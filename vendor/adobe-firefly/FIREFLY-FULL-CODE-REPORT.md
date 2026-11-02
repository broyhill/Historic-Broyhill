# Adobe Firefly Services SDK (`@adobe/firefly-apis` v2.0.1)
## Comprehensive Reverse Engineering & Architectural Inspection Report

**Investigation Date:** October 22, 2026  
**Analyzed Target:** `/Users/Broyhill/rea-workspace/targets/firefly/package`  
**REA Engine:** REA 6.7.0 (`/Users/Broyhill/rea-workspace/rea-local/node_modules/.bin/rea`)  
**Generated Evidence:** `/Users/Broyhill/rea-workspace/evidence/firefly-6.7.0-evidence.json`  
**Inventory Directory:** `/Users/Broyhill/rea-workspace/inventory/firefly/`  

---

## 1. Executive Summary & Verification Findings

An exhaustive forensic analysis and architectural inspection of the unpacked Adobe Firefly Services JavaScript SDK (`@adobe/firefly-apis` version `2.0.1`) was conducted using local shell diagnostics and the REA 6.7.0 static analysis engine.

### Key Inspection Results:
1. **Binary Wrapper / Leading Byte Audit:**
   - Every `.js` (54 files) and `.json` (3 files) within `targets/firefly/package` was scanned at the byte level (first 200 bytes).
   - **Result:** No leading `S` character, no proprietary binary packing headers, no bytecode wrappers, and no obfuscation layers were detected. All `.js` files begin with valid UTF-8 CommonJS boilerplates (`"use strict";\nObject.defineProperty(...)`), and all `.json` files begin with standard ASCII/UTF-8 JSON object openings (`{\n`).
2. **REA 6.7.0 Engine Execution & Evidence Record:**
   - **Evidence ID:** `ev_be630283663a0e5167ed745fc4e8ba6d49c0dcba12bdd14dcdeb6d2cc28f093c`
   - **Provider:** `rea-javascript-application` (Version 1)
   - **Authority:** `shipped-artifact` | **Confidence:** `derived`
   - **Target Artifacts Analyzed:** 111 application files (108 parsed JavaScript modules/stubs, 3 JSON files, 4,324 visited AST nodes, 298 findings, 0 parse failures).
   - **Runtime Boundaries:** REA confirmed 0 native addon bindings, 0 preload entrypoints, 0 browser windows, and 0 IPC channels—establishing that the package is a pure stateless REST client library suitable for both server-side Node.js and client-side Web/Browser runtimes.
3. **Artifact Composition:**
   - **Total Files:** 112 files across the unpacked distribution.
   - **Source Breakdown:** 54 `.js` CommonJS runtime files, 54 `.d.ts` TypeScript declaration files, 3 `.json` files, and 1 `README.md`.
   - **Absence of Other Languages:** 0 Python (`.py`), 0 SQL (`.sql`), and 0 YAML (`.yaml`/`.yml`) files are present.

---

## 2. Package Architecture, Tech Stack & Dependencies

### Package Metadata
- **Package Name:** `@adobe/firefly-apis`
- **Version:** `2.0.1`
- **License:** `Copyright (c) 2024 Adobe Inc`
- **Author:** `Adobe`
- **Homepage:** `https://github.com/Firefly-Services/firefly-services-sdk-js/blob/main/packages/firefly/README.md`
- **Repository:** `https://github.com/Firefly-Services/firefly-services-sdk-js`
- **Entrypoints:**
  - CommonJS Main: `dist/src/index.js`
  - TypeScript Types: `dist/src/index.d.ts`
- **Supported Engines:** Node.js `>=18.0.0`

### Runtime Dependencies
The SDK is designed as a lightweight client within the Adobe Firefly Services SDK monorepo ecosystem and depends directly on:
1. **`@adobe/firefly-services-sdk-core` (`2.0.0` / `workspace:*`):**
   - Provides `BaseServiceClient` (abstract client foundation), `ClientConfig`, `ClientCredentials`, `ApiOptions`, and `ApiResponse`.
   - Handles environment URL resolution (`BaseServiceClient.getBaseUrl(urlMap, env)`), version-to-environment mapping (`BaseServiceClient.getEnvFromVersion()`), and internal HTTP dispatch (`this._httpRequest.request()`).
2. **`@adobe/firefly-services-common-apis` (`2.0.0` / `workspace:*`):**
   - Provides `ServerToServerTokenProvider` for automated Adobe IMS (Identity Management System) 2-legged OAuth token generation and background auto-refresh (`{ autoRefresh: true }`).

### Build System & Toolchain
- **Monorepo Manager:** Microsoft Rush (`rushx clean && rushx ibuild`)
- **Transpiler:** TypeScript Compiler `tsc` (v5.2.2)
- **Filesystem Utility:** `rimraf` (v3.0.2)

### Client Transport & Security Architecture
- **Base Endpoint:** `https://firefly-api.adobe.io` (production default)
- **User-Agent String:** `FFS-SDK, JS, Firefly-2.0.1`
- **Authentication Modes:**
  1. *Automated 2-Legged OAuth:* Instantiated via `ClientCredentials` (`clientId`, `clientSecret`, scopes: `firefly_api,ff_apis`). `ServerToServerTokenProvider` automatically handles token fetching and refreshing.
  2. *Custom / External Token:* Instantiated via `ClientConfig` (`clientId`, `tokenProvider`), delegating auth lifecycle management to external caller-defined token providers.
- **Transport Security:** OpenAPI 3.1.0 specifies combined `AccessToken` (Bearer token header `Authorization: Bearer <token>`) and `X-Api-Key` (`x-api-key: <clientId>`).

---

## 3. Directory Structure & File Classification

### Directory Tree Overview
```
package/
├── dist/
│   ├── package.json
│   └── src/
│       ├── Firefly.d.ts
│       ├── Firefly.js
│       ├── index.d.ts
│       ├── index.js
│       └── models/ (104 files: 52 .d.ts + 52 .js)
├── oas/
│   └── FFApiOpenApi3.json (129 KB official OpenAPI 3.1.0 spec)
├── package.json
└── README.md
```

### Classification Breakdown:
| File Category | Count | Primary Roles & Characteristics |
|:---|:---:|:---|
| **Python (`.py`)** | **0** | No Python code packaged; pure TypeScript/JavaScript client. |
| **SQL (`.sql`)** | **0** | No embedded databases, SQLite snapshots, or migration scripts. |
| **YAML (`.yaml`/`.yml`)** | **0** | Specification is JSON-only (`oas/FFApiOpenApi3.json`); no YAML specs. |
| **JSON (`.json`)** | **3** | `package.json` (NPM manifest), `dist/package.json` (build artifact), `oas/FFApiOpenApi3.json` (OpenAPI spec). |
| **TypeScript (`.d.ts`)**| **54** | `Firefly.d.ts` (client interface), `index.d.ts` (exports), and 52 model definitions in `models/`. |
| **JavaScript (`.js`)** | **54** | `Firefly.js` (client class), `index.js` (barrel exports), 8 runtime enum objects, and 44 CommonJS stubs. |
| **Markdown (`.md`)** | **1** | `README.md` (SDK-to-API mapping documentation). |
| **Total Artifacts** | **112** | Complete verified package artifact count. |

### Runtime Exports vs. Type Stubs:
Because TypeScript interfaces and type aliases do not produce runtime JavaScript code, the 52 files in `dist/src/models/` divide into:
1. **8 Runtime JavaScript Enumerations** (exporting actual JS objects):
   `AlignmentHorizontal`, `AlignmentVertical`, `CameraMotion`, `ContentClass`, `ErrorCode`, `ShotAngle`, `ShotSize`, `VideoPromptStyle`.
2. **44 CommonJS Type Stubs** (containing only `"use strict"; Object.defineProperty(exports, "__esModule", { value: true });`).

---

## 4. REST API Endpoint Mapping & SDK Methods

The Adobe Firefly API surface consists of **7 core REST operations**, all executed as HTTP `POST` requests against `https://firefly-api.adobe.io`:

| # | HTTP Method & Path | Operation ID | SDK Method Signature | Purpose & Description |
|:---|:---|:---|:---|:---|
| **1** | `POST /v3/images/generate` | `generateImages` | `FireflyClient.generateImages(requestBody, options?)` | Generate images from text prompts with optional reference styles and structural conditioning. |
| **2** | `POST /v3/videos/generate` | `generateVideoV3` | `FireflyClient.generateVideoV3(requestBody, additionalParams?, options?)` | Asynchronous text-to-video and image-to-video generation job creation. |
| **3** | `POST /v2/storage/image` | `upload` | `FireflyClient.upload(requestBody, options?)` | Upload image binary (JPEG, PNG, WebP) to obtain an opaque `uploadId` for use in generative tasks. |
| **4** | `POST /v3/images/generate-similar` | `generateSimilarImages` | `FireflyClient.generateSimilarImages(requestBody, options?)` | Generate visual variations based on an uploaded or referenced seed image. |
| **5** | `POST /v3/images/expand` | `expandImage` | `FireflyClient.expandImage(requestBody, options?)` | Outpainting / generative expand to extend canvas bounds and alter aspect ratios. |
| **6** | `POST /v3/images/fill` | `fillImage` | `FireflyClient.fillImage(requestBody, options?)` | Inpainting / generative fill within masked regions using text prompt guidance. |
| **7** | `POST /v3/images/generate-object-composite` | `generateObjectComposite` | `FireflyClient.generateObjectComposite(requestBody, options?)` | Composite an object image seamlessly into a generated background scene. |

### Endpoint Detailed Specifications:

#### 1. Generate Images (`POST /v3/images/generate`)
- **Headers:** `Authorization: Bearer <token>`, `x-api-key: <clientId>`, `Content-Type: application/json`
- **Request Body:** `GenerateImagesRequest`
  - `prompt` (*string, required*): Descriptive text prompt.
  - `negativePrompt` (*string, optional*): Unwanted visual elements.
  - `contentClass` (*ContentClass, optional*): `'photo'` or `'art'`.
  - `size` (*Size, optional*): Desired width and height (e.g. `{ width: 2048, height: 2048 }`).
  - `numVariations` (*integer, optional*): Number of variations to create.
  - `seeds` (*integer[], optional*): Seed values for reproducible inference.
  - `visualIntensity` (*integer, optional*): Intensity scale for existing characteristics.
  - `style` (*Styles, optional*): Style presets or style reference image (`imageReference`).
  - `structure` (*StructureReference, optional*): Layout/composition conditioning image and strength.
  - `tileable` (*boolean, optional*): Generates seamless repeating texture patterns.
  - `promptBiasingLocaleCode` (*string, optional*): Regional prompt tuning (e.g. `'en-US'`).
- **Responses:**
  - `200 OK`: `GenerateImagesResponse` (`size`, `outputs: OutputImage[]`, `contentClass`, `promptHasDeniedWords`, `promptHasBlockedArtists`).
  - `400`, `403`, `408`, `415`, `422`, `500`, `501`, `503`: `ApiError`.

#### 2. Generate Video (`POST /v3/videos/generate`)
- **Headers:** `Authorization: Bearer <token>`, `x-api-key: <clientId>`, `Content-Type: application/json`, `x-model-version: video1_standard` (default)
- **Request Body:** `GenerateVideoRequestV3`
  - `prompt` (*string, optional*): Video generation prompt.
  - `negativePrompt` (*string, optional*): Negative guidance text.
  - `image` (*InputImageV3, optional*): Keyframe image conditioning (`conditions: ImageConditionV3[]`).
    - `conditions.placement.position`: Float `0.0` (first frame) to `1.0` (last frame).
    - `conditions.source`: `PublicBinaryInputV3` (`url`, `uploadId`, or `creativeCloudFileId`).
  - `sizes` (*ClinetoSize[], optional*): Dimensions of target video (`width`, `height`).
  - `seeds` (*integer[], optional*): Seed values (currently strictly 1 seed supported).
  - `bitRateFactor` (*integer, optional*): Constant Rate Factor 0–63 (suggested 17–23).
  - `videoSettings` (*VideoSettingsV3, optional*): Controls for `cameraMotion`, `promptStyle`, `shotAngle`, `shotSize`.
- **Responses:**
  - `202 Accepted`: `{ jobId: string, statusUrl: string, cancelUrl: string }`
  - `400`, `403`, `404`, `408`, `409`, `410`, `415`, `422`, `429`, `451`, `499`, `500`, `501`, `503`: `VideoApiError`.

#### 3. Storage Binary Upload (`POST /v2/storage/image`)
- **Headers:** `Authorization: Bearer <token>`, `x-api-key: <clientId>`, `Content-Type: image/jpeg | image/png | image/webp`
- **Request Body:** Binary `Blob` payload (client-side validated in `FireflyClient.upload()` against supported MIME types).
- **Responses:**
  - `200 OK`: `UploadResponse` (`images: [{ id: "<opaque-uuid>" }]`).
  - `400`, `403`, `404`, `408`, `409`, `410`, `415`, `422`, `451`, `499`, `500`, `501`, `503`: `ApiError`.

#### 4. Generate Similar Images (`POST /v3/images/generate-similar`)
- **Request Body:** `GenerateSimilarImagesRequest` (`image: BaseInputImage` [required], `numVariations`, `seeds`, `size`, `tileable`).
- **Responses:** `200 OK`: `GenerateSimilarImagesResponse` (`size`, `outputs: OutputImage[]`).

#### 5. Generative Expand (`POST /v3/images/expand`)
- **Request Body:** `ExpandImageRequest` (`image: ExpandInputImage` [required], `prompt`, `size`, `numVariations`, `seeds`, `placement: Placement`).
- **Responses:** `200 OK`: `ExpandImageResponse` (`size`, `outputs: OutputImage[]`).

#### 6. Generative Fill (`POST /v3/images/fill`)
- **Request Body:** `FillImageRequest` (`image: InputImage` [required source & mask], `prompt`, `negativePrompt`, `numVariations`, `seeds`, `promptBiasingLocaleCode`).
- **Responses:** `200 OK`: `FillImageResponse` (`size`, `outputs: OutputImage[]`).

#### 7. Generate Object Composite (`POST /v3/images/generate-object-composite`)
- **Request Body:** `GenerateObjectCompositeRequest` (`image: ObjectCompositeInputImage` [required], `prompt` [required], `size`, `placement`, `style`, `contentClass`, `numVariations`, `seeds`).
- **Responses:** `200 OK`: `GenerateObjectCompositeResponse` (`size`, `outputs: OutputImage[]`, `contentClass`).

---

## 5. Asynchronous Job & Polling Architecture

Firefly handles long-running video rendering through an asynchronous polling pattern:

```
[Client SDK]                                              [Firefly Backend]
     |                                                           |
     |--- 1. POST /v3/videos/generate (GenerateVideoRequestV3) ->|
     |<-- 2. HTTP 202 Accepted { jobId, statusUrl, cancelUrl } --|
     |                                                           |
     |--- 3. GET <statusUrl> ----------------------------------->|
     |<-- 4. HTTP 200 OK (AsyncResponseV3: status="pending") ----|
     |       [Wait / Poll Interval]                              |
     |--- 5. GET <statusUrl> ----------------------------------->|
     |<-- 6. HTTP 200 OK (AsyncResponseV3: status="succeeded",   |
     |                    result: { outputs: [{ video }] }) -----|
     |                                                           |
  [Optional Abort]                                               |
     |--- 7. POST/DELETE <cancelUrl> --------------------------->|
     |<-- 8. HTTP 200/204 Job Cancelled -------------------------|
```

### Async Data Contracts:
1. **Initial Trigger Response (HTTP 202):**
   - `jobId`: Job URN (e.g. `urn:ff:jobs:epo855230:eeb0be1f-c41f-4711-bdc1-08e66e89d96d`).
   - `statusUrl`: Dedicated polling endpoint (e.g. `https://firefly-epo855230.adobe.io/v3/status/<jobId>`).
   - `cancelUrl`: Dedicated cancellation endpoint (e.g. `https://firefly-epo855230.adobe.io/v3/cancel/<jobId>`).
2. **Polling Status Model (`AsyncResponseV3`):**
   - `jobId`: URN string (required).
   - `status`: String state (`pending`, `running`, `succeeded`, `failed`, `cancelled`).
   - `progress`: Integer completion percentage (`0`–`100`).
   - `statusUrl`: Canonical status check URL.
   - `cancelUrl`: Canonical cancellation URL.
   - `result`: `AsyncResult` containing `size: ClinetoSize` and `outputs: VideoOutput[]` with pre-signed video download links (`video.url`).
3. **Webhook / Callback Verification:**
   - Audit of `oas/FFApiOpenApi3.json` confirmed that **no webhooks or push callbacks are implemented or defined**. Video generation status tracking requires client-driven polling.

---

## 6. Validation Rules & Operating Constraints

1. **Storage Upload MIME Type Guard:**
   - Client-side code in `dist/src/Firefly.js` enforces that uploaded blobs must match:
     `['image/jpeg', 'image/png', 'image/webp']`.
   - Any non-matching MIME type throws an immediate local Promise rejection.
2. **External Cloud Domain Allow-List:**
   - When specifying an image URL for `StylesImageReference` or `StructureImageReference`, Adobe strictly validates and accepts only:
     - `amazonaws.com` (AWS S3)
     - `windows.net` (Azure Blob Storage)
     - `dropboxusercontent.com` (Dropbox)
3. **Supported Image Dimensions & Aspect Ratios:**
   - Square (1:1): `2048 x 2048` or `1024 x 1024`
   - Landscape (4:3): `2304 x 1792`
   - Portrait (3:4): `1792 x 2304`
   - Widescreen (16:9): `2688 x 1536`
   - Custom ratios: `1344 x 768` (7:4), `1152 x 896` (9:7), `896 x 1152` (7:9)
4. **Video Generation Constraints:**
   - `bitRateFactor`: Suggested range `17` to `23` (`0` is lossless, `63` is worst quality).
   - `seeds`: Array currently supports strictly `1` seed.
   - `placement.position`: Float `0.0` (first keyframe) to `1.0` (last keyframe).
   - `x-model-version` header: Must be `video1_standard`.
5. **Seed & Variation Equality:**
   - If `seeds` and `numVariations` are both passed, `seeds.length` must exactly match `numVariations`.

---

## 7. Taxonomies, Enumerations & Controlled Vocabularies

The SDK defines 8 formal runtime enumerations and several OpenAPI controlled vocabularies:

### 1. `AlignmentHorizontal`
- `AlignmentHorizontal.CENTER = "center"`
- `AlignmentHorizontal.LEFT = "left"`
- `AlignmentHorizontal.RIGHT = "right"`

### 2. `AlignmentVertical`
- `AlignmentVertical.CENTER = "center"`
- `AlignmentVertical.TOP = "top"`
- `AlignmentVertical.BOTTOM = "bottom"`

### 3. `CameraMotion` (8 values)
- `CameraMotion.CAMERA_PAN_LEFT = "camera pan left"`
- `CameraMotion.CAMERA_PAN_RIGHT = "camera pan right"`
- `CameraMotion.CAMERA_ZOOM_IN = "camera zoom in"`
- `CameraMotion.CAMERA_ZOOM_OUT = "camera zoom out"`
- `CameraMotion.CAMERA_TILT_UP = "camera tilt up"`
- `CameraMotion.CAMERA_TILT_DOWN = "camera tilt down"`
- `CameraMotion.CAMERA_LOCKED_DOWN = "camera locked down"`
- `CameraMotion.CAMERA_HANDHELD = "camera handheld"`

### 4. `ContentClass`
- `ContentClass.PHOTO = "photo"` (Photorealistic style)
- `ContentClass.ART = "art"` (Artistic / illustration style)

### 5. `ErrorCode` (12 values)
- `ErrorCode.MODEL_NOT_LOADED = "model_not_loaded"`
- `ErrorCode.NOT_IMPLEMENTED = "not_implemented"`
- `ErrorCode.VALIDATION_ERROR = "validation_error"`
- `ErrorCode.RUNTIME_ERROR = "runtime_error"`
- `ErrorCode.TIMEOUT_ERROR = "timeout_error"`
- `ErrorCode.PROMPT_UNSAFE = "prompt_unsafe"`
- `ErrorCode.INPUT_MEDIA_UNSAFE = "input_media_unsafe"`
- `ErrorCode.OUTPUT_MEDIA_UNSAFE = "output_media_unsafe"`
- `ErrorCode.BAD_REQUEST = "bad_request"`
- `ErrorCode.LANGUAGE_NOT_SUPPORTED = "language_not_supported"`
- `ErrorCode.ACCESS_ERROR = "access_error"`
- `ErrorCode.INVALID_CONTENT_TYPE = "invalid_content_type"`

### 6. `ShotAngle` (5 values)
- `ShotAngle.AERIAL_SHOT = "aerial shot"`
- `ShotAngle.EYE_LEVEL_SHOT = "eye_level shot"`
- `ShotAngle.HIGH_ANGLE_SHOT = "high angle shot"`
- `ShotAngle.LOW_ANGLE_SHOT = "low angle shot"`
- `ShotAngle.TOP_DOWN_SHOT = "top-down shot"`

### 7. `ShotSize` (5 values)
- `ShotSize.CLOSE_UP_SHOT = "close-up shot"`
- `ShotSize.EXTREME_CLOSE_UP = "extreme close-up"`
- `ShotSize.MEDIUM_SHOT = "medium shot"`
- `ShotSize.LONG_SHOT = "long shot"`
- `ShotSize.EXTREME_LONG_SHOT = "extreme long shot"`

### 8. `VideoPromptStyle` (10 values)
- `VideoPromptStyle.ANIME = "anime"`
- `VideoPromptStyle._3D = "3d"`
- `VideoPromptStyle.FANTASY = "fantasy"`
- `VideoPromptStyle.CINEMATIC = "cinematic"`
- `VideoPromptStyle.CLAYMATION = "claymation"`
- `VideoPromptStyle.LINE_ART = "line art"`
- `VideoPromptStyle.STOP_MOTION = "stop motion"`
- `VideoPromptStyle._2D = "2d"`
- `VideoPromptStyle.VECTOR_ART = "vector art"`
- `VideoPromptStyle.BLACK_AND_WHITE = "black and white"`

### 9. OpenAPI Controlled Parameter Values
- **Video Model Version:** `["video1_standard"]`
- **Upload Media Types:** `["image/jpeg", "image/png", "image/webp"]`
- **Video Job Statuses:** `["pending", "running", "succeeded", "failed", "cancelled"]`
- **Video Error Code Taxonomy:**
  `bad_request`, `access_error`, `unknown_job_id`, `timeout_error`, `job_cancel_failed`, `job_timeout`, `invalid_content_type`, `input_media_indecipherable`, `backpressure_limited` (HTTP 429), `reference_image_unsafe_error` (HTTP 451), `cancelled_error` (HTTP 499), `session_data_not_recovered` (HTTP 500), `not_implemented` (HTTP 501), `model_not_loaded` (HTTP 503).

---

## 8. Generated Inventory Artifacts

All detailed technical raw data has been systematically indexed into seven dedicated inventory files:

1. **`inventory/firefly/00-full-code-list.txt`** (37 KB):
   Complete enumeration of all 112 files with exact byte sizes, SHA-256 hashes, and export summaries.
2. **`inventory/firefly/01-directories.txt`** (6.9 KB):
   Hierarchical ASCII directory tree map of the entire distribution package.
3. **`inventory/firefly/02-py-sql-yaml-files.txt`** (17 KB):
   Exhaustive audit classifying all `.py` (0), `.sql` (0), `.yaml`/`.yml` (0), `.json` (3), `.d.ts` (54), and `.js` (54) files.
4. **`inventory/firefly/03-tech-stack.txt`** (3.5 KB):
   Full technology stack breakdown, runtime dependencies, toolchain, and transport protocol architecture.
5. **`inventory/firefly/04-schemas-and-triggers.txt`** (32 KB):
   All 52 component models, property definitions, required fields, constraints, and asynchronous video job polling triggers.
6. **`inventory/firefly/05-api-endpoints.txt`** (12 KB):
   Detailed mapping of all 7 REST endpoints with HTTP methods, operation IDs, headers, payload schemas, and response codes.
7. **`inventory/firefly/06-taxonomies-and-enums.txt`** (6.0 KB):
   Complete controlled vocabularies and allowed values for all 8 runtime enums and OpenAPI taxonomies.

---
*Report generated and validated autonomously in ~/rea-workspace.*
