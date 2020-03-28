const fs = require('fs');

const axios = require('axios');
const cheerio = require('cheerio');
const _ = require('lodash');
const moment = require('moment-timezone');
const Globalize = require('globalize');

Globalize.load(
	require( "cldr-data" ).entireMainFor('en'),
	require( "cldr-data" ).entireSupplemental()
);

const numParse = Globalize('us').numberParser();

const url = 'https://www.health.pa.gov/topics/disease/coronavirus/Pages/Cases.aspx'


async function scrape() {
	return await axios(url)
	.then(response => {
		const html = response.data;
		const $ = cheerio.load(html);
		const tables = $('table.ms-rteTable-default');
		const testTable = tables.eq(0).find('tr');
		let countiesTable = tables.eq(3).find('tr');

		let testStats = testTable.eq(1).find('td');
		let testing = {
			'negative': numParse(testStats.eq(0).text()),
			'positive': numParse(testStats.eq(1).text()),
			'deaths': numParse(testStats.eq(2).text())
		};

		let counties = []; 

		countiesTable = countiesTable.slice(1);
		countiesTable.each(function() {
			const cells = $(this).find('td');
			const county = cells.eq(0).text();
			const cases = numParse(cells.eq(1).text());
			let deaths = numParse(cells.eq(2).text());
			deaths = _.isNaN(deaths) ? 0 : deaths;

			counties.push({
				county,
				cases,
				deaths
			});
		});
		return {counties, testing};
	})
}

function formatTesting(data, date){
	console.log(data);

	data = {
		date,
		...data
	}

	let file = JSON.parse(fs.readFileSync('data/testing.json', 'utf8'));
	let oldData = file.PA.findIndex(d => d.date === date);

	if(oldData >= 0){
		file.PA.splice(oldData, 1, data);
	} else {
		file.PA.push(data)
	}

	fs.writeFileSync('data/testing.json', JSON.stringify(file, null, 2));
}

function formatCounties(data, date){
	console.log(data);

	let file = JSON.parse(fs.readFileSync('data/counties.json', 'utf8'));

	data.forEach(el => {

		countyData = {
			date,
			cases: el.cases,
			deaths: el.deaths
		}

		el.county = el.county.replace(/[\x00-\x1F\x7F-\x9F]/, "");
		if(!file.PA[el.county]){
			file.PA[el.county] = [];
		}
		let oldCountyData = file.PA[el.county];
		let oldData = oldCountyData.find(d => d.date === date);

		if(oldData){
			oldData = countyData;
		} else {
			oldCountyData.push(countyData);
		}
	});

	fs.writeFileSync('data/counties.json', JSON.stringify(file, null, 2));
}

async function runner() {
	let { counties, testing } = await scrape();
	let date = moment().tz("America/New_York").format('YYYY-MM-DD');
	formatCounties(counties, date);
	formatTesting(testing, date);
}

exports.runner = runner;