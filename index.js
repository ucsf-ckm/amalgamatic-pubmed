var querystring = require('querystring');
var http = require('http');

exports.search = function (query, callback) {
    'use strict';

    if (! query || ! query.searchTerm) {
        callback(null, {data: []});
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
                callback(null, {data: []});
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

                    callback(null, {data: result});
                });
            })
            .on('error', function (e) {
                callback(e);
            });
        });
    };

    http.get(options, httpCallback)
    .on('error', function (e) {
        callback(e);
    });
};