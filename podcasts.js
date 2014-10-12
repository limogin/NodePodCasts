fs     = require ('fs');
util   = require('util');
http   = require('http');
url    = require('url');
crypto = require('crypto');

common = function () {
		
};

common.basename = function (path, suffix) {
	  // From: http://phpjs.org/functions
	  // +   original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
	  // +   improved by: Ash Searle (http://hexmen.com/blog/)
	  // +   improved by: Lincoln Ramsay
	  // +   improved by: djmix
	  // *     example 1: basename('/www/site/home.htm', '.htm');
	  // *     returns 1: 'home'
	  // *     example 2: basename('ecra.php?p=1');
	  // *     returns 2: 'ecra.php?p=1'
	  var b = path.replace(/^.*[\/\\]/g, '');

	  if (typeof suffix === 'string' && b.substr(b.length - suffix.length) == suffix) {
	    b = b.substr(0, b.length - suffix.length);
	  }

	  return b;
};

common.md5 = function (s) {
	var hash = crypto.createHash('md5').update(s).digest('hex');
	return hash;
}


common.download = function (myurl, dest, cb) {
	var self=this;
	var file = fs.createWriteStream(dest);
	var request = http.get(myurl, function(response) {
		
		if (response.statusCode > 300 && response.statusCode < 400 && response.headers.location) {
	      self.download_iter+=1;
		  if (self.download_iter>5) return cb (false, null);
		  self.download (response.headers.location, dest, cb);
			
		} else { 
		  self.download_iter=0;
	      response.pipe(file);
	      file.on('finish', function() {
	        file.close();
	        return cb(true, null);
	      });
	      file.on('error', function () {
	    	file.close();
	    	return cb(false, null);
	      })
	      
		};
	});
};


common.get = function (myurl, cb) {

	http.get (myurl, function (r) {
		var data='';
		
		r.setEncoding('utf8');
		r.on ('data', function (chunk) {
  		  data+=chunk;
  		});
  		
  	    r.on ('error', function (e) {
  		 console.log ('error reading url: ' + e);
  		 return cb(false,null);
  	    });
  	    
  	    r.on('end', function () {
  	     return cb (true,data);
  	    });
  	});

};

common.findurls = function (s) {
    var source = (s || '').toString();
    var urlArray = [];
    var url;
    var matchArray;

    var regexToken = /(((ftp|https?):\/\/)[\-\w@:%_\+.~#?,&\/\/=]+)|((mailto:)?[_.\w-]+@([\w][\w\-]+\.)+[a-zA-Z]{2,3})/g;

    while( (matchArray = regexToken.exec( source )) !== null )
    {
        var token = matchArray[0];
        urlArray.push( token );
    }

    return urlArray;
}

common.findmp3 = function (s) {
    var source = (s || '').toString();
    var urlArray = [];
    var url;
    var matchArray;

    var regexToken = /(((ftp|https?):\/\/)[\-\w@:%_\+.~#?,&\/\/=]+)\.mp3|((mailto:)?[_.\w-]+@([\w][\w\-]+\.)+[a-zA-Z]{2,3}\.mp3)/g;

    while( (matchArray = regexToken.exec( source )) !== null )
    {
        var token = matchArray[0];
        urlArray.push( token );
    }

    return urlArray;
}


podcasts = function () {
	
	
};

podcasts.prototype.month = function () {
	var t = new Date();
	// var d = sprintf ("%d-%02d", t.getFullYear(), (t.getMonth() + 1));
	// var d = t.getFullYear() + '-' + (t.getMonth() + 1);
	var d =util.format ("%d-%d", t.getFullYear(), (t.getMonth() + 1));
	return d;	
}


podcasts.prototype.previous_month = function (ndx) {
	var t = new Date();
	var m = t.getMonth()-ndx;
	var y = t.getFullYear();
	if (m<=0) {
		m=1;
		y = y - ndx;
	}
	var d =util.format ("%d-%d", t, m);
	return d;	
}

podcasts.prototype.last_month = function () {
	var t = new Date();
	var m = t.getMonth();
	var y = t.getFullYear();
	if (m<=0) {
		m=1;
		y = y -1;
	}
	var d =util.format ("%d-%d", t, m);
	return d;	
}


/**
 * load archive.txt and create folders  
 */
podcasts.prototype.load = function (cb) {
    var self=this;
    
	fs.exists('archive.txt', function (exists) {
		if (exists) {
		 fs.readFile ('archive.txt', 'utf8', function (e,data) {
			 var lines = data.split ("\n");
			 var c = lines.length, ci=0;
			 if (c<=0) return cb(false, null);
			 
			 lines.map (function (entry) {
				 entry = entry.trim();
				 entry = entry.split (',');
				 if (entry[0]=='' || entry[1]=='') return;  
				 // console.log ("folder " + entry[0] +  "url " + entry[1] + "\n");
				 if (!fs.existsSync (entry[0])) fs.mkdirSync (entry[0]);
				 if (!fs.existsSync (entry[0] + '/' + self.month())) fs.mkdirSync (entry[0] + '/' + self.month());
				 
				 self.rss (entry[0] + '/', entry[1], function (e,r) {
					ci++; if (ci>=c) { console.log ('fin ..'); return cb (e,r); }; 
				 });
				 
			 });
			 
		 });				
		} else {
		 console.log ('archive.txt does not exists!');
		 return cb (false, 'archive.txt does not exists!');
		};
	});
	
}


/**
 * Parse rss to find urls and download files
 */
podcasts.prototype.rss = function (myf, myurl, cb) {
    var self=this;
    
	common.get (myurl, function (e,r) {
	  if (e) {
		  var u = common.findmp3 (r);
		  var ci = 0;
		  var entries = new Array();
		  for (var i=0;i<u.length;i++) {
	        var _f  = common.basename (u[i]);
	        // var __f = common.md5(u[i]).substr(0,5)+'-'+_f;
	        var __f = _f.replace ('.mp3', '-'+common.md5(u[i]).substr(0,2)+'.mp3');
	        var myfile  = myf + self.month() + '/' + __f;
	        var myfile2 = myf + self.last_month() + '/' + __f;
	        var myfile3 = myf + self.previous_month(3) + '/' + __f; 
	        if (fs.existsSync (myfile))  continue;
	        if (fs.existsSync (myfile2)) continue;
	        if (fs.existsSync (myfile3)) continue;
	        entries[ci]={'path': myfile, 'url': u[i]}; ci++;
	      }
		  
		  self.rss_download (entries, 0, function (e,r) {
			 return cb (e,r); 
		  });
		  
	  } else {
		  return cb(false, 'can not obtain ' + myurl);
	  }
    });
	
}

podcasts.prototype.rss_download = function (entries, index, cb) {
	var self=this;
	var entry = entries[index]; index++;
	if (index >= entries.length) return cb (true, null);
	if (fs.existsSync (entry.path))  {
		return self.rss_download (entries, index, cb);
	}
	
	console.log ('downloading .. ' + entry.url);
	console.log ('file: ' + entry.path);
    common.download (entry.url, entry.path, function (e,r) {
    	if (e) {
    	 console.log ('[ok]');
    	} else {
    	 console.log ('[error]');
    	}
    	self.rss_download (entries, index, cb);	
    });
	
}


var p = new podcasts();
p.load (function (e,r) {
	process.exit ();
});

