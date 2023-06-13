"use strict";

const config = require("dotenv");
require("./db");
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios").default;
const Message = require("./models/MessageModel");
const app = express().use(bodyParser.json());
const cors = require("cors");

app.use(cors());
app.listen(process.env.PORT || 1337, () => {
  console.log("Webhook is listening");
});
// Add a new endpoint to get user data by 'from' variable
app.get("/messages/:from", async (req, res) => {
  try {
    const from = req.params.from;
    const userMessages = await Message.find({ from });

    res.status(200).json(userMessages);
  } catch (error) {
    console.error("An error occurred:", error);
    res.sendStatus(500);
  }
});

app.post("/send-message", async (req, res) => {
  try {
    const { to, text } = req.body;
    const existingMessage = await Message.findOne({ from: to });

    if (existingMessage) {
      existingMessage.text.push({
        text: text.body,
        timestamp: new Date(),
        role: 1,
      });
      existingMessage.timestamp = new Date();
      await existingMessage.save();
    } else {
      const newMessage = new Message({
        from: to,
        timestamp: new Date(),
        text: [{ text: text.body, timestamp: new Date(), role: 1 }],
      });
      await newMessage.save();
    }
    await axios.post(
      `https://graph.facebook.com/v12.0/${process.env.PHONE_NUMBER_ID}/messages?access_token=${process.env.TEMPORARY_ACCESS_TOKEN}`,
      {
        messaging_product: "whatsapp",
        to: to,
        text: { body: text.body },
      }
    );

    console.log("Message saved and acknowledgment sent");
    res.sendStatus(200);
  } catch (error) {
    console.error("An error occurred:", error);
    res.sendStatus(500);
  }
});

//Get all Numbers
app.get("/numbers", async (req, res) => {
  try {
    const numbers = await Message.distinct("from");
    res.json(numbers);
  } catch (error) {
    console.error("An error occurred:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

//Search Number/Message
app.get("/search/:key", async (req, res) => {
  const key = req.params.key;

  try {
    const result = await Message.find({
      $or: [
        { from: { $regex: new RegExp(key, "i") } },
        { "text.text": { $regex: new RegExp(key, "i") } },
      ],
    });

    res.send(result);
  } catch (error) {
    console.error("An error occurred:", error);
    res.status(500).send("Internal Server Error");
  }
});
app.post("/webhook", async (req, res) => {
  // Parse the request body from the POST
  let body = req.body;

  // Check the Incoming webhook message
  console.log(JSON.stringify(req.body, null, 2));

  // info on WhatsApp text message payload: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples#text-messages
  if (req.body.object) {
    if (
      req.body.entry &&
      req.body.entry[0].changes &&
      req.body.entry[0].changes[0] &&
      req.body.entry[0].changes[0].value.messages &&
      req.body.entry[0].changes[0].value.messages[0]
    ) {
      let phone_number_id =
        req.body.entry[0].changes[0].value.metadata.phone_number_id;
      let from = req.body.entry[0].changes[0].value.messages[0].from; // extract the phone number from the webhook payload
      let msg_body =
        req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body;
      // extract the message text from the webhook payload

      try {
        // Find an existing message document by 'from' field
        const existingMessage = await Message.findOne({ from });

        if (existingMessage) {
          // If an existing message is found, update the 'text' array
          const ts = new Date();
          existingMessage.text.push({ text: msg_body, timestamp: ts });
          existingMessage.timestamp = new Date();
          await existingMessage.save();
        } else {
          // If no existing message is found, create a new message document
          const newMessage = new Message({
            from: from,
            timestamp: new Date(),
            text: [{ text: msg_body, timestamp: new Date() }],
          });
          await newMessage.save();
        }

        // Send acknowledgment message back to the sender
        await axios.post(
          `https://graph.facebook.com/v12.0/${phone_number_id}/messages?access_token=${process.env.TEMPORARY_ACCESS_TOKEN}`,
          {
            messaging_product: "whatsapp",
            to: from,
            text: { body: "Ack: " + msg_body },
          }
        );

        console.log("Message saved and acknowledgment sent");
        res.sendStatus(200);
      } catch (error) {
        console.error("An error occurred:", error);
        res.sendStatus(500);
      }
    }
  } else {
    // Return a '404 Not Found' if event is not from a WhatsApp API
    res.sendStatus(404);
  }
});

// Accepts GET requests at the /webhook endpoint. You need this URL to setup webhook initially.
// info on verification request payload: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
app.get("/webhook", (req, res) => {
  /**
   * UPDATE YOUR VERIFY TOKEN
   *This will be the Verify Token value when you set up webhook
   **/
  const verify_token = process.env.VERIFY_TOKEN;

  // Parse params from the webhook verification request
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  // Check if a token and mode were sent
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === "subscribe" && token === verify_token) {
      // Respond with 200 OK and challenge token from the request
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});
