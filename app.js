require('dotenv').config();

const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const flash = require('connect-flash');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const xssFilter = require('x-xss-protection');
const bodyParser = require('body-parser');
const slugify = require('slugify');
const shortid = require('shortid-36');
const Promise = require('bluebird');
const moment = require('moment');
const pdf = require('html-pdf');
const md5 = require('md5');
const cheerio = require('cheerio');
const entities = require("entities");

const PREFIX_NOTE_PASSWORD = "ng4WGrowth.ZNotepad.com";

const ExceptionHandlers = require('./config/throwError');
const ViewEngine = require('./config/ViewEngine');

const dbInstance = require('./config/database');

const NoteModel = require('./models/notes');

const app = express();
app.use(express.static('public', {maxAge: 3600}));

app.use(cookieParser('znotepad'));
app.use(session({
    secret: 'znotepad',
    store: new MongoStore({mongooseConnection: dbInstance}),
    resave: false,
    saveUninitialized: true,
    cookie: { expires: new Date(Date.now() + 3600000*24*15), maxAge: 3600000*24*15 }
}));
app.use(flash());
app.use(function (req, res, next) {
    res.locals.messages = req.session.flash;
    delete req.session.flash;
    next();
});

app.use(helmet());
app.disable('x-powered-by');
app.use(xssFilter({ setOnOldIE: true }));

app.use(bodyParser.json({limit: '10mb', extended: true})); // support json encoded bodies
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true })); // support encoded bodies

/**
 * CSRF Protecttion
 *
 * Issue: Need to be after bodyParser
 * Detail: https://github.com/expressjs/csurf/issues/52
 *
 */
app.use(csrf());
app.use((req, res, next) => {
    res.locals._csrf = req.csrfToken();
    next();
});

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

app.get('/', (req, res) => {
    NoteModel.find({ is_private: { $ne: true } })
        .sort({created_at: -1})
        .limit(8)
        .select('title slug_title created_at visitor_count')
        .exec((err, notes) => {
            res.render('index.twig', {
                newestNotes: notes || []
            });
        })
});

app.get('/features', (req, res) => {
    res.render('pages/features.twig')
});

// app.get('/video', (req, res) => {
//     res.render('pages/video.twig')
// });
//
// app.get('/about', (req, res) => {
//     res.render('pages/about.twig')
// });
//
// app.get('/feedback', (req, res) => {
//     res.render('pages/feedback.twig')
// });

app.get('/check/url-available', (req, res) => {

    const slugTitle = slugify(req.query.id, {lower: true});

    NoteModel.findOne({ slug_title: slugTitle }).then(response => {
        if (response) {
            return res.json({
                error: false,
                exits: true,
                message: `The note URL <strong>${response.slug_title}</strong> already exists on ZNotepad`,
                id: response.slug_title
            })
        }

        return res.json({
            error: false,
            exits: false,
            message: `The note URL <strong style="color: #5ab034;">${slugTitle}</strong> is available.`,
            id: slugTitle
        })
    }).catch(error => {
        return res.json({
            error: true,
            message: error.message,
            id: slugTitle
        })
    })
});

app.get('/download/notes/:slug_title', (req, res) => {
    const format = req.query.format;
    NoteModel.findOneAndUpdate({slug_title: req.params.slug_title}, {
        $inc: {
            download_count: 1
        }
    }).then(note => {
        if (format === 'pdf') {
            pdf.create(note.content, {
                directory: "/tmp",
                format: 'Tabloid',
                border: {
                    top: "0.5in",
                    bottom: "0.5in",
                    right: "0.5in",
                    left: "0.5in"
                },
                header: {
                    height: "45mm",
                    contents: `<div style="text-align: right;">Creator: ZNotepad.com</div><br>
                                <p style="text-align: center;">${note.title}</p>`
                },
                footer: {
                    height: "28mm",
                    contents: {
                        first: `<small style="color: #424242; border-left: 2px solid #b11f24; padding-left: 5px;">Note URL: <span style="color: #82B1FF">https://znotepad.com/notes/${note.slug_title}</span></small>`
                    }
                }
            }).toStream((err, stream) => {
                if (err) return res.end(err.message);

                res.setHeader('Content-disposition', 'attachment; filename=' + note.slug_title + ".pdf");
                res.setHeader('Content-type', 'application/pdf');
                stream.pipe(res);
            })
        }
    }).catch(error => {
        console.log("Error:", error);
    })
});

app.route('/new-note')
    .get((req, res) => {

        const baseNote = req.query.base_note;
        const title = req.query.title; // title param from opensearch.xml

        if (baseNote) {
            Promise.all([
                NoteModel.findOne({ slug_title: baseNote }),
                NoteModel.find({ is_private: { $ne: true } })
                    .sort({created_at: -1})
                    .limit(8)
                    .select('title slug_title created_at visitor_count')
            ]).then(responses => {
                const note = responses[0];
                const newestNotes = responses[1];

                if (note) {
                    return res.render('clone-note.twig', {
                        note: note,
                        newestNotes: newestNotes || []
                    });
                }
                return res.render('write-note.twig', {
                    newestNotes: newestNotes || []
                });
            })
        } else {
            NoteModel.find({ is_private: { $ne: true } })
                .sort({created_at: -1})
                .limit(8)
                .select('title slug_title created_at visitor_count')
                .exec((err, newestNotes) => {
                    res.render('write-note.twig', {
                        note: {
                            title: title
                        },
                        newestNotes: newestNotes || []
                    });
                })
        }
    })
    .post((req, res) => {
        let title = req.body.title;
        const content = req.body.content;
        const contentPlaintext = req.body.content_plaintext;
        const baseNote = req.body.base_note;
        let password = req.body.password;
        let url = slugify(req.body.url, {lower: true});

        if (!content) {
            req.flash('warning', 'Please enter your note content you want to save. Just do it as well.');
            return res.redirect(302, '/new-note')
        }

        const $content = cheerio.load(content, {
            xmlMode: true
        });
        $content('a').attr('rel', 'nofollow');
        const contentHtml = entities.decodeXML($content.html());

        let isPrivate = req.body.is_private;
        if (isPrivate) {
            isPrivate = true;
        }

        if (!url) {
            let slugTitle = shortid.generate().toString().toLowerCase();
            if (title) {
                title = title.substring(0, 70);
                const uuid = slugTitle;
                slugTitle = slugify(title, {lower: true});
                slugTitle = slugTitle.substring(0, 70) + '-' + uuid;
            }
            url = slugTitle
        }

        if (password) {
            password = md5(password + "." + PREFIX_NOTE_PASSWORD);
        }

        const date = new Date();

        const newNote = new NoteModel({
            title: title,
            slug_title: url,
            content: contentHtml,
            content_plaintext: contentPlaintext,
            visitor_count: 0,
            is_private: isPrivate,
            password: password,
            base_note: baseNote,
            day: date.getDate(),
            month: date.getMonth() + 1,
            year: date.getFullYear()
        });

        newNote.save((err, note) => {
            if (err) {
                console.log(err);
                return res.render('error.twig');
            }
            if (note.password) {
                const lifetime = 2 * 24 * 60 * 60 * 1000; // 2 days;
                res.cookie(note.slug_title, note.password, {
                    // domain: '.znotepad.com',
                    expires: new Date(Date.now() + lifetime),
                    httpOnly: true
                });
            }

            req.flash('success', 'You have saved your note successful. You can see <strong>Share URL</strong> below. Just copy it and share your note to everyone right now.');
            return res.redirect(302, `/notes/${note.slug_title}`);
        });
    });

app.get('/password/notes', (req, res) => {
    return res.render('enter-password.twig');
});

app.post('/password/notes', (req, res) => {
    const password = req.body.password;

    const passwordEncrypted = md5(password + "." + PREFIX_NOTE_PASSWORD);

    NoteModel.findOne({ slug_title: req.query.id }).then(note => {
        if (note) {
            if (note.password === passwordEncrypted) {

                NoteModel.find({ is_private: { $ne: true } })
                    .sort({created_at: -1})
                    .limit(8)
                    .select('title slug_title created_at visitor_count').then(newestNotes => {
                        return res.render('note.twig', {
                            note: note,
                            newestNotes: newestNotes
                        });
                });
            }

            req.flash('danger', 'Wrong password!');
            return res.redirect('back');
        }

        return res.render('404.twig');

    }).catch(error => {
        return res.render('error.twig');
    });
});

app.get('/notes/:slug_title', (req, res) => {
    Promise.all([
        NoteModel.findOneAndUpdate({ slug_title: req.params.slug_title }, {
            $inc: {
                visitor_count: 1
            }
        }),
        NoteModel.find({ is_private: { $ne: true } })
            .sort({created_at: -1})
            .limit(8)
            .select('title slug_title created_at visitor_count')
    ]).then(response => {
        const note = response[0];
        const newestNotes = response[1];

        if (note) {
            if (note.password) {
                if (req.cookies[note.slug_title] !== note.password) {
                    return res.redirect(`/password/notes?id=${note.slug_title}`);
                }
            }
            return res.render('note.twig', {
                note: note,
                newestNotes: newestNotes
            });
        }
        return res.render('404.twig');

    }).catch(error => {
        return res.render('error.twig');
    });
});

/**
 * Logging exception error any status
 */
ExceptionHandlers.configure(app);

app.listen(3002, () => console.log("Application listen on port: 3002"));