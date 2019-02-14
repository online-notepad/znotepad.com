const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Note = new Schema({
    title: String,
    slug_title: String,
    content: String,
    content_plaintext: String,

    visitor_count: Number,

    is_private: Boolean,

    day: Number,
    month: Number,
    year: Number
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});

module.exports = mongoose.model("notes", Note);