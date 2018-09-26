"use strict";

import mongoose from "mongoose";

export type AlertModel = mongoose.Document & {
  email: string,
  onDeposit: boolean,
  onActive: boolean,
  onFinal: boolean
};

const alertSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  onDeposit: Boolean,
  onActive: Boolean,
  onFinal: Boolean
}, { timestamps: true });

const Alert = mongoose.model<AlertModel>("Alert", alertSchema);
export default Alert;
