"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncJobPromise = exports.AsyncJobState = void 0;
const Deferred_1 = require("./Deferred");
const Utils_1 = require("./Utils");
var AsyncJobState;
(function (AsyncJobState) {
    AsyncJobState["PENDING"] = "PENDING";
    AsyncJobState["IN_PROGRESS"] = "IN_PROGRESS";
    AsyncJobState["COMPLETED"] = "COMPLETED";
    AsyncJobState["FAILED"] = "FAILED";
    AsyncJobState["CANCELLED"] = "CANCELLED";
})(AsyncJobState || (exports.AsyncJobState = AsyncJobState = {}));
class AsyncJobPromise {
    constructor() {
        this._oldState = AsyncJobState.PENDING;
        this._state = AsyncJobState.PENDING;
        this._stautsChangeHandlers = [];
        this._deferred = new Deferred_1.Deferred();
        this._pollJobStatus();
    }
    then(onfulfilled, 
    /* eslint-disable  @typescript-eslint/no-explicit-any -- To support customised error form extending classes */
    onrejected) {
        return this._deferred.promise.then(onfulfilled, onrejected);
    }
    catch(
    /* eslint-disable  @typescript-eslint/no-explicit-any -- To support customised error form extending classes */
    onrejected) {
        return this._deferred.promise.catch(onrejected);
    }
    finally(onfinally) {
        return this._deferred.promise.finally(onfinally);
    }
    /**
     * @returns The result of the job if the job has completed successfully.
     */
    getResult() {
        return this._response;
    }
    /**
     * @returns The error details if the job has failed.
     */
    getError() {
        return this._error;
    }
    /**
     * Gets the next time in milliseconds when the job status should be checked again.
     * This method should be implemented by the concrete class to provide an accurate value based on the value provided by the server.
     * @returns The next time in milliseconds when the job status should be checked again. Default value is 2000 milliseconds.
     */
    _getNextRetryTimeInMilliSecs() {
        return 2000;
    }
    /**
     * Checks if the job is done.
     * @returns true if the job is done, false otherwise.
     */
    _isDone() {
        return this._state !== AsyncJobState.PENDING && this._state !== AsyncJobState.IN_PROGRESS;
    }
    /**
     * When the job is done, this method is called to resolve or reject the promise.
     */
    _fullfillPromise() {
        if (this._state === AsyncJobState.COMPLETED) {
            if (this._response)
                this._deferred.resolve(this._response);
            return;
        }
        this._deferred.reject(this._error);
    }
    /**
     * Polls the status of the job at regular intervals, till the job is done.
     */
    _pollJobStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            /* eslint-disable no-await-in-loop -- We dont all the item to start immediatly, wait for updated statues before starting*/
            while (!this._isDone()) {
                yield (0, Utils_1.sleep)(this._getNextRetryTimeInMilliSecs());
                yield this._fetchJobStatus();
                this._checkNDispatchStateChange();
            }
            this._fullfillPromise();
        });
    }
    /**
     * Check for status change and Notify listeners
     */
    _checkNDispatchStateChange() {
        if (this._oldState !== this._state) {
            this._oldState = this._state;
            for (const listener of this._stautsChangeHandlers) {
                listener(this._state);
            }
        }
    }
}
exports.AsyncJobPromise = AsyncJobPromise;
