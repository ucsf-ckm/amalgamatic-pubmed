var querystring = require('querystring');
var http = require('http');
var parseString = require('xml2js').parseString;

exports.search = function (query, callback) {
    'use strict';

    var final = {};
    var setter = function (property, value) {
        final[property] = value;
        if (final.suggestedTerms && final.data) {
            callback(null, final);
        }
    };

    if (! query || ! query.searchTerm) {
        callback(null, {data: [], suggestedTerms: []});
        return;
    }

    var options = {
        host: 'eutils.ncbi.nlm.nih.gov',
        path: '/entrez/eutils/esearch.fcgi?retmode=json&' +
            querystring.stringify({term: query.searchTerm})
    };

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
                setter('data', []);
                return;
            }

            var options = {
                host: 'eutils.ncbi.nlm.nih.gov',
                path: '/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&' +
                    querystring.stringify( {id: uids} )
            };

            http.get(options, function (res) {
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
                                    url: 'http://www.ncbi.nlm.nih.gov/entrez/query.fcgi?db=pubmed&cmd=Retrieve&dopt=AbstractPlus&query_hl=2&itool=pubmed_docsum&tool=cdl&otool=cdlotool&' +
                                        querystring.stringify({ list_uids: id })
                                });
                            }
                        });
                    }

                    setter('data', result);

                });
            })
            .on('error', function (e) {
                callback(e);
                return;
            });
        });
    };

    http.get(options, httpCallback)
    .on('error', function (e) {
        callback(e);
        return;
    });

    var suggestionOptions = {
        host: 'eutils.ncbi.nlm.nih.gov',
        path: '/entrez/eutils/espell.fcgi?' +
            querystring.stringify( {term: query.searchTerm} )
    };

    http.get(suggestionOptions, function (res) {
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
                setter('suggestedTerms', suggestedTerms);
            });
        });
    })
    .on('error', function () {
        // suggested terms are not essential, so let's not blow up the whole thing
        setter('suggestedTerms', []);
    });
};