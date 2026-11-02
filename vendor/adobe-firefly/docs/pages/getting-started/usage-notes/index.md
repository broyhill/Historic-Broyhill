---
title: Technical Usage Notes
description: Technical Usage Notes for Generate Video API.
keywords:
  - Adobe Firefly API
  - generative AI
  - AI image generation
  - text-to-image
  - image generation
  - creative AI
  - REST API
  - AI models
  - generative content
  - AI art generation
  - creative automation
  - content creation
og:
  title: Technical Usage Notes
  description: Technical Usage Notes for Generate Video API.
twitter:
  card: summary
  title: Technical Usage Notes
  description: Technical Usage Notes for Generate Video API.
---

# Firefly API usage notes

This document has details about what's currently supported, limitations, and workarounds for the Firefly API.

## Rate limits

Adobe Firefly API places default rate limits on the volume and frequency of API calls. Contact your account manager to request higher rate limits if needed.

### Summary of rate limits

Our API imposes the following rate limits **per organization**:

* **4** requests **per minute (RPM)**
* **9,000** requests **per day (RPD)** (Relevant for those who have worked with their account manager to increase their rate limits beyond 4 RPM without changing this default daily limit.)

### What to do if you run into issues

If you exceed the rate limits, you'll receive an **HTTP 429 Too Many Requests** error. If you encounter this error, consider any of the following solutions:

* Review your usage and reduce unnecessary requests.
* Implement retry logic via a [`retry-after` HTTP header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After) or an [exponential backoff strategy](https://en.wikipedia.org/wiki/Exponential_backoff).
* Contact your account manager to request enabling higher usage rates.

### Why do API rate limits exist?

Rate limits are standard practice that serve several important purposes, including:

* Preventing abuse: Protects APIs from being overwhelmed by excessive requests.
* Protecting against downtime: Reduces the risk of service interruptions.
* Controlling costs: Helps manage resource consumption and associated expenses.

## Image API usage

### Supported storage domains

With the Image Model 5 endpoint `/v4/images/generate-async` these domains are supported for image storage:

- amazonaws.com
- windows.net
- dropboxusercontent.com
- storage.googleapis.com
- frontdoor.prod.azure.cxp.adobe.com

## Object Composite API usage

These are technical details and known limitations for the Object Composite API.

### Size limitations

**Maximum image size** supported is 10MB.

## Generate Video API usage

These technical notes for usage apply to the Generate Video API.

### Supported aspect ratios

Videos can be generated with dimensions for these supported aspect ratios:

![Supported aspect ratios](./aspect-ratios.png)

| Aspect Ratio | Dimensions |
| ------------- | ------------- |
| 16:9 | 1920w x 1080h |
| 16:9 | 1280w x 720h |
| 16:9 | 960w x 540h |
| 9:16 | 1080w x 1920h |
| 9:16 | 720w x 1280h |
| 9:16 | 540w x 960h |
| 1:1 | 1080w x 1080h |
| 1:1 | 720w x 720h |
| 1:1 | 540w x 540h |

### Allowed storage domains

Images for use with the composite APIas can be uploaded with the /v2/storage/image API. If that API is used to upload an image, then the uploadId is returned. The value of the `source.url` properties in those API requests is a pre-signed URL referencing an image that is stored in a supported domain.

The following domains are allowed for storage URLs used with the API:

| Domain | Provider |
| --- | --- |
| amazonaws.com | Amazon Web Services |
| amazonaws.com:443 | Amazon Web Services |
| windows.net | Microsoft Azure |
| windows.net:443 | Microsoft Azure |
| dropboxusercontent.com | Dropbox |
| dropboxusercontent.com:443 | Dropbox |
| storage.googleapis.com | Google Cloud |
| storage.googleapis.com:443 | Google Cloud |
| assets.frame.io | Frame.io |
| adobe.io | Adobe |
