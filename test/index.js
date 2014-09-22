/*jshint expr: true*/

var pubmed = require('../index.js');

var nock = require('nock');

var Lab = require('lab');
var lab = exports.lab = Lab.script();

var expect = Lab.expect;
var describe = lab.experiment;
var it = lab.test;
var before = lab.before;
var afterEach = lab.afterEach;

describe('exports', function () {

	before(function (done) {
		nock.disableNetConnect();
		done();
	});

	afterEach(function (done) {
		nock.cleanAll();
		done();
	});

	it('returns an empty result if no search term provided', function (done) {
		pubmed.search({searchTerm: ''}, function (result) {
			expect(result).to.deep.equal({data:[]});
			done();
		});
	});

	it('returns an empty result if invoked with no first argument', function (done) {
		pubmed.search(null, function (result) {
			expect(result).to.deep.equal({data:[]});
			done();
		});
	});

	it('returns results if a non-ridiculous search term is provided', function (done) {
		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esearch.fcgi?retmode=json&term=medicine')
			.reply('200', '{"esearchresult": {"count": "2","retmax": "2","retstart": "0","idlist": ["25230398","25230381"]}}');

		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=25230398%2C25230381')
			.reply('200', '{"result": {"uids": ["25230398","25230381"], "25230398": {"title": "Medicine 1"}, "25230381": {"title": "Medicine 2"}}}');

		pubmed.search({searchTerm: 'medicine'}, function (result) {
			expect(result.error).to.be.undefined;
			expect(result.data.length).to.equal(2);
			done();
		});
	});

	it('returns results an empty result if there is no esearchresult in JSON', function (done) {
		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esearch.fcgi?retmode=json&term=medicine')
			.reply('200', '{"fhqwhgads": {"come on": "fhqwhgads"}}');

		pubmed.search({searchTerm: 'medicine'}, function (result) {
			expect(result.error).to.be.undefined;
			expect(result.data.length).to.equal(0);
			done();
		});
	});

	it('returns an empty result if ridiculous search term is provided', function (done) {
		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esearch.fcgi?retmode=json&term=fhqwhgads')
			.reply('200', '{"esearchresult": {"count": "0","retmax": "0","retstart": "0","idlist": []}}');

		pubmed.search({searchTerm: 'fhqwhgads'}, function (result) {
			expect(result.error).to.be.undefined;
			expect(result.data.length).to.equal(0);
			done();
		});
	});

	it('returns an error if there was an HTTP error', function (done) {
		pubmed.search({searchTerm: 'medicine'}, function (result) {
			expect(result.data).to.be.undefined;
			expect(result.error).to.equal('Nock: Not allow net connect for "eutils.ncbi.nlm.nih.gov:80"');
			done();
		});
	});

	it('returns an error if it receives invalid JSON on the first HTTP GET', function (done) {
		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esearch.fcgi?retmode=json&term=medicine')
			.reply('200', '{');

		pubmed.search({searchTerm: 'medicine'}, function (result) {
			expect(result.data).to.be.undefined;
			expect(result.error).to.equal('Unexpected end of input');
			done();
		});
	});

	it('returns an error if it receives invalid JSON on the second HTTP GET', function (done) {
		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esearch.fcgi?retmode=json&term=medicine')
			.reply('200', '{"esearchresult": {"count": "2","retmax": "2","retstart": "0","idlist": ["25230398","25230381"]}}');

		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=25230398%2C25230381')
			.reply('200', 'fhqwhgads: to the limit');

		pubmed.search({searchTerm: 'medicine'}, function (result) {
			expect(result.data).to.be.undefined;
			expect(result.error).to.equal('Unexpected token h');
			done();
		});
	});

	it('returns empty results if there is no result property in the second HTTP GET', function (done) {
		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esearch.fcgi?retmode=json&term=medicine')
			.reply('200', '{"esearchresult": {"count": "2","retmax": "2","retstart": "0","idlist": ["25230398","25230381"]}}');

		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=25230398%2C25230381')
			.reply('200', '{}');

		pubmed.search({searchTerm: 'medicine'}, function (result) {
			expect(result.error).to.be.undefined;
			expect(result.data.length).to.equal(0);
			done();
		});
	});

	it('gracefully omits IDs in index that are not in the actual object', function (done) {
		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esearch.fcgi?retmode=json&term=medicine')
			.reply('200', '{"esearchresult": {"count": "2","retmax": "2","retstart": "0","idlist": ["25230398","25230381"]}}');

		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=25230398%2C25230381')
			.reply('200', '{"result": {"uids": ["25230398","25230381"], "25230381": {"title": "Medicine 2"}}}');

		pubmed.search({searchTerm: 'medicine'}, function (result) {
			expect(result.error).to.be.undefined;
			expect(result.data.length).to.equal(1);
			done();
		});
	});

	it('uses booktitle property when title property is not present', function (done) {
		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esearch.fcgi?retmode=json&term=medicine')
			.reply('200', '{"esearchresult": {"count": "2","retmax": "2","retstart": "0","idlist": ["25230398","25230381"]}}');

		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=25230398%2C25230381')
			.reply('200', '{"result": {"uids": ["25230398","25230381"], "25230398": {"booktitle": "Medicine 1"}, "25230381": {"booktitle": "Medicine 2"}}}');

		pubmed.search({searchTerm: 'medicine'}, function (result) {
			expect(result.error).to.be.undefined;
			expect(result.data.length).to.equal(2);
			expect(result.data[0].name).to.equal('Medicine 1');
			expect(result.data[1].name).to.equal('Medicine 2');
			done();
		});
	});

	it('returns an error if the second HTTP GET results in an HTTP error', function (done) {
		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esearch.fcgi?retmode=json&term=medicine')
			.reply('200', '{"esearchresult": {"count": "2","retmax": "2","retstart": "0","idlist": ["25230398","25230381"]}}');

		pubmed.search({searchTerm: 'medicine'}, function (result) {
			expect(result.data).to.be.undefined;
			expect(result.error).to.equal('Nock: Not allow net connect for "eutils.ncbi.nlm.nih.gov:80"');
			done();
		});
	});

	it('returns URLs that include the returned UIDs', function (done) {
		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esearch.fcgi?retmode=json&term=medicine')
			.reply('200', '{"esearchresult": {"count": "2","retmax": "2","retstart": "0","idlist": ["25230398","25230381"]}}');

		nock('http://eutils.ncbi.nlm.nih.gov')
			.get('/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=25230398%2C25230381')
			.reply('200', '{"result": {"uids": ["25230398","25230381"], "25230398": {"title": "Medicine 1"}, "25230381": {"title": "Medicine 2"}}}');

		pubmed.search({searchTerm: 'medicine'}, function (result) {
			expect(result.data[0].url.indexOf('25230398') !== -1).to.be.ok;
			expect(result.data[1].url.indexOf('25230381') !== -1).to.be.ok;
			done();
		});
	});

});
