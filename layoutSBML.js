/////////////////////////////////////////////////////////////////
// layoutSBML1.js: Code to define chemical system in js for the purposes
// of layout and display in a browser
/////////////////////////////////////////////////////////////////

const pixelWidth = 700;
const pixelHeight = 700;

var cx = 500.0;
var cy = 420.0;
var wx = 150;
var wy = 150;

const textXoffset = 0.3;
const textScale = 1.0;
const poolWidth = 6.0;
const poolHeight = 1.5;
const arrowWidth = 0.15;

var objLookup = {};

/////////////////////////////////////////////////////////////////

/// Define the class info
function ClassInfo( name, icon, showText ) {
		this.name = name;
		this.icon = icon;
}

function ChemObj( name, classInfo, id, color, textfg, x, y, notes) {
		this.name = name;
		this.classInfo = classInfo;
		this.parentObj = "";
		this.id = id;
		this.fg = color;
		this.textfg = textfg;
		this.x = x;
		this.y = y;
		this.notes = "";
		this.children = {};
		this.addChild = function( childObj ) {
			this.children[childObj.name] = childObj
		}
}

/// Returns a color. Arg is a numeric value 0-63 or a color name
function convColor( val, shading = 0.0 ){
	if ( isNaN( val ) ) {
		return val;
	} else {
		ret = d3.interpolateSpectral( Math.round(val/64.0) );
		return shadeRGBColor( ret, shading );
	}
}

/// From Stack Overflow Pimp Trizkit.
function shadeRGBColor(color, percent) {
    var f=color.split(","),t=percent<0?0:255,p=percent<0?percent*-1:percent,R=parseInt(f[0].slice(4)),G=parseInt(f[1]),B=parseInt(f[2]);
    return "rgb("+(Math.round((t-R)*p)+R)+","+(Math.round((t-G)*p)+G)+","+(Math.round((t-B)*p)+B)+")";
}

function makeBaseObj( xobj, anno, attr, annoName  ) {
	if ( typeof anno === "undefined") {
		throw "makeBaseObj failed, annotation not present";
	}
	manno = anno.getElementsByTagName(annoName);
	if ( (typeof manno !== "undefined") && (manno.length > 0 ) ) {
		var name = attr.getNamedItem("name").nodeValue;
		var id = attr.getNamedItem("id").nodeValue;
		var x = parseFloat(manno[0].getElementsByTagName("moose:xCord")[0].textContent);
		var y = parseFloat(manno[0].getElementsByTagName("moose:yCord")[0].textContent);
		var textfg = convColor( manno[0].getElementsByTagName("moose:textColor")[0].textContent );
		var bg = convColor( manno[0].getElementsByTagName("moose:bgColor")[0].textContent);
		var xnotes = xobj.getElementsByTagName("notes");
		var notes = ""
		if (xnotes.length > 0 ) {
			notes = xnotes[0].textContent;
		}
		return new ChemObj( name, poolClassInfo, id, bg, textfg, x,y, notes );
	} else {
		throw "makeBaseObj failed, annotation '" + annoName + "' not known";
	}
}

/////////////////////////////////////////////////////////////////

function GroupObj( xgroup, anno, attr ) {
		/*
	try {
		var base = makeBaseObj(xgroup, anno, attr, "moose:GroupAnnotation");
	}
	catch( err ) {
		document.getElementById("ErrMsg").innerHTML = err.message + ": GroupObj: Failed to build";
		return;
	}
	this.base = base;
	*/
	var id = attr.getNamedItem( "groups:id" ).nodeValue;
	var name = attr.getNamedItem( "groups:name" ).nodeValue;

	
	var manno = anno.getElementsByTagName("moose:GroupAnnotation");
	this.compartment = manno[0].getElementsByTagName("moose:Compartment")[0].textContent;
	var bg = manno[0].getElementsByTagName("moose:bgColor")[0].textContent;
	this.base = new ChemObj( name, poolClassInfo, id, convColor(bg, 0.6), "yellow", 0,0, "" );
	var members = xgroup.getElementsByTagName("groups:member");
	this.width = 10;
	this.height = 10;
	this.children = [];
	this.updateCoords = function() {
		var k;
		var x = [];
		var y = [];
		for (k = 0; k < this.children.length ; k++ ) {
			var child = objLookup[ this.children[k] ]; 
			if ( typeof child !== "undefined") {
				x.push( child.base.x );
				y.push( child.base.y );
			}
		}
		if ( this.children.length > 0 ) {
			this.base.x = Math.min( ...x ) - 0.6*poolWidth; // Another dumb syntax.
			this.base.y = Math.min( ...y ) - poolHeight;
			this.width = 0.8 * poolWidth + Math.max( ...x ) - this.base.x;
			this.height = 2 * poolHeight + Math.max( ...y ) - this.base.y;
		}
	}

	for (k = 0; k < members.length; k++ ) {
		var childId = members[k].attributes.getNamedItem( "groups:idRef" ).nodeValue;
		this.children.push( childId );
	}
}


function PoolObj( xpool, anno, attr ) {
	try {
		var base = makeBaseObj( xpool, anno, attr, "moose:ModelAnnotation" );
	}
	catch( err ) {
		document.getElementById("ErrMsg").innerHTML = err.message + ": PoolObj: Failed to build";
		return;
	}
	this.base = base;
	this.CoInit = 1000*parseFloat(attr.getNamedItem("initialConcentration").nodeValue);
	this.isBuffered = attr.getNamedItem("constant").nodeValue;
	var manno = anno.getElementsByTagName("moose:ModelAnnotation");
	this.diffConst = manno[0].getElementsByTagName("moose:diffConstant")[0].textContent;
	this.motorConst = manno[0].getElementsByTagName("moose:motorConstant")[0].textContent;
}

function addEnzSubToMsg( id, xenz, enzPool, fg ) {
	var xlist = xenz.getElementsByTagName( "listOfReactants" );
	var enzPa = "";
	if (xlist.length > 0 ) {
		var xpool = xlist[0].getElementsByTagName( "speciesReference" );
		var k;
		for (k = 0; k < xpool.length; k++ ) {
			var sattr = xpool[k].attributes;
			var pool = sattr.species.nodeValue;
			if (pool != enzPool ) { // Avoid parent pool of enzyme
				var numpool=sattr.getNamedItem( "stoichiometry" ).nodeValue;
				msgData.push( new MsgObj( "EnzSub", pool,  id,  numpool, fg ) );
			}
		}
	}
}

function addEnzPrdToMsg( id, xenz, enzPool, fg ) {
	var xlist = xenz.getElementsByTagName( "listOfProducts" );
	var enzPa = "";
	if (xlist.length > 0 ) {
		var xpool = xlist[0].getElementsByTagName( "speciesReference" );
		var k;
		for (k = 0; k < xpool.length; k++ ) {
			var sattr = xpool[k].attributes;
			var pool = sattr.species.nodeValue;
			if (pool != enzPool ) { // Avoid parent molecule of enzyme
				var numpool=sattr.getNamedItem( "stoichiometry" ).nodeValue;
				msgData.push( new MsgObj( "EnzPrd", id,  pool,  numpool, fg ) );
			}
		}
	}
}

function addReactantsToMsg( id, xreac, listName, msgName, fg ) {
	var xlist = xreac.getElementsByTagName( listName );
	var enzPa = "";
	if (xlist.length > 0 ) {
		var startIdx = 0;
		var xpool = xlist[0].getElementsByTagName( "speciesReference" );
		var k;
		for (k = 0; k < xpool.length; k++ ){
			var sattr = xpool[k].attributes;
			// pool = sattr.getNamedItem( "species" ).nodeValue;
			var pool = sattr.species.nodeValue;
			var numpool = sattr.getNamedItem( "stoichiometry" ).nodeValue;
			if ( msgName.indexOf( "Prd" ) != -1 ) {
				msgData.push( new MsgObj( msgName, id,  pool,  numpool, fg ) );
			} else {
				msgData.push( new MsgObj( msgName, pool,  id,  numpool, fg ) );
			}
		}
	}
	return enzPa;
}

function ReacObj( xreac, anno, attr ) {
	try {
		var base = makeBaseObj( xreac, anno, attr, "moose:ModelAnnotation" );
	}
	catch( err ) {
		document.getElementById("ErrMsg").innerHTML = err.message + ": ReacObj: Failed to build: " + attr.getNamedItem("id").nodeValue;
		return;
	}
	this.base = base;
	xparams = xreac.getElementsByTagName("localParameter");
	if (xparams.length > 0) {
		this.Kf = xparams[0].attributes.getNamedItem("value").nodeValue;
		if (xparams.length > 1) {
			this.Kb = xparams[1].attributes.getNamedItem("value").nodeValue;
		}
	}
	addReactantsToMsg( base.id, xreac, "listOfReactants", "ReacSub","lime");
	addReactantsToMsg( base.id, xreac, "listOfProducts", "ReacPrd", "lime");
}

function getEnzParent( xenz, anno ) {
	manno = anno.getElementsByTagName("moose:EnzymaticReaction");
	if ( (typeof manno !== "undefined") && (manno.length > 0 ) ) {
		var enzMol = manno[0].getElementsByTagName("moose:enzyme")[0].textContent;
		return enzMol;
	}
	return "";
}

function EnzObj( xenz, anno, attr ) {
	try {
		var base = makeBaseObj( xenz, anno, attr, "moose:EnzymaticReaction" );
	}
	catch( err ) {
		document.getElementById("ErrMsg").innerHTML = err.message + ": EnzObj: Failed to build";
		return;
	}
	this.base = base;
	var xparams = xenz.getElementsByTagName("localParameter");
	this.Km = 0.0;
	this.enzPool = getEnzParent(xenz, anno );
	if (xparams.length > 0) {
		this.K1 = parseFloat( xparams[0].attributes.getNamedItem("value").nodeValue );
		if (xparams.length > 1) {
			this.K2 = parseFloat( xparams[1].attributes.getNamedItem("value").nodeValue );
		}
	}
	this.addProduct = function( xenz, anno, attr ) {
		var xparams = xenz.getElementsByTagName("localParameter");
		if (xparams.length > 0) {
			this.kcat = parseFloat( xparams[0].attributes.getNamedItem("value").nodeValue );
			this.Km = (this.kcat + this.K2)/this.K1;
		}
		addEnzPrdToMsg( base.id, xenz, this.enzPool, "red");
	}
	addEnzSubToMsg( base.id, xenz, this.enzPool, "red" );
}


function MMEnzObj( xenz, anno, attr, id, enzPool ) {
	try {
		var base = makeBaseObj( xenz, anno, attr, "moose:EnzymaticReaction" );
	}
	catch( err ) {
		document.getElementById("ErrMsg").innerHTML = err.message + ": MMEnzObj: Failed to build";
		return;
	}
	this.base = base;
	this.enzPoolId = enzPool;
	xparams = xenz.getElementsByTagName("localParameter");
	if (xparams.length >= 2) { // There must be a way to check id
		this.Km = xparams[0].attributes.getNamedItem("value").nodeValue;
		this.kcat = xparams[1].attributes.getNamedItem("value").nodeValue;
	}
	addReactantsToMsg( base.id, xenz, "listOfReactants", "MMEnzSub", "blue" );
	addReactantsToMsg( base.id, xenz, "listOfProducts", "MMEnzPrd", "blue" );
}


function MsgObj( type, src, dest, stoichiometry, fg ) {
	this.type = type;
	this.src = src;
	this.dest = dest;
	this.fg = fg;
	this.markerURL = "url(#redarrow)";
	if ( fg == "green" || fg == "lime" ) {
		this.markerURL = "url(#greenarrow)";
	} else if ( fg == "blue" || fg == "cyan" ) {
		this.markerURL = "url(#bluearrow)";
	}
	this.stoichiometry = stoichiometry;
	this.innerx0 = 0.0;
	this.y0 = 0.0;
	this.x1 = 0.0;
	this.y1 = 0.0;
	this.calcTermini = function() {
		var s = objLookup[this.src].base;
		var d = objLookup[this.dest].base;
		var vx = d.x - s.x;
		var vy = d.y - s.y;
		var len = Math.sqrt( vx*vx + vy*vy );
		this.innerx0 = s.x + 0.5*poolWidth*vx/len;
		this.y0 = s.y + 0.5*poolHeight*vy/len;
		this.x1 = d.x - 0.5*poolWidth*vx/len;
		this.y1 = d.y - 0.5*poolHeight*vy/len;
		return this.innerx0;
	}
	// Algo: get x0, y0, x1, y1 for each object right off. Then the arrow
	// terminus is offset along the vector of the msg, by an ellipse.
	// Put in a getter instead, so that the msgs track their ends 
	// Remarkably filthy synatx. Challenges C++ on this.
	Object.defineProperty( this, 'x0',
			{ get: function(){ return this.calcTermini();} } 
	);
}

/////////////////////////////////////////////////////////////////

var colorNames = ["darkmagenta", "indigo", "navy", "darkgreen", "teal", "maroon", "steelblue", "black" ]; 


reacClassInfo = new ClassInfo( "Reac", "", false );
poolClassInfo = new ClassInfo( "Pool", "", true );
enzClassInfo = new ClassInfo( "Pool", "", false );
groupClassInfo = new ClassInfo( "Group", "", true );

var poolData = [];
var reacData = [];
var enzData = [];
var mmEnzData = [];
var chanData = [];
var groupData = [];
var msgData = [];

/////////////////////////////////////////////////////////////////////////


function parseGroups(xmlDoc) {
  var groups = xmlDoc.getElementsByTagName("groups:group");
  var i;
  for (i = 0; i< groups.length; i++) {
	var anno = groups[i].getElementsByTagName("annotation")
	if ( anno.length > 0 ) {
		groupData.push( new GroupObj( groups[i], anno[0], groups[i].attributes ) );
	}
  }
}


function parsePools(xmlDoc) {
  var pools = xmlDoc.getElementsByTagName("species");
  var i;
  for (i = 0; i< pools.length; i++) {
	var anno = pools[i].getElementsByTagName("annotation")
	if ( anno.length > 0 ) {
		poolData.push( new PoolObj( pools[i], anno[0], pools[i].attributes ) );
	}
  }
}
/////////////////////////////////////////////////////////////////////////

function reacType( reac, anno, attr ) {
	id = attr.getNamedItem("id").nodeValue;
	// if (typeof anno.getElementsByTagName("moose:ModelAnnotation") !== "undefined" ) {
	if ( anno.getElementsByTagName("moose:ModelAnnotation").length > 0 ) {
		return [0, id]; // reac
	}
	// if (typeof anno.getElementsByTagName("moose:EnzymaticReaction") !== "undefined" ) {
	if ( anno.getElementsByTagName("moose:EnzymaticReaction").length > 0 ) {
		if (id.indexOf("_Complex_formation_") != -1) {
			return [1, id]; // reac1/2 of mass action enzyme
		} else if (id.indexOf("_Product_formation_") != -1) {
			return [2, id]; // reac 3 of mass action enzyme
		} else {
			var mod = reac.getElementsByTagName("modifierSpeciesReference");
			if (mod.length > 0 && typeof mod[0] !== "undefined") {
				var enzPool = mod[0].attributes.getNamedItem("species").nodeValue;
				return [3, id, enzPool]; // MM enzyme. Ugh.
			}
		}
	}
	throw "reacType unknown for id: '" + id + "'";
}

function parseReacs(xmlDoc) {
  reacs = xmlDoc.getElementsByTagName("reaction");
  for (i = 0; i< reacs.length; i++) {
	anno = reacs[i].getElementsByTagName("annotation");
	if ( anno.length == 0 ) {
		document.getElementById("ErrMsg").innerHTML = "parseReacs failed: no annotations found.";
		return;
	}
	attr = reacs[i]. attributes;
 	try {
		ret = reacType( reacs[i], anno[0], attr );
	}
	catch (err) {
		document.getElementById("ErrMsg").innerHTML = err.message + ": Failed in parseReacs";
		return;
	}
	if ( ret[0] == 0 ) {
		reacData.push( new ReacObj( reacs[i], anno[0], attr ) );
	} else if ( ret[0] == 1 ) {
		enzData.push( new EnzObj( reacs[i], anno[0], attr ) )
	} else if ( ret[0] == 2 ) {
		enzData[enzData.length -1].addProduct( reacs[i], anno[0], attr )
	} else if ( ret[0] == 3 ) {
		mmEnzData.push( new MMEnzObj( reacs[i], anno[0], attr, ret[1], ret[2] ) )
	}
  }
}
/////////////////////////////////////////////////////////////////////////

function loadXMLDoc() {
  var xmlhttp = new XMLHttpRequest();
  xmlhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      parseSBML(this);
	  addAllObjToLookup();
	  doLayout();
    }
  };
  xmlhttp.open("GET", "plastic12.xml", true);
  xmlhttp.send();
}


function parseSBML(xml) {
  var xmlDoc, txt;
  xmlDoc = xml.responseXML;
  var txt = "";
  parsePools( xmlDoc );
  parseReacs( xmlDoc );
  parseGroups( xmlDoc );
  txt += "Num Pools = " + poolData.length + "<br>";
  document.getElementById("pools").innerHTML = txt;
  txt = "Num Reacs = " + reacData.length + "<br>";
  document.getElementById("reacs").innerHTML = txt;
  txt = "Num Mass Action Enz = " + enzData.length + "<br>";
  document.getElementById("enz").innerHTML = txt;
  txt = "Num MM Enz = " + mmEnzData.length + "<br>";
  document.getElementById("mmenz").innerHTML = txt;
  txt = "Num Groups = " + groupData.length + "<br>";
  document.getElementById("groups").innerHTML = txt;
  txt = "Num Msgs = " + msgData.length + "<br>";
  document.getElementById("msgs").innerHTML = txt;
}



function addAllObjToLookup() {
	poolData.forEach( addObjToLookup );
	reacData.forEach( addObjToLookup );
	enzData.forEach( addObjToLookup );
	mmEnzData.forEach( addObjToLookup );
	groupData.forEach( addObjToLookup );
	groupData.forEach( updateGroupCoords );
}

function addObjToLookup( obj ) {
	objLookup[ obj.base.id ] = obj;
}

function updateGroupCoords( grp ) {
	grp.updateCoords()
}
/////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////
// Some stuff for screen size scaling
/////////////////////////////////////////////////////////////////////////

var xScale = d3.scale.linear()
	.domain( [cx - wx/2, cx + wx/2] )
	.range( [0, pixelWidth] )

var yScale = d3.scale.linear()
	.domain( [ cy + wy/2, cy - wy/2] )
	.range( [ 0, pixelHeight] )

var xObjScale = d3.scale.linear()
	.domain( [ 0, wx ] )
	.range( [ 0, pixelWidth] )

var yObjScale = d3.scale.linear()
	.domain( [ 0, wy ] )
	.range( [ 0, pixelHeight] )

/////////////////////////////////////////////////////////////////////////
// Making the svg stuff for web page
/////////////////////////////////////////////////////////////////////////
	
function reacLineFunction( x, y ) {
	var ret =
	xScale(x-1).toFixed(2) + "," + yScale(y-0.7).toFixed(2) + " " +
	xScale(x-1.6).toFixed(2) + "," + yScale(y).toFixed(2) + " " +
	xScale(x+1.6).toFixed(2) + "," + yScale(y).toFixed(2) + " " +
	xScale(x+1).toFixed(2) + "," + yScale(y+0.7).toFixed(2);
	// console.log(ret);
	// tottxt += ret + "<br>";
	return ret;
 }

function enzLineFunction( x, y ) {
	var ret =
	xScale(x).toFixed(2) + "," + yScale(y).toFixed(2) + " " +
	xScale(x+1).toFixed(2) + "," + yScale(y+0.5).toFixed(2) + " " +
	xScale(x).toFixed(2) + "," + yScale(y+0.8).toFixed(2) + " " +
	xScale(x-1.6).toFixed(2) + "," + yScale(y).toFixed(2) + " " +
	xScale(x).toFixed(2) + "," + yScale(y-0.8).toFixed(2) + " " +
	xScale(x+1).toFixed(2) + "," + yScale(y-0.5).toFixed(2) + " " +
	xScale(x).toFixed(2) + "," + yScale(y).toFixed(2);
	// console.log(ret);
	return ret;
}


function doLayout() {
  var svgContainer = d3.select("body")
	.append("svg")
	.attr( "width", pixelWidth )
	.attr( "height", pixelHeight )
	.style( "border", "3px solid blue")
	.style( "background-color", "lightblue");

  d3.select("body")
	.on("keydown", function() {
		var kc = d3.event.keyCode;
		if (kc == 38 ) { // Up arrow
			cy -= wy/20;
		} else if (kc == 40 ) { // down arrow
			cy += wy/20;
		} else if (kc == 37 ) { // left arrow
			cx += wx/20;
		} else if (kc == 39 ) { // right arrow
			cx -= wx/20;
		} else if (kc == 188) { // comma or <, for zooming out
			wx *= 1.1;
			wy *= 1.1;
		} else if (kc == 190) { // period or >, for zooming in
			wx /= 1.1;
			wy /= 1.1;
		}
		xScale = d3.scale.linear()
			.domain( [cx - wx/2, cx + wx/2] )
			.range( [0, pixelWidth] )
		yScale = d3.scale.linear()
			.domain( [ cy + wy/2, cy - wy/2] )
			.range( [ 0, pixelHeight] )

		xObjScale = d3.scale.linear()
			.domain( [ 0, wx ] )
			.range( [ 0, pixelWidth] )

		yObjScale = d3.scale.linear()
			.domain( [ 0, wy ] )
			.range( [ 0, pixelHeight] )

		document.getElementById("ErrMsg").innerHTML = "Coords:(" + cx.toFixed(2) + "," + cy.toFixed(2) + "), window = (" + wx.toFixed(2) + "," + wy.toFixed(2) + ")";
		
		transition(svgContainer);
	});

  defs = svgContainer.append( "defs" );
  defs.append( "marker" )
	.attr({
		"id":"redarrow",
		"viewBox":"0 -5 10 10",
		"refX":5,
		"refY":0,
		"markerWidth":4,
		"markerHeight":4,
		"orient":"auto"
	})
	.append("path")
		.attr("d", "M0,-5L10,0L0,5")
		.attr("fill", "red")
		.attr("class","arrowHead");

  defs.append( "marker" )
	.attr({
		"id":"greenarrow",
		"viewBox":"0 -5 10 10",
		"refX":5,
		"refY":0,
		"markerWidth":4,
		"markerHeight":4,
		"orient":"auto"
	})
	.append("path")
		.attr("d", "M0,-5L10,0L0,5")
		.attr("fill", "lime")
		.attr("class","arrowHead");

  defs.append( "marker" )
	.attr({
		"id":"bluearrow",
		"viewBox":"0 -5 10 10",
		"refX":5,
		"refY":0,
		"markerWidth":4,
		"markerHeight":4,
		"orient":"auto"
	})
	.append("path")
		.attr("d", "M0,-5L10,0L0,5")
		.attr("fill", "blue")
		.attr("class","arrowHead");
	
  redraw( svgContainer );
}

////////////////////////////////////////////////////////////////////////
function poolMouseOver( div, d ) {
	div.transition()
		.duration(200)
		.style("opacity", 0.9);
	div.html( d.base.name + "<br/>CoInit: " + d.CoInit.toPrecision(3) )
		.style( "left", (d3.event.pageX) + "px")
		.style( "top", (d3.event.pageY - 28 ) + "px" );
}


function redraw( svgContainer ) {

  var div = d3.select("body").append("div")
	.attr( "class", "tooltip" )
	.style( "opacity", 0);

  var gdata = svgContainer.selectAll( ".groups" )
	.data( groupData )

  var group = gdata.enter().append("rect").attr("class", "groups" );

  // var groupIcons = group.append("rect")
  var groupIcons = group
	.attr( "x", function(d) {return xScale(d.base.x)} )
	.attr( "y", function(d) {return yScale(d.base.y + d.height )} )
	.attr( "width", function(d) { return xObjScale(d.width ) } )
	.attr( "height", function(d) { return yObjScale(d.height ) } )
	.attr( "fill", function(d) {return d.base.fg} );

  var groupText = gdata.enter().append( "text" )
	.attr( "class", "groups" )
	.attr( "x", function(d) {return xScale(d.base.x) } )
	.attr( "y", function(d) {return yScale(d.base.y + d.height/2) } )
	.attr( "font-family", "sans-serif" )
	.attr( "font-size", function(d) { return ""+Math.round(16 + xObjScale(textScale))+"px"} )
	.attr( "fill", function(d){return d.base.textfg} )
	.text( function(d){return d.base.name} )

  gdata.exit().remove();
		/*
  */

	////////////////////////////////
  var pdata = svgContainer.selectAll( ".pools" )
	.data( poolData )

  var pool = pdata.enter().append("rect").attr("class", "pools" );

  // var poolIcons = pool.append("rect")
  var poolIcons = pool
	.attr( "x", function(d) {return xScale(d.base.x - poolWidth/2)} )
	.attr( "y", function(d) {return yScale(d.base.y + poolHeight/2)} )
	.attr( "width", xObjScale(poolWidth) )
	.attr( "height", yObjScale(poolHeight) )
	.attr( "fill", function(d) {return d.base.fg} )
	.on( "mouseover", function(d) { poolMouseOver( div, d ) } )
	.on( "mouseout", function(d) {
		div.transition().duration(500).style( "opacity", 0.0);
	});

  var poolText = pdata.enter().append( "text" )
	.attr( "class", "pools" )
	.attr( "x", function(d){return xScale(d.base.x-textXoffset * d.base.name.length) } )
	.attr( "y", function(d) {return yScale(d.base.y - 1 + poolHeight/2)} )
	.attr( "font-family", "sans-serif" )
	.attr( "font-size", function(d) { return ""+Math.round(xObjScale(textScale))+"px"} )
	.attr( "fill", function(d){return d.base.textfg} )
	.text( function(d){return d.base.name} )
	.on( "mouseover", function(d) { poolMouseOver( div, d ) } )
	.on( "mouseout", function(d) {
		div.transition().duration(500).style( "opacity", 0.0);
	});

  pdata.exit().remove();

///////////////////////////////////

  var rdata = svgContainer.selectAll( ".reacs" )
	.data( reacData )
  var reac = rdata.enter().append("polyline").attr("class", "reacs");

  var reacIcons = reac
	.attr( "points", function(d) {return reacLineFunction( d.base.x, d.base.y ) } )
	.attr( "stroke", function(d) {return d.base.fg} )
	.attr( "stroke-width", "2" )
	.attr( "fill", "none" )
	.on( "mouseover", function(d) { 
		div.transition()
			.duration(200)
			.style("opacity", 0.9);
		div.html( "Kf= " + d.Kf + "<br/>" + "Kb= " + d.Kb )
			.style( "left", (d3.event.pageX) + "px")
			.style( "top", (d3.event.pageY - 28 ) + "px" );
	} )
	.on( "mouseout", function(d) {
		div.transition().duration(500).style( "opacity", 0.0);
	});

  rdata.exit().remove();
///////////////////////////////////

  var edata = svgContainer.selectAll( ".enzs" )
	.data( enzData )

  var enz = edata.enter().append("polyline").attr("class", "enzs");

  var enzIcons = enz
	.attr( "points", function(d) {return enzLineFunction( d.base.x, d.base.y ) } )
	.attr( "stroke", function(d) {return d.base.fg} )
	.attr( "stroke-width", "2" )
	.attr( "fill", "none" )
	.on( "mouseover", function(d) { 
		div.transition()
			.duration(200)
			.style("opacity", 0.9);
		pa = objLookup[ d.enzPool ];
		var enzPath = "";
		if ( typeof pa !== "undefined" ) {
			enzPath = pa.base.name + '/' + d.base.name;
		} else {
			enzPath = "?/" + d.base.name;
		}
		div.html( enzPath + "<br/>Km= " + d.Km.toPrecision(3) + "<br/>kcat= " + d.kcat.toPrecision(3) )
			.style( "left", (d3.event.pageX) + "px")
			.style( "top", (d3.event.pageY - 28 ) + "px" );
	} )
	.on( "mouseout", function(d) {
		div.transition().duration(500).style( "opacity", 0.0);
	});
///////////////////////////////////

  var medata = svgContainer.selectAll( ".mmenzs" )
	.data( mmEnzData )

  var mmenz = medata.enter().append("polyline").attr("class", "mmenzs");

  var mmenzIcons = mmenz
	.attr( "points", function(d) {return enzLineFunction( d.base.x, d.base.y ) } )
	.attr( "stroke", function(d) {return d.base.fg} )
	.attr( "stroke-width", "2" )
	.attr( "fill", "none" );
///////////////////////////////////

  var mdata = svgContainer.selectAll( "line" )
	.data( msgData )

  var msgs = mdata
	.enter()
	.append("line")
		.attr( "class", "arrow" )
		.attr( "stroke", function(d) {return d.fg} )
		// .attr( "stroke-width", 2 )
		.attr( "stroke-width", function(d) { return xObjScale(arrowWidth)} )
		// .attr( "marker-end", "url(#arrow)" )
		.attr( "marker-end", function(d) {return d.markerURL } )
		.attr( "x1", function(d) {return xScale(d.x0) } )
		.attr( "y1", function(d) {return yScale(d.y0) } )
		.attr( "x2", function(d) {return xScale(d.x1) } )
		.attr( "y2", function(d) {return yScale(d.y1) } )
	// Turns out d3 doesn't have a way to change marker color. So we need
	// separate markers to represent each color. Stupid.

  mdata.exit().remove();
}
/////////////////////////////////////////////////////////////////////////
// Here we define the transitions.
/////////////////////////////////////////////////////////////////////////
function transition( svgContainer ) {
	////////////////// groups /////////////////////////
  var gdata = svgContainer.selectAll( "rect.groups" )
  gdata.transition()
	.duration(300)
	.attr( "x", function(d) {return xScale(d.base.x)} )
	.attr( "y", function(d) {return yScale(d.base.y + d.height)} )
	.attr( "width", function(d) { return xObjScale(d.width ) } )
	.attr( "height", function(d) { return yObjScale(d.height ) } )
  var gtdata = svgContainer.selectAll( "text.groups" )
  gtdata.transition()
	.duration(300)
	.attr( "x", function(d) {return xScale(d.base.x) } )
	.attr( "y", function(d) {return yScale(d.base.y + d.height/2) } )
	.attr( "font-size", function(d) { return ""+Math.round(16 + xObjScale(textScale))+"px"} )

	////////////////// Pools /////////////////////////
  var pdata = svgContainer.selectAll( "rect.pools" )
  pdata.transition()
	.duration(300)
	.attr( "x", function(d) {return xScale(d.base.x - poolWidth/2)} )
	.attr( "y", function(d) {return yScale(d.base.y + poolHeight/2)} )
	.attr( "width", xObjScale(poolWidth) )
	.attr( "height", yObjScale(poolHeight) );

  var tdata = svgContainer.selectAll( "text.pools" )
  tdata.transition()
	.duration(300)
	.attr( "x", function(d){return xScale(d.base.x-textXoffset * d.base.name.length) } )
	.attr( "y", function(d) {return yScale(d.base.y - 1 + poolHeight/2)} )
	.attr( "font-size", function(d) { return ""+Math.round(xObjScale(textScale))+"px"} )

	////////////////// reacs /////////////////////////
  var rdata = svgContainer.selectAll( ".reacs" )
  rdata.transition()
	.duration(300)
	.attr( "points", function(d) {return reacLineFunction( d.base.x, d.base.y ) } )

	////////////////// enzymes /////////////////////////
  var edata = svgContainer.selectAll( ".enzs" )
  edata.transition()
	.duration(300)
	.attr( "points", function(d) {return enzLineFunction( d.base.x, d.base.y ) } )


	////////////////// MM enzymes /////////////////////////
  var medata = svgContainer.selectAll( ".mmenzs" )
  medata.transition()
	.duration(300)
	.attr( "points", function(d) {return enzLineFunction( d.base.x, d.base.y ) } )

	////////////////// Messages /////////////////////////
  var mdata = svgContainer.selectAll( "line" )
  mdata.transition()
	.duration(300)
		.attr( "x1", function(d) {return xScale(d.x0) } )
		.attr( "y1", function(d) {return yScale(d.y0) } )
		.attr( "x2", function(d) {return xScale(d.x1) } )
		.attr( "y2", function(d) {return yScale(d.y1) } )
		.attr( "stroke-width", function(d) { return Math.round( xObjScale(arrowWidth) ) } )
}
/////////////////////////////////////////////////////////////////////////
