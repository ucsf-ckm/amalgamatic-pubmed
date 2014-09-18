var querystring = require('querystring');
var http = require('http');

exports.search = function (query, callback) {
    'use strict';

    if (! query) {
        callback({data: []});
        return;
    }

    var options = {
        host: 'eutils.ncbi.nlm.nih.gov',
        path: '/entrez/eutils/esearch.fcgi?retmode=json&' +
            querystring.stringify({term: query})
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
                callback({error: e.message});
                return;
            }

            var uids;
            if ($.idlist instanceof Array && $.idlist.length) {
                uids = $.idlist.join(',');
            } else {
                callback({data: []});
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
                        callback({error: e.message});
                        return;
                    }
                    if ($.uids instanceof Array) {
                        $.uids.forEach(function (id) {
                            if ($[id]) {
                                result.push({
                                    name: $[id].title || $[id].booktitle,
                                    url: 'http://www.ncbi.nlm.nih.gov/entrez/query.fcgi?db=pubmed&cmd=Retrieve&dopt=AbstractPlus&query_hl=2&itool=pubmed_docsum&tool=cdl&otool=cdlotool&' +
                                        querystring.stringify({ list_uids: id })
                                });
                            }
                        });
                    } 

                    callback({data: result});
                });
            })
            .on('error', function (e) {
                callback({error: e.message});
            });
        });
    };

    http.get(options, httpCallback)
    .on('error', function (e) {
        callback({error: e.message});
    });
};