/*************************************************************************
 * ADOBE CONFIDENTIAL
 * ___________________
 *
 * Copyright 2025 Adobe
 * All Rights Reserved.
 *
 * NOTICE: All information contained herein is, and remains
 * the property of Adobe and its suppliers, if any. The intellectual
 * and technical concepts contained herein are proprietary to Adobe
 * and its suppliers and are protected by all applicable intellectual
 * property laws, including trade secret and copyright laws.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Adobe.

 **************************************************************************/
import type { ClientConfig, ClientCredentials, ApiOptions, ApiResponse } from "@adobe/firefly-services-sdk-core";
import { BaseServiceClient } from "@adobe/firefly-services-sdk-core/internal";
import type { ExpandImageRequest } from "./models/ExpandImageRequest";
import type { ExpandImageResponse } from "./models/ExpandImageResponse";
import type { FillImageRequest } from "./models/FillImageRequest";
import type { FillImageResponse } from "./models/FillImageResponse";
import type { GenerateImagesRequest } from "./models/GenerateImagesRequest";
import type { GenerateImagesResponse } from "./models/GenerateImagesResponse";
import type { GenerateObjectCompositeRequest } from "./models/GenerateObjectCompositeRequest";
import type { GenerateObjectCompositeResponse } from "./models/GenerateObjectCompositeResponse";
import type { GenerateSimilarImagesRequest } from "./models/GenerateSimilarImagesRequest";
import type { GenerateSimilarImagesResponse } from "./models/GenerateSimilarImagesResponse";
import type { GenerateVideoRequestV3 } from "./models/GenerateVideoRequestV3";
import type { UploadResponse } from "./models/UploadResponse";
/**
 * FireflyClient
 * Firefly API client to use the Firefly API services
 */
export declare class FireflyClient extends BaseServiceClient {
    /**
     * Constructor for FireflyClient
     * @param config configuration for creating client. Using ClientCredentials enables automatic token refresh, which cannot be disabled. Instead To manage authentication manually, use ClientConfig.
     */
    constructor(config: ClientConfig | ClientCredentials);
    /**
     * Generate Images API
     * Generate images based on a prompt with optional reference image to match style and structure.
     * @param requestBody image generation request body.
     * @param options Additional options to send any additional data or cancel the request
     * @returns GenerateImagesResponse Generate images response
     * @throws {ApiError}
     */
    generateImages(requestBody: GenerateImagesRequest, options?: ApiOptions): Promise<ApiResponse<GenerateImagesResponse>>;
    /**
     * Generate video from text
     * Generate a video using a text prompt.
     * @param requestBody The request body for the video generation. Any of these listed properties can be individually omitted/empty, but some kind of parameter data is required.
     * @param additionalParams Additional parameters to send with the request
     * @param additionalParams.xModelVersion Specify the Firefly model version to use for the video generation.
     * @param options Additional options to send any additional data or cancel the request
     * @returns any Successful Response
     * @throws {ApiError}
     */
    generateVideoV3(requestBody: GenerateVideoRequestV3, additionalParams?: {
        xModelVersion: "video1_standard";
    }, options?: ApiOptions): Promise<ApiResponse<{
        jobId: string;
        statusUrl: string;
        cancelUrl: string;
    }>>;
    /**
     * Upload API
     * @param requestBody Upload source image or mask image of types PNG/JPEG/WEBP for Image-to-Image operations, such as  fill, expand. This api returns an identifier that is used to refer to uploaded content.
     * @param options Additional options to send any additional data or cancel the request
     * @returns UploadResponse Successful Response
     * @throws {ApiError}
     */
    upload(requestBody: Blob, options?: ApiOptions): Promise<ApiResponse<UploadResponse>>;
    /**
     * Generate Similar Images API
     * Generate similar Images based on the reference image.
     * @param requestBody Generate similar images request body
     * @param options Additional options to send any additional data or cancel the request
     * @returns GenerateSimilarImagesResponse Generate similar images response
     * @throws {ApiError}
     */
    generateSimilarImages(requestBody: GenerateSimilarImagesRequest, options?: ApiOptions): Promise<ApiResponse<GenerateSimilarImagesResponse>>;
    /**
     * Expand Image API
     * Change the aspect ratio or size of an image and expand its contents with or without a text prompt.
     * @param requestBody image expansion request body.
     * @param options Additional options to send any additional data or cancel the request
     * @returns ExpandImageResponse Expand Image Response
     * @throws {ApiError}
     */
    expandImage(requestBody: ExpandImageRequest, options?: ApiOptions): Promise<ApiResponse<ExpandImageResponse>>;
    /**
     * Fill Image API
     * Fill the masked area of an image with an optional prompt.
     * @param requestBody image fill request body.
     * @param options Additional options to send any additional data or cancel the request
     * @returns FillImageResponse Fill Image Response
     * @throws {ApiError}
     */
    fillImage(requestBody: FillImageRequest, options?: ApiOptions): Promise<ApiResponse<FillImageResponse>>;
    /**
     * Generate Object Composite API
     * Upload an image(with or without mask), such as a product photo, and utilize a text prompt to generate a seamlessly composited scene featuring the product.
     * @param requestBody Object composite generation request body.
     * @param options Additional options to send any additional data or cancel the request
     * @returns GenerateObjectCompositeResponse Generate Object Composite Response
     * @throws {ApiError}
     */
    generateObjectComposite(requestBody: GenerateObjectCompositeRequest, options?: ApiOptions): Promise<ApiResponse<GenerateObjectCompositeResponse>>;
}
