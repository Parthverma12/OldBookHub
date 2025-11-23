const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  image: {url : String,filename: String},
  location: { type: String },
  isDonated: { type: Boolean, default: false }

});

module.exports = mongoose.model('Book', bookSchema);
