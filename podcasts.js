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


common.current_year_month = function () {
	var t = new Date();
	var d =util.format ("%d-%d", t.getFullYear(), (t.getMonth() + 1));
	return d;	
}


common.previous_year_month = function (ndx) {
	var t = new Date();
	var m = t.getMonth()-ndx;
	var y = t.getFullYear();
	if (m<=0) { m=1; y = y - ndx; }
	var d =util.format ("%d-%d", t, m);
	return d;	
}

common.last_year_month = function () {
	var t = new Date();
	var m = t.getMonth();
	var y = t.getFullYear();
	if (m<=0) { m=1; y = y -1; }
	var d =util.format ("%d-%d", t, m);
	return d;	
}



common.md5 = function (s) {
	var hash = crypto.createHash('md5').update(s).digest('hex');
	return hash;
}


common.download = function (myurl, dest, cb) {
	var self=this;
	var file;
	
	var request = http.get(myurl, function(response) {
		
		if (response.statusCode > 300 && response.statusCode < 400 && response.headers.location) {
	      self.download_iter+=1;
		  if (self.download_iter>5) {
		    self.download_iter=0;
		    return cb (false, {fname: myurl, result: 422});
		  };
		  self.download (response.headers.location, dest, cb);
		  	
		} else { 
		  self.download_iter=0;
		  file = fs.createWriteStream(dest);
	      response.pipe(file);
	      file.on('finish', function() {
	        file.close();
	        return cb(true, {fname:myurl, result:200});
	      });
	      file.on('error', function () {
	    	file.close();
			return cb(false, {fname:myurl, result:500});
	      })
	    };
		
	});
	
};


common.get = function (myurl, cb) {
    var self=this;
    
	http.get (myurl, function (r) {
		var data='';
		
		if (r.statusCode > 300 && r.statusCode < 400 && r.headers.location) {
	        
	        if (url.parse(r.headers.location).hostname) {
	            self.get (r.headers.location, cb);
	        } else {
	        	self.get (url.parse(myurl).hostname + '/' + r.headers.location, cb); 
	        }

	    } else {
	    	
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
  	    
	    };
	    
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

    while( (matchArray = regexToken.exec( source )) !== null ) {
        var token = matchArray[0];
        urlArray.push( token );
    }

    return urlArray;
}


podcasts = function () {
	
	
};




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
				 if (entry.substring(0,1)=='#') return; // a line comment 
				 entry = entry.split (',');
				 if (entry[0]=='' || entry[1]=='') return;  
				 // console.log ("folder " + entry[0] +  "url " + entry[1] + "\n");
				 if (!fs.existsSync (entry[0])) fs.mkdirSync (entry[0]);
				 if (!fs.existsSync (entry[0] + '/' + common.current_year_month())) fs.mkdirSync (entry[0] + '/' + common.current_year_month());
				 if (!fs.existsSync (entry[0]+ '/rss')) fs.mkdirSync (entry[0]+'/rss');
				 
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
		  var rss_file = myf + 'rss/' + common.md5(r) +'.rss';
		  if (fs.existsSync(rss_file)) {
			  console.log (myurl);
			  console.log ('RSS already obtained!!');
              // return cb(false, null);
		  }
		  fs.writeFileSync (rss_file, r);
		  
		  var u = common.findmp3 (r);
		  var ci = 0;
		  var entries = new Array();
		  for (var i=0;i<u.length;i++) {
	        var _f  = common.basename (u[i]);
	        
	        var dm1 = /(\d{4})[-_\/](\d{2})[-_\/](\d{2})/;
	        var dm2 = /(\d{2})[-_\/](\d{2})[-_\/](\d{4})/;
	        var dm3 = /(\d{4})(\d{2})(\d{2})/;
	        var m   = common.current_year_month();
	        
	        try {
	         rm1 = dm1.exec(u[i]);
	         rm2 = dm2.exec(u[i]);
	         rm3 = dm3.exec(u[i]);
	         if (rm1!=null) {
	           m = rm1[1] + '-' + rm1[2];
	         } else if (rm2!=null) {
	           m = rm2[3] + '-' + rm2[1];
	         } else if (rm3!=null) {
	           if (rm3[1]<2000) {
	        	   m = '20' + rm3[1].substr(0,2) + '-' + rm3[1].substr(2);
	           } else {
	               m = rm3[1] + '-' + rm3[2];
	           };
	         }
	        } catch (e) {
	          m   = common.current_year_month();
	        }
	        
	        if (!fs.existsSync (myf + m)) fs.mkdirSync (myf + m);
	        
	        var __f = _f.replace ('.mp3', '_'+common.md5(u[i]).substr(0,2)+'.mp3');
			var m1 = myf + m + '/' + __f;
	        var m2 = myf + common.last_year_month() + '/' + __f;
	        var m3 = myf + common.previous_year_month(3) + '/' + __f; 
	        if (fs.existsSync (m1)) continue;
	        if (fs.existsSync (m2)) continue;
	        if (fs.existsSync (m3)) continue;
	        entries[ci]={'path': m1, 'url': u[i]}; 
	        ci++;
	      }
		  
		  console.log (myurl.trim());
		  console.log ('found: ' + entries.length + ' entries!');
		  
		  self.rss_download (entries, 0, function (e,r) {
			 return cb (e,r); 
		  });
		  
	  } else {
		  return cb(false, 'Unable to obtain ' + myurl);
	  }
    });
	
}

podcasts.prototype.rss_download = function (entries, index, cb) {
	var self=this;
	var entry = entries[index]; 
	index++;
	if (index >= entries.length) return cb (true, null);
	if (fs.existsSync (entry.path))  {
		return self.rss_download (entries, index, cb);
	}
	
	console.log ('downloading .. ' + entry.url);
	console.log ('file: ' + entry.path);
	
	common.download (entry.url, entry.path, function (e,r) {
		console.log (r.fname);
    	if (e) {
    	 console.log ('OK, obtained! ');
    	} else {
    	 console.log ('Unable to obtain: ' + r.result);
    	}
    	// return cb (true, null);
    	self.rss_download (entries, index, cb);	
    });
   
}


var p = new podcasts();
p.load (function (e,r) {
	console.log ('ok, obtained last entries!');
	process.exit ();
});

