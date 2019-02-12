const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Note = new Schema({
    title: String,
    slug_title: String,
    content: String,

    visitor_count: Number,

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