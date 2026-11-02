---
title: Firefly Upscale Image API Feature Guide
description: Increase image resolution while preserving detail, structure, and color fidelity with the Firefly Upscale Image API.
hideBreadcrumbNav: true
keywords:
  - Upscale
  - Upscale API
  - Upscale Image API
  - precise upsampler
  - API
  - User Guide
  - Guide
  - async
---
# Using the Firefly Upscale Image API

This guide explains the Firefly Upscale Image API and how to use it in production workflows where source accuracy matters.

## Overview

The Firefly Upscale Image API increases the resolution of photos and artwork while preserving original detail, structure, and color fidelity. It is designed to avoid the hallucinated content and texture invention common in aggressive AI upscalers, making it well-suited for production workflows where source accuracy matters.

Key value propositions:

- Increase the resolution of your own photos and artwork while preserving detail and avoiding artificial or hallucinated content.
- Maintain crispness and correct fine details in images created by generative AI such as textures and patterns when zooming in or preparing for larger formats.

The API supports 2x and 4x upscaling via an asynchronous pattern: submit a job, receive a job ID, poll for status, then retrieve the output.

## How it works

1. Submit an upscale request with your source image and desired scale factor.
2. Receive a job ID and polling URL in the response.
3. Poll the status endpoint until the job completes.
4. Retrieve the upscaled image from the returned output URL.

This async approach is especially useful for batch pipelines processing multiple assets in parallel.

## Use cases

### 1. Upscaling product images for eCommerce

**Scenario:** A retailer needs catalogue images at a higher resolution for product detail pages, zoom functionality, or print-quality output without any altered texture or color that could misrepresent the product.

**Why Firefly Upscale:** The API is built around source fidelity. It consistently preserves structural proportions, color accuracy, and tonal range, meaning the product looks like the product and not a sharpened interpretation of it. Color and tone stay consistent with the source, and fine surface details such as fabric, packaging, and labels are retained without over-sharpening.

At 2x scale, results are highly stable and suitable for direct use in most catalog workflows. At 4x, output quality remains strong for clean product shots, though images with complex textures may show some variability and benefit from a light review pass before publishing.

[**Recommended scale:**](#scale-factor-guidance) 2x for most catalog use. 4x when a significant resolution increase is needed and the source quality is high.

**What to expect:**

- Color and tone remain consistent with the source image
- Fine surface details are preserved without over-sharpening
- Text on packaging is generally legible, with stronger results at 4x for sharp, high-contrast text
- Some noise amplification can appear on smooth surfaces at 4x, so a review step is recommended for hero images

### 2. Preparing video stills for print

**Scenario:** A videographer extracts a frame from footage and needs it enlarged for use in a poster, exhibition print, or editorial layout. Video frames are typically low resolution relative to print requirements.

**Why Firefly Upscale:** Video stills often contain faces, fine structural detail, and cinematic grain, all areas where aggressive upscalers tend to introduce artifacts or invent content. The Firefly Upscale API takes a conservative approach: it enhances detail without over-inventing, which is important when the source frame needs to remain recognizable and authentic. Geometric distortion rates are low, making it a reliable choice for enlarging stills without deforming the composition.

[**Recommended scale:**](#scale-factor-guidance) Start at 2x. If the output resolution still falls short of print requirements, apply 4x, but expect some additional tonal variation that may require a light retouch.

**What to expect:**

- Facial features are generally preserved with natural softness. Subtle changes in fine detail may occur and should be reviewed for portrait-forward prints
- Grain from the original footage is generally retained in a controlled way, supporting a filmic aesthetic
- At 4x, some edge halos and increased noise on smooth areas such as skies and skin may be present. These are typically minor and addressable in post

## Scale factor guidance

**2x** delivers the most consistent, production-ready results across content types. Structure, color, and tone stay close to the source with minimal risk of artifacts. This is the recommended starting point for most workflows.

**4x** is viable for clean, high-quality sources and can unlock additional clarity for print or large-format use. It introduces more variability than 2x, particularly on smooth surfaces, gradients, and faces. A review step is recommended before direct publication at this scale.

## Limitations and considerations

- **4x on complex textures:** Smooth or gradient-heavy surfaces such as skies, skin, and fabric may show increased noise. Plan for a light retouch pass when publishing at this scale.
- **Faces at 4x:** Minor changes to fine facial detail can occur. Not recommended for unreviewed output in portrait-forward or identity-sensitive use cases.
- **Grain amplification:** The most common issue across content types, particularly in smooth background areas. For product images on clean backgrounds, this is generally minimal.
- **Color space:** All outputs are RGB, although CMYK and RGB are both accepted as input.

## API quick reference

**Endpoint:** `POST /v1/images/upsample-async`

**Base URL:** `https://firefly-api.adobe.io`

**Key request parameters:**

| Parameter | Description |
| --- | --- |
| image | Source image (upload ID or pre-signed URL) |
| scale | Supported scale factors are 2, 3, 4 and 6 |

**Authentication:** Bearer token via Adobe IMS + `x-api-key` header

**Response:** Returns a job ID and status URL. Poll the status URL until `status: succeeded`, then retrieve the output image URL. The maximum image output resolution is 6k.

For full schema details, see the [API Reference](../../../api/index.md).

## Ready to get started?

1. Obtain Firefly Services credentials from the [Adobe Developer Console](https://developer.adobe.com/console/).
2. Exchange your Client ID and Client Secret for an access token via Adobe IMS.
3. Upload your source image using the [Firefly Storage Upload](../../../guides/concepts/image-upload/index.md) endpoint.
4. Submit an upscale job with the image ID and desired scale.
5. Poll for completion and download the result.

See the [Firefly API Getting Started](../../../getting-started/index.md) guide for authentication setup and examples.
