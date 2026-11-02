---
title: Grant apps access to a Custom Model Guide
description: >-
  Learn how to share your custom model with your technical account's API key so
  they are available to use with the endpoint.
contributors:
  - 'https://github.com/aeabreu-hub'
hideBreadcrumbNav: true
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
  title: Grant apps access to a Custom Model Guide
  description: >-
    Learn how to share your custom model with your technical account's API key
    so they are available to use with the endpoint.
twitter:
  card: summary
  title: Grant apps access to a Custom Model Guide
  description: >-
    Learn how to share your custom model with your technical account's API key
    so they are available to use with the endpoint.
---

# Grant Applications Access to Your Custom Model Guide

Use this guide to give applications access to your custom models,
making them available for use with API endpoints.

## Overview

Once you've [trained a custom model](../../concepts/custom-models/index.md), you need to share it with your technical account
so that the model is accessible to the [List Custom Models](../../../api/index.md) API
and the [Text to Image](../../../api/index.md) API.

<InlineAlert variant="info" slots="heading, text" />

Note

Any models shared at the organization level are also shared with individual projects.

<Embed slots="video"/>

[Share a custom model](https://youtu.be/_xxXrEWZ8cc)

## To share the custom model

Follow the steps below:

1. Navigate to your project in the [Adobe Developer Console](https://developer.adobe.com/console/home). Click the API credential link, either in the sidenav or under the credentials header.

![Project credentials screenshot](./images/api-cred.png)

<Columns slots="image, text" repeat="1" />

![Technical Account Email](./images/tech-account-email.png)

2. Copy the **Technical Account Email**. 
3. Log in to your [Firefly account](https://firefly.adobe.com/) and [navigate to the custom model](https://firefly.adobe.com/custom-models) itself.
4. Click the **"..."** button in the top right for more options, then click **Share**.
5. In the modal window, paste the technical account email in the field for *Add people or groups*.

<Columns slots="image, text" repeat="1" />

![Invite to edit screenshot](./images/invite-to-editbutton.png)

6. Click **Invite to edit**.

<InlineAlert variant="help" slots="heading, text" />

Tip

The account may appear in the *Pending* state for sharing, but access
to the custom model is granted.

Now that you've shared your custom model it will be available through the API endpoint.
