import { NextFunction, Request, Response } from "express"
import ErrorHandler from "../utils/ErrorHandler"
import { catchAsyncError } from "../middleware/catchAsyncErrors"
import cloudinary from "cloudinary";
import { redis } from "../utils/redis";
import ejs, { name } from "ejs";
import sendMail from "../sendMail";
import orderModel, {IOrder} from "../models/orderModel";
import CourseModel from "../models/courseModel";
import userModel from "../models/userModel";
import path from "path";
import notificationModel from "../models/notificationModel";
import { newOrder } from "../services/order.services";

// create order
export const createOrder = catchAsyncError(async(req: Request, res: Response, next: NextFunction) => {
    try {
        const { courseId, payment_info } = req.body as IOrder;

        const user = await userModel.findById(req.user?._id);
        if (!user) return next(new ErrorHandler("User not found", 404));

        const courseExistInUser = user?.courses.some((course:any) => course._id.toString() === courseId);
        if(courseExistInUser) return next(new ErrorHandler("You have already purchased this course", 400));

        const course = await CourseModel.findById(courseId);
        if(!course) return next(new ErrorHandler("Course not found", 404));

        const data : any = {
            courseId: course._id,
            userId: user?._id,
            payment_info,
        }

        const mailData = {
            order: {
                _id: course._id.toString().slice(0,6),
                name: course.name,
                price: course.price,
                date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric'}),
            }
        }

        const html = await ejs.renderFile(path.join(__dirname, "../mails/order-confirmation.ejs"), {order: mailData});

        try {
            if(user){
                await sendMail({
                    email: user.email,
                    subject: "Order Confirmation",
                    template: "order-confirmation.ejs",
                    data: mailData,
                })
            }
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400)) 
        }

        user?.courses.push({ courseId: course._id.toString() });

        await user?.save();

        await notificationModel.create({
            userId: user?._id.toString(),
            title: "New Order",
            message: `You have a new order from ${course.name}`,
        });
        
       course.purchased ?  course.purchased += 1 : course.purchased;

        await course.save();

        newOrder(data,res, next);

    } catch (error: any) {
         return next(new ErrorHandler(error.message, 400)) 
    }
});