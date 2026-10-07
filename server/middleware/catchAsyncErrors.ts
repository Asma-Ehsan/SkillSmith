import { NextFunction, Request, Response } from "express";

/*
 NOTE: This wraps async route functions.
 If my own try/catch handles an error, this does nothing extra.
 If an error escapes without try/catch, this catches it and 
 sends it to next(error) automatically -> goes to error.js middleware.
 Purpose: safety net so a forgotten try/catch never crashes the server.
*/
export const catchAsyncError = (theFunc:any) => (req:Request, res:Response, next:NextFunction) => { 
    // Runs my async controller; if it throws and I didn't catch it, forwards error to next() -> error.js
    Promise.resolve(theFunc(req,res,next)).catch(next);
};

/*module.exports = (theFunc) => {
    return (req, res, next) => {
        ...
    };
};
.catch((error) => {
    next(error);
});
*/

/*
catchAsyncError - Notes

Line-by-line

module.exports = (theFunc) => (req,res,next) => {

* module.exports = ... — this file exports one thing: a function.
* (theFunc) => (req,res,next) => {...} — this is a function that takes another function (theFunc) and       returns a new function. This pattern is called a "higher-order function" (a function that works with other functions).
* Think of theFunc as "the actual controller logic you wrote" (like the login logic).
* The returned function (req, res, next) => {...} is the real route handler that Express will run when a request comes in.


Promise.resolve(theFunc(req,res,next)).catch(next);

* theFunc(req,res,next) — this runs your actual controller code (like the login function), passing it req, res, next like normal.
* Since theFunc is async, calling it always returns a Promise (a "please wait, I'll tell you later if it worked or failed" object).
* Promise.resolve(...) — wraps it safely, just to be sure we're dealing with a Promise.
* .catch(next) — this is the important part. If the Promise fails (an error happens anywhere inside your async function), it is caught here, and passed into next(error).
* In Express, calling next(error) (with something inside the brackets) tells Express: "skip everything else, go straight to the error-handling middleware." That's your middleware/error.js file.

How to use it (from your code)


router.post("/login-user", catchAsyncErrors(async(req, res, next) => {
    try {
        // login code
    } catch (error) {
        return next(new ErrorHandler(error.message, 500))
    }
}));

You wrap your whole async function inside catchAsyncErrors(...). So even if you forget a try/catch somewhere, this wrapper is your safety net.

Connection with other files

1. Used inside every controller file (user.js, shop.js, product.js, etc.) to wrap route handlers.
2. Sends errors to middleware/error.js (through next(error)).
3. Works together with utils/ErrorHandler.js, which creates a nicely formatted error object.

Flow (request journey example)

1. User sends a login request.
2. Express runs the function returned by catchAsyncErrors.
3. That function calls your real login code (theFunc).
4. If login code throws an error → caught by .catch(next) → sent to error.js middleware → user gets a clean error message like {success: false, message: "..."}.
5. If login code works fine → response is sent normally, catchAsyncErrors doesn't interfere at all.
For your interview

If asked "why did you use this?", a simple answer is:

"I wrapped my async route handlers with catchAsyncErrors so that I don't have to write try/catch in every single controller. It automatically forwards any error to my centralized error-handling middleware."

PURPOSE:
This file is a wrapper for async Express route handlers.
It removes the need to write try-catch in every controller.

HOW IT WORKS (FLOW):
1. You pass an async function (theFunc) to this wrapper
2. It returns a new middleware function (req, res, next)
3. That function runs your original function safely
4. If anything goes wrong, error is automatically sent to Express error handler using next()
*/