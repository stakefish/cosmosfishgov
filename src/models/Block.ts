"use strict";

import mongoose from "mongoose";

export type BlockModel = mongoose.Document & {
  block_hash: string,
  app_hash: string,
  block_height: number,
  block_time: Date,

  time_from_prev: number, // Time from previous block in ms
  num_txs: number,

  block_time_relative: string,
  block_time_utc: string
};

const blockSchema = new mongoose.Schema({
  block_hash: String,
  app_hash: String,
  block_height: { type: Number, unique: true },
  block_time: Date,

  time_from_prev: Number, // Time from previous block in ms
  num_txs: Number

}, { timestamps: true });

const Block = mongoose.model<BlockModel>("Block", blockSchema);
export default Block;
