import ErrorHandler from "../utils/ErrorHandler"; 
import { NextFunction, Request, Response } from "express"

export const ErrorMiddleware = (err: any, req:Request, res:Response, next:NextFunction) => {
    err.statusCode = err.statusCode || 500;
    err.message = err.message || "Internal Server Error";

    // if error have any name or code then check for the following conditions:

    //wrong mongodb id error
    if(err.name === "CastError"){
        const message = `Resources not found with this id... Invalid ${err.path}`;
        err = new ErrorHandler(message,400);
    }

    //duplicate key error (i.e duplicate email)
    if(err.code === 11000){
        const message = `Duplicate key ${Object.keys(err.keyValue)} Entered`
        err = new ErrorHandler(message, 400);
    }

    //wrong jwt error
    if(err.name === "JsonWebTokenError"){
        const message = `Your url is invalid. Please try again later!`
        err = new ErrorHandler(message,400);
    }

    //jwt expired
    if(err.name === "TokenExpiredError"){
        const message = `Your url is expired. Please try again later!`
        err = new ErrorHandler(message, 400);
    }

    res.status(err.statusCode).json({
        success: false,
        message: err.message
    })
}