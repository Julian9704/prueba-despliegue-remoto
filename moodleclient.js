const https = require('https');
const bbclib = require('./bbc_libs');

module.exports = {
    /**
     * Realize a HTTPS GET request to moodle.
     * 
     * @param {object} ctx - Context with the base URL and the token.
     * @param {string} functionName - Name of the function.
     * @param {object} params - Aditionals parameters to the request.
     * @param {function} onEnd - Callback function executed after finish the request.
     */

    request: function (ctx, functionName, params, onEnd) {
        var url = new URL(ctx.api.url + '/webservice/rest/server.php');
        url.searchParams.append('wstoken', ctx.api.token);
        url.searchParams.append('wsfunction', functionName);
        url.searchParams.append('moodlewsrestformat', 'json');

        if (params) {
            for (var key in params) {
                var value = params[key];
                url.searchParams.append(key, value);
            }
        }

        https.get(url, (res) => {

            if (res.statusCode == 200) {
                let data = [];

                res.on('data', chunk => {
                    data.push(chunk);
                });

                res.on('end', () => {
                    var response = JSON.parse(Buffer.concat(data).toString());

                    onEnd(response);
                });

            } else {
                throw new Error(bbclib.s('serviceerror'));
            }

        }).on('error', (e) => {
            throw new Error(e);
        });
    },

    /**
     * Get the courses from moodle.
     * 
     * @param {object} ctx - Context with the base URL and the token.
     * @param {function} onEnd - Callback function executed after finish the request.
     */
    getCourses: function (ctx, courseName = '', onEnd = null) {
        return new Promise((resolve) => {
            this.request(ctx, 'core_course_get_courses', null, (response) => {
                if (onEnd) {
                    onEnd(response);
                }

                resolve(response);
            });
        });
    },

    /**
     * Convert an object to a query string.
     * 
     * @param {object} obj - The object to be converted to a query string.
     * @returns - The query string representation of the object.
     */
    objectToQueryString: function (obj) {
        var str = [];
        for (var p in obj) {
            if (obj.hasOwnProperty(p)) {
                str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
            }
        }
        return str.join("&");
    },

    /**
     * Get the user's enrolled courses.
     * 
     * @param {object} ctx - Context with the base URL, the token and the ID.
     * @param {function} onEnd - Callback function executed after finish the request.
     * @returns - The user's enrolled courses.
     */
    getEnrollCourses: function (ctx, onEnd = null) {
        return new Promise((resolve) => {
            this.request(ctx, 'core_enrol_get_users_courses', { 'userid': ctx.userId }, (response) => {
                if (onEnd) {
                    onEnd(response);
                }
                resolve(response);
            });
        });
    },

    /**
     * Search in the faq glossary to get the definition in the params.
     * 
     * @param {object} ctx - Context with the base URL, the token.
     * @param {array} params - The key to get the definition.
     * @param {function} onEnd - Callback function executed after finish the request.
     * @returns - The definition searched.
     */
    getFaqDefinition: function (ctx, params, onEnd = null) {
        return new Promise((resolve) => {
            this.request(ctx, 'local_searchingnav_faq', params, (response) => {
                var message = '';
                response.forEach(element => {
                    message += element.definition;
                });
                if (onEnd) {
                    onEnd(response);
                }
                resolve(message);
            });
        });
    },

    // It does the API call to moodle to change the password.
    /**
     * 
     * @param {object} ctx - Context with the base URL, the token and the ID.
     * @param {array} params - The user ID.
     * @param {function} onEnd - Callback function executed after finish the request.
     * @returns - The URL to change the password of the user in Moodle.
     */
    changePassword: function (ctx, params, onEnd = null) {
        return new Promise((resolve) => {
            this.request(ctx, 'local_searchingnav_changepasswordlink', params, (response) => {
                if (onEnd) {
                    onEnd(response);
                }
                resolve(response);
            })
        })
    }
};
