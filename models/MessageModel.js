const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  from: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    required: true,
  },
  text: [
    {
      text: {
        type: String,
        required: true,
      },
      timestamp: {
        type: Date,
        required: true,
      },
    },
  ],
});

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;
