exports.configure = function (app) {
    /**
     * Error 403 handler function
     */
    app.use(function (err, req, res, next) {

        if (err.code !== 'EBADCSRFTOKEN') {
            return next(err);
        }

        if (req.xhr) {
            return res.ok({payload: null}, '403 invalid csrf token');
        }

        res.status(403);
        res.send('form tampered')
    });

    /**
     * Error 404 handler function
     */
    app.use(function (req, res) {
        res.status(404);
        res.render('404.twig');
    });

    /**
     * Error 500 handler function
     */
    app.use(function (err, req, res, next) {
        res.status(500);
        res.render('500.twig');
    });
};