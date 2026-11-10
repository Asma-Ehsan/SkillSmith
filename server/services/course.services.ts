import { Response } from "express";
import { catchAsyncError } from "../middleware/catchAsyncErrors";
import CourseModel from "../models/courseModel";

//create course
export const createCourse = catchAsyncError(async(data: any, res: Response) => {
    const course = await CourseModel.create(data);
    res.status(201).json({
        success: true, 
        course,
    })
})