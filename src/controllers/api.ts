"use strict";

import { Response, Request, NextFunction } from "express";

import { default as Block } from "../models/Block";
import { default as Proposal } from "../models/Proposal";

export let getBlock = (req: Request, res: Response) => {

  Block.find({}).sort("-block_height").limit(6).exec(function (err, docs) {
    if (err) {
      console.log("Error", err);
      res.status(500).send(err);
    }
    console.log("here are what I found", docs);
    res.json(docs);
  });
};

export let getGovernance = (req: Request, res: Response) => {
  Proposal.find({}).sort("-proposal_id").limit(6).exec(function (err, docs) {
    if (err) {
      console.log("Error", err);
      res.status(500).send(err);
    }
    console.log("here are what I found", docs);
    res.json(docs);
  });
};
