import { NextFunction, Request, Response } from "express"
import userModel, { IUser } from "../models/userModel"
import ErrorHandler from "../utils/ErrorHandler"
import { catchAsyncError } from "../middleware/catchAsyncErrors"
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import ejs from "ejs";
import path from "node:path";
import sendMail from "../sendMail";
import { accessTokenOptions, refreshTokenOptions, sendToken } from "../utils/jwt";
import { redis } from "../utils/redis";
import { getUserById } from "../services/user.services";
import cloudinary from "cloudinary";

require("dotenv").config();

//register user
interface IRegistrationBody {
    name: string, email: string, password: string, avatar?: string;
}

export const registrationUser = catchAsyncError(async (req:Request, res:Response, next:NextFunction) => {
    try {
        const {name, email, password} = req.body;
        
        const isEmailExist = await userModel.findOne({email});
        if(isEmailExist) return next(new ErrorHandler("Email already exist", 400));
        
        const user:IRegistrationBody = {
            name,
            email,
            password
        };

        const activationToken = createActivationToken(user); //it will return an object with token and activationCode

        const activationCode = activationToken.activationCode;
        const data = {user: {name: user.name,}, activationCode};
        const html = await ejs.renderFile(path.join(__dirname, "../mails/activation-mail.ejs"), data);

        try {
            await sendMail({
                email: user.email,
                subject: "Activate your account",
                template: "activation-mail.ejs",
                data,
            });
            res.status(201).json({
                success: true,
                message: `Please check your email ${user.email} to activate your account!`,
                activationToken: activationToken.token,
            })
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400))
        }
    } catch (error:any) {
        return next(new ErrorHandler(error.message, 400))
    }
});

// Create activation token
interface IActivationToken{
    token: string;
    activationCode: string;
}

export const createActivationToken = (user: any): IActivationToken => {
    const activationCode = Math.floor(1000 + Math.random() * 9000).toString();
    const token = jwt.sign({
        user,
        activationCode
    }, process.env.ACTIVATION_SECRET as Secret, {
        expiresIn: "5m",
    });

    return {token, activationCode}
}

//activate user
interface IActivationRequest{
    activation_token: string;
    activation_code: string;
}

export const activateUser = catchAsyncError(async (req:Request, res:Response, next:NextFunction) => {
    try {
        const {activation_token, activation_code} = req.body as IActivationRequest;

        const newUser: {user: IUser; activationCode: string} = jwt.verify(
            activation_token,
            process.env.ACTIVATION_SECRET as string
        ) as {user: IUser; activationCode: string};

        if(newUser.activationCode !== activation_code) return next(new ErrorHandler("Invalid activation code", 400));

        const {name, email,password} = newUser.user;
        
        const existUser = await userModel.findOne({email});

        if(existUser) return next(new ErrorHandler("User already exist with this email!", 400));

        const user = await userModel.create({
            name, email, password
        });

        res.status(201).json({
            success: true,
        })
    } catch (error:any) {
         return next(new ErrorHandler(error.message, 400))       
    }
});

//login user
interface ILoginRequest{
    email: string;
    password: string;
}

export const loginUser = catchAsyncError(async(req:Request, res:Response, next:NextFunction) => {
    try {
        const {email, password} = req.body as ILoginRequest;
        
        if(!email || !password) {
            return next(new ErrorHandler("Please enter your email and password", 400));
        };

        const user = await userModel.findOne({email}).select("+password");

        if(!user)  return next(new ErrorHandler("Invalid email or password", 400));

        const isPasswordMatched = await user.comparePassword(password);

        if(!isPasswordMatched) return next(new ErrorHandler("Invalid email or password", 400));

        sendToken(user, 200, res);

    } catch (error:any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

//logout user
export const logoutUser = catchAsyncError(async(req:Request, res:Response, next:NextFunction) => {
    try {
        res.cookie("accessToken", "", {maxAge: 1});
        res.cookie("refreshToken", "", {maxAge: 1});

        const userId = req.user?._id?.toString() || '';
        redis.del(userId);
        res.status(200).json({
            success: true,
            message: "User logged out successfully!",
        })
    } catch (error:any) {
         return next(new ErrorHandler(error.message, 400));
    }
});

//update access token
export const updateAccessToken = catchAsyncError(async(req:Request, res:Response, next:NextFunction) => {
    try {
        const refresh_token = req.cookies.refreshToken as string;
        const decoded = await jwt.verify(refresh_token, process.env.REFRESH_TOKEN as string) as JwtPayload;
        
        const message = 'Could not refresh token';

        //when refresh token is not valid or expired. refresh token will expire in 3 days.
        if(!decoded) return next(new ErrorHandler(message, 400));

        const session = await redis.get(decoded.id as string);
        if(!session) return next(new ErrorHandler(message, 400));

        const user = JSON.parse(session);

        const accessToken = jwt.sign({id: user._id}, process.env.ACCESS_TOKEN as string, {
            expiresIn: '5m'
        })

        const refreshToken = jwt.sign({id: user._id}, process.env.REFRESH_TOKEN as string, {
            expiresIn: '5d'
        })

        req.user = user;

        res.cookie("accessToken",accessToken, accessTokenOptions );
        res.cookie("refreshToken",refreshToken, refreshTokenOptions );

        res.status(200).json({
            success: true,
            accessToken,
        })

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

//get user info to load user
export const getUserInfo = catchAsyncError(async(req:Request, res:Response, next:NextFunction) => {
    try {
        const userId = req.user?._id;
        getUserById(String(userId), res);
        
    } catch (error: any) {
          return next(new ErrorHandler(error.message, 400));
    }
});

// social auth 
interface ISocialAuthBody {
    email: string;
    name: string;
    avatar: string;
}

export const socialAuth = catchAsyncError(async(req:Request, res:Response, next:NextFunction) => {
    try {
        const {email, name, avatar} = req.body as ISocialAuthBody;
        const user = await userModel.findOne({email});

        if(!user) {
            const newUser = await userModel.create({email, name, avatar: {url: avatar}});
            sendToken(newUser, 200, res);
        }else{
            sendToken(user, 200, res);
        }
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

//update user info
interface IUpdateUserInfo {
    email?: string;
    name?: string;
}

export const updateUserInfo = catchAsyncError(async(req:Request, res:Response, next:NextFunction) => {
    try {
        const {email, name} = req.body as IUpdateUserInfo;
        const userId  = req.user?._id;
        const user = await userModel.findById(userId);

        //when user updates the email, then check if the new email already exists in the database. If yes, throw an error. If no, update the email.
        if(email && user) {
            const isEmailExist = await userModel.findOne({email});
            if(isEmailExist) return next(new ErrorHandler("Email already exists!", 400));
            user.email = email;
        }

        if(name && user ){
            user.name = name;
        }

        await user?.save();

        //stringify: object to string - bcz redis can only store strings.
        await redis.set(String(userId), JSON.stringify(user));

        res.status(201).json({
            success: true,
            user,
        })
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

//update user passowrd
interface IUpdatePassword {
    oldPassword: string;
    newPassword: string;
}

export const updatePassword = catchAsyncError(async(req:Request, res:Response, next:NextFunction) => {
    try {
        const {oldPassword, newPassword} = (req.body ?? {}) as Partial<IUpdatePassword>;

        if(!oldPassword || !newPassword) return next(new ErrorHandler("Please enter old and new password", 400));
        
        const user  = await userModel.findById(req.user?._id).select("+password");

        if(!user) return next(new ErrorHandler("User not found!", 404));
        if(!user.password) return next(new ErrorHandler("This account has no password. It was created with social login.", 400));

        const isPasswordMatch = await user?.comparePassword(oldPassword);

        if(!isPasswordMatch) return next(new ErrorHandler("Invalid old password!", 400));

        user.password = newPassword;

        await user.save();

        redis.set(String(user._id), JSON.stringify(user));

        res.status(201).json({
            success: true,
            user,
        })
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

//update profile picture
interface IUpdateProfilePicture{
    avatar: string
}

export const updateProfilePicture = catchAsyncError(async(req:Request, res:Response, next:NextFunction) => {
    try {
        const {avatar} = req.body;
        const userId =req.user?._id;
        const user = await userModel.findById(userId);

        if(avatar && user){
            //if public id exists, it means user have previous profile picture. and if not, then user is updating profile for the 1st time
        if(user?.avatar?.public_id){
            await cloudinary.v2.uploader.destroy(user?.avatar?.public_id);
            const myCloud =  await cloudinary.v2.uploader.upload(avatar, {
                folder: "avatars",
                width: 150,
            });
            user.avatar = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
            }
        }else{
            const myCloud =  await cloudinary.v2.uploader.upload(avatar, {
                folder: "avatars",
                width: 150,
            });
            user.avatar = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
            }
        }
        }
        await user?.save();
        await redis.set(String(userId), JSON.stringify(user));
        res.status(200).json({
            success: true,
            user,
        })
    } catch (error: any) {
         console.error("Cloudinary error:", {
        message: error.message,
        http_code: error.http_code,
        name: error.name,
        error: error.error,
    });
    return next(new ErrorHandler(error.message, error.http_code || 400));

        // return next(new ErrorHandler(error.message, 400));
    }
});