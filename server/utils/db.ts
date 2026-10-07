import mongoose from "mongoose";
require("dotenv").config();

//connect database
const dbUrl:string = process.env.DB_URI || '';
const connectDB= async() => {
    try {
        await mongoose.connect(dbUrl).then((data:any) => {
            console.log(`MongoDB connected with server: ${data.connection.host}`);
        })
    } catch (error:any) {
        console.log(`DB Error: ${error.message}`);
        setTimeout(connectDB, 5000); //retry connection after 5 seconds
    }
}

export default connectDB;