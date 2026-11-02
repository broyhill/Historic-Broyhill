"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CameraMotion = void 0;
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
var CameraMotion;
(function (CameraMotion) {
    CameraMotion["CAMERA_PAN_LEFT"] = "camera pan left";
    CameraMotion["CAMERA_PAN_RIGHT"] = "camera pan right";
    CameraMotion["CAMERA_ZOOM_IN"] = "camera zoom in";
    CameraMotion["CAMERA_ZOOM_OUT"] = "camera zoom out";
    CameraMotion["CAMERA_TILT_UP"] = "camera tilt up";
    CameraMotion["CAMERA_TILT_DOWN"] = "camera tilt down";
    CameraMotion["CAMERA_LOCKED_DOWN"] = "camera locked down";
    CameraMotion["CAMERA_HANDHELD"] = "camera handheld";
})(CameraMotion || (exports.CameraMotion = CameraMotion = {}));
