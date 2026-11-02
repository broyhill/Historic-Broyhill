---
title: Using Generate Image with Image5
description: This page explains the features and workflows available with the Image5 model.
keywords:
- Image5 model
- Generate Image API
- Firefly Image API
- Firefly API
- Adobe Firefly
- AI image API
- Image generation
- Image generation API
- Image generation API with Image5 model
- Image generation API with Firefly Image API
---

# Using the Generate Image API with Image5

This page explains the features and workflows available with the Image5 model.

## Overview

The Image5 model is a new model that is available with the Generate Image API. It is a more advanced model that is designed to generate more realistic images.

This endpoint supports two operations, **Text‑to‑Image generation** and **Image‑to‑Image instruct edit**, through the same request payload.
The mode is determined by content in the `referenceBlobs` field.

## About Text‑to‑Image generation

Text‑to‑Image generation is performed when `referenceBlobs` is empty → The API generates a new image using the prompt. Use this mode to create entirely new image content from a text prompt.

**Example Request Payload**

```json
{
  "prompt": "A hyper-detailed illustration of a floating city at sunrise",
  "aspectRatio": "16:9",
  "modelId": "firefly_image",
  "numVariations": 1,
  "referenceBlobs": []  // Empty array indicates Text‑to‑Image generation
}
```

## Prompt Reasoner

The `prompt_reasoner` field inside `modelSpecificPayload` controls the prompt reasoning strategy used during generation. It accepts two values:

- **`quality`** — Uses enhanced prompt reasoning. The response includes a populated `altText` field containing a generated text description of the image.
- **`speed`** (default) — Optimizes for faster generation. The `altText` field is returned empty.

**Example Request Payload**

```json
{
  "prompt": "A beagle running through a park toward its owner",
  "aspectRatio": "4:3",
  "modelId": "firefly_image",
  "numVariations": 1,
  "referenceBlobs": [],
  "modelSpecificPayload": {
    "localeCode": "en-US",
    "prompt_reasoner": "quality"
  }
}
```

## About Image‑to‑Image instruct edit

Image‑to‑Image instruct edit is performed when `referenceBlobs` contains one or more images → The API performs an instruct edit on the provided image(s). Use this mode to apply prompt‑driven edits to an existing image while preserving its structure and composition.

**Example Request Payload**

```json
{
  "prompt": "Add warm sunset lighting and enhance the reflection on the water",
  "modelId": "firefly_image",
  "numVariations": 1,
  "referenceBlobs": [
    {
      "source": {
        "uploadId": "123e4567-e89b-12d3-a456-426614174000" // Upload ID of the refernce image(s)
      },
      "usage": "general"
    }
  ]
}
```
