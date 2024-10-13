const { JSDOM } = require("jsdom");

const codesWapp = { B: "*", STRONG: "*", I: "_", EM: "_", STRIKE: "~" };

module.exports = {

    /**
     * Convert HTML to plain text with some formats. Currently only supports WhatsApp format.
     * 
     * @param {string} html - Text to be formatted.
     * @param {string} contentFormat - This is the format for delivering the text.
     * @returns {string} - Text formated.
     */
    html2Format: function (html, contentFormat = 'plain') {

        var codes = {};
        if (contentFormat == 'whatsapp') {
            codes = codesWapp;
        }

        var dfs = (nodeJSDOM) => {
            let result = Array.from(nodeJSDOM.childNodes, (node) => {
                if (node.nodeType === 1) {
                    var s = dfs(node);
                    var code = codes[node.tagName];
                    if (node.tagName === "LI") {
                        return `• ${s}\n`;
                    } else if (node.nodeName === "BR") {
                        return "\n";
                    } else if (node.nodeName === "HR") {
                        return "\n---\n";
                    }

                    return code
                        ? s.replace(/^(\s*)(?=\S)|(?<=\S)(\s*)$/g, `$1${code}$2`)
                        : s;
                } else {
                    return node.textContent;
                }
            }).join("");

            result = result.replace(/\n{3,}/g, "\n\n");
            result = result.replace(/ +/g, " ");

            return result;
        };

        const dom = new JSDOM(html, { contentType: "text/html" });
        const body = dom.window.document.body;

        return dfs(body);
    }
};
