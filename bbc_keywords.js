module.exports = {
    
    // Lists of the bot concepts and types.
    concepts: {},
    types: {},
            
    /**
     * Get the type of the moodle resource.
     * 
     * @param {string} value - The resource that is being searching for.
     * 
     * @returns {string} - The type requested.
     */
    getType: function (value) {

        var type = null;
        
        if (this.types.hasOwnProperty(value)) {
            type = this.types[value];
        }
        
        return type;
    },
    
    /**
     * Get the concept of the bot intent.
     * 
     * @param {string} value - The intent that is being searching for.
     * 
     * @returns {string} - The concept requested.
     */
    getConcept: function (value) {
        
        var concept = null;
        
        if (this.concepts.hasOwnProperty(value)) {
            concept = this.concepts[value];
        }
        
        return concept;
    }
};
  