require("dotenv").config();
import mongoose, {Document, Model, Schema} from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

//this regex pattern is used to validate email addresses. It checks for a valid email format.
const emailRegexPattern: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/*
^: the text must start here.
[^\s@]+: one or more characters that are not a space and not @. This is the part before @.
@: there must be one @ sign.
[^\s@]+: the part after @, like gmail.
\.: a real dot. The \ is needed because a plain . means “any character” in regex.
[^\s@]+: the ending, like com.
$: the text must end here.*/

// Document is a Mongoose type. It has things like _id, save(), and isModified().
//interface is used to define the structure(Shape) of the object in TypeScript. It gives us type safety and autocompletion when working with user documents in our codebase.
export interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    avatar: {
        public_id: string;
        url: string;
    },
    role:string;
    isVerified: boolean;
    courses: Array<{courseId: string}>;
    comparePassword: (password: string) => Promise<boolean>;
    SignAccessToken: () => string;
    SignRefreshToken: () => string;
};

//Schema<IUser> means “a schema for users shaped like IUser”
const userSchema: Schema<IUser> = new mongoose.Schema({
    name: { type: String, required: [true, "Please enter your name"] },
    email: {
        type: String, 
        required: [true, "Please enter your email"], 
        unique: true,
        validate:{
            //function that receives the email as value
            validator: function(value: string){
                //.test() is a JS method that every regex pattern has. emailRegexPattern is a regex object. Every regex object comes with a built-in .test() method.
                //it gives true if value matches the regex pattern, fakse otherwise
                return emailRegexPattern.test(value);
            }, 
            message: "Please enter a valid email!",
        },
    },
    password: {
        type: String, 
        minLength: [6, "Password must be at least 6 characters long"],
        select: false, // Exclude password from query results by default
    },
    avatar: {
        public_id: String,
        url: String,
    },
    role: { type: String, default: "user" },
    isVerified: { type: Boolean, default: false} ,

    // When a user purchases a course, its ID is added to their courses array. Later, the backend checks if the ID exists. If yes, allow video access.
    courses: [
        {courseId: String}
    ]
},{timestamps: true});

//Hash Password before saving
userSchema.pre('save', async function () { //<IUser> tells TypeScript that the document being saved is of type user.
    if(!this.isModified('password')) return; // If password is not modified, skip hashing
    this.password = await bcrypt.hash(this.password, 10);
});

//compare Password
userSchema.methods.comparePassword = async function(enteredPassword: string) : Promise<boolean>{
    //bcrypt hashes the entered password the same way and checks if both match.
    return await bcrypt.compare(enteredPassword, this.password); //this.password = hashed password stored in the DB
};

//Sign Access Token
userSchema.methods.SignAccessToken = function(){
    return jwt.sign({id: this._id}, process.env.ACCESS_TOKEN || '', {
         expiresIn: '5m',
    })
};

//sign refresh token
userSchema.methods.SignRefreshToken = function(){
    return jwt.sign({id: this._id}, process.env.REFRESH_TOKEN || '', {
        expiresIn: '3d',
    })
};

//userModel: Model<IUser>: a label saying “a model whose documents look like IUser”.
const userModel: Model<IUser> = mongoose.model("User", userSchema);

export default userModel;