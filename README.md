[![Build Status](https://travis-ci.org/ucsf-ckm/amalgamatic-pubmed.svg?branch=master)](https://travis-ci.org/ucsf-ckm/amalgamatic-pubmed)

amalgamatic-pubmed
==================

[PubMed](http://www.ncbi.nlm.nih.gov/pubmed) plugin for [Amalgamatic](https://github.com/ucsf-ckm/amalgamatic)

## Installation

Install amalgamatic and this plugin via `npm`:

`npm install amalgamatic amalgamatic-pubmed`

## Usage

````
var amalgamatic = require('amalgamatic'),
    pubmed = require('amalgamatic-pubmed');

// Set your tool and otool options if you want results to come back customized for your institution
pubmed.setOptions({tool: 'cdl', otool: 'cdlotool'});

// Add this plugin to your Amalgamatic instance along with any other plugins you've configured.
amalgamatic.add('our cool pubmed plugin', pubmed);

//Use it!
var callback = function (err, results) {
    if (err) {
        console.dir(err);
    } else {
        results.forEach(function (result) {
            console.log('Plugin Name: ' + result.name);
            console.log('\nSearch Results: ');
            result.data.forEach(function (value) { console.dir(value); } );
            console.log('\nSuggested terms: ' + result.suggestedTerms.join(','));
        });
    }
};

// Let's misspell "medicine" to trigger PubMed's suggested terms along with the search results
amalgamatic.search({searchTerm: 'medisine'}, callback);
````