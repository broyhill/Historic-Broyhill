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
import type { ApiResult, ApiResponse } from "./ApiResponse";
import type { ServiceConfig } from "./ServiceTypes";
export declare const isDefined: <T>(value: T | null | undefined) => value is Exclude<T, null | undefined>;
export declare const isString: (value: any) => value is string;
export declare const isStringWithValue: (value: any) => value is string;
export declare const isBlob: (value: any) => value is Blob;
export declare const isFormData: (value: any) => value is FormData;
export declare const base64: (str: string) => string;
export declare const getQueryString: (params: Record<string, any>) => string;
export declare const getFormData: (options: ApiRequestOptions) => FormData | undefined;
type Resolver<T> = (options: ApiRequestOptions) => Promise<T>;
export declare const resolve: <T>(options: ApiRequestOptions, resolver?: T | Resolver<T> | undefined) => Promise<T | undefined>;
export declare const getHeaders: (config: ServiceConfig, options: ApiRequestOptions) => Promise<Headers>;
export declare const getRequestBody: (options: ApiRequestOptions) => any;
export declare const sendRequest: (config: ServiceConfig, options: ApiRequestOptions, url: string, body: any, formData: FormData | undefined, headers: Headers) => Promise<Response>;
export declare const getResponseHeader: (response: Response, responseHeader?: string) => string | undefined;
export declare const getResponseBody: (response: Response) => Promise<any>;
export declare const catchErrorCodes: (options: ApiRequestOptions, result: ApiResult) => void;
/**
 * Request method
 * @param config The OpenAPI configuration object
 * @param options The request options from the service
 * @returns CancelablePromise<T>
 * @throws ApiError
 */
export declare const request: <T>(config: ServiceConfig, options: ApiRequestOptions) => Promise<ApiResponse<T>>;
export {};
