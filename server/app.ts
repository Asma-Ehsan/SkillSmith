require("dotenv").config();
import express, { NextFunction, Request, Response } from "express"
export const app = express();
import cors from "cors";
import cookieParser from "cookie-parser";
import {ErrorMiddleware} from "./middleware/error";

//body parser
app.use(express.json({limit: "50mb"})); //Parses JSON request data into a JS object.limit: "50mb" allows bodies up to 50 MB.

//cookie-parser
app.use(cookieParser()); //Parses cookies attached to the client request object.

//cors
app.use(cors({
    origin: process.env.ORIGIN
}));

//testing api
app.get("/test", (req: Request,res:Response, next:NextFunction) => {
    res.status(200).json({
        success: true,
        message: "Server is running"
    })
});

//unknown route: this means that the user has accessed a route that does not exist in the server.
app.use((req: Request,res:Response, next:NextFunction) => {
    const err = new Error(`Route ${req.originalUrl} not found`) as any;
    err.statusCode = 404;
    next(err);
});

//error middleware
app.use(ErrorMiddleware);