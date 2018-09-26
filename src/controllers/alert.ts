"use strict";

import { Request, Response, NextFunction } from "express";

import { default as Alert } from "../models/Alert";

export let postAlert = (req: Request, res: Response, next: NextFunction) => {
  req.assert("email", "Email is not valid").isEmail();
  req.sanitize("email").normalizeEmail({ gmail_remove_dots: false });

  const errors = req.validationErrors();

  if (errors) {
    req.flash("errors", errors);
    return res.redirect("/");
  }

  let alert = new Alert({
    email: req.body.email,
    onDeposit: req.body.onDeposit,
    onActive: req.body.onVotingPeriod,
    onFinal: req.body.onFinal
  });

  Alert.findOne({ email: req.body.email }, (err, existing) => {
    if (err) { return next(err); }
    if (existing) {
      existing.onDeposit = alert.onDeposit;
      existing.onActive = alert.onActive;
      existing.onFinal = alert.onFinal;
      alert = existing;
    }
    alert.save((err) => {
      if (err) { return next(err); }
      res.json({ status: "success" });
    });
  });
};

export let removeAlert = (req: Request, res: Response, next: NextFunction) => {
  const alertId = req.query.id;
  console.log("Looking for alert with id: ", alertId);
  Alert.findById(alertId).remove((err) => {
    if (err) { return next(err); }
    res.send("You have successfully unsubscribed from any future alerts");
  });
};