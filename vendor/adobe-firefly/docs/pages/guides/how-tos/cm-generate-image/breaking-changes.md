--- 
title: Migrating to Image5
description: This guide will help you understand the significant differences for this API, including breaking changes and how best to migrate an existing implementation.
keywords:
- breaking changes
- migration
- Image5 model
- Firefly Generate Image API
---

# Migrating to the Image5 Model

Understand how API implementations have changed using Image5.

## Overview

The new Generate Image API using the Image5 model introduces significant changes from the other Firefly Image APIs.

The old and new schemas are not compatible, and migration requires rewriting the request payload. This guide will help you understand the changes and how to migrate your existing implementation.

## Breaking schema changes

This API update constitutes a major version upgrade with *non-backwards-compatible* changes.
A *structured migration* is required for all clients.

Payloads and schemas in the new API include significant changes. These are breaking changes. Payloads that do not conform to the new schema will be rejected by the API.

### New control fields

The new API introduces several new configuration properties which may now be required depending on the model:

- `negativePrompt`
- `promptBiasingLocaleCode`
- `contentClass`
- `upsamplerType`
- `visualIntensity`
- `modelSpecificPayload.prompt_reasoner` — Controls prompt reasoning strategy (`quality` or `speed`). When set to `quality`, the response includes a populated `altText` field.

### Removed fields

The new Image5 model API eliminates the following previously accepted fields:

- `aspectRatio` - Only size is supported.
- `generationMetadata` - No longer client-supplied.
- `modelVersion` - No version selection in the API.
- `modelSpecificPayload` - No extension payload block.
- `output.cai` - CAI directives are not configurable. If downstream logic relies on CAI or storage controls, adjustments at the service layer are required.
- `output.storeInputs` - No storage toggles are exposed.

These have no direct replacements and should not be included in the request payloads to the API.

### Repurposed fields

These fields have been renamed and repurposed:

| Outdated field | New field        | Details                                                 |
| -------------- | --------------- | ------------------------------------------------------- |
| `N`            | `numVariations` | Now produces variations instead of raw N images.        |
| `modelId`      | `customModelId` | New semantics; not a direct mapping.|

## Migration recommendations

These recommendations provide mapping and guidance for converting requests to the older APIs to the new API format for Image5.

### Model selection

⚠️ Important: This is not simply a rename.
The new API does not expose explicit model versioning. Model selection is now at a higher level, in the header.

**Old Format (previous model)**
  
```json
"modelId": "firefly_image",
  "modelVersion": "image5"
```

**New Format (Image5 model)**

```json
"contentClass": "photo",
"customModelId": "string"
```

### Number of images

Use the new format for the number of images.

**Old Format (previous model)**

```json
"n": 1
```

**New Format (Image5 model)**

```json
"numVariations": 1
```

### Prompts

The new fields are optional, but powerful.

**Old Format (previous model)**

```json
"prompt": "string"
```

**New Format (Image5 model)**

```json
"prompt": "string",
"negativePrompt": "string",
"promptBiasingLocaleCode": "string"
