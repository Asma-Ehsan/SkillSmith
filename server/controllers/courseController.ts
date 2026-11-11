import { NextFunction, Request, Response } from "express"
import ErrorHandler from "../utils/ErrorHandler"
import { catchAsyncError } from "../middleware/catchAsyncErrors"
import cloudinary from "cloudinary";
import { createCourse } from "../services/course.services";
import CourseModel from "../models/courseModel";
import { redis } from "../utils/redis";

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

// get single course -- without purchasing
export const getSingleCourse = catchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
    try {
        const courseId = req.params.id;

        const isCashExist = await redis.get(String(courseId));

        if(isCashExist){
            const course = JSON.parse(isCashExist);
            
            res.status(200).json({
                success: true,
                course,
            });

        }else{
            //remove suggestion, videoUrl, questions, links from courseData as it will be accessible only after purchasing the course
            const course = await CourseModel.findById(req.params.id).select("-courseData.suggestion -courseData.videoUrl -courseData.questions -courseData.links");
            
            await redis.set(String(courseId), JSON.stringify(course));

            res.status(200).json({
                success: true,
                course,
            });

        }

    } catch (error: any) {
         return next(new ErrorHandler(error.message, 400)) 
    }
});

// get all courses -- without purchasing
export const getAllCourses = catchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
    try {
        const isCashExist = await redis.get("allCourses");

        if(isCashExist){
            const course = JSON.parse(isCashExist);
            
            res.status(200).json({
                success: true,
                course,
            });

        }else{
            //remove suggestion, videoUrl, questions, links from courseData as it will be accessible only after purchasing the course
            const courses = await CourseModel.find().select("-courseData.suggestion -courseData.videoUrl -courseData.questions -courseData.links");
            
            await redis.set("allCourses", JSON.stringify(courses));

            res.status(200).json({
            success: true,
            courses,
        });

        }
    } catch (error: any) {
         return next(new ErrorHandler(error.message, 400)) 
    }
});

//get course content -- only for valid users
export const getCourseByUser = catchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
    try {
        const userCourseList = req.user?.courses;
        const courseId = req.params.id;
        
        //finding if the course id in url is present in user's course list or not. crsId in user is object and crsId in params is string
        const courseExists = userCourseList?.find((course:any) => course._id.toString() === courseId);
        if(!courseExists) return next(new ErrorHandler("Your are not eligible to access this course. Please buy it first.", 404));

        const course = await CourseModel.findById(courseId);
        const content = course?.courseData;

        res.status(200).json({
            success: true,
            content,
        });
        
    } catch (error: any) {
         return next(new ErrorHandler(error.message, 500)) 
    }
});