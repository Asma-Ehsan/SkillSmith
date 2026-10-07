import mongoose, {Document, Model, Schema} from "mongoose";
import bcrypt from "bcryptjs";

//this regex pattern is used to validate email addresses. It checks for a valid email format.
const emailRegexPattern: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
};

const userSchema: Schema<IUser> = new mongoose.Schema({
    name: { type: String, required: [true, "Please enter your name"] },
    email: {
        type: String, 
        required: [true, "Please enter your email"], 
        unique: true,
        validate:{
            validator: function(value: string){
                return emailRegexPattern.test(value);
            }, 
            message: "Please enter a valid email!",
        },
    },
    password: {
        type: String, 
        required: [true, "Please enter your password"], 
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
userSchema.pre<IUser>('save', async function () {
    if(!this.isModified('password')) return; // If password is not modified, skip hashing
    this.password = await bcrypt.hash(this.password, 10);
});

//compare Password
userSchema.methods.comparePassword = async function(enteredPassword: string) : Promise<boolean>{
    return await bcrypt.compare(enteredPassword, this.password); //this.password = hashed password stored in the DB
}

const userModel: Model<IUser> = mongoose.model("User", userSchema);

export default userModel;