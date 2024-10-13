// Importing libraries.
const AWS = require('aws-sdk');
const { stringSimilarity } = require('string-similarity-js');

// Importing modules
const lib = require('./lib');
const bbclibs = require('./bbc_libs');
const mclient = require('./moodleclient');
const bbcpages = require('./bbc_pages');
const bbckeywords = require('./bbc_keywords');

// AWS Configurations.
AWS.config.update({ region: process.env.region });
const s3 = new AWS.S3({ apiVersion: process.env.s3apiversion });
const pStore = new AWS.SSM({ apiVersion: process.env.ssmapiversion });

const encode = process.env.encode;

// It manages errors that can be found while the data from AWS is being taken.
var errorPromise = function (errorLang) {
    new Promise(function (resolve, reject) {
        var manageErrorPromise = function () {
            var response = {
                "sessionState": {
                    "sessionAttributes": response.sessionState.sessionAttributes,
                    "dialogAction": {
                        "type": "Close"
                    },
                    "intent": response.sessionState.intent
                },
                "messages": [
                    {
                        "contentType": "PlainText",
                        "content": bbclibs.s(errorLang)
                    }
                ],
                "sessionId": response.sessionId,
            };
            response.sessionState.intent.state = "Fulfilled";
            resolve(response);
        };
        manageErrorPromise();
    });
}; 

/**
 * Checks the similarity between some of the user enrolled courses en the course typed in Lex.
 * @param {string} courseName - An enrolled course.
 * @param {string} lexCourse - The course typed by the user
 * @returns 
 */
function checkSimilarity (courseName, lexCourse) {
    let similarity;
    let minSimilarity = process.env.minSimilarity;
    similarity = stringSimilarity(courseName, lexCourse);
     if (similarity > minSimilarity) {
        return true;
    }
}
/**
 * It creates a message to response to the user as expected in Amazon Lex.
 * 
 * @param {object} event - It comes form Amazon Lex in its own format and brings the necessary information to fulfill the user's intent.
 * @param {object} context - It brings the context of the message.
 * 
 * @returns {object} - An object is created in accordance to the Amazon Lex format to be sent as a reponse.
 */
exports.handler = async (event, context) => {

    var currentClient = [event.bot.name];
    var language = event.bot.localeId.slice(0, 2);
    var bucketName = process.env.bucket;

    // Configuring params to API request.
    var paramsLanguage = {
        Bucket: bucketName,
        Key: currentClient + '/lang/' + language + '.json'
    };
    var paramsConceptSearch = {
        Bucket: bucketName,
        Key: currentClient + '/conceptsearch.json'
    };
    var paramsParametersStore = {
        Path: '/secret-chatia/' + currentClient + '/',
        Recursive: false,
        WithDecryption: true
    };

    // Getting info from aws services.
    try {
        var responseInfoLanguage = await s3.getObject(paramsLanguage).promise();
        var responseConceptSearch = await s3.getObject(paramsConceptSearch).promise();
        var responseParameterStore = await pStore.getParametersByPath(paramsParametersStore).promise();
    } catch (error) {
        errorPromise("serviceerror");
        console.error(error);
    }

    // waiting to get the course list from Moodle.
    var parsedLang = JSON.parse(responseInfoLanguage.Body.toString(encode));
    var parsedConcepts = JSON.parse(responseConceptSearch.Body.toString(encode));
    var infoParametersStore = responseParameterStore.Parameters;

    // Exporting data to the modules.
    bbclibs.lang = parsedLang;
    bbcpages.concepts = parsedConcepts.concept;
    bbcpages.paths = parsedConcepts.paths;
    bbckeywords.concepts = parsedConcepts.concept;
    bbckeywords.types = parsedConcepts.type;
    mclient.lang = parsedLang;

    var reqParams = event.sessionState.intent.slots;
    var eventName = event.sessionState.intent.name;
    var currentUser = null;
    var newWelcome = false;
    var contentFormat = event.sessionId.indexOf('whatsapp:') == '0' ? 'whatsapp' : 'plain';
    var localParams = {
        'token': '',
        'url': '',
        'siteId': 1
    };

    // Search the values for token and URL in the list"infoParametersStore".
    try {
        for (let param in localParams) {
            let paramName = paramsParametersStore.Path + param;
            let findSecret = infoParametersStore.find(element => element.Name.includes(paramName));
            if (findSecret) {
                localParams[param] = findSecret.Value;
            }
        }

        if (!(localParams.url) || !(localParams.token)) {
            throw new Error(bbclibs.s("errorsecrets"));
        }
    } catch {
        errorPromise("serviceerror");
        console.error(error);
    }

    var ctx = {
        'userId': 0,
        'courseId': 0,
        'api': {
            "url": localParams.url,
            "token": localParams.token
        },
        'defaultSiteId': localParams.siteId
    };

    // It responses with the object to be sent to Amazon Lex.
    const promise = new Promise(function (resolve, reject) {

        var managePromise = function () {
            var content = "";
            var message = {
                'contentType': 'PlainText',
                'content': content
            };

            var response = {
                "sessionState": {
                    "sessionAttributes": event.sessionState.sessionAttributes,
                    "dialogAction": {
                        "type": "Close"
                    },
                    "intent": event.sessionState.intent
                },
                "messages": [message],
                "sessionId": event.sessionId,
            };

            // Get the URL requested by the user.
            var toResolve = function (stateResponse) {

                if (stateResponse === 'page') {
                    message.content = bbcpages.request(ctx, reqParams.bbc_pages.value.interpretedValue,
                        reqParams.bbc_pages.value.originalValue);
                    response.sessionState.intent.state = "Fulfilled";
                } else if (stateResponse === 'slot') {
                    message.content = bbclibs.s("coursenotfound");
                    response.sessionState.dialogAction.type = "ElicitSlot";
                    response.sessionState.intent.state = "InProgress";
                    response.sessionState.dialogAction.slotToElicit = "bbc_courses";
                } else if (stateResponse === 'notslot') {
                    message.content = bbclibs.s("notcourse");
                    response.sessionState.dialogAction.type = "ElicitSlot";
                    response.sessionState.intent.state = "InProgress";
                    response.sessionState.dialogAction.slotToElicit = "bbc_courses";
                } else if (stateResponse === 'notenrolled') {
                    message.content = bbclibs.s("usernotenrolled");
                    message.content += '\n\n';
                    message.content += bbclibs.s("end");
                    response.sessionState.intent.state = "Fulfilled";
                }
                resolve(response);
            };
            const checkSimilarityAndResolve = (courseName, lexCourse, id) => {
                var stateResponse;
                var similarity;
                var minSimilarity = process.env.minSimilarity;
                similarity = stringSimilarity(courseName, lexCourse);
                if (similarity > minSimilarity) {
                    stateResponse = 'page';
                    ctx.courseId = id;
                    toResolve(stateResponse);
                    return true;
                }
                return false;
            };
            (async() => {

                try {
                    var inlineEvent = false;
                    if (eventName == 'bbcintent_welcome' || newWelcome) {
                        // Start the conversation with the user.
                        var firstName = '';

                        if (currentUser) {
                            firstName = currentUser.fullname.split(' ');
                            firstName = ' ' + firstName[0];
                        }

                        response.messages = [
                            {
                                'contentType': 'PlainText',
                                'content': bbclibs.s("welcome", firstName)
                            }
                        ];

                        if (eventName != 'bbcintent_welcome') {
                            // Prepare for other events.
                            response.messages[1] = message;
                        } else {
                            response.messages[0].content += bbclibs.s("help");
                        }

                        response.messages[0].content += "\n\n";
                        inlineEvent = true;
                    }

                    if (eventName == 'bbcintent_restart' || eventName == 'bbcintent_finish') {
                        // Restart or finish the session.
                        if (event.sessionState.sessionAttributes.hasOwnProperty('bbcInSession')) {
                            delete event.sessionState.sessionAttributes.bbcInSession;
                        }

                        response.messages[0].content = bbclibs.s(eventName === 'bbcintent_restart' ? "restart" : "finish");

                        // Delete the element "response.messages[1]" created in the welcome intent.
                        if (newWelcome) {
                            response.messages.splice(1, 1);
                        }
                        event.sessionState.intent.state = "Fulfilled";
                        resolve(response);
                    } else if (eventName == 'bbcintent_pages') {
                        var stateResponse = '';

                        if (reqParams.bbc_pages.value.interpretedValue == 'participants' ||
                            reqParams.bbc_pages.value.interpretedValue == 'reports' ||
                            reqParams.bbc_pages.value.interpretedValue == 'badges') {

                            if (reqParams.bbc_courses) {
                                // Get the user's enrolled courses in Moodle.
                                var enrollCourses = await mclient.getEnrollCourses(ctx);
                                var courseFound = false;
                                var lexCourse = reqParams.bbc_courses.value.interpretedValue;
                                for (let element of enrollCourses) {
                                    if (element.id == lexCourse) {
                                        stateResponse = 'page';
                                        ctx.courseId = element.id;
                                        toResolve(stateResponse);
                                        courseFound = true;
                                        break;
                                    }
                                }
                                if (courseFound) {
                                    return;
                                }
                                lexCourse = reqParams.bbc_courses.value.originalValue;

                                // If the course can't ve gotten with the id then is searched by similarity between the original 
                                // value of the slot from Amazon Lex and the name of the enrolled courses of the user.

                                for (let course of enrollCourses) {
                                    if (checkSimilarityAndResolve(course.shortname, lexCourse, course.id)) {
                                        return;
                                    }
                                }

                                for (let course of enrollCourses) {
                                    if (checkSimilarityAndResolve(course.fullname, lexCourse, course.id)) {
                                        return;
                                    }
                                }

                                for (let course of enrollCourses) {
                                    if (checkSimilarityAndResolve(course.displayname, lexCourse, course.id)) {
                                        return;
                                    }
                                }
                                stateResponse = 'notenrolled';
                                toResolve(stateResponse);
                            } else {
                                stateResponse = 'notslot';
                                toResolve(stateResponse);
                            }
                        } else {
                            stateResponse = 'page';
                            toResolve(stateResponse);
                        }
                    } else if (eventName.indexOf('bbcintdef') == 0) {
                        // Search for a specific publication in the faq academy glossary.
                        var conceptDefinition = eventName.substring(10).trim();
                        var params = [];
                        var concept = bbckeywords.getConcept(conceptDefinition);

                        if (concept) {
                            params['keywords[]'] = concept;
                        } else {
                            params['q'] = concept.replaceAll('_', ' ').trim();
                        }

                        message.content = await mclient.getFaqDefinition(ctx, params);
                        message.content = lib.html2Format(message.content, contentFormat);
                        event.sessionState.intent.state = "Fulfilled";
                        resolve(response);

                    } else if (eventName == 'bbcintent_enrolledcourses') {
                        // Search the user's enrolled courses.
                        if (currentUser) {
                            var enrollCourses = await mclient.getEnrollCourses(ctx);
                            if (enrollCourses.length > 0) {
                                var allEnroledCourses = '';
                                var coursePath;
                                enrollCourses.forEach(element => {
                                    ctx.courseId = element.id;
                                    coursePath = bbcpages.request(ctx, "course");
                                    allEnroledCourses += "•" + element.displayname + ": " + coursePath + '\n\n';
                                });
                                message.content = bbclibs.s("enrolledcourses", allEnroledCourses);
                            } else {
                                message.content = bbclibs.s("notenrolledcourses", allEnroledCourses);
                            }
                            response.sessionState.intent.state = "Fulfilled";
                            resolve(response);

                        } else {
                            message.content = bbclibs.s("notiduser");
                            response.sessionState.intent.state = "Fulfilled";
                            resolve(response);
                        }
                    } else if (eventName == 'bbcintent_editprofile') {
                        var params = [];
                        // It request the forum for the message to change password.

                        if (ctx.userId !== 0) {
                            // Verifies if the change password is available.
                            if (!parsedConcepts.configuration.password) {
                                params['keywords[]'] = parsedConcepts.concept.changepass;
                                message.content = await mclient.getFaqDefinition(ctx, params);
                                message.content = lib.html2Format(message.content, contentFormat);
                                event.sessionState.intent.state = "Fulfilled";
                                resolve(response);
                            } else if (!reqParams.bbc_confirmation) {
                                message.content = bbclibs.s("changepassconfirmation");
                                response.sessionState.dialogAction.type = "ElicitSlot";
                                response.sessionState.intent.state = "InProgress";
                                response.sessionState.dialogAction.slotToElicit = "bbc_confirmation";
                                resolve(response);
                            } else if (reqParams.bbc_confirmation.value.interpretedValue == 'no') {
                                message.content = bbclibs.s("end");
                                response.sessionState.intent.state = "Fulfilled";
                                resolve(response);
                            } else {
                                params['userid'] = currentUser.id;
                                // It does the API call to moodle to change the password.
                                var urlChangePassword = await mclient.changePassword(ctx, params);

                                if (urlChangePassword) {
                                    message.content = bbclibs.s("changepassinit");
                                    message.content += urlChangePassword;
                                    message.content += bbclibs.s("changepassend");
                                    response.sessionState.intent.state = "Fulfilled";
                                    resolve(response);
                                } else {
                                    params['keywords[]'] = parsedConcepts.concept.changepassword;
                                    message.content = await mclient.getFaqDefinition(ctx, params);
                                    message.content = lib.html2Format(message.content, contentFormat);
                                    event.sessionState.intent.state = "Fulfilled";
                                    resolve(response);
                                }
                            }
                        } else {
                            // Verifies if the user is registered.
                            params['keywords[]'] = parsedConcepts.concept.changepassword;
                            message.content = await mclient.getFaqDefinition(ctx, params);
                            message.content = lib.html2Format(message.content, contentFormat);
                            event.sessionState.intent.state = "Fulfilled";
                            resolve(response);
                        }
                    } else if (eventName == 'bbcintent_keywords') {
                        // If the user is not registered in Moodle the Search will be limited.
                        let userRegistered = false;

                        if ('bbcInSession' in event.sessionState.sessionAttributes) {
                            // Search in public context.
                            userRegistered = true;
                        }
                        let bbcKeyword = '';
                        let bbcResource = '';
                        let courseRegistered = false;
                        let inputCourse = '';
                        let userCourse = '';

                        if (!reqParams.bbc_keyword && !reqParams.bcc_moodleresource) {
                            // Because of almost a slot is required for the API, the bot will specify and request for a new message.
                            message.content = bbclibs.s("keywordsnotslots");
                            event.sessionState.intent.state = "Fulfilled";
                            resolve(response);
                            return;
                        } else {
                            if (reqParams.bbc_keyword) {
                                bbcKeyword = reqParams.bbc_keyword.value.originalValue;
                            }

                            if (reqParams.bcc_moodleresource) {
                                bbcResource = bbckeywords.getType(reqParams.bcc_moodleresource.value.interpretedValue);
                            }
                        }

                        if (reqParams.bbc_courses) {
                            // If the user is searching for some course, the user must be registered in the course.
                            let enrolledCourses = await mclient.getEnrollCourses(ctx);
                            if (enrolledCourses == null) {
                                throw new Error("Not enrolled courses");
                            }
                            inputCourse = reqParams.bbc_courses.value.interpretedValue;

                            if (Array.isArray(enrolledCourses) && enrolledCourses.length > 0) {
                                enrolledCourses.forEach(course => {
                                    
                                    if (course.id == inputCourse) {
                                        userCourse = course.id;
                                        courseRegistered = true;
                                        return;
                                    }
                                });
                            }
                            if (!courseRegistered) {
                                inputCourse = reqParams.bbc_courses.value.originalValue;
                
                                for (let course of enrolledCourses) {
                                    courseRegistered = checkSimilarity(course.shortname, inputCourse) ||
                                                       checkSimilarity(course.fullname, inputCourse) ||
                                                       checkSimilarity(course.displayname, inputCourse);
                                    if (courseRegistered) {
                                        userCourse = course.id;
                                        break;
                                    }
                                }

                                if (!courseRegistered) {
                                    // If the user indicates to search for a course, but it is not registered in that,
                                    // The bot will request for a course registered. 
                                    message.content = bbclibs.s("keywordscourse");
                                    response.sessionState.dialogAction.type = "ElicitSlot";
                                    response.sessionState.intent.state = "InProgress";
                                    response.sessionState.dialogAction.slotToElicit = "bbc_courses";
                                    resolve(response);
                                }
                            }
                        }
                        let params = [];
                        params['search'] = bbcKeyword ? bbcKeyword : '';
                        params['courseid'] = courseRegistered ? userCourse : 0;
                        params['resourcetype'] = bbcResource ? bbcResource : '';
                        params['userid'] = userRegistered ? ctx.userId : 0;

                        mclient.request(ctx, 'local_searchingnav_get_search', params, function (data) {

                            if (data && Array.isArray(data) && data.length > 0) {
                                content = bbclibs.s("resourcesfound");

                                data.forEach(item => {
                                    content += '    - ' + item.name + ': ' + item.url + "\n";
                                });
                            } else {
                                content = bbclibs.s("notinfofound");
                            }
                            message.content = lib.html2Format(content, contentFormat);
                            event.sessionState.intent.state = "Fulfilled";
                            resolve(response);
                        });
                    }
                    else {

                        if (inlineEvent) {
                            event.sessionState.intent.state = "Fulfilled";
                            resolve(response);
                        } else {
                            throw new Error(bbclibs.s("errornointent"));
                        }
                    }

                } catch (e) {
                    reject(Error(e));
                }
            })();
        };

        // If it's a Whatsapp session.
        // Only Whatsapp is supported currently.
        if (contentFormat == 'whatsapp') {

            if ('bbcInSession' in event.sessionState.sessionAttributes) {
                if (event.sessionState.sessionAttributes.bbcInSession) {
                    currentUser = JSON.parse(event.sessionState.sessionAttributes.bbcInSession);
                    ctx.userId = currentUser.id;
                }
                managePromise();
            } else {
                event.sessionState.sessionAttributes.bbcInSession = null;
                var params = [];
                params['field'] = 'phone';
                params['value'] = event.sessionId.replace('whatsapp:', '');

                mclient.request(ctx, 'local_searchingnav_identity', params, function (data) {

                    if (data && typeof data === 'object' && data.id > 0) {
                        event.sessionState.sessionAttributes.bbcInSession = JSON.stringify(data);
                        newWelcome = true;
                        currentUser = data;
                        ctx.userId = data.id;
                    }

                    managePromise();

                });
            }
        } else {
            managePromise();
        }
    });

    return promise;

};
