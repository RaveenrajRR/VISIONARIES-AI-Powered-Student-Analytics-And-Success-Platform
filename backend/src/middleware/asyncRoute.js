"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncRoute = asyncRoute;
function asyncRoute(handler) {
    return (req, res, next) => {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
}
