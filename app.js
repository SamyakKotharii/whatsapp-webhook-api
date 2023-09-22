"use strict";

const config = require("dotenv");
require("./db");
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios").default;
const Message = require("./models/MessageModel");
const Contact = require("./models/ContactModel");
const app = express().use(bodyParser.json());
const cors = require("cors");

app.use(cors());
app.listen(process.env.PORT || 1337, () => {
  console.log("Webhook is listening");
});

// To get user message by mobile number
// app.get("/messages/:from", async (req, res) => {
//   try {
//     const from = req.params.from;
//     const userMessages = await Message.find({ from });

//     res.status(200).json(userMessages);
//   } catch (error) {
//     console.error("An error occurred:", error);
//     res.sendStatus(500);
//   }
// });
app.get("/messages/:from", async (req, res) => {
  try {
    const from = req.params.from;

    // Find the corresponding contact based on the 'from' number
    const contact = await Contact.findOne({ from });

    if (!contact) {
      // Handle the case where the contact is not found
      return res.status(404).json({ error: "Contact not found" });
    }

    // Find user messages using the 'from' number
    const userMessages = await Message.find({ from });

    // Send the user messages along with the contact's name in the response
    res.status(200).json({
      contactName: contact.name,
      messages: userMessages,
    });
  } catch (error) {
    console.error("An error occurred:", error);
    res.sendStatus(500);
  }
});

// app.post("/send-message", async (req, res) => {
//   try {
//     const { to, text } = req.body;
//     const existingMessage = await Message.findOne({ from: to });

//     if (existingMessage) {
//       existingMessage.text.push({
//         text: text.body,
//         timestamp: new Date(),
//         role: 1,
//       });
//       existingMessage.timestamp = new Date();
//       await existingMessage.save();
//     } else {
//       const newMessage = new Message({
//         from: to,
//         timestamp: new Date(),
//         text: [{ text: text.body, timestamp: new Date(), role: 1 }],
//       });
//       await newMessage.save();
//     }
//     console.log("to is", to);
//     console.log("message is", text.body);

//     await axios.post(
//       `https://graph.facebook.com/v12.0/${process.env.PHONE_NUMBER_ID}/messages?access_token=${process.env.TEMPORARY_ACCESS_TOKEN}`,
//       {
//         messaging_product: "whatsapp",
//         recipient_type: "individual",
//         to: to,
//         type: "text",
//         text: {
//           preview_url: false,
//           body: text.body,
//         },
//       }
//     );

//     console.log("Message saved and acknowledgment sent");
//     res.sendStatus(200);
//   } catch (error) {
//     console.error("An error occurred:", error);
//     res.sendStatus(500);
//   }
// });
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

    console.log("to is", to);
    console.log("message is", text.body);

    const requestBody = {
      wabaNumber: "917874990975",
      recipient: to,
      source: "",
      clientRefId: "",
      type: "text",
      text: {
        preview_url: false,
        body: text.body,
      },
    };

    const headers = {
      "Dotpe-Api-Key": process.env.DOTPE_API_KEY,
    };

    await axios.post(
      "https://api.dotpe.in/api/comm/public/enterprise/v1/wa/send/free-form",
      requestBody,
      { headers }
    );

    console.log("Message saved");
    res.sendStatus(200);
  } catch (error) {
    console.error("Error while sending:", error);
    res.sendStatus(500);
  }
});

//Get all mobile Numbers
// app.get("/numbers", async (req, res) => {
//   try {
//     const numbers = await Message.distinct("from");
//     res.json(numbers);
//   } catch (error) {
//     console.error("An error occurred:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });
app.get("/numbers", async (req, res) => {
  try {
    const sortedNumbers = await Message.aggregate([
      { $sort: { timestamp: -1 } }, // Sort documents by timestamp in descending order
      { $group: { _id: "$from", timestamp: { $first: "$timestamp" } } }, // Group by 'from' field and get the first timestamp
      { $sort: { timestamp: -1 } }, // Sort again by timestamp in descending order
    ]);

    const numbers = sortedNumbers.map((item) => item._id); // Extract the 'from' field from each item

    res.json(numbers);
  } catch (error) {
    console.error("An error occurred:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

//Search by message or phone number
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

// app.post("/webhook", async (req, res) => {
//   // Parse the request body from the POST
//   let body = req.body;

//   // Check the Incoming webhook message
//   console.log(JSON.stringify(req.body, null, 2));

//   // info on WhatsApp text message payload: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples#text-messages
//   if (req.body.message) {
//     const phone_number_id = req.body.metadata?.wabaId;
//     const from = req.body.message.from;
//     const msg_body = req.body.message.body;
//     const name = req.body.message.profileName;
//     console.log("Profile name is", name);
//     try {
//       // Find an existing message document by 'from' field
//       const existingMessage = await Message.findOne({ from });

//       if (existingMessage) {
//         // If an existing message is found, update the 'text' array
//         const ts = new Date();
//         existingMessage.text.push({ text: msg_body, timestamp: ts });
//         existingMessage.timestamp = new Date();
//         await existingMessage.save();
//       } else {
//         // If no existing message is found, create a new message document
//         const newMessage = new Message({
//           from: from,
//           profile: name,
//           timestamp: new Date(),
//           text: [{ text: msg_body, timestamp: new Date() }],
//         });
//         await newMessage.save();
//       }

//       res.sendStatus(200);
//     } catch (error) {
//       console.error("An error occurred:", error);
//       res.sendStatus(500);
//     }
//   } else {
//     // Return a '404 Not Found' if event is not from a WhatsApp API
//     res.sendStatus(404);
//   }
// });

//+ before
app.post("/webhook", async (req, res) => {
  // Parse the request body from the POST
  let body = req.body;

  // Check the Incoming webhook message
  console.log(JSON.stringify(req.body, null, 2));

  // info on WhatsApp text message payload: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples#text-messages
  if (req.body.message) {
    const phone_number_id = req.body.metadata?.wabaId;
    const from = req.body.message.from;
    const msg_body = req.body.message.body;
    const name = req.body.message.profileName;
    console.log("Profile name is", name);

    // Add the plus sign (+) before the 'from' value
    const formattedFrom = `+${from}`;

    try {
      // Find an existing message document by 'from' field
      const existingMessage = await Message.findOne({ from: formattedFrom });

      if (existingMessage) {
        // If an existing message is found, update the 'text' array
        const ts = new Date();
        existingMessage.text.push({ text: msg_body, timestamp: ts });
        existingMessage.timestamp = new Date();
        await existingMessage.save();
      } else {
        // If no existing message is found, create a new message document
        const newMessage = new Message({
          from: formattedFrom,
          profile: name,
          timestamp: new Date(),
          text: [{ text: msg_body, timestamp: new Date() }],
        });
        await newMessage.save();
      }

      res.sendStatus(200);
    } catch (error) {
      console.error("An error occurred:", error);
      res.sendStatus(500);
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
