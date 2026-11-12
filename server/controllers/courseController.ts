import { NextFunction, Request, Response } from "express"
import ErrorHandler from "../utils/ErrorHandler"
import { catchAsyncError } from "../middleware/catchAsyncErrors"
import cloudinary from "cloudinary";
import { createCourse } from "../services/course.services";
import CourseModel from "../models/courseModel";
import { redis } from "../utils/redis";
import mongoose from "mongoose";
import path from "node:path";
import ejs from "ejs";
import sendMail from "../sendMail";

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

//add question in course 
interface IAddQuestionData{
    question: string;
    courseId: string;
    contentId: string;
}

export const addQuestion = catchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
    try {
        const { question, courseId, contentId } = req.body as IAddQuestionData;
        const course = await CourseModel.findById(courseId);
        if(!mongoose.Types.ObjectId.isValid(contentId)) return next(new ErrorHandler("Invalid content id", 400));

        //item._id.equals(contentId) is same as item._id.toString() === contentId
        const courseContent = course?.courseData.find((item:any) => item._id.equals(contentId));

        if(!courseContent) return next(new ErrorHandler("Invalid content id", 400));

        //create a new question object
        const newQuestion : any = {
            user: req.user,
            question,
            questionReplies: [],
        }

        //add this question to our course content
        courseContent.questions.push(newQuestion);

        //save the updated course
        await course?.save();

        res.status(200).json({
            success: true,
            course,
        })

    } catch (error: any) {
         return next(new ErrorHandler(error.message, 500));
    }
});

//add answer to a question in course
interface IAddAnswerData{
    answer: string;
    questionId: string;
    courseId: string;
    contentId: string;   
}

export const addAnswer = catchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
    try {
        const { answer, questionId, courseId, contentId} : IAddAnswerData = req.body;
        const course = await CourseModel.findById(courseId);
        if(!mongoose.Types.ObjectId.isValid(contentId)) return next(new ErrorHandler("Invalid content id", 400));

        //item._id.equals(contentId) is same as item._id.toString() === contentId
        const courseContent = course?.courseData.find((item:any) => item._id.equals(contentId));

        if(!courseContent) return next(new ErrorHandler("Invalid content id", 400));

        const question = courseContent?.questions?.find((item: any) => item._id.equals(questionId));

        if(!question) return next(new ErrorHandler("Question not found or Invalid question id!", 400));

        // create a new answer object
        const newAnswer: any = {
            user: req.user,
            answer,
        };

        //add this answer to our course content 
        question.questionReplies?.push(newAnswer);

        //save the updated course
        await course?.save();
        
        //if the user in req is same as the user in question, it means it is a reply by user on admin's reply and wee need to send notification to the admin dashboard 
        if(req.user?._id === question.user._id) {
            //create a notification
        }
        //if both ids are not same it means reply is by admin and we need to notify the user via mail
        else{
            const data = {
                name: question.user.name,
                title: courseContent.title,
                questionText: question.question,   // the question text from your schema
                replierName: req.user?.name,       // who replied
                answerText: answer, 
            }

            const html = await ejs.renderFile(path.join(__dirname, "../mails/question-reply.ejs"), data);

            try {
                await sendMail({
                    email: question.user.email,
                    subject: "Question Reply",
                    template: "question-reply.ejs",
                    data,
                })
            } catch (error: any) {
                return next(new ErrorHandler(error.message,500)) 
            }
        }

        res.status(200).json({
            success: true,
            course,
        });

    } catch (error: any) {
         return next(new ErrorHandler(error.message, 500)) 
    }
});

//add review on course
interface IAddReviewData{
    review: string;
    courseId: string;
    userId: string;   
    rating: number;
}

export const addReview = catchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
    try {
        const userCourseList = req.user?.courses;
        const courseId = req.params.id;
        
        //check if the course id is already exits in user course list 
        const courseEsists = userCourseList?.some((course: any) => course._id.toString() === courseId.toString())
        if(!courseEsists) return next(new ErrorHandler("You are not eligible to review this course. Please buy it first.", 404));

        const course = await CourseModel.findById(courseId);

        const { review , rating} = req.body as IAddReviewData;

        const reviewData: any = {
            user: req.user,
            comments: review,
            rating,
        }

        course?.reviews.push(reviewData);

        let avg = 0; 
        course?.reviews.forEach((rev: any) => {
            // exp: rating1 = 5 and rating2 = 4
            // => avg = 0 + 5 = 5 
            // => avg = 5 + 4 = 9
            avg += rev.rating;
        })
        
        if(course) course.ratings = avg / course.reviews.length; // ratings = 9 / 2 = 4.5 

        await course?.save();

        const notification = {
            title: "New Review receieved!",
            message: `${req.user?.name} has added a new review on course ${course?.name}`,
        }

        //create notification

        res.json({
            success: true,
            course,
        })
    } catch (error: any) {
         return next(new ErrorHandler(error.message, 400)) 
    }
});

//add reply in review
interface IAddReviewData{
    comment: string;
    reviewId: string;
    courseId: string;
}

export const addReplyToReview = catchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
    try {
        const { comment, reviewId, courseId } = req.body as IAddReviewData;

        const course = await CourseModel.findById(courseId);
        if(!course) return next(new ErrorHandler("Course not found!", 404));

        const review = course?.reviews?.find((rev:any) => rev._id.toString() === reviewId);
        if(!review) return next(new ErrorHandler("Review not found!", 404));

        const replyData : any = {
            user: req.user,
            comment,
        };

        if(!review.commentReplies) review.commentReplies = [];

        review.commentReplies?.push(replyData);

        await course?.save();

        res.status(200).json({
            success: true,
            course,
        });

    } catch (error: any) {
         return next(new ErrorHandler(error.message, 400)) 
    }
});