"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hmacSign = hmacSign;
exports.nowUnixMs = nowUnixMs;
const crypto_1 = __importDefault(require("crypto"));
function hmacSign(body, secret) {
    return crypto_1.default.createHmac("sha256", secret).update(body).digest("hex");
}
function nowUnixMs() {
    return Date.now();
}
