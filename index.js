var querystring = require('querystring');
var http = require('http');
var parseString = require('xml2js').parseString;
var extend = require('util-extend');
var async = require('async');
var url = require('url');

var options = {
    tool: 'cdl',
    otool: 'cdlotool'
};

var makeBrowserifyOptions = function (myUrl) {
    var myOptions = url.parse(myUrl);
    myOptions.withCredentials = false;
    return myOptions;
};

exports.setOptions = function (newOptions) {
    options = extend(options, newOptions);
};

exports.search = function (query, callback) {
    'use strict';

    if (! query || ! query.searchTerm) {
        callback(null, {data: [], suggestedTerms: []});
        return;
    }

    var dataTask = function (done) {

        var myUrl = 'http://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?retmode=json&' +
                querystring.stringify({term: query.searchTerm});

        var httpCallback = function (res) {
            var rawData = '';

            res.on('data', function (chunk) {
                rawData += chunk;
            });

            res.on('end', function () {
                var $;
                try {
                    $ = JSON.parse(rawData).esearchresult || {};
                } catch (e) {
                    callback(e);
                    return;
                }

                var uids;
                if ($.idlist instanceof Array && $.idlist.length) {
                    uids = $.idlist.join(',');
                } else {
                    done(null, []);
                    return;
                }

                var myUrl = 'http://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&' +
                        querystring.stringify( {id: uids} );

                http.get(makeBrowserifyOptions(myUrl), function (res) {
                    var rawData = '';
                    var result = [];

                    res.on('data', function (chunk) {
                        rawData += chunk;
                    });

                    res.on('end', function () {
                        var $;
                        try {
                            $ = JSON.parse(rawData).result || {};
                        } catch (e) {
                            callback(e);
                            return;
                        }
                        if ($.uids instanceof Array) {
                            $.uids.forEach(function (id) {
                                if ($[id]) {
                                    var name = $[id].title || $[id].booktitle;

                                    // Sometimes PubMed returns extraneous HTML entities. See https://github.com/ucsf-ckm/amalgamatic-pubmed/issues/9
                                    name = name.replace(/&lt;.*?&gt;/g, '');

                                    result.push({
                                        name: name,
                                        url: 'http://www.ncbi.nlm.nih.gov/entrez/query.fcgi?db=pubmed&cmd=Retrieve&dopt=AbstractPlus&query_hl=2&itool=pubmed_docsum&' +
                                            querystring.stringify(options) + '&' +
                                            querystring.stringify({ list_uids: id })
                                    });
                                }
                            });
                        }

                        done(null, result);
                        return;

                    });
                })
                .on('error', function (e) {
                    done(e);
                    return;
                });
            });
        };

        http.get(makeBrowserifyOptions(myUrl), httpCallback)
        .on('error', function (e) {
            done(e);
            return;
        });
    };

    var suggestedTermsTask = function (done) {
        var suggestionUrl = 'http://eutils.ncbi.nlm.nih.gov/entrez/eutils/espell.fcgi?' +
                querystring.stringify( {term: query.searchTerm} );

        http.get(makeBrowserifyOptions(suggestionUrl), function (res) {
            var xml = '';

            res.on('data', function (chunk) {
                xml += chunk;
            });

            res.on('end', function () {
                parseString(xml, function (err, result) {
                    var suggestedTerms;
                    if (result && result.eSpellResult && result.eSpellResult.CorrectedQuery) {
                        suggestedTerms = result.eSpellResult.CorrectedQuery;
                    } else {
                        suggestedTerms = [];
                    }

                    // suggested terms are not essential, so let's not blow up with errors
                    done(null, suggestedTerms);
                });
            });
        })
        .on('error', function () {
            // suggested terms are not essential, so let's not blow up the whole thing
            done(null, []);
        });
    };

    async.parallel({data: dataTask, suggestedTerms: suggestedTermsTask}, function (err, results) {
        results.url = 'http://www.ncbi.nlm.nih.gov/pubmed?' +
            querystring.stringify(options) + '&' +
            querystring.stringify({ cmd: 'search', term: query.searchTerm});
        callback(err, results);
    });
};