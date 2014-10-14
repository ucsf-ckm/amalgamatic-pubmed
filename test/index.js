/*jshint expr: true*/

var rewire = require('rewire');

var pubmed = rewire('../index.js');

var nock = require('nock');

var Lab = require('lab');
var lab = exports.lab = Lab.script();

var expect = Lab.expect;
var describe = lab.experiment;
var it = lab.test;
var beforeEach = lab.before;
var afterEach = lab.afterEach;

var revert;

describe('exports', function () {

	beforeEach(function (done) {
		nock.disableNetConnect();
		done();
	});

	afterEach(function (done) {
		pubmed.setOptions({tool: 'cdl', otool: 'cdlotool'});
		nock.cleanAll();
		if (revert) {
			revert();
			revert = null;
		}
		done();
	});

	var emptyResult = {suggestedTerms: [], data: []};

	it('returns an empty result if no search term provided', function (done) {
		pubmed.search({searchTerm: ''}, function (err, result) {
			expect(err).to.be.not.ok;
			expect(result).to.deep.equal(emptyResult);
			done();
		});
	});

	it('returns an empty result if invoked with no first argument', function (done) {
		pubmed.search(null, function (err, result) {
			expect(err).to.be.not.ok;
			expect(result).to.deep.equal(emptyResult);
			done();
		});
	});

	it('returns results if a non-ridiculous search term is provided', function (done) {
		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esearch.fcgi?retmode=json&term=medicine')
			.reply(200, '{"esearchresult": {"count": "2","retmax": "2","retstart": "0","idlist": ["25230398","25230381"]}}');

		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=25230398%2C25230381')
			.reply(200, '{"result": {"uids": ["25230398","25230381"], "25230398": {"title": "Medicine 1"}, "25230381": {"title": "Medicine 2"}}}');

		pubmed.search({searchTerm: 'medicine'}, function (err, result) {
			expect(err).to.be.not.ok;
			expect(result.data.length).to.equal(2);
			done();
		});
	});

	it('returns results an empty result if there is no esearchresult in JSON', function (done) {
		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esearch.fcgi?retmode=json&term=medicine')
			.reply(200, '{"fhqwhgads": {"come on": "fhqwhgads"}}');

		pubmed.search({searchTerm: 'medicine'}, function (err, result) {
			expect(err).to.be.not.ok;
			expect(result.data.length).to.equal(0);
			done();
		});
	});

	it('returns an empty result if ridiculous search term is provided', function (done) {
		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esearch.fcgi?retmode=json&term=fhqwhgads')
			.reply(200, '{"esearchresult": {"count": "0","retmax": "0","retstart": "0","idlist": []}}');

		pubmed.search({searchTerm: 'fhqwhgads'}, function (err, result) {
			expect(err).to.be.not.ok;
			expect(result.data.length).to.equal(0);
			done();
		});
	});

	it('returns an error if there was an HTTP error', function (done) {
		pubmed.search({searchTerm: 'medicine'}, function (err) {
			expect(err.message).to.equal('Nock: Not allow net connect for "eutils.ncbi.nlm.nih.gov:80"');
			done();
		});
	});

	it('returns an error if it receives invalid JSON on the first HTTP GET', function (done) {
		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esearch.fcgi?retmode=json&term=medicine')
			.reply(200, '{');

		pubmed.search({searchTerm: 'medicine'}, function (err) {
			expect(err.message).to.equal('Unexpected end of input');
			done();
		});
	});

	it('returns an error if it receives invalid JSON on the second HTTP GET', function (done) {
		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esearch.fcgi?retmode=json&term=medicine')
			.reply(200, '{"esearchresult": {"count": "2","retmax": "2","retstart": "0","idlist": ["25230398","25230381"]}}');

		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=25230398%2C25230381')
			.reply(200, 'fhqwhgads: to the limit');

		pubmed.search({searchTerm: 'medicine'}, function (err) {
			expect(err.message).to.equal('Unexpected token h');
			done();
		});
	});

	it('returns empty results if there is no result property in the second HTTP GET', function (done) {
		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esearch.fcgi?retmode=json&term=medicine')
			.reply(200, '{"esearchresult": {"count": "2","retmax": "2","retstart": "0","idlist": ["25230398","25230381"]}}');

		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=25230398%2C25230381')
			.reply(200, '{}');

		pubmed.search({searchTerm: 'medicine'}, function (err, result) {
			expect(err).to.be.not.ok;
			expect(result.data.length).to.equal(0);
			done();
		});
	});

	it('gracefully omits IDs in index that are not in the actual object', function (done) {
		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esearch.fcgi?retmode=json&term=medicine')
			.reply(200, '{"esearchresult": {"count": "2","retmax": "2","retstart": "0","idlist": ["25230398","25230381"]}}');

		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=25230398%2C25230381')
			.reply(200, '{"result": {"uids": ["25230398","25230381"], "25230381": {"title": "Medicine 2"}}}');

		pubmed.search({searchTerm: 'medicine'}, function (err, result) {
			expect(err).to.be.not.ok;
			expect(result.data.length).to.equal(1);
			done();
		});
	});

	it('uses booktitle property when title property is not present', function (done) {
		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esearch.fcgi?retmode=json&term=medicine')
			.reply(200, '{"esearchresult": {"count": "2","retmax": "2","retstart": "0","idlist": ["25230398","25230381"]}}');

		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=25230398%2C25230381')
			.reply(200, '{"result": {"uids": ["25230398","25230381"], "25230398": {"booktitle": "Medicine 1"}, "25230381": {"booktitle": "Medicine 2"}}}');

		pubmed.search({searchTerm: 'medicine'}, function (err, result) {
			expect(err).to.be.not.ok;
			expect(result.data.length).to.equal(2);
			expect(result.data[0].name).to.equal('Medicine 1');
			expect(result.data[1].name).to.equal('Medicine 2');
			done();
		});
	});

	it('returns an error if the second HTTP GET results in an HTTP error', function (done) {
		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esearch.fcgi?retmode=json&term=medicine')
			.reply(200, '{"esearchresult": {"count": "2","retmax": "2","retstart": "0","idlist": ["25230398","25230381"]}}');

		pubmed.search({searchTerm: 'medicine'}, function (err) {
			expect(err.message).to.equal('Nock: Not allow net connect for "eutils.ncbi.nlm.nih.gov:80"');
			done();
		});
	});

	it('returns URLs that include the returned UIDs', function (done) {
		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esearch.fcgi?retmode=json&term=medicine')
			.reply(200, '{"esearchresult": {"count": "2","retmax": "2","retstart": "0","idlist": ["25230398","25230381"]}}');

		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=25230398%2C25230381')
			.reply(200, '{"result": {"uids": ["25230398","25230381"], "25230398": {"title": "Medicine 1"}, "25230381": {"title": "Medicine 2"}}}');

		pubmed.search({searchTerm: 'medicine'}, function (err, result) {
			expect(err).to.be.not.ok;
			expect(result.data[0].url.indexOf('25230398') !== -1).to.be.ok;
			expect(result.data[1].url.indexOf('25230381') !== -1).to.be.ok;
			done();
		});
	});

	it('omits HTML markup in results', function (done) {
		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esearch.fcgi?retmode=json&term=medicine')
			.reply(200, '{"esearchresult": {"count": "1","retmax": "1","retstart": "0","idlist": ["25230398"]}}');

		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=25230398')
			.reply(200, '{"result": {"uids": ["25230398"], "25230398": {"title": "A Simple Method for Establishing Adherent &lt;i&gt;Ex Vivo&lt;/i&gt; Explant Cultures from Human Eye Pathologies for Use in Subsequent Calcium Imaging and Inflammatory Studies."}}}');

		pubmed.search({searchTerm: 'medicine'}, function (err, result) {
			expect(err).to.be.not.ok;
			expect(result.data.length).to.equal(1);
			expect(result.data[0].name).to.equal('A Simple Method for Establishing Adherent Ex Vivo Explant Cultures from Human Eye Pathologies for Use in Subsequent Calcium Imaging and Inflammatory Studies.');
			done();
		});
	});

	it('should return suggested terms', function (done) {
		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esearch.fcgi?retmode=json&term=medisine')
			.reply(200, '{"esearchresult": {"count": "0","retmax": "0","retstart": "0","idlist": []}}');

		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/espell.fcgi?term=medisine')
			.replyWithFile(200, __dirname + '/fixtures/oneSuggestion.xml');

		pubmed.search({searchTerm: 'medisine'}, function (err, result) {
			expect(err).to.be.not.ok;
			expect(result.data.length).to.equal(0);
			expect(result.suggestedTerms).to.deep.equal(['medicine']);
			done();
		});
	});

	it('should return empty suggested terms if XML is malformed', function (done) {
		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esearch.fcgi?retmode=json&term=medisine')
			.reply(200, '{"esearchresult": {"count": "0","retmax": "0","retstart": "0","idlist": []}}');

		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/espell.fcgi?term=medisine')
			.reply(200, '<malformed');

		pubmed.search({searchTerm: 'medisine'}, function (err, result) {
			expect(err).to.be.not.ok;
			expect(result.suggestedTerms).to.deep.equal([]);
			done();
		});
	});

	it('should return empty suggested terms if eSpellResult is missing CorrectedQuery', function (done) {
		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esearch.fcgi?retmode=json&term=medisine')
			.reply(200, '{"esearchresult": {"count": "0","retmax": "0","retstart": "0","idlist": []}}');

		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/espell.fcgi?term=medisine')
			.reply(200, '<eSpellResult/>');

		pubmed.search({searchTerm: 'medisine'}, function (err, result) {
			expect(err).to.be.not.ok;
			expect(result.suggestedTerms).to.deep.equal([]);
			done();
		});
	});

	it('should accept tool and otool options', function (done) {
		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esearch.fcgi?retmode=json&term=medicine')
			.reply(200, '{"esearchresult": {"count": "1","retmax": "1","retstart": "0","idlist": ["25230398"]}}');

		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=25230398')
			.reply(200, '{"result": {"uids": ["25230398"], "25230398": {"title": "Medicine 1"}}}');

		pubmed.setOptions({tool: 'foo', otool: 'bar'});
		
		pubmed.search({searchTerm: 'medicine'}, function (err, result) {
			expect(err).to.be.not.ok;
			expect(result.data).to.deep.equal([{name: 'Medicine 1', url: 'http://www.ncbi.nlm.nih.gov/entrez/query.fcgi?db=pubmed&cmd=Retrieve&dopt=AbstractPlus&query_hl=2&itool=pubmed_docsum&tool=foo&otool=bar&list_uids=25230398'}]);
			done();
		});
	});

	it('should return a link to the PubMed search results page', function (done) {
		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esearch.fcgi?retmode=json&term=medicine')
			.reply(200, '{"esearchresult": {"count": "1","retmax": "1","retstart": "0","idlist": ["25230398"]}}');

		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=25230398')
			.reply(200, '{"result": {"uids": ["25230398"], "25230398": {"title": "Medicine 1"}}}');

		pubmed.search({searchTerm: 'medicine'}, function (err, result) {
			expect(err).to.be.not.ok;
			expect(result.url).to.equal('http://www.ncbi.nlm.nih.gov/pubmed?tool=cdl&otool=cdlotool&cmd=search&term=medicine');
			done();
		});
	});
	it('should set withCredentials to false for browserify', function (done) {
		var count = 0;
		revert = pubmed.__set__({http: {get: function (options) {
			expect(options.withCredentials).to.be.false;
			count++;
			if (count === 2) {
				done();
			}
			return {on: function () {}};
		}}});

		pubmed.search({searchTerm: 'medicine'});
	});
});