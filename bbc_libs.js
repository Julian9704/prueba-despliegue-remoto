module.exports = {
    
    // List of translation strings.
    lang: {},

    /** 
     * Search the message to be sent to the user.
     * 
     * @param {string} key - The key to search in the file.
     * @param {string|object} vars - The phrase to be replaced or an object with multiple variables to be replaced.
     * 
     * @returns {string} - The translation of the message to response the intent of the user.
     */
    s: function(key, vars = null) {

        if (!key || key === undefined) {
            return 'N/A';
        }

        if (this.lang.hasOwnProperty(key)) {
            var message = this.lang[key];
        } else {
            return this.lang['errornotproperty'];
        }

        if (typeof vars !== "object" && vars !== undefined) {
            return message.replace('{a}', vars);
        } else if (!vars) {
            return message;
        } else {
            // Replace each element in the message.
            for (let varKey in vars) {
                message = message.replace("{" + varKey + "}", vars[varKey]);
            }
        }
        return message;
    }
};
