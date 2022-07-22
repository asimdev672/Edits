(function(f) {
    if (typeof exports === "object" && typeof module !== "undefined") {
        module.exports = f()
    } else if (typeof define === "function" && define.amd) {
        define([], f)
    } else {
        var g;
        if (typeof window !== "undefined") {
            g = window
        } else if (typeof global !== "undefined") {
            g = global
        } else if (typeof self !== "undefined") {
            g = self
        } else {
            g = this
        }
        g.sanitizeHtml = f()
    }
})(function() {
    var define, module, exports;
    return function() {
        function r(e, n, t) {
            function o(i, f) {
                if (!n[i]) {
                    if (!e[i]) {
                        var c = "function" == typeof require && require;
                        if (!f && c) return c(i, !0);
                        if (u) return u(i, !0);
                        var a = new Error("Cannot find module '" + i + "'");
                        throw a.code = "MODULE_NOT_FOUND", a
                    }
                    var p = n[i] = {
                        exports: {}
                    };
                    e[i][0].call(p.exports, function(r) {
                        var n = e[i][1][r];
                        return o(n || r)
                    }, p, p.exports, r, e, n, t)
                }
                return n[i].exports
            }
            for (var u = "function" == typeof require && require, i = 0; i < t.length; i++) o(t[i]);
            return o
        }
        return r
    }()({
        1: [function(require, module, exports) {
            "use strict";
            var htmlparser = require("htmlparser2");
            var extend = require("xtend");
            var quoteRegexp = require("lodash.escaperegexp");
            var cloneDeep = require("lodash.clonedeep");
            var mergeWith = require("lodash.mergewith");
            var isString = require("lodash.isstring");
            var isPlainObject = require("lodash.isplainobject");
            var srcset = require("srcset");
            var postcss = require("postcss");
            var url = require("url");

            function each(obj, cb) {
                if (obj) Object.keys(obj)
                    .forEach(function(key) {
                        cb(obj[key], key)
                    })
            }

            function has(obj, key) {
                return {}.hasOwnProperty.call(obj, key)
            }

            function filter(a, cb) {
                var n = [];
                each(a, function(v) {
                    if (cb(v)) {
                        n.push(v)
                    }
                });
                return n
            }
            module.exports = sanitizeHtml;
            var VALID_HTML_ATTRIBUTE_NAME = /^[^\0\t\n\f\r /<=>]+$/;

            function sanitizeHtml(html, options, _recursing) {
                var result = "";

                function Frame(tag, attribs) {
                    var that = this;
                    this.tag = tag;
                    this.attribs = attribs || {};
                    this.tagPosition = result.length;
                    this.text = "";
                    this.updateParentNodeText = function() {
                        if (stack.length) {
                            var parentFrame = stack[stack.length - 1];
                            parentFrame.text += that.text
                        }
                    }
                }
                if (!options) {
                    options = sanitizeHtml.defaults;
                    options.parser = htmlParserDefaults
                } else {
                    options = extend(sanitizeHtml.defaults, options);
                    if (options.parser) {
                        options.parser = extend(htmlParserDefaults, options.parser)
                    } else {
                        options.parser = htmlParserDefaults
                    }
                }
                var nonTextTagsArray = options.nonTextTags || ["script", "style", "textarea"];
                var allowedAttributesMap;
                var allowedAttributesGlobMap;
                if (options.allowedAttributes) {
                    allowedAttributesMap = {};
                    allowedAttributesGlobMap = {};
                    each(options.allowedAttributes, function(attributes, tag) {
                        allowedAttributesMap[tag] = [];
                        var globRegex = [];
                        attributes.forEach(function(obj) {
                            if (isString(obj) && obj.indexOf("*") >= 0) {
                                globRegex.push(quoteRegexp(obj)
                                    .replace(/\\\*/g, ".*"))
                            } else {
                                allowedAttributesMap[tag].push(obj)
                            }
                        });
                        allowedAttributesGlobMap[tag] = new RegExp("^(" + globRegex.join("|") + ")$")
                    })
                }
                var allowedClassesMap = {};
                each(options.allowedClasses, function(classes, tag) {
                    if (allowedAttributesMap) {
                        if (!has(allowedAttributesMap, tag)) {
                            allowedAttributesMap[tag] = []
                        }
                        allowedAttributesMap[tag].push("class")
                    }
                    allowedClassesMap[tag] = classes
                });
                var transformTagsMap = {};
                var transformTagsAll;
                each(options.transformTags, function(transform, tag) {
                    var transFun;
                    if (typeof transform === "function") {
                        transFun = transform
                    } else if (typeof transform === "string") {
                        transFun = sanitizeHtml.simpleTransform(transform)
                    }
                    if (tag === "*") {
                        transformTagsAll = transFun
                    } else {
                        transformTagsMap[tag] = transFun
                    }
                });
                var depth = 0;
                var stack = [];
                var skipMap = {};
                var transformMap = {};
                var skipText = false;
                var skipTextDepth = 0;
                var parser = new htmlparser.Parser({
                    onopentag: function onopentag(name, attribs) {
                        if (skipText) {
                            skipTextDepth++;
                            return
                        }
                        var frame = new Frame(name, attribs);
                        stack.push(frame);
                        var skip = false;
                        var hasText = frame.text ? true : false;
                        var transformedTag;
                        if (has(transformTagsMap, name)) {
                            transformedTag = transformTagsMap[name](name, attribs);
                            frame.attribs = attribs = transformedTag.attribs;
                            if (transformedTag.text !== undefined) {
                                frame.innerText = transformedTag.text
                            }
                            if (name !== transformedTag.tagName) {
                                frame.name = name = transformedTag.tagName;
                                transformMap[depth] = transformedTag.tagName
                            }
                        }
                        if (transformTagsAll) {
                            transformedTag = transformTagsAll(name, attribs);
                            frame.attribs = attribs = transformedTag.attribs;
                            if (name !== transformedTag.tagName) {
                                frame.name = name = transformedTag.tagName;
                                transformMap[depth] = transformedTag.tagName
                            }
                        }
                        if (options.allowedTags && options.allowedTags.indexOf(name) === -1) {
                            skip = true;
                            if (nonTextTagsArray.indexOf(name) !== -1) {
                                skipText = true;
                                skipTextDepth = 1
                            }
                            skipMap[depth] = true
                        }
                        depth++;
                        if (skip) {
                            return
                        }
                        result += "<" + name;
                        if (!allowedAttributesMap || has(allowedAttributesMap, name) || allowedAttributesMap["*"]) {
                            each(attribs, function(value, a) {
                                if (!VALID_HTML_ATTRIBUTE_NAME.test(a)) {
                                    delete frame.attribs[a];
                                    return
                                }
                                var parsed;
                                var passedAllowedAttributesMapCheck = false;
                                if (!allowedAttributesMap || has(allowedAttributesMap, name) && allowedAttributesMap[name].indexOf(a) !== -1 || allowedAttributesMap["*"] && allowedAttributesMap["*"].indexOf(a) !== -1 || has(allowedAttributesGlobMap, name) && allowedAttributesGlobMap[name].test(a) || allowedAttributesGlobMap["*"] && allowedAttributesGlobMap["*"].test(a)) {
                                    passedAllowedAttributesMapCheck = true
                                } else if (allowedAttributesMap && allowedAttributesMap[name]) {
                                    var _iteratorNormalCompletion = true;
                                    var _didIteratorError = false;
                                    var _iteratorError = undefined;
                                    try {
                                        for (var _iterator = allowedAttributesMap[name][Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next())
                                                .done); _iteratorNormalCompletion = true) {
                                            var o = _step.value;
                                            if (isPlainObject(o) && o.name && o.name === a) {
                                                passedAllowedAttributesMapCheck = true;
                                                var newValue = "";
                                                if (o.multiple === true) {
                                                    var splitStrArray = value.split(" ");
                                                    var _iteratorNormalCompletion2 = true;
                                                    var _didIteratorError2 = false;
                                                    var _iteratorError2 = undefined;
                                                    try {
                                                        for (var _iterator2 = splitStrArray[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next())
                                                                .done); _iteratorNormalCompletion2 = true) {
                                                            var s = _step2.value;
                                                            if (o.values.indexOf(s) !== -1) {
                                                                if (newValue === "") {
                                                                    newValue = s
                                                                } else {
                                                                    newValue += " " + s
                                                                }
                                                            }
                                                        }
                                                    } catch (err) {
                                                        _didIteratorError2 = true;
                                                        _iteratorError2 = err
                                                    } finally {
                                                        try {
                                                            if (!_iteratorNormalCompletion2 && _iterator2.return) {
                                                                _iterator2.return()
                                                            }
                                                        } finally {
                                                            if (_didIteratorError2) {
                                                                throw _iteratorError2
                                                            }
                                                        }
                                                    }
                                                } else if (o.values.indexOf(value) >= 0) {
                                                    newValue = value
                                                }
                                                value = newValue
                                            }
                                        }
                                    } catch (err) {
                                        _didIteratorError = true;
                                        _iteratorError = err
                                    } finally {
                                        try {
                                            if (!_iteratorNormalCompletion && _iterator.return) {
                                                _iterator.return()
                                            }
                                        } finally {
                                            if (_didIteratorError) {
                                                throw _iteratorError
                                            }
                                        }
                                    }
                                }
                                if (passedAllowedAttributesMapCheck) {
                                    if (options.allowedSchemesAppliedToAttributes.indexOf(a) !== -1) {
                                        if (naughtyHref(name, value)) {
                                            delete frame.attribs[a];
                                            return
                                        }
                                    }
                                    if (name === "iframe" && a === "src") {
                                        var allowed = true;
                                        try {
                                            parsed = url.parse(value, false, true);
                                            var isRelativeUrl = parsed && parsed.host === null && parsed.protocol === null;
                                            if (isRelativeUrl) {
                                                allowed = has(options, "allowIframeRelativeUrls") ? options.allowIframeRelativeUrls : !options.allowedIframeHostnames
                                            } else if (options.allowedIframeHostnames) {
                                                allowed = options.allowedIframeHostnames.find(function(hostname) {
                                                    return hostname === parsed.hostname
                                                })
                                            }
                                        } catch (e) {
                                            allowed = false
                                        }
                                        if (!allowed) {
                                            delete frame.attribs[a];
                                            return
                                        }
                                    }
                                    if (a === "srcset") {
                                        try {
                                            parsed = srcset.parse(value);
                                            each(parsed, function(value) {
                                                if (naughtyHref("srcset", value.url)) {
                                                    value.evil = true
                                                }
                                            });
                                            parsed = filter(parsed, function(v) {
                                                return !v.evil
                                            });
                                            if (!parsed.length) {
                                                delete frame.attribs[a];
                                                return
                                            } else {
                                                value = srcset.stringify(filter(parsed, function(v) {
                                                    return !v.evil
                                                }));
                                                frame.attribs[a] = value
                                            }
                                        } catch (e) {
                                            delete frame.attribs[a];
                                            return
                                        }
                                    }
                                    if (a === "class") {
                                        value = filterClasses(value, allowedClassesMap[name]);
                                        if (!value.length) {
                                            delete frame.attribs[a];
                                            return
                                        }
                                    }
                                    if (a === "style") {
                                        try {
                                            var abstractSyntaxTree = postcss.parse(name + " {" + value + "}");
                                            var filteredAST = filterCss(abstractSyntaxTree, options.allowedStyles);
                                            value = stringifyStyleAttributes(filteredAST);
                                            if (value.length === 0) {
                                                delete frame.attribs[a];
                                                return
                                            }
                                        } catch (e) {
                                            delete frame.attribs[a];
                                            return
                                        }
                                    }
                                    result += " " + a;
                                    if (value.length) {
                                        result += '="' + escapeHtml(value, true) + '"'
                                    }
                                } else {
                                    delete frame.attribs[a]
                                }
                            })
                        }
                        if (options.selfClosing.indexOf(name) !== -1) {
                            result += " />"
                        } else {
                            result += ">";
                            if (frame.innerText && !hasText && !options.textFilter) {
                                result += frame.innerText
                            }
                        }
                    },
                    ontext: function ontext(text) {
                        if (skipText) {
                            return
                        }
                        var lastFrame = stack[stack.length - 1];
                        var tag;
                        if (lastFrame) {
                            tag = lastFrame.tag;
                            text = lastFrame.innerText !== undefined ? lastFrame.innerText : text
                        }
                        if (tag === "script" || tag === "style") {
                            result += text
                        } else {
                            var escaped = escapeHtml(text, false);
                            if (options.textFilter) {
                                result += options.textFilter(escaped)
                            } else {
                                result += escaped
                            }
                        }
                        if (stack.length) {
                            var frame = stack[stack.length - 1];
                            frame.text += text
                        }
                    },
                    onclosetag: function onclosetag(name) {
                        if (skipText) {
                            skipTextDepth--;
                            if (!skipTextDepth) {
                                skipText = false
                            } else {
                                return
                            }
                        }
                        var frame = stack.pop();
                        if (!frame) {
                            return
                        }
                        skipText = false;
                        depth--;
                        if (skipMap[depth]) {
                            delete skipMap[depth];
                            frame.updateParentNodeText();
                            return
                        }
                        if (transformMap[depth]) {
                            name = transformMap[depth];
                            delete transformMap[depth]
                        }
                        if (options.exclusiveFilter && options.exclusiveFilter(frame)) {
                            result = result.substr(0, frame.tagPosition);
                            return
                        }
                        frame.updateParentNodeText();
                        if (options.selfClosing.indexOf(name) !== -1) {
                            return
                        }
                        result += "</" + name + ">"
                    }
                }, options.parser);
                parser.write(html);
                parser.end();
                return result;

                function escapeHtml(s, quote) {
                    if (typeof s !== "string") {
                        s = s + ""
                    }
                    if (options.parser.decodeEntities) {
                        s = s.replace(/&/g, "&amp;")
                            .replace(/</g, "&lt;")
                            .replace(/\>/g, "&gt;");
                        if (quote) {
                            s = s.replace(/\"/g, "&quot;")
                        }
                    }
                    s = s.replace(/&(?![a-zA-Z0-9#]{1,20};)/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/\>/g, "&gt;");
                    if (quote) {
                        s = s.replace(/\"/g, "&quot;")
                    }
                    s = s.replace(/&amp;nbsp;/g, "&nbsp;");
                    return s
                }

                function naughtyHref(name, href) {
                    href = href.replace(/[\x00-\x20]+/g, "");
                    href = href.replace(/<\!\-\-.*?\-\-\>/g, "");
                    var matches = href.match(/^([a-zA-Z]+)\:/);
                    if (!matches) {
                        if (href.match(/^[\/\\]{2}/)) {
                            return !options.allowProtocolRelative
                        }
                        return false
                    }
                    var scheme = matches[1].toLowerCase();
                    if (has(options.allowedSchemesByTag, name)) {
                        return options.allowedSchemesByTag[name].indexOf(scheme) === -1
                    }
                    return !options.allowedSchemes || options.allowedSchemes.indexOf(scheme) === -1
                }

                function filterCss(abstractSyntaxTree, allowedStyles) {
                    if (!allowedStyles) {
                        return abstractSyntaxTree
                    }
                    var filteredAST = cloneDeep(abstractSyntaxTree);
                    var astRules = abstractSyntaxTree.nodes[0];
                    var selectedRule;
                    if (allowedStyles[astRules.selector] && allowedStyles["*"]) {
                        selectedRule = mergeWith(cloneDeep(allowedStyles[astRules.selector]), allowedStyles["*"], function(objValue, srcValue) {
                            if (Array.isArray(objValue)) {
                                return objValue.concat(srcValue)
                            }
                        })
                    } else {
                        selectedRule = allowedStyles[astRules.selector] || allowedStyles["*"]
                    }
                    if (selectedRule) {
                        filteredAST.nodes[0].nodes = astRules.nodes.reduce(filterDeclarations(selectedRule), [])
                    }
                    return filteredAST
                }

                function stringifyStyleAttributes(filteredAST) {
                    return filteredAST.nodes[0].nodes.reduce(function(extractedAttributes, attributeObject) {
                            extractedAttributes.push(attributeObject.prop + ":" + attributeObject.value);
                            return extractedAttributes
                        }, [])
                        .join(";")
                }

                function filterDeclarations(selectedRule) {
                    return function(allowedDeclarationsList, attributeObject) {
                        if (selectedRule.hasOwnProperty(attributeObject.prop)) {
                            var matchesRegex = selectedRule[attributeObject.prop].some(function(regularExpression) {
                                return regularExpression.test(attributeObject.value)
                            });
                            if (matchesRegex) {
                                allowedDeclarationsList.push(attributeObject)
                            }
                        }
                        return allowedDeclarationsList
                    }
                }

                function filterClasses(classes, allowed) {
                    if (!allowed) {
                        return classes
                    }
                    classes = classes.split(/\s+/);
                    return classes.filter(function(clss) {
                            return allowed.indexOf(clss) !== -1
                        })
                        .join(" ")
                }
            }
            var htmlParserDefaults = {
                decodeEntities: true
            };
            sanitizeHtml.defaults = {
                allowedTags: ["h3", "h4", "h5", "h6", "blockquote", "p", "a", "ul", "ol", "nl", "li", "b", "i", "strong", "em", "strike", "code", "hr", "br", "div", "table", "thead", "caption", "tbody", "tr", "th", "td", "pre", "iframe"],
                allowedAttributes: {
                    a: ["href", "name", "target"],
                    img: ["src"]
                },
                selfClosing: ["img", "br", "hr", "area", "base", "basefont", "input", "link", "meta"],
                allowedSchemes: ["http", "https", "ftp", "mailto"],
                allowedSchemesByTag: {},
                allowedSchemesAppliedToAttributes: ["href", "src", "cite"],
                allowProtocolRelative: true
            };
            sanitizeHtml.simpleTransform = function(newTagName, newAttribs, merge) {
                merge = merge === undefined ? true : merge;
                newAttribs = newAttribs || {};
                return function(tagName, attribs) {
                    var attrib;
                    if (merge) {
                        for (attrib in newAttribs) {
                            attribs[attrib] = newAttribs[attrib]
                        }
                    } else {
                        attribs = newAttribs
                    }
                    return {
                        tagName: newTagName,
                        attribs: attribs
                    }
                }
            }
        }, {
            htmlparser2: 34,
            "lodash.clonedeep": 37,
            "lodash.escaperegexp": 38,
            "lodash.isplainobject": 39,
            "lodash.isstring": 40,
            "lodash.mergewith": 41,
            postcss: 56,
            srcset: 85,
            url: 87,
            xtend: 89
        }],
        2: [function(require, module, exports) {
            (function(global) {
                "use strict";

                function uniqNoSet(arr) {
                    var ret = [];
                    for (var i = 0; i < arr.length; i++) {
                        if (ret.indexOf(arr[i]) === -1) {
                            ret.push(arr[i])
                        }
                    }
                    return ret
                }

                function uniqSet(arr) {
                    var seen = new Set;
                    return arr.filter(function(el) {
                        if (!seen.has(el)) {
                            seen.add(el);
                            return true
                        }
                        return false
                    })
                }

                function uniqSetWithForEach(arr) {
                    var ret = [];
                    new Set(arr)
                        .forEach(function(el) {
                            ret.push(el)
                        });
                    return ret
                }

                function doesForEachActuallyWork() {
                    var ret = false;
                    new Set([true])
                        .forEach(function(el) {
                            ret = el
                        });
                    return ret === true
                }
                if ("Set" in global) {
                    if (typeof Set.prototype.forEach === "function" && doesForEachActuallyWork()) {
                        module.exports = uniqSetWithForEach
                    } else {
                        module.exports = uniqSet
                    }
                } else {
                    module.exports = uniqNoSet
                }
            })
            .call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
        }, {}],
        3: [function(require, module, exports) {
            "use strict";
            exports.byteLength = byteLength;
            exports.toByteArray = toByteArray;
            exports.fromByteArray = fromByteArray;
            var lookup = [];
            var revLookup = [];
            var Arr = typeof Uint8Array !== "undefined" ? Uint8Array : Array;
            var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
            for (var i = 0, len = code.length; i < len; ++i) {
                lookup[i] = code[i];
                revLookup[code.charCodeAt(i)] = i
            }
            revLookup["-".charCodeAt(0)] = 62;
            revLookup["_".charCodeAt(0)] = 63;

            function getLens(b64) {
                var len = b64.length;
                if (len % 4 > 0) {
                    throw new Error("Invalid string. Length must be a multiple of 4")
                }
                var validLen = b64.indexOf("=");
                if (validLen === -1) validLen = len;
                var placeHoldersLen = validLen === len ? 0 : 4 - validLen % 4;
                return [validLen, placeHoldersLen]
            }

            function byteLength(b64) {
                var lens = getLens(b64);
                var validLen = lens[0];
                var placeHoldersLen = lens[1];
                return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen
            }

            function _byteLength(b64, validLen, placeHoldersLen) {
                return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen
            }

            function toByteArray(b64) {
                var tmp;
                var lens = getLens(b64);
                var validLen = lens[0];
                var placeHoldersLen = lens[1];
                var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));
                var curByte = 0;
                var len = placeHoldersLen > 0 ? validLen - 4 : validLen;
                for (var i = 0; i < len; i += 4) {
                    tmp = revLookup[b64.charCodeAt(i)] << 18 | revLookup[b64.charCodeAt(i + 1)] << 12 | revLookup[b64.charCodeAt(i + 2)] << 6 | revLookup[b64.charCodeAt(i + 3)];
                    arr[curByte++] = tmp >> 16 & 255;
                    arr[curByte++] = tmp >> 8 & 255;
                    arr[curByte++] = tmp & 255
                }
                if (placeHoldersLen === 2) {
                    tmp = revLookup[b64.charCodeAt(i)] << 2 | revLookup[b64.charCodeAt(i + 1)] >> 4;
                    arr[curByte++] = tmp & 255
                }
                if (placeHoldersLen === 1) {
                    tmp = revLookup[b64.charCodeAt(i)] << 10 | revLookup[b64.charCodeAt(i + 1)] << 4 | revLookup[b64.charCodeAt(i + 2)] >> 2;
                    arr[curByte++] = tmp >> 8 & 255;
                    arr[curByte++] = tmp & 255
                }
                return arr
            }

            function tripletToBase64(num) {
                return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63]
            }

            function encodeChunk(uint8, start, end) {
                var tmp;
                var output = [];
                for (var i = start; i < end; i += 3) {
                    tmp = (uint8[i] << 16 & 16711680) + (uint8[i + 1] << 8 & 65280) + (uint8[i + 2] & 255);
                    output.push(tripletToBase64(tmp))
                }
                return output.join("")
            }

            function fromByteArray(uint8) {
                var tmp;
                var len = uint8.length;
                var extraBytes = len % 3;
                var parts = [];
                var maxChunkLength = 16383;
                for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
                    parts.push(encodeChunk(uint8, i, i + maxChunkLength > len2 ? len2 : i + maxChunkLength))
                }
                if (extraBytes === 1) {
                    tmp = uint8[len - 1];
                    parts.push(lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "==")
                } else if (extraBytes === 2) {
                    tmp = (uint8[len - 2] << 8) + uint8[len - 1];
                    parts.push(lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "=")
                }
                return parts.join("")
            }
        }, {}],
        4: [function(require, module, exports) {}, {}],
        5: [function(require, module, exports) {
            (function(Buffer) {
                "use strict";
                var base64 = require("base64-js");
                var ieee754 = require("ieee754");
                exports.Buffer = Buffer;
                exports.SlowBuffer = SlowBuffer;
                exports.INSPECT_MAX_BYTES = 50;
                var K_MAX_LENGTH = 2147483647;
                exports.kMaxLength = K_MAX_LENGTH;
                Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport();
                if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== "undefined" && typeof console.error === "function") {
                    console.error("This browser lacks typed array (Uint8Array) support which is required by " + "`buffer` v5.x. Use `buffer` v4.x if you require old browser support.")
                }

                function typedArraySupport() {
                    try {
                        var arr = new Uint8Array(1);
                        arr.__proto__ = {
                            __proto__: Uint8Array.prototype,
                            foo: function() {
                                return 42
                            }
                        };
                        return arr.foo() === 42
                    } catch (e) {
                        return false
                    }
                }
                Object.defineProperty(Buffer.prototype, "parent", {
                    enumerable: true,
                    get: function() {
                        if (!Buffer.isBuffer(this)) return undefined;
                        return this.buffer
                    }
                });
                Object.defineProperty(Buffer.prototype, "offset", {
                    enumerable: true,
                    get: function() {
                        if (!Buffer.isBuffer(this)) return undefined;
                        return this.byteOffset
                    }
                });

                function createBuffer(length) {
                    if (length > K_MAX_LENGTH) {
                        throw new RangeError('The value "' + length + '" is invalid for option "size"')
                    }
                    var buf = new Uint8Array(length);
                    buf.__proto__ = Buffer.prototype;
                    return buf
                }

                function Buffer(arg, encodingOrOffset, length) {
                    if (typeof arg === "number") {
                        if (typeof encodingOrOffset === "string") {
                            throw new TypeError('The "string" argument must be of type string. Received type number')
                        }
                        return allocUnsafe(arg)
                    }
                    return from(arg, encodingOrOffset, length)
                }
                if (typeof Symbol !== "undefined" && Symbol.species != null && Buffer[Symbol.species] === Buffer) {
                    Object.defineProperty(Buffer, Symbol.species, {
                        value: null,
                        configurable: true,
                        enumerable: false,
                        writable: false
                    })
                }
                Buffer.poolSize = 8192;

                function from(value, encodingOrOffset, length) {
                    if (typeof value === "string") {
                        return fromString(value, encodingOrOffset)
                    }
                    if (ArrayBuffer.isView(value)) {
                        return fromArrayLike(value)
                    }
                    if (value == null) {
                        throw TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, " + "or Array-like Object. Received type " + typeof value)
                    }
                    if (isInstance(value, ArrayBuffer) || value && isInstance(value.buffer, ArrayBuffer)) {
                        return fromArrayBuffer(value, encodingOrOffset, length)
                    }
                    if (typeof value === "number") {
                        throw new TypeError('The "value" argument must not be of type number. Received type number')
                    }
                    var valueOf = value.valueOf && value.valueOf();
                    if (valueOf != null && valueOf !== value) {
                        return Buffer.from(valueOf, encodingOrOffset, length)
                    }
                    var b = fromObject(value);
                    if (b) return b;
                    if (typeof Symbol !== "undefined" && Symbol.toPrimitive != null && typeof value[Symbol.toPrimitive] === "function") {
                        return Buffer.from(value[Symbol.toPrimitive]("string"), encodingOrOffset, length)
                    }
                    throw new TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, " + "or Array-like Object. Received type " + typeof value)
                }
                Buffer.from = function(value, encodingOrOffset, length) {
                    return from(value, encodingOrOffset, length)
                };
                Buffer.prototype.__proto__ = Uint8Array.prototype;
                Buffer.__proto__ = Uint8Array;

                function assertSize(size) {
                    if (typeof size !== "number") {
                        throw new TypeError('"size" argument must be of type number')
                    } else if (size < 0) {
                        throw new RangeError('The value "' + size + '" is invalid for option "size"')
                    }
                }

                function alloc(size, fill, encoding) {
                    assertSize(size);
                    if (size <= 0) {
                        return createBuffer(size)
                    }
                    if (fill !== undefined) {
                        return typeof encoding === "string" ? createBuffer(size)
                            .fill(fill, encoding) : createBuffer(size)
                            .fill(fill)
                    }
                    return createBuffer(size)
                }
                Buffer.alloc = function(size, fill, encoding) {
                    return alloc(size, fill, encoding)
                };

                function allocUnsafe(size) {
                    assertSize(size);
                    return createBuffer(size < 0 ? 0 : checked(size) | 0)
                }
                Buffer.allocUnsafe = function(size) {
                    return allocUnsafe(size)
                };
                Buffer.allocUnsafeSlow = function(size) {
                    return allocUnsafe(size)
                };

                function fromString(string, encoding) {
                    if (typeof encoding !== "string" || encoding === "") {
                        encoding = "utf8"
                    }
                    if (!Buffer.isEncoding(encoding)) {
                        throw new TypeError("Unknown encoding: " + encoding)
                    }
                    var length = byteLength(string, encoding) | 0;
                    var buf = createBuffer(length);
                    var actual = buf.write(string, encoding);
                    if (actual !== length) {
                        buf = buf.slice(0, actual)
                    }
                    return buf
                }

                function fromArrayLike(array) {
                    var length = array.length < 0 ? 0 : checked(array.length) | 0;
                    var buf = createBuffer(length);
                    for (var i = 0; i < length; i += 1) {
                        buf[i] = array[i] & 255
                    }
                    return buf
                }

                function fromArrayBuffer(array, byteOffset, length) {
                    if (byteOffset < 0 || array.byteLength < byteOffset) {
                        throw new RangeError('"offset" is outside of buffer bounds')
                    }
                    if (array.byteLength < byteOffset + (length || 0)) {
                        throw new RangeError('"length" is outside of buffer bounds')
                    }
                    var buf;
                    if (byteOffset === undefined && length === undefined) {
                        buf = new Uint8Array(array)
                    } else if (length === undefined) {
                        buf = new Uint8Array(array, byteOffset)
                    } else {
                        buf = new Uint8Array(array, byteOffset, length)
                    }
                    buf.__proto__ = Buffer.prototype;
                    return buf
                }

                function fromObject(obj) {
                    if (Buffer.isBuffer(obj)) {
                        var len = checked(obj.length) | 0;
                        var buf = createBuffer(len);
                        if (buf.length === 0) {
                            return buf
                        }
                        obj.copy(buf, 0, 0, len);
                        return buf
                    }
                    if (obj.length !== undefined) {
                        if (typeof obj.length !== "number" || numberIsNaN(obj.length)) {
                            return createBuffer(0)
                        }
                        return fromArrayLike(obj)
                    }
                    if (obj.type === "Buffer" && Array.isArray(obj.data)) {
                        return fromArrayLike(obj.data)
                    }
                }

                function checked(length) {
                    if (length >= K_MAX_LENGTH) {
                        throw new RangeError("Attempt to allocate Buffer larger than maximum " + "size: 0x" + K_MAX_LENGTH.toString(16) + " bytes")
                    }
                    return length | 0
                }

                function SlowBuffer(length) {
                    if (+length != length) {
                        length = 0
                    }
                    return Buffer.alloc(+length)
                }
                Buffer.isBuffer = function isBuffer(b) {
                    return b != null && b._isBuffer === true && b !== Buffer.prototype
                };
                Buffer.compare = function compare(a, b) {
                    if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength);
                    if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength);
                    if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
                        throw new TypeError('The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array')
                    }
                    if (a === b) return 0;
                    var x = a.length;
                    var y = b.length;
                    for (var i = 0, len = Math.min(x, y); i < len; ++i) {
                        if (a[i] !== b[i]) {
                            x = a[i];
                            y = b[i];
                            break
                        }
                    }
                    if (x < y) return -1;
                    if (y < x) return 1;
                    return 0
                };
                Buffer.isEncoding = function isEncoding(encoding) {
                    switch (String(encoding)
                        .toLowerCase()) {
                        case "hex":
                        case "utf8":
                        case "utf-8":
                        case "ascii":
                        case "latin1":
                        case "binary":
                        case "base64":
                        case "ucs2":
                        case "ucs-2":
                        case "utf16le":
                        case "utf-16le":
                            return true;
                        default:
                            return false
                    }
                };
                Buffer.concat = function concat(list, length) {
                    if (!Array.isArray(list)) {
                        throw new TypeError('"list" argument must be an Array of Buffers')
                    }
                    if (list.length === 0) {
                        return Buffer.alloc(0)
                    }
                    var i;
                    if (length === undefined) {
                        length = 0;
                        for (i = 0; i < list.length; ++i) {
                            length += list[i].length
                        }
                    }
                    var buffer = Buffer.allocUnsafe(length);
                    var pos = 0;
                    for (i = 0; i < list.length; ++i) {
                        var buf = list[i];
                        if (isInstance(buf, Uint8Array)) {
                            buf = Buffer.from(buf)
                        }
                        if (!Buffer.isBuffer(buf)) {
                            throw new TypeError('"list" argument must be an Array of Buffers')
                        }
                        buf.copy(buffer, pos);
                        pos += buf.length
                    }
                    return buffer
                };

                function byteLength(string, encoding) {
                    if (Buffer.isBuffer(string)) {
                        return string.length
                    }
                    if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
                        return string.byteLength
                    }
                    if (typeof string !== "string") {
                        throw new TypeError('The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' + "Received type " + typeof string)
                    }
                    var len = string.length;
                    var mustMatch = arguments.length > 2 && arguments[2] === true;
                    if (!mustMatch && len === 0) return 0;
                    var loweredCase = false;
                    for (;;) {
                        switch (encoding) {
                            case "ascii":
                            case "latin1":
                            case "binary":
                                return len;
                            case "utf8":
                            case "utf-8":
                                return utf8ToBytes(string)
                                    .length;
                            case "ucs2":
                            case "ucs-2":
                            case "utf16le":
                            case "utf-16le":
                                return len * 2;
                            case "hex":
                                return len >>> 1;
                            case "base64":
                                return base64ToBytes(string)
                                    .length;
                            default:
                                if (loweredCase) {
                                    return mustMatch ? -1 : utf8ToBytes(string)
                                        .length
                                }
                                encoding = ("" + encoding)
                                    .toLowerCase();
                                loweredCase = true
                        }
                    }
                }
                Buffer.byteLength = byteLength;

                function slowToString(encoding, start, end) {
                    var loweredCase = false;
                    if (start === undefined || start < 0) {
                        start = 0
                    }
                    if (start > this.length) {
                        return ""
                    }
                    if (end === undefined || end > this.length) {
                        end = this.length
                    }
                    if (end <= 0) {
                        return ""
                    }
                    end >>>= 0;
                    start >>>= 0;
                    if (end <= start) {
                        return ""
                    }
                    if (!encoding) encoding = "utf8";
                    while (true) {
                        switch (encoding) {
                            case "hex":
                                return hexSlice(this, start, end);
                            case "utf8":
                            case "utf-8":
                                return utf8Slice(this, start, end);
                            case "ascii":
                                return asciiSlice(this, start, end);
                            case "latin1":
                            case "binary":
                                return latin1Slice(this, start, end);
                            case "base64":
                                return base64Slice(this, start, end);
                            case "ucs2":
                            case "ucs-2":
                            case "utf16le":
                            case "utf-16le":
                                return utf16leSlice(this, start, end);
                            default:
                                if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
                                encoding = (encoding + "")
                                    .toLowerCase();
                                loweredCase = true
                        }
                    }
                }
                Buffer.prototype._isBuffer = true;

                function swap(b, n, m) {
                    var i = b[n];
                    b[n] = b[m];
                    b[m] = i
                }
                Buffer.prototype.swap16 = function swap16() {
                    var len = this.length;
                    if (len % 2 !== 0) {
                        throw new RangeError("Buffer size must be a multiple of 16-bits")
                    }
                    for (var i = 0; i < len; i += 2) {
                        swap(this, i, i + 1)
                    }
                    return this
                };
                Buffer.prototype.swap32 = function swap32() {
                    var len = this.length;
                    if (len % 4 !== 0) {
                        throw new RangeError("Buffer size must be a multiple of 32-bits")
                    }
                    for (var i = 0; i < len; i += 4) {
                        swap(this, i, i + 3);
                        swap(this, i + 1, i + 2)
                    }
                    return this
                };
                Buffer.prototype.swap64 = function swap64() {
                    var len = this.length;
                    if (len % 8 !== 0) {
                        throw new RangeError("Buffer size must be a multiple of 64-bits")
                    }
                    for (var i = 0; i < len; i += 8) {
                        swap(this, i, i + 7);
                        swap(this, i + 1, i + 6);
                        swap(this, i + 2, i + 5);
                        swap(this, i + 3, i + 4)
                    }
                    return this
                };
                Buffer.prototype.toString = function toString() {
                    var length = this.length;
                    if (length === 0) return "";
                    if (arguments.length === 0) return utf8Slice(this, 0, length);
                    return slowToString.apply(this, arguments)
                };
                Buffer.prototype.toLocaleString = Buffer.prototype.toString;
                Buffer.prototype.equals = function equals(b) {
                    if (!Buffer.isBuffer(b)) throw new TypeError("Argument must be a Buffer");
                    if (this === b) return true;
                    return Buffer.compare(this, b) === 0
                };
                Buffer.prototype.inspect = function inspect() {
                    var str = "";
                    var max = exports.INSPECT_MAX_BYTES;
                    str = this.toString("hex", 0, max)
                        .replace(/(.{2})/g, "$1 ")
                        .trim();
                    if (this.length > max) str += " ... ";
                    return "<Buffer " + str + ">"
                };
                Buffer.prototype.compare = function compare(target, start, end, thisStart, thisEnd) {
                    if (isInstance(target, Uint8Array)) {
                        target = Buffer.from(target, target.offset, target.byteLength)
                    }
                    if (!Buffer.isBuffer(target)) {
                        throw new TypeError('The "target" argument must be one of type Buffer or Uint8Array. ' + "Received type " + typeof target)
                    }
                    if (start === undefined) {
                        start = 0
                    }
                    if (end === undefined) {
                        end = target ? target.length : 0
                    }
                    if (thisStart === undefined) {
                        thisStart = 0
                    }
                    if (thisEnd === undefined) {
                        thisEnd = this.length
                    }
                    if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
                        throw new RangeError("out of range index")
                    }
                    if (thisStart >= thisEnd && start >= end) {
                        return 0
                    }
                    if (thisStart >= thisEnd) {
                        return -1
                    }
                    if (start >= end) {
                        return 1
                    }
                    start >>>= 0;
                    end >>>= 0;
                    thisStart >>>= 0;
                    thisEnd >>>= 0;
                    if (this === target) return 0;
                    var x = thisEnd - thisStart;
                    var y = end - start;
                    var len = Math.min(x, y);
                    var thisCopy = this.slice(thisStart, thisEnd);
                    var targetCopy = target.slice(start, end);
                    for (var i = 0; i < len; ++i) {
                        if (thisCopy[i] !== targetCopy[i]) {
                            x = thisCopy[i];
                            y = targetCopy[i];
                            break
                        }
                    }
                    if (x < y) return -1;
                    if (y < x) return 1;
                    return 0
                };

                function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
                    if (buffer.length === 0) return -1;
                    if (typeof byteOffset === "string") {
                        encoding = byteOffset;
                        byteOffset = 0
                    } else if (byteOffset > 2147483647) {
                        byteOffset = 2147483647
                    } else if (byteOffset < -2147483648) {
                        byteOffset = -2147483648
                    }
                    byteOffset = +byteOffset;
                    if (numberIsNaN(byteOffset)) {
                        byteOffset = dir ? 0 : buffer.length - 1
                    }
                    if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
                    if (byteOffset >= buffer.length) {
                        if (dir) return -1;
                        else byteOffset = buffer.length - 1
                    } else if (byteOffset < 0) {
                        if (dir) byteOffset = 0;
                        else return -1
                    }
                    if (typeof val === "string") {
                        val = Buffer.from(val, encoding)
                    }
                    if (Buffer.isBuffer(val)) {
                        if (val.length === 0) {
                            return -1
                        }
                        return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
                    } else if (typeof val === "number") {
                        val = val & 255;
                        if (typeof Uint8Array.prototype.indexOf === "function") {
                            if (dir) {
                                return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
                            } else {
                                return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
                            }
                        }
                        return arrayIndexOf(buffer, [val], byteOffset, encoding, dir)
                    }
                    throw new TypeError("val must be string, number or Buffer")
                }

                function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
                    var indexSize = 1;
                    var arrLength = arr.length;
                    var valLength = val.length;
                    if (encoding !== undefined) {
                        encoding = String(encoding)
                            .toLowerCase();
                        if (encoding === "ucs2" || encoding === "ucs-2" || encoding === "utf16le" || encoding === "utf-16le") {
                            if (arr.length < 2 || val.length < 2) {
                                return -1
                            }
                            indexSize = 2;
                            arrLength /= 2;
                            valLength /= 2;
                            byteOffset /= 2
                        }
                    }

                    function read(buf, i) {
                        if (indexSize === 1) {
                            return buf[i]
                        } else {
                            return buf.readUInt16BE(i * indexSize)
                        }
                    }
                    var i;
                    if (dir) {
                        var foundIndex = -1;
                        for (i = byteOffset; i < arrLength; i++) {
                            if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
                                if (foundIndex === -1) foundIndex = i;
                                if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
                            } else {
                                if (foundIndex !== -1) i -= i - foundIndex;
                                foundIndex = -1
                            }
                        }
                    } else {
                        if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
                        for (i = byteOffset; i >= 0; i--) {
                            var found = true;
                            for (var j = 0; j < valLength; j++) {
                                if (read(arr, i + j) !== read(val, j)) {
                                    found = false;
                                    break
                                }
                            }
                            if (found) return i
                        }
                    }
                    return -1
                }
                Buffer.prototype.includes = function includes(val, byteOffset, encoding) {
                    return this.indexOf(val, byteOffset, encoding) !== -1
                };
                Buffer.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
                    return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
                };
                Buffer.prototype.lastIndexOf = function lastIndexOf(val, byteOffset, encoding) {
                    return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
                };

                function hexWrite(buf, string, offset, length) {
                    offset = Number(offset) || 0;
                    var remaining = buf.length - offset;
                    if (!length) {
                        length = remaining
                    } else {
                        length = Number(length);
                        if (length > remaining) {
                            length = remaining
                        }
                    }
                    var strLen = string.length;
                    if (length > strLen / 2) {
                        length = strLen / 2
                    }
                    for (var i = 0; i < length; ++i) {
                        var parsed = parseInt(string.substr(i * 2, 2), 16);
                        if (numberIsNaN(parsed)) return i;
                        buf[offset + i] = parsed
                    }
                    return i
                }

                function utf8Write(buf, string, offset, length) {
                    return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
                }

                function asciiWrite(buf, string, offset, length) {
                    return blitBuffer(asciiToBytes(string), buf, offset, length)
                }

                function latin1Write(buf, string, offset, length) {
                    return asciiWrite(buf, string, offset, length)
                }

                function base64Write(buf, string, offset, length) {
                    return blitBuffer(base64ToBytes(string), buf, offset, length)
                }

                function ucs2Write(buf, string, offset, length) {
                    return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
                }
                Buffer.prototype.write = function write(string, offset, length, encoding) {
                    if (offset === undefined) {
                        encoding = "utf8";
                        length = this.length;
                        offset = 0
                    } else if (length === undefined && typeof offset === "string") {
                        encoding = offset;
                        length = this.length;
                        offset = 0
                    } else if (isFinite(offset)) {
                        offset = offset >>> 0;
                        if (isFinite(length)) {
                            length = length >>> 0;
                            if (encoding === undefined) encoding = "utf8"
                        } else {
                            encoding = length;
                            length = undefined
                        }
                    } else {
                        throw new Error("Buffer.write(string, encoding, offset[, length]) is no longer supported")
                    }
                    var remaining = this.length - offset;
                    if (length === undefined || length > remaining) length = remaining;
                    if (string.length > 0 && (length < 0 || offset < 0) || offset > this.length) {
                        throw new RangeError("Attempt to write outside buffer bounds")
                    }
                    if (!encoding) encoding = "utf8";
                    var loweredCase = false;
                    for (;;) {
                        switch (encoding) {
                            case "hex":
                                return hexWrite(this, string, offset, length);
                            case "utf8":
                            case "utf-8":
                                return utf8Write(this, string, offset, length);
                            case "ascii":
                                return asciiWrite(this, string, offset, length);
                            case "latin1":
                            case "binary":
                                return latin1Write(this, string, offset, length);
                            case "base64":
                                return base64Write(this, string, offset, length);
                            case "ucs2":
                            case "ucs-2":
                            case "utf16le":
                            case "utf-16le":
                                return ucs2Write(this, string, offset, length);
                            default:
                                if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
                                encoding = ("" + encoding)
                                    .toLowerCase();
                                loweredCase = true
                        }
                    }
                };
                Buffer.prototype.toJSON = function toJSON() {
                    return {
                        type: "Buffer",
                        data: Array.prototype.slice.call(this._arr || this, 0)
                    }
                };

                function base64Slice(buf, start, end) {
                    if (start === 0 && end === buf.length) {
                        return base64.fromByteArray(buf)
                    } else {
                        return base64.fromByteArray(buf.slice(start, end))
                    }
                }

                function utf8Slice(buf, start, end) {
                    end = Math.min(buf.length, end);
                    var res = [];
                    var i = start;
                    while (i < end) {
                        var firstByte = buf[i];
                        var codePoint = null;
                        var bytesPerSequence = firstByte > 239 ? 4 : firstByte > 223 ? 3 : firstByte > 191 ? 2 : 1;
                        if (i + bytesPerSequence <= end) {
                            var secondByte, thirdByte, fourthByte, tempCodePoint;
                            switch (bytesPerSequence) {
                                case 1:
                                    if (firstByte < 128) {
                                        codePoint = firstByte
                                    }
                                    break;
                                case 2:
                                    secondByte = buf[i + 1];
                                    if ((secondByte & 192) === 128) {
                                        tempCodePoint = (firstByte & 31) << 6 | secondByte & 63;
                                        if (tempCodePoint > 127) {
                                            codePoint = tempCodePoint
                                        }
                                    }
                                    break;
                                case 3:
                                    secondByte = buf[i + 1];
                                    thirdByte = buf[i + 2];
                                    if ((secondByte & 192) === 128 && (thirdByte & 192) === 128) {
                                        tempCodePoint = (firstByte & 15) << 12 | (secondByte & 63) << 6 | thirdByte & 63;
                                        if (tempCodePoint > 2047 && (tempCodePoint < 55296 || tempCodePoint > 57343)) {
                                            codePoint = tempCodePoint
                                        }
                                    }
                                    break;
                                case 4:
                                    secondByte = buf[i + 1];
                                    thirdByte = buf[i + 2];
                                    fourthByte = buf[i + 3];
                                    if ((secondByte & 192) === 128 && (thirdByte & 192) === 128 && (fourthByte & 192) === 128) {
                                        tempCodePoint = (firstByte & 15) << 18 | (secondByte & 63) << 12 | (thirdByte & 63) << 6 | fourthByte & 63;
                                        if (tempCodePoint > 65535 && tempCodePoint < 1114112) {
                                            codePoint = tempCodePoint
                                        }
                                    }
                            }
                        }
                        if (codePoint === null) {
                            codePoint = 65533;
                            bytesPerSequence = 1
                        } else if (codePoint > 65535) {
                            codePoint -= 65536;
                            res.push(codePoint >>> 10 & 1023 | 55296);
                            codePoint = 56320 | codePoint & 1023
                        }
                        res.push(codePoint);
                        i += bytesPerSequence
                    }
                    return decodeCodePointsArray(res)
                }
                var MAX_ARGUMENTS_LENGTH = 4096;

                function decodeCodePointsArray(codePoints) {
                    var len = codePoints.length;
                    if (len <= MAX_ARGUMENTS_LENGTH) {
                        return String.fromCharCode.apply(String, codePoints)
                    }
                    var res = "";
                    var i = 0;
                    while (i < len) {
                        res += String.fromCharCode.apply(String, codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH))
                    }
                    return res
                }

                function asciiSlice(buf, start, end) {
                    var ret = "";
                    end = Math.min(buf.length, end);
                    for (var i = start; i < end; ++i) {
                        ret += String.fromCharCode(buf[i] & 127)
                    }
                    return ret
                }

                function latin1Slice(buf, start, end) {
                    var ret = "";
                    end = Math.min(buf.length, end);
                    for (var i = start; i < end; ++i) {
                        ret += String.fromCharCode(buf[i])
                    }
                    return ret
                }

                function hexSlice(buf, start, end) {
                    var len = buf.length;
                    if (!start || start < 0) start = 0;
                    if (!end || end < 0 || end > len) end = len;
                    var out = "";
                    for (var i = start; i < end; ++i) {
                        out += toHex(buf[i])
                    }
                    return out
                }

                function utf16leSlice(buf, start, end) {
                    var bytes = buf.slice(start, end);
                    var res = "";
                    for (var i = 0; i < bytes.length; i += 2) {
                        res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
                    }
                    return res
                }
                Buffer.prototype.slice = function slice(start, end) {
                    var len = this.length;
                    start = ~~start;
                    end = end === undefined ? len : ~~end;
                    if (start < 0) {
                        start += len;
                        if (start < 0) start = 0
                    } else if (start > len) {
                        start = len
                    }
                    if (end < 0) {
                        end += len;
                        if (end < 0) end = 0
                    } else if (end > len) {
                        end = len
                    }
                    if (end < start) end = start;
                    var newBuf = this.subarray(start, end);
                    newBuf.__proto__ = Buffer.prototype;
                    return newBuf
                };

                function checkOffset(offset, ext, length) {
                    if (offset % 1 !== 0 || offset < 0) throw new RangeError("offset is not uint");
                    if (offset + ext > length) throw new RangeError("Trying to access beyond buffer length")
                }
                Buffer.prototype.readUIntLE = function readUIntLE(offset, byteLength, noAssert) {
                    offset = offset >>> 0;
                    byteLength = byteLength >>> 0;
                    if (!noAssert) checkOffset(offset, byteLength, this.length);
                    var val = this[offset];
                    var mul = 1;
                    var i = 0;
                    while (++i < byteLength && (mul *= 256)) {
                        val += this[offset + i] * mul
                    }
                    return val
                };
                Buffer.prototype.readUIntBE = function readUIntBE(offset, byteLength, noAssert) {
                    offset = offset >>> 0;
                    byteLength = byteLength >>> 0;
                    if (!noAssert) {
                        checkOffset(offset, byteLength, this.length)
                    }
                    var val = this[offset + --byteLength];
                    var mul = 1;
                    while (byteLength > 0 && (mul *= 256)) {
                        val += this[offset + --byteLength] * mul
                    }
                    return val
                };
                Buffer.prototype.readUInt8 = function readUInt8(offset, noAssert) {
                    offset = offset >>> 0;
                    if (!noAssert) checkOffset(offset, 1, this.length);
                    return this[offset]
                };
                Buffer.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
                    offset = offset >>> 0;
                    if (!noAssert) checkOffset(offset, 2, this.length);
                    return this[offset] | this[offset + 1] << 8
                };
                Buffer.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
                    offset = offset >>> 0;
                    if (!noAssert) checkOffset(offset, 2, this.length);
                    return this[offset] << 8 | this[offset + 1]
                };
                Buffer.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
                    offset = offset >>> 0;
                    if (!noAssert) checkOffset(offset, 4, this.length);
                    return (this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16) + this[offset + 3] * 16777216
                };
                Buffer.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
                    offset = offset >>> 0;
                    if (!noAssert) checkOffset(offset, 4, this.length);
                    return this[offset] * 16777216 + (this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3])
                };
                Buffer.prototype.readIntLE = function readIntLE(offset, byteLength, noAssert) {
                    offset = offset >>> 0;
                    byteLength = byteLength >>> 0;
                    if (!noAssert) checkOffset(offset, byteLength, this.length);
                    var val = this[offset];
                    var mul = 1;
                    var i = 0;
                    while (++i < byteLength && (mul *= 256)) {
                        val += this[offset + i] * mul
                    }
                    mul *= 128;
                    if (val >= mul) val -= Math.pow(2, 8 * byteLength);
                    return val
                };
                Buffer.prototype.readIntBE = function readIntBE(offset, byteLength, noAssert) {
                    offset = offset >>> 0;
                    byteLength = byteLength >>> 0;
                    if (!noAssert) checkOffset(offset, byteLength, this.length);
                    var i = byteLength;
                    var mul = 1;
                    var val = this[offset + --i];
                    while (i > 0 && (mul *= 256)) {
                        val += this[offset + --i] * mul
                    }
                    mul *= 128;
                    if (val >= mul) val -= Math.pow(2, 8 * byteLength);
                    return val
                };
                Buffer.prototype.readInt8 = function readInt8(offset, noAssert) {
                    offset = offset >>> 0;
                    if (!noAssert) checkOffset(offset, 1, this.length);
                    if (!(this[offset] & 128)) return this[offset];
                    return (255 - this[offset] + 1) * -1
                };
                Buffer.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
                    offset = offset >>> 0;
                    if (!noAssert) checkOffset(offset, 2, this.length);
                    var val = this[offset] | this[offset + 1] << 8;
                    return val & 32768 ? val | 4294901760 : val
                };
                Buffer.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
                    offset = offset >>> 0;
                    if (!noAssert) checkOffset(offset, 2, this.length);
                    var val = this[offset + 1] | this[offset] << 8;
                    return val & 32768 ? val | 4294901760 : val
                };
                Buffer.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
                    offset = offset >>> 0;
                    if (!noAssert) checkOffset(offset, 4, this.length);
                    return this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16 | this[offset + 3] << 24
                };
                Buffer.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
                    offset = offset >>> 0;
                    if (!noAssert) checkOffset(offset, 4, this.length);
                    return this[offset] << 24 | this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3]
                };
                Buffer.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
                    offset = offset >>> 0;
                    if (!noAssert) checkOffset(offset, 4, this.length);
                    return ieee754.read(this, offset, true, 23, 4)
                };
                Buffer.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
                    offset = offset >>> 0;
                    if (!noAssert) checkOffset(offset, 4, this.length);
                    return ieee754.read(this, offset, false, 23, 4)
                };
                Buffer.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
                    offset = offset >>> 0;
                    if (!noAssert) checkOffset(offset, 8, this.length);
                    return ieee754.read(this, offset, true, 52, 8)
                };
                Buffer.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
                    offset = offset >>> 0;
                    if (!noAssert) checkOffset(offset, 8, this.length);
                    return ieee754.read(this, offset, false, 52, 8)
                };

                function checkInt(buf, value, offset, ext, max, min) {
                    if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance');
                    if (value > max || value < min) throw new RangeError('"value" argument is out of bounds');
                    if (offset + ext > buf.length) throw new RangeError("Index out of range")
                }
                Buffer.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength, noAssert) {
                    value = +value;
                    offset = offset >>> 0;
                    byteLength = byteLength >>> 0;
                    if (!noAssert) {
                        var maxBytes = Math.pow(2, 8 * byteLength) - 1;
                        checkInt(this, value, offset, byteLength, maxBytes, 0)
                    }
                    var mul = 1;
                    var i = 0;
                    this[offset] = value & 255;
                    while (++i < byteLength && (mul *= 256)) {
                        this[offset + i] = value / mul & 255
                    }
                    return offset + byteLength
                };
                Buffer.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength, noAssert) {
                    value = +value;
                    offset = offset >>> 0;
                    byteLength = byteLength >>> 0;
                    if (!noAssert) {
                        var maxBytes = Math.pow(2, 8 * byteLength) - 1;
                        checkInt(this, value, offset, byteLength, maxBytes, 0)
                    }
                    var i = byteLength - 1;
                    var mul = 1;
                    this[offset + i] = value & 255;
                    while (--i >= 0 && (mul *= 256)) {
                        this[offset + i] = value / mul & 255
                    }
                    return offset + byteLength
                };
                Buffer.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
                    value = +value;
                    offset = offset >>> 0;
                    if (!noAssert) checkInt(this, value, offset, 1, 255, 0);
                    this[offset] = value & 255;
                    return offset + 1
                };
                Buffer.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
                    value = +value;
                    offset = offset >>> 0;
                    if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
                    this[offset] = value & 255;
                    this[offset + 1] = value >>> 8;
                    return offset + 2
                };
                Buffer.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
                    value = +value;
                    offset = offset >>> 0;
                    if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
                    this[offset] = value >>> 8;
                    this[offset + 1] = value & 255;
                    return offset + 2
                };
                Buffer.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
                    value = +value;
                    offset = offset >>> 0;
                    if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
                    this[offset + 3] = value >>> 24;
                    this[offset + 2] = value >>> 16;
                    this[offset + 1] = value >>> 8;
                    this[offset] = value & 255;
                    return offset + 4
                };
                Buffer.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
                    value = +value;
                    offset = offset >>> 0;
                    if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
                    this[offset] = value >>> 24;
                    this[offset + 1] = value >>> 16;
                    this[offset + 2] = value >>> 8;
                    this[offset + 3] = value & 255;
                    return offset + 4
                };
                Buffer.prototype.writeIntLE = function writeIntLE(value, offset, byteLength, noAssert) {
                    value = +value;
                    offset = offset >>> 0;
                    if (!noAssert) {
                        var limit = Math.pow(2, 8 * byteLength - 1);
                        checkInt(this, value, offset, byteLength, limit - 1, -limit)
                    }
                    var i = 0;
                    var mul = 1;
                    var sub = 0;
                    this[offset] = value & 255;
                    while (++i < byteLength && (mul *= 256)) {
                        if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
                            sub = 1
                        }
                        this[offset + i] = (value / mul >> 0) - sub & 255
                    }
                    return offset + byteLength
                };
                Buffer.prototype.writeIntBE = function writeIntBE(value, offset, byteLength, noAssert) {
                    value = +value;
                    offset = offset >>> 0;
                    if (!noAssert) {
                        var limit = Math.pow(2, 8 * byteLength - 1);
                        checkInt(this, value, offset, byteLength, limit - 1, -limit)
                    }
                    var i = byteLength - 1;
                    var mul = 1;
                    var sub = 0;
                    this[offset + i] = value & 255;
                    while (--i >= 0 && (mul *= 256)) {
                        if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
                            sub = 1
                        }
                        this[offset + i] = (value / mul >> 0) - sub & 255
                    }
                    return offset + byteLength
                };
                Buffer.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
                    value = +value;
                    offset = offset >>> 0;
                    if (!noAssert) checkInt(this, value, offset, 1, 127, -128);
                    if (value < 0) value = 255 + value + 1;
                    this[offset] = value & 255;
                    return offset + 1
                };
                Buffer.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
                    value = +value;
                    offset = offset >>> 0;
                    if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
                    this[offset] = value & 255;
                    this[offset + 1] = value >>> 8;
                    return offset + 2
                };
                Buffer.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
                    value = +value;
                    offset = offset >>> 0;
                    if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
                    this[offset] = value >>> 8;
                    this[offset + 1] = value & 255;
                    return offset + 2
                };
                Buffer.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
                    value = +value;
                    offset = offset >>> 0;
                    if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
                    this[offset] = value & 255;
                    this[offset + 1] = value >>> 8;
                    this[offset + 2] = value >>> 16;
                    this[offset + 3] = value >>> 24;
                    return offset + 4
                };
                Buffer.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
                    value = +value;
                    offset = offset >>> 0;
                    if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
                    if (value < 0) value = 4294967295 + value + 1;
                    this[offset] = value >>> 24;
                    this[offset + 1] = value >>> 16;
                    this[offset + 2] = value >>> 8;
                    this[offset + 3] = value & 255;
                    return offset + 4
                };

                function checkIEEE754(buf, value, offset, ext, max, min) {
                    if (offset + ext > buf.length) throw new RangeError("Index out of range");
                    if (offset < 0) throw new RangeError("Index out of range")
                }

                function writeFloat(buf, value, offset, littleEndian, noAssert) {
                    value = +value;
                    offset = offset >>> 0;
                    if (!noAssert) {
                        checkIEEE754(buf, value, offset, 4, 34028234663852886e22, -34028234663852886e22)
                    }
                    ieee754.write(buf, value, offset, littleEndian, 23, 4);
                    return offset + 4
                }
                Buffer.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
                    return writeFloat(this, value, offset, true, noAssert)
                };
                Buffer.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
                    return writeFloat(this, value, offset, false, noAssert)
                };

                function writeDouble(buf, value, offset, littleEndian, noAssert) {
                    value = +value;
                    offset = offset >>> 0;
                    if (!noAssert) {
                        checkIEEE754(buf, value, offset, 8, 17976931348623157e292, -17976931348623157e292)
                    }
                    ieee754.write(buf, value, offset, littleEndian, 52, 8);
                    return offset + 8
                }
                Buffer.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
                    return writeDouble(this, value, offset, true, noAssert)
                };
                Buffer.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
                    return writeDouble(this, value, offset, false, noAssert)
                };
                Buffer.prototype.copy = function copy(target, targetStart, start, end) {
                    if (!Buffer.isBuffer(target)) throw new TypeError("argument should be a Buffer");
                    if (!start) start = 0;
                    if (!end && end !== 0) end = this.length;
                    if (targetStart >= target.length) targetStart = target.length;
                    if (!targetStart) targetStart = 0;
                    if (end > 0 && end < start) end = start;
                    if (end === start) return 0;
                    if (target.length === 0 || this.length === 0) return 0;
                    if (targetStart < 0) {
                        throw new RangeError("targetStart out of bounds")
                    }
                    if (start < 0 || start >= this.length) throw new RangeError("Index out of range");
                    if (end < 0) throw new RangeError("sourceEnd out of bounds");
                    if (end > this.length) end = this.length;
                    if (target.length - targetStart < end - start) {
                        end = target.length - targetStart + start
                    }
                    var len = end - start;
                    if (this === target && typeof Uint8Array.prototype.copyWithin === "function") {
                        this.copyWithin(targetStart, start, end)
                    } else if (this === target && start < targetStart && targetStart < end) {
                        for (var i = len - 1; i >= 0; --i) {
                            target[i + targetStart] = this[i + start]
                        }
                    } else {
                        Uint8Array.prototype.set.call(target, this.subarray(start, end), targetStart)
                    }
                    return len
                };
                Buffer.prototype.fill = function fill(val, start, end, encoding) {
                    if (typeof val === "string") {
                        if (typeof start === "string") {
                            encoding = start;
                            start = 0;
                            end = this.length
                        } else if (typeof end === "string") {
                            encoding = end;
                            end = this.length
                        }
                        if (encoding !== undefined && typeof encoding !== "string") {
                            throw new TypeError("encoding must be a string")
                        }
                        if (typeof encoding === "string" && !Buffer.isEncoding(encoding)) {
                            throw new TypeError("Unknown encoding: " + encoding)
                        }
                        if (val.length === 1) {
                            var code = val.charCodeAt(0);
                            if (encoding === "utf8" && code < 128 || encoding === "latin1") {
                                val = code
                            }
                        }
                    } else if (typeof val === "number") {
                        val = val & 255
                    }
                    if (start < 0 || this.length < start || this.length < end) {
                        throw new RangeError("Out of range index")
                    }
                    if (end <= start) {
                        return this
                    }
                    start = start >>> 0;
                    end = end === undefined ? this.length : end >>> 0;
                    if (!val) val = 0;
                    var i;
                    if (typeof val === "number") {
                        for (i = start; i < end; ++i) {
                            this[i] = val
                        }
                    } else {
                        var bytes = Buffer.isBuffer(val) ? val : Buffer.from(val, encoding);
                        var len = bytes.length;
                        if (len === 0) {
                            throw new TypeError('The value "' + val + '" is invalid for argument "value"')
                        }
                        for (i = 0; i < end - start; ++i) {
                            this[i + start] = bytes[i % len]
                        }
                    }
                    return this
                };
                var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;

                function base64clean(str) {
                    str = str.split("=")[0];
                    str = str.trim()
                        .replace(INVALID_BASE64_RE, "");
                    if (str.length < 2) return "";
                    while (str.length % 4 !== 0) {
                        str = str + "="
                    }
                    return str
                }

                function toHex(n) {
                    if (n < 16) return "0" + n.toString(16);
                    return n.toString(16)
                }

                function utf8ToBytes(string, units) {
                    units = units || Infinity;
                    var codePoint;
                    var length = string.length;
                    var leadSurrogate = null;
                    var bytes = [];
                    for (var i = 0; i < length; ++i) {
                        codePoint = string.charCodeAt(i);
                        if (codePoint > 55295 && codePoint < 57344) {
                            if (!leadSurrogate) {
                                if (codePoint > 56319) {
                                    if ((units -= 3) > -1) bytes.push(239, 191, 189);
                                    continue
                                } else if (i + 1 === length) {
                                    if ((units -= 3) > -1) bytes.push(239, 191, 189);
                                    continue
                                }
                                leadSurrogate = codePoint;
                                continue
                            }
                            if (codePoint < 56320) {
                                if ((units -= 3) > -1) bytes.push(239, 191, 189);
                                leadSurrogate = codePoint;
                                continue
                            }
                            codePoint = (leadSurrogate - 55296 << 10 | codePoint - 56320) + 65536
                        } else if (leadSurrogate) {
                            if ((units -= 3) > -1) bytes.push(239, 191, 189)
                        }
                        leadSurrogate = null;
                        if (codePoint < 128) {
                            if ((units -= 1) < 0) break;
                            bytes.push(codePoint)
                        } else if (codePoint < 2048) {
                            if ((units -= 2) < 0) break;
                            bytes.push(codePoint >> 6 | 192, codePoint & 63 | 128)
                        } else if (codePoint < 65536) {
                            if ((units -= 3) < 0) break;
                            bytes.push(codePoint >> 12 | 224, codePoint >> 6 & 63 | 128, codePoint & 63 | 128)
                        } else if (codePoint < 1114112) {
                            if ((units -= 4) < 0) break;
                            bytes.push(codePoint >> 18 | 240, codePoint >> 12 & 63 | 128, codePoint >> 6 & 63 | 128, codePoint & 63 | 128)
                        } else {
                            throw new Error("Invalid code point")
                        }
                    }
                    return bytes
                }

                function asciiToBytes(str) {
                    var byteArray = [];
                    for (var i = 0; i < str.length; ++i) {
                        byteArray.push(str.charCodeAt(i) & 255)
                    }
                    return byteArray
                }

                function utf16leToBytes(str, units) {
                    var c, hi, lo;
                    var byteArray = [];
                    for (var i = 0; i < str.length; ++i) {
                        if ((units -= 2) < 0) break;
                        c = str.charCodeAt(i);
                        hi = c >> 8;
                        lo = c % 256;
                        byteArray.push(lo);
                        byteArray.push(hi)
                    }
                    return byteArray
                }

                function base64ToBytes(str) {
                    return base64.toByteArray(base64clean(str))
                }

                function blitBuffer(src, dst, offset, length) {
                    for (var i = 0; i < length; ++i) {
                        if (i + offset >= dst.length || i >= src.length) break;
                        dst[i + offset] = src[i]
                    }
                    return i
                }

                function isInstance(obj, type) {
                    return obj instanceof type || obj != null && obj.constructor != null && obj.constructor.name != null && obj.constructor.name === type.name
                }

                function numberIsNaN(obj) {
                    return obj !== obj
                }
            })
            .call(this, require("buffer")
                .Buffer)
        }, {
            "base64-js": 3,
            buffer: 5,
            ieee754: 35
        }],
        6: [function(require, module, exports) {
            var ElementType = require("domelementtype");
            var entities = require("entities");
            var unencodedElements = {
                __proto__: null,
                style: true,
                script: true,
                xmp: true,
                iframe: true,
                noembed: true,
                noframes: true,
                plaintext: true,
                noscript: true
            };

            function formatAttrs(attributes, opts) {
                if (!attributes) return;
                var output = "",
                    value;
                for (var key in attributes) {
                    value = attributes[key];
                    if (output) {
                        output += " "
                    }
                    output += key;
                    if (value !== null && value !== "" || opts.xmlMode) {
                        output += '="' + (opts.decodeEntities ? entities.encodeXML(value) : value) + '"'
                    }
                }
                return output
            }
            var singleTag = {
                __proto__: null,
                area: true,
                base: true,
                basefont: true,
                br: true,
                col: true,
                command: true,
                embed: true,
                frame: true,
                hr: true,
                img: true,
                input: true,
                isindex: true,
                keygen: true,
                link: true,
                meta: true,
                param: true,
                source: true,
                track: true,
                wbr: true
            };
            var render = module.exports = function(dom, opts) {
                if (!Array.isArray(dom) && !dom.cheerio) dom = [dom];
                opts = opts || {};
                var output = "";
                for (var i = 0; i < dom.length; i++) {
                    var elem = dom[i];
                    if (elem.type === "root") output += render(elem.children, opts);
                    else if (ElementType.isTag(elem)) output += renderTag(elem, opts);
                    else if (elem.type === ElementType.Directive) output += renderDirective(elem);
                    else if (elem.type === ElementType.Comment) output += renderComment(elem);
                    else if (elem.type === ElementType.CDATA) output += renderCdata(elem);
                    else output += renderText(elem, opts)
                }
                return output
            };

            function renderTag(elem, opts) {
                if (elem.name === "svg") opts = {
                    decodeEntities: opts.decodeEntities,
                    xmlMode: true
                };
                var tag = "<" + elem.name,
                    attribs = formatAttrs(elem.attribs, opts);
                if (attribs) {
                    tag += " " + attribs
                }
                if (opts.xmlMode && (!elem.children || elem.children.length === 0)) {
                    tag += "/>"
                } else {
                    tag += ">";
                    if (elem.children) {
                        tag += render(elem.children, opts)
                    }
                    if (!singleTag[elem.name] || opts.xmlMode) {
                        tag += "</" + elem.name + ">"
                    }
                }
                return tag
            }

            function renderDirective(elem) {
                return "<" + elem.data + ">"
            }

            function renderText(elem, opts) {
                var data = elem.data || "";
                if (opts.decodeEntities && !(elem.parent && elem.parent.name in unencodedElements)) {
                    data = entities.encodeXML(data)
                }
                return data
            }

            function renderCdata(elem) {
                return "<![CDATA[" + elem.children[0].data + "]]>"
            }

            function renderComment(elem) {
                return "\x3c!--" + elem.data + "--\x3e"
            }
        }, {
            domelementtype: 7,
            entities: 18
        }],
        7: [function(require, module, exports) {
            module.exports = {
                Text: "text",
                Directive: "directive",
                Comment: "comment",
                Script: "script",
                Style: "style",
                Tag: "tag",
                CDATA: "cdata",
                Doctype: "doctype",
                isTag: function(elem) {
                    return elem.type === "tag" || elem.type === "script" || elem.type === "style"
                }
            }
        }, {}],
        8: [function(require, module, exports) {
            var ElementType = require("domelementtype");
            var re_whitespace = /\s+/g;
            var NodePrototype = require("./lib/node");
            var ElementPrototype = require("./lib/element");

            function DomHandler(callback, options, elementCB) {
                if (typeof callback === "object") {
                    elementCB = options;
                    options = callback;
                    callback = null
                } else if (typeof options === "function") {
                    elementCB = options;
                    options = defaultOpts
                }
                this._callback = callback;
                this._options = options || defaultOpts;
                this._elementCB = elementCB;
                this.dom = [];
                this._done = false;
                this._tagStack = [];
                this._parser = this._parser || null
            }
            var defaultOpts = {
                normalizeWhitespace: false,
                withStartIndices: false,
                withEndIndices: false
            };
            DomHandler.prototype.onparserinit = function(parser) {
                this._parser = parser
            };
            DomHandler.prototype.onreset = function() {
                DomHandler.call(this, this._callback, this._options, this._elementCB)
            };
            DomHandler.prototype.onend = function() {
                if (this._done) return;
                this._done = true;
                this._parser = null;
                this._handleCallback(null)
            };
            DomHandler.prototype._handleCallback = DomHandler.prototype.onerror = function(error) {
                if (typeof this._callback === "function") {
                    this._callback(error, this.dom)
                } else {
                    if (error) throw error
                }
            };
            DomHandler.prototype.onclosetag = function() {
                var elem = this._tagStack.pop();
                if (this._options.withEndIndices && elem) {
                    elem.endIndex = this._parser.endIndex
                }
                if (this._elementCB) this._elementCB(elem)
            };
            DomHandler.prototype._createDomElement = function(properties) {
                if (!this._options.withDomLvl1) return properties;
                var element;
                if (properties.type === "tag") {
                    element = Object.create(ElementPrototype)
                } else {
                    element = Object.create(NodePrototype)
                }
                for (var key in properties) {
                    if (properties.hasOwnProperty(key)) {
                        element[key] = properties[key]
                    }
                }
                return element
            };
            DomHandler.prototype._addDomElement = function(element) {
                var parent = this._tagStack[this._tagStack.length - 1];
                var siblings = parent ? parent.children : this.dom;
                var previousSibling = siblings[siblings.length - 1];
                element.next = null;
                if (this._options.withStartIndices) {
                    element.startIndex = this._parser.startIndex
                }
                if (this._options.withEndIndices) {
                    element.endIndex = this._parser.endIndex
                }
                if (previousSibling) {
                    element.prev = previousSibling;
                    previousSibling.next = element
                } else {
                    element.prev = null
                }
                siblings.push(element);
                element.parent = parent || null
            };
            DomHandler.prototype.onopentag = function(name, attribs) {
                var properties = {
                    type: name === "script" ? ElementType.Script : name === "style" ? ElementType.Style : ElementType.Tag,
                    name: name,
                    attribs: attribs,
                    children: []
                };
                var element = this._createDomElement(properties);
                this._addDomElement(element);
                this._tagStack.push(element)
            };
            DomHandler.prototype.ontext = function(data) {
                var normalize = this._options.normalizeWhitespace || this._options.ignoreWhitespace;
                var lastTag;
                if (!this._tagStack.length && this.dom.length && (lastTag = this.dom[this.dom.length - 1])
                    .type === ElementType.Text) {
                    if (normalize) {
                        lastTag.data = (lastTag.data + data)
                            .replace(re_whitespace, " ")
                    } else {
                        lastTag.data += data
                    }
                } else {
                    if (this._tagStack.length && (lastTag = this._tagStack[this._tagStack.length - 1]) && (lastTag = lastTag.children[lastTag.children.length - 1]) && lastTag.type === ElementType.Text) {
                        if (normalize) {
                            lastTag.data = (lastTag.data + data)
                                .replace(re_whitespace, " ")
                        } else {
                            lastTag.data += data
                        }
                    } else {
                        if (normalize) {
                            data = data.replace(re_whitespace, " ")
                        }
                        var element = this._createDomElement({
                            data: data,
                            type: ElementType.Text
                        });
                        this._addDomElement(element)
                    }
                }
            };
            DomHandler.prototype.oncomment = function(data) {
                var lastTag = this._tagStack[this._tagStack.length - 1];
                if (lastTag && lastTag.type === ElementType.Comment) {
                    lastTag.data += data;
                    return
                }
                var properties = {
                    data: data,
                    type: ElementType.Comment
                };
                var element = this._createDomElement(properties);
                this._addDomElement(element);
                this._tagStack.push(element)
            };
            DomHandler.prototype.oncdatastart = function() {
                var properties = {
                    children: [{
                        data: "",
                        type: ElementType.Text
                    }],
                    type: ElementType.CDATA
                };
                var element = this._createDomElement(properties);
                this._addDomElement(element);
                this._tagStack.push(element)
            };
            DomHandler.prototype.oncommentend = DomHandler.prototype.oncdataend = function() {
                this._tagStack.pop()
            };
            DomHandler.prototype.onprocessinginstruction = function(name, data) {
                var element = this._createDomElement({
                    name: name,
                    data: data,
                    type: ElementType.Directive
                });
                this._addDomElement(element)
            };
            module.exports = DomHandler
        }, {
            "./lib/element": 9,
            "./lib/node": 10,
            domelementtype: 7
        }],
        9: [function(require, module, exports) {
            var NodePrototype = require("./node");
            var ElementPrototype = module.exports = Object.create(NodePrototype);
            var domLvl1 = {
                tagName: "name"
            };
            Object.keys(domLvl1)
                .forEach(function(key) {
                    var shorthand = domLvl1[key];
                    Object.defineProperty(ElementPrototype, key, {
                        get: function() {
                            return this[shorthand] || null
                        },
                        set: function(val) {
                            this[shorthand] = val;
                            return val
                        }
                    })
                })
        }, {
            "./node": 10
        }],
        10: [function(require, module, exports) {
            var NodePrototype = module.exports = {
                get firstChild() {
                    var children = this.children;
                    return children && children[0] || null
                },
                get lastChild() {
                    var children = this.children;
                    return children && children[children.length - 1] || null
                },
                get nodeType() {
                    return nodeTypes[this.type] || nodeTypes.element
                }
            };
            var domLvl1 = {
                tagName: "name",
                childNodes: "children",
                parentNode: "parent",
                previousSibling: "prev",
                nextSibling: "next",
                nodeValue: "data"
            };
            var nodeTypes = {
                element: 1,
                text: 3,
                cdata: 4,
                comment: 8
            };
            Object.keys(domLvl1)
                .forEach(function(key) {
                    var shorthand = domLvl1[key];
                    Object.defineProperty(NodePrototype, key, {
                        get: function() {
                            return this[shorthand] || null
                        },
                        set: function(val) {
                            this[shorthand] = val;
                            return val
                        }
                    })
                })
        }, {}],
        11: [function(require, module, exports) {
            var DomUtils = module.exports;
            [require("./lib/stringify"), require("./lib/traversal"), require("./lib/manipulation"), require("./lib/querying"), require("./lib/legacy"), require("./lib/helpers")].forEach(function(ext) {
                Object.keys(ext)
                    .forEach(function(key) {
                        DomUtils[key] = ext[key].bind(DomUtils)
                    })
            })
        }, {
            "./lib/helpers": 12,
            "./lib/legacy": 13,
            "./lib/manipulation": 14,
            "./lib/querying": 15,
            "./lib/stringify": 16,
            "./lib/traversal": 17
        }],
        12: [function(require, module, exports) {
            exports.removeSubsets = function(nodes) {
                var idx = nodes.length,
                    node, ancestor, replace;
                while (--idx > -1) {
                    node = ancestor = nodes[idx];
                    nodes[idx] = null;
                    replace = true;
                    while (ancestor) {
                        if (nodes.indexOf(ancestor) > -1) {
                            replace = false;
                            nodes.splice(idx, 1);
                            break
                        }
                        ancestor = ancestor.parent
                    }
                    if (replace) {
                        nodes[idx] = node
                    }
                }
                return nodes
            };
            var POSITION = {
                DISCONNECTED: 1,
                PRECEDING: 2,
                FOLLOWING: 4,
                CONTAINS: 8,
                CONTAINED_BY: 16
            };
            var comparePos = exports.compareDocumentPosition = function(nodeA, nodeB) {
                var aParents = [];
                var bParents = [];
                var current, sharedParent, siblings, aSibling, bSibling, idx;
                if (nodeA === nodeB) {
                    return 0
                }
                current = nodeA;
                while (current) {
                    aParents.unshift(current);
                    current = current.parent
                }
                current = nodeB;
                while (current) {
                    bParents.unshift(current);
                    current = current.parent
                }
                idx = 0;
                while (aParents[idx] === bParents[idx]) {
                    idx++
                }
                if (idx === 0) {
                    return POSITION.DISCONNECTED
                }
                sharedParent = aParents[idx - 1];
                siblings = sharedParent.children;
                aSibling = aParents[idx];
                bSibling = bParents[idx];
                if (siblings.indexOf(aSibling) > siblings.indexOf(bSibling)) {
                    if (sharedParent === nodeB) {
                        return POSITION.FOLLOWING | POSITION.CONTAINED_BY
                    }
                    return POSITION.FOLLOWING
                } else {
                    if (sharedParent === nodeA) {
                        return POSITION.PRECEDING | POSITION.CONTAINS
                    }
                    return POSITION.PRECEDING
                }
            };
            exports.uniqueSort = function(nodes) {
                var idx = nodes.length,
                    node, position;
                nodes = nodes.slice();
                while (--idx > -1) {
                    node = nodes[idx];
                    position = nodes.indexOf(node);
                    if (position > -1 && position < idx) {
                        nodes.splice(idx, 1)
                    }
                }
                nodes.sort(function(a, b) {
                    var relative = comparePos(a, b);
                    if (relative & POSITION.PRECEDING) {
                        return -1
                    } else if (relative & POSITION.FOLLOWING) {
                        return 1
                    }
                    return 0
                });
                return nodes
            }
        }, {}],
        13: [function(require, module, exports) {
            var ElementType = require("domelementtype");
            var isTag = exports.isTag = ElementType.isTag;
            exports.testElement = function(options, element) {
                for (var key in options) {
                    if (!options.hasOwnProperty(key));
                    else if (key === "tag_name") {
                        if (!isTag(element) || !options.tag_name(element.name)) {
                            return false
                        }
                    } else if (key === "tag_type") {
                        if (!options.tag_type(element.type)) return false
                    } else if (key === "tag_contains") {
                        if (isTag(element) || !options.tag_contains(element.data)) {
                            return false
                        }
                    } else if (!element.attribs || !options[key](element.attribs[key])) {
                        return false
                    }
                }
                return true
            };
            var Checks = {
                tag_name: function(name) {
                    if (typeof name === "function") {
                        return function(elem) {
                            return isTag(elem) && name(elem.name)
                        }
                    } else if (name === "*") {
                        return isTag
                    } else {
                        return function(elem) {
                            return isTag(elem) && elem.name === name
                        }
                    }
                },
                tag_type: function(type) {
                    if (typeof type === "function") {
                        return function(elem) {
                            return type(elem.type)
                        }
                    } else {
                        return function(elem) {
                            return elem.type === type
                        }
                    }
                },
                tag_contains: function(data) {
                    if (typeof data === "function") {
                        return function(elem) {
                            return !isTag(elem) && data(elem.data)
                        }
                    } else {
                        return function(elem) {
                            return !isTag(elem) && elem.data === data
                        }
                    }
                }
            };

            function getAttribCheck(attrib, value) {
                if (typeof value === "function") {
                    return function(elem) {
                        return elem.attribs && value(elem.attribs[attrib])
                    }
                } else {
                    return function(elem) {
                        return elem.attribs && elem.attribs[attrib] === value
                    }
                }
            }

            function combineFuncs(a, b) {
                return function(elem) {
                    return a(elem) || b(elem)
                }
            }
            exports.getElements = function(options, element, recurse, limit) {
                var funcs = Object.keys(options)
                    .map(function(key) {
                        var value = options[key];
                        return key in Checks ? Checks[key](value) : getAttribCheck(key, value)
                    });
                return funcs.length === 0 ? [] : this.filter(funcs.reduce(combineFuncs), element, recurse, limit)
            };
            exports.getElementById = function(id, element, recurse) {
                if (!Array.isArray(element)) element = [element];
                return this.findOne(getAttribCheck("id", id), element, recurse !== false)
            };
            exports.getElementsByTagName = function(name, element, recurse, limit) {
                return this.filter(Checks.tag_name(name), element, recurse, limit)
            };
            exports.getElementsByTagType = function(type, element, recurse, limit) {
                return this.filter(Checks.tag_type(type), element, recurse, limit)
            }
        }, {
            domelementtype: 7
        }],
        14: [function(require, module, exports) {
            exports.removeElement = function(elem) {
                if (elem.prev) elem.prev.next = elem.next;
                if (elem.next) elem.next.prev = elem.prev;
                if (elem.parent) {
                    var childs = elem.parent.children;
                    childs.splice(childs.lastIndexOf(elem), 1)
                }
            };
            exports.replaceElement = function(elem, replacement) {
                var prev = replacement.prev = elem.prev;
                if (prev) {
                    prev.next = replacement
                }
                var next = replacement.next = elem.next;
                if (next) {
                    next.prev = replacement
                }
                var parent = replacement.parent = elem.parent;
                if (parent) {
                    var childs = parent.children;
                    childs[childs.lastIndexOf(elem)] = replacement
                }
            };
            exports.appendChild = function(elem, child) {
                child.parent = elem;
                if (elem.children.push(child) !== 1) {
                    var sibling = elem.children[elem.children.length - 2];
                    sibling.next = child;
                    child.prev = sibling;
                    child.next = null
                }
            };
            exports.append = function(elem, next) {
                var parent = elem.parent,
                    currNext = elem.next;
                next.next = currNext;
                next.prev = elem;
                elem.next = next;
                next.parent = parent;
                if (currNext) {
                    currNext.prev = next;
                    if (parent) {
                        var childs = parent.children;
                        childs.splice(childs.lastIndexOf(currNext), 0, next)
                    }
                } else if (parent) {
                    parent.children.push(next)
                }
            };
            exports.prepend = function(elem, prev) {
                var parent = elem.parent;
                if (parent) {
                    var childs = parent.children;
                    childs.splice(childs.lastIndexOf(elem), 0, prev)
                }
                if (elem.prev) {
                    elem.prev.next = prev
                }
                prev.parent = parent;
                prev.prev = elem.prev;
                prev.next = elem;
                elem.prev = prev
            }
        }, {}],
        15: [function(require, module, exports) {
            var isTag = require("domelementtype")
                .isTag;
            module.exports = {
                filter: filter,
                find: find,
                findOneChild: findOneChild,
                findOne: findOne,
                existsOne: existsOne,
                findAll: findAll
            };

            function filter(test, element, recurse, limit) {
                if (!Array.isArray(element)) element = [element];
                if (typeof limit !== "number" || !isFinite(limit)) {
                    limit = Infinity
                }
                return find(test, element, recurse !== false, limit)
            }

            function find(test, elems, recurse, limit) {
                var result = [],
                    childs;
                for (var i = 0, j = elems.length; i < j; i++) {
                    if (test(elems[i])) {
                        result.push(elems[i]);
                        if (--limit <= 0) break
                    }
                    childs = elems[i].children;
                    if (recurse && childs && childs.length > 0) {
                        childs = find(test, childs, recurse, limit);
                        result = result.concat(childs);
                        limit -= childs.length;
                        if (limit <= 0) break
                    }
                }
                return result
            }

            function findOneChild(test, elems) {
                for (var i = 0, l = elems.length; i < l; i++) {
                    if (test(elems[i])) return elems[i]
                }
                return null
            }

            function findOne(test, elems) {
                var elem = null;
                for (var i = 0, l = elems.length; i < l && !elem; i++) {
                    if (!isTag(elems[i])) {
                        continue
                    } else if (test(elems[i])) {
                        elem = elems[i]
                    } else if (elems[i].children.length > 0) {
                        elem = findOne(test, elems[i].children)
                    }
                }
                return elem
            }

            function existsOne(test, elems) {
                for (var i = 0, l = elems.length; i < l; i++) {
                    if (isTag(elems[i]) && (test(elems[i]) || elems[i].children.length > 0 && existsOne(test, elems[i].children))) {
                        return true
                    }
                }
                return false
            }

            function findAll(test, rootElems) {
                var result = [];
                var stack = rootElems.slice();
                while (stack.length) {
                    var elem = stack.shift();
                    if (!isTag(elem)) continue;
                    if (elem.children && elem.children.length > 0) {
                        stack.unshift.apply(stack, elem.children)
                    }
                    if (test(elem)) result.push(elem)
                }
                return result
            }
        }, {
            domelementtype: 7
        }],
        16: [function(require, module, exports) {
            var ElementType = require("domelementtype"),
                getOuterHTML = require("dom-serializer"),
                isTag = ElementType.isTag;
            module.exports = {
                getInnerHTML: getInnerHTML,
                getOuterHTML: getOuterHTML,
                getText: getText
            };

            function getInnerHTML(elem, opts) {
                return elem.children ? elem.children.map(function(elem) {
                        return getOuterHTML(elem, opts)
                    })
                    .join("") : ""
            }

            function getText(elem) {
                if (Array.isArray(elem)) return elem.map(getText)
                    .join("");
                if (isTag(elem)) return elem.name === "br" ? "\n" : getText(elem.children);
                if (elem.type === ElementType.CDATA) return getText(elem.children);
                if (elem.type === ElementType.Text) return elem.data;
                return ""
            }
        }, {
            "dom-serializer": 6,
            domelementtype: 7
        }],
        17: [function(require, module, exports) {
            var getChildren = exports.getChildren = function(elem) {
                return elem.children
            };
            var getParent = exports.getParent = function(elem) {
                return elem.parent
            };
            exports.getSiblings = function(elem) {
                var parent = getParent(elem);
                return parent ? getChildren(parent) : [elem]
            };
            exports.getAttributeValue = function(elem, name) {
                return elem.attribs && elem.attribs[name]
            };
            exports.hasAttrib = function(elem, name) {
                return !!elem.attribs && hasOwnProperty.call(elem.attribs, name)
            };
            exports.getName = function(elem) {
                return elem.name
            }
        }, {}],
        18: [function(require, module, exports) {
            var encode = require("./lib/encode.js"),
                decode = require("./lib/decode.js");
            exports.decode = function(data, level) {
                return (!level || level <= 0 ? decode.XML : decode.HTML)(data)
            };
            exports.decodeStrict = function(data, level) {
                return (!level || level <= 0 ? decode.XML : decode.HTMLStrict)(data)
            };
            exports.encode = function(data, level) {
                return (!level || level <= 0 ? encode.XML : encode.HTML)(data)
            };
            exports.encodeXML = encode.XML;
            exports.encodeHTML4 = exports.encodeHTML5 = exports.encodeHTML = encode.HTML;
            exports.decodeXML = exports.decodeXMLStrict = decode.XML;
            exports.decodeHTML4 = exports.decodeHTML5 = exports.decodeHTML = decode.HTML;
            exports.decodeHTML4Strict = exports.decodeHTML5Strict = exports.decodeHTMLStrict = decode.HTMLStrict;
            exports.escape = encode.escape
        }, {
            "./lib/decode.js": 19,
            "./lib/encode.js": 21
        }],
        19: [function(require, module, exports) {
            var entityMap = require("../maps/entities.json"),
                legacyMap = require("../maps/legacy.json"),
                xmlMap = require("../maps/xml.json"),
                decodeCodePoint = require("./decode_codepoint.js");
            var decodeXMLStrict = getStrictDecoder(xmlMap),
                decodeHTMLStrict = getStrictDecoder(entityMap);

            function getStrictDecoder(map) {
                var keys = Object.keys(map)
                    .join("|"),
                    replace = getReplacer(map);
                keys += "|#[xX][\\da-fA-F]+|#\\d+";
                var re = new RegExp("&(?:" + keys + ");", "g");
                return function(str) {
                    return String(str)
                        .replace(re, replace)
                }
            }
            var decodeHTML = function() {
                var legacy = Object.keys(legacyMap)
                    .sort(sorter);
                var keys = Object.keys(entityMap)
                    .sort(sorter);
                for (var i = 0, j = 0; i < keys.length; i++) {
                    if (legacy[j] === keys[i]) {
                        keys[i] += ";?";
                        j++
                    } else {
                        keys[i] += ";"
                    }
                }
                var re = new RegExp("&(?:" + keys.join("|") + "|#[xX][\\da-fA-F]+;?|#\\d+;?)", "g"),
                    replace = getReplacer(entityMap);

                function replacer(str) {
                    if (str.substr(-1) !== ";") str += ";";
                    return replace(str)
                }
                return function(str) {
                    return String(str)
                        .replace(re, replacer)
                }
            }();

            function sorter(a, b) {
                return a < b ? 1 : -1
            }

            function getReplacer(map) {
                return function replace(str) {
                    if (str.charAt(1) === "#") {
                        if (str.charAt(2) === "X" || str.charAt(2) === "x") {
                            return decodeCodePoint(parseInt(str.substr(3), 16))
                        }
                        return decodeCodePoint(parseInt(str.substr(2), 10))
                    }
                    return map[str.slice(1, -1)]
                }
            }
            module.exports = {
                XML: decodeXMLStrict,
                HTML: decodeHTML,
                HTMLStrict: decodeHTMLStrict
            }
        }, {
            "../maps/entities.json": 23,
            "../maps/legacy.json": 24,
            "../maps/xml.json": 25,
            "./decode_codepoint.js": 20
        }],
        20: [function(require, module, exports) {
            var decodeMap = require("../maps/decode.json");
            module.exports = decodeCodePoint;

            function decodeCodePoint(codePoint) {
                if (codePoint >= 55296 && codePoint <= 57343 || codePoint > 1114111) {
                    return "�"
                }
                if (codePoint in decodeMap) {
                    codePoint = decodeMap[codePoint]
                }
                var output = "";
                if (codePoint > 65535) {
                    codePoint -= 65536;
                    output += String.fromCharCode(codePoint >>> 10 & 1023 | 55296);
                    codePoint = 56320 | codePoint & 1023
                }
                output += String.fromCharCode(codePoint);
                return output
            }
        }, {
            "../maps/decode.json": 22
        }],
        21: [function(require, module, exports) {
            var inverseXML = getInverseObj(require("../maps/xml.json")),
                xmlReplacer = getInverseReplacer(inverseXML);
            exports.XML = getInverse(inverseXML, xmlReplacer);
            var inverseHTML = getInverseObj(require("../maps/entities.json")),
                htmlReplacer = getInverseReplacer(inverseHTML);
            exports.HTML = getInverse(inverseHTML, htmlReplacer);

            function getInverseObj(obj) {
                return Object.keys(obj)
                    .sort()
                    .reduce(function(inverse, name) {
                        inverse[obj[name]] = "&" + name + ";";
                        return inverse
                    }, {})
            }

            function getInverseReplacer(inverse) {
                var single = [],
                    multiple = [];
                Object.keys(inverse)
                    .forEach(function(k) {
                        if (k.length === 1) {
                            single.push("\\" + k)
                        } else {
                            multiple.push(k)
                        }
                    });
                multiple.unshift("[" + single.join("") + "]");
                return new RegExp(multiple.join("|"), "g")
            }
            var re_nonASCII = /[^\0-\x7F]/g,
                re_astralSymbols = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;

            function singleCharReplacer(c) {
                return "&#x" + c.charCodeAt(0)
                    .toString(16)
                    .toUpperCase() + ";"
            }

            function astralReplacer(c) {
                var high = c.charCodeAt(0);
                var low = c.charCodeAt(1);
                var codePoint = (high - 55296) * 1024 + low - 56320 + 65536;
                return "&#x" + codePoint.toString(16)
                    .toUpperCase() + ";"
            }

            function getInverse(inverse, re) {
                function func(name) {
                    return inverse[name]
                }
                return function(data) {
                    return data.replace(re, func)
                        .replace(re_astralSymbols, astralReplacer)
                        .replace(re_nonASCII, singleCharReplacer)
                }
            }
            var re_xmlChars = getInverseReplacer(inverseXML);

            function escapeXML(data) {
                return data.replace(re_xmlChars, singleCharReplacer)
                    .replace(re_astralSymbols, astralReplacer)
                    .replace(re_nonASCII, singleCharReplacer)
            }
            exports.escape = escapeXML
        }, {
            "../maps/entities.json": 23,
            "../maps/xml.json": 25
        }],
        22: [function(require, module, exports) {
            module.exports = {
                0: 65533,
                128: 8364,
                130: 8218,
                131: 402,
                132: 8222,
                133: 8230,
                134: 8224,
                135: 8225,
                136: 710,
                137: 8240,
                138: 352,
                139: 8249,
                140: 338,
                142: 381,
                145: 8216,
                146: 8217,
                147: 8220,
                148: 8221,
                149: 8226,
                150: 8211,
                151: 8212,
                152: 732,
                153: 8482,
                154: 353,
                155: 8250,
                156: 339,
                158: 382,
                159: 376
            }
        }, {}],
        23: [function(require, module, exports) {
            module.exports = {
                Aacute: "Á",
                aacute: "á",
                Abreve: "Ă",
                abreve: "ă",
                ac: "∾",
                acd: "∿",
                acE: "∾̳",
                Acirc: "Â",
                acirc: "â",
                acute: "´",
                Acy: "А",
                acy: "а",
                AElig: "Æ",
                aelig: "æ",
                af: "⁡",
                Afr: "𝔄",
                afr: "𝔞",
                Agrave: "À",
                agrave: "à",
                alefsym: "ℵ",
                aleph: "ℵ",
                Alpha: "Α",
                alpha: "α",
                Amacr: "Ā",
                amacr: "ā",
                amalg: "⨿",
                amp: "&",
                AMP: "&",
                andand: "⩕",
                And: "⩓",
                and: "∧",
                andd: "⩜",
                andslope: "⩘",
                andv: "⩚",
                ang: "∠",
                ange: "⦤",
                angle: "∠",
                angmsdaa: "⦨",
                angmsdab: "⦩",
                angmsdac: "⦪",
                angmsdad: "⦫",
                angmsdae: "⦬",
                angmsdaf: "⦭",
                angmsdag: "⦮",
                angmsdah: "⦯",
                angmsd: "∡",
                angrt: "∟",
                angrtvb: "⊾",
                angrtvbd: "⦝",
                angsph: "∢",
                angst: "Å",
                angzarr: "⍼",
                Aogon: "Ą",
                aogon: "ą",
                Aopf: "𝔸",
                aopf: "𝕒",
                apacir: "⩯",
                ap: "≈",
                apE: "⩰",
                ape: "≊",
                apid: "≋",
                apos: "'",
                ApplyFunction: "⁡",
                approx: "≈",
                approxeq: "≊",
                Aring: "Å",
                aring: "å",
                Ascr: "𝒜",
                ascr: "𝒶",
                Assign: "≔",
                ast: "*",
                asymp: "≈",
                asympeq: "≍",
                Atilde: "Ã",
                atilde: "ã",
                Auml: "Ä",
                auml: "ä",
                awconint: "∳",
                awint: "⨑",
                backcong: "≌",
                backepsilon: "϶",
                backprime: "‵",
                backsim: "∽",
                backsimeq: "⋍",
                Backslash: "∖",
                Barv: "⫧",
                barvee: "⊽",
                barwed: "⌅",
                Barwed: "⌆",
                barwedge: "⌅",
                bbrk: "⎵",
                bbrktbrk: "⎶",
                bcong: "≌",
                Bcy: "Б",
                bcy: "б",
                bdquo: "„",
                becaus: "∵",
                because: "∵",
                Because: "∵",
                bemptyv: "⦰",
                bepsi: "϶",
                bernou: "ℬ",
                Bernoullis: "ℬ",
                Beta: "Β",
                beta: "β",
                beth: "ℶ",
                between: "≬",
                Bfr: "𝔅",
                bfr: "𝔟",
                bigcap: "⋂",
                bigcirc: "◯",
                bigcup: "⋃",
                bigodot: "⨀",
                bigoplus: "⨁",
                bigotimes: "⨂",
                bigsqcup: "⨆",
                bigstar: "★",
                bigtriangledown: "▽",
                bigtriangleup: "△",
                biguplus: "⨄",
                bigvee: "⋁",
                bigwedge: "⋀",
                bkarow: "⤍",
                blacklozenge: "⧫",
                blacksquare: "▪",
                blacktriangle: "▴",
                blacktriangledown: "▾",
                blacktriangleleft: "◂",
                blacktriangleright: "▸",
                blank: "␣",
                blk12: "▒",
                blk14: "░",
                blk34: "▓",
                block: "█",
                bne: "=⃥",
                bnequiv: "≡⃥",
                bNot: "⫭",
                bnot: "⌐",
                Bopf: "𝔹",
                bopf: "𝕓",
                bot: "⊥",
                bottom: "⊥",
                bowtie: "⋈",
                boxbox: "⧉",
                boxdl: "┐",
                boxdL: "╕",
                boxDl: "╖",
                boxDL: "╗",
                boxdr: "┌",
                boxdR: "╒",
                boxDr: "╓",
                boxDR: "╔",
                boxh: "─",
                boxH: "═",
                boxhd: "┬",
                boxHd: "╤",
                boxhD: "╥",
                boxHD: "╦",
                boxhu: "┴",
                boxHu: "╧",
                boxhU: "╨",
                boxHU: "╩",
                boxminus: "⊟",
                boxplus: "⊞",
                boxtimes: "⊠",
                boxul: "┘",
                boxuL: "╛",
                boxUl: "╜",
                boxUL: "╝",
                boxur: "└",
                boxuR: "╘",
                boxUr: "╙",
                boxUR: "╚",
                boxv: "│",
                boxV: "║",
                boxvh: "┼",
                boxvH: "╪",
                boxVh: "╫",
                boxVH: "╬",
                boxvl: "┤",
                boxvL: "╡",
                boxVl: "╢",
                boxVL: "╣",
                boxvr: "├",
                boxvR: "╞",
                boxVr: "╟",
                boxVR: "╠",
                bprime: "‵",
                breve: "˘",
                Breve: "˘",
                brvbar: "¦",
                bscr: "𝒷",
                Bscr: "ℬ",
                bsemi: "⁏",
                bsim: "∽",
                bsime: "⋍",
                bsolb: "⧅",
                bsol: "\\",
                bsolhsub: "⟈",
                bull: "•",
                bullet: "•",
                bump: "≎",
                bumpE: "⪮",
                bumpe: "≏",
                Bumpeq: "≎",
                bumpeq: "≏",
                Cacute: "Ć",
                cacute: "ć",
                capand: "⩄",
                capbrcup: "⩉",
                capcap: "⩋",
                cap: "∩",
                Cap: "⋒",
                capcup: "⩇",
                capdot: "⩀",
                CapitalDifferentialD: "ⅅ",
                caps: "∩︀",
                caret: "⁁",
                caron: "ˇ",
                Cayleys: "ℭ",
                ccaps: "⩍",
                Ccaron: "Č",
                ccaron: "č",
                Ccedil: "Ç",
                ccedil: "ç",
                Ccirc: "Ĉ",
                ccirc: "ĉ",
                Cconint: "∰",
                ccups: "⩌",
                ccupssm: "⩐",
                Cdot: "Ċ",
                cdot: "ċ",
                cedil: "¸",
                Cedilla: "¸",
                cemptyv: "⦲",
                cent: "¢",
                centerdot: "·",
                CenterDot: "·",
                cfr: "𝔠",
                Cfr: "ℭ",
                CHcy: "Ч",
                chcy: "ч",
                check: "✓",
                checkmark: "✓",
                Chi: "Χ",
                chi: "χ",
                circ: "ˆ",
                circeq: "≗",
                circlearrowleft: "↺",
                circlearrowright: "↻",
                circledast: "⊛",
                circledcirc: "⊚",
                circleddash: "⊝",
                CircleDot: "⊙",
                circledR: "®",
                circledS: "Ⓢ",
                CircleMinus: "⊖",
                CirclePlus: "⊕",
                CircleTimes: "⊗",
                cir: "○",
                cirE: "⧃",
                cire: "≗",
                cirfnint: "⨐",
                cirmid: "⫯",
                cirscir: "⧂",
                ClockwiseContourIntegral: "∲",
                CloseCurlyDoubleQuote: "”",
                CloseCurlyQuote: "’",
                clubs: "♣",
                clubsuit: "♣",
                colon: ":",
                Colon: "∷",
                Colone: "⩴",
                colone: "≔",
                coloneq: "≔",
                comma: ",",
                commat: "@",
                comp: "∁",
                compfn: "∘",
                complement: "∁",
                complexes: "ℂ",
                cong: "≅",
                congdot: "⩭",
                Congruent: "≡",
                conint: "∮",
                Conint: "∯",
                ContourIntegral: "∮",
                copf: "𝕔",
                Copf: "ℂ",
                coprod: "∐",
                Coproduct: "∐",
                copy: "©",
                COPY: "©",
                copysr: "℗",
                CounterClockwiseContourIntegral: "∳",
                crarr: "↵",
                cross: "✗",
                Cross: "⨯",
                Cscr: "𝒞",
                cscr: "𝒸",
                csub: "⫏",
                csube: "⫑",
                csup: "⫐",
                csupe: "⫒",
                ctdot: "⋯",
                cudarrl: "⤸",
                cudarrr: "⤵",
                cuepr: "⋞",
                cuesc: "⋟",
                cularr: "↶",
                cularrp: "⤽",
                cupbrcap: "⩈",
                cupcap: "⩆",
                CupCap: "≍",
                cup: "∪",
                Cup: "⋓",
                cupcup: "⩊",
                cupdot: "⊍",
                cupor: "⩅",
                cups: "∪︀",
                curarr: "↷",
                curarrm: "⤼",
                curlyeqprec: "⋞",
                curlyeqsucc: "⋟",
                curlyvee: "⋎",
                curlywedge: "⋏",
                curren: "¤",
                curvearrowleft: "↶",
                curvearrowright: "↷",
                cuvee: "⋎",
                cuwed: "⋏",
                cwconint: "∲",
                cwint: "∱",
                cylcty: "⌭",
                dagger: "†",
                Dagger: "‡",
                daleth: "ℸ",
                darr: "↓",
                Darr: "↡",
                dArr: "⇓",
                dash: "‐",
                Dashv: "⫤",
                dashv: "⊣",
                dbkarow: "⤏",
                dblac: "˝",
                Dcaron: "Ď",
                dcaron: "ď",
                Dcy: "Д",
                dcy: "д",
                ddagger: "‡",
                ddarr: "⇊",
                DD: "ⅅ",
                dd: "ⅆ",
                DDotrahd: "⤑",
                ddotseq: "⩷",
                deg: "°",
                Del: "∇",
                Delta: "Δ",
                delta: "δ",
                demptyv: "⦱",
                dfisht: "⥿",
                Dfr: "𝔇",
                dfr: "𝔡",
                dHar: "⥥",
                dharl: "⇃",
                dharr: "⇂",
                DiacriticalAcute: "´",
                DiacriticalDot: "˙",
                DiacriticalDoubleAcute: "˝",
                DiacriticalGrave: "`",
                DiacriticalTilde: "˜",
                diam: "⋄",
                diamond: "⋄",
                Diamond: "⋄",
                diamondsuit: "♦",
                diams: "♦",
                die: "¨",
                DifferentialD: "ⅆ",
                digamma: "ϝ",
                disin: "⋲",
                div: "÷",
                divide: "÷",
                divideontimes: "⋇",
                divonx: "⋇",
                DJcy: "Ђ",
                djcy: "ђ",
                dlcorn: "⌞",
                dlcrop: "⌍",
                dollar: "$",
                Dopf: "𝔻",
                dopf: "𝕕",
                Dot: "¨",
                dot: "˙",
                DotDot: "⃜",
                doteq: "≐",
                doteqdot: "≑",
                DotEqual: "≐",
                dotminus: "∸",
                dotplus: "∔",
                dotsquare: "⊡",
                doublebarwedge: "⌆",
                DoubleContourIntegral: "∯",
                DoubleDot: "¨",
                DoubleDownArrow: "⇓",
                DoubleLeftArrow: "⇐",
                DoubleLeftRightArrow: "⇔",
                DoubleLeftTee: "⫤",
                DoubleLongLeftArrow: "⟸",
                DoubleLongLeftRightArrow: "⟺",
                DoubleLongRightArrow: "⟹",
                DoubleRightArrow: "⇒",
                DoubleRightTee: "⊨",
                DoubleUpArrow: "⇑",
                DoubleUpDownArrow: "⇕",
                DoubleVerticalBar: "∥",
                DownArrowBar: "⤓",
                downarrow: "↓",
                DownArrow: "↓",
                Downarrow: "⇓",
                DownArrowUpArrow: "⇵",
                DownBreve: "̑",
                downdownarrows: "⇊",
                downharpoonleft: "⇃",
                downharpoonright: "⇂",
                DownLeftRightVector: "⥐",
                DownLeftTeeVector: "⥞",
                DownLeftVectorBar: "⥖",
                DownLeftVector: "↽",
                DownRightTeeVector: "⥟",
                DownRightVectorBar: "⥗",
                DownRightVector: "⇁",
                DownTeeArrow: "↧",
                DownTee: "⊤",
                drbkarow: "⤐",
                drcorn: "⌟",
                drcrop: "⌌",
                Dscr: "𝒟",
                dscr: "𝒹",
                DScy: "Ѕ",
                dscy: "ѕ",
                dsol: "⧶",
                Dstrok: "Đ",
                dstrok: "đ",
                dtdot: "⋱",
                dtri: "▿",
                dtrif: "▾",
                duarr: "⇵",
                duhar: "⥯",
                dwangle: "⦦",
                DZcy: "Џ",
                dzcy: "џ",
                dzigrarr: "⟿",
                Eacute: "É",
                eacute: "é",
                easter: "⩮",
                Ecaron: "Ě",
                ecaron: "ě",
                Ecirc: "Ê",
                ecirc: "ê",
                ecir: "≖",
                ecolon: "≕",
                Ecy: "Э",
                ecy: "э",
                eDDot: "⩷",
                Edot: "Ė",
                edot: "ė",
                eDot: "≑",
                ee: "ⅇ",
                efDot: "≒",
                Efr: "𝔈",
                efr: "𝔢",
                eg: "⪚",
                Egrave: "È",
                egrave: "è",
                egs: "⪖",
                egsdot: "⪘",
                el: "⪙",
                Element: "∈",
                elinters: "⏧",
                ell: "ℓ",
                els: "⪕",
                elsdot: "⪗",
                Emacr: "Ē",
                emacr: "ē",
                empty: "∅",
                emptyset: "∅",
                EmptySmallSquare: "◻",
                emptyv: "∅",
                EmptyVerySmallSquare: "▫",
                emsp13: " ",
                emsp14: " ",
                emsp: " ",
                ENG: "Ŋ",
                eng: "ŋ",
                ensp: " ",
                Eogon: "Ę",
                eogon: "ę",
                Eopf: "𝔼",
                eopf: "𝕖",
                epar: "⋕",
                eparsl: "⧣",
                eplus: "⩱",
                epsi: "ε",
                Epsilon: "Ε",
                epsilon: "ε",
                epsiv: "ϵ",
                eqcirc: "≖",
                eqcolon: "≕",
                eqsim: "≂",
                eqslantgtr: "⪖",
                eqslantless: "⪕",
                Equal: "⩵",
                equals: "=",
                EqualTilde: "≂",
                equest: "≟",
                Equilibrium: "⇌",
                equiv: "≡",
                equivDD: "⩸",
                eqvparsl: "⧥",
                erarr: "⥱",
                erDot: "≓",
                escr: "ℯ",
                Escr: "ℰ",
                esdot: "≐",
                Esim: "⩳",
                esim: "≂",
                Eta: "Η",
                eta: "η",
                ETH: "Ð",
                eth: "ð",
                Euml: "Ë",
                euml: "ë",
                euro: "€",
                excl: "!",
                exist: "∃",
                Exists: "∃",
                expectation: "ℰ",
                exponentiale: "ⅇ",
                ExponentialE: "ⅇ",
                fallingdotseq: "≒",
                Fcy: "Ф",
                fcy: "ф",
                female: "♀",
                ffilig: "ﬃ",
                fflig: "ﬀ",
                ffllig: "ﬄ",
                Ffr: "𝔉",
                ffr: "𝔣",
                filig: "ﬁ",
                FilledSmallSquare: "◼",
                FilledVerySmallSquare: "▪",
                fjlig: "fj",
                flat: "♭",
                fllig: "ﬂ",
                fltns: "▱",
                fnof: "ƒ",
                Fopf: "𝔽",
                fopf: "𝕗",
                forall: "∀",
                ForAll: "∀",
                fork: "⋔",
                forkv: "⫙",
                Fouriertrf: "ℱ",
                fpartint: "⨍",
                frac12: "½",
                frac13: "⅓",
                frac14: "¼",
                frac15: "⅕",
                frac16: "⅙",
                frac18: "⅛",
                frac23: "⅔",
                frac25: "⅖",
                frac34: "¾",
                frac35: "⅗",
                frac38: "⅜",
                frac45: "⅘",
                frac56: "⅚",
                frac58: "⅝",
                frac78: "⅞",
                frasl: "⁄",
                frown: "⌢",
                fscr: "𝒻",
                Fscr: "ℱ",
                gacute: "ǵ",
                Gamma: "Γ",
                gamma: "γ",
                Gammad: "Ϝ",
                gammad: "ϝ",
                gap: "⪆",
                Gbreve: "Ğ",
                gbreve: "ğ",
                Gcedil: "Ģ",
                Gcirc: "Ĝ",
                gcirc: "ĝ",
                Gcy: "Г",
                gcy: "г",
                Gdot: "Ġ",
                gdot: "ġ",
                ge: "≥",
                gE: "≧",
                gEl: "⪌",
                gel: "⋛",
                geq: "≥",
                geqq: "≧",
                geqslant: "⩾",
                gescc: "⪩",
                ges: "⩾",
                gesdot: "⪀",
                gesdoto: "⪂",
                gesdotol: "⪄",
                gesl: "⋛︀",
                gesles: "⪔",
                Gfr: "𝔊",
                gfr: "𝔤",
                gg: "≫",
                Gg: "⋙",
                ggg: "⋙",
                gimel: "ℷ",
                GJcy: "Ѓ",
                gjcy: "ѓ",
                gla: "⪥",
                gl: "≷",
                glE: "⪒",
                glj: "⪤",
                gnap: "⪊",
                gnapprox: "⪊",
                gne: "⪈",
                gnE: "≩",
                gneq: "⪈",
                gneqq: "≩",
                gnsim: "⋧",
                Gopf: "𝔾",
                gopf: "𝕘",
                grave: "`",
                GreaterEqual: "≥",
                GreaterEqualLess: "⋛",
                GreaterFullEqual: "≧",
                GreaterGreater: "⪢",
                GreaterLess: "≷",
                GreaterSlantEqual: "⩾",
                GreaterTilde: "≳",
                Gscr: "𝒢",
                gscr: "ℊ",
                gsim: "≳",
                gsime: "⪎",
                gsiml: "⪐",
                gtcc: "⪧",
                gtcir: "⩺",
                gt: ">",
                GT: ">",
                Gt: "≫",
                gtdot: "⋗",
                gtlPar: "⦕",
                gtquest: "⩼",
                gtrapprox: "⪆",
                gtrarr: "⥸",
                gtrdot: "⋗",
                gtreqless: "⋛",
                gtreqqless: "⪌",
                gtrless: "≷",
                gtrsim: "≳",
                gvertneqq: "≩︀",
                gvnE: "≩︀",
                Hacek: "ˇ",
                hairsp: " ",
                half: "½",
                hamilt: "ℋ",
                HARDcy: "Ъ",
                hardcy: "ъ",
                harrcir: "⥈",
                harr: "↔",
                hArr: "⇔",
                harrw: "↭",
                Hat: "^",
                hbar: "ℏ",
                Hcirc: "Ĥ",
                hcirc: "ĥ",
                hearts: "♥",
                heartsuit: "♥",
                hellip: "…",
                hercon: "⊹",
                hfr: "𝔥",
                Hfr: "ℌ",
                HilbertSpace: "ℋ",
                hksearow: "⤥",
                hkswarow: "⤦",
                hoarr: "⇿",
                homtht: "∻",
                hookleftarrow: "↩",
                hookrightarrow: "↪",
                hopf: "𝕙",
                Hopf: "ℍ",
                horbar: "―",
                HorizontalLine: "─",
                hscr: "𝒽",
                Hscr: "ℋ",
                hslash: "ℏ",
                Hstrok: "Ħ",
                hstrok: "ħ",
                HumpDownHump: "≎",
                HumpEqual: "≏",
                hybull: "⁃",
                hyphen: "‐",
                Iacute: "Í",
                iacute: "í",
                ic: "⁣",
                Icirc: "Î",
                icirc: "î",
                Icy: "И",
                icy: "и",
                Idot: "İ",
                IEcy: "Е",
                iecy: "е",
                iexcl: "¡",
                iff: "⇔",
                ifr: "𝔦",
                Ifr: "ℑ",
                Igrave: "Ì",
                igrave: "ì",
                ii: "ⅈ",
                iiiint: "⨌",
                iiint: "∭",
                iinfin: "⧜",
                iiota: "℩",
                IJlig: "Ĳ",
                ijlig: "ĳ",
                Imacr: "Ī",
                imacr: "ī",
                image: "ℑ",
                ImaginaryI: "ⅈ",
                imagline: "ℐ",
                imagpart: "ℑ",
                imath: "ı",
                Im: "ℑ",
                imof: "⊷",
                imped: "Ƶ",
                Implies: "⇒",
                incare: "℅",
                in: "∈",
                infin: "∞",
                infintie: "⧝",
                inodot: "ı",
                intcal: "⊺",
                int: "∫",
                Int: "∬",
                integers: "ℤ",
                Integral: "∫",
                intercal: "⊺",
                Intersection: "⋂",
                intlarhk: "⨗",
                intprod: "⨼",
                InvisibleComma: "⁣",
                InvisibleTimes: "⁢",
                IOcy: "Ё",
                iocy: "ё",
                Iogon: "Į",
                iogon: "į",
                Iopf: "𝕀",
                iopf: "𝕚",
                Iota: "Ι",
                iota: "ι",
                iprod: "⨼",
                iquest: "¿",
                iscr: "𝒾",
                Iscr: "ℐ",
                isin: "∈",
                isindot: "⋵",
                isinE: "⋹",
                isins: "⋴",
                isinsv: "⋳",
                isinv: "∈",
                it: "⁢",
                Itilde: "Ĩ",
                itilde: "ĩ",
                Iukcy: "І",
                iukcy: "і",
                Iuml: "Ï",
                iuml: "ï",
                Jcirc: "Ĵ",
                jcirc: "ĵ",
                Jcy: "Й",
                jcy: "й",
                Jfr: "𝔍",
                jfr: "𝔧",
                jmath: "ȷ",
                Jopf: "𝕁",
                jopf: "𝕛",
                Jscr: "𝒥",
                jscr: "𝒿",
                Jsercy: "Ј",
                jsercy: "ј",
                Jukcy: "Є",
                jukcy: "є",
                Kappa: "Κ",
                kappa: "κ",
                kappav: "ϰ",
                Kcedil: "Ķ",
                kcedil: "ķ",
                Kcy: "К",
                kcy: "к",
                Kfr: "𝔎",
                kfr: "𝔨",
                kgreen: "ĸ",
                KHcy: "Х",
                khcy: "х",
                KJcy: "Ќ",
                kjcy: "ќ",
                Kopf: "𝕂",
                kopf: "𝕜",
                Kscr: "𝒦",
                kscr: "𝓀",
                lAarr: "⇚",
                Lacute: "Ĺ",
                lacute: "ĺ",
                laemptyv: "⦴",
                lagran: "ℒ",
                Lambda: "Λ",
                lambda: "λ",
                lang: "⟨",
                Lang: "⟪",
                langd: "⦑",
                langle: "⟨",
                lap: "⪅",
                Laplacetrf: "ℒ",
                laquo: "«",
                larrb: "⇤",
                larrbfs: "⤟",
                larr: "←",
                Larr: "↞",
                lArr: "⇐",
                larrfs: "⤝",
                larrhk: "↩",
                larrlp: "↫",
                larrpl: "⤹",
                larrsim: "⥳",
                larrtl: "↢",
                latail: "⤙",
                lAtail: "⤛",
                lat: "⪫",
                late: "⪭",
                lates: "⪭︀",
                lbarr: "⤌",
                lBarr: "⤎",
                lbbrk: "❲",
                lbrace: "{",
                lbrack: "[",
                lbrke: "⦋",
                lbrksld: "⦏",
                lbrkslu: "⦍",
                Lcaron: "Ľ",
                lcaron: "ľ",
                Lcedil: "Ļ",
                lcedil: "ļ",
                lceil: "⌈",
                lcub: "{",
                Lcy: "Л",
                lcy: "л",
                ldca: "⤶",
                ldquo: "“",
                ldquor: "„",
                ldrdhar: "⥧",
                ldrushar: "⥋",
                ldsh: "↲",
                le: "≤",
                lE: "≦",
                LeftAngleBracket: "⟨",
                LeftArrowBar: "⇤",
                leftarrow: "←",
                LeftArrow: "←",
                Leftarrow: "⇐",
                LeftArrowRightArrow: "⇆",
                leftarrowtail: "↢",
                LeftCeiling: "⌈",
                LeftDoubleBracket: "⟦",
                LeftDownTeeVector: "⥡",
                LeftDownVectorBar: "⥙",
                LeftDownVector: "⇃",
                LeftFloor: "⌊",
                leftharpoondown: "↽",
                leftharpoonup: "↼",
                leftleftarrows: "⇇",
                leftrightarrow: "↔",
                LeftRightArrow: "↔",
                Leftrightarrow: "⇔",
                leftrightarrows: "⇆",
                leftrightharpoons: "⇋",
                leftrightsquigarrow: "↭",
                LeftRightVector: "⥎",
                LeftTeeArrow: "↤",
                LeftTee: "⊣",
                LeftTeeVector: "⥚",
                leftthreetimes: "⋋",
                LeftTriangleBar: "⧏",
                LeftTriangle: "⊲",
                LeftTriangleEqual: "⊴",
                LeftUpDownVector: "⥑",
                LeftUpTeeVector: "⥠",
                LeftUpVectorBar: "⥘",
                LeftUpVector: "↿",
                LeftVectorBar: "⥒",
                LeftVector: "↼",
                lEg: "⪋",
                leg: "⋚",
                leq: "≤",
                leqq: "≦",
                leqslant: "⩽",
                lescc: "⪨",
                les: "⩽",
                lesdot: "⩿",
                lesdoto: "⪁",
                lesdotor: "⪃",
                lesg: "⋚︀",
                lesges: "⪓",
                lessapprox: "⪅",
                lessdot: "⋖",
                lesseqgtr: "⋚",
                lesseqqgtr: "⪋",
                LessEqualGreater: "⋚",
                LessFullEqual: "≦",
                LessGreater: "≶",
                lessgtr: "≶",
                LessLess: "⪡",
                lesssim: "≲",
                LessSlantEqual: "⩽",
                LessTilde: "≲",
                lfisht: "⥼",
                lfloor: "⌊",
                Lfr: "𝔏",
                lfr: "𝔩",
                lg: "≶",
                lgE: "⪑",
                lHar: "⥢",
                lhard: "↽",
                lharu: "↼",
                lharul: "⥪",
                lhblk: "▄",
                LJcy: "Љ",
                ljcy: "љ",
                llarr: "⇇",
                ll: "≪",
                Ll: "⋘",
                llcorner: "⌞",
                Lleftarrow: "⇚",
                llhard: "⥫",
                lltri: "◺",
                Lmidot: "Ŀ",
                lmidot: "ŀ",
                lmoustache: "⎰",
                lmoust: "⎰",
                lnap: "⪉",
                lnapprox: "⪉",
                lne: "⪇",
                lnE: "≨",
                lneq: "⪇",
                lneqq: "≨",
                lnsim: "⋦",
                loang: "⟬",
                loarr: "⇽",
                lobrk: "⟦",
                longleftarrow: "⟵",
                LongLeftArrow: "⟵",
                Longleftarrow: "⟸",
                longleftrightarrow: "⟷",
                LongLeftRightArrow: "⟷",
                Longleftrightarrow: "⟺",
                longmapsto: "⟼",
                longrightarrow: "⟶",
                LongRightArrow: "⟶",
                Longrightarrow: "⟹",
                looparrowleft: "↫",
                looparrowright: "↬",
                lopar: "⦅",
                Lopf: "𝕃",
                lopf: "𝕝",
                loplus: "⨭",
                lotimes: "⨴",
                lowast: "∗",
                lowbar: "_",
                LowerLeftArrow: "↙",
                LowerRightArrow: "↘",
                loz: "◊",
                lozenge: "◊",
                lozf: "⧫",
                lpar: "(",
                lparlt: "⦓",
                lrarr: "⇆",
                lrcorner: "⌟",
                lrhar: "⇋",
                lrhard: "⥭",
                lrm: "‎",
                lrtri: "⊿",
                lsaquo: "‹",
                lscr: "𝓁",
                Lscr: "ℒ",
                lsh: "↰",
                Lsh: "↰",
                lsim: "≲",
                lsime: "⪍",
                lsimg: "⪏",
                lsqb: "[",
                lsquo: "‘",
                lsquor: "‚",
                Lstrok: "Ł",
                lstrok: "ł",
                ltcc: "⪦",
                ltcir: "⩹",
                lt: "<",
                LT: "<",
                Lt: "≪",
                ltdot: "⋖",
                lthree: "⋋",
                ltimes: "⋉",
                ltlarr: "⥶",
                ltquest: "⩻",
                ltri: "◃",
                ltrie: "⊴",
                ltrif: "◂",
                ltrPar: "⦖",
                lurdshar: "⥊",
                luruhar: "⥦",
                lvertneqq: "≨︀",
                lvnE: "≨︀",
                macr: "¯",
                male: "♂",
                malt: "✠",
                maltese: "✠",
                Map: "⤅",
                map: "↦",
                mapsto: "↦",
                mapstodown: "↧",
                mapstoleft: "↤",
                mapstoup: "↥",
                marker: "▮",
                mcomma: "⨩",
                Mcy: "М",
                mcy: "м",
                mdash: "—",
                mDDot: "∺",
                measuredangle: "∡",
                MediumSpace: " ",
                Mellintrf: "ℳ",
                Mfr: "𝔐",
                mfr: "𝔪",
                mho: "℧",
                micro: "µ",
                midast: "*",
                midcir: "⫰",
                mid: "∣",
                middot: "·",
                minusb: "⊟",
                minus: "−",
                minusd: "∸",
                minusdu: "⨪",
                MinusPlus: "∓",
                mlcp: "⫛",
                mldr: "…",
                mnplus: "∓",
                models: "⊧",
                Mopf: "𝕄",
                mopf: "𝕞",
                mp: "∓",
                mscr: "𝓂",
                Mscr: "ℳ",
                mstpos: "∾",
                Mu: "Μ",
                mu: "μ",
                multimap: "⊸",
                mumap: "⊸",
                nabla: "∇",
                Nacute: "Ń",
                nacute: "ń",
                nang: "∠⃒",
                nap: "≉",
                napE: "⩰̸",
                napid: "≋̸",
                napos: "ŉ",
                napprox: "≉",
                natural: "♮",
                naturals: "ℕ",
                natur: "♮",
                // nbsp: " ",
                nbump: "≎̸",
                nbumpe: "≏̸",
                ncap: "⩃",
                Ncaron: "Ň",
                ncaron: "ň",
                Ncedil: "Ņ",
                ncedil: "ņ",
                ncong: "≇",
                ncongdot: "⩭̸",
                ncup: "⩂",
                Ncy: "Н",
                ncy: "н",
                ndash: "–",
                nearhk: "⤤",
                nearr: "↗",
                neArr: "⇗",
                nearrow: "↗",
                ne: "≠",
                nedot: "≐̸",
                NegativeMediumSpace: "​",
                NegativeThickSpace: "​",
                NegativeThinSpace: "​",
                NegativeVeryThinSpace: "​",
                nequiv: "≢",
                nesear: "⤨",
                nesim: "≂̸",
                NestedGreaterGreater: "≫",
                NestedLessLess: "≪",
                NewLine: "\n",
                nexist: "∄",
                nexists: "∄",
                Nfr: "𝔑",
                nfr: "𝔫",
                ngE: "≧̸",
                nge: "≱",
                ngeq: "≱",
                ngeqq: "≧̸",
                ngeqslant: "⩾̸",
                nges: "⩾̸",
                nGg: "⋙̸",
                ngsim: "≵",
                nGt: "≫⃒",
                ngt: "≯",
                ngtr: "≯",
                nGtv: "≫̸",
                nharr: "↮",
                nhArr: "⇎",
                nhpar: "⫲",
                ni: "∋",
                nis: "⋼",
                nisd: "⋺",
                niv: "∋",
                NJcy: "Њ",
                njcy: "њ",
                nlarr: "↚",
                nlArr: "⇍",
                nldr: "‥",
                nlE: "≦̸",
                nle: "≰",
                nleftarrow: "↚",
                nLeftarrow: "⇍",
                nleftrightarrow: "↮",
                nLeftrightarrow: "⇎",
                nleq: "≰",
                nleqq: "≦̸",
                nleqslant: "⩽̸",
                nles: "⩽̸",
                nless: "≮",
                nLl: "⋘̸",
                nlsim: "≴",
                nLt: "≪⃒",
                nlt: "≮",
                nltri: "⋪",
                nltrie: "⋬",
                nLtv: "≪̸",
                nmid: "∤",
                NoBreak: "⁠",
                NonBreakingSpace: " ",
                nopf: "𝕟",
                Nopf: "ℕ",
                Not: "⫬",
                not: "¬",
                NotCongruent: "≢",
                NotCupCap: "≭",
                NotDoubleVerticalBar: "∦",
                NotElement: "∉",
                NotEqual: "≠",
                NotEqualTilde: "≂̸",
                NotExists: "∄",
                NotGreater: "≯",
                NotGreaterEqual: "≱",
                NotGreaterFullEqual: "≧̸",
                NotGreaterGreater: "≫̸",
                NotGreaterLess: "≹",
                NotGreaterSlantEqual: "⩾̸",
                NotGreaterTilde: "≵",
                NotHumpDownHump: "≎̸",
                NotHumpEqual: "≏̸",
                notin: "∉",
                notindot: "⋵̸",
                notinE: "⋹̸",
                notinva: "∉",
                notinvb: "⋷",
                notinvc: "⋶",
                NotLeftTriangleBar: "⧏̸",
                NotLeftTriangle: "⋪",
                NotLeftTriangleEqual: "⋬",
                NotLess: "≮",
                NotLessEqual: "≰",
                NotLessGreater: "≸",
                NotLessLess: "≪̸",
                NotLessSlantEqual: "⩽̸",
                NotLessTilde: "≴",
                NotNestedGreaterGreater: "⪢̸",
                NotNestedLessLess: "⪡̸",
                notni: "∌",
                notniva: "∌",
                notnivb: "⋾",
                notnivc: "⋽",
                NotPrecedes: "⊀",
                NotPrecedesEqual: "⪯̸",
                NotPrecedesSlantEqual: "⋠",
                NotReverseElement: "∌",
                NotRightTriangleBar: "⧐̸",
                NotRightTriangle: "⋫",
                NotRightTriangleEqual: "⋭",
                NotSquareSubset: "⊏̸",
                NotSquareSubsetEqual: "⋢",
                NotSquareSuperset: "⊐̸",
                NotSquareSupersetEqual: "⋣",
                NotSubset: "⊂⃒",
                NotSubsetEqual: "⊈",
                NotSucceeds: "⊁",
                NotSucceedsEqual: "⪰̸",
                NotSucceedsSlantEqual: "⋡",
                NotSucceedsTilde: "≿̸",
                NotSuperset: "⊃⃒",
                NotSupersetEqual: "⊉",
                NotTilde: "≁",
                NotTildeEqual: "≄",
                NotTildeFullEqual: "≇",
                NotTildeTilde: "≉",
                NotVerticalBar: "∤",
                nparallel: "∦",
                npar: "∦",
                nparsl: "⫽⃥",
                npart: "∂̸",
                npolint: "⨔",
                npr: "⊀",
                nprcue: "⋠",
                nprec: "⊀",
                npreceq: "⪯̸",
                npre: "⪯̸",
                nrarrc: "⤳̸",
                nrarr: "↛",
                nrArr: "⇏",
                nrarrw: "↝̸",
                nrightarrow: "↛",
                nRightarrow: "⇏",
                nrtri: "⋫",
                nrtrie: "⋭",
                nsc: "⊁",
                nsccue: "⋡",
                nsce: "⪰̸",
                Nscr: "𝒩",
                nscr: "𝓃",
                nshortmid: "∤",
                nshortparallel: "∦",
                nsim: "≁",
                nsime: "≄",
                nsimeq: "≄",
                nsmid: "∤",
                nspar: "∦",
                nsqsube: "⋢",
                nsqsupe: "⋣",
                nsub: "⊄",
                nsubE: "⫅̸",
                nsube: "⊈",
                nsubset: "⊂⃒",
                nsubseteq: "⊈",
                nsubseteqq: "⫅̸",
                nsucc: "⊁",
                nsucceq: "⪰̸",
                nsup: "⊅",
                nsupE: "⫆̸",
                nsupe: "⊉",
                nsupset: "⊃⃒",
                nsupseteq: "⊉",
                nsupseteqq: "⫆̸",
                ntgl: "≹",
                Ntilde: "Ñ",
                ntilde: "ñ",
                ntlg: "≸",
                ntriangleleft: "⋪",
                ntrianglelefteq: "⋬",
                ntriangleright: "⋫",
                ntrianglerighteq: "⋭",
                Nu: "Ν",
                nu: "ν",
                num: "#",
                numero: "№",
                numsp: " ",
                nvap: "≍⃒",
                nvdash: "⊬",
                nvDash: "⊭",
                nVdash: "⊮",
                nVDash: "⊯",
                nvge: "≥⃒",
                nvgt: ">⃒",
                nvHarr: "⤄",
                nvinfin: "⧞",
                nvlArr: "⤂",
                nvle: "≤⃒",
                nvlt: "<⃒",
                nvltrie: "⊴⃒",
                nvrArr: "⤃",
                nvrtrie: "⊵⃒",
                nvsim: "∼⃒",
                nwarhk: "⤣",
                nwarr: "↖",
                nwArr: "⇖",
                nwarrow: "↖",
                nwnear: "⤧",
                Oacute: "Ó",
                oacute: "ó",
                oast: "⊛",
                Ocirc: "Ô",
                ocirc: "ô",
                ocir: "⊚",
                Ocy: "О",
                ocy: "о",
                odash: "⊝",
                Odblac: "Ő",
                odblac: "ő",
                odiv: "⨸",
                odot: "⊙",
                odsold: "⦼",
                OElig: "Œ",
                oelig: "œ",
                ofcir: "⦿",
                Ofr: "𝔒",
                ofr: "𝔬",
                ogon: "˛",
                Ograve: "Ò",
                ograve: "ò",
                ogt: "⧁",
                ohbar: "⦵",
                ohm: "Ω",
                oint: "∮",
                olarr: "↺",
                olcir: "⦾",
                olcross: "⦻",
                oline: "‾",
                olt: "⧀",
                Omacr: "Ō",
                omacr: "ō",
                Omega: "Ω",
                omega: "ω",
                Omicron: "Ο",
                omicron: "ο",
                omid: "⦶",
                ominus: "⊖",
                Oopf: "𝕆",
                oopf: "𝕠",
                opar: "⦷",
                OpenCurlyDoubleQuote: "“",
                OpenCurlyQuote: "‘",
                operp: "⦹",
                oplus: "⊕",
                orarr: "↻",
                Or: "⩔",
                or: "∨",
                ord: "⩝",
                order: "ℴ",
                orderof: "ℴ",
                ordf: "ª",
                ordm: "º",
                origof: "⊶",
                oror: "⩖",
                orslope: "⩗",
                orv: "⩛",
                oS: "Ⓢ",
                Oscr: "𝒪",
                oscr: "ℴ",
                Oslash: "Ø",
                oslash: "ø",
                osol: "⊘",
                Otilde: "Õ",
                otilde: "õ",
                otimesas: "⨶",
                Otimes: "⨷",
                otimes: "⊗",
                Ouml: "Ö",
                ouml: "ö",
                ovbar: "⌽",
                OverBar: "‾",
                OverBrace: "⏞",
                OverBracket: "⎴",
                OverParenthesis: "⏜",
                para: "¶",
                parallel: "∥",
                par: "∥",
                parsim: "⫳",
                parsl: "⫽",
                part: "∂",
                PartialD: "∂",
                Pcy: "П",
                pcy: "п",
                percnt: "%",
                period: ".",
                permil: "‰",
                perp: "⊥",
                pertenk: "‱",
                Pfr: "𝔓",
                pfr: "𝔭",
                Phi: "Φ",
                phi: "φ",
                phiv: "ϕ",
                phmmat: "ℳ",
                phone: "☎",
                Pi: "Π",
                pi: "π",
                pitchfork: "⋔",
                piv: "ϖ",
                planck: "ℏ",
                planckh: "ℎ",
                plankv: "ℏ",
                plusacir: "⨣",
                plusb: "⊞",
                pluscir: "⨢",
                plus: "+",
                plusdo: "∔",
                plusdu: "⨥",
                pluse: "⩲",
                PlusMinus: "±",
                plusmn: "±",
                plussim: "⨦",
                plustwo: "⨧",
                pm: "±",
                Poincareplane: "ℌ",
                pointint: "⨕",
                popf: "𝕡",
                Popf: "ℙ",
                pound: "£",
                prap: "⪷",
                Pr: "⪻",
                pr: "≺",
                prcue: "≼",
                precapprox: "⪷",
                prec: "≺",
                preccurlyeq: "≼",
                Precedes: "≺",
                PrecedesEqual: "⪯",
                PrecedesSlantEqual: "≼",
                PrecedesTilde: "≾",
                preceq: "⪯",
                precnapprox: "⪹",
                precneqq: "⪵",
                precnsim: "⋨",
                pre: "⪯",
                prE: "⪳",
                precsim: "≾",
                prime: "′",
                Prime: "″",
                primes: "ℙ",
                prnap: "⪹",
                prnE: "⪵",
                prnsim: "⋨",
                prod: "∏",
                Product: "∏",
                profalar: "⌮",
                profline: "⌒",
                profsurf: "⌓",
                prop: "∝",
                Proportional: "∝",
                Proportion: "∷",
                propto: "∝",
                prsim: "≾",
                prurel: "⊰",
                Pscr: "𝒫",
                pscr: "𝓅",
                Psi: "Ψ",
                psi: "ψ",
                puncsp: " ",
                Qfr: "𝔔",
                qfr: "𝔮",
                qint: "⨌",
                qopf: "𝕢",
                Qopf: "ℚ",
                qprime: "⁗",
                Qscr: "𝒬",
                qscr: "𝓆",
                quaternions: "ℍ",
                quatint: "⨖",
                quest: "?",
                questeq: "≟",
                quot: '"',
                QUOT: '"',
                rAarr: "⇛",
                race: "∽̱",
                Racute: "Ŕ",
                racute: "ŕ",
                radic: "√",
                raemptyv: "⦳",
                rang: "⟩",
                Rang: "⟫",
                rangd: "⦒",
                range: "⦥",
                rangle: "⟩",
                raquo: "»",
                rarrap: "⥵",
                rarrb: "⇥",
                rarrbfs: "⤠",
                rarrc: "⤳",
                rarr: "→",
                Rarr: "↠",
                rArr: "⇒",
                rarrfs: "⤞",
                rarrhk: "↪",
                rarrlp: "↬",
                rarrpl: "⥅",
                rarrsim: "⥴",
                Rarrtl: "⤖",
                rarrtl: "↣",
                rarrw: "↝",
                ratail: "⤚",
                rAtail: "⤜",
                ratio: "∶",
                rationals: "ℚ",
                rbarr: "⤍",
                rBarr: "⤏",
                RBarr: "⤐",
                rbbrk: "❳",
                rbrace: "}",
                rbrack: "]",
                rbrke: "⦌",
                rbrksld: "⦎",
                rbrkslu: "⦐",
                Rcaron: "Ř",
                rcaron: "ř",
                Rcedil: "Ŗ",
                rcedil: "ŗ",
                rceil: "⌉",
                rcub: "}",
                Rcy: "Р",
                rcy: "р",
                rdca: "⤷",
                rdldhar: "⥩",
                rdquo: "”",
                rdquor: "”",
                rdsh: "↳",
                real: "ℜ",
                realine: "ℛ",
                realpart: "ℜ",
                reals: "ℝ",
                Re: "ℜ",
                rect: "▭",
                reg: "®",
                REG: "®",
                ReverseElement: "∋",
                ReverseEquilibrium: "⇋",
                ReverseUpEquilibrium: "⥯",
                rfisht: "⥽",
                rfloor: "⌋",
                rfr: "𝔯",
                Rfr: "ℜ",
                rHar: "⥤",
                rhard: "⇁",
                rharu: "⇀",
                rharul: "⥬",
                Rho: "Ρ",
                rho: "ρ",
                rhov: "ϱ",
                RightAngleBracket: "⟩",
                RightArrowBar: "⇥",
                rightarrow: "→",
                RightArrow: "→",
                Rightarrow: "⇒",
                RightArrowLeftArrow: "⇄",
                rightarrowtail: "↣",
                RightCeiling: "⌉",
                RightDoubleBracket: "⟧",
                RightDownTeeVector: "⥝",
                RightDownVectorBar: "⥕",
                RightDownVector: "⇂",
                RightFloor: "⌋",
                rightharpoondown: "⇁",
                rightharpoonup: "⇀",
                rightleftarrows: "⇄",
                rightleftharpoons: "⇌",
                rightrightarrows: "⇉",
                rightsquigarrow: "↝",
                RightTeeArrow: "↦",
                RightTee: "⊢",
                RightTeeVector: "⥛",
                rightthreetimes: "⋌",
                RightTriangleBar: "⧐",
                RightTriangle: "⊳",
                RightTriangleEqual: "⊵",
                RightUpDownVector: "⥏",
                RightUpTeeVector: "⥜",
                RightUpVectorBar: "⥔",
                RightUpVector: "↾",
                RightVectorBar: "⥓",
                RightVector: "⇀",
                ring: "˚",
                risingdotseq: "≓",
                rlarr: "⇄",
                rlhar: "⇌",
                rlm: "‏",
                rmoustache: "⎱",
                rmoust: "⎱",
                rnmid: "⫮",
                roang: "⟭",
                roarr: "⇾",
                robrk: "⟧",
                ropar: "⦆",
                ropf: "𝕣",
                Ropf: "ℝ",
                roplus: "⨮",
                rotimes: "⨵",
                RoundImplies: "⥰",
                rpar: ")",
                rpargt: "⦔",
                rppolint: "⨒",
                rrarr: "⇉",
                Rrightarrow: "⇛",
                rsaquo: "›",
                rscr: "𝓇",
                Rscr: "ℛ",
                rsh: "↱",
                Rsh: "↱",
                rsqb: "]",
                rsquo: "’",
                rsquor: "’",
                rthree: "⋌",
                rtimes: "⋊",
                rtri: "▹",
                rtrie: "⊵",
                rtrif: "▸",
                rtriltri: "⧎",
                RuleDelayed: "⧴",
                ruluhar: "⥨",
                rx: "℞",
                Sacute: "Ś",
                sacute: "ś",
                sbquo: "‚",
                scap: "⪸",
                Scaron: "Š",
                scaron: "š",
                Sc: "⪼",
                sc: "≻",
                sccue: "≽",
                sce: "⪰",
                scE: "⪴",
                Scedil: "Ş",
                scedil: "ş",
                Scirc: "Ŝ",
                scirc: "ŝ",
                scnap: "⪺",
                scnE: "⪶",
                scnsim: "⋩",
                scpolint: "⨓",
                scsim: "≿",
                Scy: "С",
                scy: "с",
                sdotb: "⊡",
                sdot: "⋅",
                sdote: "⩦",
                searhk: "⤥",
                searr: "↘",
                seArr: "⇘",
                searrow: "↘",
                sect: "§",
                semi: ";",
                seswar: "⤩",
                setminus: "∖",
                setmn: "∖",
                sext: "✶",
                Sfr: "𝔖",
                sfr: "𝔰",
                sfrown: "⌢",
                sharp: "♯",
                SHCHcy: "Щ",
                shchcy: "щ",
                SHcy: "Ш",
                shcy: "ш",
                ShortDownArrow: "↓",
                ShortLeftArrow: "←",
                shortmid: "∣",
                shortparallel: "∥",
                ShortRightArrow: "→",
                ShortUpArrow: "↑",
                shy: "­",
                Sigma: "Σ",
                sigma: "σ",
                sigmaf: "ς",
                sigmav: "ς",
                sim: "∼",
                simdot: "⩪",
                sime: "≃",
                simeq: "≃",
                simg: "⪞",
                simgE: "⪠",
                siml: "⪝",
                simlE: "⪟",
                simne: "≆",
                simplus: "⨤",
                simrarr: "⥲",
                slarr: "←",
                SmallCircle: "∘",
                smallsetminus: "∖",
                smashp: "⨳",
                smeparsl: "⧤",
                smid: "∣",
                smile: "⌣",
                smt: "⪪",
                smte: "⪬",
                smtes: "⪬︀",
                SOFTcy: "Ь",
                softcy: "ь",
                solbar: "⌿",
                solb: "⧄",
                sol: "/",
                Sopf: "𝕊",
                sopf: "𝕤",
                spades: "♠",
                spadesuit: "♠",
                spar: "∥",
                sqcap: "⊓",
                sqcaps: "⊓︀",
                sqcup: "⊔",
                sqcups: "⊔︀",
                Sqrt: "√",
                sqsub: "⊏",
                sqsube: "⊑",
                sqsubset: "⊏",
                sqsubseteq: "⊑",
                sqsup: "⊐",
                sqsupe: "⊒",
                sqsupset: "⊐",
                sqsupseteq: "⊒",
                square: "□",
                Square: "□",
                SquareIntersection: "⊓",
                SquareSubset: "⊏",
                SquareSubsetEqual: "⊑",
                SquareSuperset: "⊐",
                SquareSupersetEqual: "⊒",
                SquareUnion: "⊔",
                squarf: "▪",
                squ: "□",
                squf: "▪",
                srarr: "→",
                Sscr: "𝒮",
                sscr: "𝓈",
                ssetmn: "∖",
                ssmile: "⌣",
                sstarf: "⋆",
                Star: "⋆",
                star: "☆",
                starf: "★",
                straightepsilon: "ϵ",
                straightphi: "ϕ",
                strns: "¯",
                sub: "⊂",
                Sub: "⋐",
                subdot: "⪽",
                subE: "⫅",
                sube: "⊆",
                subedot: "⫃",
                submult: "⫁",
                subnE: "⫋",
                subne: "⊊",
                subplus: "⪿",
                subrarr: "⥹",
                subset: "⊂",
                Subset: "⋐",
                subseteq: "⊆",
                subseteqq: "⫅",
                SubsetEqual: "⊆",
                subsetneq: "⊊",
                subsetneqq: "⫋",
                subsim: "⫇",
                subsub: "⫕",
                subsup: "⫓",
                succapprox: "⪸",
                succ: "≻",
                succcurlyeq: "≽",
                Succeeds: "≻",
                SucceedsEqual: "⪰",
                SucceedsSlantEqual: "≽",
                SucceedsTilde: "≿",
                succeq: "⪰",
                succnapprox: "⪺",
                succneqq: "⪶",
                succnsim: "⋩",
                succsim: "≿",
                SuchThat: "∋",
                sum: "∑",
                Sum: "∑",
                sung: "♪",
                sup1: "¹",
                sup2: "²",
                sup3: "³",
                sup: "⊃",
                Sup: "⋑",
                supdot: "⪾",
                supdsub: "⫘",
                supE: "⫆",
                supe: "⊇",
                supedot: "⫄",
                Superset: "⊃",
                SupersetEqual: "⊇",
                suphsol: "⟉",
                suphsub: "⫗",
                suplarr: "⥻",
                supmult: "⫂",
                supnE: "⫌",
                supne: "⊋",
                supplus: "⫀",
                supset: "⊃",
                Supset: "⋑",
                supseteq: "⊇",
                supseteqq: "⫆",
                supsetneq: "⊋",
                supsetneqq: "⫌",
                supsim: "⫈",
                supsub: "⫔",
                supsup: "⫖",
                swarhk: "⤦",
                swarr: "↙",
                swArr: "⇙",
                swarrow: "↙",
                swnwar: "⤪",
                szlig: "ß",
                Tab: "\t",
                target: "⌖",
                Tau: "Τ",
                tau: "τ",
                tbrk: "⎴",
                Tcaron: "Ť",
                tcaron: "ť",
                Tcedil: "Ţ",
                tcedil: "ţ",
                Tcy: "Т",
                tcy: "т",
                tdot: "⃛",
                telrec: "⌕",
                Tfr: "𝔗",
                tfr: "𝔱",
                there4: "∴",
                therefore: "∴",
                Therefore: "∴",
                Theta: "Θ",
                theta: "θ",
                thetasym: "ϑ",
                thetav: "ϑ",
                thickapprox: "≈",
                thicksim: "∼",
                ThickSpace: "  ",
                ThinSpace: " ",
                thinsp: " ",
                thkap: "≈",
                thksim: "∼",
                THORN: "Þ",
                thorn: "þ",
                tilde: "˜",
                Tilde: "∼",
                TildeEqual: "≃",
                TildeFullEqual: "≅",
                TildeTilde: "≈",
                timesbar: "⨱",
                timesb: "⊠",
                times: "×",
                timesd: "⨰",
                tint: "∭",
                toea: "⤨",
                topbot: "⌶",
                topcir: "⫱",
                top: "⊤",
                Topf: "𝕋",
                topf: "𝕥",
                topfork: "⫚",
                tosa: "⤩",
                tprime: "‴",
                trade: "™",
                TRADE: "™",
                triangle: "▵",
                triangledown: "▿",
                triangleleft: "◃",
                trianglelefteq: "⊴",
                triangleq: "≜",
                triangleright: "▹",
                trianglerighteq: "⊵",
                tridot: "◬",
                trie: "≜",
                triminus: "⨺",
                TripleDot: "⃛",
                triplus: "⨹",
                trisb: "⧍",
                tritime: "⨻",
                trpezium: "⏢",
                Tscr: "𝒯",
                tscr: "𝓉",
                TScy: "Ц",
                tscy: "ц",
                TSHcy: "Ћ",
                tshcy: "ћ",
                Tstrok: "Ŧ",
                tstrok: "ŧ",
                twixt: "≬",
                twoheadleftarrow: "↞",
                twoheadrightarrow: "↠",
                Uacute: "Ú",
                uacute: "ú",
                uarr: "↑",
                Uarr: "↟",
                uArr: "⇑",
                Uarrocir: "⥉",
                Ubrcy: "Ў",
                ubrcy: "ў",
                Ubreve: "Ŭ",
                ubreve: "ŭ",
                Ucirc: "Û",
                ucirc: "û",
                Ucy: "У",
                ucy: "у",
                udarr: "⇅",
                Udblac: "Ű",
                udblac: "ű",
                udhar: "⥮",
                ufisht: "⥾",
                Ufr: "𝔘",
                ufr: "𝔲",
                Ugrave: "Ù",
                ugrave: "ù",
                uHar: "⥣",
                uharl: "↿",
                uharr: "↾",
                uhblk: "▀",
                ulcorn: "⌜",
                ulcorner: "⌜",
                ulcrop: "⌏",
                ultri: "◸",
                Umacr: "Ū",
                umacr: "ū",
                uml: "¨",
                UnderBar: "_",
                UnderBrace: "⏟",
                UnderBracket: "⎵",
                UnderParenthesis: "⏝",
                Union: "⋃",
                UnionPlus: "⊎",
                Uogon: "Ų",
                uogon: "ų",
                Uopf: "𝕌",
                uopf: "𝕦",
                UpArrowBar: "⤒",
                uparrow: "↑",
                UpArrow: "↑",
                Uparrow: "⇑",
                UpArrowDownArrow: "⇅",
                updownarrow: "↕",
                UpDownArrow: "↕",
                Updownarrow: "⇕",
                UpEquilibrium: "⥮",
                upharpoonleft: "↿",
                upharpoonright: "↾",
                uplus: "⊎",
                UpperLeftArrow: "↖",
                UpperRightArrow: "↗",
                upsi: "υ",
                Upsi: "ϒ",
                upsih: "ϒ",
                Upsilon: "Υ",
                upsilon: "υ",
                UpTeeArrow: "↥",
                UpTee: "⊥",
                upuparrows: "⇈",
                urcorn: "⌝",
                urcorner: "⌝",
                urcrop: "⌎",
                Uring: "Ů",
                uring: "ů",
                urtri: "◹",
                Uscr: "𝒰",
                uscr: "𝓊",
                utdot: "⋰",
                Utilde: "Ũ",
                utilde: "ũ",
                utri: "▵",
                utrif: "▴",
                uuarr: "⇈",
                Uuml: "Ü",
                uuml: "ü",
                uwangle: "⦧",
                vangrt: "⦜",
                varepsilon: "ϵ",
                varkappa: "ϰ",
                varnothing: "∅",
                varphi: "ϕ",
                varpi: "ϖ",
                varpropto: "∝",
                varr: "↕",
                vArr: "⇕",
                varrho: "ϱ",
                varsigma: "ς",
                varsubsetneq: "⊊︀",
                varsubsetneqq: "⫋︀",
                varsupsetneq: "⊋︀",
                varsupsetneqq: "⫌︀",
                vartheta: "ϑ",
                vartriangleleft: "⊲",
                vartriangleright: "⊳",
                vBar: "⫨",
                Vbar: "⫫",
                vBarv: "⫩",
                Vcy: "В",
                vcy: "в",
                vdash: "⊢",
                vDash: "⊨",
                Vdash: "⊩",
                VDash: "⊫",
                Vdashl: "⫦",
                veebar: "⊻",
                vee: "∨",
                Vee: "⋁",
                veeeq: "≚",
                vellip: "⋮",
                verbar: "|",
                Verbar: "‖",
                vert: "|",
                Vert: "‖",
                VerticalBar: "∣",
                VerticalLine: "|",
                VerticalSeparator: "❘",
                VerticalTilde: "≀",
                VeryThinSpace: " ",
                Vfr: "𝔙",
                vfr: "𝔳",
                vltri: "⊲",
                vnsub: "⊂⃒",
                vnsup: "⊃⃒",
                Vopf: "𝕍",
                vopf: "𝕧",
                vprop: "∝",
                vrtri: "⊳",
                Vscr: "𝒱",
                vscr: "𝓋",
                vsubnE: "⫋︀",
                vsubne: "⊊︀",
                vsupnE: "⫌︀",
                vsupne: "⊋︀",
                Vvdash: "⊪",
                vzigzag: "⦚",
                Wcirc: "Ŵ",
                wcirc: "ŵ",
                wedbar: "⩟",
                wedge: "∧",
                Wedge: "⋀",
                wedgeq: "≙",
                weierp: "℘",
                Wfr: "𝔚",
                wfr: "𝔴",
                Wopf: "𝕎",
                wopf: "𝕨",
                wp: "℘",
                wr: "≀",
                wreath: "≀",
                Wscr: "𝒲",
                wscr: "𝓌",
                xcap: "⋂",
                xcirc: "◯",
                xcup: "⋃",
                xdtri: "▽",
                Xfr: "𝔛",
                xfr: "𝔵",
                xharr: "⟷",
                xhArr: "⟺",
                Xi: "Ξ",
                xi: "ξ",
                xlarr: "⟵",
                xlArr: "⟸",
                xmap: "⟼",
                xnis: "⋻",
                xodot: "⨀",
                Xopf: "𝕏",
                xopf: "𝕩",
                xoplus: "⨁",
                xotime: "⨂",
                xrarr: "⟶",
                xrArr: "⟹",
                Xscr: "𝒳",
                xscr: "𝓍",
                xsqcup: "⨆",
                xuplus: "⨄",
                xutri: "△",
                xvee: "⋁",
                xwedge: "⋀",
                Yacute: "Ý",
                yacute: "ý",
                YAcy: "Я",
                yacy: "я",
                Ycirc: "Ŷ",
                ycirc: "ŷ",
                Ycy: "Ы",
                ycy: "ы",
                yen: "¥",
                Yfr: "𝔜",
                yfr: "𝔶",
                YIcy: "Ї",
                yicy: "ї",
                Yopf: "𝕐",
                yopf: "𝕪",
                Yscr: "𝒴",
                yscr: "𝓎",
                YUcy: "Ю",
                yucy: "ю",
                yuml: "ÿ",
                Yuml: "Ÿ",
                Zacute: "Ź",
                zacute: "ź",
                Zcaron: "Ž",
                zcaron: "ž",
                Zcy: "З",
                zcy: "з",
                Zdot: "Ż",
                zdot: "ż",
                zeetrf: "ℨ",
                ZeroWidthSpace: "​",
                Zeta: "Ζ",
                zeta: "ζ",
                zfr: "𝔷",
                Zfr: "ℨ",
                ZHcy: "Ж",
                zhcy: "ж",
                zigrarr: "⇝",
                zopf: "𝕫",
                Zopf: "ℤ",
                Zscr: "𝒵",
                zscr: "𝓏",
                zwj: "‍",
                zwnj: "‌"
            }
        }, {}],
        24: [function(require, module, exports) {
            module.exports = {
                Aacute: "Á",
                aacute: "á",
                Acirc: "Â",
                acirc: "â",
                acute: "´",
                AElig: "Æ",
                aelig: "æ",
                Agrave: "À",
                agrave: "à",
                amp: "&",
                AMP: "&",
                Aring: "Å",
                aring: "å",
                Atilde: "Ã",
                atilde: "ã",
                Auml: "Ä",
                auml: "ä",
                brvbar: "¦",
                Ccedil: "Ç",
                ccedil: "ç",
                cedil: "¸",
                cent: "¢",
                copy: "©",
                COPY: "©",
                curren: "¤",
                deg: "°",
                divide: "÷",
                Eacute: "É",
                eacute: "é",
                Ecirc: "Ê",
                ecirc: "ê",
                Egrave: "È",
                egrave: "è",
                ETH: "Ð",
                eth: "ð",
                Euml: "Ë",
                euml: "ë",
                frac12: "½",
                frac14: "¼",
                frac34: "¾",
                gt: ">",
                GT: ">",
                Iacute: "Í",
                iacute: "í",
                Icirc: "Î",
                icirc: "î",
                iexcl: "¡",
                Igrave: "Ì",
                igrave: "ì",
                iquest: "¿",
                Iuml: "Ï",
                iuml: "ï",
                laquo: "«",
                lt: "<",
                LT: "<",
                macr: "¯",
                micro: "µ",
                middot: "·",
                // nbsp: " ",
                not: "¬",
                Ntilde: "Ñ",
                ntilde: "ñ",
                Oacute: "Ó",
                oacute: "ó",
                Ocirc: "Ô",
                ocirc: "ô",
                Ograve: "Ò",
                ograve: "ò",
                ordf: "ª",
                ordm: "º",
                Oslash: "Ø",
                oslash: "ø",
                Otilde: "Õ",
                otilde: "õ",
                Ouml: "Ö",
                ouml: "ö",
                para: "¶",
                plusmn: "±",
                pound: "£",
                quot: '"',
                QUOT: '"',
                raquo: "»",
                reg: "®",
                REG: "®",
                sect: "§",
                shy: "­",
                sup1: "¹",
                sup2: "²",
                sup3: "³",
                szlig: "ß",
                THORN: "Þ",
                thorn: "þ",
                times: "×",
                Uacute: "Ú",
                uacute: "ú",
                Ucirc: "Û",
                ucirc: "û",
                Ugrave: "Ù",
                ugrave: "ù",
                uml: "¨",
                Uuml: "Ü",
                uuml: "ü",
                Yacute: "Ý",
                yacute: "ý",
                yen: "¥",
                yuml: "ÿ"
            }
        }, {}],
        25: [function(require, module, exports) {
            module.exports = {
                amp: "&",
                apos: "'",
                gt: ">",
                lt: "<",
                quot: '"'
            }
        }, {}],
        26: [function(require, module, exports) {
            var objectCreate = Object.create || objectCreatePolyfill;
            var objectKeys = Object.keys || objectKeysPolyfill;
            var bind = Function.prototype.bind || functionBindPolyfill;

            function EventEmitter() {
                if (!this._events || !Object.prototype.hasOwnProperty.call(this, "_events")) {
                    this._events = objectCreate(null);
                    this._eventsCount = 0
                }
                this._maxListeners = this._maxListeners || undefined
            }
            module.exports = EventEmitter;
            EventEmitter.EventEmitter = EventEmitter;
            EventEmitter.prototype._events = undefined;
            EventEmitter.prototype._maxListeners = undefined;
            var defaultMaxListeners = 10;
            var hasDefineProperty;
            try {
                var o = {};
                if (Object.defineProperty) Object.defineProperty(o, "x", {
                    value: 0
                });
                hasDefineProperty = o.x === 0
            } catch (err) {
                hasDefineProperty = false
            }
            if (hasDefineProperty) {
                Object.defineProperty(EventEmitter, "defaultMaxListeners", {
                    enumerable: true,
                    get: function() {
                        return defaultMaxListeners
                    },
                    set: function(arg) {
                        if (typeof arg !== "number" || arg < 0 || arg !== arg) throw new TypeError('"defaultMaxListeners" must be a positive number');
                        defaultMaxListeners = arg
                    }
                })
            } else {
                EventEmitter.defaultMaxListeners = defaultMaxListeners
            }
            EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
                if (typeof n !== "number" || n < 0 || isNaN(n)) throw new TypeError('"n" argument must be a positive number');
                this._maxListeners = n;
                return this
            };

            function $getMaxListeners(that) {
                if (that._maxListeners === undefined) return EventEmitter.defaultMaxListeners;
                return that._maxListeners
            }
            EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
                return $getMaxListeners(this)
            };

            function emitNone(handler, isFn, self) {
                if (isFn) handler.call(self);
                else {
                    var len = handler.length;
                    var listeners = arrayClone(handler, len);
                    for (var i = 0; i < len; ++i) listeners[i].call(self)
                }
            }

            function emitOne(handler, isFn, self, arg1) {
                if (isFn) handler.call(self, arg1);
                else {
                    var len = handler.length;
                    var listeners = arrayClone(handler, len);
                    for (var i = 0; i < len; ++i) listeners[i].call(self, arg1)
                }
            }

            function emitTwo(handler, isFn, self, arg1, arg2) {
                if (isFn) handler.call(self, arg1, arg2);
                else {
                    var len = handler.length;
                    var listeners = arrayClone(handler, len);
                    for (var i = 0; i < len; ++i) listeners[i].call(self, arg1, arg2)
                }
            }

            function emitThree(handler, isFn, self, arg1, arg2, arg3) {
                if (isFn) handler.call(self, arg1, arg2, arg3);
                else {
                    var len = handler.length;
                    var listeners = arrayClone(handler, len);
                    for (var i = 0; i < len; ++i) listeners[i].call(self, arg1, arg2, arg3)
                }
            }

            function emitMany(handler, isFn, self, args) {
                if (isFn) handler.apply(self, args);
                else {
                    var len = handler.length;
                    var listeners = arrayClone(handler, len);
                    for (var i = 0; i < len; ++i) listeners[i].apply(self, args)
                }
            }
            EventEmitter.prototype.emit = function emit(type) {
                var er, handler, len, args, i, events;
                var doError = type === "error";
                events = this._events;
                if (events) doError = doError && events.error == null;
                else if (!doError) return false;
                if (doError) {
                    if (arguments.length > 1) er = arguments[1];
                    if (er instanceof Error) {
                        throw er
                    } else {
                        var err = new Error('Unhandled "error" event. (' + er + ")");
                        err.context = er;
                        throw err
                    }
                    return false
                }
                handler = events[type];
                if (!handler) return false;
                var isFn = typeof handler === "function";
                len = arguments.length;
                switch (len) {
                    case 1:
                        emitNone(handler, isFn, this);
                        break;
                    case 2:
                        emitOne(handler, isFn, this, arguments[1]);
                        break;
                    case 3:
                        emitTwo(handler, isFn, this, arguments[1], arguments[2]);
                        break;
                    case 4:
                        emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
                        break;
                    default:
                        args = new Array(len - 1);
                        for (i = 1; i < len; i++) args[i - 1] = arguments[i];
                        emitMany(handler, isFn, this, args)
                }
                return true
            };

            function _addListener(target, type, listener, prepend) {
                var m;
                var events;
                var existing;
                if (typeof listener !== "function") throw new TypeError('"listener" argument must be a function');
                events = target._events;
                if (!events) {
                    events = target._events = objectCreate(null);
                    target._eventsCount = 0
                } else {
                    if (events.newListener) {
                        target.emit("newListener", type, listener.listener ? listener.listener : listener);
                        events = target._events
                    }
                    existing = events[type]
                }
                if (!existing) {
                    existing = events[type] = listener;
                    ++target._eventsCount
                } else {
                    if (typeof existing === "function") {
                        existing = events[type] = prepend ? [listener, existing] : [existing, listener]
                    } else {
                        if (prepend) {
                            existing.unshift(listener)
                        } else {
                            existing.push(listener)
                        }
                    }
                    if (!existing.warned) {
                        m = $getMaxListeners(target);
                        if (m && m > 0 && existing.length > m) {
                            existing.warned = true;
                            var w = new Error("Possible EventEmitter memory leak detected. " + existing.length + ' "' + String(type) + '" listeners ' + "added. Use emitter.setMaxListeners() to " + "increase limit.");
                            w.name = "MaxListenersExceededWarning";
                            w.emitter = target;
                            w.type = type;
                            w.count = existing.length;
                            if (typeof console === "object" && console.warn) {
                                console.warn("%s: %s", w.name, w.message)
                            }
                        }
                    }
                }
                return target
            }
            EventEmitter.prototype.addListener = function addListener(type, listener) {
                return _addListener(this, type, listener, false)
            };
            EventEmitter.prototype.on = EventEmitter.prototype.addListener;
            EventEmitter.prototype.prependListener = function prependListener(type, listener) {
                return _addListener(this, type, listener, true)
            };

            function onceWrapper() {
                if (!this.fired) {
                    this.target.removeListener(this.type, this.wrapFn);
                    this.fired = true;
                    switch (arguments.length) {
                        case 0:
                            return this.listener.call(this.target);
                        case 1:
                            return this.listener.call(this.target, arguments[0]);
                        case 2:
                            return this.listener.call(this.target, arguments[0], arguments[1]);
                        case 3:
                            return this.listener.call(this.target, arguments[0], arguments[1], arguments[2]);
                        default:
                            var args = new Array(arguments.length);
                            for (var i = 0; i < args.length; ++i) args[i] = arguments[i];
                            this.listener.apply(this.target, args)
                    }
                }
            }

            function _onceWrap(target, type, listener) {
                var state = {
                    fired: false,
                    wrapFn: undefined,
                    target: target,
                    type: type,
                    listener: listener
                };
                var wrapped = bind.call(onceWrapper, state);
                wrapped.listener = listener;
                state.wrapFn = wrapped;
                return wrapped
            }
            EventEmitter.prototype.once = function once(type, listener) {
                if (typeof listener !== "function") throw new TypeError('"listener" argument must be a function');
                this.on(type, _onceWrap(this, type, listener));
                return this
            };
            EventEmitter.prototype.prependOnceListener = function prependOnceListener(type, listener) {
                if (typeof listener !== "function") throw new TypeError('"listener" argument must be a function');
                this.prependListener(type, _onceWrap(this, type, listener));
                return this
            };
            EventEmitter.prototype.removeListener = function removeListener(type, listener) {
                var list, events, position, i, originalListener;
                if (typeof listener !== "function") throw new TypeError('"listener" argument must be a function');
                events = this._events;
                if (!events) return this;
                list = events[type];
                if (!list) return this;
                if (list === listener || list.listener === listener) {
                    if (--this._eventsCount === 0) this._events = objectCreate(null);
                    else {
                        delete events[type];
                        if (events.removeListener) this.emit("removeListener", type, list.listener || listener)
                    }
                } else if (typeof list !== "function") {
                    position = -1;
                    for (i = list.length - 1; i >= 0; i--) {
                        if (list[i] === listener || list[i].listener === listener) {
                            originalListener = list[i].listener;
                            position = i;
                            break
                        }
                    }
                    if (position < 0) return this;
                    if (position === 0) list.shift();
                    else spliceOne(list, position);
                    if (list.length === 1) events[type] = list[0];
                    if (events.removeListener) this.emit("removeListener", type, originalListener || listener)
                }
                return this
            };
            EventEmitter.prototype.removeAllListeners = function removeAllListeners(type) {
                var listeners, events, i;
                events = this._events;
                if (!events) return this;
                if (!events.removeListener) {
                    if (arguments.length === 0) {
                        this._events = objectCreate(null);
                        this._eventsCount = 0
                    } else if (events[type]) {
                        if (--this._eventsCount === 0) this._events = objectCreate(null);
                        else delete events[type]
                    }
                    return this
                }
                if (arguments.length === 0) {
                    var keys = objectKeys(events);
                    var key;
                    for (i = 0; i < keys.length; ++i) {
                        key = keys[i];
                        if (key === "removeListener") continue;
                        this.removeAllListeners(key)
                    }
                    this.removeAllListeners("removeListener");
                    this._events = objectCreate(null);
                    this._eventsCount = 0;
                    return this
                }
                listeners = events[type];
                if (typeof listeners === "function") {
                    this.removeListener(type, listeners)
                } else if (listeners) {
                    for (i = listeners.length - 1; i >= 0; i--) {
                        this.removeListener(type, listeners[i])
                    }
                }
                return this
            };

            function _listeners(target, type, unwrap) {
                var events = target._events;
                if (!events) return [];
                var evlistener = events[type];
                if (!evlistener) return [];
                if (typeof evlistener === "function") return unwrap ? [evlistener.listener || evlistener] : [evlistener];
                return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length)
            }
            EventEmitter.prototype.listeners = function listeners(type) {
                return _listeners(this, type, true)
            };
            EventEmitter.prototype.rawListeners = function rawListeners(type) {
                return _listeners(this, type, false)
            };
            EventEmitter.listenerCount = function(emitter, type) {
                if (typeof emitter.listenerCount === "function") {
                    return emitter.listenerCount(type)
                } else {
                    return listenerCount.call(emitter, type)
                }
            };
            EventEmitter.prototype.listenerCount = listenerCount;

            function listenerCount(type) {
                var events = this._events;
                if (events) {
                    var evlistener = events[type];
                    if (typeof evlistener === "function") {
                        return 1
                    } else if (evlistener) {
                        return evlistener.length
                    }
                }
                return 0
            }
            EventEmitter.prototype.eventNames = function eventNames() {
                return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : []
            };

            function spliceOne(list, index) {
                for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1) list[i] = list[k];
                list.pop()
            }

            function arrayClone(arr, n) {
                var copy = new Array(n);
                for (var i = 0; i < n; ++i) copy[i] = arr[i];
                return copy
            }

            function unwrapListeners(arr) {
                var ret = new Array(arr.length);
                for (var i = 0; i < ret.length; ++i) {
                    ret[i] = arr[i].listener || arr[i]
                }
                return ret
            }

            function objectCreatePolyfill(proto) {
                var F = function() {};
                F.prototype = proto;
                return new F
            }

            function objectKeysPolyfill(obj) {
                var keys = [];
                for (var k in obj)
                    if (Object.prototype.hasOwnProperty.call(obj, k)) {
                        keys.push(k)
                    } return k
            }

            function functionBindPolyfill(context) {
                var fn = this;
                return function() {
                    return fn.apply(context, arguments)
                }
            }
        }, {}],
        27: [function(require, module, exports) {
            module.exports = CollectingHandler;

            function CollectingHandler(cbs) {
                this._cbs = cbs || {};
                this.events = []
            }
            var EVENTS = require("./")
                .EVENTS;
            Object.keys(EVENTS)
                .forEach(function(name) {
                    if (EVENTS[name] === 0) {
                        name = "on" + name;
                        CollectingHandler.prototype[name] = function() {
                            this.events.push([name]);
                            if (this._cbs[name]) this._cbs[name]()
                        }
                    } else if (EVENTS[name] === 1) {
                        name = "on" + name;
                        CollectingHandler.prototype[name] = function(a) {
                            this.events.push([name, a]);
                            if (this._cbs[name]) this._cbs[name](a)
                        }
                    } else if (EVENTS[name] === 2) {
                        name = "on" + name;
                        CollectingHandler.prototype[name] = function(a, b) {
                            this.events.push([name, a, b]);
                            if (this._cbs[name]) this._cbs[name](a, b)
                        }
                    } else {
                        throw Error("wrong number of arguments")
                    }
                });
            CollectingHandler.prototype.onreset = function() {
                this.events = [];
                if (this._cbs.onreset) this._cbs.onreset()
            };
            CollectingHandler.prototype.restart = function() {
                if (this._cbs.onreset) this._cbs.onreset();
                for (var i = 0, len = this.events.length; i < len; i++) {
                    if (this._cbs[this.events[i][0]]) {
                        var num = this.events[i].length;
                        if (num === 1) {
                            this._cbs[this.events[i][0]]()
                        } else if (num === 2) {
                            this._cbs[this.events[i][0]](this.events[i][1])
                        } else {
                            this._cbs[this.events[i][0]](this.events[i][1], this.events[i][2])
                        }
                    }
                }
            }
        }, {
            "./": 34
        }],
        28: [function(require, module, exports) {
            var DomHandler = require("domhandler");
            var DomUtils = require("domutils");

            function FeedHandler(callback, options) {
                this.init(callback, options)
            }
            require("inherits")(FeedHandler, DomHandler);
            FeedHandler.prototype.init = DomHandler;

            function getElements(what, where) {
                return DomUtils.getElementsByTagName(what, where, true)
            }

            function getOneElement(what, where) {
                return DomUtils.getElementsByTagName(what, where, true, 1)[0]
            }

            function fetch(what, where, recurse) {
                return DomUtils.getText(DomUtils.getElementsByTagName(what, where, recurse, 1))
                    .trim()
            }

            function addConditionally(obj, prop, what, where, recurse) {
                var tmp = fetch(what, where, recurse);
                if (tmp) obj[prop] = tmp
            }
            var isValidFeed = function(value) {
                return value === "rss" || value === "feed" || value === "rdf:RDF"
            };
            FeedHandler.prototype.onend = function() {
                var feed = {},
                    feedRoot = getOneElement(isValidFeed, this.dom),
                    tmp, childs;
                if (feedRoot) {
                    if (feedRoot.name === "feed") {
                        childs = feedRoot.children;
                        feed.type = "atom";
                        addConditionally(feed, "id", "id", childs);
                        addConditionally(feed, "title", "title", childs);
                        if ((tmp = getOneElement("link", childs)) && (tmp = tmp.attribs) && (tmp = tmp.href)) feed.link = tmp;
                        addConditionally(feed, "description", "subtitle", childs);
                        if (tmp = fetch("updated", childs)) feed.updated = new Date(tmp);
                        addConditionally(feed, "author", "email", childs, true);
                        feed.items = getElements("entry", childs)
                            .map(function(item) {
                                var entry = {},
                                    tmp;
                                item = item.children;
                                addConditionally(entry, "id", "id", item);
                                addConditionally(entry, "title", "title", item);
                                if ((tmp = getOneElement("link", item)) && (tmp = tmp.attribs) && (tmp = tmp.href)) entry.link = tmp;
                                if (tmp = fetch("summary", item) || fetch("content", item)) entry.description = tmp;
                                if (tmp = fetch("updated", item)) entry.pubDate = new Date(tmp);
                                return entry
                            })
                    } else {
                        childs = getOneElement("channel", feedRoot.children)
                            .children;
                        feed.type = feedRoot.name.substr(0, 3);
                        feed.id = "";
                        addConditionally(feed, "title", "title", childs);
                        addConditionally(feed, "link", "link", childs);
                        addConditionally(feed, "description", "description", childs);
                        if (tmp = fetch("lastBuildDate", childs)) feed.updated = new Date(tmp);
                        addConditionally(feed, "author", "managingEditor", childs, true);
                        feed.items = getElements("item", feedRoot.children)
                            .map(function(item) {
                                var entry = {},
                                    tmp;
                                item = item.children;
                                addConditionally(entry, "id", "guid", item);
                                addConditionally(entry, "title", "title", item);
                                addConditionally(entry, "link", "link", item);
                                addConditionally(entry, "description", "description", item);
                                if (tmp = fetch("pubDate", item)) entry.pubDate = new Date(tmp);
                                return entry
                            })
                    }
                }
                this.dom = feed;
                DomHandler.prototype._handleCallback.call(this, feedRoot ? null : Error("couldn't find root of feed"))
            };
            module.exports = FeedHandler
        }, {
            domhandler: 8,
            domutils: 11,
            inherits: 36
        }],
        29: [function(require, module, exports) {
            var Tokenizer = require("./Tokenizer.js");
            var formTags = {
                input: true,
                option: true,
                optgroup: true,
                select: true,
                button: true,
                datalist: true,
                textarea: true
            };
            var openImpliesClose = {
                tr: {
                    tr: true,
                    th: true,
                    td: true
                },
                th: {
                    th: true
                },
                td: {
                    thead: true,
                    th: true,
                    td: true
                },
                body: {
                    head: true,
                    link: true,
                    script: true
                },
                li: {
                    li: true
                },
                p: {
                    p: true
                },
                h1: {
                    p: true
                },
                h2: {
                    p: true
                },
                h3: {
                    p: true
                },
                h4: {
                    p: true
                },
                h5: {
                    p: true
                },
                h6: {
                    p: true
                },
                select: formTags,
                input: formTags,
                output: formTags,
                button: formTags,
                datalist: formTags,
                textarea: formTags,
                option: {
                    option: true
                },
                optgroup: {
                    optgroup: true
                }
            };
            var voidElements = {
                __proto__: null,
                area: true,
                base: true,
                basefont: true,
                br: true,
                col: true,
                command: true,
                embed: true,
                frame: true,
                hr: true,
                img: true,
                input: true,
                isindex: true,
                keygen: true,
                link: true,
                meta: true,
                param: true,
                source: true,
                track: true,
                wbr: true
            };
            var foreignContextElements = {
                __proto__: null,
                math: true,
                svg: true
            };
            var htmlIntegrationElements = {
                __proto__: null,
                mi: true,
                mo: true,
                mn: true,
                ms: true,
                mtext: true,
                "annotation-xml": true,
                foreignObject: true,
                desc: true,
                title: true
            };
            var re_nameEnd = /\s|\//;

            function Parser(cbs, options) {
                this._options = options || {};
                this._cbs = cbs || {};
                this._tagname = "";
                this._attribname = "";
                this._attribvalue = "";
                this._attribs = null;
                this._stack = [];
                this._foreignContext = [];
                this.startIndex = 0;
                this.endIndex = null;
                this._lowerCaseTagNames = "lowerCaseTags" in this._options ? !!this._options.lowerCaseTags : !this._options.xmlMode;
                this._lowerCaseAttributeNames = "lowerCaseAttributeNames" in this._options ? !!this._options.lowerCaseAttributeNames : !this._options.xmlMode;
                if (this._options.Tokenizer) {
                    Tokenizer = this._options.Tokenizer
                }
                this._tokenizer = new Tokenizer(this._options, this);
                if (this._cbs.onparserinit) this._cbs.onparserinit(this)
            }
            require("inherits")(Parser, require("events")
                .EventEmitter);
            Parser.prototype._updatePosition = function(initialOffset) {
                if (this.endIndex === null) {
                    if (this._tokenizer._sectionStart <= initialOffset) {
                        this.startIndex = 0
                    } else {
                        this.startIndex = this._tokenizer._sectionStart - initialOffset
                    }
                } else this.startIndex = this.endIndex + 1;
                this.endIndex = this._tokenizer.getAbsoluteIndex()
            };
            Parser.prototype.ontext = function(data) {
                this._updatePosition(1);
                this.endIndex--;
                if (this._cbs.ontext) this._cbs.ontext(data)
            };
            Parser.prototype.onopentagname = function(name) {
                if (this._lowerCaseTagNames) {
                    name = name.toLowerCase()
                }
                this._tagname = name;
                if (!this._options.xmlMode && name in openImpliesClose) {
                    for (var el;
                        (el = this._stack[this._stack.length - 1]) in openImpliesClose[name]; this.onclosetag(el));
                }
                if (this._options.xmlMode || !(name in voidElements)) {
                    this._stack.push(name);
                    if (name in foreignContextElements) this._foreignContext.push(true);
                    else if (name in htmlIntegrationElements) this._foreignContext.push(false)
                }
                if (this._cbs.onopentagname) this._cbs.onopentagname(name);
                if (this._cbs.onopentag) this._attribs = {}
            };
            Parser.prototype.onopentagend = function() {
                this._updatePosition(1);
                if (this._attribs) {
                    if (this._cbs.onopentag) this._cbs.onopentag(this._tagname, this._attribs);
                    this._attribs = null
                }
                if (!this._options.xmlMode && this._cbs.onclosetag && this._tagname in voidElements) {
                    this._cbs.onclosetag(this._tagname)
                }
                this._tagname = ""
            };
            Parser.prototype.onclosetag = function(name) {
                this._updatePosition(1);
                if (this._lowerCaseTagNames) {
                    name = name.toLowerCase()
                }
                if (name in foreignContextElements || name in htmlIntegrationElements) {
                    this._foreignContext.pop()
                }
                if (this._stack.length && (!(name in voidElements) || this._options.xmlMode)) {
                    var pos = this._stack.lastIndexOf(name);
                    if (pos !== -1) {
                        if (this._cbs.onclosetag) {
                            pos = this._stack.length - pos;
                            while (pos--) this._cbs.onclosetag(this._stack.pop())
                        } else this._stack.length = pos
                    } else if (name === "p" && !this._options.xmlMode) {
                        this.onopentagname(name);
                        this._closeCurrentTag()
                    }
                } else if (!this._options.xmlMode && (name === "br" || name === "p")) {
                    this.onopentagname(name);
                    this._closeCurrentTag()
                }
            };
            Parser.prototype.onselfclosingtag = function() {
                if (this._options.xmlMode || this._options.recognizeSelfClosing || this._foreignContext[this._foreignContext.length - 1]) {
                    this._closeCurrentTag()
                } else {
                    this.onopentagend()
                }
            };
            Parser.prototype._closeCurrentTag = function() {
                var name = this._tagname;
                this.onopentagend();
                if (this._stack[this._stack.length - 1] === name) {
                    if (this._cbs.onclosetag) {
                        this._cbs.onclosetag(name)
                    }
                    this._stack.pop()
                }
            };
            Parser.prototype.onattribname = function(name) {
                if (this._lowerCaseAttributeNames) {
                    name = name.toLowerCase()
                }
                this._attribname = name
            };
            Parser.prototype.onattribdata = function(value) {
                this._attribvalue += value
            };
            Parser.prototype.onattribend = function() {
                if (this._cbs.onattribute) this._cbs.onattribute(this._attribname, this._attribvalue);
                if (this._attribs && !Object.prototype.hasOwnProperty.call(this._attribs, this._attribname)) {
                    this._attribs[this._attribname] = this._attribvalue
                }
                this._attribname = "";
                this._attribvalue = ""
            };
            Parser.prototype._getInstructionName = function(value) {
                var idx = value.search(re_nameEnd),
                    name = idx < 0 ? value : value.substr(0, idx);
                if (this._lowerCaseTagNames) {
                    name = name.toLowerCase()
                }
                return name
            };
            Parser.prototype.ondeclaration = function(value) {
                if (this._cbs.onprocessinginstruction) {
                    var name = this._getInstructionName(value);
                    this._cbs.onprocessinginstruction("!" + name, "!" + value)
                }
            };
            Parser.prototype.onprocessinginstruction = function(value) {
                if (this._cbs.onprocessinginstruction) {
                    var name = this._getInstructionName(value);
                    this._cbs.onprocessinginstruction("?" + name, "?" + value)
                }
            };
            Parser.prototype.oncomment = function(value) {
                this._updatePosition(4);
                if (this._cbs.oncomment) this._cbs.oncomment(value);
                if (this._cbs.oncommentend) this._cbs.oncommentend()
            };
            Parser.prototype.oncdata = function(value) {
                this._updatePosition(1);
                if (this._options.xmlMode || this._options.recognizeCDATA) {
                    if (this._cbs.oncdatastart) this._cbs.oncdatastart();
                    if (this._cbs.ontext) this._cbs.ontext(value);
                    if (this._cbs.oncdataend) this._cbs.oncdataend()
                } else {
                    this.oncomment("[CDATA[" + value + "]]")
                }
            };
            Parser.prototype.onerror = function(err) {
                if (this._cbs.onerror) this._cbs.onerror(err)
            };
            Parser.prototype.onend = function() {
                if (this._cbs.onclosetag) {
                    for (var i = this._stack.length; i > 0; this._cbs.onclosetag(this._stack[--i]));
                }
                if (this._cbs.onend) this._cbs.onend()
            };
            Parser.prototype.reset = function() {
                if (this._cbs.onreset) this._cbs.onreset();
                this._tokenizer.reset();
                this._tagname = "";
                this._attribname = "";
                this._attribs = null;
                this._stack = [];
                if (this._cbs.onparserinit) this._cbs.onparserinit(this)
            };
            Parser.prototype.parseComplete = function(data) {
                this.reset();
                this.end(data)
            };
            Parser.prototype.write = function(chunk) {
                this._tokenizer.write(chunk)
            };
            Parser.prototype.end = function(chunk) {
                this._tokenizer.end(chunk)
            };
            Parser.prototype.pause = function() {
                this._tokenizer.pause()
            };
            Parser.prototype.resume = function() {
                this._tokenizer.resume()
            };
            Parser.prototype.parseChunk = Parser.prototype.write;
            Parser.prototype.done = Parser.prototype.end;
            module.exports = Parser
        }, {
            "./Tokenizer.js": 32,
            events: 26,
            inherits: 36
        }],
        30: [function(require, module, exports) {
            module.exports = ProxyHandler;

            function ProxyHandler(cbs) {
                this._cbs = cbs || {}
            }
            var EVENTS = require("./")
                .EVENTS;
            Object.keys(EVENTS)
                .forEach(function(name) {
                    if (EVENTS[name] === 0) {
                        name = "on" + name;
                        ProxyHandler.prototype[name] = function() {
                            if (this._cbs[name]) this._cbs[name]()
                        }
                    } else if (EVENTS[name] === 1) {
                        name = "on" + name;
                        ProxyHandler.prototype[name] = function(a) {
                            if (this._cbs[name]) this._cbs[name](a)
                        }
                    } else if (EVENTS[name] === 2) {
                        name = "on" + name;
                        ProxyHandler.prototype[name] = function(a, b) {
                            if (this._cbs[name]) this._cbs[name](a, b)
                        }
                    } else {
                        throw Error("wrong number of arguments")
                    }
                })
        }, {
            "./": 34
        }],
        31: [function(require, module, exports) {
            module.exports = Stream;
            var Parser = require("./WritableStream.js");

            function Stream(options) {
                Parser.call(this, new Cbs(this), options)
            }
            require("inherits")(Stream, Parser);
            Stream.prototype.readable = true;

            function Cbs(scope) {
                this.scope = scope
            }
            var EVENTS = require("../")
                .EVENTS;
            Object.keys(EVENTS)
                .forEach(function(name) {
                    if (EVENTS[name] === 0) {
                        Cbs.prototype["on" + name] = function() {
                            this.scope.emit(name)
                        }
                    } else if (EVENTS[name] === 1) {
                        Cbs.prototype["on" + name] = function(a) {
                            this.scope.emit(name, a)
                        }
                    } else if (EVENTS[name] === 2) {
                        Cbs.prototype["on" + name] = function(a, b) {
                            this.scope.emit(name, a, b)
                        }
                    } else {
                        throw Error("wrong number of arguments!")
                    }
                })
        }, {
            "../": 34,
            "./WritableStream.js": 33,
            inherits: 36
        }],
        32: [function(require, module, exports) {
            module.exports = Tokenizer;
            var decodeCodePoint = require("entities/lib/decode_codepoint.js");
            var entityMap = require("entities/maps/entities.json");
            var legacyMap = require("entities/maps/legacy.json");
            var xmlMap = require("entities/maps/xml.json");
            var i = 0;
            var TEXT = i++;
            var BEFORE_TAG_NAME = i++;
            var IN_TAG_NAME = i++;
            var IN_SELF_CLOSING_TAG = i++;
            var BEFORE_CLOSING_TAG_NAME = i++;
            var IN_CLOSING_TAG_NAME = i++;
            var AFTER_CLOSING_TAG_NAME = i++;
            var BEFORE_ATTRIBUTE_NAME = i++;
            var IN_ATTRIBUTE_NAME = i++;
            var AFTER_ATTRIBUTE_NAME = i++;
            var BEFORE_ATTRIBUTE_VALUE = i++;
            var IN_ATTRIBUTE_VALUE_DQ = i++;
            var IN_ATTRIBUTE_VALUE_SQ = i++;
            var IN_ATTRIBUTE_VALUE_NQ = i++;
            var BEFORE_DECLARATION = i++;
            var IN_DECLARATION = i++;
            var IN_PROCESSING_INSTRUCTION = i++;
            var BEFORE_COMMENT = i++;
            var IN_COMMENT = i++;
            var AFTER_COMMENT_1 = i++;
            var AFTER_COMMENT_2 = i++;
            var BEFORE_CDATA_1 = i++;
            var BEFORE_CDATA_2 = i++;
            var BEFORE_CDATA_3 = i++;
            var BEFORE_CDATA_4 = i++;
            var BEFORE_CDATA_5 = i++;
            var BEFORE_CDATA_6 = i++;
            var IN_CDATA = i++;
            var AFTER_CDATA_1 = i++;
            var AFTER_CDATA_2 = i++;
            var BEFORE_SPECIAL = i++;
            var BEFORE_SPECIAL_END = i++;
            var BEFORE_SCRIPT_1 = i++;
            var BEFORE_SCRIPT_2 = i++;
            var BEFORE_SCRIPT_3 = i++;
            var BEFORE_SCRIPT_4 = i++;
            var BEFORE_SCRIPT_5 = i++;
            var AFTER_SCRIPT_1 = i++;
            var AFTER_SCRIPT_2 = i++;
            var AFTER_SCRIPT_3 = i++;
            var AFTER_SCRIPT_4 = i++;
            var AFTER_SCRIPT_5 = i++;
            var BEFORE_STYLE_1 = i++;
            var BEFORE_STYLE_2 = i++;
            var BEFORE_STYLE_3 = i++;
            var BEFORE_STYLE_4 = i++;
            var AFTER_STYLE_1 = i++;
            var AFTER_STYLE_2 = i++;
            var AFTER_STYLE_3 = i++;
            var AFTER_STYLE_4 = i++;
            var BEFORE_ENTITY = i++;
            var BEFORE_NUMERIC_ENTITY = i++;
            var IN_NAMED_ENTITY = i++;
            var IN_NUMERIC_ENTITY = i++;
            var IN_HEX_ENTITY = i++;
            var j = 0;
            var SPECIAL_NONE = j++;
            var SPECIAL_SCRIPT = j++;
            var SPECIAL_STYLE = j++;

            function whitespace(c) {
                return c === " " || c === "\n" || c === "\t" || c === "\f" || c === "\r"
            }

            function ifElseState(upper, SUCCESS, FAILURE) {
                var lower = upper.toLowerCase();
                if (upper === lower) {
                    return function(c) {
                        if (c === lower) {
                            this._state = SUCCESS
                        } else {
                            this._state = FAILURE;
                            this._index--
                        }
                    }
                } else {
                    return function(c) {
                        if (c === lower || c === upper) {
                            this._state = SUCCESS
                        } else {
                            this._state = FAILURE;
                            this._index--
                        }
                    }
                }
            }

            function consumeSpecialNameChar(upper, NEXT_STATE) {
                var lower = upper.toLowerCase();
                return function(c) {
                    if (c === lower || c === upper) {
                        this._state = NEXT_STATE
                    } else {
                        this._state = IN_TAG_NAME;
                        this._index--
                    }
                }
            }

            function Tokenizer(options, cbs) {
                this._state = TEXT;
                this._buffer = "";
                this._sectionStart = 0;
                this._index = 0;
                this._bufferOffset = 0;
                this._baseState = TEXT;
                this._special = SPECIAL_NONE;
                this._cbs = cbs;
                this._running = true;
                this._ended = false;
                this._xmlMode = !!(options && options.xmlMode);
                this._decodeEntities = !!(options && options.decodeEntities)
            }
            Tokenizer.prototype._stateText = function(c) {
                if (c === "<") {
                    if (this._index > this._sectionStart) {
                        this._cbs.ontext(this._getSection())
                    }
                    this._state = BEFORE_TAG_NAME;
                    this._sectionStart = this._index
                } else if (this._decodeEntities && this._special === SPECIAL_NONE && c === "&") {
                    if (this._index > this._sectionStart) {
                        this._cbs.ontext(this._getSection())
                    }
                    this._baseState = TEXT;
                    this._state = BEFORE_ENTITY;
                    this._sectionStart = this._index
                }
            };
            Tokenizer.prototype._stateBeforeTagName = function(c) {
                if (c === "/") {
                    this._state = BEFORE_CLOSING_TAG_NAME
                } else if (c === "<") {
                    this._cbs.ontext(this._getSection());
                    this._sectionStart = this._index
                } else if (c === ">" || this._special !== SPECIAL_NONE || whitespace(c)) {
                    this._state = TEXT
                } else if (c === "!") {
                    this._state = BEFORE_DECLARATION;
                    this._sectionStart = this._index + 1
                } else if (c === "?") {
                    this._state = IN_PROCESSING_INSTRUCTION;
                    this._sectionStart = this._index + 1
                } else {
                    this._state = !this._xmlMode && (c === "s" || c === "S") ? BEFORE_SPECIAL : IN_TAG_NAME;
                    this._sectionStart = this._index
                }
            };
            Tokenizer.prototype._stateInTagName = function(c) {
                if (c === "/" || c === ">" || whitespace(c)) {
                    this._emitToken("onopentagname");
                    this._state = BEFORE_ATTRIBUTE_NAME;
                    this._index--
                }
            };
            Tokenizer.prototype._stateBeforeCloseingTagName = function(c) {
                if (whitespace(c));
                else if (c === ">") {
                    this._state = TEXT
                } else if (this._special !== SPECIAL_NONE) {
                    if (c === "s" || c === "S") {
                        this._state = BEFORE_SPECIAL_END
                    } else {
                        this._state = TEXT;
                        this._index--
                    }
                } else {
                    this._state = IN_CLOSING_TAG_NAME;
                    this._sectionStart = this._index
                }
            };
            Tokenizer.prototype._stateInCloseingTagName = function(c) {
                if (c === ">" || whitespace(c)) {
                    this._emitToken("onclosetag");
                    this._state = AFTER_CLOSING_TAG_NAME;
                    this._index--
                }
            };
            Tokenizer.prototype._stateAfterCloseingTagName = function(c) {
                if (c === ">") {
                    this._state = TEXT;
                    this._sectionStart = this._index + 1
                }
            };
            Tokenizer.prototype._stateBeforeAttributeName = function(c) {
                if (c === ">") {
                    this._cbs.onopentagend();
                    this._state = TEXT;
                    this._sectionStart = this._index + 1
                } else if (c === "/") {
                    this._state = IN_SELF_CLOSING_TAG
                } else if (!whitespace(c)) {
                    this._state = IN_ATTRIBUTE_NAME;
                    this._sectionStart = this._index
                }
            };
            Tokenizer.prototype._stateInSelfClosingTag = function(c) {
                if (c === ">") {
                    this._cbs.onselfclosingtag();
                    this._state = TEXT;
                    this._sectionStart = this._index + 1
                } else if (!whitespace(c)) {
                    this._state = BEFORE_ATTRIBUTE_NAME;
                    this._index--
                }
            };
            Tokenizer.prototype._stateInAttributeName = function(c) {
                if (c === "=" || c === "/" || c === ">" || whitespace(c)) {
                    this._cbs.onattribname(this._getSection());
                    this._sectionStart = -1;
                    this._state = AFTER_ATTRIBUTE_NAME;
                    this._index--
                }
            };
            Tokenizer.prototype._stateAfterAttributeName = function(c) {
                if (c === "=") {
                    this._state = BEFORE_ATTRIBUTE_VALUE
                } else if (c === "/" || c === ">") {
                    this._cbs.onattribend();
                    this._state = BEFORE_ATTRIBUTE_NAME;
                    this._index--
                } else if (!whitespace(c)) {
                    this._cbs.onattribend();
                    this._state = IN_ATTRIBUTE_NAME;
                    this._sectionStart = this._index
                }
            };
            Tokenizer.prototype._stateBeforeAttributeValue = function(c) {
                if (c === '"') {
                    this._state = IN_ATTRIBUTE_VALUE_DQ;
                    this._sectionStart = this._index + 1
                } else if (c === "'") {
                    this._state = IN_ATTRIBUTE_VALUE_SQ;
                    this._sectionStart = this._index + 1
                } else if (!whitespace(c)) {
                    this._state = IN_ATTRIBUTE_VALUE_NQ;
                    this._sectionStart = this._index;
                    this._index--
                }
            };
            Tokenizer.prototype._stateInAttributeValueDoubleQuotes = function(c) {
                if (c === '"') {
                    this._emitToken("onattribdata");
                    this._cbs.onattribend();
                    this._state = BEFORE_ATTRIBUTE_NAME
                } else if (this._decodeEntities && c === "&") {
                    this._emitToken("onattribdata");
                    this._baseState = this._state;
                    this._state = BEFORE_ENTITY;
                    this._sectionStart = this._index
                }
            };
            Tokenizer.prototype._stateInAttributeValueSingleQuotes = function(c) {
                if (c === "'") {
                    this._emitToken("onattribdata");
                    this._cbs.onattribend();
                    this._state = BEFORE_ATTRIBUTE_NAME
                } else if (this._decodeEntities && c === "&") {
                    this._emitToken("onattribdata");
                    this._baseState = this._state;
                    this._state = BEFORE_ENTITY;
                    this._sectionStart = this._index
                }
            };
            Tokenizer.prototype._stateInAttributeValueNoQuotes = function(c) {
                if (whitespace(c) || c === ">") {
                    this._emitToken("onattribdata");
                    this._cbs.onattribend();
                    this._state = BEFORE_ATTRIBUTE_NAME;
                    this._index--
                } else if (this._decodeEntities && c === "&") {
                    this._emitToken("onattribdata");
                    this._baseState = this._state;
                    this._state = BEFORE_ENTITY;
                    this._sectionStart = this._index
                }
            };
            Tokenizer.prototype._stateBeforeDeclaration = function(c) {
                this._state = c === "[" ? BEFORE_CDATA_1 : c === "-" ? BEFORE_COMMENT : IN_DECLARATION
            };
            Tokenizer.prototype._stateInDeclaration = function(c) {
                if (c === ">") {
                    this._cbs.ondeclaration(this._getSection());
                    this._state = TEXT;
                    this._sectionStart = this._index + 1
                }
            };
            Tokenizer.prototype._stateInProcessingInstruction = function(c) {
                if (c === ">") {
                    this._cbs.onprocessinginstruction(this._getSection());
                    this._state = TEXT;
                    this._sectionStart = this._index + 1
                }
            };
            Tokenizer.prototype._stateBeforeComment = function(c) {
                if (c === "-") {
                    this._state = IN_COMMENT;
                    this._sectionStart = this._index + 1
                } else {
                    this._state = IN_DECLARATION
                }
            };
            Tokenizer.prototype._stateInComment = function(c) {
                if (c === "-") this._state = AFTER_COMMENT_1
            };
            Tokenizer.prototype._stateAfterComment1 = function(c) {
                if (c === "-") {
                    this._state = AFTER_COMMENT_2
                } else {
                    this._state = IN_COMMENT
                }
            };
            Tokenizer.prototype._stateAfterComment2 = function(c) {
                if (c === ">") {
                    this._cbs.oncomment(this._buffer.substring(this._sectionStart, this._index - 2));
                    this._state = TEXT;
                    this._sectionStart = this._index + 1
                } else if (c !== "-") {
                    this._state = IN_COMMENT
                }
            };
            Tokenizer.prototype._stateBeforeCdata1 = ifElseState("C", BEFORE_CDATA_2, IN_DECLARATION);
            Tokenizer.prototype._stateBeforeCdata2 = ifElseState("D", BEFORE_CDATA_3, IN_DECLARATION);
            Tokenizer.prototype._stateBeforeCdata3 = ifElseState("A", BEFORE_CDATA_4, IN_DECLARATION);
            Tokenizer.prototype._stateBeforeCdata4 = ifElseState("T", BEFORE_CDATA_5, IN_DECLARATION);
            Tokenizer.prototype._stateBeforeCdata5 = ifElseState("A", BEFORE_CDATA_6, IN_DECLARATION);
            Tokenizer.prototype._stateBeforeCdata6 = function(c) {
                if (c === "[") {
                    this._state = IN_CDATA;
                    this._sectionStart = this._index + 1
                } else {
                    this._state = IN_DECLARATION;
                    this._index--
                }
            };
            Tokenizer.prototype._stateInCdata = function(c) {
                if (c === "]") this._state = AFTER_CDATA_1
            };
            Tokenizer.prototype._stateAfterCdata1 = function(c) {
                if (c === "]") this._state = AFTER_CDATA_2;
                else this._state = IN_CDATA
            };
            Tokenizer.prototype._stateAfterCdata2 = function(c) {
                if (c === ">") {
                    this._cbs.oncdata(this._buffer.substring(this._sectionStart, this._index - 2));
                    this._state = TEXT;
                    this._sectionStart = this._index + 1
                } else if (c !== "]") {
                    this._state = IN_CDATA
                }
            };
            Tokenizer.prototype._stateBeforeSpecial = function(c) {
                if (c === "c" || c === "C") {
                    this._state = BEFORE_SCRIPT_1
                } else if (c === "t" || c === "T") {
                    this._state = BEFORE_STYLE_1
                } else {
                    this._state = IN_TAG_NAME;
                    this._index--
                }
            };
            Tokenizer.prototype._stateBeforeSpecialEnd = function(c) {
                if (this._special === SPECIAL_SCRIPT && (c === "c" || c === "C")) {
                    this._state = AFTER_SCRIPT_1
                } else if (this._special === SPECIAL_STYLE && (c === "t" || c === "T")) {
                    this._state = AFTER_STYLE_1
                } else this._state = TEXT
            };
            Tokenizer.prototype._stateBeforeScript1 = consumeSpecialNameChar("R", BEFORE_SCRIPT_2);
            Tokenizer.prototype._stateBeforeScript2 = consumeSpecialNameChar("I", BEFORE_SCRIPT_3);
            Tokenizer.prototype._stateBeforeScript3 = consumeSpecialNameChar("P", BEFORE_SCRIPT_4);
            Tokenizer.prototype._stateBeforeScript4 = consumeSpecialNameChar("T", BEFORE_SCRIPT_5);
            Tokenizer.prototype._stateBeforeScript5 = function(c) {
                if (c === "/" || c === ">" || whitespace(c)) {
                    this._special = SPECIAL_SCRIPT
                }
                this._state = IN_TAG_NAME;
                this._index--
            };
            Tokenizer.prototype._stateAfterScript1 = ifElseState("R", AFTER_SCRIPT_2, TEXT);
            Tokenizer.prototype._stateAfterScript2 = ifElseState("I", AFTER_SCRIPT_3, TEXT);
            Tokenizer.prototype._stateAfterScript3 = ifElseState("P", AFTER_SCRIPT_4, TEXT);
            Tokenizer.prototype._stateAfterScript4 = ifElseState("T", AFTER_SCRIPT_5, TEXT);
            Tokenizer.prototype._stateAfterScript5 = function(c) {
                if (c === ">" || whitespace(c)) {
                    this._special = SPECIAL_NONE;
                    this._state = IN_CLOSING_TAG_NAME;
                    this._sectionStart = this._index - 6;
                    this._index--
                } else this._state = TEXT
            };
            Tokenizer.prototype._stateBeforeStyle1 = consumeSpecialNameChar("Y", BEFORE_STYLE_2);
            Tokenizer.prototype._stateBeforeStyle2 = consumeSpecialNameChar("L", BEFORE_STYLE_3);
            Tokenizer.prototype._stateBeforeStyle3 = consumeSpecialNameChar("E", BEFORE_STYLE_4);
            Tokenizer.prototype._stateBeforeStyle4 = function(c) {
                if (c === "/" || c === ">" || whitespace(c)) {
                    this._special = SPECIAL_STYLE
                }
                this._state = IN_TAG_NAME;
                this._index--
            };
            Tokenizer.prototype._stateAfterStyle1 = ifElseState("Y", AFTER_STYLE_2, TEXT);
            Tokenizer.prototype._stateAfterStyle2 = ifElseState("L", AFTER_STYLE_3, TEXT);
            Tokenizer.prototype._stateAfterStyle3 = ifElseState("E", AFTER_STYLE_4, TEXT);
            Tokenizer.prototype._stateAfterStyle4 = function(c) {
                if (c === ">" || whitespace(c)) {
                    this._special = SPECIAL_NONE;
                    this._state = IN_CLOSING_TAG_NAME;
                    this._sectionStart = this._index - 5;
                    this._index--
                } else this._state = TEXT
            };
            Tokenizer.prototype._stateBeforeEntity = ifElseState("#", BEFORE_NUMERIC_ENTITY, IN_NAMED_ENTITY);
            Tokenizer.prototype._stateBeforeNumericEntity = ifElseState("X", IN_HEX_ENTITY, IN_NUMERIC_ENTITY);
            Tokenizer.prototype._parseNamedEntityStrict = function() {
                if (this._sectionStart + 1 < this._index) {
                    var entity = this._buffer.substring(this._sectionStart + 1, this._index),
                        map = this._xmlMode ? xmlMap : entityMap;
                    if (map.hasOwnProperty(entity)) {
                        this._emitPartial(map[entity]);
                        this._sectionStart = this._index + 1
                    }
                }
            };
            Tokenizer.prototype._parseLegacyEntity = function() {
                var start = this._sectionStart + 1,
                    limit = this._index - start;
                if (limit > 6) limit = 6;
                while (limit >= 2) {
                    var entity = this._buffer.substr(start, limit);
                    if (legacyMap.hasOwnProperty(entity)) {
                        this._emitPartial(legacyMap[entity]);
                        this._sectionStart += limit + 1;
                        return
                    } else {
                        limit--
                    }
                }
            };
            Tokenizer.prototype._stateInNamedEntity = function(c) {
                if (c === ";") {
                    this._parseNamedEntityStrict();
                    if (this._sectionStart + 1 < this._index && !this._xmlMode) {
                        this._parseLegacyEntity()
                    }
                    this._state = this._baseState
                } else if ((c < "a" || c > "z") && (c < "A" || c > "Z") && (c < "0" || c > "9")) {
                    if (this._xmlMode);
                    else if (this._sectionStart + 1 === this._index);
                    else if (this._baseState !== TEXT) {
                        if (c !== "=") {
                            this._parseNamedEntityStrict()
                        }
                    } else {
                        this._parseLegacyEntity()
                    }
                    this._state = this._baseState;
                    this._index--
                }
            };
            Tokenizer.prototype._decodeNumericEntity = function(offset, base) {
                var sectionStart = this._sectionStart + offset;
                if (sectionStart !== this._index) {
                    var entity = this._buffer.substring(sectionStart, this._index);
                    var parsed = parseInt(entity, base);
                    this._emitPartial(decodeCodePoint(parsed));
                    this._sectionStart = this._index
                } else {
                    this._sectionStart--
                }
                this._state = this._baseState
            };
            Tokenizer.prototype._stateInNumericEntity = function(c) {
                if (c === ";") {
                    this._decodeNumericEntity(2, 10);
                    this._sectionStart++
                } else if (c < "0" || c > "9") {
                    if (!this._xmlMode) {
                        this._decodeNumericEntity(2, 10)
                    } else {
                        this._state = this._baseState
                    }
                    this._index--
                }
            };
            Tokenizer.prototype._stateInHexEntity = function(c) {
                if (c === ";") {
                    this._decodeNumericEntity(3, 16);
                    this._sectionStart++
                } else if ((c < "a" || c > "f") && (c < "A" || c > "F") && (c < "0" || c > "9")) {
                    if (!this._xmlMode) {
                        this._decodeNumericEntity(3, 16)
                    } else {
                        this._state = this._baseState
                    }
                    this._index--
                }
            };
            Tokenizer.prototype._cleanup = function() {
                if (this._sectionStart < 0) {
                    this._buffer = "";
                    this._bufferOffset += this._index;
                    this._index = 0
                } else if (this._running) {
                    if (this._state === TEXT) {
                        if (this._sectionStart !== this._index) {
                            this._cbs.ontext(this._buffer.substr(this._sectionStart))
                        }
                        this._buffer = "";
                        this._bufferOffset += this._index;
                        this._index = 0
                    } else if (this._sectionStart === this._index) {
                        this._buffer = "";
                        this._bufferOffset += this._index;
                        this._index = 0
                    } else {
                        this._buffer = this._buffer.substr(this._sectionStart);
                        this._index -= this._sectionStart;
                        this._bufferOffset += this._sectionStart
                    }
                    this._sectionStart = 0
                }
            };
            Tokenizer.prototype.write = function(chunk) {
                if (this._ended) this._cbs.onerror(Error(".write() after done!"));
                this._buffer += chunk;
                this._parse()
            };
            Tokenizer.prototype._parse = function() {
                while (this._index < this._buffer.length && this._running) {
                    var c = this._buffer.charAt(this._index);
                    if (this._state === TEXT) {
                        this._stateText(c)
                    } else if (this._state === BEFORE_TAG_NAME) {
                        this._stateBeforeTagName(c)
                    } else if (this._state === IN_TAG_NAME) {
                        this._stateInTagName(c)
                    } else if (this._state === BEFORE_CLOSING_TAG_NAME) {
                        this._stateBeforeCloseingTagName(c)
                    } else if (this._state === IN_CLOSING_TAG_NAME) {
                        this._stateInCloseingTagName(c)
                    } else if (this._state === AFTER_CLOSING_TAG_NAME) {
                        this._stateAfterCloseingTagName(c)
                    } else if (this._state === IN_SELF_CLOSING_TAG) {
                        this._stateInSelfClosingTag(c)
                    } else if (this._state === BEFORE_ATTRIBUTE_NAME) {
                        this._stateBeforeAttributeName(c)
                    } else if (this._state === IN_ATTRIBUTE_NAME) {
                        this._stateInAttributeName(c)
                    } else if (this._state === AFTER_ATTRIBUTE_NAME) {
                        this._stateAfterAttributeName(c)
                    } else if (this._state === BEFORE_ATTRIBUTE_VALUE) {
                        this._stateBeforeAttributeValue(c)
                    } else if (this._state === IN_ATTRIBUTE_VALUE_DQ) {
                        this._stateInAttributeValueDoubleQuotes(c)
                    } else if (this._state === IN_ATTRIBUTE_VALUE_SQ) {
                        this._stateInAttributeValueSingleQuotes(c)
                    } else if (this._state === IN_ATTRIBUTE_VALUE_NQ) {
                        this._stateInAttributeValueNoQuotes(c)
                    } else if (this._state === BEFORE_DECLARATION) {
                        this._stateBeforeDeclaration(c)
                    } else if (this._state === IN_DECLARATION) {
                        this._stateInDeclaration(c)
                    } else if (this._state === IN_PROCESSING_INSTRUCTION) {
                        this._stateInProcessingInstruction(c)
                    } else if (this._state === BEFORE_COMMENT) {
                        this._stateBeforeComment(c)
                    } else if (this._state === IN_COMMENT) {
                        this._stateInComment(c)
                    } else if (this._state === AFTER_COMMENT_1) {
                        this._stateAfterComment1(c)
                    } else if (this._state === AFTER_COMMENT_2) {
                        this._stateAfterComment2(c)
                    } else if (this._state === BEFORE_CDATA_1) {
                        this._stateBeforeCdata1(c)
                    } else if (this._state === BEFORE_CDATA_2) {
                        this._stateBeforeCdata2(c)
                    } else if (this._state === BEFORE_CDATA_3) {
                        this._stateBeforeCdata3(c)
                    } else if (this._state === BEFORE_CDATA_4) {
                        this._stateBeforeCdata4(c)
                    } else if (this._state === BEFORE_CDATA_5) {
                        this._stateBeforeCdata5(c)
                    } else if (this._state === BEFORE_CDATA_6) {
                        this._stateBeforeCdata6(c)
                    } else if (this._state === IN_CDATA) {
                        this._stateInCdata(c)
                    } else if (this._state === AFTER_CDATA_1) {
                        this._stateAfterCdata1(c)
                    } else if (this._state === AFTER_CDATA_2) {
                        this._stateAfterCdata2(c)
                    } else if (this._state === BEFORE_SPECIAL) {
                        this._stateBeforeSpecial(c)
                    } else if (this._state === BEFORE_SPECIAL_END) {
                        this._stateBeforeSpecialEnd(c)
                    } else if (this._state === BEFORE_SCRIPT_1) {
                        this._stateBeforeScript1(c)
                    } else if (this._state === BEFORE_SCRIPT_2) {
                        this._stateBeforeScript2(c)
                    } else if (this._state === BEFORE_SCRIPT_3) {
                        this._stateBeforeScript3(c)
                    } else if (this._state === BEFORE_SCRIPT_4) {
                        this._stateBeforeScript4(c)
                    } else if (this._state === BEFORE_SCRIPT_5) {
                        this._stateBeforeScript5(c)
                    } else if (this._state === AFTER_SCRIPT_1) {
                        this._stateAfterScript1(c)
                    } else if (this._state === AFTER_SCRIPT_2) {
                        this._stateAfterScript2(c)
                    } else if (this._state === AFTER_SCRIPT_3) {
                        this._stateAfterScript3(c)
                    } else if (this._state === AFTER_SCRIPT_4) {
                        this._stateAfterScript4(c)
                    } else if (this._state === AFTER_SCRIPT_5) {
                        this._stateAfterScript5(c)
                    } else if (this._state === BEFORE_STYLE_1) {
                        this._stateBeforeStyle1(c)
                    } else if (this._state === BEFORE_STYLE_2) {
                        this._stateBeforeStyle2(c)
                    } else if (this._state === BEFORE_STYLE_3) {
                        this._stateBeforeStyle3(c)
                    } else if (this._state === BEFORE_STYLE_4) {
                        this._stateBeforeStyle4(c)
                    } else if (this._state === AFTER_STYLE_1) {
                        this._stateAfterStyle1(c)
                    } else if (this._state === AFTER_STYLE_2) {
                        this._stateAfterStyle2(c)
                    } else if (this._state === AFTER_STYLE_3) {
                        this._stateAfterStyle3(c)
                    } else if (this._state === AFTER_STYLE_4) {
                        this._stateAfterStyle4(c)
                    } else if (this._state === BEFORE_ENTITY) {
                        this._stateBeforeEntity(c)
                    } else if (this._state === BEFORE_NUMERIC_ENTITY) {
                        this._stateBeforeNumericEntity(c)
                    } else if (this._state === IN_NAMED_ENTITY) {
                        this._stateInNamedEntity(c)
                    } else if (this._state === IN_NUMERIC_ENTITY) {
                        this._stateInNumericEntity(c)
                    } else if (this._state === IN_HEX_ENTITY) {
                        this._stateInHexEntity(c)
                    } else {
                        this._cbs.onerror(Error("unknown _state"), this._state)
                    }
                    this._index++
                }
                this._cleanup()
            };
            Tokenizer.prototype.pause = function() {
                this._running = false
            };
            Tokenizer.prototype.resume = function() {
                this._running = true;
                if (this._index < this._buffer.length) {
                    this._parse()
                }
                if (this._ended) {
                    this._finish()
                }
            };
            Tokenizer.prototype.end = function(chunk) {
                if (this._ended) this._cbs.onerror(Error(".end() after done!"));
                if (chunk) this.write(chunk);
                this._ended = true;
                if (this._running) this._finish()
            };
            Tokenizer.prototype._finish = function() {
                if (this._sectionStart < this._index) {
                    this._handleTrailingData()
                }
                this._cbs.onend()
            };
            Tokenizer.prototype._handleTrailingData = function() {
                var data = this._buffer.substr(this._sectionStart);
                if (this._state === IN_CDATA || this._state === AFTER_CDATA_1 || this._state === AFTER_CDATA_2) {
                    this._cbs.oncdata(data)
                } else if (this._state === IN_COMMENT || this._state === AFTER_COMMENT_1 || this._state === AFTER_COMMENT_2) {
                    this._cbs.oncomment(data)
                } else if (this._state === IN_NAMED_ENTITY && !this._xmlMode) {
                    this._parseLegacyEntity();
                    if (this._sectionStart < this._index) {
                        this._state = this._baseState;
                        this._handleTrailingData()
                    }
                } else if (this._state === IN_NUMERIC_ENTITY && !this._xmlMode) {
                    this._decodeNumericEntity(2, 10);
                    if (this._sectionStart < this._index) {
                        this._state = this._baseState;
                        this._handleTrailingData()
                    }
                } else if (this._state === IN_HEX_ENTITY && !this._xmlMode) {
                    this._decodeNumericEntity(3, 16);
                    if (this._sectionStart < this._index) {
                        this._state = this._baseState;
                        this._handleTrailingData()
                    }
                } else if (this._state !== IN_TAG_NAME && this._state !== BEFORE_ATTRIBUTE_NAME && this._state !== BEFORE_ATTRIBUTE_VALUE && this._state !== AFTER_ATTRIBUTE_NAME && this._state !== IN_ATTRIBUTE_NAME && this._state !== IN_ATTRIBUTE_VALUE_SQ && this._state !== IN_ATTRIBUTE_VALUE_DQ && this._state !== IN_ATTRIBUTE_VALUE_NQ && this._state !== IN_CLOSING_TAG_NAME) {
                    this._cbs.ontext(data)
                }
            };
            Tokenizer.prototype.reset = function() {
                Tokenizer.call(this, {
                    xmlMode: this._xmlMode,
                    decodeEntities: this._decodeEntities
                }, this._cbs)
            };
            Tokenizer.prototype.getAbsoluteIndex = function() {
                return this._bufferOffset + this._index
            };
            Tokenizer.prototype._getSection = function() {
                return this._buffer.substring(this._sectionStart, this._index)
            };
            Tokenizer.prototype._emitToken = function(name) {
                this._cbs[name](this._getSection());
                this._sectionStart = -1
            };
            Tokenizer.prototype._emitPartial = function(value) {
                if (this._baseState !== TEXT) {
                    this._cbs.onattribdata(value)
                } else {
                    this._cbs.ontext(value)
                }
            }
        }, {
            "entities/lib/decode_codepoint.js": 20,
            "entities/maps/entities.json": 23,
            "entities/maps/legacy.json": 24,
            "entities/maps/xml.json": 25
        }],
        33: [function(require, module, exports) {
            module.exports = Stream;
            var Parser = require("./Parser.js");
            var WritableStream = require("readable-stream")
                .Writable;
            var StringDecoder = require("string_decoder")
                .StringDecoder;
            var Buffer = require("buffer")
                .Buffer;

            function Stream(cbs, options) {
                var parser = this._parser = new Parser(cbs, options);
                var decoder = this._decoder = new StringDecoder;
                WritableStream.call(this, {
                    decodeStrings: false
                });
                this.once("finish", function() {
                    parser.end(decoder.end())
                })
            }
            require("inherits")(Stream, WritableStream);
            Stream.prototype._write = function(chunk, encoding, cb) {
                if (chunk instanceof Buffer) chunk = this._decoder.write(chunk);
                this._parser.write(chunk);
                cb()
            }
        }, {
            "./Parser.js": 29,
            buffer: 5,
            inherits: 36,
            "readable-stream": 4,
            string_decoder: 86
        }],
        34: [function(require, module, exports) {
            var Parser = require("./Parser.js");
            var DomHandler = require("domhandler");

            function defineProp(name, value) {
                delete module.exports[name];
                module.exports[name] = value;
                return value
            }
            module.exports = {
                Parser: Parser,
                Tokenizer: require("./Tokenizer.js"),
                ElementType: require("domelementtype"),
                DomHandler: DomHandler,
                get FeedHandler() {
                    return defineProp("FeedHandler", require("./FeedHandler.js"))
                },
                get Stream() {
                    return defineProp("Stream", require("./Stream.js"))
                },
                get WritableStream() {
                    return defineProp("WritableStream", require("./WritableStream.js"))
                },
                get ProxyHandler() {
                    return defineProp("ProxyHandler", require("./ProxyHandler.js"))
                },
                get DomUtils() {
                    return defineProp("DomUtils", require("domutils"))
                },
                get CollectingHandler() {
                    return defineProp("CollectingHandler", require("./CollectingHandler.js"))
                },
                DefaultHandler: DomHandler,
                get RssHandler() {
                    return defineProp("RssHandler", this.FeedHandler)
                },
                parseDOM: function(data, options) {
                    var handler = new DomHandler(options);
                    new Parser(handler, options)
                        .end(data);
                    return handler.dom
                },
                parseFeed: function(feed, options) {
                    var handler = new module.exports.FeedHandler(options);
                    new Parser(handler, options)
                        .end(feed);
                    return handler.dom
                },
                createDomStream: function(cb, options, elementCb) {
                    var handler = new DomHandler(cb, options, elementCb);
                    return new Parser(handler, options)
                },
                EVENTS: {
                    attribute: 2,
                    cdatastart: 0,
                    cdataend: 0,
                    text: 1,
                    processinginstruction: 2,
                    comment: 1,
                    commentend: 0,
                    closetag: 1,
                    opentag: 2,
                    opentagname: 1,
                    error: 1,
                    end: 0
                }
            }
        }, {
            "./CollectingHandler.js": 27,
            "./FeedHandler.js": 28,
            "./Parser.js": 29,
            "./ProxyHandler.js": 30,
            "./Stream.js": 31,
            "./Tokenizer.js": 32,
            "./WritableStream.js": 33,
            domelementtype: 7,
            domhandler: 8,
            domutils: 11
        }],
        35: [function(require, module, exports) {
            exports.read = function(buffer, offset, isLE, mLen, nBytes) {
                var e, m;
                var eLen = nBytes * 8 - mLen - 1;
                var eMax = (1 << eLen) - 1;
                var eBias = eMax >> 1;
                var nBits = -7;
                var i = isLE ? nBytes - 1 : 0;
                var d = isLE ? -1 : 1;
                var s = buffer[offset + i];
                i += d;
                e = s & (1 << -nBits) - 1;
                s >>= -nBits;
                nBits += eLen;
                for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}
                m = e & (1 << -nBits) - 1;
                e >>= -nBits;
                nBits += mLen;
                for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}
                if (e === 0) {
                    e = 1 - eBias
                } else if (e === eMax) {
                    return m ? NaN : (s ? -1 : 1) * Infinity
                } else {
                    m = m + Math.pow(2, mLen);
                    e = e - eBias
                }
                return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
            };
            exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
                var e, m, c;
                var eLen = nBytes * 8 - mLen - 1;
                var eMax = (1 << eLen) - 1;
                var eBias = eMax >> 1;
                var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
                var i = isLE ? 0 : nBytes - 1;
                var d = isLE ? 1 : -1;
                var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
                value = Math.abs(value);
                if (isNaN(value) || value === Infinity) {
                    m = isNaN(value) ? 1 : 0;
                    e = eMax
                } else {
                    e = Math.floor(Math.log(value) / Math.LN2);
                    if (value * (c = Math.pow(2, -e)) < 1) {
                        e--;
                        c *= 2
                    }
                    if (e + eBias >= 1) {
                        value += rt / c
                    } else {
                        value += rt * Math.pow(2, 1 - eBias)
                    }
                    if (value * c >= 2) {
                        e++;
                        c /= 2
                    }
                    if (e + eBias >= eMax) {
                        m = 0;
                        e = eMax
                    } else if (e + eBias >= 1) {
                        m = (value * c - 1) * Math.pow(2, mLen);
                        e = e + eBias
                    } else {
                        m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
                        e = 0
                    }
                }
                for (; mLen >= 8; buffer[offset + i] = m & 255, i += d, m /= 256, mLen -= 8) {}
                e = e << mLen | m;
                eLen += mLen;
                for (; eLen > 0; buffer[offset + i] = e & 255, i += d, e /= 256, eLen -= 8) {}
                buffer[offset + i - d] |= s * 128
            }
        }, {}],
        36: [function(require, module, exports) {
            if (typeof Object.create === "function") {
                module.exports = function inherits(ctor, superCtor) {
                    ctor.super_ = superCtor;
                    ctor.prototype = Object.create(superCtor.prototype, {
                        constructor: {
                            value: ctor,
                            enumerable: false,
                            writable: true,
                            configurable: true
                        }
                    })
                }
            } else {
                module.exports = function inherits(ctor, superCtor) {
                    ctor.super_ = superCtor;
                    var TempCtor = function() {};
                    TempCtor.prototype = superCtor.prototype;
                    ctor.prototype = new TempCtor;
                    ctor.prototype.constructor = ctor
                }
            }
        }, {}],
        37: [function(require, module, exports) {
            (function(global) {
                var LARGE_ARRAY_SIZE = 200;
                var HASH_UNDEFINED = "__lodash_hash_undefined__";
                var MAX_SAFE_INTEGER = 9007199254740991;
                var argsTag = "[object Arguments]",
                    arrayTag = "[object Array]",
                    boolTag = "[object Boolean]",
                    dateTag = "[object Date]",
                    errorTag = "[object Error]",
                    funcTag = "[object Function]",
                    genTag = "[object GeneratorFunction]",
                    mapTag = "[object Map]",
                    numberTag = "[object Number]",
                    objectTag = "[object Object]",
                    promiseTag = "[object Promise]",
                    regexpTag = "[object RegExp]",
                    setTag = "[object Set]",
                    stringTag = "[object String]",
                    symbolTag = "[object Symbol]",
                    weakMapTag = "[object WeakMap]";
                var arrayBufferTag = "[object ArrayBuffer]",
                    dataViewTag = "[object DataView]",
                    float32Tag = "[object Float32Array]",
                    float64Tag = "[object Float64Array]",
                    int8Tag = "[object Int8Array]",
                    int16Tag = "[object Int16Array]",
                    int32Tag = "[object Int32Array]",
                    uint8Tag = "[object Uint8Array]",
                    uint8ClampedTag = "[object Uint8ClampedArray]",
                    uint16Tag = "[object Uint16Array]",
                    uint32Tag = "[object Uint32Array]";
                var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
                var reFlags = /\w*$/;
                var reIsHostCtor = /^\[object .+?Constructor\]$/;
                var reIsUint = /^(?:0|[1-9]\d*)$/;
                var cloneableTags = {};
                cloneableTags[argsTag] = cloneableTags[arrayTag] = cloneableTags[arrayBufferTag] = cloneableTags[dataViewTag] = cloneableTags[boolTag] = cloneableTags[dateTag] = cloneableTags[float32Tag] = cloneableTags[float64Tag] = cloneableTags[int8Tag] = cloneableTags[int16Tag] = cloneableTags[int32Tag] = cloneableTags[mapTag] = cloneableTags[numberTag] = cloneableTags[objectTag] = cloneableTags[regexpTag] = cloneableTags[setTag] = cloneableTags[stringTag] = cloneableTags[symbolTag] = cloneableTags[uint8Tag] = cloneableTags[uint8ClampedTag] = cloneableTags[uint16Tag] = cloneableTags[uint32Tag] = true;
                cloneableTags[errorTag] = cloneableTags[funcTag] = cloneableTags[weakMapTag] = false;
                var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
                var freeSelf = typeof self == "object" && self && self.Object === Object && self;
                var root = freeGlobal || freeSelf || Function("return this")();
                var freeExports = typeof exports == "object" && exports && !exports.nodeType && exports;
                var freeModule = freeExports && typeof module == "object" && module && !module.nodeType && module;
                var moduleExports = freeModule && freeModule.exports === freeExports;

                function addMapEntry(map, pair) {
                    map.set(pair[0], pair[1]);
                    return map
                }

                function addSetEntry(set, value) {
                    set.add(value);
                    return set
                }

                function arrayEach(array, iteratee) {
                    var index = -1,
                        length = array ? array.length : 0;
                    while (++index < length) {
                        if (iteratee(array[index], index, array) === false) {
                            break
                        }
                    }
                    return array
                }

                function arrayPush(array, values) {
                    var index = -1,
                        length = values.length,
                        offset = array.length;
                    while (++index < length) {
                        array[offset + index] = values[index]
                    }
                    return array
                }

                function arrayReduce(array, iteratee, accumulator, initAccum) {
                    var index = -1,
                        length = array ? array.length : 0;
                    if (initAccum && length) {
                        accumulator = array[++index]
                    }
                    while (++index < length) {
                        accumulator = iteratee(accumulator, array[index], index, array)
                    }
                    return accumulator
                }

                function baseTimes(n, iteratee) {
                    var index = -1,
                        result = Array(n);
                    while (++index < n) {
                        result[index] = iteratee(index)
                    }
                    return result
                }

                function getValue(object, key) {
                    return object == null ? undefined : object[key]
                }

                function isHostObject(value) {
                    var result = false;
                    if (value != null && typeof value.toString != "function") {
                        try {
                            result = !!(value + "")
                        } catch (e) {}
                    }
                    return result
                }

                function mapToArray(map) {
                    var index = -1,
                        result = Array(map.size);
                    map.forEach(function(value, key) {
                        result[++index] = [key, value]
                    });
                    return result
                }

                function overArg(func, transform) {
                    return function(arg) {
                        return func(transform(arg))
                    }
                }

                function setToArray(set) {
                    var index = -1,
                        result = Array(set.size);
                    set.forEach(function(value) {
                        result[++index] = value
                    });
                    return result
                }
                var arrayProto = Array.prototype,
                    funcProto = Function.prototype,
                    objectProto = Object.prototype;
                var coreJsData = root["__core-js_shared__"];
                var maskSrcKey = function() {
                    var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || "");
                    return uid ? "Symbol(src)_1." + uid : ""
                }();
                var funcToString = funcProto.toString;
                var hasOwnProperty = objectProto.hasOwnProperty;
                var objectToString = objectProto.toString;
                var reIsNative = RegExp("^" + funcToString.call(hasOwnProperty)
                    .replace(reRegExpChar, "\\$&")
                    .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$");
                var Buffer = moduleExports ? root.Buffer : undefined,
                    Symbol = root.Symbol,
                    Uint8Array = root.Uint8Array,
                    getPrototype = overArg(Object.getPrototypeOf, Object),
                    objectCreate = Object.create,
                    propertyIsEnumerable = objectProto.propertyIsEnumerable,
                    splice = arrayProto.splice;
                var nativeGetSymbols = Object.getOwnPropertySymbols,
                    nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined,
                    nativeKeys = overArg(Object.keys, Object);
                var DataView = getNative(root, "DataView"),
                    Map = getNative(root, "Map"),
                    Promise = getNative(root, "Promise"),
                    Set = getNative(root, "Set"),
                    WeakMap = getNative(root, "WeakMap"),
                    nativeCreate = getNative(Object, "create");
                var dataViewCtorString = toSource(DataView),
                    mapCtorString = toSource(Map),
                    promiseCtorString = toSource(Promise),
                    setCtorString = toSource(Set),
                    weakMapCtorString = toSource(WeakMap);
                var symbolProto = Symbol ? Symbol.prototype : undefined,
                    symbolValueOf = symbolProto ? symbolProto.valueOf : undefined;

                function Hash(entries) {
                    var index = -1,
                        length = entries ? entries.length : 0;
                    this.clear();
                    while (++index < length) {
                        var entry = entries[index];
                        this.set(entry[0], entry[1])
                    }
                }

                function hashClear() {
                    this.__data__ = nativeCreate ? nativeCreate(null) : {}
                }

                function hashDelete(key) {
                    return this.has(key) && delete this.__data__[key]
                }

                function hashGet(key) {
                    var data = this.__data__;
                    if (nativeCreate) {
                        var result = data[key];
                        return result === HASH_UNDEFINED ? undefined : result
                    }
                    return hasOwnProperty.call(data, key) ? data[key] : undefined
                }

                function hashHas(key) {
                    var data = this.__data__;
                    return nativeCreate ? data[key] !== undefined : hasOwnProperty.call(data, key)
                }

                function hashSet(key, value) {
                    var data = this.__data__;
                    data[key] = nativeCreate && value === undefined ? HASH_UNDEFINED : value;
                    return this
                }
                Hash.prototype.clear = hashClear;
                Hash.prototype["delete"] = hashDelete;
                Hash.prototype.get = hashGet;
                Hash.prototype.has = hashHas;
                Hash.prototype.set = hashSet;

                function ListCache(entries) {
                    var index = -1,
                        length = entries ? entries.length : 0;
                    this.clear();
                    while (++index < length) {
                        var entry = entries[index];
                        this.set(entry[0], entry[1])
                    }
                }

                function listCacheClear() {
                    this.__data__ = []
                }

                function listCacheDelete(key) {
                    var data = this.__data__,
                        index = assocIndexOf(data, key);
                    if (index < 0) {
                        return false
                    }
                    var lastIndex = data.length - 1;
                    if (index == lastIndex) {
                        data.pop()
                    } else {
                        splice.call(data, index, 1)
                    }
                    return true
                }

                function listCacheGet(key) {
                    var data = this.__data__,
                        index = assocIndexOf(data, key);
                    return index < 0 ? undefined : data[index][1]
                }

                function listCacheHas(key) {
                    return assocIndexOf(this.__data__, key) > -1
                }

                function listCacheSet(key, value) {
                    var data = this.__data__,
                        index = assocIndexOf(data, key);
                    if (index < 0) {
                        data.push([key, value])
                    } else {
                        data[index][1] = value
                    }
                    return this
                }
                ListCache.prototype.clear = listCacheClear;
                ListCache.prototype["delete"] = listCacheDelete;
                ListCache.prototype.get = listCacheGet;
                ListCache.prototype.has = listCacheHas;
                ListCache.prototype.set = listCacheSet;

                function MapCache(entries) {
                    var index = -1,
                        length = entries ? entries.length : 0;
                    this.clear();
                    while (++index < length) {
                        var entry = entries[index];
                        this.set(entry[0], entry[1])
                    }
                }

                function mapCacheClear() {
                    this.__data__ = {
                        hash: new Hash,
                        map: new(Map || ListCache),
                        string: new Hash
                    }
                }

                function mapCacheDelete(key) {
                    return getMapData(this, key)["delete"](key)
                }

                function mapCacheGet(key) {
                    return getMapData(this, key)
                        .get(key)
                }

                function mapCacheHas(key) {
                    return getMapData(this, key)
                        .has(key)
                }

                function mapCacheSet(key, value) {
                    getMapData(this, key)
                        .set(key, value);
                    return this
                }
                MapCache.prototype.clear = mapCacheClear;
                MapCache.prototype["delete"] = mapCacheDelete;
                MapCache.prototype.get = mapCacheGet;
                MapCache.prototype.has = mapCacheHas;
                MapCache.prototype.set = mapCacheSet;

                function Stack(entries) {
                    this.__data__ = new ListCache(entries)
                }

                function stackClear() {
                    this.__data__ = new ListCache
                }

                function stackDelete(key) {
                    return this.__data__["delete"](key)
                }

                function stackGet(key) {
                    return this.__data__.get(key)
                }

                function stackHas(key) {
                    return this.__data__.has(key)
                }

                function stackSet(key, value) {
                    var cache = this.__data__;
                    if (cache instanceof ListCache) {
                        var pairs = cache.__data__;
                        if (!Map || pairs.length < LARGE_ARRAY_SIZE - 1) {
                            pairs.push([key, value]);
                            return this
                        }
                        cache = this.__data__ = new MapCache(pairs)
                    }
                    cache.set(key, value);
                    return this
                }
                Stack.prototype.clear = stackClear;
                Stack.prototype["delete"] = stackDelete;
                Stack.prototype.get = stackGet;
                Stack.prototype.has = stackHas;
                Stack.prototype.set = stackSet;

                function arrayLikeKeys(value, inherited) {
                    var result = isArray(value) || isArguments(value) ? baseTimes(value.length, String) : [];
                    var length = result.length,
                        skipIndexes = !!length;
                    for (var key in value) {
                        if ((inherited || hasOwnProperty.call(value, key)) && !(skipIndexes && (key == "length" || isIndex(key, length)))) {
                            result.push(key)
                        }
                    }
                    return result
                }

                function assignValue(object, key, value) {
                    var objValue = object[key];
                    if (!(hasOwnProperty.call(object, key) && eq(objValue, value)) || value === undefined && !(key in object)) {
                        object[key] = value
                    }
                }

                function assocIndexOf(array, key) {
                    var length = array.length;
                    while (length--) {
                        if (eq(array[length][0], key)) {
                            return length
                        }
                    }
                    return -1
                }

                function baseAssign(object, source) {
                    return object && copyObject(source, keys(source), object)
                }

                function baseClone(value, isDeep, isFull, customizer, key, object, stack) {
                    var result;
                    if (customizer) {
                        result = object ? customizer(value, key, object, stack) : customizer(value)
                    }
                    if (result !== undefined) {
                        return result
                    }
                    if (!isObject(value)) {
                        return value
                    }
                    var isArr = isArray(value);
                    if (isArr) {
                        result = initCloneArray(value);
                        if (!isDeep) {
                            return copyArray(value, result)
                        }
                    } else {
                        var tag = getTag(value),
                            isFunc = tag == funcTag || tag == genTag;
                        if (isBuffer(value)) {
                            return cloneBuffer(value, isDeep)
                        }
                        if (tag == objectTag || tag == argsTag || isFunc && !object) {
                            if (isHostObject(value)) {
                                return object ? value : {}
                            }
                            result = initCloneObject(isFunc ? {} : value);
                            if (!isDeep) {
                                return copySymbols(value, baseAssign(result, value))
                            }
                        } else {
                            if (!cloneableTags[tag]) {
                                return object ? value : {}
                            }
                            result = initCloneByTag(value, tag, baseClone, isDeep)
                        }
                    }
                    stack || (stack = new Stack);
                    var stacked = stack.get(value);
                    if (stacked) {
                        return stacked
                    }
                    stack.set(value, result);
                    if (!isArr) {
                        var props = isFull ? getAllKeys(value) : keys(value)
                    }
                    arrayEach(props || value, function(subValue, key) {
                        if (props) {
                            key = subValue;
                            subValue = value[key]
                        }
                        assignValue(result, key, baseClone(subValue, isDeep, isFull, customizer, key, value, stack))
                    });
                    return result
                }

                function baseCreate(proto) {
                    return isObject(proto) ? objectCreate(proto) : {}
                }

                function baseGetAllKeys(object, keysFunc, symbolsFunc) {
                    var result = keysFunc(object);
                    return isArray(object) ? result : arrayPush(result, symbolsFunc(object))
                }

                function baseGetTag(value) {
                    return objectToString.call(value)
                }

                function baseIsNative(value) {
                    if (!isObject(value) || isMasked(value)) {
                        return false
                    }
                    var pattern = isFunction(value) || isHostObject(value) ? reIsNative : reIsHostCtor;
                    return pattern.test(toSource(value))
                }

                function baseKeys(object) {
                    if (!isPrototype(object)) {
                        return nativeKeys(object)
                    }
                    var result = [];
                    for (var key in Object(object)) {
                        if (hasOwnProperty.call(object, key) && key != "constructor") {
                            result.push(key)
                        }
                    }
                    return result
                }

                function cloneBuffer(buffer, isDeep) {
                    if (isDeep) {
                        return buffer.slice()
                    }
                    var result = new buffer.constructor(buffer.length);
                    buffer.copy(result);
                    return result
                }

                function cloneArrayBuffer(arrayBuffer) {
                    var result = new arrayBuffer.constructor(arrayBuffer.byteLength);
                    new Uint8Array(result)
                        .set(new Uint8Array(arrayBuffer));
                    return result
                }

                function cloneDataView(dataView, isDeep) {
                    var buffer = isDeep ? cloneArrayBuffer(dataView.buffer) : dataView.buffer;
                    return new dataView.constructor(buffer, dataView.byteOffset, dataView.byteLength)
                }

                function cloneMap(map, isDeep, cloneFunc) {
                    var array = isDeep ? cloneFunc(mapToArray(map), true) : mapToArray(map);
                    return arrayReduce(array, addMapEntry, new map.constructor)
                }

                function cloneRegExp(regexp) {
                    var result = new regexp.constructor(regexp.source, reFlags.exec(regexp));
                    result.lastIndex = regexp.lastIndex;
                    return result
                }

                function cloneSet(set, isDeep, cloneFunc) {
                    var array = isDeep ? cloneFunc(setToArray(set), true) : setToArray(set);
                    return arrayReduce(array, addSetEntry, new set.constructor)
                }

                function cloneSymbol(symbol) {
                    return symbolValueOf ? Object(symbolValueOf.call(symbol)) : {}
                }

                function cloneTypedArray(typedArray, isDeep) {
                    var buffer = isDeep ? cloneArrayBuffer(typedArray.buffer) : typedArray.buffer;
                    return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length)
                }

                function copyArray(source, array) {
                    var index = -1,
                        length = source.length;
                    array || (array = Array(length));
                    while (++index < length) {
                        array[index] = source[index]
                    }
                    return array
                }

                function copyObject(source, props, object, customizer) {
                    object || (object = {});
                    var index = -1,
                        length = props.length;
                    while (++index < length) {
                        var key = props[index];
                        var newValue = customizer ? customizer(object[key], source[key], key, object, source) : undefined;
                        assignValue(object, key, newValue === undefined ? source[key] : newValue)
                    }
                    return object
                }

                function copySymbols(source, object) {
                    return copyObject(source, getSymbols(source), object)
                }

                function getAllKeys(object) {
                    return baseGetAllKeys(object, keys, getSymbols)
                }

                function getMapData(map, key) {
                    var data = map.__data__;
                    return isKeyable(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map
                }

                function getNative(object, key) {
                    var value = getValue(object, key);
                    return baseIsNative(value) ? value : undefined
                }
                var getSymbols = nativeGetSymbols ? overArg(nativeGetSymbols, Object) : stubArray;
                var getTag = baseGetTag;
                if (DataView && getTag(new DataView(new ArrayBuffer(1))) != dataViewTag || Map && getTag(new Map) != mapTag || Promise && getTag(Promise.resolve()) != promiseTag || Set && getTag(new Set) != setTag || WeakMap && getTag(new WeakMap) != weakMapTag) {
                    getTag = function(value) {
                        var result = objectToString.call(value),
                            Ctor = result == objectTag ? value.constructor : undefined,
                            ctorString = Ctor ? toSource(Ctor) : undefined;
                        if (ctorString) {
                            switch (ctorString) {
                                case dataViewCtorString:
                                    return dataViewTag;
                                case mapCtorString:
                                    return mapTag;
                                case promiseCtorString:
                                    return promiseTag;
                                case setCtorString:
                                    return setTag;
                                case weakMapCtorString:
                                    return weakMapTag
                            }
                        }
                        return result
                    }
                }

                function initCloneArray(array) {
                    var length = array.length,
                        result = array.constructor(length);
                    if (length && typeof array[0] == "string" && hasOwnProperty.call(array, "index")) {
                        result.index = array.index;
                        result.input = array.input
                    }
                    return result
                }

                function initCloneObject(object) {
                    return typeof object.constructor == "function" && !isPrototype(object) ? baseCreate(getPrototype(object)) : {}
                }

                function initCloneByTag(object, tag, cloneFunc, isDeep) {
                    var Ctor = object.constructor;
                    switch (tag) {
                        case arrayBufferTag:
                            return cloneArrayBuffer(object);
                        case boolTag:
                        case dateTag:
                            return new Ctor(+object);
                        case dataViewTag:
                            return cloneDataView(object, isDeep);
                        case float32Tag:
                        case float64Tag:
                        case int8Tag:
                        case int16Tag:
                        case int32Tag:
                        case uint8Tag:
                        case uint8ClampedTag:
                        case uint16Tag:
                        case uint32Tag:
                            return cloneTypedArray(object, isDeep);
                        case mapTag:
                            return cloneMap(object, isDeep, cloneFunc);
                        case numberTag:
                        case stringTag:
                            return new Ctor(object);
                        case regexpTag:
                            return cloneRegExp(object);
                        case setTag:
                            return cloneSet(object, isDeep, cloneFunc);
                        case symbolTag:
                            return cloneSymbol(object)
                    }
                }

                function isIndex(value, length) {
                    length = length == null ? MAX_SAFE_INTEGER : length;
                    return !!length && (typeof value == "number" || reIsUint.test(value)) && (value > -1 && value % 1 == 0 && value < length)
                }

                function isKeyable(value) {
                    var type = typeof value;
                    return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null
                }

                function isMasked(func) {
                    return !!maskSrcKey && maskSrcKey in func
                }

                function isPrototype(value) {
                    var Ctor = value && value.constructor,
                        proto = typeof Ctor == "function" && Ctor.prototype || objectProto;
                    return value === proto
                }

                function toSource(func) {
                    if (func != null) {
                        try {
                            return funcToString.call(func)
                        } catch (e) {}
                        try {
                            return func + ""
                        } catch (e) {}
                    }
                    return ""
                }

                function cloneDeep(value) {
                    return baseClone(value, true, true)
                }

                function eq(value, other) {
                    return value === other || value !== value && other !== other
                }

                function isArguments(value) {
                    return isArrayLikeObject(value) && hasOwnProperty.call(value, "callee") && (!propertyIsEnumerable.call(value, "callee") || objectToString.call(value) == argsTag)
                }
                var isArray = Array.isArray;

                function isArrayLike(value) {
                    return value != null && isLength(value.length) && !isFunction(value)
                }

                function isArrayLikeObject(value) {
                    return isObjectLike(value) && isArrayLike(value)
                }
                var isBuffer = nativeIsBuffer || stubFalse;

                function isFunction(value) {
                    var tag = isObject(value) ? objectToString.call(value) : "";
                    return tag == funcTag || tag == genTag
                }

                function isLength(value) {
                    return typeof value == "number" && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER
                }

                function isObject(value) {
                    var type = typeof value;
                    return !!value && (type == "object" || type == "function")
                }

                function isObjectLike(value) {
                    return !!value && typeof value == "object"
                }

                function keys(object) {
                    return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object)
                }

                function stubArray() {
                    return []
                }

                function stubFalse() {
                    return false
                }
                module.exports = cloneDeep
            })
            .call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
        }, {}],
        38: [function(require, module, exports) {
            (function(global) {
                var INFINITY = 1 / 0;
                var symbolTag = "[object Symbol]";
                var reRegExpChar = /[\\^$.*+?()[\]{}|]/g,
                    reHasRegExpChar = RegExp(reRegExpChar.source);
                var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
                var freeSelf = typeof self == "object" && self && self.Object === Object && self;
                var root = freeGlobal || freeSelf || Function("return this")();
                var objectProto = Object.prototype;
                var objectToString = objectProto.toString;
                var Symbol = root.Symbol;
                var symbolProto = Symbol ? Symbol.prototype : undefined,
                    symbolToString = symbolProto ? symbolProto.toString : undefined;

                function baseToString(value) {
                    if (typeof value == "string") {
                        return value
                    }
                    if (isSymbol(value)) {
                        return symbolToString ? symbolToString.call(value) : ""
                    }
                    var result = value + "";
                    return result == "0" && 1 / value == -INFINITY ? "-0" : result
                }

                function isObjectLike(value) {
                    return !!value && typeof value == "object"
                }

                function isSymbol(value) {
                    return typeof value == "symbol" || isObjectLike(value) && objectToString.call(value) == symbolTag
                }

                function toString(value) {
                    return value == null ? "" : baseToString(value)
                }

                function escapeRegExp(string) {
                    string = toString(string);
                    return string && reHasRegExpChar.test(string) ? string.replace(reRegExpChar, "\\$&") : string
                }
                module.exports = escapeRegExp
            })
            .call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
        }, {}],
        39: [function(require, module, exports) {
            var objectTag = "[object Object]";

            function isHostObject(value) {
                var result = false;
                if (value != null && typeof value.toString != "function") {
                    try {
                        result = !!(value + "")
                    } catch (e) {}
                }
                return result
            }

            function overArg(func, transform) {
                return function(arg) {
                    return func(transform(arg))
                }
            }
            var funcProto = Function.prototype,
                objectProto = Object.prototype;
            var funcToString = funcProto.toString;
            var hasOwnProperty = objectProto.hasOwnProperty;
            var objectCtorString = funcToString.call(Object);
            var objectToString = objectProto.toString;
            var getPrototype = overArg(Object.getPrototypeOf, Object);

            function isObjectLike(value) {
                return !!value && typeof value == "object"
            }

            function isPlainObject(value) {
                if (!isObjectLike(value) || objectToString.call(value) != objectTag || isHostObject(value)) {
                    return false
                }
                var proto = getPrototype(value);
                if (proto === null) {
                    return true
                }
                var Ctor = hasOwnProperty.call(proto, "constructor") && proto.constructor;
                return typeof Ctor == "function" && Ctor instanceof Ctor && funcToString.call(Ctor) == objectCtorString
            }
            module.exports = isPlainObject
        }, {}],
        40: [function(require, module, exports) {
            var stringTag = "[object String]";
            var objectProto = Object.prototype;
            var objectToString = objectProto.toString;
            var isArray = Array.isArray;

            function isObjectLike(value) {
                return !!value && typeof value == "object"
            }

            function isString(value) {
                return typeof value == "string" || !isArray(value) && isObjectLike(value) && objectToString.call(value) == stringTag
            }
            module.exports = isString
        }, {}],
        41: [function(require, module, exports) {
            (function(global) {
                var LARGE_ARRAY_SIZE = 200;
                var HASH_UNDEFINED = "__lodash_hash_undefined__";
                var HOT_COUNT = 800,
                    HOT_SPAN = 16;
                var MAX_SAFE_INTEGER = 9007199254740991;
                var argsTag = "[object Arguments]",
                    arrayTag = "[object Array]",
                    asyncTag = "[object AsyncFunction]",
                    boolTag = "[object Boolean]",
                    dateTag = "[object Date]",
                    errorTag = "[object Error]",
                    funcTag = "[object Function]",
                    genTag = "[object GeneratorFunction]",
                    mapTag = "[object Map]",
                    numberTag = "[object Number]",
                    nullTag = "[object Null]",
                    objectTag = "[object Object]",
                    proxyTag = "[object Proxy]",
                    regexpTag = "[object RegExp]",
                    setTag = "[object Set]",
                    stringTag = "[object String]",
                    undefinedTag = "[object Undefined]",
                    weakMapTag = "[object WeakMap]";
                var arrayBufferTag = "[object ArrayBuffer]",
                    dataViewTag = "[object DataView]",
                    float32Tag = "[object Float32Array]",
                    float64Tag = "[object Float64Array]",
                    int8Tag = "[object Int8Array]",
                    int16Tag = "[object Int16Array]",
                    int32Tag = "[object Int32Array]",
                    uint8Tag = "[object Uint8Array]",
                    uint8ClampedTag = "[object Uint8ClampedArray]",
                    uint16Tag = "[object Uint16Array]",
                    uint32Tag = "[object Uint32Array]";
                var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
                var reIsHostCtor = /^\[object .+?Constructor\]$/;
                var reIsUint = /^(?:0|[1-9]\d*)$/;
                var typedArrayTags = {};
                typedArrayTags[float32Tag] = typedArrayTags[float64Tag] = typedArrayTags[int8Tag] = typedArrayTags[int16Tag] = typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] = typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] = typedArrayTags[uint32Tag] = true;
                typedArrayTags[argsTag] = typedArrayTags[arrayTag] = typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] = typedArrayTags[dataViewTag] = typedArrayTags[dateTag] = typedArrayTags[errorTag] = typedArrayTags[funcTag] = typedArrayTags[mapTag] = typedArrayTags[numberTag] = typedArrayTags[objectTag] = typedArrayTags[regexpTag] = typedArrayTags[setTag] = typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;
                var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
                var freeSelf = typeof self == "object" && self && self.Object === Object && self;
                var root = freeGlobal || freeSelf || Function("return this")();
                var freeExports = typeof exports == "object" && exports && !exports.nodeType && exports;
                var freeModule = freeExports && typeof module == "object" && module && !module.nodeType && module;
                var moduleExports = freeModule && freeModule.exports === freeExports;
                var freeProcess = moduleExports && freeGlobal.process;
                var nodeUtil = function() {
                    try {
                        return freeProcess && freeProcess.binding && freeProcess.binding("util")
                    } catch (e) {}
                }();
                var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;

                function apply(func, thisArg, args) {
                    switch (args.length) {
                        case 0:
                            return func.call(thisArg);
                        case 1:
                            return func.call(thisArg, args[0]);
                        case 2:
                            return func.call(thisArg, args[0], args[1]);
                        case 3:
                            return func.call(thisArg, args[0], args[1], args[2])
                    }
                    return func.apply(thisArg, args)
                }

                function baseTimes(n, iteratee) {
                    var index = -1,
                        result = Array(n);
                    while (++index < n) {
                        result[index] = iteratee(index)
                    }
                    return result
                }

                function baseUnary(func) {
                    return function(value) {
                        return func(value)
                    }
                }

                function getValue(object, key) {
                    return object == null ? undefined : object[key]
                }

                function overArg(func, transform) {
                    return function(arg) {
                        return func(transform(arg))
                    }
                }

                function safeGet(object, key) {
                    return key == "__proto__" ? undefined : object[key]
                }
                var arrayProto = Array.prototype,
                    funcProto = Function.prototype,
                    objectProto = Object.prototype;
                var coreJsData = root["__core-js_shared__"];
                var funcToString = funcProto.toString;
                var hasOwnProperty = objectProto.hasOwnProperty;
                var maskSrcKey = function() {
                    var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || "");
                    return uid ? "Symbol(src)_1." + uid : ""
                }();
                var nativeObjectToString = objectProto.toString;
                var objectCtorString = funcToString.call(Object);
                var reIsNative = RegExp("^" + funcToString.call(hasOwnProperty)
                    .replace(reRegExpChar, "\\$&")
                    .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$");
                var Buffer = moduleExports ? root.Buffer : undefined,
                    Symbol = root.Symbol,
                    Uint8Array = root.Uint8Array,
                    allocUnsafe = Buffer ? Buffer.allocUnsafe : undefined,
                    getPrototype = overArg(Object.getPrototypeOf, Object),
                    objectCreate = Object.create,
                    propertyIsEnumerable = objectProto.propertyIsEnumerable,
                    splice = arrayProto.splice,
                    symToStringTag = Symbol ? Symbol.toStringTag : undefined;
                var defineProperty = function() {
                    try {
                        var func = getNative(Object, "defineProperty");
                        func({}, "", {});
                        return func
                    } catch (e) {}
                }();
                var nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined,
                    nativeMax = Math.max,
                    nativeNow = Date.now;
                var Map = getNative(root, "Map"),
                    nativeCreate = getNative(Object, "create");
                var baseCreate = function() {
                    function object() {}
                    return function(proto) {
                        if (!isObject(proto)) {
                            return {}
                        }
                        if (objectCreate) {
                            return objectCreate(proto)
                        }
                        object.prototype = proto;
                        var result = new object;
                        object.prototype = undefined;
                        return result
                    }
                }();

                function Hash(entries) {
                    var index = -1,
                        length = entries == null ? 0 : entries.length;
                    this.clear();
                    while (++index < length) {
                        var entry = entries[index];
                        this.set(entry[0], entry[1])
                    }
                }

                function hashClear() {
                    this.__data__ = nativeCreate ? nativeCreate(null) : {};
                    this.size = 0
                }

                function hashDelete(key) {
                    var result = this.has(key) && delete this.__data__[key];
                    this.size -= result ? 1 : 0;
                    return result
                }

                function hashGet(key) {
                    var data = this.__data__;
                    if (nativeCreate) {
                        var result = data[key];
                        return result === HASH_UNDEFINED ? undefined : result
                    }
                    return hasOwnProperty.call(data, key) ? data[key] : undefined
                }

                function hashHas(key) {
                    var data = this.__data__;
                    return nativeCreate ? data[key] !== undefined : hasOwnProperty.call(data, key)
                }

                function hashSet(key, value) {
                    var data = this.__data__;
                    this.size += this.has(key) ? 0 : 1;
                    data[key] = nativeCreate && value === undefined ? HASH_UNDEFINED : value;
                    return this
                }
                Hash.prototype.clear = hashClear;
                Hash.prototype["delete"] = hashDelete;
                Hash.prototype.get = hashGet;
                Hash.prototype.has = hashHas;
                Hash.prototype.set = hashSet;

                function ListCache(entries) {
                    var index = -1,
                        length = entries == null ? 0 : entries.length;
                    this.clear();
                    while (++index < length) {
                        var entry = entries[index];
                        this.set(entry[0], entry[1])
                    }
                }

                function listCacheClear() {
                    this.__data__ = [];
                    this.size = 0
                }

                function listCacheDelete(key) {
                    var data = this.__data__,
                        index = assocIndexOf(data, key);
                    if (index < 0) {
                        return false
                    }
                    var lastIndex = data.length - 1;
                    if (index == lastIndex) {
                        data.pop()
                    } else {
                        splice.call(data, index, 1)
                    }--this.size;
                    return true
                }

                function listCacheGet(key) {
                    var data = this.__data__,
                        index = assocIndexOf(data, key);
                    return index < 0 ? undefined : data[index][1]
                }

                function listCacheHas(key) {
                    return assocIndexOf(this.__data__, key) > -1
                }

                function listCacheSet(key, value) {
                    var data = this.__data__,
                        index = assocIndexOf(data, key);
                    if (index < 0) {
                        ++this.size;
                        data.push([key, value])
                    } else {
                        data[index][1] = value
                    }
                    return this
                }
                ListCache.prototype.clear = listCacheClear;
                ListCache.prototype["delete"] = listCacheDelete;
                ListCache.prototype.get = listCacheGet;
                ListCache.prototype.has = listCacheHas;
                ListCache.prototype.set = listCacheSet;

                function MapCache(entries) {
                    var index = -1,
                        length = entries == null ? 0 : entries.length;
                    this.clear();
                    while (++index < length) {
                        var entry = entries[index];
                        this.set(entry[0], entry[1])
                    }
                }

                function mapCacheClear() {
                    this.size = 0;
                    this.__data__ = {
                        hash: new Hash,
                        map: new(Map || ListCache),
                        string: new Hash
                    }
                }

                function mapCacheDelete(key) {
                    var result = getMapData(this, key)["delete"](key);
                    this.size -= result ? 1 : 0;
                    return result
                }

                function mapCacheGet(key) {
                    return getMapData(this, key)
                        .get(key)
                }

                function mapCacheHas(key) {
                    return getMapData(this, key)
                        .has(key)
                }

                function mapCacheSet(key, value) {
                    var data = getMapData(this, key),
                        size = data.size;
                    data.set(key, value);
                    this.size += data.size == size ? 0 : 1;
                    return this
                }
                MapCache.prototype.clear = mapCacheClear;
                MapCache.prototype["delete"] = mapCacheDelete;
                MapCache.prototype.get = mapCacheGet;
                MapCache.prototype.has = mapCacheHas;
                MapCache.prototype.set = mapCacheSet;

                function Stack(entries) {
                    var data = this.__data__ = new ListCache(entries);
                    this.size = data.size
                }

                function stackClear() {
                    this.__data__ = new ListCache;
                    this.size = 0
                }

                function stackDelete(key) {
                    var data = this.__data__,
                        result = data["delete"](key);
                    this.size = data.size;
                    return result
                }

                function stackGet(key) {
                    return this.__data__.get(key)
                }

                function stackHas(key) {
                    return this.__data__.has(key)
                }

                function stackSet(key, value) {
                    var data = this.__data__;
                    if (data instanceof ListCache) {
                        var pairs = data.__data__;
                        if (!Map || pairs.length < LARGE_ARRAY_SIZE - 1) {
                            pairs.push([key, value]);
                            this.size = ++data.size;
                            return this
                        }
                        data = this.__data__ = new MapCache(pairs)
                    }
                    data.set(key, value);
                    this.size = data.size;
                    return this
                }
                Stack.prototype.clear = stackClear;
                Stack.prototype["delete"] = stackDelete;
                Stack.prototype.get = stackGet;
                Stack.prototype.has = stackHas;
                Stack.prototype.set = stackSet;

                function arrayLikeKeys(value, inherited) {
                    var isArr = isArray(value),
                        isArg = !isArr && isArguments(value),
                        isBuff = !isArr && !isArg && isBuffer(value),
                        isType = !isArr && !isArg && !isBuff && isTypedArray(value),
                        skipIndexes = isArr || isArg || isBuff || isType,
                        result = skipIndexes ? baseTimes(value.length, String) : [],
                        length = result.length;
                    for (var key in value) {
                        if ((inherited || hasOwnProperty.call(value, key)) && !(skipIndexes && (key == "length" || isBuff && (key == "offset" || key == "parent") || isType && (key == "buffer" || key == "byteLength" || key == "byteOffset") || isIndex(key, length)))) {
                            result.push(key)
                        }
                    }
                    return result
                }

                function assignMergeValue(object, key, value) {
                    if (value !== undefined && !eq(object[key], value) || value === undefined && !(key in object)) {
                        baseAssignValue(object, key, value)
                    }
                }

                function assignValue(object, key, value) {
                    var objValue = object[key];
                    if (!(hasOwnProperty.call(object, key) && eq(objValue, value)) || value === undefined && !(key in object)) {
                        baseAssignValue(object, key, value)
                    }
                }

                function assocIndexOf(array, key) {
                    var length = array.length;
                    while (length--) {
                        if (eq(array[length][0], key)) {
                            return length
                        }
                    }
                    return -1
                }

                function baseAssignValue(object, key, value) {
                    if (key == "__proto__" && defineProperty) {
                        defineProperty(object, key, {
                            configurable: true,
                            enumerable: true,
                            value: value,
                            writable: true
                        })
                    } else {
                        object[key] = value
                    }
                }
                var baseFor = createBaseFor();

                function baseGetTag(value) {
                    if (value == null) {
                        return value === undefined ? undefinedTag : nullTag
                    }
                    return symToStringTag && symToStringTag in Object(value) ? getRawTag(value) : objectToString(value)
                }

                function baseIsArguments(value) {
                    return isObjectLike(value) && baseGetTag(value) == argsTag
                }

                function baseIsNative(value) {
                    if (!isObject(value) || isMasked(value)) {
                        return false
                    }
                    var pattern = isFunction(value) ? reIsNative : reIsHostCtor;
                    return pattern.test(toSource(value))
                }

                function baseIsTypedArray(value) {
                    return isObjectLike(value) && isLength(value.length) && !!typedArrayTags[baseGetTag(value)]
                }

                function baseKeysIn(object) {
                    if (!isObject(object)) {
                        return nativeKeysIn(object)
                    }
                    var isProto = isPrototype(object),
                        result = [];
                    for (var key in object) {
                        if (!(key == "constructor" && (isProto || !hasOwnProperty.call(object, key)))) {
                            result.push(key)
                        }
                    }
                    return result
                }

                function baseMerge(object, source, srcIndex, customizer, stack) {
                    if (object === source) {
                        return
                    }
                    baseFor(source, function(srcValue, key) {
                        if (isObject(srcValue)) {
                            stack || (stack = new Stack);
                            baseMergeDeep(object, source, key, srcIndex, baseMerge, customizer, stack)
                        } else {
                            var newValue = customizer ? customizer(safeGet(object, key), srcValue, key + "", object, source, stack) : undefined;
                            if (newValue === undefined) {
                                newValue = srcValue
                            }
                            assignMergeValue(object, key, newValue)
                        }
                    }, keysIn)
                }

                function baseMergeDeep(object, source, key, srcIndex, mergeFunc, customizer, stack) {
                    var objValue = safeGet(object, key),
                        srcValue = safeGet(source, key),
                        stacked = stack.get(srcValue);
                    if (stacked) {
                        assignMergeValue(object, key, stacked);
                        return
                    }
                    var newValue = customizer ? customizer(objValue, srcValue, key + "", object, source, stack) : undefined;
                    var isCommon = newValue === undefined;
                    if (isCommon) {
                        var isArr = isArray(srcValue),
                            isBuff = !isArr && isBuffer(srcValue),
                            isTyped = !isArr && !isBuff && isTypedArray(srcValue);
                        newValue = srcValue;
                        if (isArr || isBuff || isTyped) {
                            if (isArray(objValue)) {
                                newValue = objValue
                            } else if (isArrayLikeObject(objValue)) {
                                newValue = copyArray(objValue)
                            } else if (isBuff) {
                                isCommon = false;
                                newValue = cloneBuffer(srcValue, true)
                            } else if (isTyped) {
                                isCommon = false;
                                newValue = cloneTypedArray(srcValue, true)
                            } else {
                                newValue = []
                            }
                        } else if (isPlainObject(srcValue) || isArguments(srcValue)) {
                            newValue = objValue;
                            if (isArguments(objValue)) {
                                newValue = toPlainObject(objValue)
                            } else if (!isObject(objValue) || srcIndex && isFunction(objValue)) {
                                newValue = initCloneObject(srcValue)
                            }
                        } else {
                            isCommon = false
                        }
                    }
                    if (isCommon) {
                        stack.set(srcValue, newValue);
                        mergeFunc(newValue, srcValue, srcIndex, customizer, stack);
                        stack["delete"](srcValue)
                    }
                    assignMergeValue(object, key, newValue)
                }

                function baseRest(func, start) {
                    return setToString(overRest(func, start, identity), func + "")
                }
                var baseSetToString = !defineProperty ? identity : function(func, string) {
                    return defineProperty(func, "toString", {
                        configurable: true,
                        enumerable: false,
                        value: constant(string),
                        writable: true
                    })
                };

                function cloneBuffer(buffer, isDeep) {
                    if (isDeep) {
                        return buffer.slice()
                    }
                    var length = buffer.length,
                        result = allocUnsafe ? allocUnsafe(length) : new buffer.constructor(length);
                    buffer.copy(result);
                    return result
                }

                function cloneArrayBuffer(arrayBuffer) {
                    var result = new arrayBuffer.constructor(arrayBuffer.byteLength);
                    new Uint8Array(result)
                        .set(new Uint8Array(arrayBuffer));
                    return result
                }

                function cloneTypedArray(typedArray, isDeep) {
                    var buffer = isDeep ? cloneArrayBuffer(typedArray.buffer) : typedArray.buffer;
                    return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length)
                }

                function copyArray(source, array) {
                    var index = -1,
                        length = source.length;
                    array || (array = Array(length));
                    while (++index < length) {
                        array[index] = source[index]
                    }
                    return array
                }

                function copyObject(source, props, object, customizer) {
                    var isNew = !object;
                    object || (object = {});
                    var index = -1,
                        length = props.length;
                    while (++index < length) {
                        var key = props[index];
                        var newValue = customizer ? customizer(object[key], source[key], key, object, source) : undefined;
                        if (newValue === undefined) {
                            newValue = source[key]
                        }
                        if (isNew) {
                            baseAssignValue(object, key, newValue)
                        } else {
                            assignValue(object, key, newValue)
                        }
                    }
                    return object
                }

                function createAssigner(assigner) {
                    return baseRest(function(object, sources) {
                        var index = -1,
                            length = sources.length,
                            customizer = length > 1 ? sources[length - 1] : undefined,
                            guard = length > 2 ? sources[2] : undefined;
                        customizer = assigner.length > 3 && typeof customizer == "function" ? (length--, customizer) : undefined;
                        if (guard && isIterateeCall(sources[0], sources[1], guard)) {
                            customizer = length < 3 ? undefined : customizer;
                            length = 1
                        }
                        object = Object(object);
                        while (++index < length) {
                            var source = sources[index];
                            if (source) {
                                assigner(object, source, index, customizer)
                            }
                        }
                        return object
                    })
                }

                function createBaseFor(fromRight) {
                    return function(object, iteratee, keysFunc) {
                        var index = -1,
                            iterable = Object(object),
                            props = keysFunc(object),
                            length = props.length;
                        while (length--) {
                            var key = props[fromRight ? length : ++index];
                            if (iteratee(iterable[key], key, iterable) === false) {
                                break
                            }
                        }
                        return object
                    }
                }

                function getMapData(map, key) {
                    var data = map.__data__;
                    return isKeyable(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map
                }

                function getNative(object, key) {
                    var value = getValue(object, key);
                    return baseIsNative(value) ? value : undefined
                }

                function getRawTag(value) {
                    var isOwn = hasOwnProperty.call(value, symToStringTag),
                        tag = value[symToStringTag];
                    try {
                        value[symToStringTag] = undefined;
                        var unmasked = true
                    } catch (e) {}
                    var result = nativeObjectToString.call(value);
                    if (unmasked) {
                        if (isOwn) {
                            value[symToStringTag] = tag
                        } else {
                            delete value[symToStringTag]
                        }
                    }
                    return result
                }

                function initCloneObject(object) {
                    return typeof object.constructor == "function" && !isPrototype(object) ? baseCreate(getPrototype(object)) : {}
                }

                function isIndex(value, length) {
                    var type = typeof value;
                    length = length == null ? MAX_SAFE_INTEGER : length;
                    return !!length && (type == "number" || type != "symbol" && reIsUint.test(value)) && (value > -1 && value % 1 == 0 && value < length)
                }

                function isIterateeCall(value, index, object) {
                    if (!isObject(object)) {
                        return false
                    }
                    var type = typeof index;
                    if (type == "number" ? isArrayLike(object) && isIndex(index, object.length) : type == "string" && index in object) {
                        return eq(object[index], value)
                    }
                    return false
                }

                function isKeyable(value) {
                    var type = typeof value;
                    return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null
                }

                function isMasked(func) {
                    return !!maskSrcKey && maskSrcKey in func
                }

                function isPrototype(value) {
                    var Ctor = value && value.constructor,
                        proto = typeof Ctor == "function" && Ctor.prototype || objectProto;
                    return value === proto
                }

                function nativeKeysIn(object) {
                    var result = [];
                    if (object != null) {
                        for (var key in Object(object)) {
                            result.push(key)
                        }
                    }
                    return result
                }

                function objectToString(value) {
                    return nativeObjectToString.call(value)
                }

                function overRest(func, start, transform) {
                    start = nativeMax(start === undefined ? func.length - 1 : start, 0);
                    return function() {
                        var args = arguments,
                            index = -1,
                            length = nativeMax(args.length - start, 0),
                            array = Array(length);
                        while (++index < length) {
                            array[index] = args[start + index]
                        }
                        index = -1;
                        var otherArgs = Array(start + 1);
                        while (++index < start) {
                            otherArgs[index] = args[index]
                        }
                        otherArgs[start] = transform(array);
                        return apply(func, this, otherArgs)
                    }
                }
                var setToString = shortOut(baseSetToString);

                function shortOut(func) {
                    var count = 0,
                        lastCalled = 0;
                    return function() {
                        var stamp = nativeNow(),
                            remaining = HOT_SPAN - (stamp - lastCalled);
                        lastCalled = stamp;
                        if (remaining > 0) {
                            if (++count >= HOT_COUNT) {
                                return arguments[0]
                            }
                        } else {
                            count = 0
                        }
                        return func.apply(undefined, arguments)
                    }
                }

                function toSource(func) {
                    if (func != null) {
                        try {
                            return funcToString.call(func)
                        } catch (e) {}
                        try {
                            return func + ""
                        } catch (e) {}
                    }
                    return ""
                }

                function eq(value, other) {
                    return value === other || value !== value && other !== other
                }
                var isArguments = baseIsArguments(function() {
                    return arguments
                }()) ? baseIsArguments : function(value) {
                    return isObjectLike(value) && hasOwnProperty.call(value, "callee") && !propertyIsEnumerable.call(value, "callee")
                };
                var isArray = Array.isArray;

                function isArrayLike(value) {
                    return value != null && isLength(value.length) && !isFunction(value)
                }

                function isArrayLikeObject(value) {
                    return isObjectLike(value) && isArrayLike(value)
                }
                var isBuffer = nativeIsBuffer || stubFalse;

                function isFunction(value) {
                    if (!isObject(value)) {
                        return false
                    }
                    var tag = baseGetTag(value);
                    return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag
                }

                function isLength(value) {
                    return typeof value == "number" && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER
                }

                function isObject(value) {
                    var type = typeof value;
                    return value != null && (type == "object" || type == "function")
                }

                function isObjectLike(value) {
                    return value != null && typeof value == "object"
                }

                function isPlainObject(value) {
                    if (!isObjectLike(value) || baseGetTag(value) != objectTag) {
                        return false
                    }
                    var proto = getPrototype(value);
                    if (proto === null) {
                        return true
                    }
                    var Ctor = hasOwnProperty.call(proto, "constructor") && proto.constructor;
                    return typeof Ctor == "function" && Ctor instanceof Ctor && funcToString.call(Ctor) == objectCtorString
                }
                var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;

                function toPlainObject(value) {
                    return copyObject(value, keysIn(value))
                }

                function keysIn(object) {
                    return isArrayLike(object) ? arrayLikeKeys(object, true) : baseKeysIn(object)
                }
                var mergeWith = createAssigner(function(object, source, srcIndex, customizer) {
                    baseMerge(object, source, srcIndex, customizer)
                });

                function constant(value) {
                    return function() {
                        return value
                    }
                }

                function identity(value) {
                    return value
                }

                function stubFalse() {
                    return false
                }
                module.exports = mergeWith
            })
            .call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
        }, {}],
        42: [function(require, module, exports) {
            "use strict";
            module.exports = Number.isNaN || function(x) {
                return x !== x
            }
        }, {}],
        43: [function(require, module, exports) {
            (function(process) {
                function normalizeArray(parts, allowAboveRoot) {
                    var up = 0;
                    for (var i = parts.length - 1; i >= 0; i--) {
                        var last = parts[i];
                        if (last === ".") {
                            parts.splice(i, 1)
                        } else if (last === "..") {
                            parts.splice(i, 1);
                            up++
                        } else if (up) {
                            parts.splice(i, 1);
                            up--
                        }
                    }
                    if (allowAboveRoot) {
                        for (; up--; up) {
                            parts.unshift("..")
                        }
                    }
                    return parts
                }
                exports.resolve = function() {
                    var resolvedPath = "",
                        resolvedAbsolute = false;
                    for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
                        var path = i >= 0 ? arguments[i] : process.cwd();
                        if (typeof path !== "string") {
                            throw new TypeError("Arguments to path.resolve must be strings")
                        } else if (!path) {
                            continue
                        }
                        resolvedPath = path + "/" + resolvedPath;
                        resolvedAbsolute = path.charAt(0) === "/"
                    }
                    resolvedPath = normalizeArray(filter(resolvedPath.split("/"), function(p) {
                            return !!p
                        }), !resolvedAbsolute)
                        .join("/");
                    return (resolvedAbsolute ? "/" : "") + resolvedPath || "."
                };
                exports.normalize = function(path) {
                    var isAbsolute = exports.isAbsolute(path),
                        trailingSlash = substr(path, -1) === "/";
                    path = normalizeArray(filter(path.split("/"), function(p) {
                            return !!p
                        }), !isAbsolute)
                        .join("/");
                    if (!path && !isAbsolute) {
                        path = "."
                    }
                    if (path && trailingSlash) {
                        path += "/"
                    }
                    return (isAbsolute ? "/" : "") + path
                };
                exports.isAbsolute = function(path) {
                    return path.charAt(0) === "/"
                };
                exports.join = function() {
                    var paths = Array.prototype.slice.call(arguments, 0);
                    return exports.normalize(filter(paths, function(p, index) {
                            if (typeof p !== "string") {
                                throw new TypeError("Arguments to path.join must be strings")
                            }
                            return p
                        })
                        .join("/"))
                };
                exports.relative = function(from, to) {
                    from = exports.resolve(from)
                        .substr(1);
                    to = exports.resolve(to)
                        .substr(1);

                    function trim(arr) {
                        var start = 0;
                        for (; start < arr.length; start++) {
                            if (arr[start] !== "") break
                        }
                        var end = arr.length - 1;
                        for (; end >= 0; end--) {
                            if (arr[end] !== "") break
                        }
                        if (start > end) return [];
                        return arr.slice(start, end - start + 1)
                    }
                    var fromParts = trim(from.split("/"));
                    var toParts = trim(to.split("/"));
                    var length = Math.min(fromParts.length, toParts.length);
                    var samePartsLength = length;
                    for (var i = 0; i < length; i++) {
                        if (fromParts[i] !== toParts[i]) {
                            samePartsLength = i;
                            break
                        }
                    }
                    var outputParts = [];
                    for (var i = samePartsLength; i < fromParts.length; i++) {
                        outputParts.push("..")
                    }
                    outputParts = outputParts.concat(toParts.slice(samePartsLength));
                    return outputParts.join("/")
                };
                exports.sep = "/";
                exports.delimiter = ":";
                exports.dirname = function(path) {
                    if (typeof path !== "string") path = path + "";
                    if (path.length === 0) return ".";
                    var code = path.charCodeAt(0);
                    var hasRoot = code === 47;
                    var end = -1;
                    var matchedSlash = true;
                    for (var i = path.length - 1; i >= 1; --i) {
                        code = path.charCodeAt(i);
                        if (code === 47) {
                            if (!matchedSlash) {
                                end = i;
                                break
                            }
                        } else {
                            matchedSlash = false
                        }
                    }
                    if (end === -1) return hasRoot ? "/" : ".";
                    if (hasRoot && end === 1) {
                        return "/"
                    }
                    return path.slice(0, end)
                };

                function basename(path) {
                    if (typeof path !== "string") path = path + "";
                    var start = 0;
                    var end = -1;
                    var matchedSlash = true;
                    var i;
                    for (i = path.length - 1; i >= 0; --i) {
                        if (path.charCodeAt(i) === 47) {
                            if (!matchedSlash) {
                                start = i + 1;
                                break
                            }
                        } else if (end === -1) {
                            matchedSlash = false;
                            end = i + 1
                        }
                    }
                    if (end === -1) return "";
                    return path.slice(start, end)
                }
                exports.basename = function(path, ext) {
                    var f = basename(path);
                    if (ext && f.substr(-1 * ext.length) === ext) {
                        f = f.substr(0, f.length - ext.length)
                    }
                    return f
                };
                exports.extname = function(path) {
                    if (typeof path !== "string") path = path + "";
                    var startDot = -1;
                    var startPart = 0;
                    var end = -1;
                    var matchedSlash = true;
                    var preDotState = 0;
                    for (var i = path.length - 1; i >= 0; --i) {
                        var code = path.charCodeAt(i);
                        if (code === 47) {
                            if (!matchedSlash) {
                                startPart = i + 1;
                                break
                            }
                            continue
                        }
                        if (end === -1) {
                            matchedSlash = false;
                            end = i + 1
                        }
                        if (code === 46) {
                            if (startDot === -1) startDot = i;
                            else if (preDotState !== 1) preDotState = 1
                        } else if (startDot !== -1) {
                            preDotState = -1
                        }
                    }
                    if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
                        return ""
                    }
                    return path.slice(startDot, end)
                };

                function filter(xs, f) {
                    if (xs.filter) return xs.filter(f);
                    var res = [];
                    for (var i = 0; i < xs.length; i++) {
                        if (f(xs[i], i, xs)) res.push(xs[i])
                    }
                    return res
                }
                var substr = "ab".substr(-1) === "b" ? function(str, start, len) {
                    return str.substr(start, len)
                } : function(str, start, len) {
                    if (start < 0) start = str.length + start;
                    return str.substr(start, len)
                }
            })
            .call(this, require("_process"))
        }, {
            _process: 68
        }],
        44: [function(require, module, exports) {
            "use strict";
            exports.__esModule = true;
            exports.default = void 0;
            var _container = _interopRequireDefault(require("./container"));

            function _interopRequireDefault(obj) {
                return obj && obj.__esModule ? obj : {
                    default: obj
                }
            }

            function _inheritsLoose(subClass, superClass) {
                subClass.prototype = Object.create(superClass.prototype);
                subClass.prototype.constructor = subClass;
                subClass.__proto__ = superClass
            }
            var AtRule = function(_Container) {
                _inheritsLoose(AtRule, _Container);

                function AtRule(defaults) {
                    var _this;
                    _this = _Container.call(this, defaults) || this;
                    _this.type = "atrule";
                    return _this
                }
                var _proto = AtRule.prototype;
                _proto.append = function append() {
                    var _Container$prototype$;
                    if (!this.nodes) this.nodes = [];
                    for (var _len = arguments.length, children = new Array(_len), _key = 0; _key < _len; _key++) {
                        children[_key] = arguments[_key]
                    }
                    return (_Container$prototype$ = _Container.prototype.append)
                        .call.apply(_Container$prototype$, [this].concat(children))
                };
                _proto.prepend = function prepend() {
                    var _Container$prototype$2;
                    if (!this.nodes) this.nodes = [];
                    for (var _len2 = arguments.length, children = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
                        children[_key2] = arguments[_key2]
                    }
                    return (_Container$prototype$2 = _Container.prototype.prepend)
                        .call.apply(_Container$prototype$2, [this].concat(children))
                };
                return AtRule
            }(_container.default);
            var _default = AtRule;
            exports.default = _default;
            module.exports = exports.default
        }, {
            "./container": 46
        }],
        45: [function(require, module, exports) {
            "use strict";
            exports.__esModule = true;
            exports.default = void 0;
            var _node = _interopRequireDefault(require("./node"));

            function _interopRequireDefault(obj) {
                return obj && obj.__esModule ? obj : {
                    default: obj
                }
            }

            function _inheritsLoose(subClass, superClass) {
                subClass.prototype = Object.create(superClass.prototype);
                subClass.prototype.constructor = subClass;
                subClass.__proto__ = superClass
            }
            var Comment = function(_Node) {
                _inheritsLoose(Comment, _Node);

                function Comment(defaults) {
                    var _this;
                    _this = _Node.call(this, defaults) || this;
                    _this.type = "comment";
                    return _this
                }
                return Comment
            }(_node.default);
            var _default = Comment;
            exports.default = _default;
            module.exports = exports.default
        }, {
            "./node": 53
        }],
        46: [function(require, module, exports) {
            "use strict";
            exports.__esModule = true;
            exports.default = void 0;
            var _declaration = _interopRequireDefault(require("./declaration"));
            var _comment = _interopRequireDefault(require("./comment"));
            var _node = _interopRequireDefault(require("./node"));

            function _interopRequireDefault(obj) {
                return obj && obj.__esModule ? obj : {
                    default: obj
                }
            }

            function _defineProperties(target, props) {
                for (var i = 0; i < props.length; i++) {
                    var descriptor = props[i];
                    descriptor.enumerable = descriptor.enumerable || false;
                    descriptor.configurable = true;
                    if ("value" in descriptor) descriptor.writable = true;
                    Object.defineProperty(target, descriptor.key, descriptor)
                }
            }

            function _createClass(Constructor, protoProps, staticProps) {
                if (protoProps) _defineProperties(Constructor.prototype, protoProps);
                if (staticProps) _defineProperties(Constructor, staticProps);
                return Constructor
            }

            function _inheritsLoose(subClass, superClass) {
                subClass.prototype = Object.create(superClass.prototype);
                subClass.prototype.constructor = subClass;
                subClass.__proto__ = superClass
            }

            function cleanSource(nodes) {
                return nodes.map(function(i) {
                    if (i.nodes) i.nodes = cleanSource(i.nodes);
                    delete i.source;
                    return i
                })
            }
            var Container = function(_Node) {
                _inheritsLoose(Container, _Node);

                function Container() {
                    return _Node.apply(this, arguments) || this
                }
                var _proto = Container.prototype;
                _proto.push = function push(child) {
                    child.parent = this;
                    this.nodes.push(child);
                    return this
                };
                _proto.each = function each(callback) {
                    if (!this.lastEach) this.lastEach = 0;
                    if (!this.indexes) this.indexes = {};
                    this.lastEach += 1;
                    var id = this.lastEach;
                    this.indexes[id] = 0;
                    if (!this.nodes) return undefined;
                    var index, result;
                    while (this.indexes[id] < this.nodes.length) {
                        index = this.indexes[id];
                        result = callback(this.nodes[index], index);
                        if (result === false) break;
                        this.indexes[id] += 1
                    }
                    delete this.indexes[id];
                    return result
                };
                _proto.walk = function walk(callback) {
                    return this.each(function(child, i) {
                        var result;
                        try {
                            result = callback(child, i)
                        } catch (e) {
                            e.postcssNode = child;
                            if (e.stack && child.source && /\n\s{4}at /.test(e.stack)) {
                                var s = child.source;
                                e.stack = e.stack.replace(/\n\s{4}at /, "$&" + s.input.from + ":" + s.start.line + ":" + s.start.column + "$&")
                            }
                            throw e
                        }
                        if (result !== false && child.walk) {
                            result = child.walk(callback)
                        }
                        return result
                    })
                };
                _proto.walkDecls = function walkDecls(prop, callback) {
                    if (!callback) {
                        callback = prop;
                        return this.walk(function(child, i) {
                            if (child.type === "decl") {
                                return callback(child, i)
                            }
                        })
                    }
                    if (prop instanceof RegExp) {
                        return this.walk(function(child, i) {
                            if (child.type === "decl" && prop.test(child.prop)) {
                                return callback(child, i)
                            }
                        })
                    }
                    return this.walk(function(child, i) {
                        if (child.type === "decl" && child.prop === prop) {
                            return callback(child, i)
                        }
                    })
                };
                _proto.walkRules = function walkRules(selector, callback) {
                    if (!callback) {
                        callback = selector;
                        return this.walk(function(child, i) {
                            if (child.type === "rule") {
                                return callback(child, i)
                            }
                        })
                    }
                    if (selector instanceof RegExp) {
                        return this.walk(function(child, i) {
                            if (child.type === "rule" && selector.test(child.selector)) {
                                return callback(child, i)
                            }
                        })
                    }
                    return this.walk(function(child, i) {
                        if (child.type === "rule" && child.selector === selector) {
                            return callback(child, i)
                        }
                    })
                };
                _proto.walkAtRules = function walkAtRules(name, callback) {
                    if (!callback) {
                        callback = name;
                        return this.walk(function(child, i) {
                            if (child.type === "atrule") {
                                return callback(child, i)
                            }
                        })
                    }
                    if (name instanceof RegExp) {
                        return this.walk(function(child, i) {
                            if (child.type === "atrule" && name.test(child.name)) {
                                return callback(child, i)
                            }
                        })
                    }
                    return this.walk(function(child, i) {
                        if (child.type === "atrule" && child.name === name) {
                            return callback(child, i)
                        }
                    })
                };
                _proto.walkComments = function walkComments(callback) {
                    return this.walk(function(child, i) {
                        if (child.type === "comment") {
                            return callback(child, i)
                        }
                    })
                };
                _proto.append = function append() {
                    for (var _len = arguments.length, children = new Array(_len), _key = 0; _key < _len; _key++) {
                        children[_key] = arguments[_key]
                    }
                    for (var _i = 0; _i < children.length; _i++) {
                        var child = children[_i];
                        var nodes = this.normalize(child, this.last);
                        for (var _iterator = nodes, _isArray = Array.isArray(_iterator), _i2 = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
                            var _ref;
                            if (_isArray) {
                                if (_i2 >= _iterator.length) break;
                                _ref = _iterator[_i2++]
                            } else {
                                _i2 = _iterator.next();
                                if (_i2.done) break;
                                _ref = _i2.value
                            }
                            var node = _ref;
                            this.nodes.push(node)
                        }
                    }
                    return this
                };
                _proto.prepend = function prepend() {
                    for (var _len2 = arguments.length, children = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
                        children[_key2] = arguments[_key2]
                    }
                    children = children.reverse();
                    for (var _iterator2 = children, _isArray2 = Array.isArray(_iterator2), _i3 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
                        var _ref2;
                        if (_isArray2) {
                            if (_i3 >= _iterator2.length) break;
                            _ref2 = _iterator2[_i3++]
                        } else {
                            _i3 = _iterator2.next();
                            if (_i3.done) break;
                            _ref2 = _i3.value
                        }
                        var child = _ref2;
                        var nodes = this.normalize(child, this.first, "prepend")
                            .reverse();
                        for (var _iterator3 = nodes, _isArray3 = Array.isArray(_iterator3), _i4 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
                            var _ref3;
                            if (_isArray3) {
                                if (_i4 >= _iterator3.length) break;
                                _ref3 = _iterator3[_i4++]
                            } else {
                                _i4 = _iterator3.next();
                                if (_i4.done) break;
                                _ref3 = _i4.value
                            }
                            var node = _ref3;
                            this.nodes.unshift(node)
                        }
                        for (var id in this.indexes) {
                            this.indexes[id] = this.indexes[id] + nodes.length
                        }
                    }
                    return this
                };
                _proto.cleanRaws = function cleanRaws(keepBetween) {
                    _Node.prototype.cleanRaws.call(this, keepBetween);
                    if (this.nodes) {
                        for (var _iterator4 = this.nodes, _isArray4 = Array.isArray(_iterator4), _i5 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
                            var _ref4;
                            if (_isArray4) {
                                if (_i5 >= _iterator4.length) break;
                                _ref4 = _iterator4[_i5++]
                            } else {
                                _i5 = _iterator4.next();
                                if (_i5.done) break;
                                _ref4 = _i5.value
                            }
                            var node = _ref4;
                            node.cleanRaws(keepBetween)
                        }
                    }
                };
                _proto.insertBefore = function insertBefore(exist, add) {
                    exist = this.index(exist);
                    var type = exist === 0 ? "prepend" : false;
                    var nodes = this.normalize(add, this.nodes[exist], type)
                        .reverse();
                    for (var _iterator5 = nodes, _isArray5 = Array.isArray(_iterator5), _i6 = 0, _iterator5 = _isArray5 ? _iterator5 : _iterator5[Symbol.iterator]();;) {
                        var _ref5;
                        if (_isArray5) {
                            if (_i6 >= _iterator5.length) break;
                            _ref5 = _iterator5[_i6++]
                        } else {
                            _i6 = _iterator5.next();
                            if (_i6.done) break;
                            _ref5 = _i6.value
                        }
                        var node = _ref5;
                        this.nodes.splice(exist, 0, node)
                    }
                    var index;
                    for (var id in this.indexes) {
                        index = this.indexes[id];
                        if (exist <= index) {
                            this.indexes[id] = index + nodes.length
                        }
                    }
                    return this
                };
                _proto.insertAfter = function insertAfter(exist, add) {
                    exist = this.index(exist);
                    var nodes = this.normalize(add, this.nodes[exist])
                        .reverse();
                    for (var _iterator6 = nodes, _isArray6 = Array.isArray(_iterator6), _i7 = 0, _iterator6 = _isArray6 ? _iterator6 : _iterator6[Symbol.iterator]();;) {
                        var _ref6;
                        if (_isArray6) {
                            if (_i7 >= _iterator6.length) break;
                            _ref6 = _iterator6[_i7++]
                        } else {
                            _i7 = _iterator6.next();
                            if (_i7.done) break;
                            _ref6 = _i7.value
                        }
                        var node = _ref6;
                        this.nodes.splice(exist + 1, 0, node)
                    }
                    var index;
                    for (var id in this.indexes) {
                        index = this.indexes[id];
                        if (exist < index) {
                            this.indexes[id] = index + nodes.length
                        }
                    }
                    return this
                };
                _proto.removeChild = function removeChild(child) {
                    child = this.index(child);
                    this.nodes[child].parent = undefined;
                    this.nodes.splice(child, 1);
                    var index;
                    for (var id in this.indexes) {
                        index = this.indexes[id];
                        if (index >= child) {
                            this.indexes[id] = index - 1
                        }
                    }
                    return this
                };
                _proto.removeAll = function removeAll() {
                    for (var _iterator7 = this.nodes, _isArray7 = Array.isArray(_iterator7), _i8 = 0, _iterator7 = _isArray7 ? _iterator7 : _iterator7[Symbol.iterator]();;) {
                        var _ref7;
                        if (_isArray7) {
                            if (_i8 >= _iterator7.length) break;
                            _ref7 = _iterator7[_i8++]
                        } else {
                            _i8 = _iterator7.next();
                            if (_i8.done) break;
                            _ref7 = _i8.value
                        }
                        var node = _ref7;
                        node.parent = undefined
                    }
                    this.nodes = [];
                    return this
                };
                _proto.replaceValues = function replaceValues(pattern, opts, callback) {
                    if (!callback) {
                        callback = opts;
                        opts = {}
                    }
                    this.walkDecls(function(decl) {
                        if (opts.props && opts.props.indexOf(decl.prop) === -1) return;
                        if (opts.fast && decl.value.indexOf(opts.fast) === -1) return;
                        decl.value = decl.value.replace(pattern, callback)
                    });
                    return this
                };
                _proto.every = function every(condition) {
                    return this.nodes.every(condition)
                };
                _proto.some = function some(condition) {
                    return this.nodes.some(condition)
                };
                _proto.index = function index(child) {
                    if (typeof child === "number") {
                        return child
                    }
                    return this.nodes.indexOf(child)
                };
                _proto.normalize = function normalize(nodes, sample) {
                    var _this = this;
                    if (typeof nodes === "string") {
                        var parse = require("./parse");
                        nodes = cleanSource(parse(nodes)
                            .nodes)
                    } else if (Array.isArray(nodes)) {
                        nodes = nodes.slice(0);
                        for (var _iterator8 = nodes, _isArray8 = Array.isArray(_iterator8), _i9 = 0, _iterator8 = _isArray8 ? _iterator8 : _iterator8[Symbol.iterator]();;) {
                            var _ref8;
                            if (_isArray8) {
                                if (_i9 >= _iterator8.length) break;
                                _ref8 = _iterator8[_i9++]
                            } else {
                                _i9 = _iterator8.next();
                                if (_i9.done) break;
                                _ref8 = _i9.value
                            }
                            var i = _ref8;
                            if (i.parent) i.parent.removeChild(i, "ignore")
                        }
                    } else if (nodes.type === "root") {
                        nodes = nodes.nodes.slice(0);
                        for (var _iterator9 = nodes, _isArray9 = Array.isArray(_iterator9), _i10 = 0, _iterator9 = _isArray9 ? _iterator9 : _iterator9[Symbol.iterator]();;) {
                            var _ref9;
                            if (_isArray9) {
                                if (_i10 >= _iterator9.length) break;
                                _ref9 = _iterator9[_i10++]
                            } else {
                                _i10 = _iterator9.next();
                                if (_i10.done) break;
                                _ref9 = _i10.value
                            }
                            var _i11 = _ref9;
                            if (_i11.parent) _i11.parent.removeChild(_i11, "ignore")
                        }
                    } else if (nodes.type) {
                        nodes = [nodes]
                    } else if (nodes.prop) {
                        if (typeof nodes.value === "undefined") {
                            throw new Error("Value field is missed in node creation")
                        } else if (typeof nodes.value !== "string") {
                            nodes.value = String(nodes.value)
                        }
                        nodes = [new _declaration.default(nodes)]
                    } else if (nodes.selector) {
                        var Rule = require("./rule");
                        nodes = [new Rule(nodes)]
                    } else if (nodes.name) {
                        var AtRule = require("./at-rule");
                        nodes = [new AtRule(nodes)]
                    } else if (nodes.text) {
                        nodes = [new _comment.default(nodes)]
                    } else {
                        throw new Error("Unknown node type in node creation")
                    }
                    var processed = nodes.map(function(i) {
                        if (i.parent) i.parent.removeChild(i);
                        if (typeof i.raws.before === "undefined") {
                            if (sample && typeof sample.raws.before !== "undefined") {
                                i.raws.before = sample.raws.before.replace(/[^\s]/g, "")
                            }
                        }
                        i.parent = _this;
                        return i
                    });
                    return processed
                };
                _createClass(Container, [{
                    key: "first",
                    get: function get() {
                        if (!this.nodes) return undefined;
                        return this.nodes[0]
                    }
                }, {
                    key: "last",
                    get: function get() {
                        if (!this.nodes) return undefined;
                        return this.nodes[this.nodes.length - 1]
                    }
                }]);
                return Container
            }(_node.default);
            var _default = Container;
            exports.default = _default;
            module.exports = exports.default
        }, {
            "./at-rule": 44,
            "./comment": 45,
            "./declaration": 48,
            "./node": 53,
            "./parse": 54,
            "./rule": 61
        }],
        47: [function(require, module, exports) {
            "use strict";
            exports.__esModule = true;
            exports.default = void 0;
            var _supportsColor = _interopRequireDefault(require("supports-color"));
            var _chalk = _interopRequireDefault(require("chalk"));
            var _terminalHighlight = _interopRequireDefault(require("./terminal-highlight"));

            function _interopRequireDefault(obj) {
                return obj && obj.__esModule ? obj : {
                    default: obj
                }
            }

            function _inheritsLoose(subClass, superClass) {
                subClass.prototype = Object.create(superClass.prototype);
                subClass.prototype.constructor = subClass;
                subClass.__proto__ = superClass
            }

            function _assertThisInitialized(self) {
                if (self === void 0) {
                    throw new ReferenceError("this hasn't been initialised - super() hasn't been called")
                }
                return self
            }

            function _wrapNativeSuper(Class) {
                var _cache = typeof Map === "function" ? new Map : undefined;
                _wrapNativeSuper = function _wrapNativeSuper(Class) {
                    if (Class === null || !_isNativeFunction(Class)) return Class;
                    if (typeof Class !== "function") {
                        throw new TypeError("Super expression must either be null or a function")
                    }
                    if (typeof _cache !== "undefined") {
                        if (_cache.has(Class)) return _cache.get(Class);
                        _cache.set(Class, Wrapper)
                    }

                    function Wrapper() {
                        return _construct(Class, arguments, _getPrototypeOf(this)
                            .constructor)
                    }
                    Wrapper.prototype = Object.create(Class.prototype, {
                        constructor: {
                            value: Wrapper,
                            enumerable: false,
                            writable: true,
                            configurable: true
                        }
                    });
                    return _setPrototypeOf(Wrapper, Class)
                };
                return _wrapNativeSuper(Class)
            }

            function isNativeReflectConstruct() {
                if (typeof Reflect === "undefined" || !Reflect.construct) return false;
                if (Reflect.construct.sham) return false;
                if (typeof Proxy === "function") return true;
                try {
                    Date.prototype.toString.call(Reflect.construct(Date, [], function() {}));
                    return true
                } catch (e) {
                    return false
                }
            }

            function _construct(Parent, args, Class) {
                if (isNativeReflectConstruct()) {
                    _construct = Reflect.construct
                } else {
                    _construct = function _construct(Parent, args, Class) {
                        var a = [null];
                        a.push.apply(a, args);
                        var Constructor = Function.bind.apply(Parent, a);
                        var instance = new Constructor;
                        if (Class) _setPrototypeOf(instance, Class.prototype);
                        return instance
                    }
                }
                return _construct.apply(null, arguments)
            }

            function _isNativeFunction(fn) {
                return Function.toString.call(fn)
                    .indexOf("[native code]") !== -1
            }

            function _setPrototypeOf(o, p) {
                _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) {
                    o.__proto__ = p;
                    return o
                };
                return _setPrototypeOf(o, p)
            }

            function _getPrototypeOf(o) {
                _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) {
                    return o.__proto__ || Object.getPrototypeOf(o)
                };
                return _getPrototypeOf(o)
            }
            var CssSyntaxError = function(_Error) {
                _inheritsLoose(CssSyntaxError, _Error);

                function CssSyntaxError(message, line, column, source, file, plugin) {
                    var _this;
                    _this = _Error.call(this, message) || this;
                    _this.name = "CssSyntaxError";
                    _this.reason = message;
                    if (file) {
                        _this.file = file
                    }
                    if (source) {
                        _this.source = source
                    }
                    if (plugin) {
                        _this.plugin = plugin
                    }
                    if (typeof line !== "undefined" && typeof column !== "undefined") {
                        _this.line = line;
                        _this.column = column
                    }
                    _this.setMessage();
                    if (Error.captureStackTrace) {
                        Error.captureStackTrace(_assertThisInitialized(_assertThisInitialized(_this)), CssSyntaxError)
                    }
                    return _this
                }
                var _proto = CssSyntaxError.prototype;
                _proto.setMessage = function setMessage() {
                    this.message = this.plugin ? this.plugin + ": " : "";
                    this.message += this.file ? this.file : "<css input>";
                    if (typeof this.line !== "undefined") {
                        this.message += ":" + this.line + ":" + this.column
                    }
                    this.message += ": " + this.reason
                };
                _proto.showSourceCode = function showSourceCode(color) {
                    var _this2 = this;
                    if (!this.source) return "";
                    var css = this.source;
                    if (_terminalHighlight.default) {
                        if (typeof color === "undefined") color = _supportsColor.default.stdout;
                        if (color) css = (0, _terminalHighlight.default)(css)
                    }
                    var lines = css.split(/\r?\n/);
                    var start = Math.max(this.line - 3, 0);
                    var end = Math.min(this.line + 2, lines.length);
                    var maxWidth = String(end)
                        .length;

                    function mark(text) {
                        if (color && _chalk.default.red) {
                            return _chalk.default.red.bold(text)
                        }
                        return text
                    }

                    function aside(text) {
                        if (color && _chalk.default.gray) {
                            return _chalk.default.gray(text)
                        }
                        return text
                    }
                    return lines.slice(start, end)
                        .map(function(line, index) {
                            var number = start + 1 + index;
                            var gutter = " " + (" " + number)
                                .slice(-maxWidth) + " | ";
                            if (number === _this2.line) {
                                var spacing = aside(gutter.replace(/\d/g, " ")) + line.slice(0, _this2.column - 1)
                                    .replace(/[^\t]/g, " ");
                                return mark(">") + aside(gutter) + line + "\n " + spacing + mark("^")
                            }
                            return " " + aside(gutter) + line
                        })
                        .join("\n")
                };
                _proto.toString = function toString() {
                    var code = this.showSourceCode();
                    if (code) {
                        code = "\n\n" + code + "\n"
                    }
                    return this.name + ": " + this.message + code
                };
                return CssSyntaxError
            }(_wrapNativeSuper(Error));
            var _default = CssSyntaxError;
            exports.default = _default;
            module.exports = exports.default
        }, {
            "./terminal-highlight": 4,
            chalk: 4,
            "supports-color": 4
        }],
        48: [function(require, module, exports) {
            "use strict";
            exports.__esModule = true;
            exports.default = void 0;
            var _node = _interopRequireDefault(require("./node"));

            function _interopRequireDefault(obj) {
                return obj && obj.__esModule ? obj : {
                    default: obj
                }
            }

            function _inheritsLoose(subClass, superClass) {
                subClass.prototype = Object.create(superClass.prototype);
                subClass.prototype.constructor = subClass;
                subClass.__proto__ = superClass
            }
            var Declaration = function(_Node) {
                _inheritsLoose(Declaration, _Node);

                function Declaration(defaults) {
                    var _this;
                    _this = _Node.call(this, defaults) || this;
                    _this.type = "decl";
                    return _this
                }
                return Declaration
            }(_node.default);
            var _default = Declaration;
            exports.default = _default;
            module.exports = exports.default
        }, {
            "./node": 53
        }],
        49: [function(require, module, exports) {
            "use strict";
            exports.__esModule = true;
            exports.default = void 0;
            var _cssSyntaxError = _interopRequireDefault(require("./css-syntax-error"));
            var _previousMap = _interopRequireDefault(require("./previous-map"));
            var _path = _interopRequireDefault(require("path"));

            function _interopRequireDefault(obj) {
                return obj && obj.__esModule ? obj : {
                    default: obj
                }
            }

            function _defineProperties(target, props) {
                for (var i = 0; i < props.length; i++) {
                    var descriptor = props[i];
                    descriptor.enumerable = descriptor.enumerable || false;
                    descriptor.configurable = true;
                    if ("value" in descriptor) descriptor.writable = true;
                    Object.defineProperty(target, descriptor.key, descriptor)
                }
            }

            function _createClass(Constructor, protoProps, staticProps) {
                if (protoProps) _defineProperties(Constructor.prototype, protoProps);
                if (staticProps) _defineProperties(Constructor, staticProps);
                return Constructor
            }
            var sequence = 0;
            var Input = function() {
                function Input(css, opts) {
                    if (opts === void 0) {
                        opts = {}
                    }
                    if (css === null || typeof css === "object" && !css.toString) {
                        throw new Error("PostCSS received " + css + " instead of CSS string")
                    }
                    this.css = css.toString();
                    if (this.css[0] === "\ufeff" || this.css[0] === "￾") {
                        this.hasBOM = true;
                        this.css = this.css.slice(1)
                    } else {
                        this.hasBOM = false
                    }
                    if (opts.from) {
                        if (/^\w+:\/\//.test(opts.from)) {
                            this.file = opts.from
                        } else {
                            this.file = _path.default.resolve(opts.from)
                        }
                    }
                    var map = new _previousMap.default(this.css, opts);
                    if (map.text) {
                        this.map = map;
                        var file = map.consumer()
                            .file;
                        if (!this.file && file) this.file = this.mapResolve(file)
                    }
                    if (!this.file) {
                        sequence += 1;
                        this.id = "<input css " + sequence + ">"
                    }
                    if (this.map) this.map.file = this.from
                }
                var _proto = Input.prototype;
                _proto.error = function error(message, line, column, opts) {
                    if (opts === void 0) {
                        opts = {}
                    }
                    var result;
                    var origin = this.origin(line, column);
                    if (origin) {
                        result = new _cssSyntaxError.default(message, origin.line, origin.column, origin.source, origin.file, opts.plugin)
                    } else {
                        result = new _cssSyntaxError.default(message, line, column, this.css, this.file, opts.plugin)
                    }
                    result.input = {
                        line: line,
                        column: column,
                        source: this.css
                    };
                    if (this.file) result.input.file = this.file;
                    return result
                };
                _proto.origin = function origin(line, column) {
                    if (!this.map) return false;
                    var consumer = this.map.consumer();
                    var from = consumer.originalPositionFor({
                        line: line,
                        column: column
                    });
                    if (!from.source) return false;
                    var result = {
                        file: this.mapResolve(from.source),
                        line: from.line,
                        column: from.column
                    };
                    var source = consumer.sourceContentFor(from.source);
                    if (source) result.source = source;
                    return result
                };
                _proto.mapResolve = function mapResolve(file) {
                    if (/^\w+:\/\//.test(file)) {
                        return file
                    }
                    return _path.default.resolve(this.map.consumer()
                        .sourceRoot || ".", file)
                };
                _createClass(Input, [{
                    key: "from",
                    get: function get() {
                        return this.file || this.id
                    }
                }]);
                return Input
            }();
            var _default = Input;
            exports.default = _default;
            module.exports = exports.default
        }, {
            "./css-syntax-error": 47,
            "./previous-map": 57,
            path: 43
        }],
        50: [function(require, module, exports) {
            (function(process) {
                "use strict";
                exports.__esModule = true;
                exports.default = void 0;
                var _mapGenerator = _interopRequireDefault(require("./map-generator"));
                var _stringify2 = _interopRequireDefault(require("./stringify"));
                var _warnOnce = _interopRequireDefault(require("./warn-once"));
                var _result = _interopRequireDefault(require("./result"));
                var _parse = _interopRequireDefault(require("./parse"));

                function _interopRequireDefault(obj) {
                    return obj && obj.__esModule ? obj : {
                        default: obj
                    }
                }

                function _defineProperties(target, props) {
                    for (var i = 0; i < props.length; i++) {
                        var descriptor = props[i];
                        descriptor.enumerable = descriptor.enumerable || false;
                        descriptor.configurable = true;
                        if ("value" in descriptor) descriptor.writable = true;
                        Object.defineProperty(target, descriptor.key, descriptor)
                    }
                }

                function _createClass(Constructor, protoProps, staticProps) {
                    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
                    if (staticProps) _defineProperties(Constructor, staticProps);
                    return Constructor
                }

                function isPromise(obj) {
                    return typeof obj === "object" && typeof obj.then === "function"
                }
                var LazyResult = function() {
                    function LazyResult(processor, css, opts) {
                        this.stringified = false;
                        this.processed = false;
                        var root;
                        if (typeof css === "object" && css !== null && css.type === "root") {
                            root = css
                        } else if (css instanceof LazyResult || css instanceof _result.default) {
                            root = css.root;
                            if (css.map) {
                                if (typeof opts.map === "undefined") opts.map = {};
                                if (!opts.map.inline) opts.map.inline = false;
                                opts.map.prev = css.map
                            }
                        } else {
                            var parser = _parse.default;
                            if (opts.syntax) parser = opts.syntax.parse;
                            if (opts.parser) parser = opts.parser;
                            if (parser.parse) parser = parser.parse;
                            try {
                                root = parser(css, opts)
                            } catch (error) {
                                this.error = error
                            }
                        }
                        this.result = new _result.default(processor, root, opts)
                    }
                    var _proto = LazyResult.prototype;
                    _proto.warnings = function warnings() {
                        return this.sync()
                            .warnings()
                    };
                    _proto.toString = function toString() {
                        return this.css
                    };
                    _proto.then = function then(onFulfilled, onRejected) {
                        if (process.env.NODE_ENV !== "production") {
                            if (!("from" in this.opts)) {
                                (0, _warnOnce.default)("Without `from` option PostCSS could generate wrong source map " + "and will not find Browserslist config. Set it to CSS file path " + "or to `undefined` to prevent this warning.")
                            }
                        }
                        return this.async()
                            .then(onFulfilled, onRejected)
                    };
                    _proto.catch = function _catch(onRejected) {
                        return this.async()
                            .catch(onRejected)
                    };
                    _proto.finally = function _finally(onFinally) {
                        return this.async()
                            .then(onFinally, onFinally)
                    };
                    _proto.handleError = function handleError(error, plugin) {
                        try {
                            this.error = error;
                            if (error.name === "CssSyntaxError" && !error.plugin) {
                                error.plugin = plugin.postcssPlugin;
                                error.setMessage()
                            } else if (plugin.postcssVersion) {
                                if (process.env.NODE_ENV !== "production") {
                                    var pluginName = plugin.postcssPlugin;
                                    var pluginVer = plugin.postcssVersion;
                                    var runtimeVer = this.result.processor.version;
                                    var a = pluginVer.split(".");
                                    var b = runtimeVer.split(".");
                                    if (a[0] !== b[0] || parseInt(a[1]) > parseInt(b[1])) {
                                        console.error("Unknown error from PostCSS plugin. Your current PostCSS " + "version is " + runtimeVer + ", but " + pluginName + " uses " + pluginVer + ". Perhaps this is the source of the error below.")
                                    }
                                }
                            }
                        } catch (err) {
                            if (console && console.error) console.error(err)
                        }
                    };
                    _proto.asyncTick = function asyncTick(resolve, reject) {
                        var _this = this;
                        if (this.plugin >= this.processor.plugins.length) {
                            this.processed = true;
                            return resolve()
                        }
                        try {
                            var plugin = this.processor.plugins[this.plugin];
                            var promise = this.run(plugin);
                            this.plugin += 1;
                            if (isPromise(promise)) {
                                promise.then(function() {
                                        _this.asyncTick(resolve, reject)
                                    })
                                    .catch(function(error) {
                                        _this.handleError(error, plugin);
                                        _this.processed = true;
                                        reject(error)
                                    })
                            } else {
                                this.asyncTick(resolve, reject)
                            }
                        } catch (error) {
                            this.processed = true;
                            reject(error)
                        }
                    };
                    _proto.async = function async () {
                        var _this2 = this;
                        if (this.processed) {
                            return new Promise(function(resolve, reject) {
                                if (_this2.error) {
                                    reject(_this2.error)
                                } else {
                                    resolve(_this2.stringify())
                                }
                            })
                        }
                        if (this.processing) {
                            return this.processing
                        }
                        this.processing = new Promise(function(resolve, reject) {
                                if (_this2.error) return reject(_this2.error);
                                _this2.plugin = 0;
                                _this2.asyncTick(resolve, reject)
                            })
                            .then(function() {
                                _this2.processed = true;
                                return _this2.stringify()
                            });
                        return this.processing
                    };
                    _proto.sync = function sync() {
                        if (this.processed) return this.result;
                        this.processed = true;
                        if (this.processing) {
                            throw new Error("Use process(css).then(cb) to work with async plugins")
                        }
                        if (this.error) throw this.error;
                        for (var _iterator = this.result.processor.plugins, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
                            var _ref;
                            if (_isArray) {
                                if (_i >= _iterator.length) break;
                                _ref = _iterator[_i++]
                            } else {
                                _i = _iterator.next();
                                if (_i.done) break;
                                _ref = _i.value
                            }
                            var plugin = _ref;
                            var promise = this.run(plugin);
                            if (isPromise(promise)) {
                                throw new Error("Use process(css).then(cb) to work with async plugins")
                            }
                        }
                        return this.result
                    };
                    _proto.run = function run(plugin) {
                        this.result.lastPlugin = plugin;
                        try {
                            return plugin(this.result.root, this.result)
                        } catch (error) {
                            this.handleError(error, plugin);
                            throw error
                        }
                    };
                    _proto.stringify = function stringify() {
                        if (this.stringified) return this.result;
                        this.stringified = true;
                        this.sync();
                        var opts = this.result.opts;
                        var str = _stringify2.default;
                        if (opts.syntax) str = opts.syntax.stringify;
                        if (opts.stringifier) str = opts.stringifier;
                        if (str.stringify) str = str.stringify;
                        var map = new _mapGenerator.default(str, this.result.root, this.result.opts);
                        var data = map.generate();
                        this.result.css = data[0];
                        this.result.map = data[1];
                        return this.result
                    };
                    _createClass(LazyResult, [{
                        key: "processor",
                        get: function get() {
                            return this.result.processor
                        }
                    }, {
                        key: "opts",
                        get: function get() {
                            return this.result.opts
                        }
                    }, {
                        key: "css",
                        get: function get() {
                            return this.stringify()
                                .css
                        }
                    }, {
                        key: "content",
                        get: function get() {
                            return this.stringify()
                                .content
                        }
                    }, {
                        key: "map",
                        get: function get() {
                            return this.stringify()
                                .map
                        }
                    }, {
                        key: "root",
                        get: function get() {
                            return this.sync()
                                .root
                        }
                    }, {
                        key: "messages",
                        get: function get() {
                            return this.sync()
                                .messages
                        }
                    }]);
                    return LazyResult
                }();
                var _default = LazyResult;
                exports.default = _default;
                module.exports = exports.default
            })
            .call(this, require("_process"))
        }, {
            "./map-generator": 52,
            "./parse": 54,
            "./result": 59,
            "./stringify": 63,
            "./warn-once": 66,
            _process: 68
        }],
        51: [function(require, module, exports) {
            "use strict";
            exports.__esModule = true;
            exports.default = void 0;
            var list = {
                split: function split(string, separators, last) {
                    var array = [];
                    var current = "";
                    var split = false;
                    var func = 0;
                    var quote = false;
                    var escape = false;
                    for (var i = 0; i < string.length; i++) {
                        var letter = string[i];
                        if (quote) {
                            if (escape) {
                                escape = false
                            } else if (letter === "\\") {
                                escape = true
                            } else if (letter === quote) {
                                quote = false
                            }
                        } else if (letter === '"' || letter === "'") {
                            quote = letter
                        } else if (letter === "(") {
                            func += 1
                        } else if (letter === ")") {
                            if (func > 0) func -= 1
                        } else if (func === 0) {
                            if (separators.indexOf(letter) !== -1) split = true
                        }
                        if (split) {
                            if (current !== "") array.push(current.trim());
                            current = "";
                            split = false
                        } else {
                            current += letter
                        }
                    }
                    if (last || current !== "") array.push(current.trim());
                    return array
                },
                space: function space(string) {
                    var spaces = [" ", "\n", "\t"];
                    return list.split(string, spaces)
                },
                comma: function comma(string) {
                    return list.split(string, [","], true)
                }
            };
            var _default = list;
            exports.default = _default;
            module.exports = exports.default
        }, {}],
        52: [function(require, module, exports) {
            (function(Buffer) {
                "use strict";
                exports.__esModule = true;
                exports.default = void 0;
                var _sourceMap = _interopRequireDefault(require("source-map"));
                var _path = _interopRequireDefault(require("path"));

                function _interopRequireDefault(obj) {
                    return obj && obj.__esModule ? obj : {
                        default: obj
                    }
                }
                var MapGenerator = function() {
                    function MapGenerator(stringify, root, opts) {
                        this.stringify = stringify;
                        this.mapOpts = opts.map || {};
                        this.root = root;
                        this.opts = opts
                    }
                    var _proto = MapGenerator.prototype;
                    _proto.isMap = function isMap() {
                        if (typeof this.opts.map !== "undefined") {
                            return !!this.opts.map
                        }
                        return this.previous()
                            .length > 0
                    };
                    _proto.previous = function previous() {
                        var _this = this;
                        if (!this.previousMaps) {
                            this.previousMaps = [];
                            this.root.walk(function(node) {
                                if (node.source && node.source.input.map) {
                                    var map = node.source.input.map;
                                    if (_this.previousMaps.indexOf(map) === -1) {
                                        _this.previousMaps.push(map)
                                    }
                                }
                            })
                        }
                        return this.previousMaps
                    };
                    _proto.isInline = function isInline() {
                        if (typeof this.mapOpts.inline !== "undefined") {
                            return this.mapOpts.inline
                        }
                        var annotation = this.mapOpts.annotation;
                        if (typeof annotation !== "undefined" && annotation !== true) {
                            return false
                        }
                        if (this.previous()
                            .length) {
                            return this.previous()
                                .some(function(i) {
                                    return i.inline
                                })
                        }
                        return true
                    };
                    _proto.isSourcesContent = function isSourcesContent() {
                        if (typeof this.mapOpts.sourcesContent !== "undefined") {
                            return this.mapOpts.sourcesContent
                        }
                        if (this.previous()
                            .length) {
                            return this.previous()
                                .some(function(i) {
                                    return i.withContent()
                                })
                        }
                        return true
                    };
                    _proto.clearAnnotation = function clearAnnotation() {
                        if (this.mapOpts.annotation === false) return;
                        var node;
                        for (var i = this.root.nodes.length - 1; i >= 0; i--) {
                            node = this.root.nodes[i];
                            if (node.type !== "comment") continue;
                            if (node.text.indexOf("# sourceMappingURL=") === 0) {
                                this.root.removeChild(i)
                            }
                        }
                    };
                    _proto.setSourcesContent = function setSourcesContent() {
                        var _this2 = this;
                        var already = {};
                        this.root.walk(function(node) {
                            if (node.source) {
                                var from = node.source.input.from;
                                if (from && !already[from]) {
                                    already[from] = true;
                                    var relative = _this2.relative(from);
                                    _this2.map.setSourceContent(relative, node.source.input.css)
                                }
                            }
                        })
                    };
                    _proto.applyPrevMaps = function applyPrevMaps() {
                        for (var _iterator = this.previous(), _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
                            var _ref;
                            if (_isArray) {
                                if (_i >= _iterator.length) break;
                                _ref = _iterator[_i++]
                            } else {
                                _i = _iterator.next();
                                if (_i.done) break;
                                _ref = _i.value
                            }
                            var prev = _ref;
                            var from = this.relative(prev.file);
                            var root = prev.root || _path.default.dirname(prev.file);
                            var map = void 0;
                            if (this.mapOpts.sourcesContent === false) {
                                map = new _sourceMap.default.SourceMapConsumer(prev.text);
                                if (map.sourcesContent) {
                                    map.sourcesContent = map.sourcesContent.map(function() {
                                        return null
                                    })
                                }
                            } else {
                                map = prev.consumer()
                            }
                            this.map.applySourceMap(map, from, this.relative(root))
                        }
                    };
                    _proto.isAnnotation = function isAnnotation() {
                        if (this.isInline()) {
                            return true
                        }
                        if (typeof this.mapOpts.annotation !== "undefined") {
                            return this.mapOpts.annotation
                        }
                        if (this.previous()
                            .length) {
                            return this.previous()
                                .some(function(i) {
                                    return i.annotation
                                })
                        }
                        return true
                    };
                    _proto.toBase64 = function toBase64(str) {
                        if (Buffer) {
                            return Buffer.from(str)
                                .toString("base64")
                        }
                        return window.btoa(unescape(encodeURIComponent(str)))
                    };
                    _proto.addAnnotation = function addAnnotation() {
                        var content;
                        if (this.isInline()) {
                            content = "data:application/json;base64," + this.toBase64(this.map.toString())
                        } else if (typeof this.mapOpts.annotation === "string") {
                            content = this.mapOpts.annotation
                        } else {
                            content = this.outputFile() + ".map"
                        }
                        var eol = "\n";
                        if (this.css.indexOf("\r\n") !== -1) eol = "\r\n";
                        this.css += eol + "/*# sourceMappingURL=" + content + " */"
                    };
                    _proto.outputFile = function outputFile() {
                        if (this.opts.to) {
                            return this.relative(this.opts.to)
                        }
                        if (this.opts.from) {
                            return this.relative(this.opts.from)
                        }
                        return "to.css"
                    };
                    _proto.generateMap = function generateMap() {
                        this.generateString();
                        if (this.isSourcesContent()) this.setSourcesContent();
                        if (this.previous()
                            .length > 0) this.applyPrevMaps();
                        if (this.isAnnotation()) this.addAnnotation();
                        if (this.isInline()) {
                            return [this.css]
                        }
                        return [this.css, this.map]
                    };
                    _proto.relative = function relative(file) {
                        if (file.indexOf("<") === 0) return file;
                        if (/^\w+:\/\//.test(file)) return file;
                        var from = this.opts.to ? _path.default.dirname(this.opts.to) : ".";
                        if (typeof this.mapOpts.annotation === "string") {
                            from = _path.default.dirname(_path.default.resolve(from, this.mapOpts.annotation))
                        }
                        file = _path.default.relative(from, file);
                        if (_path.default.sep === "\\") {
                            return file.replace(/\\/g, "/")
                        }
                        return file
                    };
                    _proto.sourcePath = function sourcePath(node) {
                        if (this.mapOpts.from) {
                            return this.mapOpts.from
                        }
                        return this.relative(node.source.input.from)
                    };
                    _proto.generateString = function generateString() {
                        var _this3 = this;
                        this.css = "";
                        this.map = new _sourceMap.default.SourceMapGenerator({
                            file: this.outputFile()
                        });
                        var line = 1;
                        var column = 1;
                        var lines, last;
                        this.stringify(this.root, function(str, node, type) {
                            _this3.css += str;
                            if (node && type !== "end") {
                                if (node.source && node.source.start) {
                                    _this3.map.addMapping({
                                        source: _this3.sourcePath(node),
                                        generated: {
                                            line: line,
                                            column: column - 1
                                        },
                                        original: {
                                            line: node.source.start.line,
                                            column: node.source.start.column - 1
                                        }
                                    })
                                } else {
                                    _this3.map.addMapping({
                                        source: "<no source>",
                                        original: {
                                            line: 1,
                                            column: 0
                                        },
                                        generated: {
                                            line: line,
                                            column: column - 1
                                        }
                                    })
                                }
                            }
                            lines = str.match(/\n/g);
                            if (lines) {
                                line += lines.length;
                                last = str.lastIndexOf("\n");
                                column = str.length - last
                            } else {
                                column += str.length
                            }
                            if (node && type !== "start") {
                                var p = node.parent || {
                                    raws: {}
                                };
                                if (node.type !== "decl" || node !== p.last || p.raws.semicolon) {
                                    if (node.source && node.source.end) {
                                        _this3.map.addMapping({
                                            source: _this3.sourcePath(node),
                                            generated: {
                                                line: line,
                                                column: column - 2
                                            },
                                            original: {
                                                line: node.source.end.line,
                                                column: node.source.end.column - 1
                                            }
                                        })
                                    } else {
                                        _this3.map.addMapping({
                                            source: "<no source>",
                                            original: {
                                                line: 1,
                                                column: 0
                                            },
                                            generated: {
                                                line: line,
                                                column: column - 1
                                            }
                                        })
                                    }
                                }
                            }
                        })
                    };
                    _proto.generate = function generate() {
                        this.clearAnnotation();
                        if (this.isMap()) {
                            return this.generateMap()
                        }
                        var result = "";
                        this.stringify(this.root, function(i) {
                            result += i
                        });
                        return [result]
                    };
                    return MapGenerator
                }();
                var _default = MapGenerator;
                exports.default = _default;
                module.exports = exports.default
            })
            .call(this, require("buffer")
                .Buffer)
        }, {
            buffer: 5,
            path: 43,
            "source-map": 84
        }],
        53: [function(require, module, exports) {
            (function(process) {
                "use strict";
                exports.__esModule = true;
                exports.default = void 0;
                var _cssSyntaxError = _interopRequireDefault(require("./css-syntax-error"));
                var _stringifier = _interopRequireDefault(require("./stringifier"));
                var _stringify = _interopRequireDefault(require("./stringify"));

                function _interopRequireDefault(obj) {
                    return obj && obj.__esModule ? obj : {
                        default: obj
                    }
                }

                function cloneNode(obj, parent) {
                    var cloned = new obj.constructor;
                    for (var i in obj) {
                        if (!obj.hasOwnProperty(i)) continue;
                        var value = obj[i];
                        var type = typeof value;
                        if (i === "parent" && type === "object") {
                            if (parent) cloned[i] = parent
                        } else if (i === "source") {
                            cloned[i] = value
                        } else if (value instanceof Array) {
                            cloned[i] = value.map(function(j) {
                                return cloneNode(j, cloned)
                            })
                        } else {
                            if (type === "object" && value !== null) value = cloneNode(value);
                            cloned[i] = value
                        }
                    }
                    return cloned
                }
                var Node = function() {
                    function Node(defaults) {
                        if (defaults === void 0) {
                            defaults = {}
                        }
                        this.raws = {};
                        if (process.env.NODE_ENV !== "production") {
                            if (typeof defaults !== "object" && typeof defaults !== "undefined") {
                                throw new Error("PostCSS nodes constructor accepts object, not " + JSON.stringify(defaults))
                            }
                        }
                        for (var name in defaults) {
                            this[name] = defaults[name]
                        }
                    }
                    var _proto = Node.prototype;
                    _proto.error = function error(message, opts) {
                        if (opts === void 0) {
                            opts = {}
                        }
                        if (this.source) {
                            var pos = this.positionBy(opts);
                            return this.source.input.error(message, pos.line, pos.column, opts)
                        }
                        return new _cssSyntaxError.default(message)
                    };
                    _proto.warn = function warn(result, text, opts) {
                        var data = {
                            node: this
                        };
                        for (var i in opts) {
                            data[i] = opts[i]
                        }
                        return result.warn(text, data)
                    };
                    _proto.remove = function remove() {
                        if (this.parent) {
                            this.parent.removeChild(this)
                        }
                        this.parent = undefined;
                        return this
                    };
                    _proto.toString = function toString(stringifier) {
                        if (stringifier === void 0) {
                            stringifier = _stringify.default
                        }
                        if (stringifier.stringify) stringifier = stringifier.stringify;
                        var result = "";
                        stringifier(this, function(i) {
                            result += i
                        });
                        return result
                    };
                    _proto.clone = function clone(overrides) {
                        if (overrides === void 0) {
                            overrides = {}
                        }
                        var cloned = cloneNode(this);
                        for (var name in overrides) {
                            cloned[name] = overrides[name]
                        }
                        return cloned
                    };
                    _proto.cloneBefore = function cloneBefore(overrides) {
                        if (overrides === void 0) {
                            overrides = {}
                        }
                        var cloned = this.clone(overrides);
                        this.parent.insertBefore(this, cloned);
                        return cloned
                    };
                    _proto.cloneAfter = function cloneAfter(overrides) {
                        if (overrides === void 0) {
                            overrides = {}
                        }
                        var cloned = this.clone(overrides);
                        this.parent.insertAfter(this, cloned);
                        return cloned
                    };
                    _proto.replaceWith = function replaceWith() {
                        if (this.parent) {
                            for (var _len = arguments.length, nodes = new Array(_len), _key = 0; _key < _len; _key++) {
                                nodes[_key] = arguments[_key]
                            }
                            for (var _i = 0; _i < nodes.length; _i++) {
                                var node = nodes[_i];
                                this.parent.insertBefore(this, node)
                            }
                            this.remove()
                        }
                        return this
                    };
                    _proto.next = function next() {
                        if (!this.parent) return undefined;
                        var index = this.parent.index(this);
                        return this.parent.nodes[index + 1]
                    };
                    _proto.prev = function prev() {
                        if (!this.parent) return undefined;
                        var index = this.parent.index(this);
                        return this.parent.nodes[index - 1]
                    };
                    _proto.before = function before(add) {
                        this.parent.insertBefore(this, add);
                        return this
                    };
                    _proto.after = function after(add) {
                        this.parent.insertAfter(this, add);
                        return this
                    };
                    _proto.toJSON = function toJSON() {
                        var fixed = {};
                        for (var name in this) {
                            if (!this.hasOwnProperty(name)) continue;
                            if (name === "parent") continue;
                            var value = this[name];
                            if (value instanceof Array) {
                                fixed[name] = value.map(function(i) {
                                    if (typeof i === "object" && i.toJSON) {
                                        return i.toJSON()
                                    } else {
                                        return i
                                    }
                                })
                            } else if (typeof value === "object" && value.toJSON) {
                                fixed[name] = value.toJSON()
                            } else {
                                fixed[name] = value
                            }
                        }
                        return fixed
                    };
                    _proto.raw = function raw(prop, defaultType) {
                        var str = new _stringifier.default;
                        return str.raw(this, prop, defaultType)
                    };
                    _proto.root = function root() {
                        var result = this;
                        while (result.parent) {
                            result = result.parent
                        }
                        return result
                    };
                    _proto.cleanRaws = function cleanRaws(keepBetween) {
                        delete this.raws.before;
                        delete this.raws.after;
                        if (!keepBetween) delete this.raws.between
                    };
                    _proto.positionInside = function positionInside(index) {
                        var string = this.toString();
                        var column = this.source.start.column;
                        var line = this.source.start.line;
                        for (var i = 0; i < index; i++) {
                            if (string[i] === "\n") {
                                column = 1;
                                line += 1
                            } else {
                                column += 1
                            }
                        }
                        return {
                            line: line,
                            column: column
                        }
                    };
                    _proto.positionBy = function positionBy(opts) {
                        var pos = this.source.start;
                        if (opts.index) {
                            pos = this.positionInside(opts.index)
                        } else if (opts.word) {
                            var index = this.toString()
                                .indexOf(opts.word);
                            if (index !== -1) pos = this.positionInside(index)
                        }
                        return pos
                    };
                    return Node
                }();
                var _default = Node;
                exports.default = _default;
                module.exports = exports.default
            })
            .call(this, require("_process"))
        }, {
            "./css-syntax-error": 47,
            "./stringifier": 62,
            "./stringify": 63,
            _process: 68
        }],
        54: [function(require, module, exports) {
            (function(process) {
                "use strict";
                exports.__esModule = true;
                exports.default = void 0;
                var _parser = _interopRequireDefault(require("./parser"));
                var _input = _interopRequireDefault(require("./input"));

                function _interopRequireDefault(obj) {
                    return obj && obj.__esModule ? obj : {
                        default: obj
                    }
                }

                function parse(css, opts) {
                    var input = new _input.default(css, opts);
                    var parser = new _parser.default(input);
                    try {
                        parser.parse()
                    } catch (e) {
                        if (process.env.NODE_ENV !== "production") {
                            if (e.name === "CssSyntaxError" && opts && opts.from) {
                                if (/\.scss$/i.test(opts.from)) {
                                    e.message += "\nYou tried to parse SCSS with " + "the standard CSS parser; " + "try again with the postcss-scss parser"
                                } else if (/\.sass/i.test(opts.from)) {
                                    e.message += "\nYou tried to parse Sass with " + "the standard CSS parser; " + "try again with the postcss-sass parser"
                                } else if (/\.less$/i.test(opts.from)) {
                                    e.message += "\nYou tried to parse Less with " + "the standard CSS parser; " + "try again with the postcss-less parser"
                                }
                            }
                        }
                        throw e
                    }
                    return parser.root
                }
                var _default = parse;
                exports.default = _default;
                module.exports = exports.default
            })
            .call(this, require("_process"))
        }, {
            "./input": 49,
            "./parser": 55,
            _process: 68
        }],
        55: [function(require, module, exports) {
            "use strict";
            exports.__esModule = true;
            exports.default = void 0;
            var _declaration = _interopRequireDefault(require("./declaration"));
            var _tokenize = _interopRequireDefault(require("./tokenize"));
            var _comment = _interopRequireDefault(require("./comment"));
            var _atRule = _interopRequireDefault(require("./at-rule"));
            var _root = _interopRequireDefault(require("./root"));
            var _rule = _interopRequireDefault(require("./rule"));

            function _interopRequireDefault(obj) {
                return obj && obj.__esModule ? obj : {
                    default: obj
                }
            }
            var Parser = function() {
                function Parser(input) {
                    this.input = input;
                    this.root = new _root.default;
                    this.current = this.root;
                    this.spaces = "";
                    this.semicolon = false;
                    this.createTokenizer();
                    this.root.source = {
                        input: input,
                        start: {
                            line: 1,
                            column: 1
                        }
                    }
                }
                var _proto = Parser.prototype;
                _proto.createTokenizer = function createTokenizer() {
                    this.tokenizer = (0, _tokenize.default)(this.input)
                };
                _proto.parse = function parse() {
                    var token;
                    while (!this.tokenizer.endOfFile()) {
                        token = this.tokenizer.nextToken();
                        switch (token[0]) {
                            case "space":
                                this.spaces += token[1];
                                break;
                            case ";":
                                this.freeSemicolon(token);
                                break;
                            case "}":
                                this.end(token);
                                break;
                            case "comment":
                                this.comment(token);
                                break;
                            case "at-word":
                                this.atrule(token);
                                break;
                            case "{":
                                this.emptyRule(token);
                                break;
                            default:
                                this.other(token);
                                break
                        }
                    }
                    this.endFile()
                };
                _proto.comment = function comment(token) {
                    var node = new _comment.default;
                    this.init(node, token[2], token[3]);
                    node.source.end = {
                        line: token[4],
                        column: token[5]
                    };
                    var text = token[1].slice(2, -2);
                    if (/^\s*$/.test(text)) {
                        node.text = "";
                        node.raws.left = text;
                        node.raws.right = ""
                    } else {
                        var match = text.match(/^(\s*)([^]*[^\s])(\s*)$/);
                        node.text = match[2];
                        node.raws.left = match[1];
                        node.raws.right = match[3]
                    }
                };
                _proto.emptyRule = function emptyRule(token) {
                    var node = new _rule.default;
                    this.init(node, token[2], token[3]);
                    node.selector = "";
                    node.raws.between = "";
                    this.current = node
                };
                _proto.other = function other(start) {
                    var end = false;
                    var type = null;
                    var colon = false;
                    var bracket = null;
                    var brackets = [];
                    var tokens = [];
                    var token = start;
                    while (token) {
                        type = token[0];
                        tokens.push(token);
                        if (type === "(" || type === "[") {
                            if (!bracket) bracket = token;
                            brackets.push(type === "(" ? ")" : "]")
                        } else if (brackets.length === 0) {
                            if (type === ";") {
                                if (colon) {
                                    this.decl(tokens);
                                    return
                                } else {
                                    break
                                }
                            } else if (type === "{") {
                                this.rule(tokens);
                                return
                            } else if (type === "}") {
                                this.tokenizer.back(tokens.pop());
                                end = true;
                                break
                            } else if (type === ":") {
                                colon = true
                            }
                        } else if (type === brackets[brackets.length - 1]) {
                            brackets.pop();
                            if (brackets.length === 0) bracket = null
                        }
                        token = this.tokenizer.nextToken()
                    }
                    if (this.tokenizer.endOfFile()) end = true;
                    if (brackets.length > 0) this.unclosedBracket(bracket);
                    if (end && colon) {
                        while (tokens.length) {
                            token = tokens[tokens.length - 1][0];
                            if (token !== "space" && token !== "comment") break;
                            this.tokenizer.back(tokens.pop())
                        }
                        this.decl(tokens)
                    } else {
                        this.unknownWord(tokens)
                    }
                };
                _proto.rule = function rule(tokens) {
                    tokens.pop();
                    var node = new _rule.default;
                    this.init(node, tokens[0][2], tokens[0][3]);
                    node.raws.between = this.spacesAndCommentsFromEnd(tokens);
                    this.raw(node, "selector", tokens);
                    this.current = node
                };
                _proto.decl = function decl(tokens) {
                    var node = new _declaration.default;
                    this.init(node);
                    var last = tokens[tokens.length - 1];
                    if (last[0] === ";") {
                        this.semicolon = true;
                        tokens.pop()
                    }
                    if (last[4]) {
                        node.source.end = {
                            line: last[4],
                            column: last[5]
                        }
                    } else {
                        node.source.end = {
                            line: last[2],
                            column: last[3]
                        }
                    }
                    while (tokens[0][0] !== "word") {
                        if (tokens.length === 1) this.unknownWord(tokens);
                        node.raws.before += tokens.shift()[1]
                    }
                    node.source.start = {
                        line: tokens[0][2],
                        column: tokens[0][3]
                    };
                    node.prop = "";
                    while (tokens.length) {
                        var type = tokens[0][0];
                        if (type === ":" || type === "space" || type === "comment") {
                            break
                        }
                        node.prop += tokens.shift()[1]
                    }
                    node.raws.between = "";
                    var token;
                    while (tokens.length) {
                        token = tokens.shift();
                        if (token[0] === ":") {
                            node.raws.between += token[1];
                            break
                        } else {
                            if (token[0] === "word" && /\w/.test(token[1])) {
                                this.unknownWord([token])
                            }
                            node.raws.between += token[1]
                        }
                    }
                    if (node.prop[0] === "_" || node.prop[0] === "*") {
                        node.raws.before += node.prop[0];
                        node.prop = node.prop.slice(1)
                    }
                    node.raws.between += this.spacesAndCommentsFromStart(tokens);
                    this.precheckMissedSemicolon(tokens);
                    for (var i = tokens.length - 1; i > 0; i--) {
                        token = tokens[i];
                        if (token[1].toLowerCase() === "!important") {
                            node.important = true;
                            var string = this.stringFrom(tokens, i);
                            string = this.spacesFromEnd(tokens) + string;
                            if (string !== " !important") node.raws.important = string;
                            break
                        } else if (token[1].toLowerCase() === "important") {
                            var cache = tokens.slice(0);
                            var str = "";
                            for (var j = i; j > 0; j--) {
                                var _type = cache[j][0];
                                if (str.trim()
                                    .indexOf("!") === 0 && _type !== "space") {
                                    break
                                }
                                str = cache.pop()[1] + str
                            }
                            if (str.trim()
                                .indexOf("!") === 0) {
                                node.important = true;
                                node.raws.important = str;
                                tokens = cache
                            }
                        }
                        if (token[0] !== "space" && token[0] !== "comment") {
                            break
                        }
                    }
                    this.raw(node, "value", tokens);
                    if (node.value.indexOf(":") !== -1) this.checkMissedSemicolon(tokens)
                };
                _proto.atrule = function atrule(token) {
                    var node = new _atRule.default;
                    node.name = token[1].slice(1);
                    if (node.name === "") {
                        this.unnamedAtrule(node, token)
                    }
                    this.init(node, token[2], token[3]);
                    var prev;
                    var shift;
                    var last = false;
                    var open = false;
                    var params = [];
                    while (!this.tokenizer.endOfFile()) {
                        token = this.tokenizer.nextToken();
                        if (token[0] === ";") {
                            node.source.end = {
                                line: token[2],
                                column: token[3]
                            };
                            this.semicolon = true;
                            break
                        } else if (token[0] === "{") {
                            open = true;
                            break
                        } else if (token[0] === "}") {
                            if (params.length > 0) {
                                shift = params.length - 1;
                                prev = params[shift];
                                while (prev && prev[0] === "space") {
                                    prev = params[--shift]
                                }
                                if (prev) {
                                    node.source.end = {
                                        line: prev[4],
                                        column: prev[5]
                                    }
                                }
                            }
                            this.end(token);
                            break
                        } else {
                            params.push(token)
                        }
                        if (this.tokenizer.endOfFile()) {
                            last = true;
                            break
                        }
                    }
                    node.raws.between = this.spacesAndCommentsFromEnd(params);
                    if (params.length) {
                        node.raws.afterName = this.spacesAndCommentsFromStart(params);
                        this.raw(node, "params", params);
                        if (last) {
                            token = params[params.length - 1];
                            node.source.end = {
                                line: token[4],
                                column: token[5]
                            };
                            this.spaces = node.raws.between;
                            node.raws.between = ""
                        }
                    } else {
                        node.raws.afterName = "";
                        node.params = ""
                    }
                    if (open) {
                        node.nodes = [];
                        this.current = node
                    }
                };
                _proto.end = function end(token) {
                    if (this.current.nodes && this.current.nodes.length) {
                        this.current.raws.semicolon = this.semicolon
                    }
                    this.semicolon = false;
                    this.current.raws.after = (this.current.raws.after || "") + this.spaces;
                    this.spaces = "";
                    if (this.current.parent) {
                        this.current.source.end = {
                            line: token[2],
                            column: token[3]
                        };
                        this.current = this.current.parent
                    } else {
                        this.unexpectedClose(token)
                    }
                };
                _proto.endFile = function endFile() {
                    if (this.current.parent) this.unclosedBlock();
                    if (this.current.nodes && this.current.nodes.length) {
                        this.current.raws.semicolon = this.semicolon
                    }
                    this.current.raws.after = (this.current.raws.after || "") + this.spaces
                };
                _proto.freeSemicolon = function freeSemicolon(token) {
                    this.spaces += token[1];
                    if (this.current.nodes) {
                        var prev = this.current.nodes[this.current.nodes.length - 1];
                        if (prev && prev.type === "rule" && !prev.raws.ownSemicolon) {
                            prev.raws.ownSemicolon = this.spaces;
                            this.spaces = ""
                        }
                    }
                };
                _proto.init = function init(node, line, column) {
                    this.current.push(node);
                    node.source = {
                        start: {
                            line: line,
                            column: column
                        },
                        input: this.input
                    };
                    node.raws.before = this.spaces;
                    this.spaces = "";
                    if (node.type !== "comment") this.semicolon = false
                };
                _proto.raw = function raw(node, prop, tokens) {
                    var token, type;
                    var length = tokens.length;
                    var value = "";
                    var clean = true;
                    var next, prev;
                    var pattern = /^([.|#])?([\w])+/i;
                    for (var i = 0; i < length; i += 1) {
                        token = tokens[i];
                        type = token[0];
                        if (type === "comment" && node.type === "rule") {
                            prev = tokens[i - 1];
                            next = tokens[i + 1];
                            if (prev[0] !== "space" && next[0] !== "space" && pattern.test(prev[1]) && pattern.test(next[1])) {
                                value += token[1]
                            } else {
                                clean = false
                            }
                            continue
                        }
                        if (type === "comment" || type === "space" && i === length - 1) {
                            clean = false
                        } else {
                            value += token[1]
                        }
                    }
                    if (!clean) {
                        var raw = tokens.reduce(function(all, i) {
                            return all + i[1]
                        }, "");
                        node.raws[prop] = {
                            value: value,
                            raw: raw
                        }
                    }
                    node[prop] = value
                };
                _proto.spacesAndCommentsFromEnd = function spacesAndCommentsFromEnd(tokens) {
                    var lastTokenType;
                    var spaces = "";
                    while (tokens.length) {
                        lastTokenType = tokens[tokens.length - 1][0];
                        if (lastTokenType !== "space" && lastTokenType !== "comment") break;
                        spaces = tokens.pop()[1] + spaces
                    }
                    return spaces
                };
                _proto.spacesAndCommentsFromStart = function spacesAndCommentsFromStart(tokens) {
                    var next;
                    var spaces = "";
                    while (tokens.length) {
                        next = tokens[0][0];
                        if (next !== "space" && next !== "comment") break;
                        spaces += tokens.shift()[1]
                    }
                    return spaces
                };
                _proto.spacesFromEnd = function spacesFromEnd(tokens) {
                    var lastTokenType;
                    var spaces = "";
                    while (tokens.length) {
                        lastTokenType = tokens[tokens.length - 1][0];
                        if (lastTokenType !== "space") break;
                        spaces = tokens.pop()[1] + spaces
                    }
                    return spaces
                };
                _proto.stringFrom = function stringFrom(tokens, from) {
                    var result = "";
                    for (var i = from; i < tokens.length; i++) {
                        result += tokens[i][1]
                    }
                    tokens.splice(from, tokens.length - from);
                    return result
                };
                _proto.colon = function colon(tokens) {
                    var brackets = 0;
                    var token, type, prev;
                    for (var i = 0; i < tokens.length; i++) {
                        token = tokens[i];
                        type = token[0];
                        if (type === "(") {
                            brackets += 1
                        }
                        if (type === ")") {
                            brackets -= 1
                        }
                        if (brackets === 0 && type === ":") {
                            if (!prev) {
                                this.doubleColon(token)
                            } else if (prev[0] === "word" && prev[1] === "progid") {
                                continue
                            } else {
                                return i
                            }
                        }
                        prev = token
                    }
                    return false
                };
                _proto.unclosedBracket = function unclosedBracket(bracket) {
                    throw this.input.error("Unclosed bracket", bracket[2], bracket[3])
                };
                _proto.unknownWord = function unknownWord(tokens) {
                    throw this.input.error("Unknown word", tokens[0][2], tokens[0][3])
                };
                _proto.unexpectedClose = function unexpectedClose(token) {
                    throw this.input.error("Unexpected }", token[2], token[3])
                };
                _proto.unclosedBlock = function unclosedBlock() {
                    var pos = this.current.source.start;
                    throw this.input.error("Unclosed block", pos.line, pos.column)
                };
                _proto.doubleColon = function doubleColon(token) {
                    throw this.input.error("Double colon", token[2], token[3])
                };
                _proto.unnamedAtrule = function unnamedAtrule(node, token) {
                    throw this.input.error("At-rule without name", token[2], token[3])
                };
                _proto.precheckMissedSemicolon = function precheckMissedSemicolon() {};
                _proto.checkMissedSemicolon = function checkMissedSemicolon(tokens) {
                    var colon = this.colon(tokens);
                    if (colon === false) return;
                    var founded = 0;
                    var token;
                    for (var j = colon - 1; j >= 0; j--) {
                        token = tokens[j];
                        if (token[0] !== "space") {
                            founded += 1;
                            if (founded === 2) break
                        }
                    }
                    throw this.input.error("Missed semicolon", token[2], token[3])
                };
                return Parser
            }();
            exports.default = Parser;
            module.exports = exports.default
        }, {
            "./at-rule": 44,
            "./comment": 45,
            "./declaration": 48,
            "./root": 60,
            "./rule": 61,
            "./tokenize": 64
        }],
        56: [function(require, module, exports) {
            "use strict";
            exports.__esModule = true;
            exports.default = void 0;
            var _declaration = _interopRequireDefault(require("./declaration"));
            var _processor = _interopRequireDefault(require("./processor"));
            var _stringify = _interopRequireDefault(require("./stringify"));
            var _comment = _interopRequireDefault(require("./comment"));
            var _atRule = _interopRequireDefault(require("./at-rule"));
            var _vendor = _interopRequireDefault(require("./vendor"));
            var _parse = _interopRequireDefault(require("./parse"));
            var _list = _interopRequireDefault(require("./list"));
            var _rule = _interopRequireDefault(require("./rule"));
            var _root = _interopRequireDefault(require("./root"));

            function _interopRequireDefault(obj) {
                return obj && obj.__esModule ? obj : {
                    default: obj
                }
            }

            function postcss() {
                for (var _len = arguments.length, plugins = new Array(_len), _key = 0; _key < _len; _key++) {
                    plugins[_key] = arguments[_key]
                }
                if (plugins.length === 1 && Array.isArray(plugins[0])) {
                    plugins = plugins[0]
                }
                return new _processor.default(plugins)
            }
            postcss.plugin = function plugin(name, initializer) {
                function creator() {
                    var transformer = initializer.apply(void 0, arguments);
                    transformer.postcssPlugin = name;
                    transformer.postcssVersion = (new _processor.default)
                        .version;
                    return transformer
                }
                var cache;
                Object.defineProperty(creator, "postcss", {
                    get: function get() {
                        if (!cache) cache = creator();
                        return cache
                    }
                });
                creator.process = function(css, processOpts, pluginOpts) {
                    return postcss([creator(pluginOpts)])
                        .process(css, processOpts)
                };
                return creator
            };
            postcss.stringify = _stringify.default;
            postcss.parse = _parse.default;
            postcss.vendor = _vendor.default;
            postcss.list = _list.default;
            postcss.comment = function(defaults) {
                return new _comment.default(defaults)
            };
            postcss.atRule = function(defaults) {
                return new _atRule.default(defaults)
            };
            postcss.decl = function(defaults) {
                return new _declaration.default(defaults)
            };
            postcss.rule = function(defaults) {
                return new _rule.default(defaults)
            };
            postcss.root = function(defaults) {
                return new _root.default(defaults)
            };
            var _default = postcss;
            exports.default = _default;
            module.exports = exports.default
        }, {
            "./at-rule": 44,
            "./comment": 45,
            "./declaration": 48,
            "./list": 51,
            "./parse": 54,
            "./processor": 58,
            "./root": 60,
            "./rule": 61,
            "./stringify": 63,
            "./vendor": 65
        }],
        57: [function(require, module, exports) {
            (function(Buffer) {
                "use strict";
                exports.__esModule = true;
                exports.default = void 0;
                var _sourceMap = _interopRequireDefault(require("source-map"));
                var _path = _interopRequireDefault(require("path"));
                var _fs = _interopRequireDefault(require("fs"));

                function _interopRequireDefault(obj) {
                    return obj && obj.__esModule ? obj : {
                        default: obj
                    }
                }

                function fromBase64(str) {
                    if (Buffer) {
                        return Buffer.from(str, "base64")
                            .toString()
                    } else {
                        return window.atob(str)
                    }
                }
                var PreviousMap = function() {
                    function PreviousMap(css, opts) {
                        this.loadAnnotation(css);
                        this.inline = this.startWith(this.annotation, "data:");
                        var prev = opts.map ? opts.map.prev : undefined;
                        var text = this.loadMap(opts.from, prev);
                        if (text) this.text = text
                    }
                    var _proto = PreviousMap.prototype;
                    _proto.consumer = function consumer() {
                        if (!this.consumerCache) {
                            this.consumerCache = new _sourceMap.default.SourceMapConsumer(this.text)
                        }
                        return this.consumerCache
                    };
                    _proto.withContent = function withContent() {
                        return !!(this.consumer()
                            .sourcesContent && this.consumer()
                            .sourcesContent.length > 0)
                    };
                    _proto.startWith = function startWith(string, start) {
                        if (!string) return false;
                        return string.substr(0, start.length) === start
                    };
                    _proto.loadAnnotation = function loadAnnotation(css) {
                        var match = css.match(/\/\*\s*# sourceMappingURL=(.*)\s*\*\//);
                        if (match) this.annotation = match[1].trim()
                    };
                    _proto.decodeInline = function decodeInline(text) {
                        var baseCharsetUri = /^data:application\/json;charset=utf-?8;base64,/;
                        var baseUri = /^data:application\/json;base64,/;
                        var uri = "data:application/json,";
                        if (this.startWith(text, uri)) {
                            return decodeURIComponent(text.substr(uri.length))
                        }
                        if (baseCharsetUri.test(text) || baseUri.test(text)) {
                            return fromBase64(text.substr(RegExp.lastMatch.length))
                        }
                        var encoding = text.match(/data:application\/json;([^,]+),/)[1];
                        throw new Error("Unsupported source map encoding " + encoding)
                    };
                    _proto.loadMap = function loadMap(file, prev) {
                        if (prev === false) return false;
                        if (prev) {
                            if (typeof prev === "string") {
                                return prev
                            } else if (typeof prev === "function") {
                                var prevPath = prev(file);
                                if (prevPath && _fs.default.existsSync && _fs.default.existsSync(prevPath)) {
                                    return _fs.default.readFileSync(prevPath, "utf-8")
                                        .toString()
                                        .trim()
                                } else {
                                    throw new Error("Unable to load previous source map: " + prevPath.toString())
                                }
                            } else if (prev instanceof _sourceMap.default.SourceMapConsumer) {
                                return _sourceMap.default.SourceMapGenerator.fromSourceMap(prev)
                                    .toString()
                            } else if (prev instanceof _sourceMap.default.SourceMapGenerator) {
                                return prev.toString()
                            } else if (this.isMap(prev)) {
                                return JSON.stringify(prev)
                            } else {
                                throw new Error("Unsupported previous source map format: " + prev.toString())
                            }
                        } else if (this.inline) {
                            return this.decodeInline(this.annotation)
                        } else if (this.annotation) {
                            var map = this.annotation;
                            if (file) map = _path.default.join(_path.default.dirname(file), map);
                            this.root = _path.default.dirname(map);
                            if (_fs.default.existsSync && _fs.default.existsSync(map)) {
                                return _fs.default.readFileSync(map, "utf-8")
                                    .toString()
                                    .trim()
                            } else {
                                return false
                            }
                        }
                    };
                    _proto.isMap = function isMap(map) {
                        if (typeof map !== "object") return false;
                        return typeof map.mappings === "string" || typeof map._mappings === "string"
                    };
                    return PreviousMap
                }();
                var _default = PreviousMap;
                exports.default = _default;
                module.exports = exports.default
            })
            .call(this, require("buffer")
                .Buffer)
        }, {
            buffer: 5,
            fs: 4,
            path: 43,
            "source-map": 84
        }],
        58: [function(require, module, exports) {
            (function(process) {
                "use strict";
                exports.__esModule = true;
                exports.default = void 0;
                var _lazyResult = _interopRequireDefault(require("./lazy-result"));

                function _interopRequireDefault(obj) {
                    return obj && obj.__esModule ? obj : {
                        default: obj
                    }
                }
                var Processor = function() {
                    function Processor(plugins) {
                        if (plugins === void 0) {
                            plugins = []
                        }
                        this.version = "7.0.14";
                        this.plugins = this.normalize(plugins)
                    }
                    var _proto = Processor.prototype;
                    _proto.use = function use(plugin) {
                        this.plugins = this.plugins.concat(this.normalize([plugin]));
                        return this
                    };
                    _proto.process = function(_process) {
                        function process(_x) {
                            return _process.apply(this, arguments)
                        }
                        process.toString = function() {
                            return _process.toString()
                        };
                        return process
                    }(function(css, opts) {
                        if (opts === void 0) {
                            opts = {}
                        }
                        if (this.plugins.length === 0 && opts.parser === opts.stringifier) {
                            if (process.env.NODE_ENV !== "production") {
                                if (typeof console !== "undefined" && console.warn) {
                                    console.warn("You did not set any plugins, parser, or stringifier. " + "Right now, PostCSS does nothing. Pick plugins for your case " + "on https://www.postcss.parts/ and use them in postcss.config.js.")
                                }
                            }
                        }
                        return new _lazyResult.default(this, css, opts)
                    });
                    _proto.normalize = function normalize(plugins) {
                        var normalized = [];
                        for (var _iterator = plugins, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
                            var _ref;
                            if (_isArray) {
                                if (_i >= _iterator.length) break;
                                _ref = _iterator[_i++]
                            } else {
                                _i = _iterator.next();
                                if (_i.done) break;
                                _ref = _i.value
                            }
                            var i = _ref;
                            if (i.postcss) i = i.postcss;
                            if (typeof i === "object" && Array.isArray(i.plugins)) {
                                normalized = normalized.concat(i.plugins)
                            } else if (typeof i === "function") {
                                normalized.push(i)
                            } else if (typeof i === "object" && (i.parse || i.stringify)) {
                                if (process.env.NODE_ENV !== "production") {
                                    throw new Error("PostCSS syntaxes cannot be used as plugins. Instead, please use " + "one of the syntax/parser/stringifier options as outlined " + "in your PostCSS runner documentation.")
                                }
                            } else {
                                throw new Error(i + " is not a PostCSS plugin")
                            }
                        }
                        return normalized
                    };
                    return Processor
                }();
                var _default = Processor;
                exports.default = _default;
                module.exports = exports.default
            })
            .call(this, require("_process"))
        }, {
            "./lazy-result": 50,
            _process: 68
        }],
        59: [function(require, module, exports) {
            "use strict";
            exports.__esModule = true;
            exports.default = void 0;
            var _warning = _interopRequireDefault(require("./warning"));

            function _interopRequireDefault(obj) {
                return obj && obj.__esModule ? obj : {
                    default: obj
                }
            }

            function _defineProperties(target, props) {
                for (var i = 0; i < props.length; i++) {
                    var descriptor = props[i];
                    descriptor.enumerable = descriptor.enumerable || false;
                    descriptor.configurable = true;
                    if ("value" in descriptor) descriptor.writable = true;
                    Object.defineProperty(target, descriptor.key, descriptor)
                }
            }

            function _createClass(Constructor, protoProps, staticProps) {
                if (protoProps) _defineProperties(Constructor.prototype, protoProps);
                if (staticProps) _defineProperties(Constructor, staticProps);
                return Constructor
            }
            var Result = function() {
                function Result(processor, root, opts) {
                    this.processor = processor;
                    this.messages = [];
                    this.root = root;
                    this.opts = opts;
                    this.css = undefined;
                    this.map = undefined
                }
                var _proto = Result.prototype;
                _proto.toString = function toString() {
                    return this.css
                };
                _proto.warn = function warn(text, opts) {
                    if (opts === void 0) {
                        opts = {}
                    }
                    if (!opts.plugin) {
                        if (this.lastPlugin && this.lastPlugin.postcssPlugin) {
                            opts.plugin = this.lastPlugin.postcssPlugin
                        }
                    }
                    var warning = new _warning.default(text, opts);
                    this.messages.push(warning);
                    return warning
                };
                _proto.warnings = function warnings() {
                    return this.messages.filter(function(i) {
                        return i.type === "warning"
                    })
                };
                _createClass(Result, [{
                    key: "content",
                    get: function get() {
                        return this.css
                    }
                }]);
                return Result
            }();
            var _default = Result;
            exports.default = _default;
            module.exports = exports.default
        }, {
            "./warning": 67
        }],
        60: [function(require, module, exports) {
            "use strict";
            exports.__esModule = true;
            exports.default = void 0;
            var _container = _interopRequireDefault(require("./container"));

            function _interopRequireDefault(obj) {
                return obj && obj.__esModule ? obj : {
                    default: obj
                }
            }

            function _inheritsLoose(subClass, superClass) {
                subClass.prototype = Object.create(superClass.prototype);
                subClass.prototype.constructor = subClass;
                subClass.__proto__ = superClass
            }
            var Root = function(_Container) {
                _inheritsLoose(Root, _Container);

                function Root(defaults) {
                    var _this;
                    _this = _Container.call(this, defaults) || this;
                    _this.type = "root";
                    if (!_this.nodes) _this.nodes = [];
                    return _this
                }
                var _proto = Root.prototype;
                _proto.removeChild = function removeChild(child, ignore) {
                    var index = this.index(child);
                    if (!ignore && index === 0 && this.nodes.length > 1) {
                        this.nodes[1].raws.before = this.nodes[index].raws.before
                    }
                    return _Container.prototype.removeChild.call(this, child)
                };
                _proto.normalize = function normalize(child, sample, type) {
                    var nodes = _Container.prototype.normalize.call(this, child);
                    if (sample) {
                        if (type === "prepend") {
                            if (this.nodes.length > 1) {
                                sample.raws.before = this.nodes[1].raws.before
                            } else {
                                delete sample.raws.before
                            }
                        } else if (this.first !== sample) {
                            for (var _iterator = nodes, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
                                var _ref;
                                if (_isArray) {
                                    if (_i >= _iterator.length) break;
                                    _ref = _iterator[_i++]
                                } else {
                                    _i = _iterator.next();
                                    if (_i.done) break;
                                    _ref = _i.value
                                }
                                var node = _ref;
                                node.raws.before = sample.raws.before
                            }
                        }
                    }
                    return nodes
                };
                _proto.toResult = function toResult(opts) {
                    if (opts === void 0) {
                        opts = {}
                    }
                    var LazyResult = require("./lazy-result");
                    var Processor = require("./processor");
                    var lazy = new LazyResult(new Processor, this, opts);
                    return lazy.stringify()
                };
                return Root
            }(_container.default);
            var _default = Root;
            exports.default = _default;
            module.exports = exports.default
        }, {
            "./container": 46,
            "./lazy-result": 50,
            "./processor": 58
        }],
        61: [function(require, module, exports) {
            "use strict";
            exports.__esModule = true;
            exports.default = void 0;
            var _container = _interopRequireDefault(require("./container"));
            var _list = _interopRequireDefault(require("./list"));

            function _interopRequireDefault(obj) {
                return obj && obj.__esModule ? obj : {
                    default: obj
                }
            }

            function _defineProperties(target, props) {
                for (var i = 0; i < props.length; i++) {
                    var descriptor = props[i];
                    descriptor.enumerable = descriptor.enumerable || false;
                    descriptor.configurable = true;
                    if ("value" in descriptor) descriptor.writable = true;
                    Object.defineProperty(target, descriptor.key, descriptor)
                }
            }

            function _createClass(Constructor, protoProps, staticProps) {
                if (protoProps) _defineProperties(Constructor.prototype, protoProps);
                if (staticProps) _defineProperties(Constructor, staticProps);
                return Constructor
            }

            function _inheritsLoose(subClass, superClass) {
                subClass.prototype = Object.create(superClass.prototype);
                subClass.prototype.constructor = subClass;
                subClass.__proto__ = superClass
            }
            var Rule = function(_Container) {
                _inheritsLoose(Rule, _Container);

                function Rule(defaults) {
                    var _this;
                    _this = _Container.call(this, defaults) || this;
                    _this.type = "rule";
                    if (!_this.nodes) _this.nodes = [];
                    return _this
                }
                _createClass(Rule, [{
                    key: "selectors",
                    get: function get() {
                        return _list.default.comma(this.selector)
                    },
                    set: function set(values) {
                        var match = this.selector ? this.selector.match(/,\s*/) : null;
                        var sep = match ? match[0] : "," + this.raw("between", "beforeOpen");
                        this.selector = values.join(sep)
                    }
                }]);
                return Rule
            }(_container.default);
            var _default = Rule;
            exports.default = _default;
            module.exports = exports.default
        }, {
            "./container": 46,
            "./list": 51
        }],
        62: [function(require, module, exports) {
            "use strict";
            exports.__esModule = true;
            exports.default = void 0;
            var DEFAULT_RAW = {
                colon: ": ",
                indent: "    ",
                beforeDecl: "\n",
                beforeRule: "\n",
                beforeOpen: " ",
                beforeClose: "\n",
                beforeComment: "\n",
                after: "\n",
                emptyBody: "",
                commentLeft: " ",
                commentRight: " ",
                semicolon: false
            };

            function capitalize(str) {
                return str[0].toUpperCase() + str.slice(1)
            }
            var Stringifier = function() {
                function Stringifier(builder) {
                    this.builder = builder
                }
                var _proto = Stringifier.prototype;
                _proto.stringify = function stringify(node, semicolon) {
                    this[node.type](node, semicolon)
                };
                _proto.root = function root(node) {
                    this.body(node);
                    if (node.raws.after) this.builder(node.raws.after)
                };
                _proto.comment = function comment(node) {
                    var left = this.raw(node, "left", "commentLeft");
                    var right = this.raw(node, "right", "commentRight");
                    this.builder("/*" + left + node.text + right + "*/", node)
                };
                _proto.decl = function decl(node, semicolon) {
                    var between = this.raw(node, "between", "colon");
                    var string = node.prop + between + this.rawValue(node, "value");
                    if (node.important) {
                        string += node.raws.important || " !important"
                    }
                    if (semicolon) string += ";";
                    this.builder(string, node)
                };
                _proto.rule = function rule(node) {
                    this.block(node, this.rawValue(node, "selector"));
                    if (node.raws.ownSemicolon) {
                        this.builder(node.raws.ownSemicolon, node, "end")
                    }
                };
                _proto.atrule = function atrule(node, semicolon) {
                    var name = "@" + node.name;
                    var params = node.params ? this.rawValue(node, "params") : "";
                    if (typeof node.raws.afterName !== "undefined") {
                        name += node.raws.afterName
                    } else if (params) {
                        name += " "
                    }
                    if (node.nodes) {
                        this.block(node, name + params)
                    } else {
                        var end = (node.raws.between || "") + (semicolon ? ";" : "");
                        this.builder(name + params + end, node)
                    }
                };
                _proto.body = function body(node) {
                    var last = node.nodes.length - 1;
                    while (last > 0) {
                        if (node.nodes[last].type !== "comment") break;
                        last -= 1
                    }
                    var semicolon = this.raw(node, "semicolon");
                    for (var i = 0; i < node.nodes.length; i++) {
                        var child = node.nodes[i];
                        var before = this.raw(child, "before");
                        if (before) this.builder(before);
                        this.stringify(child, last !== i || semicolon)
                    }
                };
                _proto.block = function block(node, start) {
                    var between = this.raw(node, "between", "beforeOpen");
                    this.builder(start + between + "{", node, "start");
                    var after;
                    if (node.nodes && node.nodes.length) {
                        this.body(node);
                        after = this.raw(node, "after")
                    } else {
                        after = this.raw(node, "after", "emptyBody")
                    }
                    if (after) this.builder(after);
                    this.builder("}", node, "end")
                };
                _proto.raw = function raw(node, own, detect) {
                    var value;
                    if (!detect) detect = own;
                    if (own) {
                        value = node.raws[own];
                        if (typeof value !== "undefined") return value
                    }
                    var parent = node.parent;
                    if (detect === "before") {
                        if (!parent || parent.type === "root" && parent.first === node) {
                            return ""
                        }
                    }
                    if (!parent) return DEFAULT_RAW[detect];
                    var root = node.root();
                    if (!root.rawCache) root.rawCache = {};
                    if (typeof root.rawCache[detect] !== "undefined") {
                        return root.rawCache[detect]
                    }
                    if (detect === "before" || detect === "after") {
                        return this.beforeAfter(node, detect)
                    } else {
                        var method = "raw" + capitalize(detect);
                        if (this[method]) {
                            value = this[method](root, node)
                        } else {
                            root.walk(function(i) {
                                value = i.raws[own];
                                if (typeof value !== "undefined") return false
                            })
                        }
                    }
                    if (typeof value === "undefined") value = DEFAULT_RAW[detect];
                    root.rawCache[detect] = value;
                    return value
                };
                _proto.rawSemicolon = function rawSemicolon(root) {
                    var value;
                    root.walk(function(i) {
                        if (i.nodes && i.nodes.length && i.last.type === "decl") {
                            value = i.raws.semicolon;
                            if (typeof value !== "undefined") return false
                        }
                    });
                    return value
                };
                _proto.rawEmptyBody = function rawEmptyBody(root) {
                    var value;
                    root.walk(function(i) {
                        if (i.nodes && i.nodes.length === 0) {
                            value = i.raws.after;
                            if (typeof value !== "undefined") return false
                        }
                    });
                    return value
                };
                _proto.rawIndent = function rawIndent(root) {
                    if (root.raws.indent) return root.raws.indent;
                    var value;
                    root.walk(function(i) {
                        var p = i.parent;
                        if (p && p !== root && p.parent && p.parent === root) {
                            if (typeof i.raws.before !== "undefined") {
                                var parts = i.raws.before.split("\n");
                                value = parts[parts.length - 1];
                                value = value.replace(/[^\s]/g, "");
                                return false
                            }
                        }
                    });
                    return value
                };
                _proto.rawBeforeComment = function rawBeforeComment(root, node) {
                    var value;
                    root.walkComments(function(i) {
                        if (typeof i.raws.before !== "undefined") {
                            value = i.raws.before;
                            if (value.indexOf("\n") !== -1) {
                                value = value.replace(/[^\n]+$/, "")
                            }
                            return false
                        }
                    });
                    if (typeof value === "undefined") {
                        value = this.raw(node, null, "beforeDecl")
                    } else if (value) {
                        value = value.replace(/[^\s]/g, "")
                    }
                    return value
                };
                _proto.rawBeforeDecl = function rawBeforeDecl(root, node) {
                    var value;
                    root.walkDecls(function(i) {
                        if (typeof i.raws.before !== "undefined") {
                            value = i.raws.before;
                            if (value.indexOf("\n") !== -1) {
                                value = value.replace(/[^\n]+$/, "")
                            }
                            return false
                        }
                    });
                    if (typeof value === "undefined") {
                        value = this.raw(node, null, "beforeRule")
                    } else if (value) {
                        value = value.replace(/[^\s]/g, "")
                    }
                    return value
                };
                _proto.rawBeforeRule = function rawBeforeRule(root) {
                    var value;
                    root.walk(function(i) {
                        if (i.nodes && (i.parent !== root || root.first !== i)) {
                            if (typeof i.raws.before !== "undefined") {
                                value = i.raws.before;
                                if (value.indexOf("\n") !== -1) {
                                    value = value.replace(/[^\n]+$/, "")
                                }
                                return false
                            }
                        }
                    });
                    if (value) value = value.replace(/[^\s]/g, "");
                    return value
                };
                _proto.rawBeforeClose = function rawBeforeClose(root) {
                    var value;
                    root.walk(function(i) {
                        if (i.nodes && i.nodes.length > 0) {
                            if (typeof i.raws.after !== "undefined") {
                                value = i.raws.after;
                                if (value.indexOf("\n") !== -1) {
                                    value = value.replace(/[^\n]+$/, "")
                                }
                                return false
                            }
                        }
                    });
                    if (value) value = value.replace(/[^\s]/g, "");
                    return value
                };
                _proto.rawBeforeOpen = function rawBeforeOpen(root) {
                    var value;
                    root.walk(function(i) {
                        if (i.type !== "decl") {
                            value = i.raws.between;
                            if (typeof value !== "undefined") return false
                        }
                    });
                    return value
                };
                _proto.rawColon = function rawColon(root) {
                    var value;
                    root.walkDecls(function(i) {
                        if (typeof i.raws.between !== "undefined") {
                            value = i.raws.between.replace(/[^\s:]/g, "");
                            return false
                        }
                    });
                    return value
                };
                _proto.beforeAfter = function beforeAfter(node, detect) {
                    var value;
                    if (node.type === "decl") {
                        value = this.raw(node, null, "beforeDecl")
                    } else if (node.type === "comment") {
                        value = this.raw(node, null, "beforeComment")
                    } else if (detect === "before") {
                        value = this.raw(node, null, "beforeRule")
                    } else {
                        value = this.raw(node, null, "beforeClose")
                    }
                    var buf = node.parent;
                    var depth = 0;
                    while (buf && buf.type !== "root") {
                        depth += 1;
                        buf = buf.parent
                    }
                    if (value.indexOf("\n") !== -1) {
                        var indent = this.raw(node, null, "indent");
                        if (indent.length) {
                            for (var step = 0; step < depth; step++) {
                                value += indent
                            }
                        }
                    }
                    return value
                };
                _proto.rawValue = function rawValue(node, prop) {
                    var value = node[prop];
                    var raw = node.raws[prop];
                    if (raw && raw.value === value) {
                        return raw.raw
                    }
                    return value
                };
                return Stringifier
            }();
            var _default = Stringifier;
            exports.default = _default;
            module.exports = exports.default
        }, {}],
        63: [function(require, module, exports) {
            "use strict";
            exports.__esModule = true;
            exports.default = void 0;
            var _stringifier = _interopRequireDefault(require("./stringifier"));

            function _interopRequireDefault(obj) {
                return obj && obj.__esModule ? obj : {
                    default: obj
                }
            }

            function stringify(node, builder) {
                var str = new _stringifier.default(builder);
                str.stringify(node)
            }
            var _default = stringify;
            exports.default = _default;
            module.exports = exports.default
        }, {
            "./stringifier": 62
        }],
        64: [function(require, module, exports) {
            "use strict";
            exports.__esModule = true;
            exports.default = tokenizer;
            var SINGLE_QUOTE = "'".charCodeAt(0);
            var DOUBLE_QUOTE = '"'.charCodeAt(0);
            var BACKSLASH = "\\".charCodeAt(0);
            var SLASH = "/".charCodeAt(0);
            var NEWLINE = "\n".charCodeAt(0);
            var SPACE = " ".charCodeAt(0);
            var FEED = "\f".charCodeAt(0);
            var TAB = "\t".charCodeAt(0);
            var CR = "\r".charCodeAt(0);
            var OPEN_SQUARE = "[".charCodeAt(0);
            var CLOSE_SQUARE = "]".charCodeAt(0);
            var OPEN_PARENTHESES = "(".charCodeAt(0);
            var CLOSE_PARENTHESES = ")".charCodeAt(0);
            var OPEN_CURLY = "{".charCodeAt(0);
            var CLOSE_CURLY = "}".charCodeAt(0);
            var SEMICOLON = ";".charCodeAt(0);
            var ASTERISK = "*".charCodeAt(0);
            var COLON = ":".charCodeAt(0);
            var AT = "@".charCodeAt(0);
            var RE_AT_END = /[ \n\t\r\f{}()'"\\;/[\]#]/g;
            var RE_WORD_END = /[ \n\t\r\f(){}:;@!'"\\\][#]|\/(?=\*)/g;
            var RE_BAD_BRACKET = /.[\\/("'\n]/;
            var RE_HEX_ESCAPE = /[a-f0-9]/i;

            function tokenizer(input, options) {
                if (options === void 0) {
                    options = {}
                }
                var css = input.css.valueOf();
                var ignore = options.ignoreErrors;
                var code, next, quote, lines, last, content, escape;
                var nextLine, nextOffset, escaped, escapePos, prev, n, currentToken;
                var length = css.length;
                var offset = -1;
                var line = 1;
                var pos = 0;
                var buffer = [];
                var returned = [];

                function position() {
                    return pos
                }

                function unclosed(what) {
                    throw input.error("Unclosed " + what, line, pos - offset)
                }

                function endOfFile() {
                    return returned.length === 0 && pos >= length
                }

                function nextToken(opts) {
                    if (returned.length) return returned.pop();
                    if (pos >= length) return;
                    var ignoreUnclosed = opts ? opts.ignoreUnclosed : false;
                    code = css.charCodeAt(pos);
                    if (code === NEWLINE || code === FEED || code === CR && css.charCodeAt(pos + 1) !== NEWLINE) {
                        offset = pos;
                        line += 1
                    }
                    switch (code) {
                        case NEWLINE:
                        case SPACE:
                        case TAB:
                        case CR:
                        case FEED:
                            next = pos;
                            do {
                                next += 1;
                                code = css.charCodeAt(next);
                                if (code === NEWLINE) {
                                    offset = next;
                                    line += 1
                                }
                            } while (code === SPACE || code === NEWLINE || code === TAB || code === CR || code === FEED);
                            currentToken = ["space", css.slice(pos, next)];
                            pos = next - 1;
                            break;
                        case OPEN_SQUARE:
                        case CLOSE_SQUARE:
                        case OPEN_CURLY:
                        case CLOSE_CURLY:
                        case COLON:
                        case SEMICOLON:
                        case CLOSE_PARENTHESES:
                            var controlChar = String.fromCharCode(code);
                            currentToken = [controlChar, controlChar, line, pos - offset];
                            break;
                        case OPEN_PARENTHESES:
                            prev = buffer.length ? buffer.pop()[1] : "";
                            n = css.charCodeAt(pos + 1);
                            if (prev === "url" && n !== SINGLE_QUOTE && n !== DOUBLE_QUOTE && n !== SPACE && n !== NEWLINE && n !== TAB && n !== FEED && n !== CR) {
                                next = pos;
                                do {
                                    escaped = false;
                                    next = css.indexOf(")", next + 1);
                                    if (next === -1) {
                                        if (ignore || ignoreUnclosed) {
                                            next = pos;
                                            break
                                        } else {
                                            unclosed("bracket")
                                        }
                                    }
                                    escapePos = next;
                                    while (css.charCodeAt(escapePos - 1) === BACKSLASH) {
                                        escapePos -= 1;
                                        escaped = !escaped
                                    }
                                } while (escaped);
                                currentToken = ["brackets", css.slice(pos, next + 1), line, pos - offset, line, next - offset];
                                pos = next
                            } else {
                                next = css.indexOf(")", pos + 1);
                                content = css.slice(pos, next + 1);
                                if (next === -1 || RE_BAD_BRACKET.test(content)) {
                                    currentToken = ["(", "(", line, pos - offset]
                                } else {
                                    currentToken = ["brackets", content, line, pos - offset, line, next - offset];
                                    pos = next
                                }
                            }
                            break;
                        case SINGLE_QUOTE:
                        case DOUBLE_QUOTE:
                            quote = code === SINGLE_QUOTE ? "'" : '"';
                            next = pos;
                            do {
                                escaped = false;
                                next = css.indexOf(quote, next + 1);
                                if (next === -1) {
                                    if (ignore || ignoreUnclosed) {
                                        next = pos + 1;
                                        break
                                    } else {
                                        unclosed("string")
                                    }
                                }
                                escapePos = next;
                                while (css.charCodeAt(escapePos - 1) === BACKSLASH) {
                                    escapePos -= 1;
                                    escaped = !escaped
                                }
                            } while (escaped);
                            content = css.slice(pos, next + 1);
                            lines = content.split("\n");
                            last = lines.length - 1;
                            if (last > 0) {
                                nextLine = line + last;
                                nextOffset = next - lines[last].length
                            } else {
                                nextLine = line;
                                nextOffset = offset
                            }
                            currentToken = ["string", css.slice(pos, next + 1), line, pos - offset, nextLine, next - nextOffset];
                            offset = nextOffset;
                            line = nextLine;
                            pos = next;
                            break;
                        case AT:
                            RE_AT_END.lastIndex = pos + 1;
                            RE_AT_END.test(css);
                            if (RE_AT_END.lastIndex === 0) {
                                next = css.length - 1
                            } else {
                                next = RE_AT_END.lastIndex - 2
                            }
                            currentToken = ["at-word", css.slice(pos, next + 1), line, pos - offset, line, next - offset];
                            pos = next;
                            break;
                        case BACKSLASH:
                            next = pos;
                            escape = true;
                            while (css.charCodeAt(next + 1) === BACKSLASH) {
                                next += 1;
                                escape = !escape
                            }
                            code = css.charCodeAt(next + 1);
                            if (escape && code !== SLASH && code !== SPACE && code !== NEWLINE && code !== TAB && code !== CR && code !== FEED) {
                                next += 1;
                                if (RE_HEX_ESCAPE.test(css.charAt(next))) {
                                    while (RE_HEX_ESCAPE.test(css.charAt(next + 1))) {
                                        next += 1
                                    }
                                    if (css.charCodeAt(next + 1) === SPACE) {
                                        next += 1
                                    }
                                }
                            }
                            currentToken = ["word", css.slice(pos, next + 1), line, pos - offset, line, next - offset];
                            pos = next;
                            break;
                        default:
                            if (code === SLASH && css.charCodeAt(pos + 1) === ASTERISK) {
                                next = css.indexOf("*/", pos + 2) + 1;
                                if (next === 0) {
                                    if (ignore || ignoreUnclosed) {
                                        next = css.length
                                    } else {
                                        unclosed("comment")
                                    }
                                }
                                content = css.slice(pos, next + 1);
                                lines = content.split("\n");
                                last = lines.length - 1;
                                if (last > 0) {
                                    nextLine = line + last;
                                    nextOffset = next - lines[last].length
                                } else {
                                    nextLine = line;
                                    nextOffset = offset
                                }
                                currentToken = ["comment", content, line, pos - offset, nextLine, next - nextOffset];
                                offset = nextOffset;
                                line = nextLine;
                                pos = next
                            } else {
                                RE_WORD_END.lastIndex = pos + 1;
                                RE_WORD_END.test(css);
                                if (RE_WORD_END.lastIndex === 0) {
                                    next = css.length - 1
                                } else {
                                    next = RE_WORD_END.lastIndex - 2
                                }
                                currentToken = ["word", css.slice(pos, next + 1), line, pos - offset, line, next - offset];
                                buffer.push(currentToken);
                                pos = next
                            }
                            break
                    }
                    pos++;
                    return currentToken
                }

                function back(token) {
                    returned.push(token)
                }
                return {
                    back: back,
                    nextToken: nextToken,
                    endOfFile: endOfFile,
                    position: position
                }
            }
            module.exports = exports.default
        }, {}],
        65: [function(require, module, exports) {
            "use strict";
            exports.__esModule = true;
            exports.default = void 0;
            var vendor = {
                prefix: function prefix(prop) {
                    var match = prop.match(/^(-\w+-)/);
                    if (match) {
                        return match[0]
                    }
                    return ""
                },
                unprefixed: function unprefixed(prop) {
                    return prop.replace(/^-\w+-/, "")
                }
            };
            var _default = vendor;
            exports.default = _default;
            module.exports = exports.default
        }, {}],
        66: [function(require, module, exports) {
            "use strict";
            exports.__esModule = true;
            exports.default = warnOnce;
            var printed = {};

            function warnOnce(message) {
                if (printed[message]) return;
                printed[message] = true;
                if (typeof console !== "undefined" && console.warn) {
                    console.warn(message)
                }
            }
            module.exports = exports.default
        }, {}],
        67: [function(require, module, exports) {
            "use strict";
            exports.__esModule = true;
            exports.default = void 0;
            var Warning = function() {
                function Warning(text, opts) {
                    if (opts === void 0) {
                        opts = {}
                    }
                    this.type = "warning";
                    this.text = text;
                    if (opts.node && opts.node.source) {
                        var pos = opts.node.positionBy(opts);
                        this.line = pos.line;
                        this.column = pos.column
                    }
                    for (var opt in opts) {
                        this[opt] = opts[opt]
                    }
                }
                var _proto = Warning.prototype;
                _proto.toString = function toString() {
                    if (this.node) {
                        return this.node.error(this.text, {
                                plugin: this.plugin,
                                index: this.index,
                                word: this.word
                            })
                            .message
                    }
                    if (this.plugin) {
                        return this.plugin + ": " + this.text
                    }
                    return this.text
                };
                return Warning
            }();
            var _default = Warning;
            exports.default = _default;
            module.exports = exports.default
        }, {}],
        68: [function(require, module, exports) {
            var process = module.exports = {};
            var cachedSetTimeout;
            var cachedClearTimeout;

            function defaultSetTimout() {
                throw new Error("setTimeout has not been defined")
            }

            function defaultClearTimeout() {
                throw new Error("clearTimeout has not been defined")
            }(function() {
                try {
                    if (typeof setTimeout === "function") {
                        cachedSetTimeout = setTimeout
                    } else {
                        cachedSetTimeout = defaultSetTimout
                    }
                } catch (e) {
                    cachedSetTimeout = defaultSetTimout
                }
                try {
                    if (typeof clearTimeout === "function") {
                        cachedClearTimeout = clearTimeout
                    } else {
                        cachedClearTimeout = defaultClearTimeout
                    }
                } catch (e) {
                    cachedClearTimeout = defaultClearTimeout
                }
            })();

            function runTimeout(fun) {
                if (cachedSetTimeout === setTimeout) {
                    return setTimeout(fun, 0)
                }
                if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
                    cachedSetTimeout = setTimeout;
                    return setTimeout(fun, 0)
                }
                try {
                    return cachedSetTimeout(fun, 0)
                } catch (e) {
                    try {
                        return cachedSetTimeout.call(null, fun, 0)
                    } catch (e) {
                        return cachedSetTimeout.call(this, fun, 0)
                    }
                }
            }

            function runClearTimeout(marker) {
                if (cachedClearTimeout === clearTimeout) {
                    return clearTimeout(marker)
                }
                if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
                    cachedClearTimeout = clearTimeout;
                    return clearTimeout(marker)
                }
                try {
                    return cachedClearTimeout(marker)
                } catch (e) {
                    try {
                        return cachedClearTimeout.call(null, marker)
                    } catch (e) {
                        return cachedClearTimeout.call(this, marker)
                    }
                }
            }
            var queue = [];
            var draining = false;
            var currentQueue;
            var queueIndex = -1;

            function cleanUpNextTick() {
                if (!draining || !currentQueue) {
                    return
                }
                draining = false;
                if (currentQueue.length) {
                    queue = currentQueue.concat(queue)
                } else {
                    queueIndex = -1
                }
                if (queue.length) {
                    drainQueue()
                }
            }

            function drainQueue() {
                if (draining) {
                    return
                }
                var timeout = runTimeout(cleanUpNextTick);
                draining = true;
                var len = queue.length;
                while (len) {
                    currentQueue = queue;
                    queue = [];
                    while (++queueIndex < len) {
                        if (currentQueue) {
                            currentQueue[queueIndex].run()
                        }
                    }
                    queueIndex = -1;
                    len = queue.length
                }
                currentQueue = null;
                draining = false;
                runClearTimeout(timeout)
            }
            process.nextTick = function(fun) {
                var args = new Array(arguments.length - 1);
                if (arguments.length > 1) {
                    for (var i = 1; i < arguments.length; i++) {
                        args[i - 1] = arguments[i]
                    }
                }
                queue.push(new Item(fun, args));
                if (queue.length === 1 && !draining) {
                    runTimeout(drainQueue)
                }
            };

            function Item(fun, array) {
                this.fun = fun;
                this.array = array
            }
            Item.prototype.run = function() {
                this.fun.apply(null, this.array)
            };
            process.title = "browser";
            process.browser = true;
            process.env = {};
            process.argv = [];
            process.version = "";
            process.versions = {};

            function noop() {}
            process.on = noop;
            process.addListener = noop;
            process.once = noop;
            process.off = noop;
            process.removeListener = noop;
            process.removeAllListeners = noop;
            process.emit = noop;
            process.prependListener = noop;
            process.prependOnceListener = noop;
            process.listeners = function(name) {
                return []
            };
            process.binding = function(name) {
                throw new Error("process.binding is not supported")
            };
            process.cwd = function() {
                return "/"
            };
            process.chdir = function(dir) {
                throw new Error("process.chdir is not supported")
            };
            process.umask = function() {
                return 0
            }
        }, {}],
        69: [function(require, module, exports) {
            (function(global) {
                (function(root) {
                    var freeExports = typeof exports == "object" && exports && !exports.nodeType && exports;
                    var freeModule = typeof module == "object" && module && !module.nodeType && module;
                    var freeGlobal = typeof global == "object" && global;
                    if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal || freeGlobal.self === freeGlobal) {
                        root = freeGlobal
                    }
                    var punycode, maxInt = 2147483647,
                        base = 36,
                        tMin = 1,
                        tMax = 26,
                        skew = 38,
                        damp = 700,
                        initialBias = 72,
                        initialN = 128,
                        delimiter = "-",
                        regexPunycode = /^xn--/,
                        regexNonASCII = /[^\x20-\x7E]/,
                        regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g,
                        errors = {
                            overflow: "Overflow: input needs wider integers to process",
                            "not-basic": "Illegal input >= 0x80 (not a basic code point)",
                            "invalid-input": "Invalid input"
                        },
                        baseMinusTMin = base - tMin,
                        floor = Math.floor,
                        stringFromCharCode = String.fromCharCode,
                        key;

                    function error(type) {
                        throw new RangeError(errors[type])
                    }

                    function map(array, fn) {
                        var length = array.length;
                        var result = [];
                        while (length--) {
                            result[length] = fn(array[length])
                        }
                        return result
                    }

                    function mapDomain(string, fn) {
                        var parts = string.split("@");
                        var result = "";
                        if (parts.length > 1) {
                            result = parts[0] + "@";
                            string = parts[1]
                        }
                        string = string.replace(regexSeparators, ".");
                        var labels = string.split(".");
                        var encoded = map(labels, fn)
                            .join(".");
                        return result + encoded
                    }

                    function ucs2decode(string) {
                        var output = [],
                            counter = 0,
                            length = string.length,
                            value, extra;
                        while (counter < length) {
                            value = string.charCodeAt(counter++);
                            if (value >= 55296 && value <= 56319 && counter < length) {
                                extra = string.charCodeAt(counter++);
                                if ((extra & 64512) == 56320) {
                                    output.push(((value & 1023) << 10) + (extra & 1023) + 65536)
                                } else {
                                    output.push(value);
                                    counter--
                                }
                            } else {
                                output.push(value)
                            }
                        }
                        return output
                    }

                    function ucs2encode(array) {
                        return map(array, function(value) {
                                var output = "";
                                if (value > 65535) {
                                    value -= 65536;
                                    output += stringFromCharCode(value >>> 10 & 1023 | 55296);
                                    value = 56320 | value & 1023
                                }
                                output += stringFromCharCode(value);
                                return output
                            })
                            .join("")
                    }

                    function basicToDigit(codePoint) {
                        if (codePoint - 48 < 10) {
                            return codePoint - 22
                        }
                        if (codePoint - 65 < 26) {
                            return codePoint - 65
                        }
                        if (codePoint - 97 < 26) {
                            return codePoint - 97
                        }
                        return base
                    }

                    function digitToBasic(digit, flag) {
                        return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5)
                    }

                    function adapt(delta, numPoints, firstTime) {
                        var k = 0;
                        delta = firstTime ? floor(delta / damp) : delta >> 1;
                        delta += floor(delta / numPoints);
                        for (; delta > baseMinusTMin * tMax >> 1; k += base) {
                            delta = floor(delta / baseMinusTMin)
                        }
                        return floor(k + (baseMinusTMin + 1) * delta / (delta + skew))
                    }

                    function decode(input) {
                        var output = [],
                            inputLength = input.length,
                            out, i = 0,
                            n = initialN,
                            bias = initialBias,
                            basic, j, index, oldi, w, k, digit, t, baseMinusT;
                        basic = input.lastIndexOf(delimiter);
                        if (basic < 0) {
                            basic = 0
                        }
                        for (j = 0; j < basic; ++j) {
                            if (input.charCodeAt(j) >= 128) {
                                error("not-basic")
                            }
                            output.push(input.charCodeAt(j))
                        }
                        for (index = basic > 0 ? basic + 1 : 0; index < inputLength;) {
                            for (oldi = i, w = 1, k = base;; k += base) {
                                if (index >= inputLength) {
                                    error("invalid-input")
                                }
                                digit = basicToDigit(input.charCodeAt(index++));
                                if (digit >= base || digit > floor((maxInt - i) / w)) {
                                    error("overflow")
                                }
                                i += digit * w;
                                t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
                                if (digit < t) {
                                    break
                                }
                                baseMinusT = base - t;
                                if (w > floor(maxInt / baseMinusT)) {
                                    error("overflow")
                                }
                                w *= baseMinusT
                            }
                            out = output.length + 1;
                            bias = adapt(i - oldi, out, oldi == 0);
                            if (floor(i / out) > maxInt - n) {
                                error("overflow")
                            }
                            n += floor(i / out);
                            i %= out;
                            output.splice(i++, 0, n)
                        }
                        return ucs2encode(output)
                    }

                    function encode(input) {
                        var n, delta, handledCPCount, basicLength, bias, j, m, q, k, t, currentValue, output = [],
                            inputLength, handledCPCountPlusOne, baseMinusT, qMinusT;
                        input = ucs2decode(input);
                        inputLength = input.length;
                        n = initialN;
                        delta = 0;
                        bias = initialBias;
                        for (j = 0; j < inputLength; ++j) {
                            currentValue = input[j];
                            if (currentValue < 128) {
                                output.push(stringFromCharCode(currentValue))
                            }
                        }
                        handledCPCount = basicLength = output.length;
                        if (basicLength) {
                            output.push(delimiter)
                        }
                        while (handledCPCount < inputLength) {
                            for (m = maxInt, j = 0; j < inputLength; ++j) {
                                currentValue = input[j];
                                if (currentValue >= n && currentValue < m) {
                                    m = currentValue
                                }
                            }
                            handledCPCountPlusOne = handledCPCount + 1;
                            if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
                                error("overflow")
                            }
                            delta += (m - n) * handledCPCountPlusOne;
                            n = m;
                            for (j = 0; j < inputLength; ++j) {
                                currentValue = input[j];
                                if (currentValue < n && ++delta > maxInt) {
                                    error("overflow")
                                }
                                if (currentValue == n) {
                                    for (q = delta, k = base;; k += base) {
                                        t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
                                        if (q < t) {
                                            break
                                        }
                                        qMinusT = q - t;
                                        baseMinusT = base - t;
                                        output.push(stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0)));
                                        q = floor(qMinusT / baseMinusT)
                                    }
                                    output.push(stringFromCharCode(digitToBasic(q, 0)));
                                    bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
                                    delta = 0;
                                    ++handledCPCount
                                }
                            }++delta;
                            ++n
                        }
                        return output.join("")
                    }

                    function toUnicode(input) {
                        return mapDomain(input, function(string) {
                            return regexPunycode.test(string) ? decode(string.slice(4)
                                .toLowerCase()) : string
                        })
                    }

                    function toASCII(input) {
                        return mapDomain(input, function(string) {
                            return regexNonASCII.test(string) ? "xn--" + encode(string) : string
                        })
                    }
                    punycode = {
                        version: "1.4.1",
                        ucs2: {
                            decode: ucs2decode,
                            encode: ucs2encode
                        },
                        decode: decode,
                        encode: encode,
                        toASCII: toASCII,
                        toUnicode: toUnicode
                    };
                    if (typeof define == "function" && typeof define.amd == "object" && define.amd) {
                        define("punycode", function() {
                            return punycode
                        })
                    } else if (freeExports && freeModule) {
                        if (module.exports == freeExports) {
                            freeModule.exports = punycode
                        } else {
                            for (key in punycode) {
                                punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key])
                            }
                        }
                    } else {
                        root.punycode = punycode
                    }
                })(this)
            })
            .call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
        }, {}],
        70: [function(require, module, exports) {
            "use strict";

            function hasOwnProperty(obj, prop) {
                return Object.prototype.hasOwnProperty.call(obj, prop)
            }
            module.exports = function(qs, sep, eq, options) {
                sep = sep || "&";
                eq = eq || "=";
                var obj = {};
                if (typeof qs !== "string" || qs.length === 0) {
                    return obj
                }
                var regexp = /\+/g;
                qs = qs.split(sep);
                var maxKeys = 1e3;
                if (options && typeof options.maxKeys === "number") {
                    maxKeys = options.maxKeys
                }
                var len = qs.length;
                if (maxKeys > 0 && len > maxKeys) {
                    len = maxKeys
                }
                for (var i = 0; i < len; ++i) {
                    var x = qs[i].replace(regexp, "%20"),
                        idx = x.indexOf(eq),
                        kstr, vstr, k, v;
                    if (idx >= 0) {
                        kstr = x.substr(0, idx);
                        vstr = x.substr(idx + 1)
                    } else {
                        kstr = x;
                        vstr = ""
                    }
                    k = decodeURIComponent(kstr);
                    v = decodeURIComponent(vstr);
                    if (!hasOwnProperty(obj, k)) {
                        obj[k] = v
                    } else if (isArray(obj[k])) {
                        obj[k].push(v)
                    } else {
                        obj[k] = [obj[k], v]
                    }
                }
                return obj
            };
            var isArray = Array.isArray || function(xs) {
                return Object.prototype.toString.call(xs) === "[object Array]"
            }
        }, {}],
        71: [function(require, module, exports) {
            "use strict";
            var stringifyPrimitive = function(v) {
                switch (typeof v) {
                    case "string":
                        return v;
                    case "boolean":
                        return v ? "true" : "false";
                    case "number":
                        return isFinite(v) ? v : "";
                    default:
                        return ""
                }
            };
            module.exports = function(obj, sep, eq, name) {
                sep = sep || "&";
                eq = eq || "=";
                if (obj === null) {
                    obj = undefined
                }
                if (typeof obj === "object") {
                    return map(objectKeys(obj), function(k) {
                            var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
                            if (isArray(obj[k])) {
                                return map(obj[k], function(v) {
                                        return ks + encodeURIComponent(stringifyPrimitive(v))
                                    })
                                    .join(sep)
                            } else {
                                return ks + encodeURIComponent(stringifyPrimitive(obj[k]))
                            }
                        })
                        .join(sep)
                }
                if (!name) return "";
                return encodeURIComponent(stringifyPrimitive(name)) + eq + encodeURIComponent(stringifyPrimitive(obj))
            };
            var isArray = Array.isArray || function(xs) {
                return Object.prototype.toString.call(xs) === "[object Array]"
            };

            function map(xs, f) {
                if (xs.map) return xs.map(f);
                var res = [];
                for (var i = 0; i < xs.length; i++) {
                    res.push(f(xs[i], i))
                }
                return res
            }
            var objectKeys = Object.keys || function(obj) {
                var res = [];
                for (var key in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key)
                }
                return res
            }
        }, {}],
        72: [function(require, module, exports) {
            "use strict";
            exports.decode = exports.parse = require("./decode");
            exports.encode = exports.stringify = require("./encode")
        }, {
            "./decode": 70,
            "./encode": 71
        }],
        73: [function(require, module, exports) {
            var buffer = require("buffer");
            var Buffer = buffer.Buffer;

            function copyProps(src, dst) {
                for (var key in src) {
                    dst[key] = src[key]
                }
            }
            if (Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow) {
                module.exports = buffer
            } else {
                copyProps(buffer, exports);
                exports.Buffer = SafeBuffer
            }

            function SafeBuffer(arg, encodingOrOffset, length) {
                return Buffer(arg, encodingOrOffset, length)
            }
            copyProps(Buffer, SafeBuffer);
            SafeBuffer.from = function(arg, encodingOrOffset, length) {
                if (typeof arg === "number") {
                    throw new TypeError("Argument must not be a number")
                }
                return Buffer(arg, encodingOrOffset, length)
            };
            SafeBuffer.alloc = function(size, fill, encoding) {
                if (typeof size !== "number") {
                    throw new TypeError("Argument must be a number")
                }
                var buf = Buffer(size);
                if (fill !== undefined) {
                    if (typeof encoding === "string") {
                        buf.fill(fill, encoding)
                    } else {
                        buf.fill(fill)
                    }
                } else {
                    buf.fill(0)
                }
                return buf
            };
            SafeBuffer.allocUnsafe = function(size) {
                if (typeof size !== "number") {
                    throw new TypeError("Argument must be a number")
                }
                return Buffer(size)
            };
            SafeBuffer.allocUnsafeSlow = function(size) {
                if (typeof size !== "number") {
                    throw new TypeError("Argument must be a number")
                }
                return buffer.SlowBuffer(size)
            }
        }, {
            buffer: 5
        }],
        74: [function(require, module, exports) {
            var util = require("./util");
            var has = Object.prototype.hasOwnProperty;
            var hasNativeMap = typeof Map !== "undefined";

            function ArraySet() {
                this._array = [];
                this._set = hasNativeMap ? new Map : Object.create(null)
            }
            ArraySet.fromArray = function ArraySet_fromArray(aArray, aAllowDuplicates) {
                var set = new ArraySet;
                for (var i = 0, len = aArray.length; i < len; i++) {
                    set.add(aArray[i], aAllowDuplicates)
                }
                return set
            };
            ArraySet.prototype.size = function ArraySet_size() {
                return hasNativeMap ? this._set.size : Object.getOwnPropertyNames(this._set)
                    .length
            };
            ArraySet.prototype.add = function ArraySet_add(aStr, aAllowDuplicates) {
                var sStr = hasNativeMap ? aStr : util.toSetString(aStr);
                var isDuplicate = hasNativeMap ? this.has(aStr) : has.call(this._set, sStr);
                var idx = this._array.length;
                if (!isDuplicate || aAllowDuplicates) {
                    this._array.push(aStr)
                }
                if (!isDuplicate) {
                    if (hasNativeMap) {
                        this._set.set(aStr, idx)
                    } else {
                        this._set[sStr] = idx
                    }
                }
            };
            ArraySet.prototype.has = function ArraySet_has(aStr) {
                if (hasNativeMap) {
                    return this._set.has(aStr)
                } else {
                    var sStr = util.toSetString(aStr);
                    return has.call(this._set, sStr)
                }
            };
            ArraySet.prototype.indexOf = function ArraySet_indexOf(aStr) {
                if (hasNativeMap) {
                    var idx = this._set.get(aStr);
                    if (idx >= 0) {
                        return idx
                    }
                } else {
                    var sStr = util.toSetString(aStr);
                    if (has.call(this._set, sStr)) {
                        return this._set[sStr]
                    }
                }
                throw new Error('"' + aStr + '" is not in the set.')
            };
            ArraySet.prototype.at = function ArraySet_at(aIdx) {
                if (aIdx >= 0 && aIdx < this._array.length) {
                    return this._array[aIdx]
                }
                throw new Error("No element indexed by " + aIdx)
            };
            ArraySet.prototype.toArray = function ArraySet_toArray() {
                return this._array.slice()
            };
            exports.ArraySet = ArraySet
        }, {
            "./util": 83
        }],
        75: [function(require, module, exports) {
            var base64 = require("./base64");
            var VLQ_BASE_SHIFT = 5;
            var VLQ_BASE = 1 << VLQ_BASE_SHIFT;
            var VLQ_BASE_MASK = VLQ_BASE - 1;
            var VLQ_CONTINUATION_BIT = VLQ_BASE;

            function toVLQSigned(aValue) {
                return aValue < 0 ? (-aValue << 1) + 1 : (aValue << 1) + 0
            }

            function fromVLQSigned(aValue) {
                var isNegative = (aValue & 1) === 1;
                var shifted = aValue >> 1;
                return isNegative ? -shifted : shifted
            }
            exports.encode = function base64VLQ_encode(aValue) {
                var encoded = "";
                var digit;
                var vlq = toVLQSigned(aValue);
                do {
                    digit = vlq & VLQ_BASE_MASK;
                    vlq >>>= VLQ_BASE_SHIFT;
                    if (vlq > 0) {
                        digit |= VLQ_CONTINUATION_BIT
                    }
                    encoded += base64.encode(digit)
                } while (vlq > 0);
                return encoded
            };
            exports.decode = function base64VLQ_decode(aStr, aIndex, aOutParam) {
                var strLen = aStr.length;
                var result = 0;
                var shift = 0;
                var continuation, digit;
                do {
                    if (aIndex >= strLen) {
                        throw new Error("Expected more digits in base 64 VLQ value.")
                    }
                    digit = base64.decode(aStr.charCodeAt(aIndex++));
                    if (digit === -1) {
                        throw new Error("Invalid base64 digit: " + aStr.charAt(aIndex - 1))
                    }
                    continuation = !!(digit & VLQ_CONTINUATION_BIT);
                    digit &= VLQ_BASE_MASK;
                    result = result + (digit << shift);
                    shift += VLQ_BASE_SHIFT
                } while (continuation);
                aOutParam.value = fromVLQSigned(result);
                aOutParam.rest = aIndex
            }
        }, {
            "./base64": 76
        }],
        76: [function(require, module, exports) {
            var intToCharMap = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("");
            exports.encode = function(number) {
                if (0 <= number && number < intToCharMap.length) {
                    return intToCharMap[number]
                }
                throw new TypeError("Must be between 0 and 63: " + number)
            };
            exports.decode = function(charCode) {
                var bigA = 65;
                var bigZ = 90;
                var littleA = 97;
                var littleZ = 122;
                var zero = 48;
                var nine = 57;
                var plus = 43;
                var slash = 47;
                var littleOffset = 26;
                var numberOffset = 52;
                if (bigA <= charCode && charCode <= bigZ) {
                    return charCode - bigA
                }
                if (littleA <= charCode && charCode <= littleZ) {
                    return charCode - littleA + littleOffset
                }
                if (zero <= charCode && charCode <= nine) {
                    return charCode - zero + numberOffset
                }
                if (charCode == plus) {
                    return 62
                }
                if (charCode == slash) {
                    return 63
                }
                return -1
            }
        }, {}],
        77: [function(require, module, exports) {
            exports.GREATEST_LOWER_BOUND = 1;
            exports.LEAST_UPPER_BOUND = 2;

            function recursiveSearch(aLow, aHigh, aNeedle, aHaystack, aCompare, aBias) {
                var mid = Math.floor((aHigh - aLow) / 2) + aLow;
                var cmp = aCompare(aNeedle, aHaystack[mid], true);
                if (cmp === 0) {
                    return mid
                } else if (cmp > 0) {
                    if (aHigh - mid > 1) {
                        return recursiveSearch(mid, aHigh, aNeedle, aHaystack, aCompare, aBias)
                    }
                    if (aBias == exports.LEAST_UPPER_BOUND) {
                        return aHigh < aHaystack.length ? aHigh : -1
                    } else {
                        return mid
                    }
                } else {
                    if (mid - aLow > 1) {
                        return recursiveSearch(aLow, mid, aNeedle, aHaystack, aCompare, aBias)
                    }
                    if (aBias == exports.LEAST_UPPER_BOUND) {
                        return mid
                    } else {
                        return aLow < 0 ? -1 : aLow
                    }
                }
            }
            exports.search = function search(aNeedle, aHaystack, aCompare, aBias) {
                if (aHaystack.length === 0) {
                    return -1
                }
                var index = recursiveSearch(-1, aHaystack.length, aNeedle, aHaystack, aCompare, aBias || exports.GREATEST_LOWER_BOUND);
                if (index < 0) {
                    return -1
                }
                while (index - 1 >= 0) {
                    if (aCompare(aHaystack[index], aHaystack[index - 1], true) !== 0) {
                        break
                    }--index
                }
                return index
            }
        }, {}],
        78: [function(require, module, exports) {
            var util = require("./util");

            function generatedPositionAfter(mappingA, mappingB) {
                var lineA = mappingA.generatedLine;
                var lineB = mappingB.generatedLine;
                var columnA = mappingA.generatedColumn;
                var columnB = mappingB.generatedColumn;
                return lineB > lineA || lineB == lineA && columnB >= columnA || util.compareByGeneratedPositionsInflated(mappingA, mappingB) <= 0
            }

            function MappingList() {
                this._array = [];
                this._sorted = true;
                this._last = {
                    generatedLine: -1,
                    generatedColumn: 0
                }
            }
            MappingList.prototype.unsortedForEach = function MappingList_forEach(aCallback, aThisArg) {
                this._array.forEach(aCallback, aThisArg)
            };
            MappingList.prototype.add = function MappingList_add(aMapping) {
                if (generatedPositionAfter(this._last, aMapping)) {
                    this._last = aMapping;
                    this._array.push(aMapping)
                } else {
                    this._sorted = false;
                    this._array.push(aMapping)
                }
            };
            MappingList.prototype.toArray = function MappingList_toArray() {
                if (!this._sorted) {
                    this._array.sort(util.compareByGeneratedPositionsInflated);
                    this._sorted = true
                }
                return this._array
            };
            exports.MappingList = MappingList
        }, {
            "./util": 83
        }],
        79: [function(require, module, exports) {
            function swap(ary, x, y) {
                var temp = ary[x];
                ary[x] = ary[y];
                ary[y] = temp
            }

            function randomIntInRange(low, high) {
                return Math.round(low + Math.random() * (high - low))
            }

            function doQuickSort(ary, comparator, p, r) {
                if (p < r) {
                    var pivotIndex = randomIntInRange(p, r);
                    var i = p - 1;
                    swap(ary, pivotIndex, r);
                    var pivot = ary[r];
                    for (var j = p; j < r; j++) {
                        if (comparator(ary[j], pivot) <= 0) {
                            i += 1;
                            swap(ary, i, j)
                        }
                    }
                    swap(ary, i + 1, j);
                    var q = i + 1;
                    doQuickSort(ary, comparator, p, q - 1);
                    doQuickSort(ary, comparator, q + 1, r)
                }
            }
            exports.quickSort = function(ary, comparator) {
                doQuickSort(ary, comparator, 0, ary.length - 1)
            }
        }, {}],
        80: [function(require, module, exports) {
            var util = require("./util");
            var binarySearch = require("./binary-search");
            var ArraySet = require("./array-set")
                .ArraySet;
            var base64VLQ = require("./base64-vlq");
            var quickSort = require("./quick-sort")
                .quickSort;

            function SourceMapConsumer(aSourceMap, aSourceMapURL) {
                var sourceMap = aSourceMap;
                if (typeof aSourceMap === "string") {
                    sourceMap = util.parseSourceMapInput(aSourceMap)
                }
                return sourceMap.sections != null ? new IndexedSourceMapConsumer(sourceMap, aSourceMapURL) : new BasicSourceMapConsumer(sourceMap, aSourceMapURL)
            }
            SourceMapConsumer.fromSourceMap = function(aSourceMap, aSourceMapURL) {
                return BasicSourceMapConsumer.fromSourceMap(aSourceMap, aSourceMapURL)
            };
            SourceMapConsumer.prototype._version = 3;
            SourceMapConsumer.prototype.__generatedMappings = null;
            Object.defineProperty(SourceMapConsumer.prototype, "_generatedMappings", {
                configurable: true,
                enumerable: true,
                get: function() {
                    if (!this.__generatedMappings) {
                        this._parseMappings(this._mappings, this.sourceRoot)
                    }
                    return this.__generatedMappings
                }
            });
            SourceMapConsumer.prototype.__originalMappings = null;
            Object.defineProperty(SourceMapConsumer.prototype, "_originalMappings", {
                configurable: true,
                enumerable: true,
                get: function() {
                    if (!this.__originalMappings) {
                        this._parseMappings(this._mappings, this.sourceRoot)
                    }
                    return this.__originalMappings
                }
            });
            SourceMapConsumer.prototype._charIsMappingSeparator = function SourceMapConsumer_charIsMappingSeparator(aStr, index) {
                var c = aStr.charAt(index);
                return c === ";" || c === ","
            };
            SourceMapConsumer.prototype._parseMappings = function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
                throw new Error("Subclasses must implement _parseMappings")
            };
            SourceMapConsumer.GENERATED_ORDER = 1;
            SourceMapConsumer.ORIGINAL_ORDER = 2;
            SourceMapConsumer.GREATEST_LOWER_BOUND = 1;
            SourceMapConsumer.LEAST_UPPER_BOUND = 2;
            SourceMapConsumer.prototype.eachMapping = function SourceMapConsumer_eachMapping(aCallback, aContext, aOrder) {
                var context = aContext || null;
                var order = aOrder || SourceMapConsumer.GENERATED_ORDER;
                var mappings;
                switch (order) {
                    case SourceMapConsumer.GENERATED_ORDER:
                        mappings = this._generatedMappings;
                        break;
                    case SourceMapConsumer.ORIGINAL_ORDER:
                        mappings = this._originalMappings;
                        break;
                    default:
                        throw new Error("Unknown order of iteration.")
                }
                var sourceRoot = this.sourceRoot;
                mappings.map(function(mapping) {
                        var source = mapping.source === null ? null : this._sources.at(mapping.source);
                        source = util.computeSourceURL(sourceRoot, source, this._sourceMapURL);
                        return {
                            source: source,
                            generatedLine: mapping.generatedLine,
                            generatedColumn: mapping.generatedColumn,
                            originalLine: mapping.originalLine,
                            originalColumn: mapping.originalColumn,
                            name: mapping.name === null ? null : this._names.at(mapping.name)
                        }
                    }, this)
                    .forEach(aCallback, context)
            };
            SourceMapConsumer.prototype.allGeneratedPositionsFor = function SourceMapConsumer_allGeneratedPositionsFor(aArgs) {
                var line = util.getArg(aArgs, "line");
                var needle = {
                    source: util.getArg(aArgs, "source"),
                    originalLine: line,
                    originalColumn: util.getArg(aArgs, "column", 0)
                };
                needle.source = this._findSourceIndex(needle.source);
                if (needle.source < 0) {
                    return []
                }
                var mappings = [];
                var index = this._findMapping(needle, this._originalMappings, "originalLine", "originalColumn", util.compareByOriginalPositions, binarySearch.LEAST_UPPER_BOUND);
                if (index >= 0) {
                    var mapping = this._originalMappings[index];
                    if (aArgs.column === undefined) {
                        var originalLine = mapping.originalLine;
                        while (mapping && mapping.originalLine === originalLine) {
                            mappings.push({
                                line: util.getArg(mapping, "generatedLine", null),
                                column: util.getArg(mapping, "generatedColumn", null),
                                lastColumn: util.getArg(mapping, "lastGeneratedColumn", null)
                            });
                            mapping = this._originalMappings[++index]
                        }
                    } else {
                        var originalColumn = mapping.originalColumn;
                        while (mapping && mapping.originalLine === line && mapping.originalColumn == originalColumn) {
                            mappings.push({
                                line: util.getArg(mapping, "generatedLine", null),
                                column: util.getArg(mapping, "generatedColumn", null),
                                lastColumn: util.getArg(mapping, "lastGeneratedColumn", null)
                            });
                            mapping = this._originalMappings[++index]
                        }
                    }
                }
                return mappings
            };
            exports.SourceMapConsumer = SourceMapConsumer;

            function BasicSourceMapConsumer(aSourceMap, aSourceMapURL) {
                var sourceMap = aSourceMap;
                if (typeof aSourceMap === "string") {
                    sourceMap = util.parseSourceMapInput(aSourceMap)
                }
                var version = util.getArg(sourceMap, "version");
                var sources = util.getArg(sourceMap, "sources");
                var names = util.getArg(sourceMap, "names", []);
                var sourceRoot = util.getArg(sourceMap, "sourceRoot", null);
                var sourcesContent = util.getArg(sourceMap, "sourcesContent", null);
                var mappings = util.getArg(sourceMap, "mappings");
                var file = util.getArg(sourceMap, "file", null);
                if (version != this._version) {
                    throw new Error("Unsupported version: " + version)
                }
                if (sourceRoot) {
                    sourceRoot = util.normalize(sourceRoot)
                }
                sources = sources.map(String)
                    .map(util.normalize)
                    .map(function(source) {
                        return sourceRoot && util.isAbsolute(sourceRoot) && util.isAbsolute(source) ? util.relative(sourceRoot, source) : source
                    });
                this._names = ArraySet.fromArray(names.map(String), true);
                this._sources = ArraySet.fromArray(sources, true);
                this._absoluteSources = this._sources.toArray()
                    .map(function(s) {
                        return util.computeSourceURL(sourceRoot, s, aSourceMapURL)
                    });
                this.sourceRoot = sourceRoot;
                this.sourcesContent = sourcesContent;
                this._mappings = mappings;
                this._sourceMapURL = aSourceMapURL;
                this.file = file
            }
            BasicSourceMapConsumer.prototype = Object.create(SourceMapConsumer.prototype);
            BasicSourceMapConsumer.prototype.consumer = SourceMapConsumer;
            BasicSourceMapConsumer.prototype._findSourceIndex = function(aSource) {
                var relativeSource = aSource;
                if (this.sourceRoot != null) {
                    relativeSource = util.relative(this.sourceRoot, relativeSource)
                }
                if (this._sources.has(relativeSource)) {
                    return this._sources.indexOf(relativeSource)
                }
                var i;
                for (i = 0; i < this._absoluteSources.length; ++i) {
                    if (this._absoluteSources[i] == aSource) {
                        return i
                    }
                }
                return -1
            };
            BasicSourceMapConsumer.fromSourceMap = function SourceMapConsumer_fromSourceMap(aSourceMap, aSourceMapURL) {
                var smc = Object.create(BasicSourceMapConsumer.prototype);
                var names = smc._names = ArraySet.fromArray(aSourceMap._names.toArray(), true);
                var sources = smc._sources = ArraySet.fromArray(aSourceMap._sources.toArray(), true);
                smc.sourceRoot = aSourceMap._sourceRoot;
                smc.sourcesContent = aSourceMap._generateSourcesContent(smc._sources.toArray(), smc.sourceRoot);
                smc.file = aSourceMap._file;
                smc._sourceMapURL = aSourceMapURL;
                smc._absoluteSources = smc._sources.toArray()
                    .map(function(s) {
                        return util.computeSourceURL(smc.sourceRoot, s, aSourceMapURL)
                    });
                var generatedMappings = aSourceMap._mappings.toArray()
                    .slice();
                var destGeneratedMappings = smc.__generatedMappings = [];
                var destOriginalMappings = smc.__originalMappings = [];
                for (var i = 0, length = generatedMappings.length; i < length; i++) {
                    var srcMapping = generatedMappings[i];
                    var destMapping = new Mapping;
                    destMapping.generatedLine = srcMapping.generatedLine;
                    destMapping.generatedColumn = srcMapping.generatedColumn;
                    if (srcMapping.source) {
                        destMapping.source = sources.indexOf(srcMapping.source);
                        destMapping.originalLine = srcMapping.originalLine;
                        destMapping.originalColumn = srcMapping.originalColumn;
                        if (srcMapping.name) {
                            destMapping.name = names.indexOf(srcMapping.name)
                        }
                        destOriginalMappings.push(destMapping)
                    }
                    destGeneratedMappings.push(destMapping)
                }
                quickSort(smc.__originalMappings, util.compareByOriginalPositions);
                return smc
            };
            BasicSourceMapConsumer.prototype._version = 3;
            Object.defineProperty(BasicSourceMapConsumer.prototype, "sources", {
                get: function() {
                    return this._absoluteSources.slice()
                }
            });

            function Mapping() {
                this.generatedLine = 0;
                this.generatedColumn = 0;
                this.source = null;
                this.originalLine = null;
                this.originalColumn = null;
                this.name = null
            }
            BasicSourceMapConsumer.prototype._parseMappings = function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
                var generatedLine = 1;
                var previousGeneratedColumn = 0;
                var previousOriginalLine = 0;
                var previousOriginalColumn = 0;
                var previousSource = 0;
                var previousName = 0;
                var length = aStr.length;
                var index = 0;
                var cachedSegments = {};
                var temp = {};
                var originalMappings = [];
                var generatedMappings = [];
                var mapping, str, segment, end, value;
                while (index < length) {
                    if (aStr.charAt(index) === ";") {
                        generatedLine++;
                        index++;
                        previousGeneratedColumn = 0
                    } else if (aStr.charAt(index) === ",") {
                        index++
                    } else {
                        mapping = new Mapping;
                        mapping.generatedLine = generatedLine;
                        for (end = index; end < length; end++) {
                            if (this._charIsMappingSeparator(aStr, end)) {
                                break
                            }
                        }
                        str = aStr.slice(index, end);
                        segment = cachedSegments[str];
                        if (segment) {
                            index += str.length
                        } else {
                            segment = [];
                            while (index < end) {
                                base64VLQ.decode(aStr, index, temp);
                                value = temp.value;
                                index = temp.rest;
                                segment.push(value)
                            }
                            if (segment.length === 2) {
                                throw new Error("Found a source, but no line and column")
                            }
                            if (segment.length === 3) {
                                throw new Error("Found a source and line, but no column")
                            }
                            cachedSegments[str] = segment
                        }
                        mapping.generatedColumn = previousGeneratedColumn + segment[0];
                        previousGeneratedColumn = mapping.generatedColumn;
                        if (segment.length > 1) {
                            mapping.source = previousSource + segment[1];
                            previousSource += segment[1];
                            mapping.originalLine = previousOriginalLine + segment[2];
                            previousOriginalLine = mapping.originalLine;
                            mapping.originalLine += 1;
                            mapping.originalColumn = previousOriginalColumn + segment[3];
                            previousOriginalColumn = mapping.originalColumn;
                            if (segment.length > 4) {
                                mapping.name = previousName + segment[4];
                                previousName += segment[4]
                            }
                        }
                        generatedMappings.push(mapping);
                        if (typeof mapping.originalLine === "number") {
                            originalMappings.push(mapping)
                        }
                    }
                }
                quickSort(generatedMappings, util.compareByGeneratedPositionsDeflated);
                this.__generatedMappings = generatedMappings;
                quickSort(originalMappings, util.compareByOriginalPositions);
                this.__originalMappings = originalMappings
            };
            BasicSourceMapConsumer.prototype._findMapping = function SourceMapConsumer_findMapping(aNeedle, aMappings, aLineName, aColumnName, aComparator, aBias) {
                if (aNeedle[aLineName] <= 0) {
                    throw new TypeError("Line must be greater than or equal to 1, got " + aNeedle[aLineName])
                }
                if (aNeedle[aColumnName] < 0) {
                    throw new TypeError("Column must be greater than or equal to 0, got " + aNeedle[aColumnName])
                }
                return binarySearch.search(aNeedle, aMappings, aComparator, aBias)
            };
            BasicSourceMapConsumer.prototype.computeColumnSpans = function SourceMapConsumer_computeColumnSpans() {
                for (var index = 0; index < this._generatedMappings.length; ++index) {
                    var mapping = this._generatedMappings[index];
                    if (index + 1 < this._generatedMappings.length) {
                        var nextMapping = this._generatedMappings[index + 1];
                        if (mapping.generatedLine === nextMapping.generatedLine) {
                            mapping.lastGeneratedColumn = nextMapping.generatedColumn - 1;
                            continue
                        }
                    }
                    mapping.lastGeneratedColumn = Infinity
                }
            };
            BasicSourceMapConsumer.prototype.originalPositionFor = function SourceMapConsumer_originalPositionFor(aArgs) {
                var needle = {
                    generatedLine: util.getArg(aArgs, "line"),
                    generatedColumn: util.getArg(aArgs, "column")
                };
                var index = this._findMapping(needle, this._generatedMappings, "generatedLine", "generatedColumn", util.compareByGeneratedPositionsDeflated, util.getArg(aArgs, "bias", SourceMapConsumer.GREATEST_LOWER_BOUND));
                if (index >= 0) {
                    var mapping = this._generatedMappings[index];
                    if (mapping.generatedLine === needle.generatedLine) {
                        var source = util.getArg(mapping, "source", null);
                        if (source !== null) {
                            source = this._sources.at(source);
                            source = util.computeSourceURL(this.sourceRoot, source, this._sourceMapURL)
                        }
                        var name = util.getArg(mapping, "name", null);
                        if (name !== null) {
                            name = this._names.at(name)
                        }
                        return {
                            source: source,
                            line: util.getArg(mapping, "originalLine", null),
                            column: util.getArg(mapping, "originalColumn", null),
                            name: name
                        }
                    }
                }
                return {
                    source: null,
                    line: null,
                    column: null,
                    name: null
                }
            };
            BasicSourceMapConsumer.prototype.hasContentsOfAllSources = function BasicSourceMapConsumer_hasContentsOfAllSources() {
                if (!this.sourcesContent) {
                    return false
                }
                return this.sourcesContent.length >= this._sources.size() && !this.sourcesContent.some(function(sc) {
                    return sc == null
                })
            };
            BasicSourceMapConsumer.prototype.sourceContentFor = function SourceMapConsumer_sourceContentFor(aSource, nullOnMissing) {
                if (!this.sourcesContent) {
                    return null
                }
                var index = this._findSourceIndex(aSource);
                if (index >= 0) {
                    return this.sourcesContent[index]
                }
                var relativeSource = aSource;
                if (this.sourceRoot != null) {
                    relativeSource = util.relative(this.sourceRoot, relativeSource)
                }
                var url;
                if (this.sourceRoot != null && (url = util.urlParse(this.sourceRoot))) {
                    var fileUriAbsPath = relativeSource.replace(/^file:\/\//, "");
                    if (url.scheme == "file" && this._sources.has(fileUriAbsPath)) {
                        return this.sourcesContent[this._sources.indexOf(fileUriAbsPath)]
                    }
                    if ((!url.path || url.path == "/") && this._sources.has("/" + relativeSource)) {
                        return this.sourcesContent[this._sources.indexOf("/" + relativeSource)]
                    }
                }
                if (nullOnMissing) {
                    return null
                } else {
                    throw new Error('"' + relativeSource + '" is not in the SourceMap.')
                }
            };
            BasicSourceMapConsumer.prototype.generatedPositionFor = function SourceMapConsumer_generatedPositionFor(aArgs) {
                var source = util.getArg(aArgs, "source");
                source = this._findSourceIndex(source);
                if (source < 0) {
                    return {
                        line: null,
                        column: null,
                        lastColumn: null
                    }
                }
                var needle = {
                    source: source,
                    originalLine: util.getArg(aArgs, "line"),
                    originalColumn: util.getArg(aArgs, "column")
                };
                var index = this._findMapping(needle, this._originalMappings, "originalLine", "originalColumn", util.compareByOriginalPositions, util.getArg(aArgs, "bias", SourceMapConsumer.GREATEST_LOWER_BOUND));
                if (index >= 0) {
                    var mapping = this._originalMappings[index];
                    if (mapping.source === needle.source) {
                        return {
                            line: util.getArg(mapping, "generatedLine", null),
                            column: util.getArg(mapping, "generatedColumn", null),
                            lastColumn: util.getArg(mapping, "lastGeneratedColumn", null)
                        }
                    }
                }
                return {
                    line: null,
                    column: null,
                    lastColumn: null
                }
            };
            exports.BasicSourceMapConsumer = BasicSourceMapConsumer;

            function IndexedSourceMapConsumer(aSourceMap, aSourceMapURL) {
                var sourceMap = aSourceMap;
                if (typeof aSourceMap === "string") {
                    sourceMap = util.parseSourceMapInput(aSourceMap)
                }
                var version = util.getArg(sourceMap, "version");
                var sections = util.getArg(sourceMap, "sections");
                if (version != this._version) {
                    throw new Error("Unsupported version: " + version)
                }
                this._sources = new ArraySet;
                this._names = new ArraySet;
                var lastOffset = {
                    line: -1,
                    column: 0
                };
                this._sections = sections.map(function(s) {
                    if (s.url) {
                        throw new Error("Support for url field in sections not implemented.")
                    }
                    var offset = util.getArg(s, "offset");
                    var offsetLine = util.getArg(offset, "line");
                    var offsetColumn = util.getArg(offset, "column");
                    if (offsetLine < lastOffset.line || offsetLine === lastOffset.line && offsetColumn < lastOffset.column) {
                        throw new Error("Section offsets must be ordered and non-overlapping.")
                    }
                    lastOffset = offset;
                    return {
                        generatedOffset: {
                            generatedLine: offsetLine + 1,
                            generatedColumn: offsetColumn + 1
                        },
                        consumer: new SourceMapConsumer(util.getArg(s, "map"), aSourceMapURL)
                    }
                })
            }
            IndexedSourceMapConsumer.prototype = Object.create(SourceMapConsumer.prototype);
            IndexedSourceMapConsumer.prototype.constructor = SourceMapConsumer;
            IndexedSourceMapConsumer.prototype._version = 3;
            Object.defineProperty(IndexedSourceMapConsumer.prototype, "sources", {
                get: function() {
                    var sources = [];
                    for (var i = 0; i < this._sections.length; i++) {
                        for (var j = 0; j < this._sections[i].consumer.sources.length; j++) {
                            sources.push(this._sections[i].consumer.sources[j])
                        }
                    }
                    return sources
                }
            });
            IndexedSourceMapConsumer.prototype.originalPositionFor = function IndexedSourceMapConsumer_originalPositionFor(aArgs) {
                var needle = {
                    generatedLine: util.getArg(aArgs, "line"),
                    generatedColumn: util.getArg(aArgs, "column")
                };
                var sectionIndex = binarySearch.search(needle, this._sections, function(needle, section) {
                    var cmp = needle.generatedLine - section.generatedOffset.generatedLine;
                    if (cmp) {
                        return cmp
                    }
                    return needle.generatedColumn - section.generatedOffset.generatedColumn
                });
                var section = this._sections[sectionIndex];
                if (!section) {
                    return {
                        source: null,
                        line: null,
                        column: null,
                        name: null
                    }
                }
                return section.consumer.originalPositionFor({
                    line: needle.generatedLine - (section.generatedOffset.generatedLine - 1),
                    column: needle.generatedColumn - (section.generatedOffset.generatedLine === needle.generatedLine ? section.generatedOffset.generatedColumn - 1 : 0),
                    bias: aArgs.bias
                })
            };
            IndexedSourceMapConsumer.prototype.hasContentsOfAllSources = function IndexedSourceMapConsumer_hasContentsOfAllSources() {
                return this._sections.every(function(s) {
                    return s.consumer.hasContentsOfAllSources()
                })
            };
            IndexedSourceMapConsumer.prototype.sourceContentFor = function IndexedSourceMapConsumer_sourceContentFor(aSource, nullOnMissing) {
                for (var i = 0; i < this._sections.length; i++) {
                    var section = this._sections[i];
                    var content = section.consumer.sourceContentFor(aSource, true);
                    if (content) {
                        return content
                    }
                }
                if (nullOnMissing) {
                    return null
                } else {
                    throw new Error('"' + aSource + '" is not in the SourceMap.')
                }
            };
            IndexedSourceMapConsumer.prototype.generatedPositionFor = function IndexedSourceMapConsumer_generatedPositionFor(aArgs) {
                for (var i = 0; i < this._sections.length; i++) {
                    var section = this._sections[i];
                    if (section.consumer._findSourceIndex(util.getArg(aArgs, "source")) === -1) {
                        continue
                    }
                    var generatedPosition = section.consumer.generatedPositionFor(aArgs);
                    if (generatedPosition) {
                        var ret = {
                            line: generatedPosition.line + (section.generatedOffset.generatedLine - 1),
                            column: generatedPosition.column + (section.generatedOffset.generatedLine === generatedPosition.line ? section.generatedOffset.generatedColumn - 1 : 0)
                        };
                        return ret
                    }
                }
                return {
                    line: null,
                    column: null
                }
            };
            IndexedSourceMapConsumer.prototype._parseMappings = function IndexedSourceMapConsumer_parseMappings(aStr, aSourceRoot) {
                this.__generatedMappings = [];
                this.__originalMappings = [];
                for (var i = 0; i < this._sections.length; i++) {
                    var section = this._sections[i];
                    var sectionMappings = section.consumer._generatedMappings;
                    for (var j = 0; j < sectionMappings.length; j++) {
                        var mapping = sectionMappings[j];
                        var source = section.consumer._sources.at(mapping.source);
                        source = util.computeSourceURL(section.consumer.sourceRoot, source, this._sourceMapURL);
                        this._sources.add(source);
                        source = this._sources.indexOf(source);
                        var name = null;
                        if (mapping.name) {
                            name = section.consumer._names.at(mapping.name);
                            this._names.add(name);
                            name = this._names.indexOf(name)
                        }
                        var adjustedMapping = {
                            source: source,
                            generatedLine: mapping.generatedLine + (section.generatedOffset.generatedLine - 1),
                            generatedColumn: mapping.generatedColumn + (section.generatedOffset.generatedLine === mapping.generatedLine ? section.generatedOffset.generatedColumn - 1 : 0),
                            originalLine: mapping.originalLine,
                            originalColumn: mapping.originalColumn,
                            name: name
                        };
                        this.__generatedMappings.push(adjustedMapping);
                        if (typeof adjustedMapping.originalLine === "number") {
                            this.__originalMappings.push(adjustedMapping)
                        }
                    }
                }
                quickSort(this.__generatedMappings, util.compareByGeneratedPositionsDeflated);
                quickSort(this.__originalMappings, util.compareByOriginalPositions)
            };
            exports.IndexedSourceMapConsumer = IndexedSourceMapConsumer
        }, {
            "./array-set": 74,
            "./base64-vlq": 75,
            "./binary-search": 77,
            "./quick-sort": 79,
            "./util": 83
        }],
        81: [function(require, module, exports) {
            var base64VLQ = require("./base64-vlq");
            var util = require("./util");
            var ArraySet = require("./array-set")
                .ArraySet;
            var MappingList = require("./mapping-list")
                .MappingList;

            function SourceMapGenerator(aArgs) {
                if (!aArgs) {
                    aArgs = {}
                }
                this._file = util.getArg(aArgs, "file", null);
                this._sourceRoot = util.getArg(aArgs, "sourceRoot", null);
                this._skipValidation = util.getArg(aArgs, "skipValidation", false);
                this._sources = new ArraySet;
                this._names = new ArraySet;
                this._mappings = new MappingList;
                this._sourcesContents = null
            }
            SourceMapGenerator.prototype._version = 3;
            SourceMapGenerator.fromSourceMap = function SourceMapGenerator_fromSourceMap(aSourceMapConsumer) {
                var sourceRoot = aSourceMapConsumer.sourceRoot;
                var generator = new SourceMapGenerator({
                    file: aSourceMapConsumer.file,
                    sourceRoot: sourceRoot
                });
                aSourceMapConsumer.eachMapping(function(mapping) {
                    var newMapping = {
                        generated: {
                            line: mapping.generatedLine,
                            column: mapping.generatedColumn
                        }
                    };
                    if (mapping.source != null) {
                        newMapping.source = mapping.source;
                        if (sourceRoot != null) {
                            newMapping.source = util.relative(sourceRoot, newMapping.source)
                        }
                        newMapping.original = {
                            line: mapping.originalLine,
                            column: mapping.originalColumn
                        };
                        if (mapping.name != null) {
                            newMapping.name = mapping.name
                        }
                    }
                    generator.addMapping(newMapping)
                });
                aSourceMapConsumer.sources.forEach(function(sourceFile) {
                    var sourceRelative = sourceFile;
                    if (sourceRoot !== null) {
                        sourceRelative = util.relative(sourceRoot, sourceFile)
                    }
                    if (!generator._sources.has(sourceRelative)) {
                        generator._sources.add(sourceRelative)
                    }
                    var content = aSourceMapConsumer.sourceContentFor(sourceFile);
                    if (content != null) {
                        generator.setSourceContent(sourceFile, content)
                    }
                });
                return generator
            };
            SourceMapGenerator.prototype.addMapping = function SourceMapGenerator_addMapping(aArgs) {
                var generated = util.getArg(aArgs, "generated");
                var original = util.getArg(aArgs, "original", null);
                var source = util.getArg(aArgs, "source", null);
                var name = util.getArg(aArgs, "name", null);
                if (!this._skipValidation) {
                    this._validateMapping(generated, original, source, name)
                }
                if (source != null) {
                    source = String(source);
                    if (!this._sources.has(source)) {
                        this._sources.add(source)
                    }
                }
                if (name != null) {
                    name = String(name);
                    if (!this._names.has(name)) {
                        this._names.add(name)
                    }
                }
                this._mappings.add({
                    generatedLine: generated.line,
                    generatedColumn: generated.column,
                    originalLine: original != null && original.line,
                    originalColumn: original != null && original.column,
                    source: source,
                    name: name
                })
            };
            SourceMapGenerator.prototype.setSourceContent = function SourceMapGenerator_setSourceContent(aSourceFile, aSourceContent) {
                var source = aSourceFile;
                if (this._sourceRoot != null) {
                    source = util.relative(this._sourceRoot, source)
                }
                if (aSourceContent != null) {
                    if (!this._sourcesContents) {
                        this._sourcesContents = Object.create(null)
                    }
                    this._sourcesContents[util.toSetString(source)] = aSourceContent
                } else if (this._sourcesContents) {
                    delete this._sourcesContents[util.toSetString(source)];
                    if (Object.keys(this._sourcesContents)
                        .length === 0) {
                        this._sourcesContents = null
                    }
                }
            };
            SourceMapGenerator.prototype.applySourceMap = function SourceMapGenerator_applySourceMap(aSourceMapConsumer, aSourceFile, aSourceMapPath) {
                var sourceFile = aSourceFile;
                if (aSourceFile == null) {
                    if (aSourceMapConsumer.file == null) {
                        throw new Error("SourceMapGenerator.prototype.applySourceMap requires either an explicit source file, " + 'or the source map\'s "file" property. Both were omitted.')
                    }
                    sourceFile = aSourceMapConsumer.file
                }
                var sourceRoot = this._sourceRoot;
                if (sourceRoot != null) {
                    sourceFile = util.relative(sourceRoot, sourceFile)
                }
                var newSources = new ArraySet;
                var newNames = new ArraySet;
                this._mappings.unsortedForEach(function(mapping) {
                    if (mapping.source === sourceFile && mapping.originalLine != null) {
                        var original = aSourceMapConsumer.originalPositionFor({
                            line: mapping.originalLine,
                            column: mapping.originalColumn
                        });
                        if (original.source != null) {
                            mapping.source = original.source;
                            if (aSourceMapPath != null) {
                                mapping.source = util.join(aSourceMapPath, mapping.source)
                            }
                            if (sourceRoot != null) {
                                mapping.source = util.relative(sourceRoot, mapping.source)
                            }
                            mapping.originalLine = original.line;
                            mapping.originalColumn = original.column;
                            if (original.name != null) {
                                mapping.name = original.name
                            }
                        }
                    }
                    var source = mapping.source;
                    if (source != null && !newSources.has(source)) {
                        newSources.add(source)
                    }
                    var name = mapping.name;
                    if (name != null && !newNames.has(name)) {
                        newNames.add(name)
                    }
                }, this);
                this._sources = newSources;
                this._names = newNames;
                aSourceMapConsumer.sources.forEach(function(sourceFile) {
                    var content = aSourceMapConsumer.sourceContentFor(sourceFile);
                    if (content != null) {
                        if (aSourceMapPath != null) {
                            sourceFile = util.join(aSourceMapPath, sourceFile)
                        }
                        if (sourceRoot != null) {
                            sourceFile = util.relative(sourceRoot, sourceFile)
                        }
                        this.setSourceContent(sourceFile, content)
                    }
                }, this)
            };
            SourceMapGenerator.prototype._validateMapping = function SourceMapGenerator_validateMapping(aGenerated, aOriginal, aSource, aName) {
                if (aOriginal && typeof aOriginal.line !== "number" && typeof aOriginal.column !== "number") {
                    throw new Error("original.line and original.column are not numbers -- you probably meant to omit " + "the original mapping entirely and only map the generated position. If so, pass " + "null for the original mapping instead of an object with empty or null values.")
                }
                if (aGenerated && "line" in aGenerated && "column" in aGenerated && aGenerated.line > 0 && aGenerated.column >= 0 && !aOriginal && !aSource && !aName) {
                    return
                } else if (aGenerated && "line" in aGenerated && "column" in aGenerated && aOriginal && "line" in aOriginal && "column" in aOriginal && aGenerated.line > 0 && aGenerated.column >= 0 && aOriginal.line > 0 && aOriginal.column >= 0 && aSource) {
                    return
                } else {
                    throw new Error("Invalid mapping: " + JSON.stringify({
                        generated: aGenerated,
                        source: aSource,
                        original: aOriginal,
                        name: aName
                    }))
                }
            };
            SourceMapGenerator.prototype._serializeMappings = function SourceMapGenerator_serializeMappings() {
                var previousGeneratedColumn = 0;
                var previousGeneratedLine = 1;
                var previousOriginalColumn = 0;
                var previousOriginalLine = 0;
                var previousName = 0;
                var previousSource = 0;
                var result = "";
                var next;
                var mapping;
                var nameIdx;
                var sourceIdx;
                var mappings = this._mappings.toArray();
                for (var i = 0, len = mappings.length; i < len; i++) {
                    mapping = mappings[i];
                    next = "";
                    if (mapping.generatedLine !== previousGeneratedLine) {
                        previousGeneratedColumn = 0;
                        while (mapping.generatedLine !== previousGeneratedLine) {
                            next += ";";
                            previousGeneratedLine++
                        }
                    } else {
                        if (i > 0) {
                            if (!util.compareByGeneratedPositionsInflated(mapping, mappings[i - 1])) {
                                continue
                            }
                            next += ","
                        }
                    }
                    next += base64VLQ.encode(mapping.generatedColumn - previousGeneratedColumn);
                    previousGeneratedColumn = mapping.generatedColumn;
                    if (mapping.source != null) {
                        sourceIdx = this._sources.indexOf(mapping.source);
                        next += base64VLQ.encode(sourceIdx - previousSource);
                        previousSource = sourceIdx;
                        next += base64VLQ.encode(mapping.originalLine - 1 - previousOriginalLine);
                        previousOriginalLine = mapping.originalLine - 1;
                        next += base64VLQ.encode(mapping.originalColumn - previousOriginalColumn);
                        previousOriginalColumn = mapping.originalColumn;
                        if (mapping.name != null) {
                            nameIdx = this._names.indexOf(mapping.name);
                            next += base64VLQ.encode(nameIdx - previousName);
                            previousName = nameIdx
                        }
                    }
                    result += next
                }
                return result
            };
            SourceMapGenerator.prototype._generateSourcesContent = function SourceMapGenerator_generateSourcesContent(aSources, aSourceRoot) {
                return aSources.map(function(source) {
                    if (!this._sourcesContents) {
                        return null
                    }
                    if (aSourceRoot != null) {
                        source = util.relative(aSourceRoot, source)
                    }
                    var key = util.toSetString(source);
                    return Object.prototype.hasOwnProperty.call(this._sourcesContents, key) ? this._sourcesContents[key] : null
                }, this)
            };
            SourceMapGenerator.prototype.toJSON = function SourceMapGenerator_toJSON() {
                var map = {
                    version: this._version,
                    sources: this._sources.toArray(),
                    names: this._names.toArray(),
                    mappings: this._serializeMappings()
                };
                if (this._file != null) {
                    map.file = this._file
                }
                if (this._sourceRoot != null) {
                    map.sourceRoot = this._sourceRoot
                }
                if (this._sourcesContents) {
                    map.sourcesContent = this._generateSourcesContent(map.sources, map.sourceRoot)
                }
                return map
            };
            SourceMapGenerator.prototype.toString = function SourceMapGenerator_toString() {
                return JSON.stringify(this.toJSON())
            };
            exports.SourceMapGenerator = SourceMapGenerator
        }, {
            "./array-set": 74,
            "./base64-vlq": 75,
            "./mapping-list": 78,
            "./util": 83
        }],
        82: [function(require, module, exports) {
            var SourceMapGenerator = require("./source-map-generator")
                .SourceMapGenerator;
            var util = require("./util");
            var REGEX_NEWLINE = /(\r?\n)/;
            var NEWLINE_CODE = 10;
            var isSourceNode = "$$$isSourceNode$$$";

            function SourceNode(aLine, aColumn, aSource, aChunks, aName) {
                this.children = [];
                this.sourceContents = {};
                this.line = aLine == null ? null : aLine;
                this.column = aColumn == null ? null : aColumn;
                this.source = aSource == null ? null : aSource;
                this.name = aName == null ? null : aName;
                this[isSourceNode] = true;
                if (aChunks != null) this.add(aChunks)
            }
            SourceNode.fromStringWithSourceMap = function SourceNode_fromStringWithSourceMap(aGeneratedCode, aSourceMapConsumer, aRelativePath) {
                var node = new SourceNode;
                var remainingLines = aGeneratedCode.split(REGEX_NEWLINE);
                var remainingLinesIndex = 0;
                var shiftNextLine = function() {
                    var lineContents = getNextLine();
                    var newLine = getNextLine() || "";
                    return lineContents + newLine;

                    function getNextLine() {
                        return remainingLinesIndex < remainingLines.length ? remainingLines[remainingLinesIndex++] : undefined
                    }
                };
                var lastGeneratedLine = 1,
                    lastGeneratedColumn = 0;
                var lastMapping = null;
                aSourceMapConsumer.eachMapping(function(mapping) {
                    if (lastMapping !== null) {
                        if (lastGeneratedLine < mapping.generatedLine) {
                            addMappingWithCode(lastMapping, shiftNextLine());
                            lastGeneratedLine++;
                            lastGeneratedColumn = 0
                        } else {
                            var nextLine = remainingLines[remainingLinesIndex] || "";
                            var code = nextLine.substr(0, mapping.generatedColumn - lastGeneratedColumn);
                            remainingLines[remainingLinesIndex] = nextLine.substr(mapping.generatedColumn - lastGeneratedColumn);
                            lastGeneratedColumn = mapping.generatedColumn;
                            addMappingWithCode(lastMapping, code);
                            lastMapping = mapping;
                            return
                        }
                    }
                    while (lastGeneratedLine < mapping.generatedLine) {
                        node.add(shiftNextLine());
                        lastGeneratedLine++
                    }
                    if (lastGeneratedColumn < mapping.generatedColumn) {
                        var nextLine = remainingLines[remainingLinesIndex] || "";
                        node.add(nextLine.substr(0, mapping.generatedColumn));
                        remainingLines[remainingLinesIndex] = nextLine.substr(mapping.generatedColumn);
                        lastGeneratedColumn = mapping.generatedColumn
                    }
                    lastMapping = mapping
                }, this);
                if (remainingLinesIndex < remainingLines.length) {
                    if (lastMapping) {
                        addMappingWithCode(lastMapping, shiftNextLine())
                    }
                    node.add(remainingLines.splice(remainingLinesIndex)
                        .join(""))
                }
                aSourceMapConsumer.sources.forEach(function(sourceFile) {
                    var content = aSourceMapConsumer.sourceContentFor(sourceFile);
                    if (content != null) {
                        if (aRelativePath != null) {
                            sourceFile = util.join(aRelativePath, sourceFile)
                        }
                        node.setSourceContent(sourceFile, content)
                    }
                });
                return node;

                function addMappingWithCode(mapping, code) {
                    if (mapping === null || mapping.source === undefined) {
                        node.add(code)
                    } else {
                        var source = aRelativePath ? util.join(aRelativePath, mapping.source) : mapping.source;
                        node.add(new SourceNode(mapping.originalLine, mapping.originalColumn, source, code, mapping.name))
                    }
                }
            };
            SourceNode.prototype.add = function SourceNode_add(aChunk) {
                if (Array.isArray(aChunk)) {
                    aChunk.forEach(function(chunk) {
                        this.add(chunk)
                    }, this)
                } else if (aChunk[isSourceNode] || typeof aChunk === "string") {
                    if (aChunk) {
                        this.children.push(aChunk)
                    }
                } else {
                    throw new TypeError("Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk)
                }
                return this
            };
            SourceNode.prototype.prepend = function SourceNode_prepend(aChunk) {
                if (Array.isArray(aChunk)) {
                    for (var i = aChunk.length - 1; i >= 0; i--) {
                        this.prepend(aChunk[i])
                    }
                } else if (aChunk[isSourceNode] || typeof aChunk === "string") {
                    this.children.unshift(aChunk)
                } else {
                    throw new TypeError("Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk)
                }
                return this
            };
            SourceNode.prototype.walk = function SourceNode_walk(aFn) {
                var chunk;
                for (var i = 0, len = this.children.length; i < len; i++) {
                    chunk = this.children[i];
                    if (chunk[isSourceNode]) {
                        chunk.walk(aFn)
                    } else {
                        if (chunk !== "") {
                            aFn(chunk, {
                                source: this.source,
                                line: this.line,
                                column: this.column,
                                name: this.name
                            })
                        }
                    }
                }
            };
            SourceNode.prototype.join = function SourceNode_join(aSep) {
                var newChildren;
                var i;
                var len = this.children.length;
                if (len > 0) {
                    newChildren = [];
                    for (i = 0; i < len - 1; i++) {
                        newChildren.push(this.children[i]);
                        newChildren.push(aSep)
                    }
                    newChildren.push(this.children[i]);
                    this.children = newChildren
                }
                return this
            };
            SourceNode.prototype.replaceRight = function SourceNode_replaceRight(aPattern, aReplacement) {
                var lastChild = this.children[this.children.length - 1];
                if (lastChild[isSourceNode]) {
                    lastChild.replaceRight(aPattern, aReplacement)
                } else if (typeof lastChild === "string") {
                    this.children[this.children.length - 1] = lastChild.replace(aPattern, aReplacement)
                } else {
                    this.children.push("".replace(aPattern, aReplacement))
                }
                return this
            };
            SourceNode.prototype.setSourceContent = function SourceNode_setSourceContent(aSourceFile, aSourceContent) {
                this.sourceContents[util.toSetString(aSourceFile)] = aSourceContent
            };
            SourceNode.prototype.walkSourceContents = function SourceNode_walkSourceContents(aFn) {
                for (var i = 0, len = this.children.length; i < len; i++) {
                    if (this.children[i][isSourceNode]) {
                        this.children[i].walkSourceContents(aFn)
                    }
                }
                var sources = Object.keys(this.sourceContents);
                for (var i = 0, len = sources.length; i < len; i++) {
                    aFn(util.fromSetString(sources[i]), this.sourceContents[sources[i]])
                }
            };
            SourceNode.prototype.toString = function SourceNode_toString() {
                var str = "";
                this.walk(function(chunk) {
                    str += chunk
                });
                return str
            };
            SourceNode.prototype.toStringWithSourceMap = function SourceNode_toStringWithSourceMap(aArgs) {
                var generated = {
                    code: "",
                    line: 1,
                    column: 0
                };
                var map = new SourceMapGenerator(aArgs);
                var sourceMappingActive = false;
                var lastOriginalSource = null;
                var lastOriginalLine = null;
                var lastOriginalColumn = null;
                var lastOriginalName = null;
                this.walk(function(chunk, original) {
                    generated.code += chunk;
                    if (original.source !== null && original.line !== null && original.column !== null) {
                        if (lastOriginalSource !== original.source || lastOriginalLine !== original.line || lastOriginalColumn !== original.column || lastOriginalName !== original.name) {
                            map.addMapping({
                                source: original.source,
                                original: {
                                    line: original.line,
                                    column: original.column
                                },
                                generated: {
                                    line: generated.line,
                                    column: generated.column
                                },
                                name: original.name
                            })
                        }
                        lastOriginalSource = original.source;
                        lastOriginalLine = original.line;
                        lastOriginalColumn = original.column;
                        lastOriginalName = original.name;
                        sourceMappingActive = true
                    } else if (sourceMappingActive) {
                        map.addMapping({
                            generated: {
                                line: generated.line,
                                column: generated.column
                            }
                        });
                        lastOriginalSource = null;
                        sourceMappingActive = false
                    }
                    for (var idx = 0, length = chunk.length; idx < length; idx++) {
                        if (chunk.charCodeAt(idx) === NEWLINE_CODE) {
                            generated.line++;
                            generated.column = 0;
                            if (idx + 1 === length) {
                                lastOriginalSource = null;
                                sourceMappingActive = false
                            } else if (sourceMappingActive) {
                                map.addMapping({
                                    source: original.source,
                                    original: {
                                        line: original.line,
                                        column: original.column
                                    },
                                    generated: {
                                        line: generated.line,
                                        column: generated.column
                                    },
                                    name: original.name
                                })
                            }
                        } else {
                            generated.column++
                        }
                    }
                });
                this.walkSourceContents(function(sourceFile, sourceContent) {
                    map.setSourceContent(sourceFile, sourceContent)
                });
                return {
                    code: generated.code,
                    map: map
                }
            };
            exports.SourceNode = SourceNode
        }, {
            "./source-map-generator": 81,
            "./util": 83
        }],
        83: [function(require, module, exports) {
            function getArg(aArgs, aName, aDefaultValue) {
                if (aName in aArgs) {
                    return aArgs[aName]
                } else if (arguments.length === 3) {
                    return aDefaultValue
                } else {
                    throw new Error('"' + aName + '" is a required argument.')
                }
            }
            exports.getArg = getArg;
            var urlRegexp = /^(?:([\w+\-.]+):)?\/\/(?:(\w+:\w+)@)?([\w.-]*)(?::(\d+))?(.*)$/;
            var dataUrlRegexp = /^data:.+\,.+$/;

            function urlParse(aUrl) {
                var match = aUrl.match(urlRegexp);
                if (!match) {
                    return null
                }
                return {
                    scheme: match[1],
                    auth: match[2],
                    host: match[3],
                    port: match[4],
                    path: match[5]
                }
            }
            exports.urlParse = urlParse;

            function urlGenerate(aParsedUrl) {
                var url = "";
                if (aParsedUrl.scheme) {
                    url += aParsedUrl.scheme + ":"
                }
                url += "//";
                if (aParsedUrl.auth) {
                    url += aParsedUrl.auth + "@"
                }
                if (aParsedUrl.host) {
                    url += aParsedUrl.host
                }
                if (aParsedUrl.port) {
                    url += ":" + aParsedUrl.port
                }
                if (aParsedUrl.path) {
                    url += aParsedUrl.path
                }
                return url
            }
            exports.urlGenerate = urlGenerate;

            function normalize(aPath) {
                var path = aPath;
                var url = urlParse(aPath);
                if (url) {
                    if (!url.path) {
                        return aPath
                    }
                    path = url.path
                }
                var isAbsolute = exports.isAbsolute(path);
                var parts = path.split(/\/+/);
                for (var part, up = 0, i = parts.length - 1; i >= 0; i--) {
                    part = parts[i];
                    if (part === ".") {
                        parts.splice(i, 1)
                    } else if (part === "..") {
                        up++
                    } else if (up > 0) {
                        if (part === "") {
                            parts.splice(i + 1, up);
                            up = 0
                        } else {
                            parts.splice(i, 2);
                            up--
                        }
                    }
                }
                path = parts.join("/");
                if (path === "") {
                    path = isAbsolute ? "/" : "."
                }
                if (url) {
                    url.path = path;
                    return urlGenerate(url)
                }
                return path
            }
            exports.normalize = normalize;

            function join(aRoot, aPath) {
                if (aRoot === "") {
                    aRoot = "."
                }
                if (aPath === "") {
                    aPath = "."
                }
                var aPathUrl = urlParse(aPath);
                var aRootUrl = urlParse(aRoot);
                if (aRootUrl) {
                    aRoot = aRootUrl.path || "/"
                }
                if (aPathUrl && !aPathUrl.scheme) {
                    if (aRootUrl) {
                        aPathUrl.scheme = aRootUrl.scheme
                    }
                    return urlGenerate(aPathUrl)
                }
                if (aPathUrl || aPath.match(dataUrlRegexp)) {
                    return aPath
                }
                if (aRootUrl && !aRootUrl.host && !aRootUrl.path) {
                    aRootUrl.host = aPath;
                    return urlGenerate(aRootUrl)
                }
                var joined = aPath.charAt(0) === "/" ? aPath : normalize(aRoot.replace(/\/+$/, "") + "/" + aPath);
                if (aRootUrl) {
                    aRootUrl.path = joined;
                    return urlGenerate(aRootUrl)
                }
                return joined
            }
            exports.join = join;
            exports.isAbsolute = function(aPath) {
                return aPath.charAt(0) === "/" || urlRegexp.test(aPath)
            };

            function relative(aRoot, aPath) {
                if (aRoot === "") {
                    aRoot = "."
                }
                aRoot = aRoot.replace(/\/$/, "");
                var level = 0;
                while (aPath.indexOf(aRoot + "/") !== 0) {
                    var index = aRoot.lastIndexOf("/");
                    if (index < 0) {
                        return aPath
                    }
                    aRoot = aRoot.slice(0, index);
                    if (aRoot.match(/^([^\/]+:\/)?\/*$/)) {
                        return aPath
                    }++level
                }
                return Array(level + 1)
                    .join("../") + aPath.substr(aRoot.length + 1)
            }
            exports.relative = relative;
            var supportsNullProto = function() {
                var obj = Object.create(null);
                return !("__proto__" in obj)
            }();

            function identity(s) {
                return s
            }

            function toSetString(aStr) {
                if (isProtoString(aStr)) {
                    return "$" + aStr
                }
                return aStr
            }
            exports.toSetString = supportsNullProto ? identity : toSetString;

            function fromSetString(aStr) {
                if (isProtoString(aStr)) {
                    return aStr.slice(1)
                }
                return aStr
            }
            exports.fromSetString = supportsNullProto ? identity : fromSetString;

            function isProtoString(s) {
                if (!s) {
                    return false
                }
                var length = s.length;
                if (length < 9) {
                    return false
                }
                if (s.charCodeAt(length - 1) !== 95 || s.charCodeAt(length - 2) !== 95 || s.charCodeAt(length - 3) !== 111 || s.charCodeAt(length - 4) !== 116 || s.charCodeAt(length - 5) !== 111 || s.charCodeAt(length - 6) !== 114 || s.charCodeAt(length - 7) !== 112 || s.charCodeAt(length - 8) !== 95 || s.charCodeAt(length - 9) !== 95) {
                    return false
                }
                for (var i = length - 10; i >= 0; i--) {
                    if (s.charCodeAt(i) !== 36) {
                        return false
                    }
                }
                return true
            }

            function compareByOriginalPositions(mappingA, mappingB, onlyCompareOriginal) {
                var cmp = strcmp(mappingA.source, mappingB.source);
                if (cmp !== 0) {
                    return cmp
                }
                cmp = mappingA.originalLine - mappingB.originalLine;
                if (cmp !== 0) {
                    return cmp
                }
                cmp = mappingA.originalColumn - mappingB.originalColumn;
                if (cmp !== 0 || onlyCompareOriginal) {
                    return cmp
                }
                cmp = mappingA.generatedColumn - mappingB.generatedColumn;
                if (cmp !== 0) {
                    return cmp
                }
                cmp = mappingA.generatedLine - mappingB.generatedLine;
                if (cmp !== 0) {
                    return cmp
                }
                return strcmp(mappingA.name, mappingB.name)
            }
            exports.compareByOriginalPositions = compareByOriginalPositions;

            function compareByGeneratedPositionsDeflated(mappingA, mappingB, onlyCompareGenerated) {
                var cmp = mappingA.generatedLine - mappingB.generatedLine;
                if (cmp !== 0) {
                    return cmp
                }
                cmp = mappingA.generatedColumn - mappingB.generatedColumn;
                if (cmp !== 0 || onlyCompareGenerated) {
                    return cmp
                }
                cmp = strcmp(mappingA.source, mappingB.source);
                if (cmp !== 0) {
                    return cmp
                }
                cmp = mappingA.originalLine - mappingB.originalLine;
                if (cmp !== 0) {
                    return cmp
                }
                cmp = mappingA.originalColumn - mappingB.originalColumn;
                if (cmp !== 0) {
                    return cmp
                }
                return strcmp(mappingA.name, mappingB.name)
            }
            exports.compareByGeneratedPositionsDeflated = compareByGeneratedPositionsDeflated;

            function strcmp(aStr1, aStr2) {
                if (aStr1 === aStr2) {
                    return 0
                }
                if (aStr1 === null) {
                    return 1
                }
                if (aStr2 === null) {
                    return -1
                }
                if (aStr1 > aStr2) {
                    return 1
                }
                return -1
            }

            function compareByGeneratedPositionsInflated(mappingA, mappingB) {
                var cmp = mappingA.generatedLine - mappingB.generatedLine;
                if (cmp !== 0) {
                    return cmp
                }
                cmp = mappingA.generatedColumn - mappingB.generatedColumn;
                if (cmp !== 0) {
                    return cmp
                }
                cmp = strcmp(mappingA.source, mappingB.source);
                if (cmp !== 0) {
                    return cmp
                }
                cmp = mappingA.originalLine - mappingB.originalLine;
                if (cmp !== 0) {
                    return cmp
                }
                cmp = mappingA.originalColumn - mappingB.originalColumn;
                if (cmp !== 0) {
                    return cmp
                }
                return strcmp(mappingA.name, mappingB.name)
            }
            exports.compareByGeneratedPositionsInflated = compareByGeneratedPositionsInflated;

            function parseSourceMapInput(str) {
                return JSON.parse(str.replace(/^\)]}'[^\n]*\n/, ""))
            }
            exports.parseSourceMapInput = parseSourceMapInput;

            function computeSourceURL(sourceRoot, sourceURL, sourceMapURL) {
                sourceURL = sourceURL || "";
                if (sourceRoot) {
                    if (sourceRoot[sourceRoot.length - 1] !== "/" && sourceURL[0] !== "/") {
                        sourceRoot += "/"
                    }
                    sourceURL = sourceRoot + sourceURL
                }
                if (sourceMapURL) {
                    var parsed = urlParse(sourceMapURL);
                    if (!parsed) {
                        throw new Error("sourceMapURL could not be parsed")
                    }
                    if (parsed.path) {
                        var index = parsed.path.lastIndexOf("/");
                        if (index >= 0) {
                            parsed.path = parsed.path.substring(0, index + 1)
                        }
                    }
                    sourceURL = join(urlGenerate(parsed), sourceURL)
                }
                return normalize(sourceURL)
            }
            exports.computeSourceURL = computeSourceURL
        }, {}],
        84: [function(require, module, exports) {
            exports.SourceMapGenerator = require("./lib/source-map-generator")
                .SourceMapGenerator;
            exports.SourceMapConsumer = require("./lib/source-map-consumer")
                .SourceMapConsumer;
            exports.SourceNode = require("./lib/source-node")
                .SourceNode
        }, {
            "./lib/source-map-consumer": 80,
            "./lib/source-map-generator": 81,
            "./lib/source-node": 82
        }],
        85: [function(require, module, exports) {
            "use strict";
            var numberIsNan = require("number-is-nan");
            var arrayUniq = require("array-uniq");
            var reInt = /^\d+$/;

            function deepUnique(arr) {
                return arr.sort()
                    .filter(function(el, i) {
                        return JSON.stringify(el) !== JSON.stringify(arr[i - 1])
                    })
            }
            exports.parse = function(str) {
                return deepUnique(str.split(",")
                    .map(function(el) {
                        var ret = {};
                        el.trim()
                            .split(/\s+/)
                            .forEach(function(el, i) {
                                if (i === 0) {
                                    return ret.url = el
                                }
                                var value = el.substring(0, el.length - 1);
                                var postfix = el[el.length - 1];
                                var intVal = parseInt(value, 10);
                                var floatVal = parseFloat(value);
                                if (postfix === "w" && reInt.test(value)) {
                                    ret.width = intVal
                                } else if (postfix === "h" && reInt.test(value)) {
                                    ret.height = intVal
                                } else if (postfix === "x" && !numberIsNan(floatVal)) {
                                    ret.density = floatVal
                                } else {
                                    throw new Error("Invalid srcset descriptor: " + el + ".")
                                }
                            });
                        return ret
                    }))
            };
            exports.stringify = function(arr) {
                return arrayUniq(arr.map(function(el) {
                        if (!el.url) {
                            throw new Error("URL is required.")
                        }
                        var ret = [el.url];
                        if (el.width) {
                            ret.push(el.width + "w")
                        }
                        if (el.height) {
                            ret.push(el.height + "h")
                        }
                        if (el.density) {
                            ret.push(el.density + "x")
                        }
                        return ret.join(" ")
                    }))
                    .join(", ")
            }
        }, {
            "array-uniq": 2,
            "number-is-nan": 42
        }],
        86: [function(require, module, exports) {
            "use strict";
            var Buffer = require("safe-buffer")
                .Buffer;
            var isEncoding = Buffer.isEncoding || function(encoding) {
                encoding = "" + encoding;
                switch (encoding && encoding.toLowerCase()) {
                    case "hex":
                    case "utf8":
                    case "utf-8":
                    case "ascii":
                    case "binary":
                    case "base64":
                    case "ucs2":
                    case "ucs-2":
                    case "utf16le":
                    case "utf-16le":
                    case "raw":
                        return true;
                    default:
                        return false
                }
            };

            function _normalizeEncoding(enc) {
                if (!enc) return "utf8";
                var retried;
                while (true) {
                    switch (enc) {
                        case "utf8":
                        case "utf-8":
                            return "utf8";
                        case "ucs2":
                        case "ucs-2":
                        case "utf16le":
                        case "utf-16le":
                            return "utf16le";
                        case "latin1":
                        case "binary":
                            return "latin1";
                        case "base64":
                        case "ascii":
                        case "hex":
                            return enc;
                        default:
                            if (retried) return;
                            enc = ("" + enc)
                                .toLowerCase();
                            retried = true
                    }
                }
            }

            function normalizeEncoding(enc) {
                var nenc = _normalizeEncoding(enc);
                if (typeof nenc !== "string" && (Buffer.isEncoding === isEncoding || !isEncoding(enc))) throw new Error("Unknown encoding: " + enc);
                return nenc || enc
            }
            exports.StringDecoder = StringDecoder;

            function StringDecoder(encoding) {
                this.encoding = normalizeEncoding(encoding);
                var nb;
                switch (this.encoding) {
                    case "utf16le":
                        this.text = utf16Text;
                        this.end = utf16End;
                        nb = 4;
                        break;
                    case "utf8":
                        this.fillLast = utf8FillLast;
                        nb = 4;
                        break;
                    case "base64":
                        this.text = base64Text;
                        this.end = base64End;
                        nb = 3;
                        break;
                    default:
                        this.write = simpleWrite;
                        this.end = simpleEnd;
                        return
                }
                this.lastNeed = 0;
                this.lastTotal = 0;
                this.lastChar = Buffer.allocUnsafe(nb)
            }
            StringDecoder.prototype.write = function(buf) {
                if (buf.length === 0) return "";
                var r;
                var i;
                if (this.lastNeed) {
                    r = this.fillLast(buf);
                    if (r === undefined) return "";
                    i = this.lastNeed;
                    this.lastNeed = 0
                } else {
                    i = 0
                }
                if (i < buf.length) return r ? r + this.text(buf, i) : this.text(buf, i);
                return r || ""
            };
            StringDecoder.prototype.end = utf8End;
            StringDecoder.prototype.text = utf8Text;
            StringDecoder.prototype.fillLast = function(buf) {
                if (this.lastNeed <= buf.length) {
                    buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed);
                    return this.lastChar.toString(this.encoding, 0, this.lastTotal)
                }
                buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length);
                this.lastNeed -= buf.length
            };

            function utf8CheckByte(byte) {
                if (byte <= 127) return 0;
                else if (byte >> 5 === 6) return 2;
                else if (byte >> 4 === 14) return 3;
                else if (byte >> 3 === 30) return 4;
                return byte >> 6 === 2 ? -1 : -2
            }

            function utf8CheckIncomplete(self, buf, i) {
                var j = buf.length - 1;
                if (j < i) return 0;
                var nb = utf8CheckByte(buf[j]);
                if (nb >= 0) {
                    if (nb > 0) self.lastNeed = nb - 1;
                    return nb
                }
                if (--j < i || nb === -2) return 0;
                nb = utf8CheckByte(buf[j]);
                if (nb >= 0) {
                    if (nb > 0) self.lastNeed = nb - 2;
                    return nb
                }
                if (--j < i || nb === -2) return 0;
                nb = utf8CheckByte(buf[j]);
                if (nb >= 0) {
                    if (nb > 0) {
                        if (nb === 2) nb = 0;
                        else self.lastNeed = nb - 3
                    }
                    return nb
                }
                return 0
            }

            function utf8CheckExtraBytes(self, buf, p) {
                if ((buf[0] & 192) !== 128) {
                    self.lastNeed = 0;
                    return "�"
                }
                if (self.lastNeed > 1 && buf.length > 1) {
                    if ((buf[1] & 192) !== 128) {
                        self.lastNeed = 1;
                        return "�"
                    }
                    if (self.lastNeed > 2 && buf.length > 2) {
                        if ((buf[2] & 192) !== 128) {
                            self.lastNeed = 2;
                            return "�"
                        }
                    }
                }
            }

            function utf8FillLast(buf) {
                var p = this.lastTotal - this.lastNeed;
                var r = utf8CheckExtraBytes(this, buf, p);
                if (r !== undefined) return r;
                if (this.lastNeed <= buf.length) {
                    buf.copy(this.lastChar, p, 0, this.lastNeed);
                    return this.lastChar.toString(this.encoding, 0, this.lastTotal)
                }
                buf.copy(this.lastChar, p, 0, buf.length);
                this.lastNeed -= buf.length
            }

            function utf8Text(buf, i) {
                var total = utf8CheckIncomplete(this, buf, i);
                if (!this.lastNeed) return buf.toString("utf8", i);
                this.lastTotal = total;
                var end = buf.length - (total - this.lastNeed);
                buf.copy(this.lastChar, 0, end);
                return buf.toString("utf8", i, end)
            }

            function utf8End(buf) {
                var r = buf && buf.length ? this.write(buf) : "";
                if (this.lastNeed) return r + "�";
                return r
            }

            function utf16Text(buf, i) {
                if ((buf.length - i) % 2 === 0) {
                    var r = buf.toString("utf16le", i);
                    if (r) {
                        var c = r.charCodeAt(r.length - 1);
                        if (c >= 55296 && c <= 56319) {
                            this.lastNeed = 2;
                            this.lastTotal = 4;
                            this.lastChar[0] = buf[buf.length - 2];
                            this.lastChar[1] = buf[buf.length - 1];
                            return r.slice(0, -1)
                        }
                    }
                    return r
                }
                this.lastNeed = 1;
                this.lastTotal = 2;
                this.lastChar[0] = buf[buf.length - 1];
                return buf.toString("utf16le", i, buf.length - 1)
            }

            function utf16End(buf) {
                var r = buf && buf.length ? this.write(buf) : "";
                if (this.lastNeed) {
                    var end = this.lastTotal - this.lastNeed;
                    return r + this.lastChar.toString("utf16le", 0, end)
                }
                return r
            }

            function base64Text(buf, i) {
                var n = (buf.length - i) % 3;
                if (n === 0) return buf.toString("base64", i);
                this.lastNeed = 3 - n;
                this.lastTotal = 3;
                if (n === 1) {
                    this.lastChar[0] = buf[buf.length - 1]
                } else {
                    this.lastChar[0] = buf[buf.length - 2];
                    this.lastChar[1] = buf[buf.length - 1]
                }
                return buf.toString("base64", i, buf.length - n)
            }

            function base64End(buf) {
                var r = buf && buf.length ? this.write(buf) : "";
                if (this.lastNeed) return r + this.lastChar.toString("base64", 0, 3 - this.lastNeed);
                return r
            }

            function simpleWrite(buf) {
                return buf.toString(this.encoding)
            }

            function simpleEnd(buf) {
                return buf && buf.length ? this.write(buf) : ""
            }
        }, {
            "safe-buffer": 73
        }],
        87: [function(require, module, exports) {
            "use strict";
            var punycode = require("punycode");
            var util = require("./util");
            exports.parse = urlParse;
            exports.resolve = urlResolve;
            exports.resolveObject = urlResolveObject;
            exports.format = urlFormat;
            exports.Url = Url;

            function Url() {
                this.protocol = null;
                this.slashes = null;
                this.auth = null;
                this.host = null;
                this.port = null;
                this.hostname = null;
                this.hash = null;
                this.search = null;
                this.query = null;
                this.pathname = null;
                this.path = null;
                this.href = null
            }
            var protocolPattern = /^([a-z0-9.+-]+:)/i,
                portPattern = /:[0-9]*$/,
                simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/,
                delims = ["<", ">", '"', "`", " ", "\r", "\n", "\t"],
                unwise = ["{", "}", "|", "\\", "^", "`"].concat(delims),
                autoEscape = ["'"].concat(unwise),
                nonHostChars = ["%", "/", "?", ";", "#"].concat(autoEscape),
                hostEndingChars = ["/", "?", "#"],
                hostnameMaxLen = 255,
                hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/,
                hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/,
                unsafeProtocol = {
                    javascript: true,
                    "javascript:": true
                },
                hostlessProtocol = {
                    javascript: true,
                    "javascript:": true
                },
                slashedProtocol = {
                    http: true,
                    https: true,
                    ftp: true,
                    gopher: true,
                    file: true,
                    "http:": true,
                    "https:": true,
                    "ftp:": true,
                    "gopher:": true,
                    "file:": true
                },
                querystring = require("querystring");

            function urlParse(url, parseQueryString, slashesDenoteHost) {
                if (url && util.isObject(url) && url instanceof Url) return url;
                var u = new Url;
                u.parse(url, parseQueryString, slashesDenoteHost);
                return u
            }
            Url.prototype.parse = function(url, parseQueryString, slashesDenoteHost) {
                if (!util.isString(url)) {
                    throw new TypeError("Parameter 'url' must be a string, not " + typeof url)
                }
                var queryIndex = url.indexOf("?"),
                    splitter = queryIndex !== -1 && queryIndex < url.indexOf("#") ? "?" : "#",
                    uSplit = url.split(splitter),
                    slashRegex = /\\/g;
                uSplit[0] = uSplit[0].replace(slashRegex, "/");
                url = uSplit.join(splitter);
                var rest = url;
                rest = rest.trim();
                if (!slashesDenoteHost && url.split("#")
                    .length === 1) {
                    var simplePath = simplePathPattern.exec(rest);
                    if (simplePath) {
                        this.path = rest;
                        this.href = rest;
                        this.pathname = simplePath[1];
                        if (simplePath[2]) {
                            this.search = simplePath[2];
                            if (parseQueryString) {
                                this.query = querystring.parse(this.search.substr(1))
                            } else {
                                this.query = this.search.substr(1)
                            }
                        } else if (parseQueryString) {
                            this.search = "";
                            this.query = {}
                        }
                        return this
                    }
                }
                var proto = protocolPattern.exec(rest);
                if (proto) {
                    proto = proto[0];
                    var lowerProto = proto.toLowerCase();
                    this.protocol = lowerProto;
                    rest = rest.substr(proto.length)
                }
                if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
                    var slashes = rest.substr(0, 2) === "//";
                    if (slashes && !(proto && hostlessProtocol[proto])) {
                        rest = rest.substr(2);
                        this.slashes = true
                    }
                }
                if (!hostlessProtocol[proto] && (slashes || proto && !slashedProtocol[proto])) {
                    var hostEnd = -1;
                    for (var i = 0; i < hostEndingChars.length; i++) {
                        var hec = rest.indexOf(hostEndingChars[i]);
                        if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) hostEnd = hec
                    }
                    var auth, atSign;
                    if (hostEnd === -1) {
                        atSign = rest.lastIndexOf("@")
                    } else {
                        atSign = rest.lastIndexOf("@", hostEnd)
                    }
                    if (atSign !== -1) {
                        auth = rest.slice(0, atSign);
                        rest = rest.slice(atSign + 1);
                        this.auth = decodeURIComponent(auth)
                    }
                    hostEnd = -1;
                    for (var i = 0; i < nonHostChars.length; i++) {
                        var hec = rest.indexOf(nonHostChars[i]);
                        if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) hostEnd = hec
                    }
                    if (hostEnd === -1) hostEnd = rest.length;
                    this.host = rest.slice(0, hostEnd);
                    rest = rest.slice(hostEnd);
                    this.parseHost();
                    this.hostname = this.hostname || "";
                    var ipv6Hostname = this.hostname[0] === "[" && this.hostname[this.hostname.length - 1] === "]";
                    if (!ipv6Hostname) {
                        var hostparts = this.hostname.split(/\./);
                        for (var i = 0, l = hostparts.length; i < l; i++) {
                            var part = hostparts[i];
                            if (!part) continue;
                            if (!part.match(hostnamePartPattern)) {
                                var newpart = "";
                                for (var j = 0, k = part.length; j < k; j++) {
                                    if (part.charCodeAt(j) > 127) {
                                        newpart += "x"
                                    } else {
                                        newpart += part[j]
                                    }
                                }
                                if (!newpart.match(hostnamePartPattern)) {
                                    var validParts = hostparts.slice(0, i);
                                    var notHost = hostparts.slice(i + 1);
                                    var bit = part.match(hostnamePartStart);
                                    if (bit) {
                                        validParts.push(bit[1]);
                                        notHost.unshift(bit[2])
                                    }
                                    if (notHost.length) {
                                        rest = "/" + notHost.join(".") + rest
                                    }
                                    this.hostname = validParts.join(".");
                                    break
                                }
                            }
                        }
                    }
                    if (this.hostname.length > hostnameMaxLen) {
                        this.hostname = ""
                    } else {
                        this.hostname = this.hostname.toLowerCase()
                    }
                    if (!ipv6Hostname) {
                        this.hostname = punycode.toASCII(this.hostname)
                    }
                    var p = this.port ? ":" + this.port : "";
                    var h = this.hostname || "";
                    this.host = h + p;
                    this.href += this.host;
                    if (ipv6Hostname) {
                        this.hostname = this.hostname.substr(1, this.hostname.length - 2);
                        if (rest[0] !== "/") {
                            rest = "/" + rest
                        }
                    }
                }
                if (!unsafeProtocol[lowerProto]) {
                    for (var i = 0, l = autoEscape.length; i < l; i++) {
                        var ae = autoEscape[i];
                        if (rest.indexOf(ae) === -1) continue;
                        var esc = encodeURIComponent(ae);
                        if (esc === ae) {
                            esc = escape(ae)
                        }
                        rest = rest.split(ae)
                            .join(esc)
                    }
                }
                var hash = rest.indexOf("#");
                if (hash !== -1) {
                    this.hash = rest.substr(hash);
                    rest = rest.slice(0, hash)
                }
                var qm = rest.indexOf("?");
                if (qm !== -1) {
                    this.search = rest.substr(qm);
                    this.query = rest.substr(qm + 1);
                    if (parseQueryString) {
                        this.query = querystring.parse(this.query)
                    }
                    rest = rest.slice(0, qm)
                } else if (parseQueryString) {
                    this.search = "";
                    this.query = {}
                }
                if (rest) this.pathname = rest;
                if (slashedProtocol[lowerProto] && this.hostname && !this.pathname) {
                    this.pathname = "/"
                }
                if (this.pathname || this.search) {
                    var p = this.pathname || "";
                    var s = this.search || "";
                    this.path = p + s
                }
                this.href = this.format();
                return this
            };

            function urlFormat(obj) {
                if (util.isString(obj)) obj = urlParse(obj);
                if (!(obj instanceof Url)) return Url.prototype.format.call(obj);
                return obj.format()
            }
            Url.prototype.format = function() {
                var auth = this.auth || "";
                if (auth) {
                    auth = encodeURIComponent(auth);
                    auth = auth.replace(/%3A/i, ":");
                    auth += "@"
                }
                var protocol = this.protocol || "",
                    pathname = this.pathname || "",
                    hash = this.hash || "",
                    host = false,
                    query = "";
                if (this.host) {
                    host = auth + this.host
                } else if (this.hostname) {
                    host = auth + (this.hostname.indexOf(":") === -1 ? this.hostname : "[" + this.hostname + "]");
                    if (this.port) {
                        host += ":" + this.port
                    }
                }
                if (this.query && util.isObject(this.query) && Object.keys(this.query)
                    .length) {
                    query = querystring.stringify(this.query)
                }
                var search = this.search || query && "?" + query || "";
                if (protocol && protocol.substr(-1) !== ":") protocol += ":";
                if (this.slashes || (!protocol || slashedProtocol[protocol]) && host !== false) {
                    host = "//" + (host || "");
                    if (pathname && pathname.charAt(0) !== "/") pathname = "/" + pathname
                } else if (!host) {
                    host = ""
                }
                if (hash && hash.charAt(0) !== "#") hash = "#" + hash;
                if (search && search.charAt(0) !== "?") search = "?" + search;
                pathname = pathname.replace(/[?#]/g, function(match) {
                    return encodeURIComponent(match)
                });
                search = search.replace("#", "%23");
                return protocol + host + pathname + search + hash
            };

            function urlResolve(source, relative) {
                return urlParse(source, false, true)
                    .resolve(relative)
            }
            Url.prototype.resolve = function(relative) {
                return this.resolveObject(urlParse(relative, false, true))
                    .format()
            };

            function urlResolveObject(source, relative) {
                if (!source) return relative;
                return urlParse(source, false, true)
                    .resolveObject(relative)
            }
            Url.prototype.resolveObject = function(relative) {
                if (util.isString(relative)) {
                    var rel = new Url;
                    rel.parse(relative, false, true);
                    relative = rel
                }
                var result = new Url;
                var tkeys = Object.keys(this);
                for (var tk = 0; tk < tkeys.length; tk++) {
                    var tkey = tkeys[tk];
                    result[tkey] = this[tkey]
                }
                result.hash = relative.hash;
                if (relative.href === "") {
                    result.href = result.format();
                    return result
                }
                if (relative.slashes && !relative.protocol) {
                    var rkeys = Object.keys(relative);
                    for (var rk = 0; rk < rkeys.length; rk++) {
                        var rkey = rkeys[rk];
                        if (rkey !== "protocol") result[rkey] = relative[rkey]
                    }
                    if (slashedProtocol[result.protocol] && result.hostname && !result.pathname) {
                        result.path = result.pathname = "/"
                    }
                    result.href = result.format();
                    return result
                }
                if (relative.protocol && relative.protocol !== result.protocol) {
                    if (!slashedProtocol[relative.protocol]) {
                        var keys = Object.keys(relative);
                        for (var v = 0; v < keys.length; v++) {
                            var k = keys[v];
                            result[k] = relative[k]
                        }
                        result.href = result.format();
                        return result
                    }
                    result.protocol = relative.protocol;
                    if (!relative.host && !hostlessProtocol[relative.protocol]) {
                        var relPath = (relative.pathname || "")
                            .split("/");
                        while (relPath.length && !(relative.host = relPath.shift()));
                        if (!relative.host) relative.host = "";
                        if (!relative.hostname) relative.hostname = "";
                        if (relPath[0] !== "") relPath.unshift("");
                        if (relPath.length < 2) relPath.unshift("");
                        result.pathname = relPath.join("/")
                    } else {
                        result.pathname = relative.pathname
                    }
                    result.search = relative.search;
                    result.query = relative.query;
                    result.host = relative.host || "";
                    result.auth = relative.auth;
                    result.hostname = relative.hostname || relative.host;
                    result.port = relative.port;
                    if (result.pathname || result.search) {
                        var p = result.pathname || "";
                        var s = result.search || "";
                        result.path = p + s
                    }
                    result.slashes = result.slashes || relative.slashes;
                    result.href = result.format();
                    return result
                }
                var isSourceAbs = result.pathname && result.pathname.charAt(0) === "/",
                    isRelAbs = relative.host || relative.pathname && relative.pathname.charAt(0) === "/",
                    mustEndAbs = isRelAbs || isSourceAbs || result.host && relative.pathname,
                    removeAllDots = mustEndAbs,
                    srcPath = result.pathname && result.pathname.split("/") || [],
                    relPath = relative.pathname && relative.pathname.split("/") || [],
                    psychotic = result.protocol && !slashedProtocol[result.protocol];
                if (psychotic) {
                    result.hostname = "";
                    result.port = null;
                    if (result.host) {
                        if (srcPath[0] === "") srcPath[0] = result.host;
                        else srcPath.unshift(result.host)
                    }
                    result.host = "";
                    if (relative.protocol) {
                        relative.hostname = null;
                        relative.port = null;
                        if (relative.host) {
                            if (relPath[0] === "") relPath[0] = relative.host;
                            else relPath.unshift(relative.host)
                        }
                        relative.host = null
                    }
                    mustEndAbs = mustEndAbs && (relPath[0] === "" || srcPath[0] === "")
                }
                if (isRelAbs) {
                    result.host = relative.host || relative.host === "" ? relative.host : result.host;
                    result.hostname = relative.hostname || relative.hostname === "" ? relative.hostname : result.hostname;
                    result.search = relative.search;
                    result.query = relative.query;
                    srcPath = relPath
                } else if (relPath.length) {
                    if (!srcPath) srcPath = [];
                    srcPath.pop();
                    srcPath = srcPath.concat(relPath);
                    result.search = relative.search;
                    result.query = relative.query
                } else if (!util.isNullOrUndefined(relative.search)) {
                    if (psychotic) {
                        result.hostname = result.host = srcPath.shift();
                        var authInHost = result.host && result.host.indexOf("@") > 0 ? result.host.split("@") : false;
                        if (authInHost) {
                            result.auth = authInHost.shift();
                            result.host = result.hostname = authInHost.shift()
                        }
                    }
                    result.search = relative.search;
                    result.query = relative.query;
                    if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
                        result.path = (result.pathname ? result.pathname : "") + (result.search ? result.search : "")
                    }
                    result.href = result.format();
                    return result
                }
                if (!srcPath.length) {
                    result.pathname = null;
                    if (result.search) {
                        result.path = "/" + result.search
                    } else {
                        result.path = null
                    }
                    result.href = result.format();
                    return result
                }
                var last = srcPath.slice(-1)[0];
                var hasTrailingSlash = (result.host || relative.host || srcPath.length > 1) && (last === "." || last === "..") || last === "";
                var up = 0;
                for (var i = srcPath.length; i >= 0; i--) {
                    last = srcPath[i];
                    if (last === ".") {
                        srcPath.splice(i, 1)
                    } else if (last === "..") {
                        srcPath.splice(i, 1);
                        up++
                    } else if (up) {
                        srcPath.splice(i, 1);
                        up--
                    }
                }
                if (!mustEndAbs && !removeAllDots) {
                    for (; up--; up) {
                        srcPath.unshift("..")
                    }
                }
                if (mustEndAbs && srcPath[0] !== "" && (!srcPath[0] || srcPath[0].charAt(0) !== "/")) {
                    srcPath.unshift("")
                }
                if (hasTrailingSlash && srcPath.join("/")
                    .substr(-1) !== "/") {
                    srcPath.push("")
                }
                var isAbsolute = srcPath[0] === "" || srcPath[0] && srcPath[0].charAt(0) === "/";
                if (psychotic) {
                    result.hostname = result.host = isAbsolute ? "" : srcPath.length ? srcPath.shift() : "";
                    var authInHost = result.host && result.host.indexOf("@") > 0 ? result.host.split("@") : false;
                    if (authInHost) {
                        result.auth = authInHost.shift();
                        result.host = result.hostname = authInHost.shift()
                    }
                }
                mustEndAbs = mustEndAbs || result.host && srcPath.length;
                if (mustEndAbs && !isAbsolute) {
                    srcPath.unshift("")
                }
                if (!srcPath.length) {
                    result.pathname = null;
                    result.path = null
                } else {
                    result.pathname = srcPath.join("/")
                }
                if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
                    result.path = (result.pathname ? result.pathname : "") + (result.search ? result.search : "")
                }
                result.auth = relative.auth || result.auth;
                result.slashes = result.slashes || relative.slashes;
                result.href = result.format();
                return result
            };
            Url.prototype.parseHost = function() {
                var host = this.host;
                var port = portPattern.exec(host);
                if (port) {
                    port = port[0];
                    if (port !== ":") {
                        this.port = port.substr(1)
                    }
                    host = host.substr(0, host.length - port.length)
                }
                if (host) this.hostname = host
            }
        }, {
            "./util": 88,
            punycode: 69,
            querystring: 72
        }],
        88: [function(require, module, exports) {
            "use strict";
            module.exports = {
                isString: function(arg) {
                    return typeof arg === "string"
                },
                isObject: function(arg) {
                    return typeof arg === "object" && arg !== null
                },
                isNull: function(arg) {
                    return arg === null
                },
                isNullOrUndefined: function(arg) {
                    return arg == null
                }
            }
        }, {}],
        89: [function(require, module, exports) {
            module.exports = extend;
            var hasOwnProperty = Object.prototype.hasOwnProperty;

            function extend() {
                var target = {};
                for (var i = 0; i < arguments.length; i++) {
                    var source = arguments[i];
                    for (var key in source) {
                        if (hasOwnProperty.call(source, key)) {
                            target[key] = source[key]
                        }
                    }
                }
                return target
            }
        }, {}]
    }, {}, [1])(1)
});