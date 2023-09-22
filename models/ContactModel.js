const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema({
  from: {
    type: String,
    required: true,
    unique: true, // Ensure each contact is unique based on the 'from' value
  },
  name: {
    type: String,
  },
  // Add other contact-related fields as needed
});

const Contact = mongoose.model("Contact", contactSchema);

module.exports = Contact;
