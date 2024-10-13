const bbclib = require('./bbc_libs');

// Use the language function directly with the "s" name.
const s = bbclib.s;

module.exports = {

    // Objects of the bot with concepts and paths.
    concepts: {},
    paths: {},

    /**
     * It generates a URL so the users can reach the page in Moodle they are searching for.
     * 
     * @param {object} ctx - It has the context information about the moodle website and the user.
     * @param {string} q - The concept required to get the URL.
     * @param {string} p - The concept typed by the user.
     * 
     * @returns {string} - The traslation of the message with the URL to acces the page requested.
     */
    request: function (ctx, q, p = null) {

        q = q.toLowerCase();

        if (p) {
            p = p.toLowerCase();
        }

        if (!this.paths) {
            return s("errornotproperty", "paths");
        }

        var url = null;

        // Build the URL.
        if (this.paths.hasOwnProperty(q)) {
            url = ctx.api.url + this.paths[q];
        }

        if (ctx.courseId) {
            url = url.replace(/{courseid}/g, ctx.courseId);
        } else {
            url = url.replace(/{courseid}/g, ctx.defaultSiteId);
        }

        if (q == 'course') {
            return url;
        }
        
        if (url) {
            var conceptUrl = {
                'page': '"' + p + '"',
                'url' : url
            };
            return bbclib.s("gopage", conceptUrl);
        } else {
            return bbclib.s("notpagefound");
        }
    }
};
