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
import { ApiError } from "./ApiError";
import { ApiResponse } from "./ApiResponse";
export declare enum AsyncJobState {
    PENDING = "PENDING",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
    CANCELLED = "CANCELLED"
}
export type StatusChangeCallback = (state: AsyncJobState) => void;
export declare abstract class AsyncJobPromise<ResultT> implements PromiseLike<ApiResponse<ResultT>> {
    private _oldState;
    protected _state: AsyncJobState;
    private _deferred;
    protected _response?: ApiResponse<ResultT>;
    protected _error?: ApiError | Error | undefined;
    private _stautsChangeHandlers;
    constructor();
    /**
     * This method should be implemented by the concrete class to check the status of the job.
     */
    protected abstract _fetchJobStatus(): Promise<void>;
    then<TResult1 = ApiResponse<ResultT>, TResult2 = never>(onfulfilled?: ((value: ApiResponse<ResultT>) => TResult1 | PromiseLike<TResult1>) | null | undefined, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined): PromiseLike<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null | undefined): Promise<ApiResponse<ResultT> | TResult>;
    finally(onfinally?: () => void): Promise<ApiResponse<ResultT>>;
    /**
     * @returns The result of the job if the job has completed successfully.
     */
    getResult(): ApiResponse<ResultT>;
    /**
     * @returns The error details if the job has failed.
     */
    getError(): ApiError | Error | undefined;
    /**
     * Gets the next time in milliseconds when the job status should be checked again.
     * This method should be implemented by the concrete class to provide an accurate value based on the value provided by the server.
     * @returns The next time in milliseconds when the job status should be checked again. Default value is 2000 milliseconds.
     */
    protected _getNextRetryTimeInMilliSecs(): number;
    /**
     * Checks if the job is done.
     * @returns true if the job is done, false otherwise.
     */
    private _isDone;
    /**
     * When the job is done, this method is called to resolve or reject the promise.
     */
    private _fullfillPromise;
    /**
     * Polls the status of the job at regular intervals, till the job is done.
     */
    private _pollJobStatus;
    /**
     * Check for status change and Notify listeners
     */
    private _checkNDispatchStateChange;
}
