const nunjucks = require('nunjucks');

class ViewEngine {
    constructor(app, templatesPath) {
        if (ViewEngine.exists) {
            return ViewEngine.instance
        }

        return nunjucks.configure(templatesPath, {
            autoescape: true,
            express: app
        });
    }
}

module.exports = ViewEngine;