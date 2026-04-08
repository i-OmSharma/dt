import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDb = async () => {

    const url = process.env.MONGO_URI;

    if(!url) {
        throw new Error("MONGO_URI is not defined");
    }

    try {

        await mongoose.connect(url, {
            dbName: "secOTP"
        });
        console.log("DB Connected");

    } catch (error) {
        console.error("Failed to connect to DB", error);
        process.exit(1);
    }
}

export default connectDb;