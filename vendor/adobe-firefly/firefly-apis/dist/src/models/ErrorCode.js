"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCode = void 0;
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
/**
 * An enumeration.
 */
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["MODEL_NOT_LOADED"] = "model_not_loaded";
    ErrorCode["NOT_IMPLEMENTED"] = "not_implemented";
    ErrorCode["VALIDATION_ERROR"] = "validation_error";
    ErrorCode["RUNTIME_ERROR"] = "runtime_error";
    ErrorCode["TIMEOUT_ERROR"] = "timeout_error";
    ErrorCode["PROMPT_UNSAFE"] = "prompt_unsafe";
    ErrorCode["INPUT_MEDIA_UNSAFE"] = "input_media_unsafe";
    ErrorCode["OUTPUT_MEDIA_UNSAFE"] = "output_media_unsafe";
    ErrorCode["BAD_REQUEST"] = "bad_request";
    ErrorCode["LANGUAGE_NOT_SUPPORTED"] = "language_not_supported";
    ErrorCode["ACCESS_ERROR"] = "access_error";
    ErrorCode["INVALID_CONTENT_TYPE"] = "invalid_content_type";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
