"use strict";

import nodemailer from "nodemailer";

import { default as Block } from "./models/Block";
import { default as Proposal, ProposalModel } from "./models/Proposal";
import { default as Alert, AlertModel } from "./models/Alert";

import fetch from "node-fetch";
import session from "express-session";
import dotenv from "dotenv";
import mongo from "connect-mongo";
import mongoose from "mongoose";
import bluebird from "bluebird";
import { MONGODB_URI, SESSION_SECRET } from "./util/secrets";

import _ from "lodash";

const MongoStore = mongo(session);

// Load environment variables from .env file, where API keys and passwords are configured
dotenv.config({ path: ".env.example" });

// Connect to MongoDB
const mongoUrl = MONGODB_URI;
(<any>mongoose).Promise = bluebird;
mongoose.connect(mongoUrl, { useMongoClient: true }).then(
  () => { /** ready to use. The `mongoose.connect()` promise resolves to undefined. */ },
).catch(err => {
  console.log("MongoDB connection error. Please make sure MongoDB is running. " + err);
  // process.exit();
});


const DEBUG = (function () {
  const timestamp = function () { };
  timestamp.toString = function () {
    return "[DEBUG " + (new Date).toLocaleTimeString() + "]";
  };

  return {
    log: console.log.bind(console, "%s", timestamp)
  };
})();

const URL = process.env.GAIA_FULL_NODE_IP;

// The --latest=10 got added here because the follow command will output `No matching proposals found`
//  if the last proposals did not get past the deposit period
const COMMAND = "gaiacli gov query-proposals --latest=30 --node=tcp://" + URL + " | tail -n 1 | cut -d'-' -f1";
const COMMAND_PROP = "gaiacli gov query-proposal --node tcp://" + URL + " --proposal-id=";

const goRatToNumber = (rat: string) => {
  const [first, second] = rat.split("/");
  if (!second || parseInt(second) == 0) return first;
  return parseInt(first) / parseInt(second);
};

// import * as child_process from 'child_process';
// const exec = require("child_process").exec;
const { promisify } = require("util");
const exec = promisify(require("child_process").exec);


export default class CosmosFetcher {
  latestPropNum: number = 0;

  async populateProposals() {
    // Find the first active proposal and start fetching from there
    this.latestPropNum = await this.findFirstActiveProposal();

    const totalProp = await this.fetchTotalProposalNum();
    DEBUG.log("Need to populate from " + this.latestPropNum + " to " + totalProp);

    for (let i = this.latestPropNum; i <= totalProp; i++) {
      await this.fetchProposal(i);
    }

    DEBUG.log("*** Successfully populated all proposals to the DB ***");
    this.latestPropNum = await this.findFirstActiveProposal();
    DEBUG.log("The latest active proposal is: ", this.latestPropNum);
  }

  async findFirstActiveProposal() {
    let last = await Proposal.findOne({
      proposal_status: {
        $nin: ["Passed", "Rejected"]
      }
    }).sort("+proposal_id");

    if (last) {
      return last.proposal_id;
    }

    // No active proposal found, return latest final one plus one
    last = await Proposal.findOne().sort("-proposal_id");
    if (!last) {
      return 0;
    } else {
      return last.proposal_id + 1;
    }

  }

  async fetchTotalProposalNum() {
    const { stdout, stderr } = await exec(COMMAND);
    if (stderr) {
      DEBUG.log("ERROR stderr: ", stderr);
    }
    // DEBUG.log("stdout: ", stdout);
    let totalProposal = parseInt(stdout);
    // DEBUG.log("Total number of proposal is", totalProposal);

    const data = await Proposal.aggregate([
      {
        $group: {
          _id: "null",
          maxId: {
            $max: "$proposal_id"
          }
        }
      }
    ]);

    if (data[0]) {
      totalProposal = Math.max(totalProposal, data[0].maxId);
    }
    // DEBUG.log("Updated total number of proposal is", totalProposal);
    return totalProposal;
  }

  async fetchNewProposals() {
    const totalProp = await this.fetchTotalProposalNum();
    if (totalProp < this.latestPropNum) {
      DEBUG.log("No new proposals found");
      return;
    }
    // DEBUG.log("Potentially found a new or active proposal!");

    for (let i = this.latestPropNum; i <= totalProp; i++) {
      if (await this.isProposalFinal(i))
        continue;
      DEBUG.log("New proposal? fetching for ", i);
      const newProposal = await this.fetchProposal(i);
      if (!newProposal) {
        // DEBUG.log(`Proposal ${i} came up as`, newProposal);
        await this.finalizeProposalDepositFailed(i);
        continue;
      }
      if (newProposal.proposal_status != "Passed" && newProposal.proposal_status != "Rejected") {
        if (newProposal.proposal_status == "DepositPeriod") {
          await this.alertProposalDeposit(newProposal);
        } else {
          await this.alertProposalActive(newProposal);
        }
      } else {
        DEBUG.log("New proposal has reached a conclusion! Time to alert people!!", newProposal);
      }
    }

    this.latestPropNum = await this.findFirstActiveProposal();
  }

  async alertProposalDeposit(proposal: ProposalModel) {
    if (!proposal.alert.deposit) {
      const pre = `Proposal [${proposal.proposal_id}]: `;
      // Send out alert to everyone who subscribed to this event
      DEBUG.log(pre + "New proposal in DepositPeriod! Time to alert people!!!", proposal);
      const alerts = await Alert.find({ onDeposit: true });
      for (const alert of alerts) {
        DEBUG.log(pre + "Alerting .... ", alert.email);
        const subject = `[Cosmos] New proposal ${proposal.proposal_id} appeared!`;
        const unsubLink = process.env.DEPLOYED_URL + "/alert/remove/?id=" + alert._id;
        const body = `Hello,
This is a friendly notification that there is a new proposal entering the Deposit period.\n
Proposal ID: ${proposal.proposal_id}
Proposal Type: ${proposal.proposal_type}
Submitted Block: ${proposal.submit_block}
Deposit Amount: ${proposal.total_deposit}\n
Proposal Name: ${proposal.title}
Proposal Description: ${proposal.description}\n\n
To unsubscribe to all future alerts please follow this link ${unsubLink}\n
Sent by cosmos.fish - a bit.fish project`;
        await this.sendAlertEmail(alert, subject, body);
      }

      DEBUG.log(pre + "Alerting process has been completed for proposal");
      proposal.alert.deposit = true;
      await proposal.save();
    }
  }

  async alertProposalActive(proposal: ProposalModel) {
    if (!proposal.alert.active) {
      const pre = `Proposal [${proposal.proposal_id}]: `;
      DEBUG.log(pre + "New proposal in Active! Time to alert people!!!", proposal);
      const alerts = await Alert.find({ onActive: true });
      for (const alert of alerts) {
        DEBUG.log(pre + "Alerting .... ", alert.email);
        const subject = `[Cosmos] Proposal ${proposal.proposal_id} ready for votes!`;
        const unsubLink = process.env.DEPLOYED_URL + "/alert/remove/?id=" + alert._id;
        const body = `Hello,\n
This is a friendly notification that there is a new proposal entering the Active Voting period.\n
Proposal ID: ${proposal.proposal_id}
Proposal Type: ${proposal.proposal_type}
Submitted Block: ${proposal.submit_block}
Voting Start Block: ${proposal.voting_start_block}
Deposit Amount: ${proposal.total_deposit}\n
Proposal Name: ${proposal.title}
Proposal Description: ${proposal.description}\n\n
To unsubscribe to all future alerts please follow this link ${unsubLink}\n
Sent by cosmos.fish - a bit.fish project`;
        await this.sendAlertEmail(alert, subject, body);
      }

      DEBUG.log(pre + "Alerting process has been completed for proposal");
      proposal.alert.active = true;
      await proposal.save();
    }
  }

  async sendAlertEmail(alert: AlertModel, subject: string, body: string) {
    if (!process.env.MAIL_SERVICE_SERVICE || !process.env.MAIL_SERVICE_USER || !process.env.MAIL_SERVICE_PASSWORD) {
      DEBUG.log("Cannot alert. Email service .env variables not set - MAIL_SERVICE_SERVICE, MAIL_SERVICE_USER and MAIL_SERVICE_PASSWORD must be set");
    } else {
      const transporter = nodemailer.createTransport({
        service: process.env.MAIL_SERVICE_SERVICE,
        auth: {
          user: process.env.MAIL_SERVICE_USER,
          pass: process.env.MAIL_SERVICE_PASSWORD
        }
      });
      const mailOptions = {
        from: "cosmos@sent.as",
        to: alert.email,
        subject: subject,
        text: body
      };
      await transporter.sendMail(mailOptions);
    }
  }

  async isProposalFinal(id: number) {
    const existing = await Proposal.findOne({ proposal_id: id });
    if (!existing) {
      DEBUG.log(`Cannot find proposal ${id} in the database, cannot check final status`);
      return;
    }
    const status = existing.proposal_status;
    return status == "Passed" || status == "Rejected" || status == "DepositFailed";
  }

  private async finalizeProposalDepositFailed(id: number) {
    const existing = await Proposal.findOne({ proposal_id: id });
    if (!existing) {
      DEBUG.log(`Cannot find proposal ${id} in the database, cannot finalize`);
      return;
    }
    if (existing.proposal_status != "DepositPeriod") {
      DEBUG.log(`Proposal ${id} must be in DepositPeriod in order to finalize as DepositFailed. It's currently in status: ${existing.proposal_status}`);
      return;
    }
    DEBUG.log(`Proposal ${id} failed to meet Deposit hurdle. Marking it as DepositFailed now...`);
    existing.proposal_status = "DepositFailed";
    await existing.save();
  }

  async fetchProposal(propNum: number): Promise<ProposalModel> {
    let govObj;
    try {
      const { stdout, stderr } = await exec(COMMAND_PROP + propNum);
      if (stderr) {
        DEBUG.log("ERROR stderr: ", stderr);
      }
      // DEBUG.log("stdout: ", stdout);

      govObj = JSON.parse(stdout);
    } catch (err) {
      // DEBUG.log("ERROR fetching proposal: ", err);
      return;
    }
    if (govObj.type != "gov/TextProposal") {
      DEBUG.log("Proposal has the wrong type", govObj);
      return;
    }

    const v = govObj.value;
    const id = v.proposal_id;
    let proposal = new Proposal({
      proposal_id: id,
      title: v.title,
      description: v.description,
      proposal_type: v.proposal_type,
      proposal_status: v.proposal_status,
      submit_block: v.submit_block,
      total_deposit: v.total_deposit[0].amount, // simplification, there can be multiple different types of tokens
      voting_start_block: v.voting_start_block,
      tally_result: {
        yes: goRatToNumber(v.tally_result.yes),
        no: goRatToNumber(v.tally_result.no),
        abstain: goRatToNumber(v.tally_result.abstain),
        no_with_veto: goRatToNumber(v.tally_result.no_with_veto)
      }
    });

    // DEBUG.log("Persisting this!!! ", proposal);

    const existing = await Proposal.findOne({ proposal_id: id });
    if (existing) {
      DEBUG.log("Fetched proposal " + id + " which already exists. Updating...");
      existing.proposal_status = proposal.proposal_status;
      existing.total_deposit = proposal.total_deposit;
      existing.voting_start_block = proposal.voting_start_block;
      existing.tally_result = proposal.tally_result;
      proposal = existing;
    }
    await proposal.save();
    DEBUG.log("Fetched proposal " + id + " and successfully saved it to DB!");
    return proposal;
  }

  async fetchCurrentStatus() {
    try {
      const res = await fetch("http://" + URL + "/status");
      const data = (await res.json()).result;
      // console.log("here are the JSON response", data);

      const sync_info = data.sync_info;

      const block_height = sync_info.latest_block_height;
      const block = new Block({
        block_hash: sync_info.latest_block_hash,
        app_hash: sync_info.latest_app_hash,
        block_height: sync_info.latest_block_height,
        block_time: new Date(sync_info.latest_block_time)
      });

      const existingBlock = await Block.findOne({ block_height: block_height });
      if (existingBlock) {
        // DEBUG.log("Fetched block " + block_height + " which already exists.");
        return undefined;
      }

      await this.finalizeBlock(block_height - 1);

      // TODO: temporarily hijack the current block to store the average block time.
      block.time_from_prev = await this.calAvgBlockTime(10);
      await block.save();
      DEBUG.log("Fetched block " + block_height + " and successfully saved it to DB!");

      return data;
    } catch (err) {
      DEBUG.log("Error when fetching block", err);
    }
  }

  async calAvgBlockTime(limit: number) {
    const data = await Block.aggregate([
      {
        $sort: {
          block_height: -1
        }
      }, {
        $limit: limit
      }, {
        $group: {
          _id: "null",
          avgTime: {
            $avg: "$time_from_prev"
          }
        }
      }
    ]);
    if (data[0]) {
      return data[0].avgTime;
    }
    return 0;
  }

  async finalizeBlock(height: number) {
    const block = await Block.findOne({ block_height: height });
    if (!block) return;

    const prevBlock = await Block.findOne({ block_height: height - 1 });
    if (!prevBlock) return;

    block.time_from_prev = block.block_time.getTime() - prevBlock.block_time.getTime();
    // DEBUG.log(`Time in between block is ${block.time_from_prev}`);
    block.save();
  }
}
