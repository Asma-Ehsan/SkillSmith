import { Response } from "express";
import { redis } from "../utils/redis";


//get user by id 
export const getUserById = async ( id: string, res: Response ) => {
    const userJson = await redis.get(id);
    if(userJson) {
        //parse: string to object - bcz in redis user is stored as string but we need object
        const user = JSON.parse(userJson);
        res.status(200).json({
        success: true,
        user,
    })
    }else{
        return res.status(404).json({ success: false, message: "User not found" });
    }
}