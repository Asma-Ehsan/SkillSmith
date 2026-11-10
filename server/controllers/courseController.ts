import { NextFunction, Request, Response } from "express"
import ErrorHandler from "../utils/ErrorHandler"
import { catchAsyncError } from "../middleware/catchAsyncErrors"
import cloudinary from "cloudinary";
import { createCourse } from "../services/course.services";
import CourseModel from "../models/courseModel";

//upload course 
export const uploadCourse = catchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
    try {
        const data = req.body;
        const thumbnail = data.thumbnail;
        if(thumbnail) {
            const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
                folder: "courses"
            });

            data.thumbnail = {
                public_id: myCloud.public_id,
                url: myCloud.secure_url
            }
        }
        createCourse(data, res, next);
    } catch (error: any) {
         return next(new ErrorHandler(error.message, 400)) 
    }
});

// edit course
export const editCourse = catchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
    try {
        const data = req.body;
        const thumbnail = data.thumbnail;
        if(thumbnail){
            await cloudinary.v2.uploader.destroy(thumbnail.public_id);
                 const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
                folder: "courses"
            });

            data.thumbnail = {
                public_id: myCloud.public_id,
                url: myCloud.secure_url
            }
        }

        const courseId = req.params.id;

        const course = await CourseModel.findByIdAndUpdate(courseId, 
            {$set: data},
            {new: true}
        );

        res.status(201).json({
            success: true,
            course,
        });
        
    } catch (error: any) {
         return next(new ErrorHandler(error.message, 500));
    }
});