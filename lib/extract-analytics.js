module.exports = function(logContents) {
	
	var data = [];

	var pattern = /<ANALYTICS>.*<\/ANALYTICS>/gi;
	
	var matches = logContents.match(pattern) || [];
	//console.info('\n\nmatches => ', matches);

	matches.forEach(function(child) {
		var clean = child.replace(/<ANALYTICS>/, '').replace(/<\/ANALYTICS>/, '');
		//clean = clean.replace(/<\/ANALYTICS>/, '');
		//console.info('\nclean => ', clean);

		var dataArray = JSON.parse(clean) || [];
		dataArray.forEach(function(timingEvent) {
			data.push(timingEvent);
		});
	});

	return data;
}