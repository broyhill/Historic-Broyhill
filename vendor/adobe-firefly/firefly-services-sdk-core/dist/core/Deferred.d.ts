/*************************************************************************
 *
 * ADOBE CONFIDENTIAL
 * ___________________
 *
 *  Copyright 2024 Adobe
 *  All Rights Reserved.
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
export declare class Deferred<T> {
    private _promise;
    private _resolvePromise;
    private _rejectPromise;
    private _isFulfilled;
    private _isRejected;
    constructor();
    /**
     * Returns the associated promise.
     */
    get promise(): Promise<T>;
    /**
     * Indicates if the associated promise has been either rejected or fulfilled
     */
    get isSettled(): boolean;
    /**
     * Indicates if the associated promise has been fulfilled.
     */
    get isFulfilled(): boolean;
    /**
     * Indicates if the associate promise has been rejected.
     */
    get isRejected(): boolean;
    /**
     * Fulfills the associated promise with the specified value.
     *
     * @param value - used to execute the resolve method of the associated promise with the value specified.
     */
    resolve(value: T): void;
    /**
     * Rejects the associated promise with the given error.
     *
     * @param reason - reason for the rejection
     */
    reject(reason: unknown): void;
}
