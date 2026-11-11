import mongoose, { Document, Model, Schema } from "mongoose";

export interface IOrder extends Document {
  course: object;
  user: object;
  payment_info: object;
}

const orderSchema = new Schema<IOrder>(
  {
    course: { type: Object, required: true, },
    user: { type: Object, required: true, },
    payment_info: { type: Object, required: true, },
  },
  { timestamps: true }
);

const orderModel: Model<IOrder> = mongoose.model("Order", orderSchema);

export default orderModel;