---
title: Changelog - Adobe Firefly API
description: This is the changelog for Adobe Firefly API
keywords:
  - Adobe Firefly Services
  - Firefly API
  - Developer documentation
  - API documentation
  - Integration
  - User interface components
  - Component library
  - UI/UX design
  - Web development
  - Application development
  - Software development kit (SDK)
  - JavaScript framework
  - Front-end development
  - Back-end development
  - Adobe Experience Platform
  - Cross-platform compatibility
  - Interactive experiences
  - User interface customization
  - API endpoints
  - Authentication and authorization
contributors:
  - 'https://github.com/amandahuarng'
  - 'https://github.com/nimithajalal'
  - 'https://github.com/hollyschinsky'
hideBreadcrumbNav: true
og:
  title: Changelog - Adobe Firefly API
  description: This is the changelog for Adobe Firefly API
twitter:
  card: summary
  title: Changelog - Adobe Firefly API
  description: This is the changelog for Adobe Firefly API
---
[//]: # (TODO: Update with latest prod details, elaborate on API descriptions)
# Changelog

## April 24, 2026

### Upscale API: Beta to GA (Breaking Change)

During the beta period, the `/v3/images/upscale` endpoint was named and documented as the "creative upsampler"; however the underlying model being called was always the **precise upsampler**. This GA release corrects that naming inconsistency. The service behavior is unchanged; only the names are being aligned to reflect reality.

### ⚠️ Breaking Changes

#### 1. `creative_upsampler_v1` header value rejected

Passing `creative_upsampler_v1` in the `x-model-version` header now returns a **422 Unprocessable Entity**:

```json
{
  "error_code": "validation_error",
  "message": "Invalid x-model-version: creative_upsampler_v1. Only 'precise_upsampler_v1' is supported."
}
```

**Action required:** Update or remove the `x-model-version` header. The new default is `precise_upsampler_v1`.

```http
x-model-version: precise_upsampler_v1
```

#### 2. Schema and operation identifiers renamed

All `Creative*` upsampler identifiers have been renamed to `Precise*` to reflect the correct underlying model. If you are using a generated SDK or referencing schema `$ref` values directly, update accordingly.

| Old name (beta) | New name (GA) |
| --- | --- |
| `creativeUpsamplerV3Async` | `preciseUpsamplerV3Async` |
| `CreativeUpsamplerRequestV3` | `PreciseUpsamplerRequestV3` |
| `CreativeUpscaleAcceptResponseV3` | `PreciseUpscaleAcceptResponseV3` |
| `CreativeUpscaleTaskLink` | `PreciseUpscaleTaskLink` |
| `CreativeUpsamplerResponse` | `PreciseUpsamplerResponse` |

> **Note:** The request body shape and response structure are **unchanged**. This is a rename only; no fields have been added, removed, or modified.

### Summary of all spec changes

| Area | Before (beta) | After (GA) |
| --- | --- | --- |
| `x-model-version` accepted values | `creative_upsampler_v1` | `precise_upsampler_v1` |
| `x-model-version` default | `creative_upsampler_v1` | `precise_upsampler_v1` |
| Invalid model version response | Undefined behaviour | `422` with `validation_error` |
| `operationId` | `creativeUpsamplerV3Async` | `preciseUpsamplerV3Async` |
| Request schema | `CreativeUpsamplerRequestV3` | `PreciseUpsamplerRequestV3` |
| Accept response schema | `CreativeUpscaleAcceptResponseV3` | `PreciseUpscaleAcceptResponseV3` |
| Task link schema | `CreativeUpscaleTaskLink` | `PreciseUpscaleTaskLink` |
| Result schema | `CreativeUpsamplerResponse` | `PreciseUpsamplerResponse` |
| Endpoint summary | `Upscale image (beta)` | `Upscale image` |
| `Upscale` tag description | `...creative upsampler (beta)` | `...precise upsampler` |

### Deprecation timeline

| Date | Event |
| --- | --- |
| Prior to 2026-04-24 | Beta: `creative_upsampler_v1` available; underlying model was always the precise upsampler |
| **2026-04-24** | **GA: `creative_upsampler_v1` removed; `precise_upsampler_v1` is the only supported value; all schema identifiers corrected** |

## March 25, 2026

**API updates**

* **Launch of Upscale API**: The Upscale API is now available for use.
  * [Upscale API](../../api/index.md)

## March 24, 2026

**API updates**

* **Launch of Composite Operations APIs**: The Composite Operations APIs are now available for use.
  * [Precise Composite API](../../api/index.md)
  * [Adaptive Composite API](../../api/index.md)
  * [Object Composite API](../../api/index.md)

## October 3, 2025

**API updates**

* **Removed deprecated non-synchronous API references** The following non-synchronous APIs are removed. Please use the async versions of these APIs instead:
  * Generate Images v3
  * Generate Similar Images v3
  * Generate Object Composite v3
  * Expand Image v3
  * Fill Image v3

## September 10, 2025

**API updates**

* **Removed deprecated APIs**: The following APIs are no longer available:
  * Generate Images v2 API
  * Expand Image v1 API
  * Fill Image v1 API

## June 19, 2025

**API updates**

* **Launch of Generate Video API**: Bring text, still shots, or illustrations to life by transforming them into live action clips. The [Generate Video API](../../api/index.md) is now available for use.

## April 29, 2025

**API updates**

* **New Image Model 4**: The Image Model 4 is now available for use with the [Generate Images](../../api/index.md) and [Generate Similar Images](../../api/index.md) APIs.

## March 11, 2025

**API updates**

* **Launch of Custom Models support**: The Generate Images API [now supports custom models](../../guides/concepts/custom-models/index.md).

## November 18, 2024

### API services update: General availability

We are excited to announce that the following APIs are now generally available:

* [Generate Image Async](../../api/index.md)
* [Expand Image Async](../../api/index.md)
* [Fill Image Async](../../api/index.md)
* [Generate Object Composite Async](../../api/index.md)
* [Generate Similar Images Async](../../api/index.md)

## October 12, 2024

### API services update: General availability

We are excited to announce that the following APIs are now generally available and no longer only in preview:

* [Generate Object Composite](../../api/index.md)
* [Expand Image](../../api/index.md)
* [Fill Image](../../api/index.md)

## July 23, 2024

### API services update: General availability

We are excited to announce that the following APIs are now generally available and no longer in preview:

* [Generate Similar Images](../../api/index.md)
* [Generate Images](../../api/index.md)

## June 18, 2024

### Added

Firefly Image Model 3 (preview) APIs:

  * New API References added for the newly introduced [Generate Similar Images](../../api/index.md) and [Generate Object Composite](../../api/index.md) APIs.
  * New V3 API References added for [Generate Images](../../api/index.md), [Expand Image](../../api/index.md) and [Fill Image](../../api/index.md) with support for Firefly Image Model 3 (preview).

Updated guides:

Create your first Firefly APIs implementation guide updated to use the new V3 version of the [Generate Images API](../../api/index.md).

New guides:

  * Firefly Image Model 3 (preview) - Overview
  * Using Content Class and Style Presets
  * Using Style and Structure Image References
  * Using the Expand Image API
  * Using the Fill Image API
  * Getting Started with the Firefly Services SDK
  * Firefly API Terminology

## April 18, 2024

### Added

Firefly Generate Images API now accepts `url` as source for `referenceImage`. Only allow listed domains are allowed to be accepted as input `url` in the request.

The allow-listed domains are as follows:

* `amazonaws.com`
* `windows.net`
* `dropboxusercontent.com`

## December 13, 2023

### Added

* Generate Images API with generative match
* Generative Expand API
* Generative Fill API
* Upload API

## November 20, 2023

### Added

* You can now use the latest image model by setting header `x-api-variant` to `v2`. It will be set to `v2` by default.
* Styles are documented in the API references as well as the new styles guide
  
## October 26, 2023

### Overview

We're excited to announce the release of our Generate Images API v1.0, the first major Firefly API release.

* Styles and content classes using the [v1 model](https://clio-assets.adobe.com/firefly/image-controls/v1/content.json)
* Generate images according to a text prompt
* Output types:
  * `application/json` (base64-encoded representation of the image data)
  * `multipart/mixed` (multi-part form data - binary representation of the image data)

### Known Issues and Limitations

* Offer Async API pattern
* Generate a tempUrl for each response
* Introduce defaults for `accept` and `mimetype` headers
* Add ability to specify JPG quality
* Rendering image in API References sandbox
