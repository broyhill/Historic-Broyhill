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
import { BaseHttpRequest } from "./BaseHttpRequest";
import { ServiceConfig } from "./ServiceTypes";
/**
 * Base class for all the Product API clients
 */
export declare class BaseServiceClient {
    protected _httpRequest: BaseHttpRequest;
    protected _config: ServiceConfig;
    constructor(config: ServiceConfig);
    /**
     * Compute and return baseurl for provided environment from the urlMap
     * @param urlMap
     * @param environment
     * @returns baseUrl as string
     */
    protected static getBaseUrl(urlMap: Map<string, string>, environment: string): string;
    /**
     * Compute and return environment from the version string
     * @param version
     * @returns environment as string
     */
    protected static getEnvFromVersion(version: string): string;
    private validateServiceConfig;
}
