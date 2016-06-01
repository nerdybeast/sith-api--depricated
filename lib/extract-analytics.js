'use strict';

module.exports = function(logContents) {
	
	let data = [];

	let pattern = /<ANALYTICS>.*<\/ANALYTICS>/gi;
	
	//TODO: use .exec to get matches without having to run the .replace below.
	let matches = logContents.match(pattern) || [];

	matches.forEach(function(child) {

		let clean = child.replace(/<ANALYTICS>/, '').replace(/<\/ANALYTICS>/, '');

		let dataArray = JSON.parse(clean) || [];

		dataArray.forEach(function(timingEvent) {
			data.push(timingEvent);
		});
	});

	return data;
}