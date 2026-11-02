"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FireflyClient = void 0;
const internal_1 = require("@adobe/firefly-services-sdk-core/internal");
// Package.json import for package details
const package_json_1 = require("./../package.json");
// Server to Server Token Provider imports for creating TokenProvider
const firefly_services_common_apis_1 = require("@adobe/firefly-services-common-apis");
/**
 * FireflyClient
 * Firefly API client to use the Firefly API services
 */
class FireflyClient extends internal_1.BaseServiceClient {
    /**
     * Constructor for FireflyClient
     * @param config configuration for creating client. Using ClientCredentials enables automatic token refresh, which cannot be disabled. Instead To manage authentication manually, use ClientConfig.
     */
    constructor(config) {
        const urlMap = new Map([["production", "https://firefly-api.adobe.io"]]);
        const environment = config.serviceEnvironment
            ? config.serviceEnvironment
            : internal_1.BaseServiceClient.getEnvFromVersion(package_json_1.version);
        const internalClientConfig = {
            clientId: "",
            serviceEnvironment: environment,
            tokenProvider: undefined
        };
        if (config.tokenProvider) {
            const clientConfig = config;
            internalClientConfig.tokenProvider = clientConfig.tokenProvider;
            internalClientConfig.clientId = clientConfig.clientId;
            internalClientConfig.serviceEnvironment = clientConfig.serviceEnvironment;
        }
        else if (config.clientSecret) {
            const clientCredentials = config;
            internalClientConfig.clientId = clientCredentials.clientId;
            internalClientConfig.serviceEnvironment = clientCredentials.serviceEnvironment;
            const options = {
                scopes: clientCredentials.scopes,
                serviceEnvironment: internalClientConfig.serviceEnvironment
            };
            const autOptions = {
                clientId: internalClientConfig.clientId,
                clientSecret: clientCredentials.clientSecret,
                scopes: (options === null || options === void 0 ? void 0 : options.scopes) ? options.scopes : "firefly_api,ff_apis"
            };
            const tokenProvider = new firefly_services_common_apis_1.ServerToServerTokenProvider(autOptions, { autoRefresh: true });
            internalClientConfig.tokenProvider = tokenProvider;
        }
        else {
            throw new Error("Invalid configuration provided. Provide config with tokenProvider or clientSecret.");
        }
        const internalConfig = Object.assign(Object.assign({}, internalClientConfig), { baseUrl: internal_1.BaseServiceClient.getBaseUrl(urlMap, environment), headers: {
                "User-Agent": `FFS-SDK, JS, Firefly-${package_json_1.version}`
            } });
        super(internalConfig);
    }
    /**
     * Generate Images API
     * Generate images based on a prompt with optional reference image to match style and structure.
     * @param requestBody image generation request body.
     * @param options Additional options to send any additional data or cancel the request
     * @returns GenerateImagesResponse Generate images response
     * @throws {ApiError}
     */
    generateImages(requestBody, options) {
        return this._httpRequest.request({
            method: "POST",
            url: "/v3/images/generate",
            body: requestBody,
            mediaType: "application/json",
            errors: {
                400: `Bad Request`,
                403: `Forbidden`,
                408: `Request Timeout`,
                415: `Unsupported Media Type`,
                422: `Unprocessable Entity`,
                500: `Internal Server Error`,
                501: `Not Implemented`,
                503: `Service Unavailable`
            },
            signal: options === null || options === void 0 ? void 0 : options.signal
        });
    }
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
    generateVideoV3(requestBody, additionalParams = {
        xModelVersion: "video1_standard"
    }, options) {
        return this._httpRequest.request({
            method: "POST",
            url: "/v3/videos/generate",
            headers: {
                "x-model-version": additionalParams.xModelVersion
            },
            body: requestBody,
            mediaType: "application/json",
            errors: {
                400: `Bad Request`,
                403: `Forbidden`,
                404: `Not Found`,
                408: `Request Timeout`,
                409: `Conflict`,
                410: `Gone`,
                415: `Unsupported Media Type`,
                422: `Unprocessable Entity`,
                429: `Too Many Requests`,
                451: `Unavailable For Legal Reasons`,
                499: `Additional Response`,
                500: `Internal Server Error`,
                501: `Not Implemented`,
                503: `Service Unavailable`
            },
            signal: options === null || options === void 0 ? void 0 : options.signal
        });
    }
    /**
     * Upload API
     * @param requestBody Upload source image or mask image of types PNG/JPEG/WEBP for Image-to-Image operations, such as  fill, expand. This api returns an identifier that is used to refer to uploaded content.
     * @param options Additional options to send any additional data or cancel the request
     * @returns UploadResponse Successful Response
     * @throws {ApiError}
     */
    upload(requestBody, options) {
        const supportedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
        if (requestBody instanceof Blob && !supportedMimeTypes.includes(requestBody.type)) {
            return Promise.reject(new Error(`Unsuported MIME type("${requestBody.type}") in blob for image upload MIME type supported are "image/jpeg", "image/png", "image/webp".`));
        }
        return this._httpRequest.request({
            method: "POST",
            url: "/v2/storage/image",
            body: requestBody,
            mediaType: requestBody.type,
            errors: {
                400: `Bad Request`,
                403: `Forbidden`,
                404: `Not Found`,
                408: `Request Timeout`,
                409: `Conflict`,
                410: `Gone`,
                415: `Unsupported Media Type`,
                422: `Unprocessable Entity`,
                451: `Unavailable For Legal Reasons`,
                499: `Additional Response`,
                500: `Internal Server Error`,
                501: `Not Implemented`,
                503: `Service Unavailable`
            },
            signal: options === null || options === void 0 ? void 0 : options.signal
        });
    }
    /**
     * Generate Similar Images API
     * Generate similar Images based on the reference image.
     * @param requestBody Generate similar images request body
     * @param options Additional options to send any additional data or cancel the request
     * @returns GenerateSimilarImagesResponse Generate similar images response
     * @throws {ApiError}
     */
    generateSimilarImages(requestBody, options) {
        return this._httpRequest.request({
            method: "POST",
            url: "/v3/images/generate-similar",
            body: requestBody,
            mediaType: "application/json",
            errors: {
                400: `Bad Request`,
                403: `Forbidden`,
                408: `Request Timeout`,
                415: `Unsupported Media Type`,
                422: `Unprocessable Entity`,
                500: `Internal Server Error`,
                501: `Not Implemented`,
                503: `Service Unavailable`
            },
            signal: options === null || options === void 0 ? void 0 : options.signal
        });
    }
    /**
     * Expand Image API
     * Change the aspect ratio or size of an image and expand its contents with or without a text prompt.
     * @param requestBody image expansion request body.
     * @param options Additional options to send any additional data or cancel the request
     * @returns ExpandImageResponse Expand Image Response
     * @throws {ApiError}
     */
    expandImage(requestBody, options) {
        return this._httpRequest.request({
            method: "POST",
            url: "/v3/images/expand",
            body: requestBody,
            mediaType: "application/json",
            errors: {
                400: `Bad Request`,
                403: `Forbidden`,
                408: `Request Timeout`,
                415: `Unsupported Media Type`,
                422: `Unprocessable Entity`,
                500: `Internal Server Error`,
                501: `Not Implemented`,
                503: `Service Unavailable`
            },
            signal: options === null || options === void 0 ? void 0 : options.signal
        });
    }
    /**
     * Fill Image API
     * Fill the masked area of an image with an optional prompt.
     * @param requestBody image fill request body.
     * @param options Additional options to send any additional data or cancel the request
     * @returns FillImageResponse Fill Image Response
     * @throws {ApiError}
     */
    fillImage(requestBody, options) {
        return this._httpRequest.request({
            method: "POST",
            url: "/v3/images/fill",
            body: requestBody,
            mediaType: "application/json",
            errors: {
                400: `Bad Request`,
                403: `Forbidden`,
                408: `Request Timeout`,
                415: `Unsupported Media Type`,
                422: `Unprocessable Entity`,
                500: `Internal Server Error`,
                501: `Not Implemented`,
                503: `Service Unavailable`
            },
            signal: options === null || options === void 0 ? void 0 : options.signal
        });
    }
    /**
     * Generate Object Composite API
     * Upload an image(with or without mask), such as a product photo, and utilize a text prompt to generate a seamlessly composited scene featuring the product.
     * @param requestBody Object composite generation request body.
     * @param options Additional options to send any additional data or cancel the request
     * @returns GenerateObjectCompositeResponse Generate Object Composite Response
     * @throws {ApiError}
     */
    generateObjectComposite(requestBody, options) {
        return this._httpRequest.request({
            method: "POST",
            url: "/v3/images/generate-object-composite",
            body: requestBody,
            mediaType: "application/json",
            errors: {
                400: `Bad Request`,
                403: `Forbidden`,
                408: `Request Timeout`,
                415: `Unsupported Media Type`,
                422: `Unprocessable Entity`,
                500: `Internal Server Error`,
                501: `Not Implemented`,
                503: `Service Unavailable`
            },
            signal: options === null || options === void 0 ? void 0 : options.signal
        });
    }
}
exports.FireflyClient = FireflyClient;
