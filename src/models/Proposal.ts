"use strict";

import mongoose from "mongoose";

export type ProposalModel = mongoose.Document & {
  proposal_id: number,
  title: string,
  description: string,
  proposal_type: string,
  proposal_status: string,
  tally_result: {
    yes: number,
    abstain: number,
    no: number,
    no_with_veto: number
  },
  submit_block: number,
  total_deposit: number,
  voting_start_block: number,

  alert: {
    deposit: boolean,
    active: boolean,
    final: boolean
  },

  time_left_to_vote: string
};


const proposalSchema = new mongoose.Schema({
  proposal_id: { type: Number, unique: true },
  title: String,
  description: String,
  proposal_type: String,
  proposal_status: {
    type: String,
    enum: ["VotingPeriod", "Passed", "Rejected", "DepositPeriod", "DepositFailed"]
  },
  tally_result: {
    yes: Number,
    abstain: Number,
    no: Number,
    no_with_veto: Number
  },
  submit_block: Number,
  total_deposit: Number,
  voting_start_block: Number,

  alert: {
    deposit: Boolean,
    active: Boolean,
    final: Boolean
  }
}, { timestamps: true });

proposalSchema.virtual("total_votes")
  .get(function () {
    return this.tally_result.yes + this.tally_result.abstain + this.tally_result.no + this.tally_result.no_with_veto;
  });

const Proposal = mongoose.model<ProposalModel>("Proposal", proposalSchema);
export default Proposal;