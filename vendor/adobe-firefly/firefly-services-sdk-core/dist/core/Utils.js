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
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = void 0;
/**
 * Function to sleep current execution for a given time
 * @param millisec time in milliseconds to sleep
 * @returns Promise that resolves after the given time
 */
function sleep(millisec) {
    return new Promise((resolve) => setTimeout(resolve, millisec));
}
exports.sleep = sleep;
