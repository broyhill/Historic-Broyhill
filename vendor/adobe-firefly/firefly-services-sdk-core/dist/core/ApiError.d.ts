/*************************************************************************
 * ADOBE CONFIDENTIAL
 * ___________________
 *
 * Copyright 2024 Adobe
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
import type { ApiRequestOptions } from "./ApiRequestOptions";
import type { ApiResult } from "./ApiResponse";
/**
 * Error thrown when an API request fails
 */
export declare class ApiError extends Error {
    /**
     * The URL of the request that failed
     */
    readonly url: string;
    /**
     * The HTTP status code of the response
     */
    readonly status: number;
    /**
     * The HTTP status text of the response
     */
    readonly statusText: string;
    /**
     * The body of the response
     */
    readonly body: any;
    /**
     * The request options that were used
     */
    readonly request: ApiRequestOptions;
    constructor(request: ApiRequestOptions, response: ApiResult, message: string);
}
