"use strict";

import { Request, Response } from "express";
import { default as Proposal } from "../models/Proposal";
import { default as Block } from "../models/Block";
import { default as moment } from "moment";
const PROPOSAL_ACTIVE_BLOCK = 200;

const loadData = async () => {
  const proposals = await Proposal.find({})
    .sort("-proposal_id")
    .limit(600)
    .exec();
  const blocks = await Block.find({})
    .sort("-block_height")
    .limit(10)
    .exec();

  moment.updateLocale("en", {
    relativeTime: {
      future: "in %s",
      past: "%s ago",
      s: "a few seconds",
      ss: "%d seconds",
      m: "a minute",
      mm: "%d minutes",
      h: "an hour",
      hh: "%d hours",
      d: "a day",
      dd: "%d days",
      M: "a month",
      MM: "%d months",
      y: "a year",
      yy: "%d years"
    }
  });
  moment.relativeTimeThreshold("ss", 2);
  for (const block of blocks) {
    const rawTime: Date = block.block_time;
    block.block_time_relative = moment(rawTime).fromNow();
    block.block_time_utc = moment.utc(rawTime).format("hh:mm:ss a");
  }
  for (const proposal of proposals) {
    if (!proposal.voting_start_block) continue;
    const timeLeft =
      blocks[0].time_from_prev *
      (proposal.voting_start_block +
        PROPOSAL_ACTIVE_BLOCK -
        blocks[0].block_height);
    if (timeLeft <= 0) continue;
    // proposal.time_left_to_vote = moment("2015-01-01").startOf("day").milliseconds(timeLeft).format("H:mm:ss");
  }
  const proposalStatuses = (Proposal.schema as any).paths.proposal_status.enumValues;

  return [proposals, blocks, proposalStatuses];
};

/**
 * GET /
 * Home page.
 */
export let index = (req: Request, res: Response) => {
  loadData().then(docs => {
    res.render("home", {
      title: "Home",
      gov: docs[0],
      block: docs[1],
      proposalStatuses: docs[2],
      formatProposalStatus: function (str: string) {
        return str.replace(/([A-Z])/g, function ($1: string) {
          return " " + $1;
        });
      }
    });
  });
};
