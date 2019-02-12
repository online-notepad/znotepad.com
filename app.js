require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const slugify = require('slugify');
const shortid = require('shortid-36');
const Promise = require('bluebird');
const moment = require('moment');

const ViewEngine = require('./config/ViewEngine');

require('./config/database');
const NoteModel = require('./models/notes');

const app = express();
app.use(express.static("public"));

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

const env = new ViewEngine(app, "views");

env.addFilter('moment', (time, patternFormat) => {
    if (time) {
        if (patternFormat) {
            return moment(time).format(patternFormat);
        }
        return moment(time).fromNow();
    }
    return '';
});

app.route('/')
    .get((req, res) => {
        NoteModel.find()
            .sort({created_at: -1})
            .limit(6)
            .select('title slug_title created_at visitor_count')
            .exec((err, notes) => {
                res.render('index.twig', {
                    newestNotes: notes || []
                });
            })
    })
    .post((req, res) => {
        const title = req.body.title;
        const content = req.body.content;
        const slugTitle = slugify(title) + '-' + shortid.generate().toString().toLowerCase();
        const date = new Date();

        const newNote = new NoteModel({
            title: title,
            slug_title: slugTitle,
            content: content,
            visitor_count: 0,
            day: date.getDate(),
            month: date.getMonth() + 1,
            year: date.getFullYear()
        });

        newNote.save((err, note) => {
            if (err) {
                return res.render('error.twig');
            }
            return res.redirect(302, `/notes/${note.slug_title}`);
        });
    });

app.get('/notes/:slug_title', (req, res) => {
    Promise.all([
        NoteModel.findOneAndUpdate({ slug_title: req.params.slug_title }, {
            $inc: {
                visitor_count: 1
            }
        }),
        NoteModel.find()
            .sort({created_at: -1})
            .limit(6)
            .select('title slug_title created_at visitor_count')
    ]).then(response => {
        const note = response[0];
        const newestNotes = response[1];

        if (note) {
            return res.render('index.twig', {
                note: note,
                newestNotes: newestNotes
            });
        }
        return res.render('404.twig');

    }).catch(error => {
        return res.render('error.twig');
    });
});

app.listen(3002, () => console.log("Application listen on port: 3002"));